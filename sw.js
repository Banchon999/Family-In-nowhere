// แคชไฟล์เกมไว้เล่นออฟไลน์
const CACHE = 'fin-v1';
const FILES = [
  './', './index.html', './css/style.css', './manifest.json', './icon-192.png', './icon-512.png',
  './js/data.js', './js/util.js', './js/world.js', './js/path.js', './js/pawn.js', './js/creatures.js',
  './js/events.js', './js/sprites.js', './js/render.js', './js/input.js', './js/ui.js', './js/save.js', './js/main.js',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// ใช้ไฟล์ใหม่จากเน็ตก่อน ถ้าออฟไลน์ใช้จากแคช
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
