/* =========== HISTORY =========== */
document.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-range]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  currentRange = b.dataset.range;
  localStorage.setItem('range', currentRange);
  /* keep the "⋯ more" panel open if the chosen range lives inside it; close on a primary pick */
  const inMore = !!b.closest('#range-more');
  const more = $('range-more'), moreBtn = $('range-more-btn');
  if (more && moreBtn){ more.hidden = !inMore; moreBtn.classList.toggle('active', inMore); }
  renderHistory();
}));
/* reflect the restored range on the buttons (default markup has 1h active) */
(function(){
  const rb = document.querySelector(`[data-range="${currentRange}"]`);
  if (rb && !rb.classList.contains('active')){
    document.querySelectorAll('[data-range]').forEach(x => x.classList.remove('active'));
    rb.classList.add('active');
    if (rb.closest('#range-more')){ const more = $('range-more'), mb = $('range-more-btn'); if (more) more.hidden = false; if (mb) mb.classList.add('active'); }
  }
})();

/* ===== Cache layer ===== Engine in store.js (`Cache`): OPFS append-only file when
 * available, IndexedDB fallback otherwise. These thin shims keep every call site
 * (renderHistory, live-ctl, zoom) unchanged. */
function entryTs(e){
  /* full ("timestamp":"YYYY-MM-DD HH:MM:SS") or compact ("t"), or a precomputed .ts */
  if (typeof e.ts === 'number' && e.ts > 0) return e.ts;
  return parseServerTs(e.timestamp ?? e.t);
}
const dbPut       = entries => Cache.append(entries);
const dbRange     = (fromMs, toMs) => Cache.range(fromMs, toMs);
const dbNewestTs  = () => Cache.newestTs();
const dbOldestTs  = () => Cache.oldestTs();
const dbCount     = () => Cache.count();
const dbTrim      = days => Cache.trim(days);
const dbClear     = () => Cache.clear();
const dbEstimate  = () => Cache.estimate();
const dbPurgeBadKeys = async () => 0;        /* legacy IDB cleanup - store.js keys are clean */
const dbPurgeAggregateOnly = async () => 0;  /* keep_raw refetch is handled by renderHistory */

function rangeSec(r){
  const m = /^(\d+)\s*([mhd])$/.exec(r);
  if (!m) return 3600;
  const n = +m[1], u = m[2];
  return u === 'm' ? n*60 : u === 'h' ? n*3600 : n*86400;
}

async function renderHistory(){
  if (testMode){
    history = genMockHistory(currentRange);
    drawHistoryCharts();
    return;
  }
  /* shimmer the chart frames on the very first (cold) load while we fetch */
  if ($('chart-speed') && !$('chart-speed').hasChildNodes())
    ['chart-speed', 'chart-rose', 'chart-batt'].forEach(id => $(id)?.classList.add('skeleton'));
  try {
    const nowMs = Date.now();
    const cutoffMs = nowMs - rangeSec(currentRange) * 1000;
    const newestMs = await dbNewestTs();
    const newestEpoch = Math.floor(newestMs / 1000);
    const bin = 0;   /* Ф2: the front computes LOD from local raw — no server binning */
    /* For short ranges keep raw vane[]/speed[] arrays so we can explode each
     * POST into per-2s sub-points (real fine-grained resolution, not just
     * aggregates). Long ranges use server-side binning which strips arrays anyway. */
    const keepRaw = !bin;

    const oldestMs = await dbOldestTs();
    /* Backfill needed when the cache doesn't reach back to the requested window —
     * i.e. cold start (empty DB) OR the user widened the range to before the
     * oldest cached entry. Without this the chart could only ever show the last
     * 24h after a cache clear, never older data (e.g. last weekend). */
    const tolMs = 2 * 60 * 60 * 1000;   /* 2h slack so we don't refetch on tiny gaps */
    const needBackfill = newestEpoch === 0 || cutoffMs < oldestMs - tolMs;
    const binParam = bin ? '&bin=' + bin : '';
    const rawParam = keepRaw ? '&keep_raw=1' : '';

    const fetched = [];
    let netNote = '';
    /* Forward: pull anything newer than what we have (cheap, runs every poll). */
    if (newestEpoch > 0){
      const url = SRV + '?since=' + newestEpoch + '&compact=1&fmt=c' + binParam + rawParam + '&t=' + nowMs;
      try {
        const data = await fjson(url);
        if (Array.isArray(data)){ fetched.push(...data); netNote = `+${data.length} new`; }
      } catch (e){ netNote = 'offline · using cache'; }
    }
    /* Backward: seed / backfill the whole requested range from the server. The
     * server's ?range is "last N from now", so it covers cutoff..now including
     * the older part; dbPut dedupes by ts so overlap with the forward fetch is fine. */
    if (needBackfill){
      const url = SRV + '?range=' + encodeURIComponent(currentRange) + '&compact=1&fmt=c' + binParam + rawParam + '&t=' + nowMs;
      try {
        const d = await fjson(url);
        if (Array.isArray(d)){ fetched.push(...d); netNote = (newestEpoch === 0 ? 'seed ' : 'backfill ') + d.length; }
      } catch (e){ if (!netNote) netNote = 'offline'; }
    }
    await dbPut(fetched);
    await dbTrim(cacheRetentionDays);

    /* Pull only the range we need from DB */
    history = await dbRange(cutoffMs, nowMs);
    drawHistoryCharts();
    loadHeatmapData();   /* heatmap uses its own wider 7d hourly data (throttled) */

    const est = await dbEstimate();
    const usedKB = (est.used / 1024).toFixed(0);
    const total = await dbCount();
    /* Count exploded sub-points so the meta reflects what's actually plotted.
     * (entries × samples-per-entry, with fallback to entry count for aggregates). */
    let subPts = 0;
    for (const e of history){
      const arr = e.speed || e.sp;
      subPts += (Array.isArray(arr) && arr.length) ? arr.length : 1;
    }
    const ptsLbl = subPts > history.length
      ? `${subPts} pts (${history.length} POSTs, ${total} cached)`
      : `${history.length} pts (${total} cached)`;
    $('hi-speed-meta').textContent = `${ptsLbl} · ${usedKB}KB · ${netNote}`;
    updateCacheStats();
  } catch (e){
    $('chart-speed').innerHTML = `<text x="300" y="90" text-anchor="middle" fill="var(--err)" font-size="12">err: ${e.message}</text>`;
  }
}

/* ---- Ф2: span-aware LOD point building ----
 * Short spans explode each POST into per-2s sub-points (full detail). Longer spans
 * bin POSTs into ~PT_TARGET buckets so we never build/draw millions of points. The
 * bucket is the IDEAL size for the span (span/PT_TARGET) — finer than the named file
 * tiers (those are for persisted multi-year data, future). */
const PT_TARGET = 1500;
const EXPLODE_SPAN_MS = 2 * 3600 * 1000;   /* <=2h -> per-2s sub-points */
function _histLB(ts){ let a=0,b=history.length; while(a<b){const m=(a+b)>>1; if(entryTs(history[m])<ts)a=m+1; else b=m;} return a; }
const TIER_SPAN_MS = 8 * 86400 * 1000;   /* > 8 days → read pre-aggregated tier files (≤8d
                                          * bins the bounded raw WINDOW on the fly = finer) */
