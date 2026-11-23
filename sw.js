// Service worker: tiene in cache i file dell'app, così si apre anche senza rete.
// I dati non passano di qui: l'app salva l'ultima copia in localStorage.
const VERSIONE = 'assistente-v1';
const FILE = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((k) => Promise.all(k.filter((n) => n !== VERSIONE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  // Prima la rete (così gli aggiornamenti arrivano subito), poi la cache se sei offline.
  e.respondWith(fetch(e.request)
    .then((r) => { const copia = r.clone(); caches.open(VERSIONE).then((c) => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
