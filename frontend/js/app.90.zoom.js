/* =========== TIME-VIEWPORT ZOOM (shared across speed/timeline/batt) =========== */
/* Holds {start, end} as ts in ms, or null = full range. */
let chartView = null;

function getVisible(pts){
  if (!chartView || !pts.length) return pts;
  /* pts is sorted by ts → binary-search the window bounds instead of scanning the
   * whole (possibly tens-of-thousands) array on every pan/redraw frame. */
  const { start, end } = chartView;
  let lo = 0, hi = pts.length;
  while (lo < hi){ const m = (lo + hi) >> 1; if (pts[m].ts < start) lo = m + 1; else hi = m; }
  const i0 = lo;
  hi = pts.length;
  while (lo < hi){ const m = (lo + hi) >> 1; if (pts[m].ts <= end) lo = m + 1; else hi = m; }
  return pts.slice(i0, lo);
}

/* Render cap ≈ screen width: you can't resolve more points than pixels, and on a
 * phone ~400 nodes paint far cheaper than 1100. Recomputed on resize. */
let RENDER_CAP = 700;
function computeRenderCap(){ RENDER_CAP = Math.min(900, Math.max(350, Math.round((window.innerWidth || 400) * 1.1))); }
computeRenderCap();
window.addEventListener('resize', computeRenderCap);

/* Cap how many points are actually rendered. SVG with thousands of nodes is the
 * main source of mobile chart lag, and the eye can't resolve more than ~1-2
 * points per pixel anyway. Uniform stride; always keeps the first + last point. */
function decimate(pts, maxN){
  const n = pts.length;
  if (n <= maxN) return pts;
  const out = new Array(maxN);
  const step = (n - 1) / (maxN - 1);
  for (let i = 0; i < maxN; i++) out[i] = pts[Math.round(i * step)];
  return out;
}

/* Coalesce rapid redraws (pan/pinch fire many touchmoves per frame) into one
 * draw per animation frame — keeps gestures smooth on dense data. */
let _histRAF = null;
function scheduleHistoryDraw(){
  if (_histRAF) return;
  _histRAF = requestAnimationFrame(() => { _histRAF = null; drawHistoryCharts(true); });
}
/* Charts off-screen during a redraw are skipped (see `see()` in drawHistoryCharts);
 * redraw them as the user scrolls so they're fresh when they enter the viewport. */
let _scrollRAF = null;
window.addEventListener('scroll', () => {
  if (_scrollRAF) return;
  _scrollRAF = requestAnimationFrame(() => {
    _scrollRAF = null;
    if (history.length && document.querySelector('.tab.active')?.dataset.page === 'history') drawHistoryCharts(true);
  });
}, { passive: true });

