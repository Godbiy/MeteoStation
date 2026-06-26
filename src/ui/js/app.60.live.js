/* =========== RENDER LIVE =========== */
function fmtAgo(sec){
  if (sec == null) return '—';
  if (sec < 60) return Math.round(sec) + ' ' + t('s_ago');
  if (sec < 3600) return Math.round(sec/60) + ' ' + t('m_ago');
  if (sec < 86400) return (sec/3600).toFixed(1) + ' ' + t('h_ago');
  return (sec/86400).toFixed(1) + ' ' + t('d_ago');
}
function fmtSec(s){
  if (s < 60) return s + ' s';
  if (s < 3600) return (s/60).toFixed(s%60?1:0).replace(/\.0$/,'') + ' min';
  return (s/3600).toFixed(s%3600?1:0).replace(/\.0$/,'') + ' h';
}

/* compact duration: "2d 5h" / "5h 12m" / "12m" */
function fmtDur(sec){
  sec = Math.max(0, Math.round(sec));
  if (sec < 3600) return Math.max(1, Math.round(sec/60)) + 'm';
  if (sec < 86400){ const h = Math.floor(sec/3600), m = Math.round((sec%3600)/60); return h + 'h' + (m ? ' ' + m + 'm' : ''); }
  const d = Math.floor(sec/86400), h = Math.round((sec%86400)/3600); return d + 'd' + (h ? ' ' + h + 'h' : '');
}
/* Uptime since the module's last power-on (server detects the cycle-counter reset). */
function renderUptime(){
  const el = $('t-uptime'); if (!el) return;
  const boot = lastConfig?.boot_timestamp;
  if (!boot){ el.textContent = '—'; return; }
  const bt = parseServerTs(boot);
  el.textContent = isNaN(bt) ? '—' : fmtDur((Date.now() - bt) / 1000);
}

