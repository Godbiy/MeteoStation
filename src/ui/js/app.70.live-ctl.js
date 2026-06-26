/* =========== LIVE controls =========== */
$('live-sw')?.addEventListener('change', async e => {
  const v = e.target.checked ? 1 : 0;
  try { await fjson(SRV + '?set_live=' + v + '&t=' + Date.now()); $('live-stat').textContent = '✓ saved, waiting'; $('live-stat').className='stat ok'; trackPending('live', { live: v }); toast('LIVE ' + (v ? 'on' : 'off')); poll(); }
  catch (err){ $('live-stat').textContent = 'err: ' + err.message; $('live-stat').className='stat err'; e.target.checked = !e.target.checked; }   /* revert on failure */
});
async function updateCacheStats(){
  if (!$('cache-size')) return;
  const [count, est] = await Promise.all([dbCount(), dbEstimate()]);
  $('cache-pts').textContent = count;
  $('cache-size').textContent = (est.used / 1024 / 1024).toFixed(2) + ' MB';
  $('cache-quota').textContent = est.quota ? (est.quota / 1024 / 1024).toFixed(0) + ' MB' : 'unknown';
}
$('clear-cache-btn').addEventListener('click', async () => {
  if (!(await uiConfirm('Видалити кешовані історичні дані?'))) return;
  await dbClear();
  history = [];
  speedHistory = [];
  lastSeenHistTs = null;    /* allow auto-refresh to re-seed */
  /* Reset history meta so user sees the clear before next poll seeds again. */
  if ($('hi-speed-meta')) $('hi-speed-meta').textContent = '0 pts (0 cached)';
  ['chart-speed','chart-wt','chart-rose','chart-batt','chart-solar'].forEach(id => {
    const el = $(id); if (el) el.innerHTML = '';
  });
  const tb = $('stats-table')?.querySelector('tbody'); if (tb) tb.innerHTML = '';
  await updateCacheStats();
  /* Re-seed immediately from the server instead of waiting for the next poll.
   * The button lives on the Settings tab, but poll() only re-syncs History while
   * the History tab is active — so without this the cache stays empty (and "new
   * data isn't added") until the user manually opens History. */
  $('cache-stat').textContent = '✓ cleared — re-syncing…';
  $('cache-stat').className = 'stat ok';
  try {
    await renderHistory();
    await updateCacheStats();
    $('cache-stat').textContent = `✓ cleared — re-synced (${await dbCount()} cached)`;
  } catch (e){
    $('cache-stat').textContent = '✓ cleared — re-sync failed, retry on next poll';
    $('cache-stat').className = 'stat warn';
  }
  toast('cache cleared');
});

/* Show build version; if the token wasn't replaced (running un-built locally) say "dev". */
(() => { const bv = $('build-ver'); if (bv && bv.textContent.indexOf('BUILD_VER') >= 0) bv.textContent = 'dev (unbuilt)'; })();

/* Force update: nuke the service worker + all caches, then hard-reload. Gives a
 * phone a one-tap way to pull the newest deployed UI (no Ctrl+Shift+R needed). */
$('force-update-btn').addEventListener('click', async () => {
  const s = $('force-stat'); s.textContent = '…'; s.className = 'stat';
  try {
    if ('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches){
      const ks = await caches.keys();
      await Promise.all(ks.map(k => caches.delete(k)));
    }
    s.textContent = '✓ reloading…'; s.className = 'stat ok';
    setTimeout(() => location.reload(), 250);
  } catch (e){
    s.textContent = 'err: ' + e.message; s.className = 'stat err';
  }
});
$('retention-sel').value = cacheRetentionDays;
$('retention-sel').addEventListener('change', async () => {
  cacheRetentionDays = +$('retention-sel').value;
  localStorage.setItem('cache_retention_days', cacheRetentionDays);
  if (cacheRetentionDays > 0){
    const n = await dbTrim(cacheRetentionDays);
    if (n) toast(`trimmed ${n} old entries`);
  }
  await updateCacheStats();
});