function updateZoomChrome(){
  /* Show floating reset button + per-chart info if zoomed */
  document.querySelectorAll('.zoom-info').forEach(el => el.remove());
  const reset = $('zoom-reset-all');
  if (!chartView){
    reset.classList.remove('show');
    return;
  }
  reset.classList.add('show');
  const fmt = ts => {
    const d = new Date(ts);
    return pad2(d.getMonth()+1) + '/' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  const span = Math.max(1, (chartView.end - chartView.start) / 1000);
  const spanStr = span < 60 ? Math.round(span)+'s' : span < 3600 ? Math.round(span/60)+'m' : (span/3600).toFixed(1)+'h';
  reset.textContent = `⊙ reset zoom · ${fmt(chartView.start)} → ${fmt(chartView.end)} (${spanStr})`;
  /* badge on each chart */
  ['chart-speed','chart-wt','chart-batt'].forEach(id => {
    const wrap = document.querySelector(`.chart-wrap[data-chart="${id}"]`);
    if (!wrap) return;
    const info = document.createElement('div');
    info.className = 'zoom-info show';
    info.textContent = '🔍 ' + spanStr;
    wrap.appendChild(info);
  });
}

/* Inertial page-scroll for vertical 1-finger swipes over a chart. touch-action
 * is none (so JS can own pinch), which means we drive the page scroll ourselves;
 * this decay loop gives it native-feeling momentum after the finger lifts. */
let _flingRAF = null;
function cancelFling(){ if (_flingRAF){ cancelAnimationFrame(_flingRAF); _flingRAF = null; } }
function flingScroll(vel){            /* vel = px to scroll on the first frame */
  cancelFling();
  const step = () => {
    if (Math.abs(vel) < 0.4){ _flingRAF = null; return; }
    window.scrollBy(0, vel);
    vel *= 0.93;
    _flingRAF = requestAnimationFrame(step);
  };
  _flingRAF = requestAnimationFrame(step);
}

/* Bind viewport-zoom controls to a chart SVG. All shared, so any chart drives them. */
function bindChartZoom(svg, chartId){
  /* Wrap */
  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  wrap.dataset.chart = chartId;
  svg.parentNode.insertBefore(wrap, svg);
  wrap.appendChild(svg);

  function fullSpan(){
    if (!history.length) return null;
    const ts = history.map(entryTs).filter(t => t > 0).sort((a,b)=>a-b);
    return ts.length ? { start: ts[0], end: ts[ts.length-1] } : null;
  }
  function curView(){
    return chartView || fullSpan() || { start: 0, end: 1 };
  }
  function pxToTs(px){
    /* svg layout in user coords: 600 wide. Get fraction from pixel within wrap. */
    const r = wrap.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (px - r.left) / r.width));
    const v = curView();
    return v.start + frac * (v.end - v.start);
  }
  function applyView(start, end){
    const full = fullSpan(); if (!full) return;
    const fullSpanMs = full.end - full.start;
    /* Total exploded sample count across all cached entries — each POST with
     * raw sp[] adds N points (2s spacing), each aggregate adds 1. Used to set
     * a reasonable zoom-in floor that doesn't refuse to zoom when most of the
     * fullSpan is filled by a few POSTs that explode into many sub-points. */
    let subCount = 0;
    for (const e of history){
      const a = e.speed || e.sp;
      subCount += (Array.isArray(a) && a.length) ? a.length : 1;
    }
    const sampleGap = subCount > 1 ? fullSpanMs / (subCount - 1) : fullSpanMs;
    const minSpan = Math.max(10 * 1000, sampleGap * 5);   /* show ≥5 samples, hard floor 10s */

    if (end - start < minSpan){
      const mid = (start + end) / 2;
      start = mid - minSpan / 2;
      end   = mid + minSpan / 2;
    }
    if (start < full.start){ end += full.start - start; start = full.start; }
    if (end   > full.end)  { start -= end - full.end;   end   = full.end; }
    if (start < full.start) start = full.start;
    if (end - start >= fullSpanMs - 1000){
      chartView = null;
    } else {
      chartView = { start, end };
    }
    scheduleHistoryDraw();   /* coalesce per-frame during pan/pinch */
  }
  function zoomAt(cx, factor){
    const v = curView();
    const centerTs = pxToTs(cx);
    const newWidth = (v.end - v.start) * factor;
    applyView(centerTs - (centerTs - v.start) * factor, centerTs + (v.end - centerTs) * factor);
  }

  /* Wheel zoom */
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.clientX, e.deltaY < 0 ? 0.75 : 1.33);
  }, { passive: false });

  /* Mouse pan */
  let dragging = false, lx = 0;
  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.fs-btn,.zoom-reset-all')) return;
    dragging = true; lx = e.clientX;
    wrap.classList.add('dragging'); e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx; lx = e.clientX;
    const v = curView();
    const r = wrap.getBoundingClientRect();
    const dts = -dx / r.width * (v.end - v.start);
    applyView(v.start + dts, v.end + dts);
  });
  window.addEventListener('mouseup', () => { dragging = false; wrap.classList.remove('dragging'); });

  /* Touch: 1-finger = pan (only when horizontal intent), 2-fingers = pinch.
   * IMPORTANT: don't preventDefault on touchstart — that blocks native page
   * scroll when user just wanted to swipe past the chart. Decide intent on
   * first touchmove: if |dx| > |dy| → pan (preventDefault), else let scroll. */
  let touches = {}, pinchStartDist = 0, pinchStartSpan = 0, pinchCenter = 0;
  let touchOrigin = null, panMode = null, vVel = 0;   /* panMode: 'h' pan, 'v' scroll, null unknown */
  wrap.addEventListener('touchstart', e => {
    if (e.target.closest('.fs-btn,.zoom-reset-all')) return;
    cancelFling();                              /* tap stops any inertial scroll */
    for (const t of e.changedTouches) touches[t.identifier] = { x: t.clientX, y: t.clientY };
    const ks = Object.keys(touches);
    if (ks.length === 1){
      const t0 = Object.values(touches)[0];
      touchOrigin = { x: t0.x, y: t0.y };
      panMode = null; vVel = 0;
    }
    if (ks.length === 2){
      const [a, b] = Object.values(touches);
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const v = curView();
      pinchStartSpan = v.end - v.start;
      pinchCenter = pxToTs((a.x + b.x) / 2);
      panMode = 'h';   /* 2-finger always = pinch zoom */
      e.preventDefault();
    }
  }, { passive: false });
  wrap.addEventListener('touchmove', e => {
    const ks = Object.keys(touches);
    if (ks.length === 1 && touchOrigin){
      const t = e.changedTouches[0];
      if (!touches[t.identifier]) return;
      const prev = touches[t.identifier];
      touches[t.identifier] = { x: t.clientX, y: t.clientY };
      if (panMode === null){
        /* Lock direction once movement exceeds threshold */
        const dx = Math.abs(t.clientX - touchOrigin.x);
        const dy = Math.abs(t.clientY - touchOrigin.y);
        if (dx < 6 && dy < 6) return;
        panMode = dx > dy ? 'h' : 'v';
      }
      if (panMode === 'v') return;   /* vertical → let the browser scroll natively (touch-action:pan-y) */
      const dx = t.clientX - prev.x;
      const v = curView();
      const r = wrap.getBoundingClientRect();
      const dts = -dx / r.width * (v.end - v.start);
      applyView(v.start + dts, v.end + dts);
      e.preventDefault();
    }
    if (ks.length === 2){
      /* Update touch positions FIRST, then read fresh values */
      for (const t of e.changedTouches) if (touches[t.identifier]) touches[t.identifier] = { x: t.clientX, y: t.clientY };
      const vals = Object.values(touches);
      if (vals.length < 2){ e.preventDefault(); return; }   /* need both fingers */
      const [a, b] = vals;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 1){ e.preventDefault(); return; }           /* guard div-by-~0 → NaN/huge span */
      const newSpan = pinchStartSpan * (pinchStartDist / dist);
      const r = wrap.getBoundingClientRect();
      const cxFrac = ((a.x + b.x) / 2 - r.left) / r.width;
      const ns = pinchCenter - cxFrac * newSpan, ne = pinchCenter + (1 - cxFrac) * newSpan;
      if (isFinite(ns) && isFinite(ne) && ne > ns) applyView(ns, ne);   /* never push NaN into the view */
      e.preventDefault();
    }
  }, { passive: false });
  /* Rebuild `touches` from the AUTHORITATIVE active-touch list (e.touches), and
   * also listen for touchcancel. Previously a missed touchcancel (the browser
   * fires it whenever it steals a gesture — common on mobile) left stale finger
   * ids behind, so every later gesture looked like a 2-finger pinch → zoom stuck,
   * scroll + left/right pan broken. Resetting from e.touches fixes that. */
  function onTouchEnd(e){
    const live = {};
    for (const t of e.touches) live[t.identifier] = touches[t.identifier] || { x: t.clientX, y: t.clientY };
    touches = live;
    if (!e.touches.length){ touchOrigin = null; panMode = null; }
  }
  wrap.addEventListener('touchend', onTouchEnd);
  wrap.addEventListener('touchcancel', onTouchEnd);

  wrap.addEventListener('dblclick', () => { chartView = null; drawHistoryCharts(); });
}