function renderLive(){
  renderUptime();
  checkAlerts();
  updateTabDots();
  if (!lastSnapshot){
    $('t-dir').textContent = '—'; $('t-dir-deg').textContent = '— °';
    $('t-kmh').textContent = '—'; $('t-pps').textContent = '—';
    setCompass(null); setSpeedo(0);
    if ($('t-batt-v'))   $('t-batt-v').textContent = '—';
    if ($('t-batt-pct')) $('t-batt-pct').textContent = '—%';
    if ($('t-batt-mv'))  $('t-batt-mv').textContent = '— mV';
    $('t-csq').textContent = '—';
    $('t-age').textContent = '—'; $('t-ts').textContent = '—';
    return;
  }
  const s = lastSnapshot;
  pushBattSample();                       /* keep the battery-trend buffer current for the honest charge badge */
  const SF = SPEED_FACTOR * spdMul();
  const kmh = (s.pulses_sec || 0) * SF;
  animateNumber($('t-kmh'), kmh, n => n.toFixed(1));   /* count-up on change */
  setTrend($('t-kmh-trend'), kmh);
  $('t-pps').textContent = (s.pulses_sec || 0).toFixed(1);
  setSpeedo(kmh);

  /* Prefer explicit dir field (mock + future server-decoded) over calibration lookup. */
  const dirIdx = s.dir != null ? s.dir : vaneToDir(s.vane);
  if (dirIdx != null){
    setCompass(dirIdx * 45);
    $('t-dir').textContent = DIRS[dirIdx];
    $('t-dir-deg').textContent = (dirIdx * 45) + '°';
  } else {
    setCompass(null); $('t-dir').textContent = '—'; $('t-dir-deg').textContent = 'no calib';
  }

  if (s.batt_mv != null){
    const bp = battPct(s.batt_mv);
    if ($('t-batt-v')) animateNumber($('t-batt-v'), s.batt_mv/1000, n => n.toFixed(2));
    setTrend($('t-batt-trend'), s.batt_mv);
    if ($('t-batt-pct')){
      $('t-batt-pct').textContent = bp.pct + '%';
      $('t-batt-pct').style.color = bp.pct > 40 ? 'var(--ok)' : bp.pct > 15 ? 'var(--warn)' : 'var(--err)';
    }
    if ($('t-batt-icon')) $('t-batt-icon').textContent = bp.icon;
    if ($('t-batt-mv'))   $('t-batt-mv').textContent = s.batt_mv + ' mV';
  }
  /* solar */
  if (s.solar_mv != null){
    const sV = s.solar_mv / 1000;
    $('t-solar').innerHTML = sV.toFixed(2) + '<span style="font-size:13px;color:var(--mut)"> V</span>';
    const sState = s.solar_mv < SOLAR_ZERO_MV ? 'idle' : s.solar_mv < SOLAR_CHARGE_MV ? 'off' : 'on';
    $('t-solar-sub').innerHTML = chargePhaseHtml(sState);
    $('t-solar').style.color = s.solar_mv < SOLAR_ZERO_MV ? 'var(--mut)'
                             : s.solar_mv < SOLAR_CHARGE_MV ? 'var(--warn)' : 'var(--ok)';
  }
  /* live energy estimates (from voltages — no current sensor). Big state icon + rounded value. */
  {
    const cur = liveCurrents(s);
    const r10 = n => Math.round(n / 10) * 10;                 /* round off the false precision */
    const mAh = '<span style="font-size:13px;color:var(--mut)"> mAh</span>';
    /* reserve = capacity × charge-% (a stock, in mAh) */
    if ($('t-reserve')){
      const pc = battPct(s.batt_mv).pct;
      const reserveMah = (BATT_CAPACITY > 0 && pc != null) ? Math.round(BATT_CAPACITY * pc / 100) : null;
      $('t-reserve').innerHTML = (reserveMah == null ? '—' : reserveMah) + mAh;
      $('t-reserve-ic').style.color = (pc == null) ? 'var(--mut)' : pc > 40 ? 'var(--ok)' : pc > 15 ? 'var(--warn)' : 'var(--err)';
    }
    /* per-hour = charge current sustained one hour (mA now = mAh in 1h) — a RATE */
    /* THEORETICAL charge/h — what the panel COULD give from its wattage (the old estimate). */
    if ($('t-theory')){
      const on = cur.chargeMa > 0;
      $('t-theory').innerHTML = (on ? '+' + r10(cur.chargeMa) : '0') + mAh;
      $('t-theory').style.color = on ? 'var(--ok)' : 'var(--mut)';
      const tic = $('t-theory-ic');
      tic.firstElementChild.setAttribute('href', '#' + (PHASE_IC[cur.phase] || 'ic-moon'));
      tic.style.color = on ? 'var(--ok)' : 'var(--mut)';
    }
    /* ACTUAL charge/h — derived from how the battery REALLY moved (server data, robust trend).
     * mV/h → mAh/h via ~capacity/500 (≈5 mAh per mV at 2500mAh). Flags the panel-vs-reality gap. */
    if ($('t-perhour')){
      const tr = battTrend();
      const pic = $('t-perhour-ic'), sub = $('t-perhour-sub');
      pic.style.transform = 'none';
      if (!tr || tr.spanMin < 60){
        $('t-perhour').innerHTML = '—' + mAh;
        $('t-perhour').style.color = 'var(--mut)';
        pic.firstElementChild.setAttribute('href', '#ic-status');
        pic.style.color = 'var(--mut)';
        if (sub){ sub.textContent = t('actual'); sub.style.color = ''; }
      } else {
        const factMah = Math.round(tr.mvPerH * (BATT_CAPACITY || 2500) / 500);
        const rising = factMah > 5;
        const stuck = !rising && cur.chargeMa > 0;          /* panel claims charging but it isn't */
        const col = rising ? 'var(--ok)' : stuck ? 'var(--err)' : 'var(--warn)';
        $('t-perhour').innerHTML = (factMah >= 0 ? '+' : '−') + Math.abs(factMah) + mAh;
        $('t-perhour').style.color = col;
        pic.firstElementChild.setAttribute('href', '#' + (rising ? 'ic-up' : stuck ? 'ic-warn' : 'ic-up'));
        pic.style.color = col;
        if (!rising && !stuck) pic.style.transform = 'rotate(180deg)';   /* draining (no sun) → arrow down */
        if (sub){ sub.textContent = stuck ? t('charge_stuck') : t('actual'); sub.style.color = stuck ? 'var(--err)' : ''; }
      }
    }
  }
  if (s.csq != null){
    $('t-csq').textContent = s.csq === 99 ? '—' : s.csq;
    $('t-csq-sub').textContent = s.csq === 99 ? 'unknown'
      : s.csq < 10 ? 'weak' : s.csq < 20 ? 'fair' : s.csq < 28 ? 'good' : 'excellent';
  }
  $('t-age').textContent = fmtAgo(s.age_sec);
  $('t-ts').textContent = s.timestamp || '—';

  /* Sparkline update. Use snapshot's ACTUAL timestamp (not Date.now), and
   * skip if we already have this point — otherwise normal-mode polling every 8s
   * fills the array with duplicates of the same POST for 15 min straight. */
  const now = Date.now();
  const snapTs = s.timestamp
    ? parseServerTs(s.timestamp)
    : now;
  const last = speedHistory[speedHistory.length - 1];
  if (!last || last.t !== snapTs){
    speedHistory.push({ t: snapTs, kmh, dir: dirIdx });
  }
  speedHistory = speedHistory.filter(p => p.t > now - 3600000);
  /* In NORMAL mode, also backfill from server's main log (so cold-open / first
   * minute after refresh shows the real last-hour curve, not just the 1 fresh tail). */
  maybeBackfillSpeedHistory(now);
  drawLiveTimeline();

  /* Beaufort */
  const bf = beaufortOf(kmh);
  $('t-bf').textContent = bf.icon + ' ' + bf.label;
  $('t-bf-num').textContent = 'B' + bf.num;

  /* Gust factor */
  const g = gustFactor(speedHistory.map(p => ({ speed: p.kmh })));
  if (g){
    $('t-gust').textContent = '×' + g.factor.toFixed(2);
    $('t-gust-sub').textContent = `max ${g.max.toFixed(1)} / avg ${g.mean.toFixed(1)}`;
  }
  /* Stability */
  const st = dirStability(speedHistory.map(p => ({ dir: p.dir })));
  if (st){
    const word = st.active === 1 ? '🎯 ' + DIRS[st.dom]
               : st.active <= 2 ? '↔ ' + DIRS[st.dom] + ' ±'
               : '🔄 variable';
    $('t-stab').textContent = word;
    $('t-stab-sub').textContent = `${(st.domPct*100).toFixed(0)}% ${DIRS[st.dom]}, ${st.active} dirs`;
  }
  updateLivePin();
}
/* Pinned "live" notification. Foreground (app open) it's refreshed here each
 * poll; in the BACKGROUND the server pushes the same tag on every module POST so
 * the SW updates it even when the app is closed (cadence = the post interval). */
