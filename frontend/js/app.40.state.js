/* =========== STATE MACHINE INFERENCE =========== */
/* Firmware doesn't report state directly. We infer from elapsed-since-last-POST
 * and known cycle config. NORMAL mode states:
 *   0..2s after POST    → GSM_SLEEP (just slept)
 *   2..(cycle-5)s       → SAMPLE   (collecting WDT-sleep readings)
 *   last 3-5s           → WAKE+POST (GSM up, sending)
 * LIVE mode → looping POSTs every ~3s. */
/* State machine — names + descriptions are i18n keys, resolved each render. */
const NORMAL_STATES = [
  { id: 'sleep',  icon: 'ic-sleep',  nameKey: 'st_sleep_n',  descKey: 'st_sleep_d'  },
  { id: 'sample', icon: 'ic-status', nameKey: 'st_sample_n', descKey: 'st_sample_d' },
  { id: 'wake',   icon: 'ic-live',   nameKey: 'st_wake_n',   descKey: 'st_wake_d'   },
  { id: 'post',   icon: 'ic-up',     nameKey: 'st_post_n',   descKey: 'st_post_d'   },
];
const LIVE_STATES = [
  { id: 'live', icon: 'ic-live', nameKey: 'st_live_n', descKey: 'st_live_d' },
];
const OFFLINE_STATE = { id:'offline', icon:'ic-warn',  nameKey: 'st_off_n',  descKey: 'st_off_d'  };
const LIVE_PENDING  = { id:'lpend',   icon:'ic-clock', nameKey: 'st_lpend_n', descKey: 'st_lpend_d' };
const LIVE_EXITING  = { id:'lexit',   icon:'ic-clock', nameKey: 'st_lexit_n', descKey: 'st_lexit_d' };
const stN = s => t(s.nameKey) || s.id;
const stD = s => t(s.descKey) || '';
/* colour per module state — Live + Стан tab icons take this, so the colour visibly
 * travels through the cycle (sleep→sample→wake→post) and flags live/offline. */
const STATE_COLOR = {
  sleep:  '#8b949e',   /* idle grey */
  sample: '#3fb950',   /* green — actively sensing */
  wake:   '#f0883e',   /* orange — radio waking */
  post:   '#58a6ff',   /* blue — transmitting */
  live:   '#bc8cff',   /* purple — live streaming (pulses) */
  lpend:  '#d29922',   /* amber — live change pending */
  lexit:  '#d29922',
  offline:'#f85149',   /* red — module silent */
};

/* Track recent live timestamps to estimate the actual live cycle (HTTPS over
 * GSM can be 30-60s per POST, not the firmware's 3s setting). */
let liveTsHistory = [];
function recordLiveTs(ts){
  if (!ts) return;
  if (liveTsHistory.length && liveTsHistory[liveTsHistory.length-1] === ts) return;
  liveTsHistory.push(ts);
  if (liveTsHistory.length > 10) liveTsHistory.shift();
}
function observedLiveCycle(){
  if (liveTsHistory.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < liveTsHistory.length; i++) gaps.push(liveTsHistory[i] - liveTsHistory[i-1]);
  gaps.sort((a,b) => a-b);
  return gaps[Math.floor(gaps.length / 2)] / 1000;   /* median, in seconds */
}

/* Best-guess "true" cycle:
 *   intended = samples × avg × 2 + 15s GSM overhead (what config implies)
 *   observed = server's median gap of last few entries (lags behind config changes)
 * If they differ by >40% → config just changed, observed is stale → trust intended.
 * Otherwise observed is more accurate (accounts for real GSM jitter). */