function buildPtsLOD(fromMs, toMs){
  const SF = SPEED_FACTOR * spdMul(), SAMPLE_MS = 2000;
  const span = Math.max(1, toMs - fromMs);
  const margin = span * 0.02;
  /* Long spans: read a few hundred ready bucket records from a tier file instead of
   * scanning tens of thousands of raw points every frame (and future-proof for years). */
  if (span > TIER_SPAN_MS && typeof Cache !== 'undefined' && Cache.tier){
    const recs = Cache.tier(Cache.pickTierName(span), fromMs - margin, toMs + margin);
    return recs.map(r => ({ ts: r.t, speed: (r.sm / 2) * SF, speedMax: (r.sx / 2) * SF, batt: r.b, solar: r.sol, csq: r.c, dir: r.vm ?? null }));
  }
  /* include ONE entry just before/after the window so a zoom into an outage still draws
   * a connecting line/bridge across the gap (continuity) instead of a blank "offline". */
  const win = history.slice(Math.max(0, _histLB(fromMs) - 1), Math.min(history.length, _histLB(toMs) + 1));
  const pts = [];
  if (span <= EXPLODE_SPAN_MS){
    for (const e of win){
      const endTs = entryTs(e); if (!endTs) continue;
      const speedArr = e.speed || e.sp, vaneArr = e.vane || e.va;
      const batt = e.batt_mv ?? e.b ?? 0, solar = e.solar_mv ?? e.sol ?? null, csq = e.csq ?? e.c ?? 0;
      if (Array.isArray(speedArr) && speedArr.length){
        const N = speedArr.length;
        for (let i = 0; i < N; i++){
          const subTs = endTs - (N - 1 - i) * SAMPLE_MS;
          const kmh = ((speedArr[i] || 0) / 2) * SF;
          let dirIdx = null; const v = vaneArr ? vaneArr[i] : null;
          if (v != null && v !== 0xFF){ for (let k = 0; k < 8; k++){ if (!(v & (1 << k))){ dirIdx = k; break; } } }
          pts.push({ ts: subTs, speed: kmh, speedMax: kmh, batt, solar, csq, dir: dirIdx, sub: true });
        }
      } else {
        const sm = e.speed_mean ?? e.sm ?? e.s ?? 0, sx = e.speed_max ?? e.sx ?? sm;
        pts.push({ ts: endTs, speed: (sm/2)*SF, speedMax: (sx/2)*SF, batt, solar, csq, dir: e.vane_mode ?? e.vm ?? null });
      }
    }
  } else {
    const bucket = span / PT_TARGET;
    /* Explode each POST's per-2s samples into the buckets they actually span, THEN aggregate
     * per bucket — so a 15-min/450-sample POST becomes ~15 jagged points, not one flat mean.
     * Capped so very wide spans fall back to per-POST aggregation (speed). */
    let totalSamp = 0; for (const e of win){ const a = e.speed || e.sp; totalSamp += (Array.isArray(a) && a.length) ? a.length : 1; }
    const fine = totalSamp <= 60000;
    const map = new Map();
    const add = (t, val, vmax, batt, solar, csq, dir) => {
      const key = Math.floor(t / bucket);
      let a = map.get(key);
      if (!a){ a = { tsum:0, n:0, ssum:0, smax:0, bsum:0, bn:0, solsum:0, soln:0, csq:0, dirs:new Array(8).fill(0) }; map.set(key, a); }
      a.tsum += t; a.n++; a.ssum += val; if (vmax > a.smax) a.smax = vmax;
      if (typeof batt === 'number' && batt > 0){ a.bsum += batt; a.bn++; }
      if (typeof solar === 'number'){ a.solsum += solar; a.soln++; }
      if (typeof csq === 'number'){ if (csq >= 1 && csq <= 31) a.csq = csq; else if (csq === 99 && !a.csq) a.csq = 99; }
      if (dir != null && dir >= 0 && dir < 8) a.dirs[dir]++;
    };
    for (const e of win){
      const endTs = entryTs(e); if (!endTs) continue;
      const arr = e.speed || e.sp, vaneArr = e.vane || e.va;
      const batt = e.batt_mv ?? e.b, solar = e.solar_mv ?? e.sol, csq = e.csq ?? e.c;
      if (fine && Array.isArray(arr) && arr.length){
        const N = arr.length;
        for (let i = 0; i < N; i++){
          const subTs = endTs - (N - 1 - i) * SAMPLE_MS, pulse = arr[i] || 0;
          let dir = null; const v = vaneArr ? vaneArr[i] : null;
          if (v != null && v !== 0xFF){ for (let k = 0; k < 8; k++) if (!(v & (1 << k))){ dir = k; break; } }
          add(subTs, pulse, pulse, batt, solar, csq, dir);
        }
      } else {
        let sm, sx;
        if (Array.isArray(arr) && arr.length){ let s=0,mx=0; for (const v of arr){ s+=v; if(v>mx)mx=v; } sm=s/arr.length; sx=mx; }
        else { sm = e.speed_mean ?? e.sm ?? e.s ?? 0; sx = e.speed_max ?? e.sx ?? sm; }
        add(endTs, sm, sx, batt, solar, csq, e.vane_mode ?? e.vm);
      }
    }
    for (const a of map.values()){
      let dir = null, mx = 0; for (let k = 0; k < 8; k++) if (a.dirs[k] > mx){ mx = a.dirs[k]; dir = k; }
      pts.push({ ts: a.tsum / a.n, speed: (a.ssum / a.n / 2) * SF, speedMax: (a.smax / 2) * SF,
                 batt: a.bn ? a.bsum / a.bn : 0, solar: a.soln ? a.solsum / a.soln : null, csq: a.csq, dir });
    }
  }
  pts.sort((x, y) => x.ts - y.ts);
  return pts;
}
/* Range-level set (for whole-history aggregates: daily/heatmap/rose/stats). Cached. */
let _ptsCache = null, _ptsKey = '';
function buildHistoryPts(){
  const n = history.length;
  const key = n ? n + '|' + entryTs(history[0]) + '|' + entryTs(history[n-1]) + '|' + currentRange : '0';
  if (_ptsCache && _ptsKey === key) return _ptsCache;
  const to = Date.now(), from = to - rangeSec(currentRange) * 1000;
  _ptsCache = buildPtsLOD(from, to); _ptsKey = key;
  return _ptsCache;
}

let _forceCharts = false;   /* when true, drawHistoryCharts ignores the on-screen gate (pre-render) */
function drawHistoryCharts(windowOnly = false){
  ['chart-speed', 'chart-rose', 'chart-batt'].forEach(id => document.getElementById(id)?.classList.remove('skeleton'));   /* drop the cold-load shimmer */
  if (!history.length){
    noData($('chart-speed'), 600, 180);
    $('chart-batt').innerHTML  = '';
    $('chart-rose').innerHTML  = '';
    $('stats-table').querySelector('tbody').innerHTML = '';
    return;
  }
  /* normalize. If the entry has raw `speed[]`/`vane[]` arrays (short ranges,
   * keep_raw=1), EXPLODE into per-2s sub-points across the cycle window.
   * Otherwise fall back to the single aggregate point. */
  const SF = SPEED_FACTOR * spdMul();       /* km/h per pulse/sec — matches renderLive */
  const pts = buildHistoryPts();
  /* Ф2: when zoomed, rebuild the window at a FINER LOD straight from raw (swap to a
   * finer tier) instead of clipping the coarse range set — gives real detail on zoom. */
  const vis = chartView ? buildPtsLOD(chartView.start, chartView.end) : pts;
  /* Bounded working set for the LINE charts + smoothing. LTTB (not uniform stride)
   * keeps wind-gust peaks; keyed on speedMax so spikes survive the decimation. */
  const visLine = lttb(vis, RENDER_CAP * 2, p => p.speedMax ?? p.speed);
  /* GLOBAL smoothing — applied once, reused by speed / wind timeline / battery /
   * solar. Aggregate charts (rose, daily, heatmap, stats) keep using raw `vis`. */
  const sel = $('smooth-sel');
  const win = sel ? +sel.value : 0;
  const meanPerPost = sel && sel.options[sel.selectedIndex]?.dataset.mean === '1';
  let smoothed = visLine;
  if (meanPerPost){
    /* Collapse each POST's sub-points back to one aggregate point */
    const tmp = [];
    const visStart = vis[0]?.ts ?? 0;
    const visEnd   = vis[vis.length-1]?.ts ?? Date.now();
    for (const e of history){
      const endTs = entryTs(e);
      if (!endTs || endTs < visStart || endTs > visEnd) continue;
      const arr = e.speed || e.sp;
      const sm = arr && arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : (e.sm ?? e.speed_mean ?? 0);
      const sx = arr && arr.length ? Math.max(...arr) : (e.sx ?? e.speed_max ?? sm);
      tmp.push({
        ts: endTs,
        speed:    (sm / 2) * SF,
        speedMax: (sx / 2) * SF,
        batt: e.b ?? e.batt_mv, solar: e.sol ?? e.solar_mv, csq: e.c ?? e.csq,
        dir:  e.vm ?? e.vane_mode,
      });
    }
    smoothed = tmp;
  } else if (win > 1){
    smoothed = movingAvg(visLine, win);
  }
  if ($('smooth-info')){
    const label = meanPerPost ? 'per-POST'
                : win > 1 ? `MA × ${win} (${win*2}s window)`
                : 'raw';
    $('smooth-info').textContent = `${smoothed.length} pts · ${label}`;
  }
  /* viewport window: only used when the window is EMPTY (zoomed into a gap) — shows
   * the time axis + "no data here" + clickable jump links to the nearest data. */
  let xWin = null;
  if (chartView){
    let leftTs = null, rightTs = null;
    for (const p of pts){
      if (p.ts < chartView.start){ if (leftTs == null || p.ts > leftTs) leftTs = p.ts; }
      else if (p.ts > chartView.end){ if (rightTs == null || p.ts < rightTs) rightTs = p.ts; }
    }
    xWin = {
      start: chartView.start, end: chartView.end,
      hasBefore: leftTs != null, hasAfter: rightTs != null, leftTs, rightTs,
      apply: (ts) => {                 /* recenter window on `ts`, keep span, clamp to data */
        const span = chartView.end - chartView.start;
        const fs = pts[0].ts, fe = pts[pts.length-1].ts;
        let s = ts - span/2, e = ts + span/2;
        if (s < fs){ e += fs - s; s = fs; }
        if (e > fe){ s -= e - fe; e = fe; }
        if (s < fs) s = fs;
        chartView = { start: s, end: e };
        drawHistoryCharts();
      },
    };
  }
  /* Decimate to a render cap — line/timeline charts only (aggregate charts like
   * the wind rose keep the full `vis` for correct stats). This is the main lag fix. */
  const DRAW_CAP = RENDER_CAP;
  const smoothedD = decimate(smoothed, DRAW_CAP);
  const visD = decimate(vis, DRAW_CAP);
  /* Only (re)draw charts whose card is on/near screen. During a pan you watch ONE
   * chart while the others are scrolled away — painting all of them every frame was
   * the bulk of the cost. A scroll listener redraws charts as they come into view.
   * Read ALL visibility rects up front (batched) so the getBoundingClientRect reads
   * don't interleave with the innerHTML writes below → no per-chart reflow thrash. */
  const ih = innerHeight, seen = {};
  for (const id of ['chart-speed','chart-wt','chart-dir','chart-batt','chart-signal','chart-solar','chart-uptime','chart-rose']){
    const el = $(id), r = el && el.getBoundingClientRect();
    seen[id] = !!r && r.bottom > -60 && r.top < ih + 60;
  }
  const see = id => _forceCharts || seen[id];   /* _forceCharts = pre-render an off-screen page (swipe neighbour) */
  /* RAW + EXPLODED (short span, per-2s samples present) = no gust band: the samples ARE
   * the spikes. But on a BINNED span (>2h) each point is a POST/bucket mean — the per-2s
   * gusts are gone, so we MUST draw the max band, else the chart looks flat (the "чому так
   * мало стрибків на 24h" bug). LTTB/explode set speedMax==speed so the band self-hides
   * when truly raw. */
  const _span = chartView ? (chartView.end - chartView.start) : rangeSec(currentRange) * 1000;
  const exploded = _span <= EXPLODE_SPAN_MS;
  const isRaw = !meanPerPost && !(win > 1);
  const noGust = isRaw && exploded;
  if (see('chart-speed')) drawLineChart('chart-speed', smoothedD, 'speed', noGust ? null : 'speedMax', '#58a6ff', false, xWin);
  if (see('chart-wt'))    drawWindTimeline(smoothedD, 'chart-wt', xWin, noGust);
  if (see('chart-dir'))   drawDirTimeline(visD, 'chart-dir', xWin);
  /* Battery and GSM signal are now two separate single-line charts (split out of
   * the old dual-axis chart so each is a light render). */
  if (see('chart-batt')) drawLineChart('chart-batt', smoothedD, 'batt', null, '#3fb950', true, xWin);
  if (see('chart-signal')){
    /* raw per-point CSQ from the VISIBLE window (not smoothed, so 99s aren't
     * averaged into the line). From `vis` (sorted) — no full-history scan. */
    const csqPts = [], lostPts = [];
    for (const p of vis){
      if (p.csq >= 1 && p.csq <= 31) csqPts.push({ ts: p.ts, csq: p.csq });
      else if (p.csq === 99) lostPts.push({ ts: p.ts });   /* modem "signal unknown" */
    }
    drawSignal('chart-signal', decimate(csqPts, DRAW_CAP), xWin, decimate(lostPts, DRAW_CAP));
  }
  if (see('chart-solar')){
    const hasSolar = smoothed.some(p => p.solar != null);
    if (hasSolar) drawLineChart('chart-solar', smoothedD.map(p => ({ ts: p.ts, solar: (p.solar != null && p.solar >= SOLAR_ZERO_MV) ? p.solar : 0 })), 'solar', null, '#f0883e', false, xWin);
    else if (xWin) drawEmptyWindow($('chart-solar'), chartW($('chart-solar'), 600), 140, xWin);
    else $('chart-solar').innerHTML = `<text x="${chartW($('chart-solar'),600)/2}" y="70" text-anchor="middle" fill="var(--mut)" font-size="12">no solar data (firmware v04+ required)</text>`;
  }
  if (see('chart-uptime')) drawUptime('chart-uptime', xWin);
  if (see('chart-rose')) drawWindRose(vis);   /* window-dependent (uses vis) */
  drawStats(vis);
  updateZoomChrome();
  /* Daily summary, hourly heatmap and the battery forecast aggregate the WHOLE
   * history and don't depend on the zoom window — so skip them during pan/pinch
   * (windowOnly) where they'd be pure wasted work over every point. */
  if (!windowOnly){
    drawDaily(pts);
    drawHeatmap(pts);
    renderBatteryForecast(pts);
    $('hi-speed-meta').textContent = `${pts.length} pts`;
  }
}