function livePinText(s){
  const v  = ((s.pulses_sec || 0) * SPEED_FACTOR * spdMul()).toFixed(1);
  const di = s.dir != null ? s.dir : (typeof vaneToDir === 'function' ? vaneToDir(s.vane) : -1);
  const dir = (di != null && di >= 0) ? ' ' + DIRS[di] : '';
  const parts = [];
  if (s.batt_mv)  parts.push('🔋 ' + (s.batt_mv / 1000).toFixed(2) + 'V');
  if (s.solar_mv) parts.push('☀ ' + (s.solar_mv / 1000).toFixed(2) + 'V');
  if (s.csq != null && s.csq !== 99) parts.push('📶 ' + s.csq);
  return { title: `💨 ${v} ${spdLbl()}${dir}`, body: parts.join(' · ') };
}
async function updateLivePin(){
  if (!('serviceWorker' in navigator)) return;
  let reg; try { reg = await swReady(); } catch { return; }
  const on = localStorage.getItem('live_pin') === '1';
  if (!on || !lastSnapshot || !('Notification' in window) || Notification.permission !== 'granted'){
    try { (await reg.getNotifications({ tag: 'live-pin' })).forEach(n => n.close()); } catch {}
    return;
  }
  const tx = livePinText(lastSnapshot);
  reg.showNotification(tx.title, {
    body: tx.body, icon: pushIcon('wind'), badge: pushIcon('app') + '&badge=1',
    tag: 'live-pin', silent: true, renotify: false, requireInteraction: true,
    actions: [{ action: 'open', title: 'Відкрити' }], data: { url: '?ui=1' }
  });
}
/* Backfill speedHistory from server log (last 1h). Runs once per cold open,
 * then again at most every 60s. Requests keep_raw=1 and EXPLODES each POST's
 * raw sp[]/va[] arrays into per-2s sub-points, so a 15-min cycle shows a dense
 * curve across the whole cycle — not one lonely dot per POST.
 * Incremental: only fetches POSTs newer than what we already have (2G-friendly). */
