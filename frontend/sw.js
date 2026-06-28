/* Service worker — precache the app shell + its split assets so the dashboard works OFFLINE.
 * Served by Meteo\Ui::handlePwaSw, which replaces __SW_CACHE__ with meteo-<dashboard mtime>
 * (so a deploy bumps the cache name → old cache dropped, new shell+assets re-fetched). */
const C = '__SW_CACHE__';
const ASSETS = ['?asset=dashboard.css', '?asset=dashboard.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  /* Precache the shell (?ui=1) AND the css/js it pulls — else offline = HTML loads but
   * ?asset=* 404 → blank screen. Tolerate individual failures (don't fail the whole install). */
  e.waitUntil(caches.open(C).then(async c => {
    try { const r = await fetch('?ui=1', { cache: 'reload' }); if (r && r.ok) await c.put('shell', r.clone()); } catch (_) {}
    for (const a of ASSETS) { try { const r = await fetch(a, { cache: 'reload' }); if (r && r.ok) await c.put(a, r.clone()); } catch (_) {} }
  }));
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
  const isAsset = url.searchParams.has('asset');
  if (!isShell && !isAsset) return;   /* data endpoints pass through; app falls back to IndexedDB offline */
  const key = isShell ? 'shell' : ('?asset=' + url.searchParams.get('asset'));
  /* network-FIRST: always try the live server so a deploy shows up on the very next
   * open (the old stale-while-revalidate served cache first → changes lagged a launch).
   * Cache is refreshed on every success and used only as the offline fallback. */
  e.respondWith((async () => {
    const c = await caches.open(C);
    try {
      const net = await fetch(req, { cache: 'reload' });
      if (net && net.ok) { c.put(key, net.clone()); return net; }
      throw new Error('bad status ' + (net && net.status));
    } catch (_) {
      const cached = await c.match(key);
      return cached || (isShell ? new Response(
        '<!doctype html><meta charset=utf-8><body style="font:16px sans-serif;background:#0d1117;color:#e6edf3;padding:24px">'
        + '\u{1F4E1} Offline, and the cache is still empty.<br>Open the app once with internet — after that it works offline too.</body>',
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }) : Response.error());
    }
  })());
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: 'MeteoStation', body: e.data ? e.data.text() : '' }; }
  const opts = {
    body: d.body || '', icon: d.icon || '?icon=1', badge: '?push_icon=app&badge=1', tag: d.tag || 'meteo', renotify: true,
    actions: [{ action: 'open', title: 'Open' }],
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