function effectiveCycle(cfg){
  if (!cfg) return { sec: 60, source: 'fallback', pending: false };
  const intended = cfg.intended_cycle_seconds || (cfg.samples * cfg.avg * 2 + 15);
  const observed = cfg.cycle_seconds || 0;
  if (!observed) return { sec: intended, observed, intended, source: 'intended', pending: false };
  const ratio = Math.max(intended, observed) / Math.min(intended, observed);
  const pending = ratio > 1.4;       /* >40% diff = config not applied yet */
  return { sec: pending ? intended : observed, observed, intended,
           source: pending ? 'intended' : 'observed', pending };
}

function inferState(){
  if (!lastConfig) return { cur: null, pct: 0, untilNext: null, lastSec: null };
  const eff = effectiveCycle(lastConfig);
  const cycle = eff.sec;

  /* In LIVE mode, the freshest signal is `lastSnapshot.timestamp` (live POST).
   * In NORMAL mode, use config.last_timestamp from the main log. */
  let lastTs = null;
  if (lastConfig.live && lastSnapshot?.timestamp){
    lastTs = parseServerTs(lastSnapshot.timestamp);
    recordLiveTs(lastTs);
  } else if (lastConfig.last_timestamp){
    lastTs = parseServerTs(lastConfig.last_timestamp);
  }
  const sinceLast = lastTs ? (Date.now() - lastTs) / 1000 : null;
  const liveCycle = observedLiveCycle() || 60;       /* fall back to 60s when unknown */
  const expectedCycle = lastConfig.live ? liveCycle : cycle;

  /* OFFLINE detection: no POST in 2× expected cycle + 60s grace */
  if (sinceLast != null && sinceLast > expectedCycle * 2 + 60){
    return { cur: OFFLINE_STATE, states: [OFFLINE_STATE], idx: 0,
             pct: 100, untilNext: null, lastSec: sinceLast, cycleSec: expectedCycle, offline: true };
  }

  if (lastConfig.live){
    /* Server says live=1. If recent live POST (within expected cycle + grace) → streaming.
     * If too long since last live POST → "pending" (module hasn't entered live yet). */
    const liveOk = sinceLast != null && sinceLast < expectedCycle * 1.5 + 30;
    if (!liveOk){
      return { cur: LIVE_PENDING, states: [LIVE_PENDING], idx: 0,
               pct: 0, untilNext: null, lastSec: sinceLast, cycleSec: expectedCycle };
    }
    const cyclePos = sinceLast % expectedCycle;
    return { cur: LIVE_STATES[0], states: LIVE_STATES, idx: 0,
             pct: (cyclePos / expectedCycle) * 100,
             untilNext: Math.max(0, expectedCycle - cyclePos),
             lastSec: sinceLast, cycleSec: expectedCycle };
  }

  /* Normal cycle */
  if (sinceLast == null) return { cur: NORMAL_STATES[0], states: NORMAL_STATES, idx: 0, pct: 0, untilNext: null, lastSec: null };

  const cyclePos = sinceLast % cycle;
  let idx;
  if (cyclePos < 2) idx = 0;
  else if (cyclePos < cycle - 5) idx = 1;
  else if (cyclePos < cycle - 2) idx = 2;
  else idx = 3;
  return { cur: NORMAL_STATES[idx], states: NORMAL_STATES, idx,
           pct: (cyclePos / cycle) * 100,
           untilNext: Math.max(0, cycle - cyclePos),
           lastSec: sinceLast, cycleSec: cycle,
           eff };
}

/* Tint the Live + Status tab icons by what's happening: green = normal & fresh ·
 * blue(pulse) = live streaming · amber = live pending · red = offline. */
