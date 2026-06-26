/* =========== TABS =========== */
const TAB_ORDER = [...document.querySelectorAll('.tab')].map(t => t.dataset.page);
const tabIndex = p => TAB_ORDER.indexOf(p);
/* Moving accent underline under the tab bar (follows swipes + slides on click). */
const tabInd = document.getElementById('tab-ind');
function tabBox(page){ const t = document.querySelector(`.tab[data-page="${page}"]`); return t ? { l: t.offsetLeft, w: t.offsetWidth } : { l: 0, w: 0 }; }
function setInd(l, w, anim){ if (!tabInd) return; tabInd.style.transition = anim ? 'transform .2s ease' : 'none'; tabInd.style.transform = `translateX(${l}px) scaleX(${w / 100})`; }
function indToActive(anim){
  const a = document.querySelector('.tab.active'); if (!a) return;
  if (tabInd){ const tc = getComputedStyle(a).getPropertyValue('--tc').trim(); if (tc) tabInd.style.background = tc; }   /* underline = active tab's signature colour */
  setInd(a.offsetLeft, a.offsetWidth, anim);
}
addEventListener('load', () => indToActive(false));
requestAnimationFrame(() => indToActive(false));
/* Synchronous, network-FREE render of a page using whatever data we already hold — fills
 * a page BEFORE it animates in (and pre-renders a swipe neighbour) so nothing pops in late. */
function renderPageSync(page){
  clearChartDims();
  if (page === 'history') drawHistoryCharts();
  else if (page === 'live') drawLiveTimeline();
  else if (page === 'status') renderStatus();
  else if (page === 'calib'){ renderCalibReadonly(); capRenderGrid(); }
}
/* Fresh-data fetch + off-tab side-effects — run AFTER the transition so they don't jank it. */
function asyncUpdate(page){
  if (page === 'history') renderHistory();               /* fetch newest + redraw */
  if (page === 'calib') capSetSource(capSrc); else capStopGsm();
  if (page === 'status') renderNetLog();
  if (page === 'settings'){ updateCacheStats(); loadDeviceList(); }
}
function switchToTab(page, anim, prerendered){
  const t = document.querySelector(`.tab[data-page="${page}"]`);
  if (!t || t.classList.contains('active')) return;
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active', 'slide-r', 'slide-l', 'no-in'));
  t.classList.add('active');
  const np = $('page-' + page);
  /* Swipe already slid the page fully into place — adding .active would re-fire pageIn
   * (opacity 0→1 = blink, translateY 5px = jerk down). Suppress it for the swipe path. */
  if (prerendered) np.classList.add('no-in');
  np.classList.add('active');
  /* Fill the page with CURRENT data BEFORE the animation → no black flash, no late pop-in.
   * (Swipe pre-renders the neighbour at gesture start, so it passes prerendered=true.) */
  if (!prerendered) renderPageSync(page);
  if (anim === 'r') np.classList.add('slide-r');
  else if (anim === 'l') np.classList.add('slide-l');
  indToActive(true);
  scrollTo(0, 0);
  /* the fresh fetch happens after the slide so it can't jank it */
  let done = false;
  const run = () => { if (done) return; done = true; np.removeEventListener('animationend', run); asyncUpdate(page); };
  np.addEventListener('animationend', run, { once: true });
  setTimeout(run, 260);
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  const cur = document.querySelector('.tab.active')?.dataset.page;
  if (t.dataset.page !== cur) haptic(10);
  if (t.dataset.page === 'history'){ histSeenTs = lastConfig?.last_timestamp || histSeenTs; setTabBadge('history', false); }
  switchToTab(t.dataset.page, tabIndex(t.dataset.page) > tabIndex(cur) ? 'r' : 'l');
}));
let histSeenTs = null, _prevPostTs = null, _wasOffline = false;   /* History-seen marker + fresh-post + connectivity tracking */
/* fresh-POST cues (shared by real polling + test mode): ring the live card and dot the
 * History tab when last_timestamp advances to a value we haven't shown yet. */
function onFreshPost(postTs){
  if (!postTs || postTs === _prevPostTs) return;
  if (_prevPostTs){
    const active = document.querySelector('.tab.active')?.dataset.page;
    if (active === 'live') flashNew(document.querySelector('#page-live .live-top'));
    if (active !== 'history' && postTs !== histSeenTs) setTabBadge('history', true, 'var(--accent)');
  }
  _prevPostTs = postTs;
}
/* haptic feedback on any toggle switch flip (delegated, touch devices only) */
document.addEventListener('change', e => { if (e.target?.closest?.('.switch')) haptic(12); });