/* Pick a "nice" time-tick step for a given range. Returns step (ms) + formatter. */
/* Pick a "nice" tick step based on the visible span (not the selected range).
 * Aims for ~6-8 ticks across the chart. Formatter adapts to step granularity. */
function timeTickConfigForSpan(spanMs){
  const NICE = [
    1000, 2000, 5000, 10000, 15000, 30000,                                 /* s */
    60000, 2*60000, 5*60000, 10*60000, 15*60000, 30*60000,                 /* min */
    3600000, 2*3600000, 3*3600000, 6*3600000, 12*3600000,                  /* h */
    86400000, 2*86400000, 7*86400000, 14*86400000, 30*86400000,            /* day+ */
  ];
  const target = spanMs / 7;
  const step = NICE.find(s => s >= target) || NICE[NICE.length-1];

  const hms = d => pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds());
  const hm  = d => pad2(d.getHours())+':'+pad2(d.getMinutes());
  const md  = d => (d.getMonth()+1)+'/'+d.getDate();
  const mdhm= d => md(d)+' '+hm(d);
  let fmt;
  if (step < 60000)        fmt = hms;
  else if (step < 3600000) fmt = hm;
  else if (step < 86400000)fmt = spanMs > 86400000 ? mdhm : hm;
  else                     fmt = md;
  return { step, fmt };
}
function pad2(n){ return n < 10 ? '0' + n : '' + n; }

/* Consistent empty-chart placeholder (centered muted text) so every empty card looks the same. */
function noData(svg, W, H, msg){
  svg.innerHTML = `<text x="${(W/2).toFixed(0)}" y="${(H/2).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="12" opacity=".75">${msg || t('no_data')}</text>`;
  svg.__ctx = { pts: [] }; if (svg.__hideTip) svg.__hideTip();
}
/* Ф5: graceful empty line-chart — an axis with a baseline + "офлайн" label instead of a
 * bare "no data". Speed gets a real 0-line (0 wind is honest); voltage charts get only
 * the axis + label (a 0V line would be a lie). */