/* Wind-speed calibration: km/h per 1 pulse/sec. Pure display setting. */
(function(){
  const inp = $('sf-input'), inv = $('sf-inverse'), stat = $('sf-stat');
  if (!inp) return;
  const showInv = () => { const v = parseFloat(inp.value); inv.textContent = (v > 0) ? `1 ${t('kmh')} = ${(1/v).toFixed(3)} imp/s` : '—'; };
  inp.value = SPEED_FACTOR; showInv();
  inp.addEventListener('input', showInv);
  function apply(v){
    if (!(v > 0)){ stat.textContent = 'err'; stat.className = 'stat err'; return; }
    SPEED_FACTOR = v; localStorage.setItem('speed_factor', String(v));
    inp.value = v; showInv();
    stat.textContent = '✓'; stat.className = 'stat ok';
    renderLive(); drawLiveTimeline();
    if (history.length) drawHistoryCharts();
    hmLoadedAt = 0; loadHeatmapData();        /* heatmap km/h depends on the factor */
    toast('1 imp/s = ' + v + ' km/h');
  }
  $('sf-apply').addEventListener('click', () => apply(parseFloat(inp.value)));
  $('sf-reset').addEventListener('click', () => apply(2.4));
})();

/* Battery pack: capacity (mAh) + empty-cutoff (mV) — feed the "days left" forecast. */
(function(){
  const cap = $('bs-cap'), cut = $('bs-cut'), stat = $('bs-stat');
  if (!cap) return;
  cap.value = BATT_CAPACITY || '';
  cut.value = BATT_CUTOFF_MV;
  function apply(c, v){
    if (!(v >= 2000 && v <= 4200)){ stat.textContent = 'err: 2000–4200 mV'; stat.className = 'stat err'; return; }
    BATT_CAPACITY = (c > 0) ? c : 0;
    BATT_CUTOFF_MV = v;
    SOLAR_WATT = parseFloat($('solar-w').value) || 0;   /* solar shares this card's Apply */
    localStorage.setItem('batt_capacity', String(BATT_CAPACITY));
    localStorage.setItem('batt_cutoff', String(v));
    localStorage.setItem('solar_watt', String(SOLAR_WATT));
    cap.value = BATT_CAPACITY || ''; cut.value = v;
    if ($('bf-cutoff')) $('bf-cutoff').textContent = v;
    if (typeof renderSolarNote === 'function') renderSolarNote();
    stat.textContent = '✓ ' + t('applied'); stat.className = 'stat ok';
    if (history.length) drawHistoryCharts();   /* re-run the forecast */
    toast('battery saved');
  }
  $('bs-apply').addEventListener('click', () => apply(parseInt(cap.value), parseInt(cut.value)));
  $('bs-reset').addEventListener('click', () => apply(0, 3300));
})();

/* Speed display unit (km/h / m/s / mph / kn) — data stays km/h internally; the
 * factor is baked at the conversion points, so a change rebuilds derived data. */
function setSpeedUnit(u){
  if (!SPEED_UNITS[u]) return;
  SPEED_UNIT = u; localStorage.setItem('speed_unit', u);
  _ptsKey = ''; speedHistory = [];
  updateSpeedUnitLabels();
  const wu = $('al-wind-unit'); if (wu) wu.textContent = spdLbl();
  hmLoadedAt = 0; loadHeatmapData();
  renderLive(); drawLiveTimeline();
  if (history.length) drawHistoryCharts();
}
(function(){
  const sel = $('unit-sel'); if (!sel) return;
  sel.value = SPEED_UNIT; updateSpeedUnitLabels();
  const wu = $('al-wind-unit'); if (wu) wu.textContent = spdLbl();
  sel.addEventListener('change', () => setSpeedUnit(sel.value));
})();

/* Server-timestamp timezone offset */
(function(){
  const sel = $('tz-sel'); if (!sel) return;
  sel.value = TZ_OFFSET || '';
  sel.addEventListener('change', () => {
    TZ_OFFSET = sel.value;
    if (TZ_OFFSET) localStorage.setItem('tz_offset', TZ_OFFSET); else localStorage.removeItem('tz_offset');
    _ptsKey = ''; hmLoadedAt = 0; loadHeatmapData();
    renderLive(); drawLiveTimeline();
    if (history.length) drawHistoryCharts();
    toast('TZ: ' + (TZ_OFFSET ? 'UTC' + (TZ_OFFSET >= 0 ? '+' : '') + TZ_OFFSET : 'auto'));
  });
})();

