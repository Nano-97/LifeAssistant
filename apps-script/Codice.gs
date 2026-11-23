// Endpoint del Foglio Hub (versione 5): riceve dati dai Comandi rapidi e da Health Auto Export
// e li scrive nella scheda giusta. Incolla tutto in Estensioni > Apps Script, al posto del codice precedente.

// Quale scheda riceve ogni "tipo" inviato dai Comandi rapidi.
const SCHEDE = {
  pagamento: 'Pagamenti',
  allenamento: 'Allenamenti',
  salute: 'Salute',
  pasto: 'Pasti',
  spesa: 'Spesa'
};

function doPost(e) {
  let dati;
  try {
    dati = JSON.parse(e.postData.contents);
  } catch (err) {
    return risposta({ ok: false, errore: 'JSON non valido' });
  }
  const param = e.parameter || {};
  // Il token può arrivare nel corpo (Comandi rapidi) o nell'URL (?token=..., Health Auto Export).
  if (!tokenValido(dati.token || param.token)) return risposta({ ok: false, errore: 'token non valido' });

  const tipo = String(dati.tipo || param.tipo || 'pagamento').toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (tipo === 'salute_auto') return risposta(importaHealthAutoExport(ss, dati, e.postData.contents));
    return risposta(aggiungiRiga(ss, tipo, dati));
  } finally {
    lock.releaseLock();
  }
}

// GET: senza parametri controlla che l'endpoint sia attivo;
// con ?tipo=lista&token=... restituisce l'ultima lista spesa preparata da Claude, una voce per riga.
function doGet(e) {
  const param = (e && e.parameter) || {};
  if (param.tipo === 'lista') {
    if (!tokenValido(param.token)) return testo('token non valido');
    return testo(ultimaListaSpesa());
  }
  if (param.tipo === 'dati') {
    if (!tokenValido(param.token)) return risposta({ ok: false, errore: 'token non valido' });
    return risposta(datiPerApp());
  }
  return risposta({ ok: true, messaggio: 'Endpoint Foglio Hub attivo' });
}

// ---------- Comandi rapidi: una riga per invio ----------

function aggiungiRiga(ss, tipo, dati) {
  const nomeScheda = SCHEDE[tipo];
  if (!nomeScheda) return { ok: false, errore: 'tipo sconosciuto: ' + tipo };
  const scheda = ss.getSheetByName(nomeScheda);
  if (!scheda) return { ok: false, errore: 'scheda mancante: ' + nomeScheda };

  dati.data = new Date();
  if (tipo === 'pagamento') {
    dati.importo = numero(dati.importo);
    dati.esercente = String(dati.esercente || '').trim();
    dati.categoria = dati.categoria || categoria(ss, dati.esercente);
    dati.fonte = dati.fonte || 'Apple Pay';
  }
  if (tipo === 'spesa') dati.totale = numero(dati.totale);

  // Ogni colonna prende il campo con lo stesso nome dell'intestazione: minuscolo,
  // senza la parte tra parentesi, _ al posto degli spazi. "FC media (bpm)" -> fc_media.
  const intestazioni = intestazioniDi(scheda);
  scheda.appendRow(intestazioni.map(function (h) {
    const v = dati[chiave(h)];
    return v === undefined || v === null ? '' : v;
  }));
  return { ok: true, scheda: nomeScheda };
}

// ---------- Health Auto Export ----------
// Accetta il JSON dell'automazione "REST API" (metriche e/o allenamenti).
// Le metriche diventano una riga al giorno in Salute (aggiornata se esiste già),
// gli allenamenti una riga ciascuno in Allenamenti (senza doppioni).

const METRICHE = {
  step_count: 'passi',
  resting_heart_rate: 'fc_riposo',
  weight_body_mass: 'peso',
  body_mass: 'peso',
  sleep_analysis: 'sonno'
};