let lastBackfillMs = 0;
let backfillThruTs = 0;   /* newest POST endTs already exploded into sub-points (ms) */
async function maybeBackfillSpeedHistory(now, force = false){
  if (!force){
    if (LITE) return;                                 /* 2G: skip the hourly keep_raw fetch */
    if (lastConfig?.live) return;                     /* live mode is self-feeding */
    if (now - lastBackfillMs < 60000) return;         /* throttle */
  }
  lastBackfillMs = now;
  try {
    const cutoffSec = Math.floor((now - 3600000) / 1000);
    /* baseline = last POST we fully backfilled (NOT the live snapshot point, which
     * renderLive pushed for the latest POST — using that would make us skip its
     * raw arrays and never densify). Cold open → cutoff → fetch the whole hour. */
    const since = Math.max(cutoffSec, Math.floor(backfillThruTs / 1000));
    const data = await fjson(SRV + '?since=' + since + '&compact=1&fmt=c&keep_raw=1&t=' + now);
    if (!Array.isArray(data) || !data.length){ speedHistory = speedHistory.filter(p => p.t > now - 3600000); drawLiveTimeline(); return; }
    const seen = new Set(speedHistory.map(p => p.t));
    const SF = SPEED_FACTOR * spdMul(), SAMPLE_MS = 2000;     /* kmh per pulse/sec; raw sample window */
    for (const e of data){
      const endTs = entryTs(e);
      if (!endTs) continue;
      if (endTs > backfillThruTs) backfillThruTs = endTs;
      const sp = e.speed || e.sp;
      const va = e.vane  || e.va;
      if (Array.isArray(sp) && sp.length){
        const N = sp.length;
        for (let i = 0; i < N; i++){
          const ts = endTs - (N - 1 - i) * SAMPLE_MS;   /* back-date each sample */
          if (seen.has(ts)) continue;
          const kmh = ((sp[i] || 0) / 2) * SF;
          let dir = null;
          const v = va ? va[i] : null;
          if (v != null && v !== 0xFF){ for (let k = 0; k < 8; k++){ if (!(v & (1 << k))){ dir = k; break; } } }
          speedHistory.push({ t: ts, kmh, dir });
          seen.add(ts);
        }
      } else if (!seen.has(endTs)){
        const kmh = ((e.speed_mean ?? e.sm ?? 0) / 2) * SF;
        speedHistory.push({ t: endTs, kmh, dir: e.vane_mode ?? e.vm ?? null });
        seen.add(endTs);
      }
    }
    speedHistory.sort((a,b) => a.t - b.t);
    speedHistory = speedHistory.filter(p => p.t > now - 3600000);
    drawLiveTimeline();
  } catch {}
}