/* Rolling battery-voltage log — fed by the live poll + one seed fetch, INDEPENDENT of the
 * History tab (which may never be opened). Used to fact-check the panel's "charging" claim. */
let battLog = [];
async function seedBattLog(){
  try {
    const d = await fjson(SRV + '?range=3h&compact=1&fmt=c&t=' + Date.now());
    if (Array.isArray(d)){
      const s = [];
      for (const e of d){ const ts = entryTs(e), mv = e.batt_mv ?? e.b; if (ts && mv > 0) s.push({ t: ts, mv }); }
      s.sort((a, b) => a.t - b.t);
      if (s.length >= battLog.length) battLog = s;
    }
  } catch (_) {}
}
function pushBattSample(){
  if (!lastSnapshot || !(lastSnapshot.batt_mv > 0) || !lastSnapshot.timestamp) return;
  const ts = parseServerTs(lastSnapshot.timestamp);
  if (!ts || (battLog.length && ts <= battLog[battLog.length-1].t)) return;   /* only NEW posts */
  battLog.push({ t: ts, mv: lastSnapshot.batt_mv });
  const cut = Date.now() - 3 * 3600000;
  while (battLog.length && battLog[0].t < cut) battLog.shift();
}
/* Robust battery trend: median of the oldest third vs the newest third of the 3h buffer.
 * Median rejects the single GSM-sag spikes that wreck a plain regression on sparse data
 * (a short noisy window once read +42 mV/h while the battery was actually flat). */
function battTrend(){
  const cut = Date.now() - 3 * 3600000;
  const pts = battLog.filter(p => p.t >= cut);
  if (pts.length < 5) return null;
  const med = a => { const x = [...a].sort((p, q) => p - q); return x[(x.length - 1) >> 1]; };
  const k = Math.max(2, Math.floor(pts.length / 3));
  const older = med(pts.slice(0, k).map(p => p.mv));
  const recent = med(pts.slice(-k).map(p => p.mv));
  const spanMin = (pts[pts.length - 1].t - pts[0].t) / 60000;
  return { deltaMv: recent - older, spanMin, mvPerH: spanMin > 0 ? (recent - older) / (spanMin / 60) : 0, n: pts.length };
}

/* Live current estimates from voltages (no current sensor on the board).
 *  charge-in : panel wattage → mA, only when the panel is above the battery (CN3791 can buck)
 *  battery   : net = charge-in − modelled load (GSM duty per cycle); signed (+ charging / − draining) */
function liveCurrents(s){
  const battMv = s.batt_mv || 0;
  const solMv  = (s.solar_mv != null) ? s.solar_mv : 0;
  const vBat   = (battMv || 3700) / 1000;
  let state = 'idle';                                    /* idle (asleep) | off (not charging) | on */
  if      (solMv >= SOLAR_CHARGE_MV) state = 'on';
  else if (solMv >= SOLAR_ZERO_MV)   state = 'off';
  const full = battMv >= BATT_FULL_MV;
  const chargeMa = (state === 'on' && SOLAR_WATT > 0 && !full)   /* at full, CN3791 tapers to ~0 */
    ? Math.round(SOLAR_WATT * SOLAR_EFF / vBat * 1000) : 0;
  const cyc    = lastConfig?.cycle_seconds || 0;         /* same load model as solarEstimate() */
  const loadMa = cyc ? Math.round(Math.min(150, 150 * 60 / cyc) + 0.1) : null;
  const netMa  = (loadMa != null) ? chargeMa - loadMa : null;
  /* coarse phase for badges/notifications: full > soon > on > off > idle */
  const phase = full ? 'full'
              : (state === 'on' && battMv >= BATT_SOON_MV) ? 'soon'
              : state;
  return { state, phase, chargeMa, loadMa, netMa };
}
/* Plain label + sprite icon id for a charge phase. */
const PHASE_IC = { full:'ic-check', soon:'ic-up', on:'ic-sun', off:'ic-warn', idle:'ic-moon' };
function chargePhaseText(ph){
  return ph === 'full' ? t('chg_full') : ph === 'soon' ? t('chg_soon')
       : ph === 'on'   ? t('chg_yes')  : ph === 'off'  ? t('chg_no') : t('chg_idle');
}
/* Inline icon + label (used by the small solar tile sub-line). */
function chargePhaseHtml(ph){
  return `<svg class="ic ic-sm"><use href="#${PHASE_IC[ph] || 'ic-moon'}"/></svg> ${chargePhaseText(ph)}`;
}

