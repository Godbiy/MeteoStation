/* Service worker — stale-while-revalidate app shell, cache fallback offline.
 * Served by Meteo\Ui::handlePwaSw, which replaces __SW_CACHE__ with meteo-<dashboard mtime>. */
const C = '__SW_CACHE__';
self.addEventListener('install', e => {
  self.skipWaiting();
  /* PRE-CACHE the dashboard shell on install, so the app opens OFFLINE even on a cold
   * start / first run (the old network-first only cached after a successful online load
   * while the SW already controlled the page → often nothing cached → bare "offline"). */
  e.waitUntil(caches.open(C).then(c => fetch('?ui=1', { cache: 'reload' })
    .then(r => { if (r && r.ok) return c.put('shell', r.clone()); })
    .catch(() => {})));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k)));   /* drop old shells */
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request;
  let url; try { url = new URL(req.url); } catch (_) { return; }
  const isShell = req.mode === 'navigate' || url.searchParams.has('ui');
  if (!isShell) return;   /* data endpoints (history etc.) pass through; app falls back to IndexedDB offline */
  /* stale-while-revalidate: serve the cached shell INSTANTLY (works offline), refresh in bg. */
  e.respondWith((async () => {
    const c = await caches.open(C);
    const cached = await c.match('shell');
    const net = fetch(req).then(r => { if (r && r.ok) c.put('shell', r.clone()); return r; }).catch(() => null);
    return cached || (await net) || new Response(
      '<!doctype html><meta charset=utf-8><body style="font:16px sans-serif;background:#0d1117;color:#e6edf3;padding:24px">'
      + '\u{1F4E1} Офлайн, а кеш ще порожній.<br>Відкрий застосунок раз з інтернетом — далі працюватиме й офлайн.</body>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  })());
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: 'MeteoStation', body: e.data ? e.data.text() : '' }; }
  const opts = {
    body: d.body || '', icon: d.icon || '?icon=1', badge: '?push_icon=app&badge=1', tag: d.tag || 'meteo', renotify: true,
    actions: [{ action: 'open', title: 'Відкрити' }],
    data: { url: '?ui=1' }
  };
  if (d.image) opts.image = d.image;
  if (d.pin) { opts.silent = true; opts.renotify = false; opts.requireInteraction = true; }  /* live pin: update in place, no re-alert */
  e.waitUntil(self.registration.showNotification(d.title || 'MeteoStation', opts));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL('?ui=1', self.location.href).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) { if (c.url.includes('ui=')) { try { return await c.focus(); } catch (_) {} } }
    if (cs.length) { try { await cs[0].focus(); if ('navigate' in cs[0]) return await cs[0].navigate(url); } catch (_) {} }
    return self.clients.openWindow(url);
  })());
});
