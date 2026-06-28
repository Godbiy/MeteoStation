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
const SWITCHING_STATE = { id:'switch', icon:'ic-clock', nameKey: 'st_switch_n', descKey: 'st_switch_d' };
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
  switch: '#d29922',   /* amber — config change in flight (switching) */
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
  if (!cfg) return { sec: 60, source: 'fallback', pending: false, applied: true };
  const intended = cfg.intended_cycle_seconds || (cfg.samples * cfg.avg * 2 + 15);
  const observed = cfg.cycle_seconds || 0;
  /* Backend state machine is authoritative: it knows the real running cycle and whether the
   * module has CONFIRMED a config change (ground-truth via last_samples), so no median lag. */
  if (cfg.cycle_eff_sec){
    return { sec: cfg.cycle_eff_sec, observed, intended,
             source: cfg.pending ? 'switching' : 'applied',
             pending: !!cfg.pending, applied: cfg.applied !== false };
  }
  /* Fallback for an old server with no state: the median-ratio heuristic. */
  if (!observed) return { sec: intended, observed, intended, source: 'intended', pending: false, applied: true };
  const ratio = Math.max(intended, observed) / Math.min(intended, observed);
  const pending = ratio > 1.4;
  return { sec: pending ? intended : observed, observed, intended,
           source: pending ? 'intended' : 'observed', pending, applied: !pending };
}

/* Ground-truth facts the module actually reported on its last REGULAR POST.
 * The server now sends these in ?config=1 — so the Status tab SHOWS what happened
 * instead of inferring it. null fields mean "server hasn't sent it yet" (old log). */
function lastPostFacts(){
  if (!lastConfig) return null;
  return {
    samples:  lastConfig.last_samples ?? null,   /* N actually collected */
    expected: lastConfig.samples ?? null,        /* N currently configured */
    cycle:    lastConfig.last_cycle ?? null,      /* firmware cycle counter */
    batt:     lastConfig.last_batt_mv ?? null,
    solar:    lastConfig.last_solar_mv ?? null,
    csq:      lastConfig.last_csq ?? null,
    bytes:    lastConfig.last_raw_bytes ?? null,
    ver:      lastConfig.last_version ?? null,
  };
}

function inferState(){
  if (!lastConfig) return { cur: null, pct: 0, untilNext: null, lastSec: null };
  const eff = effectiveCycle(lastConfig);
  const cycle = eff.sec;
  const facts = lastPostFacts();

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

  /* Coarse link/config state comes from the BACKEND state machine (cycle-relative, switch-
   * aware). Fall back to the local heuristic only if an old server didn't send `state`. */
  const bState = lastConfig.state;

  /* OFFLINE — module genuinely silent past the auto-reboot window. */
  const isOffline = bState ? bState === 'offline'
                           : (sinceLast != null && sinceLast > expectedCycle * 2 + 60);
  if (isOffline){
    return { cur: OFFLINE_STATE, states: [OFFLINE_STATE], idx: 0,
             pct: 100, untilNext: null, lastSec: sinceLast, cycleSec: expectedCycle,
             offline: true, facts, eff, health: 'missed',
             overdue: sinceLast != null ? sinceLast - expectedCycle : null };
  }

  /* SWITCHING — a config change the module hasn't confirmed yet. Calm amber, NOT offline:
   * this is what kills the false "no connection" while the station finishes its old cycle. */
  if (bState === 'switching' || (bState == null && eff.pending)){
    const eta = lastConfig.next_expected_sec;
    return { cur: SWITCHING_STATE, states: [SWITCHING_STATE], idx: 0,
             pct: 0, untilNext: eta != null ? eta : null, lastSec: sinceLast,
             cycleSec: expectedCycle, facts, eff, switching: true };
  }

  if (lastConfig.live){
    /* Server says live=1. If recent live POST (within expected cycle + grace) → streaming.
     * If too long since last live POST → "pending" (module hasn't entered live yet). */
    const liveOk = sinceLast != null && sinceLast < expectedCycle * 1.5 + 30;
    if (!liveOk){
      return { cur: LIVE_PENDING, states: [LIVE_PENDING], idx: 0,
               pct: 0, untilNext: null, lastSec: sinceLast, cycleSec: expectedCycle, facts, eff };
    }
    const cyclePos = sinceLast % expectedCycle;
    return { cur: LIVE_STATES[0], states: LIVE_STATES, idx: 0,
             pct: (cyclePos / expectedCycle) * 100,
             untilNext: Math.max(0, expectedCycle - cyclePos),
             lastSec: sinceLast, cycleSec: expectedCycle, facts, eff, live: true };
  }

  /* Normal cycle */
  if (sinceLast == null) return { cur: NORMAL_STATES[0], states: NORMAL_STATES, idx: 0, pct: 0, untilNext: null, lastSec: null, facts, eff };

  const cyclePos = sinceLast % cycle;
  /* Sample collection is TIME-DETERMINISTIC: each stored sample = avg×2s of WDT sleep.
   * So we can give a GROUNDED estimate of "sample k of N" (shown with ≈) — far better
   * than a vague bubble — instead of pretending to read the (sleeping) firmware's state.
   * After the collection window the module wakes GSM + POSTs (the ~15s tail). */
  const period     = Math.max(2, (lastConfig.avg || 1) * 2);   /* s per stored sample */
  const expN       = lastConfig.samples || 1;
  const collectSec = expN * period;                            /* collection duration */
  let idx, sampleIdx = null;
  if (cyclePos < 2){ idx = 0; }                                /* just posted → sleeping */
  else if (cyclePos < collectSec){                             /* collecting */
    idx = 1;
    sampleIdx = Math.min(expN, Math.floor(cyclePos / period) + 1);
  } else if (cyclePos < cycle - 2){ idx = 2; }                 /* GSM wake/register */
  else { idx = 3; }                                            /* posting */

  /* Cadence health vs the expected cycle: how late is this POST? */
  const overdue = sinceLast - expectedCycle;                   /* >0 = running late */
  const health  = overdue > Math.max(30, expectedCycle * 0.5) ? 'late' : 'ok';

  return { cur: NORMAL_STATES[idx], states: NORMAL_STATES, idx,
           pct: (cyclePos / cycle) * 100,
           untilNext: Math.max(0, cycle - cyclePos),
           lastSec: sinceLast, cycleSec: cycle,
           facts, eff, sampleIdx, expN, health, overdue };
}

