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
const idDelGiorno = (d) => (PROGRAMMA.eccezioni && PROGRAMMA.eccezioni[giorno(d)]) || PROGRAMMA.settimana[d.getDay()];
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
  $('#aggiorna').classList.add('gira');
  try {
    const u = config.url + (config.url.includes('?') ? '&' : '?') + 'tipo=dati&token=' + encodeURIComponent(config.token);
    const r = await fetch(u, { redirect: 'follow' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.errore || 'risposta non valida');
    dati = j; salva('dati', j); stato = '';
  } catch (e) {
    stato = dati ? 'Offline: mostro i dati del ' + breve(data(dati.aggiornato)) : 'Errore: ' + e.message;
  }
  $('#aggiorna').classList.remove('gira');
  // ridisegna senza far saltare la pagina (e senza chiudere le schede aperte, se non è cambiato niente)
  const y = window.scrollY; const prima = $('#vista').innerHTML;
  disegna();
  if ($('#vista').innerHTML === prima) return;
  window.scrollTo(0, y);
}

// ---------- viste ----------
const VISTE = {
  oggi: { titolo: 'Oggi', fn: vistaOggi },
  allenamenti: { titolo: 'Allenamenti', fn: vistaAllenamenti },
  riepilogo: { titolo: 'Riepilogo', fn: vistaRiepilogo, padre: 'allenamenti' },
  dieta: { titolo: 'Dieta e spesa', fn: vistaDieta },
  finanze: { titolo: 'Finanze', fn: vistaFinanze },
  altro: { titolo: 'Altro', fn: vistaAltro },
  impostazioni: { titolo: 'Impostazioni', fn: vistaImpostazioni },
  avvisi: { titolo: 'Avvisi', fn: vistaAvvisi }
};

// ---------- peso ----------
// Una pesata a settimana, il lunedì appena sveglio (dopo il bagno, prima di mangiare e bere).
function ultimoPeso() {
  return ((dati && dati.salute) || []).filter((x) => x.peso > 0).map((x) => ({ ...x, d: data(x.data) })).sort((a, b) => b.d - a.d)[0] || null;
}
function pesoDaFare() {
  const u = ultimoPeso();
  const ora = new Date();
  if (u && ora - u.d < 6 * 864e5) return false;
  return ora.getDay() === 1 || !u || ora - u.d >= 7 * 864e5;
}
function formPeso() {
  const u = ultimoPeso();
  return `<form class="form-peso" data-form="peso"><input type="text" inputmode="decimal" name="peso" placeholder="${u ? num(u.peso, 1) : '75,0'}" aria-label="Peso in kg" required>
    <span class="unita">kg</span><button class="primario corto" type="submit">Salva</button></form>
    <p class="tenue">Una volta a settimana, il lunedì appena sveglio: dopo il bagno, prima di mangiare e bere.</p>`;
}
async function salvaPeso(kg) {
  const ora = new Date();
  const off = -ora.getTimezoneOffset(), segno = off >= 0 ? '+' : '-';
  const tz = segno + String(Math.floor(Math.abs(off) / 60)).padStart(2, '0') + String(Math.abs(off) % 60).padStart(2, '0');
  const corpo = { token: config.token, tipo: 'salute_auto', data: { metrics: [{ name: 'weight_body_mass', units: 'kg',
    data: [{ date: giorno(ora) + ' ' + ora.toTimeString().slice(0, 8) + ' ' + tz, qty: kg }] }] } };
  const r = await fetch(config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.errore || 'non salvato');
  const oggi = giorno(ora);
  const riga = dati.salute.find((x) => String(x.data).slice(0, 10) === oggi);
  if (riga) riga.peso = kg; else dati.salute.push({ data: oggi + 'T00:00:00', peso: kg });
  salva('dati', dati);
}
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form="peso"]');
  if (!f) return;
  e.preventDefault();
  const kg = Math.round(parseFloat(f.peso.value.replace(',', '.')) * 10) / 10;
  if (!(kg > 30 && kg < 250)) { alertaForm(f, 'Scrivi il peso in kg, per esempio 74,5'); return; }
  const b = f.querySelector('button'); b.disabled = true; b.textContent = '…';
  try { await salvaPeso(kg); stato = `Peso salvato: ${num(kg, 1)} kg`; } catch (err) { stato = 'Errore: peso non salvato (' + err.message + ')'; }
  disegna(); window.scrollTo(0, 0);
});
function alertaForm(f, testo) {
  let p = f.querySelector('.errore');
  if (!p) { p = document.createElement('p'); p.className = 'errore'; f.appendChild(p); }
  p.textContent = testo;
}

