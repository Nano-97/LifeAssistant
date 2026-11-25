// Schede di allenamento (ciclo di 4 settimane, dal piano settimanale).
// Si aggiornano qui quando cambia il piano.
const PROGRAMMA = {
  aggiornato: '2026-11-23',
  nota: "Prime 2 settimane a intensità media: a fine serie tieni 2-3 ripetizioni in serbo.",
  settimana: {
    1: 'A', // lunedì
    2: 'CORSA',
    3: 'B',
    4: 'RIPOSO',
    5: 'C',
    6: 'LIBERO',
    0: 'RIPOSO_DOM'
  },
  // Spostamenti su date precise (yyyy-mm-dd), hanno la precedenza sulla settimana tipo.
  eccezioni: {
    '2026-11-25': 'RIPOSO', // seduta B spostata a giovedì
    '2026-11-26': 'B'
  },
  schede: {
    RISCALDAMENTO: {
      nome: 'Riscaldamento spalla', dove: 'Ogni seduta', durata: '10 min',
      intro: 'La parte più importante: tiene a bada il dolore alla spalla destra.',
      esercizi: [
        { nome: 'Rotazioni braccia e cerchi con le spalle', serie: 1, rip: '1 min' },
        { nome: 'Rotazioni esterne con elastico, gomito al fianco', serie: 2, rip: '15 per braccio' },
        { nome: 'Face pull con elastico', serie: 2, rip: '15' },
        { nome: 'Pull-apart con elastico', serie: 2, rip: '15' },
        { nome: 'Scapular push-up', serie: 2, rip: '10' },
        { nome: 'Scapular pull alla sbarra', serie: 2, rip: '8' },
        { nome: 'Sospensione passiva', serie: 2, rip: '30 sec' }
      ]
    },
    A: {
      nome: 'Seduta A: spinta, core e gambe', dove: 'Casa', durata: '50 min', riscaldamento: true,
      esercizi: [
        { nome: 'Dip alle parallele', serie: 3, rip: '6-10', nota: 'Scendi lento, 3 secondi' },
        { nome: 'Pike push-up', serie: 3, rip: '8-10', nota: "Prepara il ritorno all'handstand" },
        { nome: 'Piegamenti', serie: 3, rip: '12-15' },
        { nome: 'Tuck planche lean alle parallele', serie: 4, rip: '15 sec', nota: 'Con calma' },
        { nome: 'Bulgarian split squat', serie: 3, rip: '10 per gamba' },
        { nome: 'Tuck L-sit alle parallele', serie: 4, rip: '15 sec' },
        { nome: 'Hollow body hold', serie: 3, rip: '30 sec' }
      ]
    },
    B: {
      nome: 'Seduta B: tirata e arrampicata', dove: 'Casa', durata: '50 min', riscaldamento: true,
      esercizi: [
        { nome: 'Trazioni', serie: 4, rip: '5-8', nota: 'Con elastico se non arrivi a 5' },
        { nome: 'Rematore inverso alle parallele', serie: 3, rip: '10-12' },
        { nome: 'Tuck front lever', serie: 4, rip: '10 sec' },
        { nome: 'Hangboard: tacca larga', serie: 6, rip: '10 sec', nota: '2 min di pausa, 4 dita, mai fino al dolore. Prima volta a piedi appoggiati' },
        { nome: 'Ponte glutei a una gamba', serie: 3, rip: '12 per gamba' },
        { nome: 'Hanging knee raise', serie: 3, rip: '10' }
      ]
    },
    C: {
      nome: 'Seduta C: circuito dinamico', dove: 'Fuori', durata: '45 min', riscaldamento: true,
      intro: '10 min di corsa leggera, poi 4 giri del circuito (1 min di pausa tra i giri), poi 10-15 min di corsa facile.',
      giri: 4,
      esercizi: [
        { nome: 'Squat jump', rip: '10' },
        { nome: 'Affondi camminati', rip: '12 per gamba' },
        { nome: 'Burpees', rip: '8' },
        { nome: 'Skip alto', rip: '20 sec' },
        { nome: 'Sprint in salita o in piano', rip: '2 x 15 sec' },
        { nome: 'Plank laterale', rip: '30 sec per lato' }
      ]
    },
    CORSA: {
      nome: 'Corsa facile', dove: 'Fuori', durata: '20-30 min',
      intro: "Ritmo facile, 7:15-7:45/km: devi riuscire a parlare. Prime 2 settimane: 4 min di corsa e 1 di camminata. Poi corsa continua fino a 40 min.",
      esercizi: [
        { nome: 'Corsa 4 min + camminata 1 min', serie: 4, rip: 'ripetizioni' }
      ]
    },
    RIPOSO: { nome: 'Riposo attivo', dove: 'Ovunque', durata: '15-20 min', intro: 'Camminata o mobilità.', esercizi: [] },
    LIBERO: { nome: 'Sport libero (bonus)', dove: 'Fuori', durata: 'a piacere', intro: 'Padel, tennis o calcetto. Da febbraio diventa la corsa lunga.', esercizi: [] },
    RIPOSO_DOM: { nome: 'Riposo', dove: '', durata: '', intro: 'Giorno libero. La domenica sera arriva il piano nuovo.', esercizi: [] }
  },
  progressione: [
    ['Settimane 1-2', 'come scritto.'],
    ['Settimane 3-4', "+1-2 ripetizioni o +5 secondi alle tenute, un quinto giro nel circuito."],
    ['Fine mese', 'test: trazioni massime, dip massimi, 5 km di corsa. Poi nuovo piano.']
  ]
};
