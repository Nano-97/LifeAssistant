# Assistente

PWA personale (sport, dieta, spesa, finanze, salute, casa) che legge il Foglio Hub tramite l'endpoint Apps Script (`?tipo=dati`).
URL dello script e token si inseriscono al primo avvio e restano solo sul dispositivo. Nessun dato personale in questo repository.

File: `index.html`, `app.js`, `style.css`, `sw.js` (offline), `manifest.webmanifest`, `icons/`.

Lo script del Foglio è in `apps-script/Codice.gs` (da incollare in Estensioni > Apps Script).

Notifiche push: `push-worker/worker.js` è un Cloudflare Worker (KV collegato come `SUBS`, secret `TOKEN`).
Lo script del foglio lo chiama su `/send` (script property `PUSH_URL`); l'app si iscrive su `/subscribe`.