function vistaOggi() {
  const ora = new Date();
  let h = `<p class="tenue">${GIORNI[ora.getDay()]} ${breve(ora)}</p>`;

  const p = pianoDi(ora);
  const m = menuAttivo(), gm = m.giorni[ora.getDay()] || {};
  const allen = (p && p.allenamento) || PROGRAMMA.schede[idDelGiorno(ora)].nome;
  const cena = (p && p.cena) || (m.ricette[gm.cena] ? m.ricette[gm.cena].nome : '—');
  h += card('Il piano di oggi', `<ul class="lista"><li><a href="#allenamenti">Allenamento</a><strong>${esc(allen)}</strong></li>
       ${m.ricette[gm.colazione] ? `<li><a href="#dieta">Colazione</a><strong>${esc(m.ricette[gm.colazione].nome)}</strong></li>` : ''}
       <li><a href="#dieta">Cena</a><strong>${esc(cena)}</strong></li></ul>`);

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

  if (pesoDaFare()) h += card('Pesati', formPeso());
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

function vistaRiepilogo() {
  const ora = new Date();
  const c = corse().sort((a, b) => b.d - a.d);
  const da90 = new Date(ora.getTime() - 90 * 864e5);
  const recenti = c.filter((x) => x.d >= da90);
  const lungaRecente = recenti.reduce((m, x) => Math.max(m, x.distanza), 0);
  const lungaTotale = c.reduce((m, x) => (x.distanza > (m ? m.distanza : 0) ? x : m), null);
  let h = '<p><a href="#allenamenti">‹ Schede</a></p>';

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

// ---------- schede di allenamento ----------
const fattiKey = () => 'fatti-' + giorno(new Date());
let fatti = leggi(fattiKey()) || {};
let apertaScheda = null;

function schedaHtml(id, aperta) {
  const s = PROGRAMMA.schede[id];
  if (!s) return '';
  const meta = [s.dove, s.durata].filter(Boolean).join(' · ');
  let corpo = s.intro ? `<p class="tenue">${esc(s.intro)}</p>` : '';
  if (s.riscaldamento) corpo += `<p class="tenue">Prima: <a href="#allenamenti" data-apri="RISCALDAMENTO">riscaldamento spalla</a> (10 min).</p>`;
  if (s.esercizi.length) {
    corpo += '<ul class="esercizi">' + s.esercizi.map((e, i) => {
      const n = e.serie || s.giri || 1;
      const pallini = Array.from({ length: n }, (_, k) => {
        const kk = id + '.' + i + '.' + k;
        return `<button class="pallino${fatti[kk] ? ' fatto' : ''}" data-serie="${kk}" aria-label="${esc(e.nome)} serie ${k + 1}">${k + 1}</button>`;
      }).join('');
      return `<li><div class="es-testa"><strong>${esc(e.nome)}</strong><span class="rip">${e.serie ? e.serie + ' × ' : ''}${esc(e.rip)}</span></div>
        ${e.nota ? `<div class="tenue">${esc(e.nota)}</div>` : ''}<div class="pallini">${pallini}</div></li>`;
    }).join('') + '</ul>';
    if (s.giri) corpo += `<p class="tenue">I pallini sono i ${s.giri} giri.</p>`;
  }
  return `<details class="card scheda" data-id="${id}"${aperta ? ' open' : ''}><summary><span><strong>${esc(s.nome)}</strong><br><span class="tenue">${esc(meta)}</span></span><span class="freccia">›</span></summary>${corpo}</details>`;
}

function vistaAllenamenti() {
  const ora = new Date();
  const oggiId = idDelGiorno(ora);
  let h = '';
  h += `<p class="tenue">Oggi, ${GIORNI[ora.getDay()]}</p>`;
  h += schedaHtml(oggiId, apertaScheda ? apertaScheda === oggiId : true);
  if (PROGRAMMA.schede[oggiId].riscaldamento) h += schedaHtml('RISCALDAMENTO', apertaScheda === 'RISCALDAMENTO');

  h += '<h3 class="sezione">Tutte le schede</h3>';
  ['A', 'B', 'C', 'CORSA', 'RISCALDAMENTO'].filter((id) => id !== oggiId && !(id === 'RISCALDAMENTO' && PROGRAMMA.schede[oggiId].riscaldamento))
    .forEach((id) => { h += schedaHtml(id, apertaScheda === id); });

  const ordine = [1, 2, 3, 4, 5, 6, 0];
  h += card('La settimana', `<ul class="lista">${ordine.map((g) => { const lun = inizioSettimana(ora); const dd = new Date(lun.getTime() + ((g + 6) % 7) * 864e5 + 12 * 36e5); const s = PROGRAMMA.schede[idDelGiorno(dd)];
    return `<li${g === ora.getDay() ? ' class="oggi"' : ''}><span>${GIORNI[g]}</span><span>${esc(s.nome.replace(/^Seduta /, ''))}</span></li>`; }).join('')}</ul>`);
  h += card('Progressione', `<ul class="lista">${PROGRAMMA.progressione.map(([a, b]) => `<li><span><strong>${esc(a)}</strong>: ${esc(b)}</span></li>`).join('')}</ul>
    <p class="tenue">${esc(PROGRAMMA.nota)}</p>`);
  h += `<a class="card link-card" href="#riepilogo"><span><strong>Riepilogo e storico</strong><br><span class="tenue">Mezza maratona, km a settimana, allenamenti passati</span></span><span class="freccia">›</span></a>`;
  return h;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-serie]');
  if (b) {
    if (leggi('fatti-giorno') !== giorno(new Date())) { fatti = {}; salva('fatti-giorno', giorno(new Date())); }
    const k = b.dataset.serie;
    if (fatti[k]) delete fatti[k]; else fatti[k] = 1;
    salva(fattiKey(), fatti);
    b.classList.toggle('fatto', !!fatti[k]);
    return;
  }
  const a = e.target.closest('[data-apri]');
  if (a) { e.preventDefault(); apertaScheda = a.dataset.apri; disegna(); const el = document.querySelector(`[data-id="${apertaScheda}"]`); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
});

// ---------- dieta e spesa ----------
const menuAttivo = () => (dati && dati.piano && dati.piano.menu) || MENU;
const spesaAttiva = () => (dati && dati.piano && Array.isArray(dati.piano.spesa) && dati.piano.spesa) || MENU.spesa;
const spuntaKey = () => 'spunte-' + (menuAttivo().settimana || '');
let spunte = leggi(spuntaKey()) || {};
let modificaReparti = false;

function ricettaHtml(r, titolo) {
  if (!r) return '';
  return `<p><strong>${esc(r.nome)}</strong>${r.tempo ? ` <span class="tenue">· ${esc(r.tempo)}</span>` : ''}</p>
    ${r.ingredienti && r.ingredienti.length ? `<p class="mini">Ingredienti</p><ul class="puntata">${r.ingredienti.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    ${r.passi && r.passi.length ? `<p class="mini">Come si fa</p><ol class="puntata">${r.passi.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>` : ''}
    ${r.nota ? `<p class="tenue">${esc(r.nota)}</p>` : ''}`;
}

function ordineReparti() {
  const tutti = spesaAttiva().map((r) => r.reparto);
  const salvato = (leggi('ordine-reparti') || []).filter((r) => tutti.includes(r));
  return [...salvato, ...tutti.filter((r) => !salvato.includes(r))];
}

function vistaDieta() {
  const m = menuAttivo();
  const ora = new Date();
  const g = m.giorni[ora.getDay()] || {};
  const r = m.ricette[g.cena];
  const rc = m.ricette[g.colazione];
  const sp = g.spuntino ? [g.spuntino] : (m.spuntini || []);
  let h = card('Oggi si mangia', `<ul class="lista">
      ${rc ? `<li style="display:block"><span class="tenue">Colazione</span><br><strong>${esc(rc.nome)}</strong><details class="ricetta"><summary>Come si fa</summary>${ricettaHtml(rc)}</details></li>` : ''}
      <li style="display:block"><span class="tenue">Pranzo</span><br><strong>${esc(m.ricette[g.pranzo] ? m.ricette[g.pranzo].nome : (g.pranzo || '—'))}</strong>${g.pranzo === 'Mensa' ? '<br><span class="tenue">Un secondo con verdura, più un primo piccolo o il pane; frutta come dessert.</span>' : ''}</li>
      ${sp.length ? `<li style="display:block"><span class="tenue">Spuntino</span><br>${sp.map(esc).join(' · ')}</li>` : ''}
    </ul>`);
  h += card('La cena di stasera', r ? ricettaHtml(r) : '<p class="tenue">Nessuna cena in programma.</p>');

  const ordine = [1, 2, 3, 4, 5, 6, 0];
  const nomePiatto = (k) => (m.ricette[k] ? m.ricette[k].nome : k || '—');
  h += `<details class="card scheda"><summary><span><strong>Menu completo della settimana</strong></span><span class="freccia">›</span></summary>
    <ul class="lista">${ordine.map((d) => { const x = m.giorni[d] || {};
      return `<li class="${d === ora.getDay() ? 'oggi' : ''}" style="display:block"><strong>${GIORNI[d]}</strong><br>
        ${x.colazione ? `<span class="tenue">Colazione:</span> ${esc(nomePiatto(x.colazione))}<br>` : ''}<span class="tenue">Pranzo:</span> ${esc(nomePiatto(x.pranzo))}<br>${x.spuntino ? `<span class="tenue">Spuntino:</span> ${esc(x.spuntino)}<br>` : ''}<span class="tenue">Cena:</span> ${esc(nomePiatto(x.cena))}
        ${m.ricette[x.cena] && m.ricette[x.cena].passi.length > 1 ? `<details class="ricetta"><summary>Ricetta</summary>${ricettaHtml(m.ricette[x.cena])}</details>` : ''}
        ${m.ricette[x.colazione] ? `<details class="ricetta"><summary>Ricetta della colazione</summary>${ricettaHtml(m.ricette[x.colazione])}</details>` : ''}
        ${m.ricette[x.pranzo] ? `<details class="ricetta"><summary>Ricetta del pranzo</summary>${ricettaHtml(m.ricette[x.pranzo])}</details>` : ''}</li>`; }).join('')}</ul></details>`;

  // lista spesa
  const reparti = ordineReparti();
  const perRep = Object.fromEntries(spesaAttiva().map((x) => [x.reparto, x.voci]));
  const totali = spesaAttiva().reduce((t, x) => t + x.voci.length, 0);
  const prese = Object.keys(spunte).length;
  h += `<div class="testa-spesa"><h3 class="sezione">Lista spesa · ${prese}/${totali}</h3>
    <button class="testo-btn" data-azione="reparti">${modificaReparti ? 'Fatto' : 'Ordina reparti'}</button></div>`;
  if (modificaReparti) {
    h += `<section class="card"><p class="tenue">Metti i reparti nell'ordine dei corridoi del tuo supermercato.</p><ul class="lista">${reparti.map((rep, i) => `<li><span>${esc(rep)}</span>
      <span class="sposta"><button data-su="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Sposta su">▲</button><button data-giu="${i}" ${i === reparti.length - 1 ? 'disabled' : ''} aria-label="Sposta giù">▼</button></span></li>`).join('')}</ul></section>`;
  } else {
    reparti.forEach((rep) => {
      const voci = perRep[rep] || [];
      const fatte = voci.filter((v) => spunte[rep + '|' + v]).length;
      h += `<section class="card"><h2>${esc(rep)} <span class="conta">${fatte}/${voci.length}</span></h2><ul class="spunte">${voci.map((v) => { const k = rep + '|' + v;
        return `<li><label class="${spunte[k] ? 'preso' : ''}"><input type="checkbox" data-spunta="${esc(k)}" ${spunte[k] ? 'checked' : ''}><span>${esc(v)}</span></label></li>`; }).join('')}</ul></section>`;
    });
    if (prese) h += '<button class="testo-btn" data-azione="azzera">Togli tutte le spunte</button>';
  }
  return h;
}

document.addEventListener('change', (e) => {
  const c = e.target.closest('[data-spunta]');
  if (!c) return;
  if (c.checked) spunte[c.dataset.spunta] = 1; else delete spunte[c.dataset.spunta];
  salva(spuntaKey(), spunte);
  disegna();
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-azione="reparti"],[data-azione="azzera"],[data-su],[data-giu]');
  if (!b) return;
  if (b.dataset.azione === 'reparti') { modificaReparti = !modificaReparti; }
  else if (b.dataset.azione === 'azzera') { spunte = {}; salva(spuntaKey(), spunte); }
  else {
    const o = ordineReparti(); const i = Number(b.dataset.su ?? b.dataset.giu); const j = b.dataset.su != null ? i - 1 : i + 1;
    [o[i], o[j]] = [o[j], o[i]]; salva('ordine-reparti', o);
  }
  const y = window.scrollY; disegna(); window.scrollTo(0, y);
});

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

