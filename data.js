/* Dades de mostra de La Bona Party — agenda d'estiu 2026 plena de festes majors arreu de Catalunya */

(function () {
  "use strict";

  function pad2(n) { return String(n).padStart(2, "0"); }
  function fridayOffset(n) {
    var d = new Date(2026, 7, 7); // 2026-08-07 és divendres
    d.setDate(d.getDate() + 7 * n);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function addDays(dateStr, n) {
    var p = dateStr.split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2] + n);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  var TODAY = "2026-08-07";

  var BANDS = [
    { id: "b1", name: "Ombra Elèctrica", genre: "Rock", city: "Barcelona", rate: 3200, contact: "Pere Camps", phone: "+34 611 335 902", members: ["Pere Camps — veu", "Anna Vidal — guitarra", "Jordi Roca — baix", "Nil Serra — bateria"], crew: ["Marc Oliva — road mànager", "Sílvia Puig — tècnic de so", "Kevin Ross — tècnic de llums", "Toni Sabaté — backliner"] },
    { id: "b2", name: "Vertigen", genre: "Rock", city: "Sabadell", rate: 2900, contact: "Ricard Solé", phone: "+34 699 340 662", members: ["Ricard Solé — veu", "Joan Farré — guitarra", "Berta Coll — baix", "Xavi Martorell — bateria"], crew: ["Laia Montaner — mànager", "Ferran Duocastella — tècnic de so", "Guim Prat — backliner"] },
    { id: "b3", name: "Llamp Negre", genre: "Rock", city: "Terrassa", rate: 2600, contact: "Martí Puig", phone: "+34 633 210 447", members: ["Martí Puig — veu i guitarra", "Clàudia Ferrer — baix", "Bru Camps — bateria"], crew: ["Elisenda Ros — tècnic de so", "Marçal Vidal — backliner"] },
    { id: "b4", name: "Sucre Amarg", genre: "Pop", city: "Tarragona", rate: 2700, contact: "Eva Ribas", phone: "+34 644 902 118", members: ["Eva Ribas — veu", "Oriol Guix — guitarra", "Maria Prat — baix", "Pol Aguilar — bateria", "Sara Duran — teclats"], crew: ["Anna Baró — road mànager", "Jofre Camps — tècnic de so", "Núria Estévez — tècnic de llums"] },
    { id: "b5", name: "Cinta Rosa", genre: "Pop", city: "Reus", rate: 2200, contact: "Judit Amat", phone: "+34 611 908 254", members: ["Judit Amat — veu", "Sergi Bofarull — guitarra", "Nuri Cases — teclats"], crew: ["Robert Alsina — mànager", "Meritxell Soto — tècnic de so"] },
    { id: "b6", name: "Orquestra Maragda", genre: "Pop", city: "Vilafranca del Penedès", rate: 3400, contact: "Manel Rovira", phone: "+34 622 774 108", members: ["Manel Rovira — direcció i teclats", "Cristina Vall — veu", "Toni Batlle — veu", "Ferran Solé — trompeta", "Queralt Nogué — saxo", "Biel Ros — bateria"], crew: ["Ignasi Bertran — road mànager", "Carme Nogués — tècnic de so", "Dídac Farreras — tècnic de llums", "Empar Solivera — vestuari"] },
    { id: "b7", name: "Riu de Coure", genre: "Indie", city: "Girona", rate: 2300, contact: "Marta Puig", phone: "+34 622 104 587", members: ["Marta Puig — veu i guitarra", "Toni Bosch — baix", "Laia Ferrer — bateria", "Quim Soler — teclats"], crew: ["Pol Estruch — mànager", "Judith Camp — tècnic de so"] },
    { id: "b8", name: "Cor de Ferro", genre: "Indie", city: "Manresa", rate: 2000, contact: "Helena Puig", phone: "+34 633 456 890", members: ["Helena Puig — veu", "Marc Vallès — guitarra", "Dani Roig — baix", "Queralt Sans — bateria"], crew: ["Adrià Font — tècnic de so"] },
    { id: "b9", name: "Llum de Gener", genre: "Indie", city: "Vic", rate: 1900, contact: "Gerard Feixas", phone: "+34 655 320 774", members: ["Gerard Feixas — veu i guitarra", "Anna Coromina — baix", "Pau Riera — bateria"], crew: ["Bernat Colomer — mànager", "Txell Aymerich — tècnic de so"] },
    { id: "b10", name: "Nit de Neó", genre: "Electrònica", city: "Barcelona", rate: 1900, contact: "Clara Mas", phone: "+34 633 774 210", members: ["Clara Mas — producció i DJ", "Bru Font — visuals"], crew: ["Max Riera — tècnic de so"] },
    { id: "b11", name: "Pols Digital", genre: "Electrònica", city: "Girona", rate: 1600, contact: "Martí Grau", phone: "+34 622 887 019", members: ["Martí Grau — producció i DJ"], crew: ["Iu Callís — tècnic de so i llums"] },
    { id: "b12", name: "Quintet Blau", genre: "Jazz", city: "Barcelona", rate: 1700, contact: "Jaume Vila", phone: "+34 655 214 763", members: ["Jaume Vila — trompeta", "Núria Costa — piano", "Marc Isern — contrabaix", "Roc Alsina — bateria", "Lídia Ortiz — saxo"], crew: ["Glòria Munné — mànager", "Ot Vergés — tècnic de so"] },
    { id: "b13", name: "Blue Note Cinc", genre: "Jazz", city: "Sitges", rate: 1600, contact: "Anton Fages", phone: "+34 611 774 903", members: ["Anton Fages — piano", "Roser Camps — contrabaix", "Ivan Prats — bateria", "Georgina Salas — veu", "Oleguer Bosch — trompeta"], crew: ["Ariadna Pallàs — tècnic de so"] },
    { id: "b14", name: "Los Compadres", genre: "Flamenc/Rumba", city: "L'Hospitalet de Llobregat", rate: 2100, contact: "Rafael Heredia", phone: "+34 666 481 305", members: ["Rafael Heredia — veu i cajón", "Chico Montoya — guitarra", "Dolores Salazar — palmes i veu"], crew: ["Manuel Cortés — mànager", "Pilar Vega — tècnic de so"] },
    { id: "b15", name: "Compàs de Foc", genre: "Flamenc/Rumba", city: "Badalona", rate: 1900, contact: "Manolo Reyes", phone: "+34 677 542 390", members: ["Manolo Reyes — veu i guitarra", "Fina Amaya — palmes", "Kiko Vargas — cajón"], crew: ["Rocío Flores — tècnic de so"] },
    { id: "b16", name: "MC Llamp", genre: "Hip-hop", city: "Mataró", rate: 1500, contact: "David Peña", phone: "+34 677 220 934", members: ["David Peña — MC", "Aitor Nuñez — DJ i producció"], crew: ["Yasmina Bouzid — tècnic de so"] },
    { id: "b17", name: "Flow del Segre", genre: "Hip-hop", city: "Lleida", rate: 1400, contact: "Bilal Ouazzani", phone: "+34 688 210 556", members: ["Bilal Ouazzani — MC", "Nico Farran — producció"], crew: ["Hamza Idrissi — tècnic de so i llums"] },
    { id: "b18", name: "Arrels de Bosc", genre: "Folk/Tradicional", city: "Olot", rate: 1700, contact: "Montserrat Illa", phone: "+34 688 553 471", members: ["Montserrat Illa — veu i flabiol", "Enric Pons — acordió", "Gerard Xifré — guitarra", "Alba Reig — violí"], crew: ["Genís Vila — mànager", "Roser Batlle — tècnic de so"] },
    { id: "b19", name: "Cobla Vent del Nord", genre: "Folk/Tradicional", city: "Girona", rate: 1800, contact: "Salvador Puig", phone: "+34 622 340 981", members: ["Salvador Puig — tible", "Empar Costa — tenora", "Ramon Alsina — fiscorn", "Núria Batet — flabiol i tamborí"], crew: ["Jaume Serrat — road mànager", "Anna Puigdemont — tècnic de so"] },
    { id: "b20", name: "Trencadansa", genre: "Folk/Tradicional", city: "Berga", rate: 1600, contact: "Roger Vilaseca", phone: "+34 611 402 738", members: ["Roger Vilaseca — gralla", "Marina Font — percussió", "Pol Camprubí — baix"], crew: ["Martina Grau — tècnic de so"] }
  ];

  function parsePeople(list) {
    return list.map(function (s) {
      var idx = s.indexOf(" — ");
      return idx === -1 ? { name: s, role: "" } : { name: s.slice(0, idx), role: s.slice(idx + 3) };
    });
  }
  BANDS.forEach(function (b) {
    b.tags = [b.genre];
    delete b.genre;
    b.members = parsePeople(b.members);
    b.crew = parsePeople(b.crew);
  });

  // Festes majors d'arreu de Catalunya on toquen els grups de la casa, escampades tot l'estiu (juny–setembre 2026)
  var FESTES = [
    { city: "Berga", venue: "Plaça de Sant Pere", n: -9, nights: 2, tier: 0 },
    { city: "Terrassa", venue: "Rambla d'Ègara", n: -6, nights: 2, tier: 300 },
    { city: "Reus", venue: "Plaça del Mercadal", n: -6, nights: 2, tier: 200 },
    { city: "Rubí", venue: "Plaça del Doctor Guardiet", n: -5, nights: 2, tier: 100 },
    { city: "Sant Feliu de Guíxols", venue: "Passeig del Mar", n: -4, nights: 2, tier: 100 },
    { city: "Palamós", venue: "Passeig del Mar", n: -4, nights: 2, tier: 100 },
    { city: "Girona", venue: "Plaça del Vi", n: -4, nights: 2, tier: 300 },
    { city: "Mataró", venue: "La Riera", n: -2, nights: 2, tier: 300 },
    { city: "Calella", venue: "Passeig Marítim", n: -2, nights: 2, tier: 100 },
    { city: "Blanes", venue: "Passeig de Mar", n: -2, nights: 2, tier: 100 },
    { city: "Lloret de Mar", venue: "Plaça de l'Església", n: -2, nights: 2, tier: 200 },
    { city: "Tortosa", venue: "Plaça de l'Ajuntament", n: -2, nights: 2, tier: 100 },
    { city: "Vilanova i la Geltrú", venue: "Rambla Principal", n: -1, nights: 2, tier: 200 },
    { city: "El Vendrell", venue: "Rambla del Pau Casals", n: -1, nights: 2, tier: 100 },
    { city: "Barcelona (Gràcia)", venue: "Plaça de la Vila de Gràcia", n: 1, nights: 3, tier: 500 },
    { city: "Banyoles", venue: "Plaça dels Turers", n: 1, nights: 2, tier: 100 },
    { city: "Vic", venue: "Plaça Major", n: 2, nights: 2, tier: 200 },
    { city: "Igualada", venue: "Rambla de Sant Isidre", n: 2, nights: 2, tier: 100 },
    { city: "Sitges", venue: "Passeig de la Ribera", n: 3, nights: 2, tier: 300 },
    { city: "Vilafranca del Penedès", venue: "Plaça de la Vila", n: 3, nights: 2, tier: 200 },
    { city: "Figueres", venue: "La Rambla", n: 4, nights: 2, tier: 200 },
    { city: "Olot", venue: "Firal", n: 4, nights: 2, tier: 100 },
    { city: "Cambrils", venue: "Passeig Marítim", n: 5, nights: 2, tier: 100 },
    { city: "Manresa", venue: "Plaça Major", n: 5, nights: 2, tier: 200 },
    { city: "Lleida", venue: "Plaça de Sant Joan", n: 6, nights: 2, tier: 200 },
    { city: "Manlleu", venue: "Plaça Fra Bernadí", n: 7, nights: 2, tier: 100 }
  ];

  var CONCERTS = [];
  var usedSlots = {}; // "date|bandId" -> true, evita dobles reserves la mateixa nit
  var counter = 0;

  FESTES.forEach(function (festa) {
    var friday = fridayOffset(festa.n);
    for (var i = 0; i < festa.nights; i++) {
      var date = addDays(friday, i);
      var time = i === 2 ? "19:30" : (i === 0 ? "22:30" : "23:00");

      var bandIdx = counter % BANDS.length;
      var key = date + "|" + BANDS[bandIdx].id;
      while (usedSlots[key]) {
        bandIdx = (bandIdx + 1) % BANDS.length;
        key = date + "|" + BANDS[bandIdx].id;
      }
      usedSlots[key] = true;
      var band = BANDS[bandIdx];

      var variance = [-50, 0, 50][counter % 3];
      var amount = band.rate + festa.tier + variance;

      var status;
      if (date < TODAY) {
        status = (counter % 17 === 0) ? "cancel·lat" : "confirmat";
      } else {
        if (counter % 23 === 0) status = "cancel·lat";
        else if (counter % 5 === 0) status = "pendent";
        else status = "confirmat";
      }

      counter++;
      CONCERTS.push({
        id: "c" + counter,
        date: date, time: time,
        bandId: band.id, bandName: band.name, tags: band.tags.slice(),
        venue: festa.venue, city: festa.city,
        status: status, amount: amount
      });
    }
  });

  // Fora de temporada de festes majors (gener–maig i octubre–desembre) el circuit és de sales i teatres
  var CLUB_VENUES = [
    { venue: "Sala Apolo", city: "Barcelona" },
    { venue: "Razzmatazz", city: "Barcelona" },
    { venue: "Sala Bikini", city: "Barcelona" },
    { venue: "El Molino", city: "Barcelona" },
    { venue: "Sala Luz de Gas", city: "Barcelona" },
    { venue: "La Mirona", city: "Salt" },
    { venue: "Bikini Terrassa", city: "Terrassa" },
    { venue: "Kursaal", city: "Manresa" },
    { venue: "Teatre Bartrina", city: "Reus" },
    { venue: "Sala Stroika", city: "Badalona" },
    { venue: "Sala Monasterio", city: "Tarragona" },
    { venue: "La Rambleta", city: "Sabadell" },
    { venue: "Sala Zero", city: "L'Hospitalet de Llobregat" },
    { venue: "Auditori Municipal", city: "Vic" }
  ];
  function saturdaysOfMonth(year, month) {
    var res = [];
    var d = new Date(year, month, 1);
    while (d.getMonth() === month) {
      if (d.getDay() === 6) res.push(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
      d.setDate(d.getDate() + 1);
    }
    return res;
  }
  var OFF_SEASON_MONTHS = [0, 1, 2, 3, 4, 9, 10, 11];
  OFF_SEASON_MONTHS.forEach(function (month) {
    saturdaysOfMonth(2026, month).forEach(function (date) {
      var v = CLUB_VENUES[counter % CLUB_VENUES.length];

      var bandIdx = counter % BANDS.length;
      var key = date + "|" + BANDS[bandIdx].id;
      while (usedSlots[key]) {
        bandIdx = (bandIdx + 1) % BANDS.length;
        key = date + "|" + BANDS[bandIdx].id;
      }
      usedSlots[key] = true;
      var band = BANDS[bandIdx];

      var variance = [-100, 0, 100][counter % 3];
      var amount = band.rate + variance;

      var status;
      if (date < TODAY) {
        status = (counter % 13 === 0) ? "cancel·lat" : "confirmat";
      } else {
        if (counter % 19 === 0) status = "cancel·lat";
        else if (counter % 4 === 0) status = "pendent";
        else status = "confirmat";
      }

      counter++;
      CONCERTS.push({
        id: "c" + counter,
        date: date, time: "22:00",
        bandId: band.id, bandName: band.name, tags: band.tags.slice(),
        venue: v.venue, city: v.city,
        status: status, amount: amount
      });
    });
  });

  // Estadístiques d'anys anteriors (2022–2025), amb un creixement progressiu fins arribar al volum de 2026
  var ALL_VENUES = FESTES.map(function (f) { return { venue: f.venue, city: f.city }; }).concat(CLUB_VENUES);
  var MONTH_WEIGHTS = [4, 3, 4, 4, 5, 9, 15, 18, 15, 5, 4, 4]; // pes relatiu de cada mes (estiu concentrat)
  function distributeByWeight(total, weights) {
    var sumW = weights.reduce(function (a, b) { return a + b; }, 0);
    var counts = weights.map(function (w) { return Math.round(total * w / sumW); });
    var diff = total - counts.reduce(function (a, b) { return a + b; }, 0);
    counts[6] += diff;
    return counts;
  }
  function generateHistoricalYear(year, total, rateScale) {
    var counts = distributeByWeight(total, MONTH_WEIGHTS);
    for (var m = 0; m < 12; m++) {
      var n = counts[m];
      var daysInMonth = new Date(year, m + 1, 0).getDate();
      for (var i = 0; i < n; i++) {
        var day = Math.min(daysInMonth, 2 + Math.floor(i * daysInMonth / n));
        var date = year + "-" + pad2(m + 1) + "-" + pad2(day);

        var bandIdx = counter % BANDS.length;
        var key = date + "|" + BANDS[bandIdx].id;
        while (usedSlots[key]) {
          bandIdx = (bandIdx + 1) % BANDS.length;
          key = date + "|" + BANDS[bandIdx].id;
        }
        usedSlots[key] = true;
        var band = BANDS[bandIdx];
        var venue = ALL_VENUES[counter % ALL_VENUES.length];
        var variance = [-100, 0, 100, 200][counter % 4];
        var amount = Math.round((band.rate + variance) * rateScale / 10) * 10;
        var status = (counter % 15 === 0) ? "cancel·lat" : "confirmat";
        var isSummer = m >= 5 && m <= 8;

        counter++;
        CONCERTS.push({
          id: "c" + counter,
          date: date, time: isSummer ? (i % 2 === 0 ? "22:30" : "23:00") : "22:00",
          bandId: band.id, bandName: band.name, tags: band.tags.slice(),
          venue: venue.venue, city: venue.city,
          status: status, amount: amount
        });
      }
    }
  }
  generateHistoricalYear(2022, 60, 0.78);
  generateHistoricalYear(2023, 75, 0.85);
  generateHistoricalYear(2024, 90, 0.90);
  generateHistoricalYear(2025, 105, 0.95);

  // Historial d'actuacions de cada grup = concerts reals que té assignats durant l'any
  BANDS.forEach(function (b) {
    b.history = CONCERTS.filter(function (c) { return c.bandId === b.id; }).length;
  });

  // Facturació: una factura per a cada concert que ja s'hagi fet o que estigui a
  // menys de 2 setmanes vista (no es factura amb tanta antelació). Els ajuntaments
  // solen pagar als 3 mesos de l'actuació (amb alguna excepció puntual, més ràpida
  // o més lenta), per la qual cosa no hi ha factures vençudes: només pendents o ja pagades.
  var INVOICE_HORIZON = addDays(TODAY, 14);
  var INVOICES = [];
  var invNumByYear = {};
  CONCERTS
    .filter(function (c) { return c.date <= INVOICE_HORIZON; })
    .sort(function (a, b) { return a.date.localeCompare(b.date); })
    .forEach(function (c, idx) {
      var issueDate = addDays(c.date, 4);
      var termDays = 90;
      if (idx % 11 === 0) termDays = 60;  // excepció: ajuntament que paga més ràpid
      else if (idx % 13 === 0) termDays = 120; // excepció: ajuntament que triga més a pagar
      var dueDate = addDays(c.date, termDays);
      var state = dueDate < TODAY ? "pagada" : "pendent";
      var year = issueDate.slice(0, 4);
      invNumByYear[year] = (invNumByYear[year] || 0) + 1;
      INVOICES.push({
        id: "F-" + year + "-" + String(invNumByYear[year]).padStart(3, "0"),
        concertId: c.id, client: c.venue, bandName: c.bandName,
        issueDate: issueDate, dueDate: dueDate,
        amount: Math.round(c.amount * 1.21),
        state: state
      });
    });

  window.APP_DATA = { BANDS: BANDS, CONCERTS: CONCERTS, INVOICES: INVOICES };
})();