function emptyChart(svg, W, H, key){
  const LEFT = 32, RIGHT = 8, BOT = 26, base = H - BOT;
  let s = `<line x1="${LEFT}" y1="${base}" x2="${W-RIGHT}" y2="${base}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>`
        + `<line x1="${LEFT}" y1="${10}" x2="${LEFT}" y2="${base}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>`;
  if (key === 'speed'){
    s += `<line x1="${LEFT}" y1="${base}" x2="${W-RIGHT}" y2="${base}" stroke="#58a6ff" stroke-width="2" opacity=".5"/>`
       + `<text x="${LEFT-4}" y="${base+3}" text-anchor="end" fill="var(--mut)" font-size="9">0</text>`;
  }
  s += `<text x="${(W/2).toFixed(0)}" y="${(H/2).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="11" opacity=".7">${t('offline_nodata')}</text>`;
  svg.innerHTML = s; svg.__ctx = { pts: [] }; if (svg.__hideTip) svg.__hideTip();
}
function drawLineChart(svgId, pts, key, keyMax, color, dual=false, win=null){
  const svg = $(svgId);
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 180);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 10, BOT = 26, LEFT = 32, RIGHT = 8;   /* margins (BOT taller for x labels) */
  if (!pts.length){ if (win) drawEmptyWindow(svg, W, H, win); else emptyChart(svg, W, H, key); svg.__ctx = { pts: [] }; svg.__hideTip && svg.__hideTip(); return; }
  /* when data exists, fit the x-axis to the DATA extent (no empty edge padding);
   * internal gaps still show as gaps between points. `win` is only for empty views. */
  const xMin = win ? win.start : pts[0].ts, xMax = win ? win.end : pts[pts.length-1].ts;
  const ys = pts.map(p => p[key]);
  const rawMax = Math.max(1, ...ys, ...(keyMax ? pts.map(p => p[keyMax]) : []));
  const yMax = dual ? rawMax : niceCeil(rawMax);
  const yMin = dual ? Math.min(...ys, 3000) : 0;
  const uid = 'lg-' + svgId;
  const hasMax = keyMax && pts.some(p => (p[keyMax] ?? p[key]) > p[key] + 0.05);
  /* clamp X to the plot area so bracket points (just outside a zoom window) don't spill
   * the line/area past the axis ticks into the margins. */
  const sx = ts => Math.max(LEFT, Math.min(W - RIGHT, ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT));
  const sy = v  => H - BOT - ((Math.min(v, yMax) - yMin) / (yMax - yMin || 1)) * (H - TOP - BOT);

  /* break line + area across big time gaps (outages / sparse live tail) so we don't
   * draw a misleading straight diagonal across missing time (the "прямий прикол"). */
  const dts = []; for (let i = 1; i < pts.length; i++) dts.push(pts[i].ts - pts[i-1].ts);
  dts.sort((a, b) => a - b);
  const medDt = dts[dts.length >> 1] || 0;
  /* Threshold must track the CONFIGURED cycle, not just the median spacing: after the
   * cycle was changed mid-day (e.g. 80s → 15min) the median is dominated by the dense
   * early data, so the sparse recent data (one normal cycle apart) was wrongly drawn as
   * all-gaps (dashed). Use ≥2.5× the real cycle so a normal interval is never a "gap". */
  const cfgCyc = (lastConfig?.cycle_seconds || lastConfig?.intended_cycle_seconds || 0) * 1000;
  const gapMax = Math.max(5 * 60 * 1000, medDt * 4, cfgCyc * 2.5);
  let area = '', line = '', maxLine = '', bridge = '', segOpen = false, lastX = null, prevX = null, prevY = null;
  pts.forEach((p, i) => {
    const x = sx(p.ts).toFixed(1), y = sy(p[key]).toFixed(1);
    const isGap = i > 0 && (p.ts - pts[i-1].ts) > gapMax;
    if (i === 0 || isGap){
      if (isGap) bridge += `M${prevX} ${prevY} L${x} ${y} `;   /* dashed connector across the gap (we don't have data here) */
      if (segOpen) area += `L${lastX} ${H-BOT} Z `;            /* close previous filled segment to baseline */
      line += 'M' + x + ' ' + y + ' ';
      area += `M${x} ${H-BOT} L${x} ${y} `;
      segOpen = true;
    } else {
      line += 'L' + x + ' ' + y + ' ';
      area += 'L' + x + ' ' + y + ' ';
    }
    if (keyMax) maxLine += ((i === 0 || isGap) ? 'M' : 'L') + x + ' ' + sy(p[keyMax]).toFixed(1) + ' ';
    lastX = x; prevX = x; prevY = y;
  });
  if (segOpen) area += `L${lastX} ${H-BOT} Z`;

  /* gust ribbon between line and max line */
  let band = '';
  if (hasMax){
    let top = '', bot = '';
    pts.forEach((p, i) => { top += (i ? 'L' : 'M') + sx(p.ts).toFixed(1) + ' ' + sy(p[keyMax]).toFixed(1) + ' '; });
    for (let i = pts.length - 1; i >= 0; i--) bot += 'L' + sx(pts[i].ts).toFixed(1) + ' ' + sy(pts[i][key]).toFixed(1) + ' ';
    band = top + bot + 'Z';
  }

  /* y-axis grid + labels */
  let grid = '';
  for (let i = 0; i < 4; i++){
    const v = yMin + (i / 3) * (yMax - yMin);
    const y = sy(v);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".35"/>`;
    grid += `<text x="${LEFT-4}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="var(--mut)" font-size="9">${v.toFixed(dual?0:0)}</text>`;
  }
  /* x-axis time ticks — based on VISIBLE span, not the range button */
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = '';
  const tickStart = Math.ceil(xMin / step) * step;
  for (let tk = tickStart; tk <= xMax; tk += step){
    const x = sx(tk).toFixed(1);
    xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)" stroke-width="1"/>`;
    xticks += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${H-BOT}" stroke="var(--line)" stroke-dasharray="1 4" opacity=".25"/>`;
    xticks += `<text x="${x}" y="${H-BOT+14}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`;
  }
  /* axes */
  const axes = `<line x1="${LEFT}" y1="${H-BOT}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>`;

  /* flat semi-transparent area fill instead of a linearGradient — a gradient
   * paint over the whole chart body is expensive on mobile GPUs and was a fixed
   * per-frame cost (independent of point count). Flat fill looks ~the same. */
  svg.innerHTML = `
    ${grid}
    ${xticks}
    ${axes}
    ${hasMax ? `<path d="${band}" fill="${color}" opacity=".13"/>` : ''}
    <path d="${area}" fill="${color}" opacity=".13"/>
    ${bridge ? `<path d="${bridge}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="2 3" opacity=".4"/>` : ''}
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${hasMax ? `<path d="${maxLine}" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="3 3" opacity=".55"/>` : ''}
  `;
  svg.__ctx = { pts, xMin, xMax, yMin, yMax, key, keyMax, LEFT, RIGHT, TOP, BOT, W, H, tipKind: key === 'solar' ? 'solar' : key === 'batt' ? 'batt' : 'wind' };
  if (svg.__refreshTip) svg.__refreshTip();
}

/* Battery (left axis, mV) + GSM signal CSQ (right axis, 0–31) on one chart.
 * CSQ 99 ("unknown") is filtered out by the caller, so the signal line breaks
 * into segments across gaps instead of dropping to zero. */
function drawBattSignal(svgId, battPts, csqPts, win=null, lostPts=[]){
  const svg = $(svgId);
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 140);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 12, BOT = 26, LEFT = 34, RIGHT = 24;
  if (!battPts.length){ if (win) drawEmptyWindow(svg, W, H, win); else noData(svg, W, H); svg.__ctx = { pts: [] }; svg.__hideTip && svg.__hideTip(); return; }
  const xMin = battPts[0].ts, xMax = battPts[battPts.length-1].ts;   /* fit to data; win only for empty views */
  const bv = battPts.map(p => p.batt).filter(v => typeof v === 'number' && v > 0);
  const bHi = Math.max(...bv, 3300), bLo = Math.min(...bv, 3300);
  const yMaxB = Math.ceil(bHi/100)*100, yMinB = Math.min(3000, Math.floor(bLo/100)*100);
  const CSQ_MAX = 31;
  const BATT_COL = '#3fb950', SIG_COL = '#58d3ff';
  const sx  = ts => ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT;
  const syB = v  => H - BOT - ((v - yMinB) / (yMaxB - yMinB || 1)) * (H - TOP - BOT);
  const syC = v  => H - BOT - (v / CSQ_MAX) * (H - TOP - BOT);

  /* battery area + line */
  let area = '', line = '';
  battPts.forEach((p, i) => {
    const x = sx(p.ts).toFixed(1), y = syB(p.batt).toFixed(1);
    line += (i ? 'L' : 'M') + x + ' ' + y + ' ';
    if (i === 0) area = `M${x} ${H-BOT}L${x} ${y} `; else area += 'L' + x + ' ' + y + ' ';
  });
  area += `L${sx(battPts[battPts.length-1].ts).toFixed(1)} ${H-BOT} Z`;

  /* signal line — break at gaps wider than 3× median spacing (min 30 min) */
  let sig = '', dots = '';
  if (csqPts.length){
    const gaps = [];
    for (let i = 1; i < csqPts.length; i++) gaps.push(csqPts[i].ts - csqPts[i-1].ts);
    gaps.sort((a, b) => a - b);
    const med = gaps.length ? gaps[Math.floor(gaps.length/2)] : 0;
    const gapMax = Math.max(30*60*1000, med*3);
    csqPts.forEach((p, i) => {
      const x = sx(p.ts), y = syC(p.csq);
      const brk = i === 0 || (p.ts - csqPts[i-1].ts) > gapMax;
      sig += (brk ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      /* per-point CSQ dots removed — the line conveys it and hundreds of <circle>
       * nodes were a real paint cost on the battery chart. */
    });
  }

  /* csq=99 ("signal unknown") — red ticks along the bottom so a lost-signal
   * stretch is visible instead of just a blank gap in the blue line. */
  let lost = '';
  for (const p of lostPts){
    const x = sx(p.ts);
    if (x < LEFT || x > W - RIGHT) continue;
    lost += `<line x1="${x.toFixed(1)}" y1="${(H-BOT-5).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(H-BOT).toFixed(1)}" stroke="#f85149" stroke-width="1.4" opacity=".8"/>`;
  }

  /* left axis (batt mV) grid + labels */
  let grid = '';
  for (let i = 0; i < 4; i++){
    const y = (H - BOT) - (i/3)*(H - TOP - BOT);
    const v = yMinB + (i/3)*(yMaxB - yMinB);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".4"/>`;
    grid += `<text x="${LEFT-3}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="${BATT_COL}" font-size="9">${v.toFixed(0)}</text>`;
  }
  /* right axis (CSQ 0..31) labels */
  let rax = '';
  [0,10,20,31].forEach(v => {
    rax += `<text x="${W-RIGHT+3}" y="${(syC(v)+3).toFixed(1)}" text-anchor="start" fill="${SIG_COL}" font-size="9">${v}</text>`;
  });
  /* x time ticks */
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = '';
  const tickStart = Math.ceil(xMin/step)*step;
  for (let tk = tickStart; tk <= xMax; tk += step){
    const x = sx(tk).toFixed(1);
    xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)" stroke-width="1"/>`;
    xticks += `<text x="${x}" y="${H-BOT+14}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`;
  }
  const axes = `<line x1="${LEFT}" y1="${H-BOT}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${W-RIGHT}" y1="${TOP}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="${SIG_COL}" stroke-width="1" opacity=".35"/>`;
  /* inline legend (top-left) */
  const sigTxt = csqPts.length ? `${t('sig_label')} (CSQ)` : t('sig_none');
  const lostLeg = lostPts.length ? `<line x1="${LEFT+2}" y1="${TOP-5}" x2="${LEFT+2}" y2="${TOP-1}" stroke="#f85149" stroke-width="1.4"/><text x="${LEFT+7}" y="${TOP-3}" fill="var(--mut)">${t('sig_lost')}</text>` : '';
  const legend = `<g font-size="9">
      <rect x="${LEFT+2}" y="${TOP-7}" width="9" height="3" fill="${BATT_COL}"/>
      <text x="${LEFT+14}" y="${TOP-3}" fill="var(--mut)">mV</text>
      <rect x="${LEFT+38}" y="${TOP-7}" width="9" height="3" fill="${SIG_COL}"/>
      <text x="${LEFT+50}" y="${TOP-3}" fill="var(--mut)">${sigTxt}</text>
      <g transform="translate(${LEFT+100} 0)">${lostLeg}</g>
    </g>`;

  svg.innerHTML = `
    ${grid}${xticks}${axes}${rax}
    <path d="${area}" fill="${BATT_COL}" opacity=".15"/>
    <path d="${line}" fill="none" stroke="${BATT_COL}" stroke-width="1.5"/>
    ${sig ? `<path d="${sig}" fill="none" stroke="${SIG_COL}" stroke-width="1.3" opacity=".9"/>` : ''}
    ${dots}${lost}
    ${legend}
  `;
  svg.__ctx = { pts: battPts, csqPts, xMin, xMax, yMinB, yMaxB, LEFT, RIGHT, TOP, BOT, W, H, tipKind: 'battsig' };
  if (svg.__refreshTip) svg.__refreshTip();
}

/* GSM signal CSQ (0..31) as its OWN single-axis chart — split out of the old
 * dual-axis battery chart so each is a light single-line render. csqPts already
 * has 99s filtered out (gaps); lostPts marks where signal was unknown (99). */