// ---------- avvisi in app ----------
// Generati dai dati: promemoria allenamento, spese registrate, piano nuovo della domenica.
function avvisi() {
  const ora = new Date();
  const out = [];
  const idOggi = idDelGiorno(ora);
  const s = PROGRAMMA.schede[idOggi];
  if (s && s.esercizi.length) {
    const fatte = Object.keys(fatti).filter((k) => k.startsWith(idOggi + '.')).length;
    const tot = s.esercizi.reduce((t, e) => t + (e.serie || s.giri || 1), 0);
    if (fatte < tot) out.push({ id: 'all-' + giorno(ora), quando: new Date(giorno(ora) + 'T08:00:00'), tipo: '🏃',
      testo: fatte ? `${s.nome}: ${fatte} serie su ${tot}, finisci quando puoi.` : `Oggi tocca ${s.nome} (${s.durata}).`, link: '#allenamenti' });
  }
  const da3 = new Date(ora.getTime() - 3 * 864e5);
  (dati && dati.pagamenti || []).map((x) => ({ ...x, d: data(x.data) })).filter((x) => x.d >= da3)
    .forEach((x) => out.push({ id: 'pag-' + x.data + x.importo, quando: x.d, tipo: '€',
      testo: `Spesa registrata: ${euro(x.importo)} da ${x.esercente || '—'}${x.categoria === 'Da classificare' ? ' (da classificare)' : ''}.`, link: '#finanze' }));
  if (dati && pesoDaFare()) out.push({ id: 'peso-' + giorno(inizioSettimana(ora)), quando: new Date(giorno(inizioSettimana(ora)) + 'T07:00:00'), tipo: '⚖️', testo: 'È ora di pesarti: inseriscilo da Oggi.', link: '#oggi' });
  const p = dati && dati.piano;
  if (p && p.settimana) out.push({ id: 'piano-' + p.settimana, quando: new Date(p.settimana + 'T00:00:00'), tipo: '📋',
    testo: 'Nuovo piano della settimana: menu, lista spesa e allenamenti aggiornati.', link: '#dieta' });
  const scad = (dati && dati.casa || []).filter((c) => c.prossima_scadenza).map((c) => ({ ...c, d: data(c.prossima_scadenza) }))
    .filter((c) => c.d >= new Date(giorno(ora)) && c.d - ora < 7 * 864e5);
  scad.forEach((c) => out.push({ id: 'casa-' + c.voce + c.prossima_scadenza, quando: c.d, tipo: '🏠', testo: `${c.voce} scade il ${breve(c.d)}.`, link: '#altro' }));
  return out.sort((a, b) => b.quando - a.quando);
}