function importaHealthAutoExport(ss, dati, grezzo) {
  registra(ss, grezzo);
  const corpo = dati.data || dati;

  // Metriche: raccolte per giorno, poi scritte tutte insieme.
  const perGiorno = {};
  (corpo.metrics || []).forEach(function (m) {
    const campo = METRICHE[m.name];
    if (!campo) return;
    (m.data || []).forEach(function (p) {
      const giorno = String(p.date || p.sleepStart || '').slice(0, 10);
      if (!giorno) return;
      let v;
      if (campo === 'sonno') {
        // Le versioni di iOS danno il sonno in campi diversi: prende il primo valore maggiore di zero.
        const fasi = (Number(p.core) || 0) + (Number(p.deep) || 0) + (Number(p.rem) || 0);
        v = [p.totalSleep, p.asleep, fasi, p.qty].map(Number).filter(function (x) { return x > 0; })[0];
      } else {
        v = p.qty != null ? Number(p.qty) : Number(p.Avg);
      }
      if (v == null || isNaN(v) || v <= 0) return;
      if (campo === 'peso' && /lb/i.test(m.units || '')) v = v * 0.453592;
      v = campo === 'passi' ? Math.round(v) : Math.round(v * 10) / 10;
      perGiorno[giorno] = perGiorno[giorno] || {};
      perGiorno[giorno][campo] = v;
    });
  });
  const giorni = scriviGiorni(ss.getSheetByName('Salute'), perGiorno);

  // Allenamenti: chiave = inizio + tipo, per non inserirli due volte.
  const scheda = ss.getSheetByName('Allenamenti');
  const intestazioni = intestazioniDi(scheda);
  const esistenti = {};
  if (scheda.getLastRow() > 1) {
    scheda.getRange(2, 1, scheda.getLastRow() - 1, 2).getValues().forEach(function (r) {
      if (r[0] instanceof Date) esistenti[r[0].getTime() + '|' + r[1]] = true;
    });
  }
  const nuove = [];
  (corpo.workouts || []).forEach(function (w) {
    const inizio = dataHAE(w.start);
    if (!inizio) return;
    const nome = nomeAllenamento(w.name);
    const k = inizio.getTime() + '|' + nome;
    if (esistenti[k]) return;
    esistenti[k] = true;
    const fine = dataHAE(w.end);
    const durataMin = w.duration != null ? Number(w.duration) / 60 : (fine ? (fine - inizio) / 60000 : '');
    const km = quantita(w.distance, 'km');
    const r = {
      data: inizio,
      tipo: nome,
      durata: durataMin === '' ? '' : Math.round(durataMin),
      distanza: km === '' ? '' : Math.round(km * 100) / 100,
      passo: km && durataMin ? passo(durataMin / km) : '',
      fc_media: arrotonda(quantita(w.avgHeartRate) || (w.heartRate && quantita(w.heartRate.avg))),
      kcal: arrotonda(quantita(w.activeEnergyBurned, 'kcal') || quantita(w.activeEnergy, 'kcal'))
    };
    nuove.push(intestazioni.map(function (h) {
      const v = r[chiave(h)];
      return v === undefined || v === null ? '' : v;
    }));
  });
  if (nuove.length) {
    scheda.getRange(scheda.getLastRow() + 1, 1, nuove.length, intestazioni.length).setValues(nuove);
    ordina(scheda, intestazioni.length);
  }
  return { ok: true, giorni: giorni, allenamenti: nuove.length };
}

// Una riga per giorno in Salute: legge tutto, aggiorna in memoria, riscrive in un colpo solo e ordina per data.
function scriviGiorni(scheda, perGiorno) {
  const giorniNuovi = Object.keys(perGiorno);
  if (!giorniNuovi.length) return 0;
  const intestazioni = intestazioniDi(scheda);
  const nc = intestazioni.length;
  const chiavi = intestazioni.map(chiave);
  const tz = Session.getScriptTimeZone();
  const n = scheda.getLastRow() - 1;
  const righe = n > 0 ? scheda.getRange(2, 1, n, nc).getValues() : [];
  const indice = {};
  righe.forEach(function (r, i) {
    const d = r[0];
    const s = d instanceof Date ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : String(d).slice(0, 10);
    if (s) indice[s] = i;
  });
  giorniNuovi.forEach(function (giorno) {
    let i = indice[giorno];
    if (i === undefined) {
      const p = giorno.split('-');
      const riga = chiavi.map(function () { return ''; });
      riga[0] = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      righe.push(riga);
      i = righe.length - 1;
      indice[giorno] = i;
    }
    chiavi.forEach(function (k, c) {
      const v = perGiorno[giorno][k];
      if (v !== undefined && v !== '') righe[i][c] = v;
    });
  });
  scheda.getRange(2, 1, righe.length, nc).setValues(righe);
  ordina(scheda, nc);
  return giorniNuovi.length;
}

function ordina(scheda, nc) {
  if (scheda.getLastRow() > 2) scheda.getRange(2, 1, scheda.getLastRow() - 1, nc).sort({ column: 1, ascending: true });
}

// Tiene gli ultimi 30 invii grezzi di Health Auto Export nella scheda "Registro", per capire cosa arriva.
function registra(ss, grezzo) {
  let s = ss.getSheetByName('Registro');
  if (!s) { s = ss.insertSheet('Registro'); s.appendRow(['Data', 'Contenuto (primi 45.000 caratteri)']); }
  s.appendRow([new Date(), String(grezzo).slice(0, 45000)]);
  const extra = s.getLastRow() - 31;
  if (extra > 0) s.deleteRows(2, extra);
}