function renderConfig(){
  if (typeof renderSolarNote === 'function') renderSolarNote();
  updateTabDots();
  if (!lastConfig){ $('t-cycle').textContent = '—'; $('t-cycle-cfg').textContent = '—'; return; }
  const c = lastConfig;
  const eff = effectiveCycle(c);
  /* Main number = intended cycle from config (what user set).
   * If observed lags significantly behind, prepend ⏳ to flag mismatch. */
  $('t-cycle').textContent = (eff.pending ? '⏳ ' : '') + fmtSec(eff.intended);
  const obsTag = eff.observed && !eff.pending ? ` · ${t('observed')} ${fmtSec(eff.observed)}` : '';
  const pendTag = eff.pending && eff.observed ? ` · ${t('still_running')} ${fmtSec(eff.observed)}` : '';
  $('t-cycle-cfg').textContent = `n=${c.samples} avg=${c.avg}` + (c.live ? ' · LIVE' : '') + obsTag + pendTag;
  $('dot').className = 'dot ' + (c.live ? 'live' : 'on');
  $('hdr-stat').textContent = c.live ? 'LIVE active' : (c.last_timestamp ? '· ' + c.last_timestamp : '');
  const lsw = $('live-sw');
  if (lsw){
    const p = pending.find(p => p.status === 'waiting' && 'live' in p.target);
    lsw.checked = p ? !!p.target.live : !!c.live;   /* stay on the user's choice while a live toggle is pending */
  }
  renderIntervalSelector();
}
function renderAll(){ renderLive(); renderConfig(); }

/* =========== LIVE 1H TIMELINE (reuses drawWindTimeline from History) =========== */
let liveView = null;   /* zoom viewport for live chart */
function drawLiveTimeline(){
  /* Convert speedHistory ({t,kmh,dir}) → pts ({ts,speed,dir}) format. */
  const allPts = speedHistory.map(p => ({ ts: p.t, speed: p.kmh, speedMax: p.kmh, dir: p.dir }));
  let pts = allPts;
  /* viewport window — only used when the window is EMPTY: axis + jump-to-data links. */
  let xWin = null;
  if (liveView){
    let leftTs = null, rightTs = null;
    for (const p of allPts){
      if (p.ts < liveView.start){ if (leftTs == null || p.ts > leftTs) leftTs = p.ts; }
      else if (p.ts > liveView.end){ if (rightTs == null || p.ts < rightTs) rightTs = p.ts; }
    }
    xWin = {
      start: liveView.start, end: liveView.end,
      hasBefore: leftTs != null, hasAfter: rightTs != null, leftTs, rightTs,
      apply: (ts) => {
        const span = liveView.end - liveView.start;
        const fs = allPts[0].ts, fe = allPts[allPts.length-1].ts;
        let s = ts - span/2, e = ts + span/2;
        if (s < fs){ e += fs - s; s = fs; }
        if (e > fe){ s -= e - fe; e = fe; }
        if (s < fs) s = fs;
        liveView = { start: s, end: e };
        drawLiveTimeline();
      },
    };
    pts = allPts.filter(p => p.ts >= liveView.start && p.ts <= liveView.end);
  }
  /* Apply the global smoothing selector — prefer the live tab's own selector,
   * fall back to history's if Live is shown before History was ever opened. */
  const sel = $('smooth-sel-live') || $('smooth-sel');
  const win = sel ? +sel.value : 0;
  const meanPerPost = sel && sel.options[sel.selectedIndex]?.dataset.mean === '1';
  let smoothed = pts;
  let label = 'raw';
  if (meanPerPost && pts.length){
    /* Group into POSTs: in live mode each speedHistory point already corresponds
     * to one POST (we dedupe by snapTs in renderLive), so "per-POST" = raw here. */
    label = 'per-POST';
  } else if (win > 1){
    smoothed = movingAvg(pts, win);
    label = `MA × ${win} (${win*2}s)`;
  }
  drawWindTimeline(decimate(smoothed, RENDER_CAP), 'chart-live-wt', xWin);
  $('live-wt-meta').textContent = smoothed.length
    ? `${smoothed.length} pts · ${label} · max ${Math.max(...smoothed.map(p=>p.speed)).toFixed(1)} km/h` + (liveView ? ' · 🔍 zoomed' : '')
    : '— no data —';
}
/* (smooth-sel change handling lives in syncSmoothSelectors — see below) */