/* Solar panel wattage → daily sustainability estimate */
function solarEstimate(){
  const cyc = lastConfig?.cycle_seconds || 0;
  if (!cyc) return null;
  const GSM_ACTIVE = 60, GSM_MA = 150;                              /* rough per-cycle GSM cost */
  const avgMa = Math.min(GSM_MA, GSM_MA * GSM_ACTIVE / cyc) + 0.1;
  const consMah = avgMa * 24;
  const inMah = SOLAR_WATT > 0 ? SOLAR_WATT / 3.7 * 1000 * 4 * 0.6 : 0;  /* ~4 peak-sun-h, 60% losses */
  return { consMah: Math.round(consMah), inMah: Math.round(inMah), net: Math.round(inMah - consMah) };
}
function renderSolarNote(){
  const el = $('solar-note'); if (!el) return;
  const e = solarEstimate();
  if (!e || SOLAR_WATT <= 0){ el.textContent = ''; return; }
  const peakMa = Math.round(SOLAR_WATT * SOLAR_EFF / 3.8 * 1000);   /* charge current in full sun @~3.8V */
  el.textContent = `≈ ${e.inMah} − ${e.consMah} = ${e.net >= 0 ? '+' : ''}${e.net} mAh/${t('per_day')} · ☀ ~${peakMa} mA`;
  el.style.color = e.net >= 0 ? 'var(--ok)' : 'var(--err)';
}
(function(){
  const inp = $('solar-w'); if (!inp) return;
  inp.value = SOLAR_WATT || '';                 /* applied together with the battery card */
  inp.addEventListener('input', () => { SOLAR_WATT = parseFloat(inp.value) || 0; renderSolarNote(); });
  renderSolarNote();
})();

