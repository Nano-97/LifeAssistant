// Assistente: PWA che legge il Foglio Hub tramite l'endpoint Apps Script (?tipo=dati).
// URL e token restano solo su questo dispositivo (localStorage).
'use strict';

const $ = (s) => document.querySelector(s);
const MEZZA = 21.1;
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// ---------- archivio locale ----------
const leggi = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const salva = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* pieno o bloccato */ } };

let config = leggi('config') || {};
let dati = leggi('dati');
let stato = '';

// ---------- utilità ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = (s) => (s ? new Date(s) : null);
const giorno = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const breve = (d) => d.getDate() + ' ' + MESI[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
const euro = (n) => (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const num = (n, dec = 0) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const ore = (h) => { const m = Math.round(h * 60); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0'); };
const passoTesto = (minKm) => { const m = Math.floor(minKm); const s = Math.round((minKm - m) * 60); return s === 60 ? (m + 1) + ':00' : m + ':' + String(s).padStart(2, '0'); };
const inizioSettimana = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const conPasso = (a) => a.passo && /^(corsa|camminata)/i.test(a.tipo || '');
const card = (titolo, corpo) => `<section class="card"><h2>${esc(titolo)}</h2>${corpo}</section>`;

// Corse valide: esclude le uscite con il Watch dimenticato acceso (passo oltre 12 min/km).
function corse() {
  return (dati.allenamenti || []).filter((a) => /^corsa/i.test(a.tipo || '') && a.distanza > 0 && a.durata > 0)
    .map((a) => ({ ...a, d: data(a.data), passoMin: a.durata / a.distanza }))
    .filter((a) => a.passoMin <= 12);
}

function pianoDi(d) {
  const p = dati.piano;
  if (!p || !Array.isArray(p.giorni)) return null;
  return p.giorni.find((g) => g.data === giorno(d)) || null;
}

// ---------- caricamento ----------
async function carica() {
  if (!config.url || !config.token) return;
  stato = 'Aggiorno…'; disegna();
  try {
    const u = config.url + (config.url.includes('?') ? '&' : '?') + 'tipo=dati&token=' + encodeURIComponent(config.token);
    const r = await fetch(u, { redirect: 'follow' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.errore || 'risposta non valida');
    dati = j; salva('dati', j); stato = '';
  } catch (e) {
    stato = dati ? 'Offline: mostro i dati del ' + breve(data(dati.aggiornato)) : 'Errore: ' + e.message;
  }
  disegna();
}

// ---------- viste ----------
const VISTE = {
  oggi: { titolo: 'Oggi', fn: vistaOggi },
  allenamenti: { titolo: 'Allenamenti', fn: vistaAllenamenti },
  dieta: { titolo: 'Dieta e spesa', fn: vistaDieta },
  finanze: { titolo: 'Finanze', fn: vistaFinanze },
  altro: { titolo: 'Altro', fn: vistaAltro },
  impostazioni: { titolo: 'Impostazioni', fn: vistaImpostazioni }
};

function vistaOggi() {
  const ora = new Date();
  let h = `<p class="tenue">${GIORNI[ora.getDay()]} ${breve(ora)}</p>`;

  const p = pianoDi(ora);
  h += card('Il piano di oggi', p
    ? `<ul class="lista"><li><span>Allenamento</span><strong>${esc(p.allenamento || 'Riposo')}</strong></li>
       <li><span>Cena</span><strong>${esc(p.cena || '—')}</strong></li></ul>`
    : '<p class="tenue">Il piano della settimana arriva domenica sera.</p>');

  const salute = (dati.salute || []).map((s) => ({ ...s, d: data(s.data) })).sort((a, b) => b.d - a.d);
  const sonno = salute.find((s) => s.sonno > 0);
  const oggi = salute.find((s) => giorno(s.d) === giorno(ora));
  const fc = salute.find((s) => s.fc_riposo > 0);
  h += '<div class="griglia">';
  h += card('Sonno', sonno ? `<div class="grande">${ore(sonno.sonno)}</div><div class="tenue">${breve(sonno.d)}</div>` : '<div class="tenue">Nessun dato</div>');
  h += card('Passi oggi', `<div class="grande">${num(oggi && oggi.passi)}</div><div class="tenue">aggiornati all'ultimo invio</div>`);
  h += card('FC a riposo', fc ? `<div class="grande">${num(fc.fc_riposo)}</div><div class="tenue">bpm, ${breve(fc.d)}</div>` : '<div class="tenue">Nessun dato</div>');
  const da7 = new Date(ora.getTime() - 7 * 864e5);
  const spese = (dati.pagamenti || []).filter((x) => data(x.data) >= da7).reduce((t, x) => t + (Number(x.importo) || 0), 0);
  h += card('Spese 7 giorni', `<div class="grande">${euro(spese)}</div><div class="tenue">con Apple Pay</div>`);
  h += '</div>';

  const ultimo = (dati.allenamenti || []).map((a) => ({ ...a, d: data(a.data) })).sort((a, b) => b.d - a.d)[0];
  if (ultimo) {
    h += card('Ultimo allenamento', `<strong>${esc(ultimo.tipo)}</strong> · ${breve(ultimo.d)}<br>
      <span class="tenue">${ultimo.distanza ? num(ultimo.distanza, 2) + ' km · ' : ''}${num(ultimo.durata)} min${conPasso(ultimo) ? ' · ' + esc(ultimo.passo) + '/km' : ''}</span>`);
  }

  const scad = (dati.casa || []).filter((c) => c.prossima_scadenza).map((c) => ({ ...c, d: data(c.prossima_scadenza) }))
    .filter((c) => c.d >= new Date(giorno(ora))).sort((a, b) => a.d - b.d)[0];
  if (scad) h += card('Prossima scadenza di casa', `<strong>${esc(scad.voce)}</strong> · ${breve(scad.d)}${scad.importo_stimato ? ' · ' + euro(scad.importo_stimato) : ''}`);
  return h;
}

function vistaAllenamenti() {
  const ora = new Date();
  const c = corse().sort((a, b) => b.d - a.d);
  const da90 = new Date(ora.getTime() - 90 * 864e5);
  const recenti = c.filter((x) => x.d >= da90);
  const lungaRecente = recenti.reduce((m, x) => Math.max(m, x.distanza), 0);
  const lungaTotale = c.reduce((m, x) => (x.distanza > (m ? m.distanza : 0) ? x : m), null);
  let h = '';

  const base = lungaRecente || 0;
  h += card('Verso la mezza maratona', `<div class="grande">${num(base, 1)} <span class="tenue">/ ${MEZZA} km</span></div>
    <div class="barra-prog"><div style="width:${Math.min(100, base / MEZZA * 100)}%"></div></div>
    <div class="tenue">Uscita più lunga negli ultimi 90 giorni${lungaTotale ? `. Record: ${num(lungaTotale.distanza, 1)} km a ${passoTesto(lungaTotale.passoMin)}/km (${breve(lungaTotale.d)})` : ''}</div>`);

  // km di corsa per settimana, ultime 12 settimane
  const lun = inizioSettimana(ora);
  const sett = [];
  for (let i = 11; i >= 0; i--) {
    const da = new Date(lun.getTime() - i * 7 * 864e5), a = new Date(da.getTime() + 7 * 864e5);
    sett.push({ da, km: c.filter((x) => x.d >= da && x.d < a).reduce((t, x) => t + x.distanza, 0) });
  }
  const max = Math.max(5, ...sett.map((s) => s.km));
  const totale12 = sett.reduce((t, s) => t + s.km, 0);
  h += card('Km di corsa a settimana', `<div class="grafico" role="img" aria-label="Km di corsa nelle ultime 12 settimane">
      ${sett.map((s) => `<div class="${s.km ? '' : 'zero'}" style="height:${s.km / max * 100}%" title="${breve(s.da)}: ${num(s.km, 1)} km"></div>`).join('')}
    </div><div class="assi"><span>${breve(sett[0].da)}</span><span>questa settimana</span></div>
    <p class="tenue">${totale12 ? num(totale12, 1) + ' km in 12 settimane' : 'Nessuna corsa nelle ultime 12 settimane: la base si ricostruisce piano.'}</p>`);

  const tutti = (dati.allenamenti || []).map((a) => ({ ...a, d: data(a.data) })).sort((a, b) => b.d - a.d).slice(0, 30);
  h += card('Storico', tutti.length ? `<ul class="lista">${tutti.map((a) => `<li><span><strong>${esc(a.tipo)}</strong><br>
      <span class="tenue">${breve(a.d)}</span></span><span class="tenue" style="text-align:right">${a.distanza ? num(a.distanza, 2) + ' km<br>' : ''}${num(a.durata)} min${conPasso(a) ? ' · ' + esc(a.passo) : ''}</span></li>`).join('')}</ul>`
    : '<p class="tenue">Nessun allenamento.</p>');
  return h;
}

function vistaDieta() {
  let h = '';
  const p = dati.piano;
  if (p && Array.isArray(p.giorni)) {
    h += card('Menu della settimana', `<ul class="lista">${p.giorni.map((g) => { const d = data(g.data + 'T12:00:00');
      return `<li><span>${GIORNI[d.getDay()]}</span><strong>${esc(g.cena || '—')}</strong></li>`; }).join('')}</ul>`);
  } else {
    h += card('Menu della settimana', '<p class="tenue">Arriva domenica sera con il nuovo piano.</p>');
  }
  const l = dati.lista || [];
  h += card('Lista spesa', l.length ? `<ul class="lista">${l.map((v) => `<li><span>${esc(v)}</span></li>`).join('')}</ul>
    <p class="tenue">Le spunte dall'app arrivano nella prossima versione; per ora usa Promemoria.</p>` : '<p class="tenue">Nessuna lista.</p>');
  return h;
}

function vistaFinanze() {
  const ora = new Date();
  const mese = (d, off) => { const x = new Date(d.getFullYear(), d.getMonth() + off, 1); return x.getFullYear() + '-' + x.getMonth(); };
  const chiaveMese = (d) => d.getFullYear() + '-' + d.getMonth();
  const voci = [...(dati.pagamenti || []), ...(dati.movimenti || []).filter((m) => Number(m.importo) < 0).map((m) => ({ ...m, importo: -Number(m.importo), esercente: m.descrizione }))]
    .map((x) => ({ ...x, d: data(x.data), importo: Number(x.importo) || 0 }));
  const questo = voci.filter((x) => chiaveMese(x.d) === mese(ora, 0));
  const prima = voci.filter((x) => chiaveMese(x.d) === mese(ora, -1));
  const tot = (a) => a.reduce((t, x) => t + x.importo, 0);
  const perCat = {};
  questo.forEach((x) => { const c = x.categoria || 'Da classificare'; perCat[c] = (perCat[c] || 0) + x.importo; });
  const cat = Object.entries(perCat).sort((a, b) => b[1] - a[1]);
  let h = card('Questo mese', `<div class="grande">${euro(tot(questo))}</div><div class="tenue">Mese scorso: ${euro(tot(prima))}</div>`);
  h += card('Per categoria', cat.length ? `<ul class="lista">${cat.map(([c, v]) => `<li><span>${esc(c)}</span><strong>${euro(v)}</strong></li>`).join('')}</ul>` : '<p class="tenue">Ancora nessuna spesa questo mese.</p>');
  const ultime = questo.sort((a, b) => b.d - a.d).slice(0, 15);
  if (ultime.length) h += card('Ultime spese', `<ul class="lista">${ultime.map((x) => `<li><span>${esc(x.esercente || '—')}<br><span class="tenue">${breve(x.d)} · ${esc(x.categoria || 'Da classificare')}</span></span><strong>${euro(x.importo)}</strong></li>`).join('')}</ul>`);
  h += '<p class="tenue">Il caricamento dei movimenti Intesa arriva nella Fase 3.</p>';
  return h;
}

function vistaAltro() {
  const salute = (dati.salute || []).map((s) => ({ ...s, d: data(s.data) })).sort((a, b) => b.d - a.d);
  const ultimi = salute.slice(0, 14);
  const media = (k) => { const v = ultimi.map((s) => s[k]).filter((x) => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const peso = salute.find((s) => s.peso > 0);
  let h = '<div class="griglia">';
  h += card('Sonno medio 14 gg', `<div class="grande">${media('sonno') ? ore(media('sonno')) : '—'}</div>`);
  h += card('Passi medi 14 gg', `<div class="grande">${num(media('passi'))}</div>`);
  h += card('Peso', peso ? `<div class="grande">${num(peso.peso, 1)} kg</div><div class="tenue">${breve(peso.d)}</div>` : '<div class="tenue">Nessun dato</div>');
  h += '</div>';
  const casa = (dati.casa || []).map((c) => ({ ...c, d: data(c.prossima_scadenza) })).sort((a, b) => (a.d || 9e15) - (b.d || 9e15));
  h += card('Casa', casa.length ? `<ul class="lista">${casa.map((c) => `<li><span>${esc(c.voce)}<br><span class="tenue">${esc(c.frequenza || '')}</span></span><span class="tenue">${c.d ? breve(c.d) : ''}</span></li>`).join('')}</ul>` : '<p class="tenue">Nessuna voce nella scheda Casa.</p>');
  h += card('App', `<p class="tenue">Dati aggiornati al ${dati.aggiornato ? breve(data(dati.aggiornato)) + ' ' + dati.aggiornato.slice(11, 16) : '—'}.</p>
    <a href="#impostazioni">Impostazioni</a>`);
  return h;
}

function vistaImpostazioni() {
  return card('Collegamento al Foglio Hub', `<form id="form-config">
      <label for="url">Indirizzo dello script (…/exec)</label>
      <input id="url" type="url" required placeholder="https://script.google.com/macros/s/…/exec" value="${esc(config.url || '')}">
      <label for="token">Token</label>
      <input id="token" type="password" required autocomplete="off" value="${esc(config.token || '')}">
      <button class="primario" type="submit">Salva e collega</button>
    </form>
    <p class="tenue">Restano salvati solo su questo dispositivo.</p>`);
}

// ---------- disegno e navigazione ----------
function disegna() {
  let v = (location.hash || '#oggi').slice(1);
  if (!config.url || !config.token) v = 'impostazioni';
  if (!VISTE[v]) v = 'oggi';
  $('#titolo').textContent = VISTE[v].titolo;
  document.querySelectorAll('.barra a').forEach((a) => a.classList.toggle('attivo', a.dataset.v === v));
  let h = stato ? `<p class="${stato.startsWith('Errore') ? 'errore' : 'tenue'}">${esc(stato)}</p>` : '';
  if (v === 'impostazioni') h += vistaImpostazioni();
  else if (!dati) h += '<p class="tenue">Carico i dati…</p>';
  else h += VISTE[v].fn();
  $('#vista').innerHTML = h;
  const f = $('#form-config');
  if (f) f.addEventListener('submit', (e) => {
    e.preventDefault();
    config = { url: $('#url').value.trim(), token: $('#token').value.trim() };
    salva('config', config);
    location.hash = '#oggi';
    carica();
  });
}

window.addEventListener('hashchange', () => { disegna(); window.scrollTo(0, 0); });
$('#aggiorna').addEventListener('click', carica);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && dati && Date.now() - data(dati.aggiornato) > 15 * 60e3) carica();
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

disegna();
carica();
