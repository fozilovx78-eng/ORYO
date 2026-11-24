/* Service worker: барномаро баъд аз боргирии аввал бе интернет ҳам мекушояд.
   Version-ро ҳангоми нав кардани файлҳо тағйир диҳед, то кэши кӯҳна тоза шавад.
   ВАЖНО: рақами версия бояд бо APP_V дар index.html баробар бошад. */
const VERSION = 'studio-rasm-v1154';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

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
      ).concat([
        /* PDF китобхона: пешакӣ нигоҳ медорем, то содироти PDF бе интернет ҳам кор кунад.
           Аввал бо CORS (ҷавоби возеҳ, квотаро зиёд сарф намекунад); агар нашуд, no-cors. */
        fetch(JSPDF).then((r) => (r && r.ok ? c.put(JSPDF, r) : null))
          .catch(() => fetch(JSPDF, { mode: 'no-cors' }).then((r) => (r ? c.put(JSPDF, r) : null)).catch(() => {}))
      ])))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((cs) => cs.forEach((c) => c.postMessage({ v: VERSION })))
  );
});

/* Аввал кэш (кушодан фавран, ҳатто бо интернети суст), дар паси парда нусхаи нав мегирад.
   Агар кэш набошад, аз шабака (бо мӯҳлат). Версияи нав бо овардани баннер тавсия мешавад. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  /* Санҷиши версия (?_=) ҳамеша аз шабака, на аз кэш */
  if (/[?&]_=/.test(req.url)) return;
  /* Дархостҳои Range (аудио/видео) ба кэш намераванд: ҷавоби 206 нигоҳ дошта намешавад */
  if (req.headers.has('range')) return;
  const same = new URL(req.url).origin === location.origin;
  const store = async (res) => {
    /* Танҳо ҷавобҳои пурраи 200 ё opaque; 206 ва хатогиҳоро нигоҳ намедорем */
    if (res && ((res.ok && res.status === 200) || res.type === 'opaque')) {
      const copy = await clean(res.clone());
      caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  };
  const net = () => fetch(req).then(store);
  const getCached = async () => {
    /* Танҳо дар кэши версияи ҷорӣ ҷустуҷӯ мекунем, на дар кэшҳои кӯҳна */
    const c = await caches.open(VERSION);
    let m = await c.match(req, { ignoreSearch: true });
    if (!m && req.mode === 'navigate') m = (await c.match('index.html')) || (await c.match('./'));
    return m;
  };
  e.respondWith((async () => {
    const m = await getCached();
    if (m) {
      e.waitUntil(net().catch(() => {}));
      return clean(m);
    }
    let tid;
    const tmo = new Promise((_, rej) => { tid = setTimeout(() => rej(new Error('timeout')), same ? 15000 : 6000); });
    try {
      const res = await Promise.race([net(), tmo]);
      return res.redirected ? clean(res) : res;
    } catch (x) {
      return Response.error();
    } finally {
      clearTimeout(tid);
    }
  })());
});