/* Foreground push alerts (low battery / high wind) when the tab is open. */
let _alertState = {};
async function notify(title, body, icon){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, icon: icon || (SRV + '?icon=1'), badge: SRV + '?push_icon=app&badge=1', tag: 'meteo', renotify: true };
  /* Mobile / PWA forbids `new Notification()` — must go through the service worker. */
  try {
    if ('serviceWorker' in navigator){
      const reg = await swReady();
      await reg.showNotification(title, opts);
      return;
    }
  } catch (_) {}
  try { new Notification(title, opts); } catch (_) {}
}
/* Edge-triggered: fire only when a condition first becomes true (no spam). */
function pushIcon(type){ return SRV + '?push_icon=' + type; }
function fireOnce(key, cond, title, body, icon){
  if (cond && !_alertState[key]) notify(title, body, icon);
  _alertState[key] = cond;
}
/* PWA app-icon badge: the count of currently-active problem alerts (cleared at 0). */
function updateAppBadge(n){
  try {
    if (!('setAppBadge' in navigator)) return;
    if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge();
  } catch (_) {}
}
function checkAlerts(){
  if (!ALERTS_ON){ updateAppBadge(0); return; }
  const A = ALERTS;
  if (lastSnapshot){
    const mv = lastSnapshot.batt_mv;
    if (typeof mv === 'number' && mv > 0){
      const crit = A.battCrit.on && mv < A.battCrit.mv;
      fireOnce('battCrit', crit, '🔴 ' + t('alert_crit_n'), `${mv} mV`, pushIcon('crit'));
      fireOnce('battLow', A.battLow.on && mv < A.battLow.mv && !crit, '🔋 ' + t('alert_batt_n'), `${mv} mV`, pushIcon('batt'));
    }
    if (A.windHigh.on && A.windHigh.v > 0){
      const v = (lastSnapshot.pulses_sec || 0) * SPEED_FACTOR * spdMul();
      fireOnce('windHigh', v > A.windHigh.v, '💨 ' + t('alert_wind_n'), `${v.toFixed(0)} ${spdLbl()}`, pushIcon('wind'));
    }
    /* solar / charge state — edge-triggered transitions + a charging badge on the app icon */
    if (A.solar?.on && typeof mv === 'number' && mv > 0){
      const cur = liveCurrents(lastSnapshot);
      fireOnce('chgFull', cur.phase === 'full', '🔋 ' + t('alert_full_n'), t('alert_full_b'), pushIcon('batt'));
      fireOnce('chgSoon', cur.phase === 'soon', '🔆 ' + t('alert_soon_n'), t('alert_soon_b'), pushIcon('batt'));
      /* "got / lost sun" tracks the panel only (state), so a full battery doesn't read as "no sun" */
      const hasSun = cur.state === 'on';
      if (hasSun  && _alertState.charging === false) notify('☀ ' + t('alert_chgon_n'), '', pushIcon('online'));
      if (!hasSun && _alertState.charging === true)  notify('🌙 ' + t('alert_chgoff_n'), t('alert_chgoff_b'), pushIcon('crit'));
      _alertState.charging = hasSun;
    }
  }
  /* offline / back-online from the last regular-post age */
  const lastTs = lastConfig?.last_timestamp ? parseServerTs(lastConfig.last_timestamp) : 0;
  if (lastTs && (A.offline.on || A.online.on)){
    const ageMin = (Date.now() - lastTs) / 60000;
    const off = A.offline.on && ageMin > A.offline.min;
    if (off && !_alertState.offline) notify('📡 ' + t('alert_offline_n'), `${Math.round(ageMin)} ${t('minutes')}`, pushIcon('crit'));
    if (!off && _alertState.offline && A.online.on) notify('✅ ' + t('alert_online_n'), '', pushIcon('online'));
    _alertState.offline = off;
  }
  /* app-icon badge = number of active problem alerts */
  updateAppBadge(['battCrit', 'battLow', 'windHigh', 'offline'].filter(k => _alertState[k]).length);
}
(function(){
  const sw = $('al-sw'), perm = $('al-perm'), test = $('al-test'), stat = $('al-stat'), wrap = $('al-types');
  if (!sw || !wrap) return;
  const reflect = () => { sw.checked = ALERTS_ON; };
  reflect();
  /* fill per-type checkboxes + thresholds from ALERTS */
  wrap.querySelectorAll('input[data-al]').forEach(cb => cb.checked = !!ALERTS[cb.dataset.al]?.on);
  wrap.querySelectorAll('input[data-th]').forEach(inp => {
    const c = ALERTS[inp.dataset.th]; if (c) inp.value = c.mv ?? c.v ?? c.min ?? '';
  });
  const showPerm = () => { stat.textContent = ('Notification' in window) ? Notification.permission : '—'; };
  showPerm();
  const setOn = v => { ALERTS_ON = v; localStorage.setItem('alerts_on', v ? '1' : '0'); reflect(); updateTabBadges(); };
  sw.addEventListener('change', () => setOn(sw.checked));
  perm.addEventListener('click', async () => { if ('Notification' in window){ await Notification.requestPermission(); showPerm(); updateTabBadges(); } });
  test.addEventListener('click', async () => {
    if (!('Notification' in window)){ toast('браузер не підтримує сповіщення', true); return; }
    if (Notification.permission !== 'granted'){ await Notification.requestPermission(); showPerm(); }
    if (Notification.permission === 'granted'){
      notify('🔔 ' + t('alerts_test'), t('alerts_test_body'), pushIcon('test'));
      toast(t('alerts_test') + ' ✓');
    } else {
      toast('дозвіл на сповіщення відхилено', true);
    }
  });
  $('al-apply').addEventListener('click', () => {
    wrap.querySelectorAll('input[data-al]').forEach(cb => { const c = ALERTS[cb.dataset.al]; if (c) c.on = cb.checked; });
    wrap.querySelectorAll('input[data-th]').forEach(inp => {
      const c = ALERTS[inp.dataset.th], n = parseFloat(inp.value); if (!c || isNaN(n)) return;
      if ('mv' in c) c.mv = n; else if ('v' in c) c.v = n; else if ('min' in c) c.min = n;
    });
    localStorage.setItem('alerts_cfg', JSON.stringify(ALERTS));
    _alertState = {};   /* reset so a still-true condition re-notifies after a change */
    if (typeof spushSyncCfg === 'function') spushSyncCfg();   /* push thresholds to server if subscribed */
    toast('alerts saved');
  });
})();

