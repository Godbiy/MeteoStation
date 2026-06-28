/* ===== Lite mode (2G data saver): slow poll + no hourly curve backfill + hide charts ===== */
let LITE = localStorage.getItem('lite') === '1';
/* Wind-speed conversion factor: km/h per 1 pulse/sec (anemometer calibration).
 * Client-side display setting — the firmware sends raw pulse counts. */
let SPEED_FACTOR = parseFloat(localStorage.getItem('speed_factor')) || 2.4;

/* ---- Display units / timezone / solar / alerts (all client-side) ---- */
const SPEED_UNITS = { kmh:{mul:1, lbl:'km/h', max:100}, ms:{mul:1/3.6, lbl:'m/s', max:30}, mph:{mul:0.621371, lbl:'mph', max:60}, kn:{mul:0.539957, lbl:'kn', max:55} };
let SPEED_UNIT = localStorage.getItem('speed_unit') || 'kmh';
function spdU(){ return SPEED_UNITS[SPEED_UNIT] || SPEED_UNITS.kmh; }
function spdMul(){ return spdU().mul; }      /* km/h → display unit */
function spdLbl(){ return spdU().lbl; }

/* Server timestamps are local-time strings with no zone. By default we parse them
 * in the BROWSER's zone (fine when phone TZ == server TZ). If they differ, set an
 * explicit server offset so absolute time is correct everywhere. */
let TZ_OFFSET = localStorage.getItem('tz_offset');   /* '' = browser-local; else hours e.g. '2' */
function parseServerTs(s){
  if (typeof s === 'number') return s > 1e12 ? s : s * 1000;
  if (typeof s !== 'string') return 0;
  let iso = s.replace(' ', 'T');
  if (TZ_OFFSET && !isNaN(parseFloat(TZ_OFFSET))){
    const off = parseFloat(TZ_OFFSET), sign = off < 0 ? '-' : '+', ah = Math.abs(off);
    iso += sign + String(Math.floor(ah)).padStart(2,'0') + ':' + String(Math.round((ah % 1) * 60)).padStart(2,'0');
  }
  return new Date(iso).getTime();
}
/* Inverse of parseServerTs for test mode: format an epoch as a "YYYY-MM-DD HH:MM:SS"
 * string that parseServerTs() reads back to ~the same epoch (honours the data-TZ). */
function mockServerTs(epochMs){
  if (TZ_OFFSET && !isNaN(parseFloat(TZ_OFFSET)))
    return new Date(epochMs + parseFloat(TZ_OFFSET) * 3600000).toISOString().replace('T', ' ').slice(0, 19);
  const d = new Date(epochMs), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

let SOLAR_WATT = parseFloat(localStorage.getItem('solar_watt')) || 3;   /* panel W; default 3W = worst-case A4-ish 10-12V panel */
/* Solar panel state thresholds (mV at the panel node, NOT battery):
 *  < SOLAR_ZERO_MV   → no current at all, treat as 0 (CN3791 dark floor ~2.8V sits here)
 *  < SOLAR_CHARGE_MV → panel awake but below battery, module is NOT charging
 *  ≥ SOLAR_CHARGE_MV → panel above battery, CN3791 is charging */
const SOLAR_ZERO_MV   = 3300;
const SOLAR_CHARGE_MV = 4000;
const SOLAR_EFF       = 0.85;   /* CN3791 buck efficiency for the instantaneous charge-current estimate */
const BATT_FULL_MV    = 4150;   /* at/above → treat as full, charge tapers to ~0 ("charged full") */
const BATT_SOON_MV    = 4100;   /* charging above this → "almost full, will stop charging soon" */
/* Per-type alert config (each independently toggleable). v = wind in display unit. */
const ALERT_DEFAULTS = { battLow:{on:true,mv:3400}, battCrit:{on:true,mv:3300}, windHigh:{on:false,v:20}, offline:{on:true,min:30}, online:{on:true}, solar:{on:true} };
let ALERTS = (() => {
  const d = JSON.parse(JSON.stringify(ALERT_DEFAULTS));
  try { const s = JSON.parse(localStorage.getItem('alerts_cfg') || '{}'); for (const k in d) Object.assign(d[k], s[k] || {}); } catch {}
  return d;
})();
function applyLite(){
  document.body.classList.toggle('lite', LITE);
  const lsw = document.getElementById('lite-sw'); if (lsw) lsw.checked = LITE;
}
function setLite(on){ LITE = !!on; localStorage.setItem('lite', LITE ? '1' : '0'); applyLite(); if (typeof startPoll === 'function') startPoll(); }
applyLite();
document.getElementById('lite-sw')?.addEventListener('change', e => setLite(e.target.checked));
/* full sync on demand: poll + force the last-hour curve backfill (even in Lite) +
 * refresh history if open. The header spinner shows automatically via fjson. */
async function syncNow(){
  const btn = $('refresh-now'); if (btn) btn.disabled = true;
  $('sync-spin')?.classList.add('on');
  try {
    if (typeof poll === 'function') await poll();
    if (typeof maybeBackfillSpeedHistory === 'function') await maybeBackfillSpeedHistory(Date.now(), true);
    if (document.querySelector('.tab.active')?.dataset.page === 'history' && typeof renderHistory === 'function') await renderHistory();
    toast('✓ ' + t('synced'));
  } catch (e){ toast('✗ ' + e.message, true); }
  finally { if (btn) btn.disabled = false; $('sync-spin')?.classList.remove('on'); }
}
$('refresh-now')?.addEventListener('click', syncNow);

/* ===== PWA: installable + offline app-shell (http/https only; skip on file://) ===== */
if (location.protocol.startsWith('http')){
  try { const ml = document.createElement('link'); ml.rel = 'manifest'; ml.href = '?manifest=1'; document.head.appendChild(ml); } catch {}
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('?sw=1').catch(() => {});
    /* A Force-update / PWA reinstall drops the push subscription (it's tied to the
     * SW registration), leaving a dead one on the server (410). If the user had
     * server push on, silently re-create a fresh subscription so it self-heals. */
    if (localStorage.getItem('spush_on') === '1'){
      swReady().then(() => { if (typeof spushReg === 'function') spushReg(); }).catch(() => {});
    }
  }
}
/* Resolve to a registration whose worker is ACTIVE — robustly. navigator
 * .serviceWorker.ready only resolves once a worker CONTROLS this page, which can
 * lag (or never happen on a hard-reloaded page). Instead register explicitly and
 * wait for the registration's own worker to reach 'activated'. Times out so the
 * UI reports instead of hanging. */
function swReady(ms = 12000){
  if (!('serviceWorker' in navigator)) return Promise.reject(new Error('no SW'));
  const work = (async () => {
    let reg = await navigator.serviceWorker.register('?sw=1').catch(() => null);
    if (!reg) reg = await navigator.serviceWorker.getRegistration();
    if (!reg) throw new Error('SW не зареєструвався');
    if (reg.active) return reg;
    const sw = reg.installing || reg.waiting;
    if (sw){
      await new Promise(res => {
        if (sw.state === 'activated') return res();
        sw.addEventListener('statechange', () => { if (sw.state === 'activated') res(); });
      });
      return reg;
    }
    return await navigator.serviceWorker.ready;
  })();
  return Promise.race([
    work,
    new Promise((_, rej) => setTimeout(() => rej(new Error('SW не активувався — перезавантаж')), ms))
  ]);
}

