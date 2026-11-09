/* Service worker: offline support without ever serving a mix of old and new files.
 * Online  -> always fetch the latest file (bypassing the browser's HTTP cache) and refresh the offline copy.
 * Offline / slow network (> 4 s) -> use the saved copy. */
const CACHE = 'morning-workout-v8';
const FILES = ['./', 'index.html', 'app.css', 'figure.css', 'figure.js', 'animations.js', 'illus.js', 'face.js', 'catalog.js', 'core.js', 'studio.js', 'app.js', 'data/index.json',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

// The content packs listed in data/index.json are cached too, so adding a pack to the index is all it takes to work offline.
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' })));
    try {
      const idx = await (await fetch('data/index.json', { cache: 'reload' })).json();
      await cache.addAll((idx.files || []).map(f => new Request('data/' + f, { cache: 'reload' })));
    } catch (err) { /* the app still caches each pack the first time it loads it */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await Promise.race([
        fetch(req, { cache: 'no-cache' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))
      ]);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const saved = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
      if (saved) return saved;
      throw err;
    }
  })());
});