function aggiornaBadge() {
  const letti = leggi('avvisi-letti') || {};
  const n = avvisi().filter((a) => !letti[a.id]).length;
  const b = $('#badge');
  if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }
}

function vistaAvvisi() {
  const lista = avvisi();
  const letti = leggi('avvisi-letti') || {};
  const h = lista.length ? `<section class="card"><ul class="lista">${lista.map((a) => `<li class="${letti[a.id] ? '' : 'nuovo'}"><a class="avviso-riga" href="${a.link}">
      <span class="avviso-icona">${a.tipo}</span><span>${esc(a.testo)}<br><span class="tenue">${breve(a.quando)}</span></span></a></li>`).join('')}</ul></section>`
    : card('Avvisi', '<p class="tenue">Niente di nuovo.</p>');
  lista.forEach((a) => { letti[a.id] = 1; });
  salva('avvisi-letti', letti);
  return h + `<p class="tenue">Per gli avvisi sul telefono anche ad app chiusa usa i Comandi rapidi: te li spiego in chat.</p>`;
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
  h += '</div>' + card('Inserisci il peso', formPeso()) + '<div>';
  h += '</div>';
  const casa = (dati.casa || []).map((c) => ({ ...c, d: data(c.prossima_scadenza) })).sort((a, b) => (a.d || 9e15) - (b.d || 9e15));
  h += card('Casa', casa.length ? `<ul class="lista">${casa.map((c) => `<li><span>${esc(c.voce)}<br><span class="tenue">${esc(c.frequenza || '')}</span></span><span class="tenue">${c.d ? breve(c.d) : ''}</span></li>`).join('')}</ul>` : '<p class="tenue">Nessuna voce nella scheda Casa.</p>');
  h += card('Notifiche', statoNotifiche());
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
      <label for="push">Servizio notifiche (…workers.dev)</label>
      <input id="push" type="url" placeholder="https://assistente-push.….workers.dev" value="${esc(config.push || '')}">
      <button class="primario" type="submit">Salva e collega</button>
    </form>
    <p class="tenue">Restano salvati solo su questo dispositivo.</p>`);
}

// ---------- notifiche push ----------
function statoNotifiche() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return `<p class="tenue">${standalone ? 'Questo dispositivo non supporta le notifiche push (serve iOS 16.4 o successivo).' : "Apri l'app dall'icona sulla schermata Home: su iPhone le notifiche funzionano solo da lì."}</p>`;
  }
  if (!config.push) return '<p class="tenue">Manca l\'indirizzo del servizio notifiche: aggiungilo in <a href="#impostazioni">Impostazioni</a>.</p>';
  const perm = Notification.permission;
  if (perm === 'denied') return '<p class="tenue">Notifiche bloccate: riattivale da Impostazioni iPhone > Notifiche > Assistente.</p>';
  const attive = perm === 'granted' && leggi('push-attive');
  return `<p class="tenue">${attive ? 'Attive su questo telefono: spese, allenamento delle 18, pesata del lunedì, piano della domenica, scadenze di casa.' : 'Ricevi spese, promemoria allenamento, pesata, piano della domenica e scadenze anche ad app chiusa.'}</p>
    <button class="primario" data-azione="push">${attive ? 'Invia una notifica di prova' : 'Attiva notifiche'}</button>`;
}

async function attivaPush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('permesso negato');
  const reg = await navigator.serviceWorker.ready;
  const k = await fetch(config.push + '/vapid').then((r) => r.json());
  const chiave = Uint8Array.from(atob(k.publicKey.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((k.publicKey.length + 3) % 4)), (c) => c.charCodeAt(0));
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiave });
  const r = await fetch(config.push + '/subscribe', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ token: config.token, subscription: sub.toJSON() }) }).then((x) => x.json());
  if (!r.ok) throw new Error(r.errore || 'iscrizione non riuscita');
  salva('push-attive', true);
}

async function provaPush() {
  const r = await fetch(config.push + '/send', { method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: config.token, title: 'Prova', body: 'Le notifiche funzionano.', url: location.href.split('#')[0] + '#altro' }) }).then((x) => x.json());
  if (!r.ok) throw new Error(r.errore || 'invio non riuscito');
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-azione="push"]');
  if (!b) return;
  b.disabled = true;
  try {
    if (Notification.permission === 'granted' && leggi('push-attive')) { await provaPush(); stato = 'Notifica di prova inviata.'; }
    else { await attivaPush(); stato = 'Notifiche attivate.'; }
  } catch (err) { stato = 'Errore notifiche: ' + err.message; }
  disegna();
});

// ---------- disegno e navigazione ----------
function disegna() {
  let v = (location.hash || '#oggi').slice(1);
  if (!config.url || !config.token) v = 'impostazioni';
  if (!VISTE[v]) v = 'oggi';
  $('#titolo').textContent = VISTE[v].titolo;
  const sez = VISTE[v].padre || v;
  document.querySelectorAll('.barra a').forEach((a) => a.classList.toggle('attivo', a.dataset.v === sez));
  let h = stato ? `<p class="${stato.startsWith('Errore') ? 'errore' : 'tenue'}">${esc(stato)}</p>` : '';
  if (v === 'impostazioni') h += vistaImpostazioni();
  else if (!dati && v !== 'allenamenti' && v !== 'dieta') h += '<p class="tenue">Carico i dati…</p>';
  else h += VISTE[v].fn();
  $('#vista').innerHTML = h;
  aggiornaBadge();
  const f = $('#form-config');
  if (f) f.addEventListener('submit', (e) => {
    e.preventDefault();
    config = { url: $('#url').value.trim(), token: $('#token').value.trim(), push: $('#push').value.trim().replace(/\/+$/, '') };
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
// Aggiornamenti dell'app: controlla una nuova versione a ogni apertura e ricarica da sola appena è pronta.
if ('serviceWorker' in navigator) {
  let ricaricata = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!ricaricata) { ricaricata = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
// Niente zoom: pizzico e doppio tocco disattivati (Safari ignora user-scalable=no).
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.scale && e.scale !== 1) e.preventDefault(); }, { passive: false });

disegna();
carica();