function drawSignal(svgId, csqPts, win = null, lostPts = []){
  const svg = $(svgId); if (!svg) return;
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 120);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 12, BOT = 26, LEFT = 28, RIGHT = 8, CSQ_MAX = 31, SIG_COL = '#58d3ff';
  if (!csqPts.length && !lostPts.length){
    if (win) drawEmptyWindow(svg, W, H, win);
    else noData(svg, W, H, t('sig_none'));
    svg.__ctx = { pts: [] }; svg.__hideTip && svg.__hideTip(); return;
  }
  /* one continuous line: cyan where the signal was read, RED (dropped to 0) where the
   * modem returned 99 = couldn't read signal. Lines, not dots. Break across big gaps. */
  const merged = [];
  for (const p of csqPts)  merged.push({ ts: p.ts, v: p.csq, lost: false });
  for (const p of lostPts) merged.push({ ts: p.ts, v: 0,     lost: true  });
  merged.sort((a, b) => a.ts - b.ts);
  const xMin = win ? win.start : merged[0].ts, xMax = win ? win.end : merged[merged.length-1].ts;
  const sx = ts => Math.max(LEFT, Math.min(W - RIGHT, ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT));
  const sy = v  => H - BOT - (v / CSQ_MAX) * (H - TOP - BOT);
  const gg = []; for (let i = 1; i < merged.length; i++) gg.push(merged[i].ts - merged[i-1].ts);
  gg.sort((a, b) => a - b);
  const gapMax = Math.max(30*60*1000, (gg[gg.length >> 1] || 0) * 4);
  let sig = '', lost = '';
  for (let i = 1; i < merged.length; i++){
    const a = merged[i-1], b = merged[i];
    if (b.ts - a.ts > gapMax){
      /* data gap = module offline = no signal: red line dips to 0 and runs along it */
      lost += `M${sx(a.ts).toFixed(1)} ${sy(a.v).toFixed(1)} L${sx(a.ts).toFixed(1)} ${sy(0).toFixed(1)} `
            + `L${sx(b.ts).toFixed(1)} ${sy(0).toFixed(1)} L${sx(b.ts).toFixed(1)} ${sy(b.v).toFixed(1)} `;
      continue;
    }
    const seg = `M${sx(a.ts).toFixed(1)} ${sy(a.v).toFixed(1)} L${sx(b.ts).toFixed(1)} ${sy(b.v).toFixed(1)} `;
    if (a.lost || b.lost) lost += seg; else sig += seg;
  }
  let grid = '';
  [0, 10, 20, 31].forEach(v => {
    const y = sy(v);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".35"/>`;
    grid += `<text x="${LEFT-3}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="${SIG_COL}" font-size="9">${v}</text>`;
  });
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = ''; const tk0 = Math.ceil(xMin / step) * step;
  for (let tk = tk0; tk <= xMax; tk += step){ const x = sx(tk).toFixed(1); xticks += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${H-BOT}" stroke="var(--line)" stroke-dasharray="1 4" opacity=".25"/><text x="${x}" y="${(H-BOT+14).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`; }
  const lostLeg = lostPts.length ? `<line x1="${LEFT+2}" y1="${TOP-5}" x2="${LEFT+2}" y2="${TOP-1}" stroke="#f85149" stroke-width="1.4"/><text x="${LEFT+7}" y="${TOP-3}" fill="var(--mut)" font-size="9">${t('sig_lost')}</text>` : '';
  svg.innerHTML = `${grid}${xticks}` +
    (lost ? `<path d="${lost}" fill="none" stroke="#f85149" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` : '') +
    (sig  ? `<path d="${sig}" fill="none" stroke="${SIG_COL}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` : '') +
    lostLeg;
  svg.__ctx = { pts: csqPts.map(p => ({ ts: p.ts, csq: p.csq })), xMin, xMax, yMin: 0, yMax: CSQ_MAX, LEFT, RIGHT, TOP, BOT, W, H, tipKind: 'signal' };
  if (svg.__refreshTip) svg.__refreshTip();
}

/* Speed (km/h) zone color — green/amber/red by Beaufort-ish thresholds. */
function speedColor(kmh){
  return kmh < 20 ? '#3fb950' : kmh < 38 ? '#d29922' : '#f85149';
}
/* Round an axis max up to a clean value so gridline labels are tidy. */
function niceCeil(v){
  if (v <= 5)  return 5;
  if (v <= 10) return Math.ceil(v/2)*2;
  if (v <= 30) return Math.ceil(v/5)*5;
  if (v <= 60) return Math.ceil(v/10)*10;
  return Math.ceil(v/20)*20;
}
/* Live render width of a chart in px → used as the viewBox width so the drawing
 * fills the container 1:1 at any screen size (no letterboxing, no distortion).
 * Falls back to 600 when the chart is in a hidden tab (width 0). */
/* Cache each chart's pixel box. getBoundingClientRect() is a READ that forces a
 * synchronous reflow of the prior innerHTML WRITE — doing it per chart per frame
 * was layout-thrashing (5 reflows/frame). The CSS box only changes on resize /
 * fullscreen / tab-switch, so cache it and clear it there (see clearChartDims). */
let _dimCache = new WeakMap();
function clearChartDims(){ _dimCache = new WeakMap(); }
function chartDims(svg){
  let d = _dimCache.get(svg);
  if (!d){ const r = svg.getBoundingClientRect(); d = { w: r.width, h: r.height }; _dimCache.set(svg, d); }
  return d;
}
function chartW(svg, fb){ const w = chartDims(svg).w; return w > 80 ? Math.round(w) : (fb || 600); }
/* Only in fullscreen: use the real rendered height so the chart fills the screen
 * (viewBox becomes W×realH → 1:1, crisp, no aspect-locked strip). Normal mode
 * returns the fallback (original viewBox height) → dashboard unchanged. */
function chartH(svg, fb){ if (svg.closest('.card.fs')){ const h = chartDims(svg).h; if (h > 80) return Math.round(h); } return fb; }

/* Empty viewport: scrolled/zoomed into a gap with no data. Keep the time axis so
 * the user still sees WHERE they are, say there's no data here, and point an arrow
 * toward where the nearest data actually is (win.hasBefore / win.hasAfter). */
function drawEmptyWindow(svg, W, H, win){
  const LEFT = 32, RIGHT = 8, BOT = 26, TOP = 10;
  const span = win.end - win.start || 1;
  const sx = ts => ((ts - win.start) / span) * (W - LEFT - RIGHT) + LEFT;
  const { step, fmt } = timeTickConfigForSpan(span);
  let xticks = '';
  for (let tk = Math.ceil(win.start / step) * step; tk <= win.end; tk += step){
    const x = sx(tk).toFixed(1);
    xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)" stroke-width="1"/>`;
    xticks += `<text x="${x}" y="${H-BOT+14}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`;
  }
  const axis = `<line x1="${LEFT}" y1="${H-BOT}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>`;
  /* clickable jump links — tap to recenter the viewport on the nearest data */
  const cy = H / 2;
  const canL = win.hasBefore && win.leftTs != null && win.apply;
  const canR = win.hasAfter  && win.rightTs != null && win.apply;
  let links = '';
  if (canL) links += `<text class="jump-link" data-side="L" x="${LEFT+6}" y="${(cy+18).toFixed(0)}" fill="var(--accent)" font-size="12" style="cursor:pointer">← ${t('data_left')}</text>`;
  if (canR) links += `<text class="jump-link" data-side="R" x="${W-RIGHT-6}" y="${(cy+18).toFixed(0)}" text-anchor="end" fill="var(--accent)" font-size="12" style="cursor:pointer">${t('data_right')} →</text>`;
  const base = H - BOT;
  svg.innerHTML = `${xticks}${axis}
    <line x1="${LEFT}" y1="${base}" x2="${W-RIGHT}" y2="${base}" stroke="var(--mut)" stroke-dasharray="3 4" opacity=".4"/>
    <text x="${W/2}" y="${(cy-2).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="12" opacity=".7">${t('offline_nodata')}</text>
    ${links}`;
  svg.querySelectorAll('.jump-link').forEach(el => {
    const fire = ev => { ev.stopPropagation(); ev.preventDefault(); win.apply(el.getAttribute('data-side') === 'L' ? win.leftTs : win.rightTs); };
    el.addEventListener('click', fire);
    el.addEventListener('touchend', fire);
  });
}

/* Dedicated wind-direction timeline: one colored dot per reading at its compass
 * level (N at top … NW at bottom), time on X. Direction is cyclic so dots (no
 * connecting line) read cleanest. Empty when the vane reports 0xFF (no dir). */
