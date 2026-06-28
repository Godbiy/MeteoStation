/* =========== BOOT =========== */
applyI18n();
updateTabBadges();   /* reflect calib-incomplete / settings-attention on load, before first poll */

/* Bind viewport-zoom on time-axis charts (shared chartView) */
['chart-speed','chart-wt','chart-dir','chart-batt','chart-signal','chart-solar','chart-uptime'].forEach(id => {
  const svg = $(id); if (svg) bindChartZoom(svg, id);
});

/* Live timeline gets its own viewport (`liveView`) — independent from history. */
bindLiveChartZoom($('chart-live-wt'));

/* Tap/hover a point → exact reading + date. */
['chart-live-wt','chart-wt','chart-speed','chart-batt','chart-signal','chart-solar'].forEach(id => {
  const svg = $(id); if (svg) attachChartTooltip(svg);
});

/* Reset zoom button (floating) */
$('zoom-reset-all').addEventListener('click', () => { chartView = null; drawHistoryCharts(); });

/* When user changes range — reset zoom (else stale viewport) */
document.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { chartView = null; }));

/* Custom date-range picker (from..to). Fetches 30d and clamps via chartView. */
$('r-apply').addEventListener('click', async () => {
  const fromV = $('r-from').value, toV = $('r-to').value;
  if (!fromV || !toV){ toast(t('pick_both_dates'), true); return; }
  const fromTs = new Date(fromV + 'T00:00:00').getTime();
  const toTs   = new Date(toV   + 'T23:59:59').getTime();
  if (toTs <= fromTs){ toast(t('end_after_start'), true); return; }
  /* Pick smallest preset that covers the span */
  const spanH = (toTs - fromTs) / 3600000;
  const preset = spanH <= 1 ? '1h' : spanH <= 6 ? '6h' : spanH <= 24 ? '24h' : spanH <= 168 ? '7d' : '30d';
  currentRange = preset;
  document.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('active', b.dataset.range === preset));
  await renderHistory();
  chartView = { start: fromTs, end: toTs };
  drawHistoryCharts();
});
/* date presets: today / yesterday / last 7 days */
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
  const iso = d => d.toISOString().slice(0,10);
  const now = new Date();
  let from, to;
  if (b.dataset.preset === 'today'){ from = to = iso(now); }
  else if (b.dataset.preset === 'yesterday'){ const y = new Date(now); y.setDate(y.getDate()-1); from = to = iso(y); }
  else { const s = new Date(now); s.setDate(s.getDate()-6); from = iso(s); to = iso(now); }
  $('r-from').value = from; $('r-to').value = to;
  $('r-apply').click();
}));
/* ⋯ toggles the advanced filter panel (secondary ranges + custom dates) */
$('range-more-btn').addEventListener('click', () => {
  const more = $('range-more');
  more.hidden = !more.hidden;
  $('range-more-btn').classList.toggle('active', !more.hidden);
});

renderLive();
startPoll();
seedBattLog();   /* bootstrap the battery-trend buffer for the honest charge badge */

/* Variant-B fallback: keep the host-side push watchdog (?daemon) alive while this
 * dashboard is open, so silence / live-pin pushes fire even with no external cron.
 * The server-side {ts,nonce} lock makes ?daemon a singleton, so re-kicking is free.
 * Only spun up for users who actually granted notifications. */
(function kickWatchdog(){
  if (('Notification' in window) && Notification.permission === 'granted')
    fetch(SRV + '?daemon=1', { cache: 'no-store' }).catch(() => {});
  setTimeout(kickWatchdog, 240000);   /* re-seed every 4 min in case the baton dropped */
})();

/* ===== Remember tab + scroll across reloads (don't dump back to Live) ===== */
(function(){
  const NAV_KEY = 'nav_state';
  function saveNav(){
    try {
      const tab = document.querySelector('.tab.active')?.dataset.page || 'live';
      localStorage.setItem(NAV_KEY, JSON.stringify({ tab, scroll: Math.round(window.scrollY) }));
    } catch {}
  }
  addEventListener('pagehide', saveNav);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNav(); });
  let _navT; addEventListener('scroll', () => { clearTimeout(_navT); _navT = setTimeout(saveNav, 400); }, { passive: true });

  let st; try { st = JSON.parse(localStorage.getItem(NAV_KEY) || 'null'); } catch {}
  if (!st) return;
  if (st.tab && st.tab !== 'live' && typeof switchToTab === 'function') switchToTab(st.tab);
  if (st.scroll > 0){
    /* content (charts) renders over a few hundred ms → re-apply until the height settles */
    let tries = 0;
    const restore = () => {
      window.scrollTo(0, st.scroll);
      if (++tries < 10 && Math.abs(window.scrollY - st.scroll) > 4) setTimeout(restore, 120);
    };
    setTimeout(restore, 150);
  }
})();