/* ===== Server push (Web Push / VAPID): per-device subscribe, fires when the
 * module POSTs and a battery/wind threshold (from Alerts above) is crossed. ===== */
function urlB64ToUint8Array(b){
  const pad = '='.repeat((4 - b.length % 4) % 4);
  const s = (b + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
/* Short human label for the subscriber list (e.g. "Android Chrome"). */
function deviceLabel(){
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
           : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac'
           : /Linux/.test(ua) ? 'Linux' : '?';
  const br = /Edg/.test(ua) ? 'Edge' : /OPR|Opera/.test(ua) ? 'Opera' : /Firefox/.test(ua) ? 'Firefox'
           : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '?';
  return os + ' ' + br;
}
/* sha-256 → first 12 hex, matching the server's id, to mark "this device". */
async function endpointId(ep){
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ep));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  } catch { return ''; }
}
function spushCfg(){
  return { on: true, sf: SPEED_FACTOR, lang: LANG,                       /* server pushes in the chosen language */
    uMul: spdMul(), uLbl: spdLbl(),                                      /* so server pushes show the chosen unit */
    batt:     ALERTS.battLow.on  ? ALERTS.battLow.mv  : 0,
    battCrit: ALERTS.battCrit.on ? ALERTS.battCrit.mv : 0,
    wind:     ALERTS.windHigh.on ? (ALERTS.windHigh.v / spdMul()) : 0,   /* km/h for the server */
    online:   ALERTS.online.on,                                          /* push when a post returns after a gap */
    offlineMin: ALERTS.offline.min,                                      /* the gap length that counts as "was offline" */
    livePin:  localStorage.getItem('live_pin') === '1' };               /* background pinned live notification */
}
async function spushReg(){
  /* Verbose: report the failing step into sp-stat (no phone console available). */
  const say = m => { const s = $('sp-stat'); if (s) s.textContent = m; };
  if (testMode){ say('тест-режим'); return null; }
  if (!('serviceWorker' in navigator)){ say('нема serviceWorker'); return null; }
  if (!('PushManager' in window)){ say('нема PushManager (iOS<16.4?)'); return null; }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted'){ say('дозвіл: ' + perm); return null; }
    say('реєструю SW…');
    const reg = await swReady();
    say('беру VAPID…');
    const { key } = await fjson(SRV + '?push_pub');
    if (!key){ say('сервер не дав ключ'); return null; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub){ say('підписуюсь…'); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) }); }
    say('зберігаю на сервері…');
    const r = await fetch(SRV + '?push_subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), cfg: spushCfg(), label: deviceLabel() }) });
    const j = await r.json().catch(() => ({}));
    say('✓ підписок: ' + (j.count ?? '?'));
    if (typeof loadDeviceList === 'function') loadDeviceList();
    return sub;
  } catch (e) {
    say('помилка: ' + (e && e.message ? e.message : e));
    return null;
  }
}
async function spushUnreg(){
  try {
    const reg = await swReady();
    const sub = await reg.pushManager.getSubscription();
    if (sub){ await fetch(SRV + '?push_unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  } catch {}
}
async function spushSyncCfg(){
  if (localStorage.getItem('spush_on') !== '1' || testMode) return;
  try {
    const reg = await swReady();
    const sub = await reg.pushManager.getSubscription();
    if (sub) await fetch(SRV + '?push_subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), cfg: spushCfg(), label: deviceLabel() }) });
  } catch {}
}
/* Subscribed-devices list + per-device delete. */
let _myEpId = '';
async function loadDeviceList(){
  const box = $('sp-dev-list'); if (!box) return;
  if (testMode){ box.innerHTML = `<div class="set-note">—</div>`; return; }
  try {
    try { const reg = await swReady(); const s = await reg.pushManager.getSubscription(); _myEpId = s ? await endpointId(s.endpoint) : ''; } catch { _myEpId = ''; }
    const list = await fjson(SRV + '?push_list');
    if (!Array.isArray(list) || !list.length){ box.innerHTML = `<div class="set-note" data-i18n="spush_none">${t('spush_none')}</div>`; return; }
    box.innerHTML = list.map(d => {
      const me = d.id && d.id === _myEpId;
      const name = (d.label || d.host || '?') + (me ? ' · ' + t('spush_this') : '');
      const bits = [d.on ? 'on' : 'off'];
      if (d.livePin) bits.push('📌');
      if (d.batt)    bits.push('🔋<' + d.batt);
      if (d.wind)    bits.push('💨>' + d.wind);
      if (d.since)   bits.push(d.since);
      return `<div class="dev-row${me ? ' me' : ''}"><div class="dev-meta"><div class="dev-title">${name}</div><div class="dev-sub">${bits.join(' · ')}</div></div><button class="btn sm danger dev-del" data-id="${d.id}">🗑</button></div>`;
    }).join('');
    box.querySelectorAll('.dev-del').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await fetch(SRV + '?push_remove', { method: 'POST', body: JSON.stringify({ id: b.dataset.id }) }); } catch {}
      loadDeviceList();
    }));
  } catch { box.innerHTML = `<div class="set-note">помилка</div>`; }
}
(function(){
  const sw = $('sp-sw'), stat = $('sp-stat');
  if (!sw) return;
  let on = localStorage.getItem('spush_on') === '1';
  const reflect = () => { sw.checked = on; };
  reflect();
  sw.addEventListener('change', async () => {
    stat.textContent = '…';
    if (sw.checked){
      const s = await spushReg();            /* leaves a diagnostic in sp-stat */
      if (s){ on = true; localStorage.setItem('spush_on', '1'); toast('серверний пуш увімкнено ✓'); }
      reflect();                             /* if reg failed, on stays false → switch flips back */
    } else {
      await spushUnreg();
      on = false; localStorage.setItem('spush_on', '0'); toast('серверний пуш вимкнено');
      stat.textContent = 'вимкнено'; reflect();
    }
  });
  async function runPushTest(url){
    const res = $('sp-test-res'); res.textContent = '…';
    try {
      const r = await fjson(SRV + url);
      if (!r.subs){ res.textContent = '0 підписок — спершу натисни Увімк'; return; }
      const ok = r.sent.some(s => s.code >= 200 && s.code < 300);
      const bad = r.sent.filter(s => !(s.code >= 200 && s.code < 300)).map(s => s.code);
      res.textContent = `підписок: ${r.subs} · ${r.sent.length} пуш${ok ? ' ✓ прийнято' : ''}${bad.length ? ' · ✗ ' + bad.join(',') : ''}`;
    } catch { res.textContent = 'помилка запиту'; }
  }
  $('sp-test')?.addEventListener('click', () => runPushTest('?push_test'));
  $('sp-testall')?.addEventListener('click', () => runPushTest('?push_testall'));
  $('sp-refresh')?.addEventListener('click', loadDeviceList);
})();