/* =========== INTERVAL SELECTOR =========== */
const INTERVAL_OPTIONS_SEC = [60, 120, 300, 600, 900, 1800, 2700, 3600, 5400, 7200];
const SAMPLE_SEC = 2;
function chooseCfg(target, smax){
  let samples = Math.max(10, Math.round(target / SAMPLE_SEC));
  let avg = 1;
  if (samples > smax){ samples = smax; avg = Math.max(1, Math.min(32, Math.round(target / (samples * SAMPLE_SEC)))); }
  return { samples, avg, actual: samples * avg * SAMPLE_SEC };
}
let lastRenderedCfgKey = null;
function renderIntervalSelector(){
  if (!lastConfig) return;
  const sel = $('iv-sel');
  const smax = lastConfig.samples_max || 450;
  /* Only rebuild options when config actually changes; preserves user selection. */
  const cfgKey = lastConfig.samples + ',' + lastConfig.avg + '|' + smax;
  if (cfgKey !== lastRenderedCfgKey){
    lastRenderedCfgKey = cfgKey;
    const prevSel = sel.value;
    sel.innerHTML = '';
    for (const sec of INTERVAL_OPTIONS_SEC){
      const c = chooseCfg(sec, smax);
      const opt = document.createElement('option');
      opt.value = c.samples + ',' + c.avg;
      const lbl = c.avg > 1 ? `n=${c.samples}, avg=${c.avg}×` : `n=${c.samples}`;
      opt.textContent = `${fmtSec(sec)}  →  ${lbl}`;
      sel.appendChild(opt);
    }
    /* Default to current effective config, unless user already had a different selection. */
    const curVal = lastConfig.samples + ',' + lastConfig.avg;
    sel.value = prevSel && Array.from(sel.options).some(o => o.value === prevSel) ? prevSel : curVal;
  }
  const cl = lastConfig.avg > 1 ? `n=${lastConfig.samples}, avg=${lastConfig.avg}×` : `n=${lastConfig.samples}`;
  const liveTag = lastConfig.live ? ` · <span style="color:var(--err)">${icSvg('ic-rec')} ${t('live_active_note')}</span>` : '';
  const eff = effectiveCycle(lastConfig);
  const cyclePart = ` (${t('configured')} ${fmtSec(eff.intended)}` +
                    (eff.observed ? `, ${t('observed')} ${fmtSec(eff.observed)}` : '') +
                    (eff.pending ? ` · <span style="color:var(--warn)">⏳ ${t('not_applied')}</span>` : '') + ')';
  $('cur-cfg').innerHTML = cl + cyclePart + liveTag;
  refreshApply();
}
function refreshApply(){
  if (!lastConfig){ $('iv-apply').disabled = true; return; }
  const cur = lastConfig.samples + ',' + lastConfig.avg;
  $('iv-apply').disabled = !$('iv-sel').value || $('iv-sel').value === cur;
}
$('iv-sel').addEventListener('change', refreshApply);
$('iv-apply').addEventListener('click', async () => {
  const [n, a] = $('iv-sel').value.split(',').map(Number);
  $('iv-stat').textContent = '…';
  try {
    const r1 = await fjson(SRV + '?set_samples=' + n + '&t=' + Date.now());
    const r2 = await fjson(SRV + '?set_avg=' + a + '&t=' + Date.now());
    $('iv-stat').textContent = `✓ saved, waiting for next POST`;
    $('iv-stat').className = 'stat ok';
    trackPending('interval', { samples: r1.samples, avg: r2.avg });
    poll();
  } catch (e){
    $('iv-stat').textContent = 'err: ' + e.message; $('iv-stat').className = 'stat err';
  }
});

