/* =========== POLLING =========== */
async function poll(){
  if (testMode) return;
  try {
    lastConfig = await fjson(SRV + '?config=1&t=' + Date.now());
    renderConfig();
    if (lastConfig.live){
      const live = await fjson(SRV + '?live_now=1&t=' + Date.now());
      if (live.ok) lastSnapshot = live;
    } else {
      /* fetch latest few entries from main log (a few so we can fall back to the
       * last VALID csq/solar — the newest regular post often reports csq=99). */
      try {
        const tail = await fjson(SRV + '?limit=6&t=' + Date.now());
        if (Array.isArray(tail) && tail.length){
          const e = tail[tail.length - 1];
          const ts = typeof e.timestamp === 'string' ? parseServerTs(e.timestamp) : Date.now();
          let csq = null, solar = null;
          for (let i = tail.length - 1; i >= 0; i--){
            if (csq == null && tail[i].csq >= 1 && tail[i].csq <= 31) csq = tail[i].csq;
            if (solar == null && tail[i].solar_mv != null) solar = tail[i].solar_mv;
          }
          lastSnapshot = {
            vane: e.vane_mode != null ? Math.pow(2, e.vane_mode) ^ 0xFF : 0,
            pulses_sec: (e.speed_mean ?? 0) / 2,  /* approx — main mode reports 2s avg */
            batt_mv: e.batt_mv, csq: csq ?? e.csq, solar_mv: solar ?? e.solar_mv,
            cycle: e.cycle, timestamp: e.timestamp, age_sec: Math.floor((Date.now() - ts) / 1000),
          };
        }
      } catch {}
    }
    renderLive();
    checkPending();
    onFreshPost(lastConfig?.last_timestamp);   /* ring the live card + dot History on a new post */
    if (_wasOffline){ _wasOffline = false; $('dot').className = 'dot ' + (lastConfig?.live ? 'live' : 'on'); toast(t('back_online'), 'info'); }
    if (document.querySelector('.tab.active')?.dataset.page === 'status') renderStatus();
    /* Auto-refresh History if visible and there's new data since last fetch */
    if (document.querySelector('.tab.active')?.dataset.page === 'history'){
      const newest = lastConfig?.last_timestamp;
      if (newest && newest !== lastSeenHistTs){
        /* Advance the marker only after a successful render — if the sync fails
         * (transient network, empty re-seed) the next poll retries instead of
         * waiting for a brand-new post to change last_timestamp. */
        try { await renderHistory(); lastSeenHistTs = newest; }
        catch { /* keep lastSeenHistTs so we retry next poll */ }
      }
    }
  } catch (e){
    $('hdr-stat').textContent = 'offline (' + e.message + ')';
    $('dot').className = 'dot warn';
    if (!_wasOffline){ _wasOffline = true; toast(t('went_offline'), 'warn'); }
  }
}
/* Live countdown 1s tick for status tab + repaint tab colours so they track the
 * cycle phase every second (not just on each data poll). */
setInterval(() => {
  if (lastConfig) updateTabDots();
  if (document.querySelector('.tab.active')?.dataset.page === 'status') renderStatus();
}, 1000);
let pollMs = 5000;
function pollInterval(){ return LITE ? 60000 : (lastConfig?.live ? 2000 : 8000); }
function startPoll(){
  stopPoll();
  poll();
  pollMs = pollInterval();
  pollTimer = setInterval(() => {
    poll();
    /* Re-arm if live state or lite mode changed the desired cadence */
    const want = pollInterval();
    if (want !== pollMs){ startPoll(); }
  }, pollMs);
}
function stopPoll(){ if (pollTimer){ clearInterval(pollTimer); pollTimer = null; } }