/* Live pin: foreground refresh here + server pushes the same tag each POST for
 * background updates (needs the server-push subscription). */
(function(){
  const sw = $('lp-sw'), stat = $('lp-stat');
  if (!sw) return;
  let on = localStorage.getItem('live_pin') === '1';
  const reflect = () => { sw.checked = on; };
  reflect();
  sw.addEventListener('change', async () => {
    if (sw.checked){
      stat.textContent = '…';
      if (!('Notification' in window)){ stat.textContent = 'браузер не підтримує'; on = false; reflect(); return; }
      if (Notification.permission !== 'granted') await Notification.requestPermission();
      if (Notification.permission !== 'granted'){ stat.textContent = 'дозвіл відхилено'; on = false; reflect(); return; }
      on = true; localStorage.setItem('live_pin', '1'); reflect();
      const sub = await spushReg();        /* subscribe + push livePin cfg for background */
      updateLivePin();                     /* show immediately (foreground) */
      stat.textContent = sub ? '✓ закріплено · фон через пуш' : '✓ foreground; увімкни Серверний пуш для фону';
    } else {
      on = false; localStorage.setItem('live_pin', '0'); reflect();
      await spushSyncCfg();                /* stop server pin pushes */
      updateLivePin();                     /* close the pin */
      stat.textContent = 'вимкнено';
    }
  });
})();

