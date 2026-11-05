/* Service worker: барномаро баъд аз боргирии аввал бе интернет ҳам мекушояд.
   Version-ро ҳангоми нав кардани файлҳо тағйир диҳед, то кэши кӯҳна тоза шавад. */
const VERSION = 'studio-rasm-v162';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

/* Safari ҷавоби «redirected»-ро аз service worker рад мекунад (Response served by service worker has redirections).
   Бинобар ин ҳамеша нусхаи тозаи бе redirect медиҳем. */
const clean = async (r) => {
  if (!r || !r.redirected) return r;
  const b = await r.blob();
  return new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers });
};

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(ASSETS.map((a) =>
        fetch(a, { cache: 'reload' }).then(clean).then((r) => (r && r.ok ? c.put(a, r) : null)).catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Аввал шабака (бо мӯҳлат), агар набошад кэш. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const same = new URL(req.url).origin === location.origin;
  const tmo = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), same ? 3500 : 6000));
  const fromCache = async () => {
    let m = await caches.match(req, { ignoreSearch: true });
    if (!m && req.mode === 'navigate') m = (await caches.match('index.html')) || (await caches.match('./'));
    return m ? clean(m) : Response.error();
  };
  e.respondWith(
    Promise.race([fetch(req), tmo])
      .then(async (res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = await clean(res.clone());
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res.redirected ? clean(res) : res;
      })
      .catch(fromCache)
  );
});
