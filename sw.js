// Service worker: tiene in cache i file dell'app, così si apre anche senza rete.
// I dati non passano di qui: l'app salva l'ultima copia in localStorage.
const VERSIONE = 'assistente-v15';
const FILE = ['./', 'index.html', 'style.css', 'app.js', 'schede.js', 'menu.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-180.png'];

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
  // cache: 'no-store' salta la cache HTTP di GitHub Pages (10 minuti), così una nuova versione arriva subito.
  e.respondWith(fetch(e.request, { cache: 'no-store' })
    .then((r) => { const copia = r.clone(); caches.open(VERSIONE).then((c) => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});

// Notifiche push: arrivano dal servizio Cloudflare, cifrate per questo dispositivo.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Assistente', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tutte) => {
    for (const c of tutte) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
