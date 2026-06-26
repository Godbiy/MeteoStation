/* =========== STATE =========== */
let cacheRetentionDays = +localStorage.getItem('cache_retention_days') || 30;
let lastSeenHistTs = null;   /* triggers auto-refresh of History when changes */
let lastSnapshot = null;           /* {vane, pps, batt_mv, csq, timestamp, age_sec} */
let lastConfig   = null;           /* {samples, avg, samples_max, cycle_seconds, live, last_timestamp} */
let speedHistory = [];             /* {t, kmh, dir} for sparkline + stats (last hour) */
let history      = [];             /* full entries for /history tab */
let currentRange = localStorage.getItem('range') || '1h';   /* persist so an offline reopen shows the same view */
let testMode     = false;
let testTimer    = null;
let pollTimer    = null;

/* =========== TOAST =========== */
/* type: false/'' = success (default), true/'err' = error, 'warn', 'info' */
function toast(msg, type=false){
  const cls = type === true ? 'err' : (type || '');
  const el = $('toast'); el.textContent = msg; el.className = 'toast show' + (cls ? ' ' + cls : '');
  setTimeout(() => el.classList.remove('show'), 2500);
}
/* retrigger the scale "bump" animation on an element */
function bump(el){ if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
/* ===== micro-interactions: haptics, tab badges, theme-color, count-up, trend ===== */
function prefersReduced(){ try { return matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (_) { return false; } }
/* short vibration — only on touch devices that support it (no-op on desktop), and
 * only if the user hasn't switched it off in Settings (HAPTICS_ON declared up top). */
function haptic(ms=12){ try { if (HAPTICS_ON && navigator.vibrate && matchMedia('(pointer:coarse)').matches && !prefersReduced()) navigator.vibrate(ms); } catch (_) {} }
/* per-tab status dot: setTabBadge('settings', true, 'var(--err)') / (…, false) to clear */
function setTabBadge(page, on, color, pulse){
  const b = document.getElementById('badge-' + page); if (!b) return;
  if (on){ if (color) b.style.background = color; b.classList.add('on'); b.classList.toggle('pulse', !!pulse); }
  else b.classList.remove('on', 'pulse');
}
/* PWA chrome / status-bar colour follows the active theme */
function applyThemeColor(){
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', THEME === 'sunlight' ? '#e6eaef' : '#0d1117');
}
/* count-up a number element from its previous value to `to` (easeOutCubic) */
function animateNumber(el, to, fmt, dur=450){
  if (!el) return;
  fmt = fmt || (n => String(Math.round(n)));
  const from = parseFloat(el.dataset.val), target = +to;
  el.dataset.val = target;
  if (!isFinite(from) || from === target || prefersReduced()){ el.textContent = fmt(target); return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (target - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/* ▲▼ trend arrow on a .trend span, by comparing to the previous value */
function setTrend(el, val){
  if (!el) return;
  const prev = parseFloat(el.dataset.prev);
  el.dataset.prev = val;
  if (!isFinite(prev) || Math.abs(val - prev) < 1e-9){ el.className = 'trend'; el.textContent = ''; return; }
  el.className = 'trend ' + (val > prev ? 'up' : 'down');
  el.textContent = val > prev ? '▲' : '▼';
}
/* brief highlight ring when fresh data lands */
function flashNew(el){ if (!el || prefersReduced()) return; el.classList.remove('flash-new'); void el.offsetWidth; el.classList.add('flash-new'); }
/* In-app confirm — native window.confirm() is suppressed (returns false) in many
 * standalone/installed PWAs, which made "destructive" buttons silently no-op.
 * Returns a Promise<boolean>. Falls back to window.confirm if the modal is absent. */
function uiConfirm(msg){
  return new Promise(resolve => {
    const m = $('confirm-modal'), yes = $('cfm-yes'), no = $('cfm-no'), txt = $('cfm-msg');
    if (!m || !yes || !no){ resolve(window.confirm(msg)); return; }
    txt.textContent = msg;
    m.hidden = false;
    const done = v => { m.hidden = true; yes.removeEventListener('click', onYes); no.removeEventListener('click', onNo); m.removeEventListener('click', onBg); resolve(v); };
    const onYes = () => done(true), onNo = () => done(false), onBg = e => { if (e.target === m) done(false); };
    yes.addEventListener('click', onYes); no.addEventListener('click', onNo); m.addEventListener('click', onBg);
  });
}

/* =========== FETCH + NETWORK MONITOR =========== */
const netLog = [];     /* {url, ms, bytes, status, ok, at} – ring buffer of last 30 */
const NET_MAX = 30;
let busyCount = 0;
function setBusy(d){ busyCount = Math.max(0, busyCount + d); const s = $('spinner'); if (s) s.classList.toggle('on', busyCount > 0); }
async function fjson(url){
  const t0 = performance.now();
  setBusy(1);
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const txt = await r.text();
    const ms = Math.round(performance.now() - t0);
    const bytes = (txt || '').length;
    netLog.push({ url: url.replace(SRV, ''), at: Date.now(), ms, bytes, status: r.status, ok: r.ok });
    if (netLog.length > NET_MAX) netLog.shift();
    renderNetLog();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    try { return JSON.parse(txt); }
    catch (e){ throw new Error('bad JSON'); }
  } finally {
    setBusy(-1);
  }
}
function renderNetLog(){
  const el = $('netlog-body'); if (!el) return;
  if (!netLog.length){ el.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--mut)">— no requests —</td></tr>`; return; }
  const totalBytes = netLog.reduce((a, e) => a + e.bytes, 0);
  $('netlog-total').textContent = `${netLog.length} req · ${(totalBytes/1024).toFixed(1)} KB total`;
  const reversed = [...netLog].reverse().slice(0, 15);
  el.innerHTML = reversed.map(e => {
    const u = e.url.length > 40 ? e.url.slice(0, 38) + '…' : e.url;
    const status = e.ok ? `<span style="color:var(--ok)">${e.status}</span>` : `<span style="color:var(--err)">${e.status}</span>`;
    return `<tr><td style="font-family:monospace;font-size:11px">${u}</td><td>${status}</td><td>${(e.bytes/1024).toFixed(1)} KB</td><td>${e.ms}ms</td></tr>`;
  }).join('');
}

/* =========== Beaufort / Gust / Stability =========== */
const BEAUFORT = [
  [1,   'Calm',          '🌫'],  [5,   'Light air',     '🍃'],
  [11,  'Light breeze',  '🌬'],  [19,  'Gentle breeze', '🌬'],
  [28,  'Moderate',      '💨'],  [38,  'Fresh',         '💨'],
  [49,  'Strong',        '🌪'],  [61,  'Near gale',     '🌪'],
  [74,  'Gale',          '⛈'],  [88,  'Strong gale',   '⛈'],
  [102, 'Storm',         '🌀'],  [117, 'Violent storm', '🌀'],
  [999, 'Hurricane',     '🌀'],
];
function beaufortOf(v){
  const kmh = v / spdMul();   /* v is in the chosen display unit → back to km/h for the scale */
  for (let i = 0; i < BEAUFORT.length; i++){
    if (kmh < BEAUFORT[i][0]) return { num: i, label: BEAUFORT[i][1], icon: BEAUFORT[i][2] };
  }
  return { num: 12, label: 'Hurricane', icon: '🌀' };
}
function gustFactor(samples){
  /* samples = array of {speed} for last hour */
  if (samples.length < 2) return null;
  const speeds = samples.map(s => s.speed).filter(v => v > 0);
  if (!speeds.length) return null;
  const mean = speeds.reduce((a,b)=>a+b,0) / speeds.length;
  const max  = Math.max(...speeds);
  return { mean, max, factor: mean > 0 ? max / mean : 0 };
}
function dirStability(samples){
  /* count distinct dir indices, find dominant */
  const bins = new Array(8).fill(0);
  let total = 0;
  for (const s of samples){ if (s.dir != null && s.dir >= 0){ bins[s.dir]++; total++; } }
  if (!total) return null;
  const dom = bins.indexOf(Math.max(...bins));
  const domPct = bins[dom] / total;
  const active = bins.filter(b => b / total >= 0.10).length;  /* dirs with >=10% time */
  return { dom, domPct, active, total };
}