function drawDirTimeline(pts, svgId = 'chart-dir', win = null){
  const svg = $(svgId); if (!svg) return;
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 170);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 12, BOT = 26, LEFT = 36, RIGHT = 8;
  if (!pts.length){ if (win) drawEmptyWindow(svg, W, H, win); else noData(svg, W, H); svg.__ctx = { pts: [] }; return; }
  const dirPts = pts.filter(p => p.dir != null && p.dir >= 0 && p.dir < 8);
  const xMin = win ? win.start : pts[0].ts, xMax = win ? win.end : pts[pts.length-1].ts;
  const sx = ts => Math.max(LEFT, Math.min(W - RIGHT, ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT));
  const yLvl = d => TOP + (d / 7) * (H - TOP - BOT);   /* N(0) top … NW(7) bottom */
  /* compass-level gridlines + labels */
  let grid = '';
  for (let i = 0; i < 8; i++){
    const y = yLvl(i);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".3"/>`;
    grid += `<text x="${LEFT-5}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="var(--mut)" font-size="9">${DIRS[i]}</text>`;
  }
  /* x time ticks (same config as the other charts) */
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = '';
  const tickStart = Math.ceil(xMin / step) * step;
  for (let tk = tickStart; tk <= xMax; tk += step){
    const x = sx(tk).toFixed(1);
    xticks += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${H-BOT}" stroke="var(--line)" stroke-dasharray="1 4" opacity=".25"/>`;
    xticks += `<text x="${x}" y="${(H-BOT+14).toFixed(1)}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`;
  }
  if (!dirPts.length){
    svg.innerHTML = grid + xticks + `<text x="${(W/2).toFixed(1)}" y="${(H/2).toFixed(1)}" text-anchor="middle" fill="var(--mut)" font-size="11" opacity=".7">${t('no_dir_data')}</text>`;
    svg.__ctx = { pts: [] }; return;
  }
  /* bucket into ~90 time slots, take the dominant (mode) direction per slot — turns
   * thousands of overlapping dots into a clean readable trajectory. */
  const NB = Math.min(90, dirPts.length);
  const slot = (xMax - xMin) / NB || 1;
  const buckets = new Array(NB);
  for (const p of dirPts){
    let bi = Math.floor((p.ts - xMin) / slot); if (bi < 0) bi = 0; if (bi >= NB) bi = NB - 1;
    (buckets[bi] || (buckets[bi] = [])).push(p.dir);
  }
  const reduced = [];
  for (let i = 0; i < NB; i++){
    const b = buckets[i]; if (!b) continue;
    const cnt = {}; let best = b[0], bc = 0;
    for (const d of b){ cnt[d] = (cnt[d] || 0) + 1; if (cnt[d] > bc){ bc = cnt[d]; best = d; } }
    reduced.push({ ts: xMin + (i + 0.5) * slot, dir: best });
  }
  /* step-line trajectory; break on the N↔NW seam (>4 levels) or a big time gap */
  const gapMax = slot * 3;
  let pathD = '', bridge = '', prev = null;
  for (const p of reduced){
    const x = sx(p.ts), y = yLvl(p.dir);
    if (prev && Math.abs(p.dir - prev.dir) <= 4 && (p.ts - prev.ts) <= gapMax){
      pathD += `L${x.toFixed(1)} ${yLvl(prev.dir).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} `;
    } else {
      if (prev && (p.ts - prev.ts) > gapMax)        /* time gap → dashed bridge (no data here) */
        bridge += `M${sx(prev.ts).toFixed(1)} ${yLvl(prev.dir).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} `;
      pathD += `M${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    prev = p;
  }
  let dots = '';
  for (const p of reduced){
    dots += `<circle cx="${sx(p.ts).toFixed(1)}" cy="${yLvl(p.dir).toFixed(1)}" r="2.6" fill="hsl(${p.dir*45} 78% 60%)" stroke="var(--bg)" stroke-width=".6"/>`;
  }
  svg.innerHTML = grid + xticks
    + (bridge ? `<path d="${bridge}" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2 3" opacity=".35"/>` : '')
    + `<path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round" opacity=".55"/>` + dots;
  svg.__ctx = { pts: [] };
}

/* Ф3: availability/uptime computed ON THE FRONT from local raw (history). Per-moment
 * cycle C = rolling median of nearby REGULAR gaps; each gap split 🟢 green ≤~1.5C ·
 * 🟡 yellow ≤ C+GRACE (auto-reboot window, GRACE = 2×C) · 🔴 red beyond. Returns merged
 * segments already clipped to [from,to] + the green/yellow/red totals. Zoom = recompute. */
function computeUptime(fromMs, toMs, data){
  const posts = [], reg = [];
  for (const e of (data || history)){
    const ts = entryTs(e); if (!ts) continue;
    posts.push(ts);
    if (!(e.live || e.l)) reg.push(ts);
  }
  posts.sort((a, b) => a - b); reg.sort((a, b) => a - b);
  if (posts.length < 2) return { segs: [], green: 0, yellow: 0, red: 0 };
  const FLOOR = 20000;
  const cfgCyc = ((lastConfig?.cycle_seconds || lastConfig?.intended_cycle_seconds || 60) * 1000) || 60000;
  const gapAt = [], gapMed = [];
  for (let i = 1; i < reg.length; i++) gapAt.push(reg[i-1]);
  for (let i = 0; i < gapAt.length; i++){
    const a = Math.max(0, i - 4), b = Math.min(gapAt.length, i + 5);
    const w = []; for (let j = a; j < b; j++) w.push(reg[j+1] - reg[j]); w.sort((x, y) => x - y);
    gapMed.push(Math.max(FLOOR, w[w.length >> 1] || cfgCyc));
  }
  const cycAt = tq => {
    if (!gapAt.length) return cfgCyc;
    let a = 0, b = gapAt.length - 1; while (a < b){ const m = (a + b) >> 1; if (gapAt[m] < tq) a = m + 1; else b = m; }
    let idx = a; if (a > 0 && Math.abs(gapAt[a-1] - tq) <= Math.abs(gapAt[a] - tq)) idx = a - 1;
    return gapMed[Math.min(idx, gapMed.length - 1)] || cfgCyc;
  };
  let green = 0, yellow = 0, red = 0; const SEG = [];
  const emit = (s2, e2, st) => { s2 = Math.max(s2, fromMs); e2 = Math.min(e2, toMs); if (e2 <= s2) return; SEG.push([s2, e2, st]); if (st === 0) green += e2 - s2; else if (st === 1) yellow += e2 - s2; else red += e2 - s2; };
  const classify = (a, bb) => {
    if (bb <= a) return;
    const G = bb - a, C = cycAt((a + bb) / 2);
    const greenMax = Math.max(C * 1.5, C + 30000), yEnd = greenMax + 2 * C;
    const g = a + Math.min(G, greenMax); emit(a, g, 0);
    if (G > greenMax){ const y = a + Math.min(G, yEnd); emit(g, y, 1); if (G > yEnd) emit(y, bb, 2); }
  };
  for (let i = 1; i < posts.length; i++){ if (posts[i] < fromMs) continue; classify(posts[i-1], posts[i]); }
  classify(posts[posts.length - 1], toMs);
  SEG.sort((p, q) => p[0] - q[0]);
  const M = [];
  for (const sg of SEG){ const last = M[M.length - 1]; if (last && last[2] === sg[2] && sg[0] - last[1] < 1000) last[1] = sg[1]; else M.push(sg.slice()); }
  return { segs: M, green, yellow, red };
}
function drawUptime(svgId = 'chart-uptime', win = null){
  const svg = $(svgId); if (!svg) return;
  const H = chartH(svg, +svg.getAttribute('viewBox').split(' ')[3] || 70);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 8, BOT = 20, LEFT = 6, RIGHT = 6;
  const meta = $('uptime-meta');
  const nowMs = Date.now();
  let xMin, xMax;
  if (chartView){ xMin = chartView.start; xMax = chartView.end; }
  else { xMax = nowMs; xMin = nowMs - rangeSec(currentRange) * 1000; }
  const span = xMax - xMin || 1;
  const up = computeUptime(xMin, xMax);
  if (!up.segs.length){ svg.innerHTML = `<text x="${(W/2).toFixed(0)}" y="${(H/2).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="11">${t('no_data')}</text>`; if (meta) meta.textContent = ''; svg.__ctx = { pts: [] }; return; }
  const sx = v => ((v - xMin) / span) * (W - LEFT - RIGHT) + LEFT;
  const cx = v => Math.max(LEFT, Math.min(W - RIGHT, sx(v)));
  const BY = TOP, BH = H - TOP - BOT;
  /* min width ~0.7px so a real segment never vanishes (sub-pixel drop = black gaps in
   * the data region when a busy up/down period is squeezed into a 30d view). */
  const rect = (a, b, col, op) => { const x0 = cx(a), x1 = cx(b); const w = x1 - x0; return (w <= 0) ? '' : `<rect x="${x0.toFixed(1)}" y="${BY}" width="${Math.max(0.7, w).toFixed(1)}" height="${BH}" fill="${col}" opacity="${op}"/>`; };
  const COL = ['#3fb950', '#d29922', '#f85149'], OPA = [.65, .75, .55];
  let segs = '';
  for (const [a, b, st] of up.segs) segs += rect(a, b, COL[st] || '#3fb950', OPA[st] ?? .65);
  const { step, fmt } = timeTickConfigForSpan(span);
  let xticks = ''; const tk0 = Math.ceil(xMin / step) * step;
  for (let tk = tk0; tk <= xMax; tk += step){ const x = sx(tk).toFixed(1); xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)"/><text x="${x}" y="${(H-BOT+13).toFixed(0)}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(tk))}</text>`; }
  const track = `<rect x="${LEFT}" y="${BY}" width="${(W-LEFT-RIGHT).toFixed(1)}" height="${BH}" rx="3" fill="var(--line)" opacity=".3"/>`;
  svg.innerHTML = track + segs + xticks;
  if (meta){
    const fmtDur = ms => { const h = ms / 3600000; return h >= 1 ? h.toFixed(1) + ' h' : Math.round(ms / 60000) + ' min'; };
    const uptime = up.green + up.yellow;   /* Σ = доступність = онлайн + прострочка (без червоного дауну) */
    meta.textContent = `🟢 ${fmtDur(up.green)} · 🟡 ${fmtDur(up.yellow)} · 🔴 ${fmtDur(up.red)} · Σ ${fmtDur(uptime)}`;
  }
  svg.__ctx = { pts: [] };
}

/* Wind timeline: speed line + gust band + direction arrows.
 * Units: km/h. pts = [{ts, speed, speedMax, dir(0..7|null)}]. */
function drawWindTimeline(pts, svgId = 'chart-wt', win = null, noGust = false){
  const svg = $(svgId); const H = chartH(svg, 220);
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const TOP = 34, BOT = 26, LEFT = 32, RIGHT = 8;   /* TOP lane holds dir arrows */
  if (!pts.length){ if (win) drawEmptyWindow(svg, W, H, win); else svg.innerHTML = `<text x="${W/2}" y="110" text-anchor="middle" fill="var(--mut)" font-size="12">${t('no_data')}</text>`; svg.__ctx = { pts: [] }; svg.__hideTip && svg.__hideTip(); return; }
  const xMin = win ? win.start : pts[0].ts, xMax = win ? win.end : pts[pts.length-1].ts;   /* fit to zoom window (or data extent) */
  const hasGust = !noGust && pts.some(p => (p.speedMax ?? p.speed) > p.speed + 0.05);
  const yMax = niceCeil(Math.max(5, ...pts.map(p => Math.max(p.speed, p.speedMax ?? 0))));
  const sx = ts => Math.max(LEFT, Math.min(W - RIGHT, ((ts - xMin) / (xMax - xMin || 1)) * (W - LEFT - RIGHT) + LEFT));
  const sy = v  => H - BOT - (Math.min(v, yMax) / yMax) * (H - TOP - BOT);
  const uid = 'wg-' + svgId;

  /* faint intensity zones: amber >=20 km/h, red >=38 km/h */
  let zones = '';
  [[20,'#d29922',.05],[38,'#f85149',.06]].forEach(([thr,col,op]) => {
    if (yMax > thr){
      const yT = sy(yMax), yB = sy(thr);
      zones += `<rect x="${LEFT}" y="${yT.toFixed(1)}" width="${(W-LEFT-RIGHT).toFixed(1)}" height="${(yB-yT).toFixed(1)}" fill="${col}" opacity="${op}"/>`;
    }
  });

  /* speed area (gradient) + line */
  let area = '', line = '';
  pts.forEach((p, i) => {
    const x = sx(p.ts).toFixed(1), y = sy(p.speed).toFixed(1);
    line += (i ? 'L' : 'M') + x + ' ' + y + ' ';
    area += (i ? 'L' : `M${x} ${H-BOT}L`) + x + ' ' + y + ' ';
  });
  area += `L${sx(pts[pts.length-1].ts).toFixed(1)} ${H-BOT} Z`;

  /* gust band: ribbon between speed and gust (speedMax), only if any gust */
  let gust = '', gustLine = '';
  if (hasGust){
    let top = '', bot = '';
    pts.forEach((p, i) => {
      const x = sx(p.ts).toFixed(1);
      top += (i ? 'L' : 'M') + x + ' ' + sy(p.speedMax ?? p.speed).toFixed(1) + ' ';
      gustLine += (i ? 'L' : 'M') + x + ' ' + sy(p.speedMax ?? p.speed).toFixed(1) + ' ';
    });
    for (let i = pts.length - 1; i >= 0; i--){
      bot += 'L' + sx(pts[i].ts).toFixed(1) + ' ' + sy(pts[i].speed).toFixed(1) + ' ';
    }
    gust = top + bot + 'Z';
  }

  /* y grid + labels */
  let grid = '';
  for (let i = 0; i < 4; i++){
    const v = (i / 3) * yMax;
    const y = sy(v);
    grid += `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W-RIGHT}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 3" opacity=".35"/>`;
    grid += `<text x="${LEFT-4}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="var(--mut)" font-size="9">${v.toFixed(0)}</text>`;
  }

  /* x time ticks — based on VISIBLE span */
  const { step, fmt } = timeTickConfigForSpan(xMax - xMin || 1);
  let xticks = '';
  const tickStart = Math.ceil(xMin / step) * step;
  for (let ts = tickStart; ts <= xMax; ts += step){
    const x = sx(ts).toFixed(1);
    xticks += `<line x1="${x}" y1="${H-BOT}" x2="${x}" y2="${H-BOT+3}" stroke="var(--mut)" stroke-width="1"/>`;
    xticks += `<line x1="${x}" y1="${TOP}" x2="${x}" y2="${H-BOT}" stroke="var(--line)" stroke-dasharray="1 4" opacity=".25"/>`;
    xticks += `<text x="${x}" y="${H-BOT+14}" text-anchor="middle" fill="var(--mut)" font-size="9">${fmt(new Date(ts))}</text>`;
  }

  /* direction arrows — evenly spaced across time, nearest data point per slot.
   * Arrow points the way the wind blows (FROM dir → rotate by dir*45 + 180). */
  const arrowN = Math.min(10, Math.max(4, pts.length));
  const slotMs = (xMax - xMin) / arrowN;   /* skip arrows over empty stretches */
  let arrows = '';
  let pi = 0;
  for (let k = 0; k < arrowN; k++){
    const frac = arrowN === 1 ? 0.5 : k / (arrowN - 1);
    const targetTs = xMin + frac * (xMax - xMin);
    while (pi + 1 < pts.length && Math.abs(pts[pi+1].ts - targetTs) <= Math.abs(pts[pi].ts - targetTs)) pi++;
    const p = pts[pi];
    if (p.dir == null || p.dir < 0) continue;
    if (Math.abs(p.ts - targetTs) > slotMs) continue;   /* no real data near this slot */
    const x = sx(targetTs).toFixed(1);
    arrows += `<g transform="translate(${x} 14) rotate(${p.dir * 45})">
                 <polygon points="0,-7 -3.5,5 0,2.5 3.5,5" fill="${speedColor(p.speed)}"/>
               </g>`;
  }

  /* latest value marker + label */
  const last = pts[pts.length-1];
  const lx = sx(last.ts), ly = sy(last.speed);
  const labRight = lx > W - 70;
  const dot = `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.2" fill="var(--accent)" stroke="var(--bg)" stroke-width="1.5"/>
    <text x="${(labRight ? lx-7 : lx+7).toFixed(1)}" y="${Math.max(TOP+10, ly-7).toFixed(1)}" text-anchor="${labRight?'end':'start'}" fill="var(--fg)" font-size="11" font-weight="700">${last.speed.toFixed(1)}<tspan fill="var(--mut)" font-weight="400"> ${spdLbl()}</tspan></text>`;

  const axes = `<line x1="${LEFT}" y1="${H-BOT}" x2="${W-RIGHT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${H-BOT}" stroke="var(--mut)" stroke-width="1" opacity=".5"/>
                <line x1="${LEFT}" y1="${(TOP-6).toFixed(1)}" x2="${W-RIGHT}" y2="${(TOP-6).toFixed(1)}" stroke="var(--line)" stroke-dasharray="1 3" opacity=".4"/>`;

  svg.innerHTML = `
    ${zones}
    ${grid}
    ${xticks}
    ${axes}
    ${hasGust ? `<path d="${gust}" fill="#79c0ff" opacity=".12"/>` : ''}
    <path d="${area}" fill="var(--accent)" opacity=".14"/>
    ${hasGust ? `<path d="${gustLine}" fill="none" stroke="#79c0ff" stroke-width="1" stroke-dasharray="3 2" opacity=".7"/>` : ''}
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${arrows}
    ${dot}
  `;
  svg.__ctx = { pts, xMin, xMax, yMin: 0, yMax, LEFT, RIGHT, TOP, BOT, W, H, tipKind: 'wind' };
  if (svg.__refreshTip) svg.__refreshTip();
}