/* Same as bindChartZoom but for the live timeline — uses `liveView` state. */
function bindLiveChartZoom(svg){
  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  svg.parentNode.insertBefore(wrap, svg);
  wrap.appendChild(svg);

  function fullSpan(){
    if (!speedHistory.length) return null;
    const ts = speedHistory.map(p => p.t);
    return { start: Math.min(...ts), end: Math.max(...ts) };
  }
  function curView(){ return liveView || fullSpan() || { start: 0, end: 1 }; }
  function pxToTs(px){
    const r = wrap.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (px - r.left) / r.width));
    const v = curView(); return v.start + frac * (v.end - v.start);
  }
  function applyView(start, end){
    const full = fullSpan(); if (!full) return;
    const minSpan = 10 * 1000;  /* 10s min for live */
    if (end - start < minSpan){ const m = (start + end) / 2; start = m - minSpan/2; end = m + minSpan/2; }
    if (start < full.start){ end += full.start - start; start = full.start; }
    if (end > full.end){ start -= end - full.end; end = full.end; }
    if (start < full.start) start = full.start;
    if (end - start >= full.end - full.start - 1000) liveView = null;
    else liveView = { start, end };
    drawLiveTimeline();
  }
  function zoomAt(cx, factor){
    const v = curView();
    const centerTs = pxToTs(cx);
    applyView(centerTs - (centerTs - v.start) * factor, centerTs + (v.end - centerTs) * factor);
  }
  wrap.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.deltaY < 0 ? 0.75 : 1.33); }, { passive: false });

  let dragging = false, lx = 0;
  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.fs-btn,.zoom-reset-all')) return;
    dragging = true; lx = e.clientX; wrap.classList.add('dragging'); e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lx; lx = e.clientX;
    const v = curView(); const r = wrap.getBoundingClientRect();
    const dts = -dx / r.width * (v.end - v.start);
    applyView(v.start + dts, v.end + dts);
  });
  window.addEventListener('mouseup', () => { dragging = false; wrap.classList.remove('dragging'); });

  let touches = {}, pinchStartDist = 0, pinchStartSpan = 0, pinchCenter = 0;
  let touchOrigin = null, panMode = null, vVel = 0;
  wrap.addEventListener('touchstart', e => {
    if (e.target.closest('.fs-btn,.zoom-reset-all')) return;
    cancelFling();
    for (const t of e.changedTouches) touches[t.identifier] = { x: t.clientX, y: t.clientY };
    const ks = Object.keys(touches);
    if (ks.length === 1){
      const t0 = Object.values(touches)[0];
      touchOrigin = { x: t0.x, y: t0.y };
      panMode = null; vVel = 0;
    }
    if (ks.length === 2){
      const [a,b] = Object.values(touches);
      pinchStartDist = Math.hypot(a.x-b.x, a.y-b.y) || 1;
      const v = curView(); pinchStartSpan = v.end - v.start;
      pinchCenter = pxToTs((a.x + b.x) / 2);
      panMode = 'h';
      e.preventDefault();
    }
  }, { passive: false });
  wrap.addEventListener('touchmove', e => {
    const ks = Object.keys(touches);
    if (ks.length === 1 && touchOrigin){
      const t = e.changedTouches[0];
      if (!touches[t.identifier]) return;
      const prev = touches[t.identifier];
      touches[t.identifier] = { x: t.clientX, y: t.clientY };
      if (panMode === null){
        const dx = Math.abs(t.clientX - touchOrigin.x);
        const dy = Math.abs(t.clientY - touchOrigin.y);
        if (dx < 6 && dy < 6) return;
        panMode = dx > dy ? 'h' : 'v';
      }
      if (panMode === 'v') return;   /* vertical → native browser scroll (touch-action:pan-y) */
      const dx = t.clientX - prev.x; const v = curView();
      const r = wrap.getBoundingClientRect();
      const dts = -dx / r.width * (v.end - v.start);
      applyView(v.start + dts, v.end + dts);
      e.preventDefault();
    }
    if (ks.length === 2){
      for (const t of e.changedTouches) if (touches[t.identifier]) touches[t.identifier] = { x: t.clientX, y: t.clientY };
      const vals = Object.values(touches);
      if (vals.length < 2){ e.preventDefault(); return; }
      const [a,b] = vals;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 1){ e.preventDefault(); return; }
      const newSpan = pinchStartSpan * (pinchStartDist / dist);
      const r = wrap.getBoundingClientRect();
      const cxFrac = ((a.x + b.x) / 2 - r.left) / r.width;
      const ns = pinchCenter - cxFrac * newSpan, ne = pinchCenter + (1 - cxFrac) * newSpan;
      if (isFinite(ns) && isFinite(ne) && ne > ns) applyView(ns, ne);
      e.preventDefault();
    }
  }, { passive: false });
  function onTouchEnd(e){   /* see bindChartZoom: rebuild from e.touches + handle touchcancel */
    const live = {};
    for (const t of e.touches) live[t.identifier] = touches[t.identifier] || { x: t.clientX, y: t.clientY };
    touches = live;
    if (!e.touches.length){ touchOrigin = null; panMode = null; }
  }
  wrap.addEventListener('touchend', onTouchEnd);
  wrap.addEventListener('touchcancel', onTouchEnd);
  wrap.addEventListener('dblclick', () => { liveView = null; drawLiveTimeline(); });
}