/* (Settings cache-stats / device-list and Status net-log refreshes are now driven
 * from switchToTab's deferred heavy() — running them synchronously on click used to
 * jank the slide animation.) */
/* Defer initial stats call until full script parse completes (IndexedDB block
 * is defined later — without setTimeout we'd hit a TDZ on _db).
 * Also run one-time purge of bad-key entries from v1 of cache (string keys). */
setTimeout(async () => {
  const purged = await dbPurgeBadKeys();
  if (purged) console.log(`cache: purged ${purged} legacy string-key entries`);
  const aggOnly = await dbPurgeAggregateOnly();
  if (aggOnly) console.log(`cache: purged ${aggOnly} aggregate-only entries (no raw sp[]/va[]) — will re-sync with sub-points`);
  updateCacheStats();
}, 0);

$('wipe-btn').addEventListener('click', async () => {
  if (!(await uiConfirm('Видалити всі дані на сервері?'))) return;
  $('wipe-stat').textContent = '…';
  try { await fetch(SRV + '?wipe_log=1&key=' + CALIB_KEY + '&t=' + Date.now()); $('wipe-stat').textContent='✓'; $('wipe-stat').className='stat ok'; toast('wiped'); }
  catch (e){ $('wipe-stat').textContent='err'; $('wipe-stat').className='stat err'; }
});

/* Smoothing — single global setting, mirrored on two selectors:
 *   #smooth-sel       on History tab
 *   #smooth-sel-live  on Live tab (Швидкість за останню годину)
 * Change in either → sync both, persist, redraw both charts. */
function syncSmoothSelectors(srcId){
  const src = $(srcId); if (!src) return;
  const val = src.value;
  const isMean = src.options[src.selectedIndex]?.dataset.mean === '1';
  const key = val + (isMean ? '|m' : '');
  localStorage.setItem('smooth_win', key);
  for (const id of ['smooth-sel', 'smooth-sel-live']){
    if (id === srcId) continue;
    const t = $(id); if (!t) continue;
    for (const o of t.options){
      if (o.value === val && (!!o.dataset.mean === isMean)){ o.selected = true; break; }
    }
  }
  if (history?.length) drawHistoryCharts();
  drawLiveTimeline();
}
document.addEventListener('change', e => {
  if (e.target?.id === 'smooth-sel' || e.target?.id === 'smooth-sel-live'){
    syncSmoothSelectors(e.target.id);
  }
});
/* Restore preference into both selectors at startup */
(() => {
  const s = localStorage.getItem('smooth_win');
  if (!s) return;
  const [v, m] = s.split('|');
  for (const id of ['smooth-sel', 'smooth-sel-live']){
    const sel = $(id); if (!sel) continue;
    for (const o of sel.options){
      if (o.value === v && (!!o.dataset.mean === !!m)){ o.selected = true; break; }
    }
  }
})();

$('calib-reset-default').addEventListener('click', () => {
  setCalib({ ...DEFAULT_CALIB });
  renderCalibReadonly();
  const stat = $('calib-stat');
  stat.textContent = t('calib_reset_done'); stat.className = 'stat ok';
  toast('✓ ' + t('calib_reset_done'));
});
$('calib-push').addEventListener('click', pushCalibToServer);
$('calib-pull').addEventListener('click', pullCalibFromServer);

