// Menu della settimana, ricette e lista spesa per reparto (dal piano settimanale).
// Se il foglio manda un piano più recente (dati.piano.menu / dati.piano.spesa), l'app usa quello.
const MENU = {
  settimana: '2026-11-23',
  // 1 = lunedì ... 0 = domenica
  giorni: {
    1: { colazione: 'col-lun', pranzo: 'Mensa', spuntino: "Banana e mandorle, prima dell'allenamento", cena: 'salmone' },
    2: { colazione: 'col-mar', pranzo: 'Mensa', spuntino: 'Yogurt greco con miele', cena: 'frittata' },
    3: { colazione: 'col-mer', pranzo: 'Mensa', spuntino: 'Pane integrale con hummus', cena: 'zuppa' },
    4: { colazione: 'col-gio', pranzo: 'Mensa', spuntino: 'Mandarini e noci', cena: 'merluzzo' },
    5: { colazione: 'col-ven', pranzo: 'Mensa', spuntino: "Banana con un cucchiaio di burro d'arachidi", cena: 'libero' },
    6: { colazione: 'col-sab', pranzo: 'pasta-broccoli', spuntino: 'Yogurt greco con frutta', cena: 'burger' },
    0: { colazione: 'col-dom', pranzo: 'risotto', spuntino: 'Mela e mandorle', cena: 'piadina' }
  },
  ricette: {
    'col-lun': { nome: 'Yogurt greco con avena, banana e noci', tempo: '3 min',
      ingredienti: ['170 g di yogurt greco', "3 cucchiai di fiocchi d'avena", '1 banana', 'Una manciata di noci'], passi: ['Metti tutto in una ciotola e mescola.'] },
    'col-mar': { nome: 'Pane integrale tostato, 2 uova strapazzate, mandarini', tempo: '8 min',
      ingredienti: ['2 uova', '2 fette di pane integrale', '2 mandarini'], passi: ['Tosta il pane.', 'Strapazza le uova in padella a fuoco basso per 2-3 minuti, sala.'] },
    'col-mer': { nome: "Porridge d'avena col latte, banana e burro d'arachidi", tempo: '6 min',
      ingredienti: ["50 g di fiocchi d'avena", '250 ml di latte', '1 banana', "1 cucchiaio di burro d'arachidi"], passi: ['Cuoci avena e latte a fuoco medio per 4-5 minuti, mescolando.', "Aggiungi la banana a rondelle e il burro d'arachidi."] },
    'col-gio': { nome: 'Yogurt greco con avena, mela e mandorle', tempo: '3 min',
      ingredienti: ['170 g di yogurt greco', "3 cucchiai di fiocchi d'avena", '1 mela a pezzi', 'Una manciata di mandorle'], passi: ['Metti tutto in una ciotola e mescola.'] },
    'col-ven': { nome: 'Pane integrale tostato con ricotta e miele, un frutto', tempo: '4 min',
      ingredienti: ['2 fette di pane integrale', '80 g di ricotta', '1 cucchiaino di miele', '1 frutto'], passi: ['Tosta il pane, spalma la ricotta e un filo di miele.'] },
    'col-sab': { nome: "Porridge d'avena col latte, mela e cannella", tempo: '6 min',
      ingredienti: ["50 g di fiocchi d'avena", '250 ml di latte', '1 mela a cubetti', 'Cannella'], passi: ['Cuoci avena, latte e mela a fuoco medio per 5 minuti, mescolando.', 'Spolvera di cannella.'] },
    'col-dom': { nome: "2 uova strapazzate, pane integrale, spremuta d'arancia", tempo: '10 min',
      ingredienti: ['2 uova', '2 fette di pane integrale', '2-3 arance'], passi: ['Spremi le arance.', 'Strapazza le uova a fuoco basso 2-3 minuti e servi con il pane tostato.'] },
    salmone: {
      nome: 'Salmone al forno, patate e zucchine', tempo: '25 min',
      ingredienti: ['1 trancio di salmone (150 g)', '150 g di patate', '1 zucchina', 'Olio, sale, limone, rosmarino'],
      passi: ['Forno a 200 °C. Taglia le patate a cubetti piccoli e le zucchine a rondelle, condisci con olio, sale e rosmarino.', 'Inforna le patate per 10 minuti, poi aggiungi zucchine e salmone (sale e limone sopra).', 'Cuoci altri 12-15 minuti, finché il salmone si sfalda.']
    },
    frittata: {
      nome: 'Frittata di spinaci e ricotta, pane integrale, insalata', tempo: '20 min',
      ingredienti: ['3 uova', '150 g di spinaci (anche surgelati)', '80 g di ricotta', '1 cucchiaio di grana', 'Pane integrale, insalata mista'],
      passi: ['Salta gli spinaci in padella con un filo d\'olio per 3-4 minuti, sala.', 'Sbatti uova, ricotta e grana, unisci gli spinaci.', 'Versa in padella antiaderente, coperchio, fuoco basso 6-7 minuti; gira con un piatto e altri 2 minuti.', 'Servi con pane e insalata.']
    },
    zuppa: {
      nome: 'Zuppa di lenticchie rosse e carote, crostini', tempo: '5 min (preparata domenica)',
      ingredienti: ['La porzione di zuppa preparata domenica', 'Pane integrale per i crostini', 'Olio a crudo'],
      passi: ['Scalda la zuppa in pentola o al microonde.', 'Tosta il pane e servi con un filo d\'olio a crudo.'],
      nota: 'Domenica: soffriggi cipolla, carota e sedano, aggiungi 250 g di lenticchie rosse e 1 l di brodo, cuoci 20 minuti e frulla in parte. Due porzioni: una per mercoledì, una in freezer.'
    },
    merluzzo: {
      nome: 'Merluzzo con pomodorini e olive, cous cous, broccoli', tempo: '20 min',
      ingredienti: ['200 g di filetti di merluzzo', '8 pomodorini', 'Una manciata di olive', '70 g di cous cous', '200 g di broccoli', 'Aglio, olio'],
      passi: ['Cuoci i broccoli a cimette in acqua salata 6-7 minuti.', 'In padella: olio, aglio, pomodorini tagliati e olive per 3 minuti, poi il merluzzo con coperchio 6-8 minuti.', 'Cous cous: stessa quantità di acqua bollente salata, copri 5 minuti e sgrana con una forchetta.']
    },
    libero: { nome: 'Pasto libero (pizza, uscita)', tempo: '', ingredienti: [], passi: ['Goditela, senza sensi di colpa.'] },
    'pasta-broccoli': {
      nome: 'Pasta integrale con broccoli, acciughe e pangrattato', tempo: '20 min',
      ingredienti: ['90 g di pasta integrale', '250 g di broccoli', '3 filetti di acciuga', '2 cucchiai di pangrattato', 'Aglio, olio, peperoncino'],
      passi: ['Cuoci i broccoli nell\'acqua della pasta per 5 minuti, poi butta la pasta nella stessa acqua.', 'In padella: olio, aglio e acciughe finché si sciolgono; tosta a parte il pangrattato.', 'Scola pasta e broccoli, saltali in padella e finisci con il pangrattato.']
    },
    burger: {
      nome: 'Burger di manzo, patate dolci al forno, insalata', tempo: '30 min',
      ingredienti: ['150 g di macinato di manzo', '1-2 patate dolci', 'Insalata', 'Sale, pepe, olio'],
      passi: ['Forno a 200 °C: patate dolci a spicchi con olio e sale per 25 minuti.', 'Forma il burger, sale e pepe; piastra o padella ben calda 3-4 minuti per lato.', 'Servi con l\'insalata.']
    },
    risotto: {
      nome: 'Risotto alla zucca e grana', tempo: '25 min',
      ingredienti: ['80 g di riso', '200 g di zucca a cubetti', '1/2 cipolla', 'Brodo vegetale caldo', '2 cucchiai di grana'],
      passi: ['Soffriggi la cipolla, aggiungi la zucca e un mestolo di brodo, cuoci 5 minuti.', 'Tosta il riso 1 minuto, poi brodo un mestolo alla volta per 16-18 minuti.', 'Fuori dal fuoco manteca con il grana.']
    },
    piadina: {
      nome: 'Piadina con bresaola, rucola e grana, yogurt con frutta', tempo: '5 min',
      ingredienti: ['1 piadina', '80 g di bresaola', 'Rucola', 'Scaglie di grana', 'Yogurt greco e frutta'],
      passi: ['Scalda la piadina in padella 1 minuto per lato.', 'Farcisci con bresaola, rucola e grana.', 'Dessert: yogurt greco con frutta.']
    }
  },
  // Reparti nell'ordine predefinito: l'ordine dei corridoi lo sistemi dall'app.
  spesa: [
    { reparto: 'Frutta e verdura', voci: ['Banane (5)', 'Mele (4)', 'Mandarini (1 kg)', "Arance da spremuta (3)", 'Rucola (1 busta)', 'Insalata mista (2 buste)', 'Pomodorini (250 g)', 'Zucchine (2)', 'Broccoli (600 g)', 'Zucca (400 g)', 'Patate (300 g)', 'Patate dolci (2)', 'Carote (4)', 'Cipolle (2)', 'Sedano', 'Aglio', 'Limone'] },
    { reparto: 'Pane e forno', voci: ['Pane integrale', 'Piadine (1 confezione)'] },
    { reparto: 'Carne e salumi', voci: ['Macinato di manzo (150 g)', 'Bresaola (80 g)'] },
    { reparto: 'Pesce', voci: ['Salmone (1 trancio, 150 g)'] },
    { reparto: 'Latticini e uova', voci: ['Uova (10)', 'Yogurt greco bianco (1 kg)', 'Latte (1 l)', 'Ricotta (350 g)', 'Grana (150 g)'] },
    { reparto: 'Pasta, riso e cereali', voci: ['Riso da risotto (500 g)', 'Pasta integrale (500 g)', 'Cous cous (500 g)', 'Fiocchi d\'avena (500 g)'] },
    { reparto: 'Legumi e conserve', voci: ['Lenticchie rosse secche (500 g)', 'Acciughe sott\'olio', 'Olive', 'Hummus'] },
    { reparto: 'Colazione e frutta secca', voci: ['Burro d\'arachidi', 'Mandorle e noci (200 g)', 'Miele', 'Cannella'] },
    { reparto: 'Olio, condimenti e brodo', voci: ['Pangrattato', 'Olio extravergine (se finito)', 'Brodo vegetale (se finito)'] },
    { reparto: 'Surgelati', voci: ['Filetti di merluzzo (200 g)', 'Spinaci (300 g)'] }
  ]
};
