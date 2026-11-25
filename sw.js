/* MP4 Dönüştürücü — Service Worker (uygulama kabuğu önbelleği) */
const CACHE = 'mp4-donusturucu-v13';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'worker.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // FFmpeg CDN isteklerini önbelleğe alma (büyük dosyalar)
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('unpkg.com')) return;

  // Sayfa gezintileri: önce ağ, yoksa önbellek
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }
  // Diğer varlıklar: önce önbellek
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request))
  );
});