/* =========== TEST MODE =========== */
let tickIdx = 0, mockLastPost = null;
const MOCK_CYCLE = 24;   /* short cycle so the Status state machine visibly advances during a demo */
function mockTick(){
  tickIdx++;
  const t = tickIdx;
  /* sinusoidal speed 0-25 km/h with gusts */
  const baseSpd = 8 + 6 * Math.sin(t / 12) + 3 * Math.sin(t / 3.5);
  const gust = (Math.random() < 0.1 ? Math.random() * 15 : 0);
  const kmh = Math.max(0, baseSpd + gust);
  const pps = kmh / 2.4;
  /* drifting direction */
  const dir = (3 + 2 * Math.sin(t / 20) + Math.random() * 0.7) % 8;
  const dirIdx = Math.floor(dir);
  const vane = 0xFF ^ (1 << dirIdx);
  const batt = 4100 - Math.floor(t * 0.5) + Math.floor(Math.random() * 30 - 15);
  const csq = 25 + Math.floor(Math.random() * 5);
  /* virtual cycle clock: last_timestamp stays put between simulated POSTs so the
   * Status countdown/progress/state-machine advance, then "post" every MOCK_CYCLE. */
  const nowMs = Date.now();
  if (mockLastPost == null) mockLastPost = nowMs;
  let since = (nowMs - mockLastPost) / 1000;
  if (since >= MOCK_CYCLE){ mockLastPost = nowMs; since = 0; }
  lastSnapshot = {
    vane, dir: dirIdx, pulses_sec: pps, batt_mv: batt, csq,
    solar_mv: Math.max(0, Math.round(5500 * Math.sin(t / 40))),   /* day/night-ish for the solar UI */
    timestamp: mockServerTs(nowMs), age_sec: Math.floor(since),
  };
  lastConfig = {
    samples: 12, avg: 1, samples_max: 450, live: 0,
    cycle_seconds: MOCK_CYCLE, intended_cycle_seconds: MOCK_CYCLE,   /* keep intended==observed so no false mismatch */
    last_timestamp: mockServerTs(mockLastPost),
  };
  renderLive(); renderConfig();
  onFreshPost(lastConfig.last_timestamp);   /* fire flash + History badge on each simulated POST */
  if (document.querySelector('.tab.active')?.dataset.page === 'status') renderStatus();
}
function genMockHistory(range){
  const map = { '1h': [60, 60], '6h': [360, 60], '24h': [1440, 120], '7d': [10080, 600], '30d': [43200, 1800] };
  const [minutes, stepSec] = map[range] || [60, 60];
  const now = Date.now();
  const out = [];
  for (let i = 0; i < minutes * 60 / stepSec; i++){
    const ts = now - (minutes * 60 - i * stepSec) * 1000;
    const tt = i / 20;
    const speed = Math.max(0, 6 + 4 * Math.sin(tt) + 2 * Math.sin(tt * 3) + Math.random() * 3);
    out.push({
      timestamp: new Date(ts).toISOString().replace('T',' ').slice(0,19),
      speed_mean: +speed.toFixed(1),
      speed_max:  +(speed + Math.random() * 4).toFixed(1),
      batt_mv: 4100 - Math.floor(i * 0.4),
      csq: 22 + Math.floor(Math.random() * 6),
      vane_mode: Math.floor(((3 + 2 * Math.sin(tt / 2)) + Math.random() * 0.8) % 8),
    });
  }
  return out;
}

$('test-toggle').addEventListener('click', () => {
  testMode = !testMode;
  $('test-banner').classList.toggle('on', testMode);
  $('test-toggle').classList.toggle('active', testMode);
  $('test-toggle').textContent = testMode ? '🧪 Test ON' : '🧪 Test';
  { const t2 = $('test-toggle-2'); if (t2) t2.checked = testMode; }   /* settings switch reflects the on/off state */
  if (testMode){
    stopPoll();
    tickIdx = 0; mockLastPost = null;
    /* Pre-fill speedHistory with realistic past timestamps so live timeline
     * shows real curve, not 60 points stacked at "now". */
    const now = Date.now();
    speedHistory = [];
    for (let i = 0; i < 60; i++){
      const ti = i;
      const baseSpd = 8 + 6 * Math.sin(ti / 12) + 3 * Math.sin(ti / 3.5);
      const gust = (Math.random() < 0.1 ? Math.random() * 15 : 0);
      const kmh = Math.max(0, baseSpd + gust);
      const dir = Math.floor((3 + 2 * Math.sin(ti / 20) + Math.random() * 0.7) % 8);
      speedHistory.push({ t: now - (60 - i) * 60000, kmh, dir });
    }
    tickIdx = 60;
    mockTick();
    testTimer = setInterval(mockTick, 2000);
    if (document.querySelector('.tab.active').dataset.page === 'history') renderHistory();
    toast('Test mode ON');
  } else {
    if (testTimer){ clearInterval(testTimer); testTimer = null; }
    speedHistory = [];
    lastSnapshot = null;
    lastConfig = null;
    renderLive();
    startPoll();
    toast('Test mode OFF');
  }
});

