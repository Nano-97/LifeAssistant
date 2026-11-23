// Servizio push dell'Assistente (Cloudflare Worker).
// - GET  /vapid                       -> chiave pubblica VAPID (generata e salvata in KV al primo uso)
// - POST /subscribe {token, subscription}   -> salva l'iscrizione del telefono
// - POST /send {token, title, body, url}    -> manda la notifica a tutti i dispositivi iscritti
// Configurazione nel pannello Cloudflare: KV namespace collegato come SUBS, secret TOKEN (lo stesso del foglio).

const ORIGINE_APP = 'https://nano-97.github.io';
const CONTATTO = 'https://nano-97.github.io/LifeAssistant/';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': ORIGINE_APP,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      if (req.method === 'GET' && url.pathname === '/vapid') {
        const k = await chiaviVapid(env);
        return json({ ok: true, publicKey: k.publicKey });
      }
      if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, messaggio: 'Servizio push attivo' });
      if (req.method !== 'POST') return json({ ok: false, errore: 'metodo non valido' }, 405);

      const dati = await req.json();
      if (!env.TOKEN || dati.token !== env.TOKEN) return json({ ok: false, errore: 'token non valido' }, 401);

      if (url.pathname === '/subscribe') {
        const sub = dati.subscription;
        if (!sub || !sub.endpoint || !sub.keys) return json({ ok: false, errore: 'iscrizione non valida' }, 400);
        await env.SUBS.put('sub:' + await hash(sub.endpoint), JSON.stringify(sub));
        return json({ ok: true });
      }
      if (url.pathname === '/send') {
        const payload = JSON.stringify({ title: dati.title || 'Assistente', body: dati.body || '', url: dati.url || CONTATTO });
        const elenco = await env.SUBS.list({ prefix: 'sub:' });
        const risultati = [];
        for (const k of elenco.keys) {
          const sub = JSON.parse(await env.SUBS.get(k.name));
          const r = await inviaPush(env, sub, payload);
          if (r.status === 404 || r.status === 410) await env.SUBS.delete(k.name); // iscrizione scaduta
          risultati.push(r.status);
        }
        return json({ ok: true, inviate: risultati });
      }
      return json({ ok: false, errore: 'percorso sconosciuto' }, 404);
    } catch (err) {
      return json({ ok: false, errore: String(err && err.message || err) }, 500);
    }
  }
};

// ---------- VAPID ----------
async function chiaviVapid(env) {
  const salvate = await env.SUBS.get('vapid');
  if (salvate) return JSON.parse(salvate);
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const k = { publicKey: b64u(pub), privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
  await env.SUBS.put('vapid', JSON.stringify(k));
  return k;
}

async function jwtVapid(env, endpoint) {
  const k = await chiaviVapid(env);
  const chiave = await crypto.subtle.importKey('jwk', k.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const testa = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTATTO });
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chiave, new TextEncoder().encode(testa)));
  return { jwt: testa + '.' + b64u(firma), publicKey: k.publicKey };
}

// ---------- invio con cifratura aes128gcm (RFC 8291) ----------
async function inviaPush(env, sub, testo) {
  const corpo = await cifra(sub, new TextEncoder().encode(testo));
  const { jwt, publicKey } = await jwtVapid(env, sub.endpoint);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal'
    },
    body: corpo
  });
}

export async function cifra(sub, testo) {
  const uaPub = dab64u(sub.keys.p256dh);
  const auth = dab64u(sub.keys.auth);
  const asKp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKp.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const condiviso = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKp.privateKey, 256));

  const info = unisci(new TextEncoder().encode('WebPush: info\0'), uaPub, asPub);
  const ikm = await hkdf(auth, condiviso, info, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  const chiave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrato = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, chiave, unisci(testo, new Uint8Array([2]))));

  const testa = new Uint8Array(16 + 4 + 1 + asPub.length);
  testa.set(salt, 0);
  new DataView(testa.buffer).setUint32(16, 4096);
  testa[20] = asPub.length;
  testa.set(asPub, 21);
  return unisci(testa, cifrato);
}

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

// ---------- utilità ----------
async function hash(s) { return b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).slice(0, 32); }
function unisci(...a) { const o = new Uint8Array(a.reduce((t, x) => t + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; }
function b64u(b) { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function dab64u(s) { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(t, (c) => c.charCodeAt(0)); }