function drawWindRose(pts){
  /* bin pts by direction (0..7); count entries */
  const bins = new Array(8).fill(0);
  let total = 0;
  for (const p of pts){
    if (p.dir != null && p.dir >= 0 && p.dir < 8){ bins[p.dir]++; total++; }
  }
  const svg = $('chart-rose');
  if (!total){ svg.innerHTML = `<circle cx="110" cy="110" r="100" fill="none" stroke="var(--line)"/>
    <circle cx="110" cy="110" r="66" fill="none" stroke="var(--line)" stroke-dasharray="2 3" opacity=".5"/>
    <circle cx="110" cy="110" r="33" fill="none" stroke="var(--line)" stroke-dasharray="2 3" opacity=".5"/>
    <text x="110" y="114" text-anchor="middle" fill="var(--mut)" font-size="11" opacity=".7">${t('offline_nodata')}</text>`; return; }
  const maxBin = Math.max(...bins);
  let elems = `<circle cx="110" cy="110" r="100" fill="none" stroke="var(--line)"/>
               <circle cx="110" cy="110" r="66"  fill="none" stroke="var(--line)" stroke-dasharray="2 3" opacity=".5"/>
               <circle cx="110" cy="110" r="33"  fill="none" stroke="var(--line)" stroke-dasharray="2 3" opacity=".5"/>
               <text x="110" y="10"  text-anchor="middle" fill="var(--err)" font-size="11" font-weight="700">N</text>
               <text x="110" y="216" text-anchor="middle" fill="var(--mut)" font-size="10">S</text>
               <text x="6"   y="114" text-anchor="middle" fill="var(--mut)" font-size="10">W</text>
               <text x="214" y="114" text-anchor="middle" fill="var(--mut)" font-size="10">E</text>`;
  for (let i = 0; i < 8; i++){
    const pct = bins[i] / total;
    const r = pct * 100 * (maxBin / total) / (maxBin / total); /* scale */
    const radius = (bins[i] / maxBin) * 95;
    /* draw sector: 45° wedge centered at i*45° */
    const a1 = (i * 45 - 22.5 - 90) * Math.PI / 180;
    const a2 = (i * 45 + 22.5 - 90) * Math.PI / 180;
    const x1 = 110 + radius * Math.cos(a1), y1 = 110 + radius * Math.sin(a1);
    const x2 = 110 + radius * Math.cos(a2), y2 = 110 + radius * Math.sin(a2);
    elems += `<path d="M 110 110 L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="var(--accent)" opacity="${(0.3 + pct * 0.7).toFixed(2)}"/>`;
    /* percentage label */
    if (pct > 0.02){
      const labelR = radius + 12;
      const la = (i * 45 - 90) * Math.PI / 180;
      const lx = 110 + labelR * Math.cos(la), ly = 110 + labelR * Math.sin(la);
      elems += `<text x="${lx.toFixed(1)}" y="${(ly+3).toFixed(1)}" text-anchor="middle" fill="var(--accent)" font-size="9" font-weight="700">${(pct*100).toFixed(0)}%</text>`;
    }
  }
  svg.innerHTML = elems;
}

function drawDaily(pts){
  const days = {};
  for (const p of pts){
    const d = new Date(p.ts);
    const key = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
    if (!days[key]) days[key] = { speeds: [], dirs: new Array(8).fill(0), dirTotal: 0 };
    days[key].speeds.push(p.speed);
    if (p.dir != null && p.dir >= 0){ days[key].dirs[p.dir]++; days[key].dirTotal++; }
  }
  const tb = $('daily-table').querySelector('tbody'); tb.innerHTML = '';
  const keys = Object.keys(days).sort().reverse();
  for (const k of keys){
    const d = days[k];
    const avg = d.speeds.reduce((a,b)=>a+b,0) / d.speeds.length;
    const max = Math.max(...d.speeds);
    const dom = d.dirTotal ? DIRS[d.dirs.indexOf(Math.max(...d.dirs))] : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k}</td><td>${avg.toFixed(1)}</td><td>${max.toFixed(1)}</td><td>${dom}</td>`;
    tb.appendChild(tr);
  }
  if (!keys.length) tb.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--mut)">${t('no_data')}</td></tr>`;
}

