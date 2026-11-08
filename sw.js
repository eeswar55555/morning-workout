/* Service worker: makes the app work offline.
 * Strategy: serve from the cache instantly, and quietly refresh the cache in the background,
 * so edits you publish (e.g. a changed exercises.js) show up the next time you open the app. */
const CACHE = 'morning-workout-v2';
const FILES = ['./', 'index.html', 'app.css', 'figure.css', 'figure.js', 'exercises.js', 'routine.js', 'core.js', 'app.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});