/* =========== CHART TOOLTIP (scrub / tap a point → exact data + date) =========== */
/* Reads svg.__ctx stashed by drawWindTimeline / drawLineChart. Desktop = hover,
 * mobile = tap (the zoom layer only reacts to drags, so a still tap is free).
 * Pure client-side — costs zero extra bytes (good for 2G). */
function attachChartTooltip(svg){
  const wrap = svg.closest('.chart-wrap') || svg.parentNode;
  const ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ov.setAttribute('class', 'xhair-svg');
  ov.setAttribute('viewBox', svg.getAttribute('viewBox'));   /* match transform exactly */
  wrap.appendChild(ov);
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  wrap.appendChild(tip);
  let pinTs = null;

  const NS = 'http://www.w3.org/2000/svg';
  function nearest(c, ts){
    let best = c.pts[0], bd = Infinity;
    for (const p of c.pts){ const d = Math.abs(p.ts - ts); if (d < bd){ bd = d; best = p; } }
    return best;
  }
  function showAtTs(ts){
    const c = svg.__ctx;
    if (!c || !c.pts || !c.pts.length){ hide(); return; }
    ov.setAttribute('viewBox', svg.getAttribute('viewBox'));   /* W is dynamic per draw */
    const p = nearest(c, ts);
    pinTs = p.ts;
    const innerW = c.W - c.LEFT - c.RIGHT, innerH = c.H - c.TOP - c.BOT;
    const X  = c.LEFT + (p.ts - c.xMin) / (c.xMax - c.xMin || 1) * innerW;
    const syOf = (v, mn, mx) => c.H - c.BOT - ((Math.min(v, mx) - mn) / (mx - mn || 1)) * innerH;
    const DOT  = (y, col) => `<circle cx="${X.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${col}" stroke="var(--bg)" stroke-width="1.5"/>`;
    const RING = (y, col) => `<circle cx="${X.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="none" stroke="${col}" stroke-width="1.5"/>`;

    let dots = '', lines = '';
    const kind = c.tipKind || 'wind';
    if (kind === 'wind'){
      const gv = p.speedMax ?? p.speed, hasG = gv > p.speed + 0.05;
      if (hasG) dots += RING(syOf(gv, 0, c.yMax), '#79c0ff');
      dots += DOT(syOf(p.speed, 0, c.yMax), 'var(--accent)');
      const bf = beaufortOf(p.speed);
      lines += `<div><b>${p.speed.toFixed(1)}</b> ${spdLbl()} · ${bf.icon} ${bf.label}</div>`;
      if (hasG)                        lines += `<div style="color:#79c0ff">${t('gust')} ${gv.toFixed(1)} ${spdLbl()}</div>`;
      if (p.dir != null && p.dir >= 0) lines += `<div>${DIRS[p.dir]} · ${p.dir*45}°</div>`;
    } else if (kind === 'solar'){
      const v = p.solar ?? 0;
      dots += DOT(syOf(v, c.yMin, c.yMax), '#f0883e');
      lines += `<div>☀ <b style="color:#f0883e">${v.toFixed(0)}</b> mV</div>`;
    } else if (kind === 'batt'){
      const bv = p.batt;
      if (typeof bv === 'number' && bv > 0){
        dots += DOT(syOf(bv, c.yMin, c.yMax), '#3fb950');
        const bp = battPct(bv).pct;
        lines += `<div>🔋 <b style="color:#3fb950">${bv.toFixed(0)}</b> mV${bp != null ? ' · ' + bp + '%' : ''}</div>`;
      }
    } else if (kind === 'signal'){
      const cv = p.csq;
      if (typeof cv === 'number' && cv >= 1 && cv <= 31){
        dots += DOT(syOf(cv, 0, c.yMax), '#58d3ff');
        lines += `<div style="color:#58d3ff">📶 CSQ ${cv} · ${(-113 + 2*cv)} dBm</div>`;
      }
    } else if (kind === 'battsig'){
      const bv = p.batt;
      if (typeof bv === 'number' && bv > 0){
        dots += DOT(syOf(bv, c.yMinB, c.yMaxB), '#3fb950');
        const bp = battPct(bv).pct;
        lines += `<div>🔋 <b style="color:#3fb950">${bv.toFixed(0)}</b> mV${bp != null ? ' · ' + bp + '%' : ''}</div>`;
      }
      /* CSQ line is built separately (unsmoothed, 99 filtered) — match by nearest ts */
      let cqp = null, bd = Infinity;
      for (const q of (c.csqPts || [])){ const dd = Math.abs(q.ts - p.ts); if (dd < bd){ bd = dd; cqp = q; } }
      if (cqp && cqp.csq >= 1 && cqp.csq <= 31){
        dots += DOT(syOf(cqp.csq, 0, 31), '#58d3ff');
        lines += `<div style="color:#58d3ff">📶 CSQ ${cqp.csq} · ${(-113 + 2*cqp.csq)} dBm</div>`;
      }
    }
    ov.innerHTML = `<line x1="${X.toFixed(1)}" y1="${c.TOP}" x2="${X.toFixed(1)}" y2="${c.H-c.BOT}" stroke="var(--accent)" stroke-width="1" opacity=".75"/>` + dots;

    const d = new Date(p.ts);
    const date = pad2(d.getDate()) + '.' + pad2(d.getMonth()+1) + '.' + d.getFullYear();
    const time = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    tip.innerHTML = `<div class="tt-date">${date} · ${time}</div>` + (lines || `<div class="tt-date">${t('no_data')}</div>`);

    const rb = svg.getBoundingClientRect(), wb = wrap.getBoundingClientRect();
    const pxX = (rb.left - wb.left) + (X / c.W) * rb.width;
    /* clamp by the tip's real half-width (it's centered via translateX(-50%)) so it
     * never spills past the card edge — a spilled tip widened the page on mobile. */
    const half = tip.offsetWidth / 2 + 4;
    tip.style.left = Math.max(half, Math.min(wb.width - half, pxX)).toFixed(0) + 'px';
    tip.classList.add('show');
  }
  function showAtClientX(clientX, toggle){
    const c = svg.__ctx;
    if (!c || !c.pts || !c.pts.length){ hide(); return; }
    const rb = svg.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rb.left) / rb.width));
    const xUser = frac * c.W;
    const ts = c.xMin + (xUser - c.LEFT) / (c.W - c.LEFT - c.RIGHT) * (c.xMax - c.xMin);
    if (toggle && pinTs != null && tip.classList.contains('show') && nearest(c, ts).ts === pinTs){ hide(); return; }
    showAtTs(ts);
  }
  function hide(){ pinTs = null; ov.innerHTML = ''; tip.classList.remove('show'); }

  svg.__hideTip = hide;
  svg.__refreshTip = () => { if (pinTs != null) showAtTs(pinTs); };

  /* desktop hover. Touch devices fire a SYNTHETIC mousemove right after every
   * touch (incl. after a pan) — that used to pop a tooltip on the chart body
   * once the finger lifted, which felt broken. Ignore mousemoves that land just
   * after a touch (and any with a pressed button = a drag). */
  let lastTouch = 0;
  wrap.addEventListener('mousemove', e => {
    if (e.buttons) return;
    if (Date.now() - lastTouch < 700) return;   /* suppress synthetic-after-touch */
    showAtClientX(e.clientX, false);
  });
  wrap.addEventListener('mouseleave', e => { if (Date.now() - lastTouch < 700) return; hide(); });

  /* mobile tap (no pan): track start, fire only on a still, short touch */
  let t0 = null, x0 = 0, y0 = 0;
  wrap.addEventListener('touchstart', e => {
    lastTouch = Date.now();
    if (e.touches.length !== 1){ t0 = null; return; }
    t0 = e.timeStamp; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    lastTouch = Date.now();
    if (t0 == null) return;
    const ch = e.changedTouches[0];
    if (!ch){ t0 = null; return; }
    const moved = Math.abs(ch.clientX - x0) > 8 || Math.abs(ch.clientY - y0) > 8;
    if (!moved && (e.timeStamp - t0) < 500) showAtClientX(ch.clientX, true);
    t0 = null;
  }, { passive: true });
}