let hmSelectedDay = 'all';
let hmDaysData = {};   /* cached */
/* The heatmap shows long-term patterns, so it loads its OWN hourly-binned data
 * over the last 7 days — independent of the charts' (often 1h) zoom range, which
 * otherwise left every hour but the current one black. */
let hmPts = null, hmLoadedAt = 0;
async function loadHeatmapData(){
  if (testMode) { hmPts = null; return; }
  if (Date.now() - hmLoadedAt < 5 * 60000) return;   /* refresh at most every 5 min */
  hmLoadedAt = Date.now();
  try {
    await Cache.init();
    const SF = SPEED_FACTOR * spdMul();
    const now = Date.now();
    /* Hourly patterns from the LOCAL 1h tier (no server fetch). */
    const recs = Cache.tier('1h', now - 7 * 86400000, now);
    hmPts = recs.map(r => ({ ts: r.t, speed: (r.sm / 2) * SF }));
    if (document.querySelector('.tab.active')?.dataset.page === 'history') drawHistoryCharts();
  } catch { hmLoadedAt = 0; }   /* allow retry on failure */
}
function drawHeatmap(pts){
  const svg = $('chart-hm');
  hmDaysData = {};
  for (const p of (hmPts && hmPts.length ? hmPts : pts)){
    const d = new Date(p.ts);
    const dayKey = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
    const hr = d.getHours();
    if (!hmDaysData[dayKey]) hmDaysData[dayKey] = new Array(24).fill(null).map(() => []);
    hmDaysData[dayKey][hr].push(p.speed);
  }
  const dayKeys = Object.keys(hmDaysData).sort();
  /* day picker = native <input type="date"> + ‹ › navigation + all-days button */
  const dateInput = $('hm-date');
  const allBtn = $('hm-all');
  const modeLbl = $('hm-mode');
  if (dayKeys.length){
    dateInput.min = dayKeys[0];
    dateInput.max = dayKeys[dayKeys.length - 1];
    /* default to last day if no selection yet */
    if (hmSelectedDay === 'all' || !dayKeys.includes(hmSelectedDay)){
      if (hmSelectedDay !== 'all') hmSelectedDay = dayKeys[dayKeys.length - 1];
    }
  }
  if (hmSelectedDay === 'all'){
    dateInput.value = dayKeys.length ? dayKeys[dayKeys.length - 1] : '';
    modeLbl.textContent = 'matrix view';
    allBtn.classList.add('active');
    $('hm-prev').disabled = $('hm-next').disabled = true;
  } else {
    dateInput.value = hmSelectedDay;
    modeLbl.textContent = 'single day';
    allBtn.classList.remove('active');
    const idx = dayKeys.indexOf(hmSelectedDay);
    $('hm-prev').disabled = idx <= 0;
    $('hm-next').disabled = idx < 0 || idx >= dayKeys.length - 1;
  }
  /* Wire only once. Use a property to track binding. */
  if (!dateInput._bound){
    dateInput._bound = true;
    dateInput.addEventListener('change', () => {
      if (dateInput.value){ hmSelectedDay = dateInput.value; drawHistoryCharts(); }
    });
    allBtn.addEventListener('click', () => { hmSelectedDay = 'all'; drawHistoryCharts(); });
    $('hm-prev').addEventListener('click', () => {
      const ks = Object.keys(hmDaysData).sort();
      const i = ks.indexOf(hmSelectedDay);
      if (i > 0){ hmSelectedDay = ks[i-1]; drawHistoryCharts(); }
    });
    $('hm-next').addEventListener('click', () => {
      const ks = Object.keys(hmDaysData).sort();
      const i = ks.indexOf(hmSelectedDay);
      if (i >= 0 && i < ks.length - 1){ hmSelectedDay = ks[i+1]; drawHistoryCharts(); }
    });
    $('hm-today')?.addEventListener('click', () => {
      const ks = Object.keys(hmDaysData).sort();
      if (ks.length){ hmSelectedDay = ks[ks.length-1]; drawHistoryCharts(); }   /* jump to the latest day */
    });
  }
  const H = 180;
  const W = chartW(svg, 600);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  if (!dayKeys.length){ svg.innerHTML = `<text x="${W/2}" y="90" text-anchor="middle" fill="var(--mut)" font-size="12">${t('no_data')}</text>`; return; }

  /* compute global max for stable color scale */
  let maxV = 1;
  for (const k of dayKeys) for (const cell of hmDaysData[k]) if (cell.length){
    const a = cell.reduce((x,y)=>x+y,0)/cell.length; if (a > maxV) maxV = a;
  }
  const colorOf = avg => {
    const norm = Math.min(1, avg / maxV);
    const r2 = norm < 0.5 ? Math.round(63 + norm * 2 * (210 - 63)) : 248;
    const g2 = norm < 0.5 ? Math.round(185 + norm * 2 * (153 - 185)) : Math.round(153 - (norm - 0.5) * 2 * (153 - 81));
    const b2 = norm < 0.5 ? Math.round(80  + norm * 2 * (34 - 80))  : Math.round(34  - (norm - 0.5) * 2 * (34 - 73));
    return `rgb(${r2},${g2},${b2})`;
  };

  let svgContent = '';
  if (hmSelectedDay === 'all'){
    /* MULTI-DAY view (heatmap matrix) */
    const labelW = 50, labelH = 16;
    const cellW = (W - labelW) / 24;
    const cellH = Math.min(24, (H - labelH) / dayKeys.length);
    for (let h = 0; h < 24; h += 3){
      svgContent += `<text x="${labelW + h*cellW + cellW/2}" y="11" text-anchor="middle" fill="var(--mut)" font-size="9">${pad2(h)}</text>`;
    }
    for (let r = 0; r < dayKeys.length; r++){
      const k = dayKeys[r];
      svgContent += `<text x="${labelW-3}" y="${labelH + r*cellH + cellH/2 + 3}" text-anchor="end" fill="var(--mut)" font-size="9">${k.slice(5)}</text>`;
      for (let h = 0; h < 24; h++){
        const cell = hmDaysData[k][h];
        if (!cell.length){
          svgContent += `<rect x="${labelW + h*cellW}" y="${labelH + r*cellH}" width="${cellW-1}" height="${cellH-1}" fill="var(--panel2)"/>`;
        } else {
          const avg = cell.reduce((a,b)=>a+b,0)/cell.length;
          svgContent += `<rect x="${labelW + h*cellW}" y="${labelH + r*cellH}" width="${cellW-1}" height="${cellH-1}" fill="${colorOf(avg)}">
                           <title>${k} ${pad2(h)}:00 — avg ${avg.toFixed(1)} km/h</title></rect>`;
        }
      }
    }
  } else {
    /* SINGLE-DAY view (big bar chart per hour) */
    const day = hmDaysData[hmSelectedDay];
    if (!day){ svg.innerHTML = `<text x="300" y="90" text-anchor="middle" fill="var(--mut)" font-size="12">${t('no_data')}</text>`; return; }
    const labelH = 18, botH = 18;
    const cellW = (W - 20) / 24;
    const innerH = H - labelH - botH;
    /* title */
    svgContent += `<text x="${W/2}" y="13" text-anchor="middle" fill="var(--fg)" font-size="12" font-weight="600">${hmSelectedDay}</text>`;
    for (let h = 0; h < 24; h++){
      const cell = day[h];
      const x = 10 + h * cellW;
      svgContent += `<text x="${x + cellW/2}" y="${H-4}" text-anchor="middle" fill="var(--mut)" font-size="9">${pad2(h)}</text>`;
      if (!cell.length){
        svgContent += `<rect x="${x}" y="${labelH}" width="${cellW-1}" height="${innerH}" fill="var(--panel2)" opacity=".4"/>`;
        continue;
      }
      const avg = cell.reduce((a,b)=>a+b,0)/cell.length;
      const max = Math.max(...cell);
      const min = Math.min(...cell);
      /* min 3px so an hour that HAS data but is calm (avg 0) still shows a colored
       * sliver — distinct from a no-data hour (dim, handled above). */
      const barH = Math.max(3, (avg / maxV) * innerH);
      const maxBarH = Math.max(barH, (max / maxV) * innerH);
      const yBottom = labelH + innerH;
      /* gust max shadow */
      svgContent += `<rect x="${x}" y="${yBottom - maxBarH}" width="${cellW-1}" height="${maxBarH}" fill="${colorOf(max)}" opacity=".25"/>`;
      /* avg bar */
      svgContent += `<rect x="${x}" y="${yBottom - barH}" width="${cellW-1}" height="${barH}" fill="${colorOf(avg)}">
                       <title>${pad2(h)}:00 — avg ${avg.toFixed(1)} max ${max.toFixed(1)} min ${min.toFixed(1)} km/h</title></rect>`;
      /* value text on top */
      if (cellW > 18){
        svgContent += `<text x="${x + cellW/2}" y="${Math.max(yBottom - barH - 2, labelH + 8)}" text-anchor="middle" fill="var(--fg)" font-size="8" font-weight="600">${avg.toFixed(0)}</text>`;
      }
    }
  }
  svg.innerHTML = svgContent;
}

function drawStats(pts){
  const tb = $('stats-table').querySelector('tbody'); tb.innerHTML = '';
  const stats = (vals) => {
    if (!vals.length) return { min: '—', avg: '—', max: '—' };
    const min = Math.min(...vals), max = Math.max(...vals);
    const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
    return { min: min.toFixed(1), avg: avg.toFixed(1), max: max.toFixed(1) };
  };
  for (const [label, s] of [
    ['Wind (raw)',  stats(pts.map(p => p.speed))],
    ['Battery (V)', stats(pts.map(p => p.batt / 1000))],
    ['CSQ',         stats(pts.map(p => p.csq).filter(c => c !== 99))],
  ]){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${label}</td><td>${s.min}</td><td>${s.avg}</td><td>${s.max}</td>`;
    tb.appendChild(tr);
  }
}