/* Silence watchdog removed — "module offline" is now a SERVER push (linkState → tick),
 * which also works when no dashboard is open. No foreground notification here. */

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
  /* Settings turns red if this device opted into SERVER push but notification permission is
   * missing (so pushes can't show). */
  const spushOn = localStorage.getItem('spush_on') === '1' || localStorage.getItem('live_pin') === '1';
  const permBad = spushOn && ('Notification' in window) && Notification.permission !== 'granted';
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
/* Big "online over the last 24h" counter on the Status tab. Computes from the cached 24h
 * slice (not the working `history`, which may hold a different range) so it's always right. */
async function updateOnlineStat(){
  const big = document.getElementById('st-online-big'), sub = document.getElementById('st-online-sub');
  if (!big) return;
  try {
    const now = Date.now(), from = now - 86400000;
    const arr = await dbRange(from, now);
    const u = computeUptime(from, now, arr);
    big.textContent = fmtDur((u.green + u.yellow) / 1000);
    sub.innerHTML = `<span style="color:#3fb950">●</span> ${fmtDur(u.green / 1000)} · ` +
                    `<span style="color:#d29922">●</span> ${fmtDur(u.yellow / 1000)}`;
  } catch { big.textContent = '—'; }
}

function renderStatus(){
  updateOnlineStat();
  const s = inferState();
  if (!s.cur){
    $('st-icon').innerHTML = icSvg('ic-status'); $('st-icon').style.color = 'var(--mut)';
    $('st-name').textContent = '—'; $('st-desc').textContent = 'чекаю на дані сервера';
    $('st-countdown').textContent = '—'; $('st-progress').style.width = '0%';
    if ($('st-collect')) $('st-collect').textContent = '';
    if ($('st-health'))  $('st-health').textContent = '';
    if ($('st-facts'))   $('st-facts').innerHTML = '';
    $('st-machine').innerHTML = ''; return;
  }
  $('st-icon').innerHTML = icSvg(s.cur.icon);
  $('st-icon').style.color = (s.cur.id === 'offline' || s.cur.id === 'switch') ? 'var(--warn)' : 'var(--accent)';
  $('st-name').textContent = stN(s.cur);
  $('st-desc').textContent = stD(s.cur);
  $('st-countdown').textContent = s.untilNext != null ? Math.ceil(s.untilNext) + 's' : '—';
  $('st-progress').style.width = Math.min(100, s.pct).toFixed(1) + '%';
  $('st-last-post').textContent = 'last: ' + (s.lastSec != null ? fmtAgo(s.lastSec) : '—');
  $('st-next-post').textContent = 'next: ' + (s.untilNext != null ? '~' + Math.ceil(s.untilNext) + 's' : '—');

  /* Grounded collection estimate: "≈ проба k/N" while sampling (idx 1). */
  const collectEl = $('st-collect');
  if (collectEl){
    if (s.sampleIdx != null && s.expN){
      collectEl.style.color = 'var(--ok)';
      collectEl.textContent = `≈ ${t('st_sample_lbl') || 'sample'} ${s.sampleIdx}/${s.expN} (${t('st_est') || 'est.'})`;
    } else {
      collectEl.textContent = '';
    }
  }

  /* Cadence health badge (on-time / late / missed). */
  const healthEl = $('st-health');
  if (healthEl){
    if (s.offline){ healthEl.style.color = 'var(--err)'; healthEl.textContent = '● ' + (t('st_health_missed') || 'missed'); }
    else if (s.health === 'late'){ healthEl.style.color = 'var(--warn)'; healthEl.textContent = '● ' + (t('st_health_late') || 'late') + ' +' + Math.round(s.overdue) + 's'; }
    else if (s.health === 'ok'){ healthEl.style.color = 'var(--ok)'; healthEl.textContent = '● ' + (t('st_health_ok') || 'on time'); }
    else { healthEl.textContent = ''; }
  }

  /* Ground-truth facts from the last POST (what the module ACTUALLY reported). */
  const factsEl = $('st-facts');
  if (factsEl){
    const f = s.facts || {};
    const chip = (label, val, tone) => val == null || val === ''
      ? '' : `<div class="kv" style="display:flex;flex-direction:column;gap:1px;padding:6px 8px;background:var(--panel2);border:1px solid var(--line);border-radius:6px">
                <span class="k" style="font-size:10px;color:var(--mut)">${label}</span>
                <span class="v" style="font-size:13px;font-weight:600${tone ? ';color:' + tone : ''}">${val}</span>
              </div>`;
    /* samples received vs expected — green when they match (config applied), amber if not */
    let recvVal = '—', recvTone = '';
    if (f.samples != null){
      recvVal = f.expected != null ? `${f.samples}/${f.expected}` : `${f.samples}`;
      recvTone = (f.expected != null && f.samples != f.expected) ? 'var(--warn)' : 'var(--ok)';
    }
    factsEl.innerHTML = [
      chip(t('st_recv') || 'received', recvVal, recvTone),
      chip(t('st_cycle_lbl') || 'cycle', f.cycle != null ? '#' + f.cycle : null),
      chip('🔋', f.batt != null ? (f.batt / 1000).toFixed(2) + 'V' : null),
      chip('☀', f.solar != null ? (f.solar / 1000).toFixed(2) + 'V' : null),
      chip('📶 CSQ', f.csq != null ? (f.csq == 99 ? '99' : f.csq) : null, f.csq == 99 ? 'var(--warn)' : ''),
      chip(t('st_bytes') || 'bytes', f.bytes != null ? f.bytes : null),
    ].join('');
  }

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
    /* Authoritative: backend `state==='switching'` (module hasn't confirmed) vs the old
     * median-ratio fallback. No more "median catches up in ~10 POSTs" — clears on the first
     * confirming POST. */
    const switching = lastConfig.state ? lastConfig.state === 'switching' : eff.pending;
    if (switching){
      const eta = lastConfig.next_expected_sec;
      const etaStr = eta != null ? fmtSec(eta) : '—';   /* i18n body already prefixes "~" */
      banner.style.display = 'block';
      banner.style.background = 'rgba(210,153,34,.12)';
      banner.style.border = '1px solid rgba(210,153,34,.5)';
      banner.style.color  = 'var(--warn)';
      banner.innerHTML = `🔄 <b>${t('sync_switch_title')}</b> ` +
        `${t('sync_switch_body').replace('{int}', `<b>${intHuman}</b>`).replace('{eta}', `<b>${etaStr}</b>`)}`;
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
  /* A change is only PROVEN applied when the MODULE acted on it — i.e. a real POST
   * arrived AFTER we made the change. Previously this compared the server config to
   * itself, so it flipped to "applied" the instant we saved — never confirming the
   * module. Now we confirm against the last POST's actual data. */
  const postTs    = lastConfig.last_timestamp ? parseServerTs(lastConfig.last_timestamp) : 0;
  const liveTs    = lastSnapshot?.timestamp ? parseServerTs(lastSnapshot.timestamp) : 0;
  for (const p of pending){
    if (p.status !== 'waiting') continue;
    const target   = p.target;
    const newPost  = postTs > p.startedAt;                       /* fresh regular POST since the change */
    const liveFresh= lastConfig.live && liveTs > p.startedAt;    /* fresh live POST since the change */
    let ok = true;
    for (const k of Object.keys(target)){
      if (k === 'samples'){
        /* The payload carries N actually collected → real proof of application. */
        ok = ok && newPost && (lastConfig.last_samples == target.samples);
      } else if (k === 'live'){
        /* Module entered/left live: state matches AND a fresh POST (regular or live) confirms it. */
        ok = ok && (lastConfig.live == target.live) && (newPost || liveFresh);
      } else if (k === 'avg'){
        /* avg isn't in the payload — can't prove directly; accept once a fresh POST lands. */
        ok = ok && (newPost || liveFresh);
      } else {
        ok = ok && (lastConfig[k] == target[k]) && (newPost || liveFresh);
      }
    }
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

