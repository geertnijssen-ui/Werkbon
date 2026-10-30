/* Werkbon MT Service: offline cache.
   Bij elke nieuwe upload: verhoog VERSIE hier EN const VERSIE in index.html (zelfde nummer). */
const VERSIE = "werkbon-1.16";
/* Excel-lezer apart bewaren, zodat hij niet bij elke update opnieuw geladen wordt (oude OCR-cache wordt zo ook gewist) */
const LIBS = "werkbon-libs-xlsx-0.18.5";
const BESTANDEN = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/opslag.js", "js/basis.js", "js/talen.js", "js/bon-pdf.js", "js/onderdelen.js", "js/app.js",
  "js/uren-calc.js", "js/uren-pdf.js", "js/uren.js",
  "libs/react.production.min.js", "libs/react-dom.production.min.js",
  "libs/html2canvas.min.js", "libs/jspdf.umd.min.js",
  "fonts/barlow-condensed-latin-600-normal.woff2", "fonts/barlow-condensed-latin-700-normal.woff2",
  "fonts/montserrat-latin-600-normal.woff2", "fonts/montserrat-latin-700-normal.woff2", "fonts/inter-latin-400-normal.woff2", "fonts/inter-latin-500-normal.woff2", "fonts/inter-latin-600-normal.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/logo-mt.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIE).then(c => c.addAll(BESTANDEN)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIE && k !== LIBS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    /* pagina: eerst netwerk (nieuwste versie), anders de bewaarde kopie */
    e.respondWith(fetch(req).then(r => {
      const kopie = r.clone();
      caches.open(VERSIE).then(c => c.put("index.html", kopie));
      return r;
    }).catch(() => caches.match("index.html")));
    return;
  }
  /* Excel-lezer: pas laden bij eerste gebruik, bewaard over updates heen */
  if (new URL(req.url).pathname.indexOf("/libs/xlsx/") >= 0) {
    e.respondWith(caches.open(LIBS).then(c => c.match(req).then(r => r || fetch(req).then(resp => { if (resp.ok) c.put(req, resp.clone()); return resp; }))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