/* Swipeable pager: the page follows your finger and the neighbour slides in;
 * on release it completes past ~28% else snaps back. Ignores swipes that start
 * on charts (they pan/zoom), the tab bar or form controls, and vertical scrolls. */
(function(){
  let d = null;
  const eligible = el => !el.closest('.chart-wrap, .tabs, input, select, textarea');
  addEventListener('touchstart', e => {
    d = null;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const edge = t.clientX < 26 || t.clientX > innerWidth - 26;   /* edge swipe pages even over charts */
    if (!edge && !eligible(e.target)) return;
    d = { sx: t.clientX, sy: t.clientY, eng: false, active: document.querySelector('.page.active') };
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!d) return;
    const t = e.touches[0], dx = t.clientX - d.sx, dy = t.clientY - d.sy;
    if (!d.eng){
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)){ d = null; return; }   /* vertical scroll */
      if (Math.abs(dx) < 12) return;
      const ni = tabIndex(d.active.id.replace('page-', '')) + (dx < 0 ? 1 : -1);
      if (ni < 0 || ni >= TAB_ORDER.length){ d = null; return; }                   /* no neighbour */
      const nb = $('page-' + TAB_ORDER[ni]);
      const r = d.active.getBoundingClientRect();
      d.w = r.width || innerWidth; d.dir = dx < 0 ? 1 : -1; d.nb = nb;
      d.fromBox = tabBox(d.active.id.replace('page-', '')); d.toBox = tabBox(TAB_ORDER[ni]);
      /* Overlay the neighbour EXACTLY on the current page's box (same top/left/width) so it
       * slides in pixel-aligned — using a computed header/tab offset instead drifted the new
       * page DOWN. Height covers from there to the viewport bottom; overflow clips the rest. */
      Object.assign(nb.style, { position: 'fixed', top: r.top + 'px', left: r.left + 'px', width: d.w + 'px',
        height: Math.max(r.height, innerHeight - Math.max(0, r.top)) + 'px', overflow: 'hidden', zIndex: '30', background: 'var(--bg)', display: 'block', margin: '0', willChange: 'transform' });
      d.active.style.willChange = 'transform';
      d.eng = true;
      /* pre-render the neighbour (still off-screen) with current data so it slides in
       * already full — no black flash / cards popping in after release. */
      _forceCharts = true; renderPageSync(TAB_ORDER[ni]); _forceCharts = false;
    }
    e.preventDefault();
    const off = d.dir > 0 ? Math.max(-d.w, Math.min(0, dx)) : Math.min(d.w, Math.max(0, dx));
    d.cur = off;
    d.active.style.transform = `translateX(${off}px)`;
    d.nb.style.transform = `translateX(${d.dir > 0 ? d.w + off : -d.w + off}px)`;
    const pp = Math.min(1, Math.abs(off) / d.w);              /* indicator follows the swipe */
    setInd(d.fromBox.l + (d.toBox.l - d.fromBox.l) * pp, d.fromBox.w + (d.toBox.w - d.fromBox.w) * pp, false);
  }, { passive: false });
  addEventListener('touchend', () => {
    if (!d){ return; }
    if (!d.eng){ d = null; return; }
    const a = d.active, n = d.nb, dir = d.dir, w = d.w, past = Math.abs(d.cur || 0) > w * 0.28;
    setInd((past ? d.toBox : d.fromBox).l, (past ? d.toBox : d.fromBox).w, true);   /* settle the underline */
    a.style.transition = n.style.transition = 'transform .2s ease-out';
    a.style.transform = `translateX(${past ? (dir > 0 ? -w : w) : 0}px)`;
    n.style.transform = `translateX(${past ? 0 : (dir > 0 ? w : -w)}px)`;
    const target = past ? n.id.replace('page-', '') : null;
    d = null;
    setTimeout(() => {
      ['transform', 'transition', 'willChange'].forEach(p => a.style[p] = '');
      ['position', 'top', 'left', 'width', 'height', 'overflow', 'zIndex', 'background', 'display', 'margin', 'transform', 'transition', 'willChange'].forEach(p => n.style[p] = '');
      if (target) switchToTab(target, null, true);   /* neighbour already rendered at engage */
    }, 210);
  }, { passive: true });
})();

/* Charts use a pixel-width viewBox → re-render on resize so they refill width. */
let _resizeT;
window.addEventListener('resize', () => {
  clearTimeout(_resizeT);
  _resizeT = setTimeout(() => { clearChartDims(); drawLiveTimeline(); if (history.length) drawHistoryCharts(); indToActive(false); }, 180);
});