// "2026-11-23 07:15:00 +0100" -> Date
function dataHAE(v) {
  if (!v) return null;
  const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\s*([+-]\d{2}):?(\d{2})?/);
  if (m) return new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] + m[7] + ':' + (m[8] || '00'));
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

// {qty: 5.2, units: "km"} -> 5.2 (converte miglia e metri in km, kJ in kcal)
function quantita(q, unita) {
  if (q == null) return '';
  if (typeof q === 'number') return q;
  if (q.qty == null) return '';
  let v = Number(q.qty);
  if (unita === 'km' && /^mi/i.test(q.units || '')) v = v * 1.60934;
  if (unita === 'km' && /^m$/i.test(q.units || '')) v = v / 1000;
  if (unita === 'kcal' && /^kj$/i.test(q.units || '')) v = v / 4.184;
  return v;
}

// Nomi di Salute tradotti male in italiano ("Esegui" = Run) -> nomi leggibili.
const NOMI = [
  [/^interno esegui$/i, 'Corsa al chiuso'], [/^all'aperto esegui$/i, 'Corsa'],
  [/^interno camminata$/i, 'Camminata al chiuso'], [/^all'aperto camminata$/i, 'Camminata'],
  [/^all'aperto ciclismo$/i, 'Bici'], [/^interno ciclismo$/i, 'Bici al chiuso'],
  [/^apri acqua nuoto$/i, 'Nuoto in acque libere'], [/^piscina nuoto$/i, 'Nuoto in piscina'],
  [/^allenamento di forza tradizionale$/i, 'Forza'], [/^scalata$/i, 'Scale']
];
function nomeAllenamento(n) {
  const t = String(n || 'Allenamento').trim();
  for (let i = 0; i < NOMI.length; i++) if (NOMI[i][0].test(t)) return NOMI[i][1];
  return t;
}

// Da lanciare UNA volta dall'editor: sistema le righe già importate con la versione 3
// (nomi leggibili e kcal: prima erano kJ).
function correggiAllenamenti() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Allenamenti');
  const h = intestazioniDi(sh).map(chiave);
  const iTipo = h.indexOf('tipo'), iKcal = h.indexOf('kcal');
  const prop = PropertiesService.getScriptProperties();
  if (prop.getProperty('ALLENAMENTI_CORRETTI')) { Logger.log('Già fatto, non serve rilanciarla.'); return; }
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const r = sh.getRange(2, 1, n, h.length).getValues();
  r.forEach(function (x) {
    x[iTipo] = nomeAllenamento(x[iTipo]);
    if (typeof x[iKcal] === 'number') x[iKcal] = Math.round(x[iKcal] / 4.184);
  });
  sh.getRange(2, 1, n, h.length).setValues(r);
  prop.setProperty('ALLENAMENTI_CORRETTI', '1');
  Logger.log('Corrette ' + n + ' righe.');
}

function passo(minPerKm) {
  const m = Math.floor(minPerKm), s = Math.round((minPerKm - m) * 60);
  return s === 60 ? (m + 1) + ':00' : m + ':' + (s < 10 ? '0' : '') + s;
}

function arrotonda(v) { return v === '' || v == null || isNaN(v) ? '' : Math.round(Number(v)); }

// ---------- Lista spesa ----------
// Legge da Drive il file più recente chiamato "Lista spesa" (lo crea Claude ogni settimana).
function ultimaListaSpesa() {
  const files = DriveApp.getFilesByName('Lista spesa');
  let ultimo = null;
  while (files.hasNext()) {
    const f = files.next();
    if (!ultimo || f.getDateCreated() > ultimo.getDateCreated()) ultimo = f;
  }
  if (!ultimo) return '';
  const testoFile = ultimo.getMimeType() === MimeType.GOOGLE_DOCS
    ? DocumentApp.openById(ultimo.getId()).getBody().getText()
    : ultimo.getBlob().getDataAsString();
  return testoFile.split(/\r?\n/).map(function (r) { return r.replace(/^[-*•\s]+/, '').trim(); })
    .filter(function (r) { return r && !/^#/.test(r); }).join('\n');
}

// ---------- Dati per l'app (PWA) ----------
// ?tipo=dati&token=... -> tutte le schede utili in JSON, una riga = un oggetto con le chiavi delle intestazioni.
function datiPerApp() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const oggi = new Date();
  const giorniFa = function (n) { return new Date(oggi.getTime() - n * 86400000); };
  return {
    ok: true,
    aggiornato: Utilities.formatDate(oggi, tz, "yyyy-MM-dd'T'HH:mm:ss"),
    salute: righeDi(ss, 'Salute', tz, giorniFa(400)),
    allenamenti: righeDi(ss, 'Allenamenti', tz, null),
    pasti: righeDi(ss, 'Pasti', tz, giorniFa(60)),
    pagamenti: righeDi(ss, 'Pagamenti', tz, giorniFa(400)),
    movimenti: righeDi(ss, 'Movimenti banca', tz, giorniFa(400)),
    spesa: righeDi(ss, 'Spesa', tz, giorniFa(400)),
    casa: righeDi(ss, 'Casa', tz, null),
    lista: ultimaListaSpesa().split('\n').filter(String),
    piano: pianoSettimana()
  };
}

function righeDi(ss, nome, tz, dal) {
  const sh = ss.getSheetByName(nome);
  if (!sh || sh.getLastRow() < 2) return [];
  const h = intestazioniDi(sh).map(chiave);
  return sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues()
    .filter(function (r) { return r.some(function (v) { return v !== ''; }); })
    .filter(function (r) { return !dal || !(r[0] instanceof Date) || r[0] >= dal; })
    .map(function (r) {
      const o = {};
      h.forEach(function (k, i) {
        const v = r[i];
        if (v === '' || v == null) return;
        o[k] = v instanceof Date ? Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ss") : v;
      });
      return o;
    });
}

// File JSON "Piano settimana" su Drive (lo crea Claude la domenica). Se non c'è: null.
function pianoSettimana() {
  const files = DriveApp.getFilesByName('Piano settimana');
  let ultimo = null;
  while (files.hasNext()) {
    const f = files.next();
    if (!ultimo || f.getDateCreated() > ultimo.getDateCreated()) ultimo = f;
  }
  if (!ultimo) return null;
  try { return JSON.parse(ultimo.getBlob().getDataAsString()); } catch (err) { return null; }
}

// ---------- Utilità ----------

function tokenValido(t) {
  const atteso = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return !!atteso && t === atteso;
}

function intestazioniDi(scheda) {
  return scheda.getRange(1, 1, 1, scheda.getLastColumn()).getValues()[0];
}

function chiave(intestazione) {
  return String(intestazione).toLowerCase().replace(/\s*\(.*?\)/g, '').trim().replace(/\s+/g, '_');
}

// "€ 1.234,56", "23,40 €", "23.40" o 23.4 -> 23.4
function numero(v) {
  if (typeof v === 'number') return v;
  let s = String(v || '').replace(/[^\d,.\-]/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? '' : n;
}

// Prima parola chiave della scheda Categorie contenuta nel nome dell'esercente.
function categoria(ss, esercente) {
  const scheda = ss.getSheetByName('Categorie');
  if (!scheda || scheda.getLastRow() < 2) return 'Da classificare';
  const righe = scheda.getRange(2, 1, scheda.getLastRow() - 1, 2).getValues();
  const nome = esercente.toLowerCase();
  for (let i = 0; i < righe.length; i++) {
    const parola = String(righe[i][0]).toLowerCase().trim();
    if (parola && nome.indexOf(parola) >= 0) return righe[i][1];
  }
  return 'Da classificare';
}

function risposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function testo(t) {
  return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT);
}

// Prova senza iPhone: scrive un giorno in Salute e una corsa in Allenamenti. Poi cancella le righe.
function prova() {
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  const esempio = { data: {
    metrics: [
      { name: 'step_count', units: 'count', data: [{ date: '2026-11-22 00:00:00 +0100', qty: 9876 }] },
      { name: 'resting_heart_rate', units: 'count/min', data: [{ date: '2026-11-22 00:00:00 +0100', qty: 56 }] },
      { name: 'weight_body_mass', units: 'kg', data: [{ date: '2026-11-22 00:00:00 +0100', qty: 72.4 }] },
      { name: 'sleep_analysis', units: 'hr', data: [{ date: '2026-11-22 00:00:00 +0100', totalSleep: 7.25 }] }
    ],
    workouts: [{ name: 'Corsa all\'aperto', start: '2026-11-22 08:00:00 +0100', end: '2026-11-22 08:32:00 +0100',
      duration: 1920, distance: { qty: 5.4, units: 'km' }, avgHeartRate: { qty: 151, units: 'bpm' },
      activeEnergyBurned: { qty: 380, units: 'kcal' } }]
  } };
  const finto = { parameter: { token: token, tipo: 'salute_auto' }, postData: { contents: JSON.stringify(esempio) } };
  Logger.log(doPost(finto).getContent());
}