/* =========== FULLSCREEN =========== */
function makeFullscreenable(el){
  if (el.querySelector('.fs-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'fs-btn';
  btn.innerHTML = icSvg('ic-expand');
  btn.title = 'Fullscreen';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const cur = document.querySelector('.card.fs, .gauge-card.fs');
    if (cur && cur !== el){ cur.classList.remove('fs'); cur.querySelector('.fs-btn').innerHTML = icSvg('ic-expand'); }
    el.classList.toggle('fs');
    btn.innerHTML = el.classList.contains('fs') ? icSvg('ic-x') : icSvg('ic-expand');
    document.body.classList.toggle('has-fs', !!document.querySelector('.card.fs, .gauge-card.fs'));
    /* On enter/exit fullscreen, redraw so charts reflow to the new width */
    clearChartDims();
    drawLiveTimeline();
    if (history.length) drawHistoryCharts();
  });
  el.appendChild(btn);
}
document.querySelectorAll('.card, .gauge-card').forEach(makeFullscreenable);
/* ESC to exit fullscreen */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){
    const cur = document.querySelector('.card.fs, .gauge-card.fs');
    if (cur){ cur.classList.remove('fs'); cur.querySelector('.fs-btn').innerHTML = icSvg('ic-expand'); document.body.classList.remove('has-fs'); clearChartDims(); if (history.length) drawHistoryCharts(); }
  }
});