function updateTabDots(){
  const s = inferState();
  /* Live + Стан follow the live module state — the icon colour travels with the cycle. */
  const id = s && s.cur ? s.cur.id : null;
  const color = id && STATE_COLOR[id] ? STATE_COLOR[id] : '';   /* '' → fall back to signature --tc */
  const pulse = id === 'live';
  setTabIcon('live', color, pulse);
  setTabIcon('status', color, pulse);
  updateTabBadges();
}
/* set a tab icon's state colour + pulse ('' colour → revert to the signature --tc) */
function setTabIcon(page, color, pulse){
  const ic = document.querySelector(`.tab[data-page="${page}"] .ic`);
  if (!ic) return;
  ic.style.color = color || '';
  ic.classList.toggle('pulse', !!pulse);
}
/* Status dots on the remaining tabs:
 *  Settings — red if alerts are on but notifications can't show; amber(pulse) if a config change is pending.
 *  Calib    — green(pulse) while a capture source streams; amber if calibration is incomplete (<8 points). */
function updateTabBadges(){
  /* Settings — red if alerts on but notifications can't fire; amber+pulse if a change is pending */
  let setColor = '', setPulse = false;
  const permBad = ALERTS_ON && ('Notification' in window) && Notification.permission !== 'granted';
  const pend = Array.isArray(pending) && pending.some(p => p.status === 'waiting');
  if (permBad) setColor = 'var(--err)';
  else if (pend){ setColor = 'var(--warn)'; setPulse = true; }
  setTabBadge('settings', !!setColor, setColor || undefined, setPulse);
  setTabIcon('settings', setColor, setPulse);

  /* Calib — green+pulse while a source streams, amber if calibration is incomplete (<8) */
  const streaming = capPort || capGsmTimer;
  let calColor = '', calPulse = false;
  if (streaming){ calColor = 'var(--ok)'; calPulse = true; }
  else { try { if (Object.keys(getCalib()).length < 8) calColor = 'var(--warn)'; } catch (_) {} }
  setTabBadge('calib', !!calColor, calColor || undefined, calPulse);
  setTabIcon('calib', calColor, calPulse);

  /* History — pulse (in its signature colour) while there's unseen new data */
  const histNew = document.getElementById('badge-history')?.classList.contains('on');
  setTabIcon('history', '', !!histNew);
}
function renderStatus(){
  const s = inferState();
  if (!s.cur){
    $('st-icon').innerHTML = icSvg('ic-status'); $('st-icon').style.color = 'var(--mut)';
    $('st-name').textContent = '—'; $('st-desc').textContent = 'чекаю на дані сервера';
    $('st-countdown').textContent = '—'; $('st-progress').style.width = '0%';
    $('st-machine').innerHTML = ''; return;
  }
  $('st-icon').innerHTML = icSvg(s.cur.icon);
  $('st-icon').style.color = s.cur.id === 'offline' ? 'var(--warn)' : 'var(--accent)';
  $('st-name').textContent = stN(s.cur);
  $('st-desc').textContent = stD(s.cur);
  $('st-countdown').textContent = s.untilNext != null ? Math.ceil(s.untilNext) + 's' : '—';
  $('st-progress').style.width = Math.min(100, s.pct).toFixed(1) + '%';
  $('st-last-post').textContent = 'last: ' + (s.lastSec != null ? fmtAgo(s.lastSec) : '—');
  $('st-next-post').textContent = 'next: ' + (s.untilNext != null ? '~' + Math.ceil(s.untilNext) + 's' : '—');

  /* state machine bubbles */
  const mc = $('st-machine'); mc.innerHTML = '';
  s.states.forEach((st, i) => {
    const div = document.createElement('div');
    div.className = 'st-step' + (i === s.idx ? ' active' : i < s.idx ? ' done' : '');
    div.innerHTML = `${icSvg(st.icon)}<span>${stN(st)}</span>`;
    mc.appendChild(div);
    if (i < s.states.length - 1){
      const a = document.createElement('span'); a.className = 'st-arrow'; a.textContent = '→'; mc.appendChild(a);
    }
  });
  if (s.states.length > 1) {
    const loop = document.createElement('span'); loop.className = 'st-arrow'; loop.textContent = '↻'; mc.appendChild(loop);
  }

  /* Cycle sync banner: warn when configured cycle ≠ actually observed cycle on server. */
  const banner = $('st-cycle-sync');
  if (banner && lastConfig){
    const eff = effectiveCycle(lastConfig);
    const intHuman = fmtSec(eff.intended);
    const obsHuman = eff.observed ? fmtSec(eff.observed) : '—';
    if (eff.pending){
      banner.style.display = 'block';
      banner.style.background = 'rgba(210,153,34,.12)';
      banner.style.border = '1px solid rgba(210,153,34,.5)';
      banner.style.color  = 'var(--warn)';
      banner.innerHTML = `⚠ <b>${t('sync_pending_title')}</b> ` +
        `${t('sync_pending_body').replace('{int}', `<b>${intHuman}</b>`).replace('{obs}', `<b>${obsHuman}</b>`)}`;
    } else if (eff.observed && lastConfig.intended_cycle_seconds){
      banner.style.display = 'block';
      banner.style.background = 'rgba(63,185,80,.08)';
      banner.style.border = '1px solid rgba(63,185,80,.3)';
      banner.style.color  = 'var(--mut)';
      banner.innerHTML = `✓ ${t('sync_ok').replace('{int}', `<b>${intHuman}</b>`).replace('{obs}', `<b>${obsHuman}</b>`)}`;
    } else {
      banner.style.display = 'none';
    }
  }

  /* raw config */
  $('st-raw-config').innerHTML = lastConfig
    ? Object.entries(lastConfig).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${v === null ? '—' : v}</span></div>`).join('')
    : '—';

  renderPending();
}

/* =========== PENDING CHANGES =========== */
let pending = [];
function trackPending(kind, target){
  /* target = expected config state, e.g. {samples:30, avg:1} or {live:1} */
  pending.push({
    kind, target,
    startedAt: Date.now(),
    status: 'waiting',
    appliedAt: null,
  });
  if (pending.length > 8) pending = pending.slice(-8);
  renderPending();
}
function checkPending(){
  if (!lastConfig) return;
  let changed = false;
  for (const p of pending){
    if (p.status !== 'waiting') continue;
    const target = p.target;
    const ok = Object.keys(target).every(k => lastConfig[k] == target[k]);
    if (ok){ p.status = 'applied'; p.appliedAt = Date.now(); changed = true; }
    else if (Date.now() - p.startedAt > 600000){ p.status = 'failed'; changed = true; }   /* 10min timeout */
  }
  if (changed) renderPending();
}
function renderPending(){
  const el = $('pending-list'); if (!el) return;
  el.innerHTML = '';
  const active = pending.filter(p => p.status === 'waiting');
  const recent = pending.filter(p => p.status !== 'waiting').slice(-3);
  const show = [...active, ...recent];
  $('pending-empty').style.display = show.length ? 'none' : 'block';
  for (const p of show){
    const row = document.createElement('div');
    row.className = 'pending-row ' + p.status;
    const icon = icSvg(p.status === 'applied' ? 'ic-check' : p.status === 'failed' ? 'ic-x' : 'ic-clock');
    const label = Object.entries(p.target).map(([k,v]) => `${k}=${v}`).join(' ');
    const ago = Math.round((Date.now() - p.startedAt) / 1000);
    const appliedAgo = p.appliedAt ? Math.round((Date.now() - p.appliedAt) / 1000) + 's ago' : '';
    const when = p.status === 'waiting'
      ? `${p.kind} → ${ago}s ago · ${t('waiting_next_post') || 'waiting for next POST'}`
      : p.status === 'applied'
      ? `${p.kind} → ${t('applied') || 'applied'} ${appliedAgo}`
      : `${p.kind} → ${t('failed_timeout') || 'failed (timeout)'}`;
    row.innerHTML = `
      <div class="icon">${icon}</div>
      <div class="body">
        <div class="what">${label}</div>
        <div class="when">${when}</div>
      </div>
      <div class="status">${p.status}</div>
    `;
    el.appendChild(row);
  }
}

