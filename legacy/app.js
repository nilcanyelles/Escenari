(function () {
  "use strict";

  /* ================= CONSTANTS ================= */
  var TODAY = (function () {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  })();
  var STORAGE_KEY = "lbp_data_v1";
  var SESSION_KEY = "lbp_session_v1";
  var DEMO_USERNAME = "prova";
  var DEMO_PASSWORD = "prova";
  var USER_NAME = "Judit Marín";
  var USER_ROLE = "Gestora";
  var USER_INITIALS = "JM";

  var PAGES = ["grups", "resum", "calendari", "concerts", "facturacio", "basedades"];
  var PAGE_LABELS = { resum: "Resum", calendari: "Calendari", concerts: "Concerts", grups: "Grups", facturacio: "Facturació", basedades: "Base de dades" };
  var NAV_ICON_PATHS = {
    resum: '<line x1="4" y1="20" x2="4" y2="12"></line><line x1="12" y1="20" x2="12" y2="5"></line><line x1="20" y1="20" x2="20" y2="15"></line>',
    calendari: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    concerts: '<path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="18" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line>',
    grups: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M15.5 3.13a4 4 0 0 1 0 7.75"></path>',
    facturacio: '<circle cx="12" cy="12" r="9.5"></circle><text x="12" y="16.3" text-anchor="middle" font-size="12.5" font-weight="700" font-family="Inter,sans-serif" stroke="none" fill="currentColor">€</text>',
    basedades: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line>'
  };
  function navIcon(page, color) {
    return (
      '<svg class="nav-icon" style="color:' + color + '" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        NAV_ICON_PATHS[page] +
      '</svg>'
    );
  }
  function pageTitleBadge(page, label, small) {
    var size = small ? 16 : 19;
    return (
      '<div class="page-title-badge' + (small ? " sm" : "") + '">' +
        '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          NAV_ICON_PATHS[page] +
        '</svg>' +
        '<span>' + esc(label) + '</span>' +
      '</div>'
    );
  }
  var TAG_PRESETS = ["Rock", "Pop", "Indie", "Electrònica", "Jazz", "Flamenc/Rumba", "Hip-hop", "Folk/Tradicional"];
  var MONTH_ABBR = ["gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des"];
  var MONTH_FULL = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
  var WEEKDAY_FULL = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];
  var WEEKDAY_SHORT = ["dl", "dt", "dc", "dj", "dv", "ds", "dg"];
  var TAG_HUE = { "Rock": 290, "Pop": 340, "Indie": 250, "Electrònica": 200, "Jazz": 170, "Flamenc/Rumba": 25, "Hip-hop": 60, "Folk/Tradicional": 110 };
  var RS_SECTION_ICONS = {
    "Lloc": '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
    "Contactes": '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    "Horaris": '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    "Hospitalitat": '<path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line>',
    "Detalls tècnics": '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'
  };
  function rsSectionIconSvg(title, size) {
    var iconPath = RS_SECTION_ICONS[title];
    if (!iconPath) return "";
    var s = size || 15;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;">' + iconPath + '</svg>';
  }

  /* ================= HELPERS ================= */
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function hashStr(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  var CIF_LETTERS = "ABCDEFGHJNPQRSUVW";
  var LEGAL_SUFFIXES = ["S.L.", "S.A.", "S.L.U.", "S.C.P."];
  var STREET_NAMES = ["Carrer Major", "Carrer Nou", "Avinguda del Comerç", "Carrer de la Pau", "Passeig de la Rambla", "Carrer Sant Josep", "Carrer de la Indústria", "Carrer del Mar", "Avinguda de la Llibertat", "Carrer del Sol"];
  function fictitiousClientInfo(name, city) {
    var h = hashStr(name);
    var letter = CIF_LETTERS[h % CIF_LETTERS.length];
    var digits = String(10000000 + (h % 90000000)).slice(-8);
    var suffix = LEGAL_SUFFIXES[Math.floor(h / 7) % LEGAL_SUFFIXES.length];
    var street = STREET_NAMES[Math.floor(h / 13) % STREET_NAMES.length];
    var num = (h % 98) + 1;
    return {
      cif: letter + digits,
      nom: name + " " + suffix,
      address: street + ", " + num + (city ? ", " + city : "")
    };
  }
  function setPath(obj, path, val) {
    var parts = path.split(".");
    var o = obj;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  }
  function addDays(dateStr, n) {
    var p = dateStr.split("-").map(Number);
    var dt = new Date(p[0], p[1] - 1, p[2] + n);
    return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate());
  }
  function statusColors(status) {
    if (status === "confirmat" || status === "pagada") return { bg: "oklch(0.72 0.15 155 / 0.16)", color: "oklch(0.78 0.15 155)" };
    if (status === "pendent") return { bg: "oklch(0.78 0.15 80 / 0.16)", color: "oklch(0.82 0.15 80)" };
    return { bg: "oklch(0.68 0.18 25 / 0.16)", color: "oklch(0.74 0.18 25)" };
  }
  function tagColors(tag) {
    var h = TAG_HUE.hasOwnProperty(tag) ? TAG_HUE[tag] : 290;
    return { color: "oklch(0.72 0.14 " + h + ")", bg: "oklch(0.72 0.14 " + h + " / 0.16)" };
  }
  function uniqueTags(items) {
    var seen = {}, out = [];
    items.forEach(function (it) {
      (it.tags || []).forEach(function (t) {
        if (t && !seen[t]) { seen[t] = true; out.push(t); }
      });
    });
    return out.sort();
  }
  var TAG_ICON_PATHS = {
    "Rock": '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
    "Pop": '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="18" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line>',
    "Indie": '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
    "Electrònica": '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>',
    "Jazz": '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle>',
    "Flamenc/Rumba": '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
    "Hip-hop": '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>',
    "Folk/Tradicional": '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle>'
  };
  function bandInitials(name) {
    var words = String(name || "").split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase();
  }
  function bandPhotoDataUri(b) {
    var primaryTag = (b.tags && b.tags[0]) || "";
    var h = TAG_HUE.hasOwnProperty(primaryTag) ? TAG_HUE[primaryTag] : 290;
    var icon = TAG_ICON_PATHS.hasOwnProperty(primaryTag) ? TAG_ICON_PATHS[primaryTag] : TAG_ICON_PATHS["Rock"];
    var seed = 0;
    for (var i = 0; i < b.id.length; i++) seed += b.id.charCodeAt(i);
    var h2 = (h + 35 + (seed % 25)) % 360;
    var svg = (
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="hsl(' + h + ',55%,38%)"/>' +
          '<stop offset="1" stop-color="hsl(' + h2 + ',50%,20%)"/>' +
        '</linearGradient></defs>' +
        '<rect width="300" height="300" fill="url(#g)"/>' +
        '<g transform="translate(150,150)" opacity="0.18">' +
          '<g transform="translate(-70,-70) scale(5.8)" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">' + icon + '</g>' +
        '</g>' +
        '<text x="150" y="168" font-family="Space Grotesk,Arial,sans-serif" font-size="72" font-weight="700" fill="white" fill-opacity="0.92" text-anchor="middle">' + esc(bandInitials(b.name)) + '</text>' +
      '</svg>'
    );
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  function monthWithPrep(monthFull) {
    return /^[aeiouàéèíòóú]/i.test(monthFull) ? "d'" + monthFull : "de " + monthFull;
  }
  function formatDate(dateStr) {
    var p = dateStr.split("-").map(Number);
    return p[2] + " " + MONTH_ABBR[p[1] - 1] + " " + p[0];
  }
  function formatDateFull(dateStr) {
    var p = dateStr.split("-").map(Number);
    var dt = new Date(p[0], p[1] - 1, p[2]);
    return WEEKDAY_FULL[dt.getDay()] + ", " + p[2] + " " + monthWithPrep(MONTH_FULL[p[1] - 1]) + " de " + p[0];
  }
  function formatDateLong(dateStr) {
    var p = dateStr.split("-").map(Number);
    return p[2] + " " + monthWithPrep(MONTH_FULL[p[1] - 1]) + " de " + p[0];
  }
  function formatCurrency(n) {
    var isInt = Number.isInteger(n);
    return new Intl.NumberFormat("ca-ES", { minimumFractionDigits: isInt ? 0 : 2, maximumFractionDigits: 2 }).format(n) + " €";
  }

  function defaultRouteSheet(c) {
    return {
      lloc: [
        { label: "Recinte", value: c.venue || "" },
        { label: "Adreça", value: "" },
        { label: "Descàrrega", value: "" },
        { label: "Parking", value: "", plates: "" }
      ],
      contacts: [{ role: "", name: "", phone: "", company: "" }],
      schedule: [
        { phase: "Arribada", start: "", end: "" },
        { phase: "Muntatge", start: "", end: "" },
        { phase: "Proves de so", start: "", end: "" },
        { phase: "Concert", start: c.time || "", end: "" }
      ],
      hospitalitat: [
        { label: "Dietes", value: "", included: true },
        { label: "Catering", value: "", included: true },
        { label: "Camerino", value: "", included: true },
        { label: "Allotjament", value: "", included: true, phone: "", location: "", parkingAvailable: true, parkingPlates: "", checkIn: "", checkOut: "", breakfastAvailable: true, breakfastTime: "" }
      ],
      tecnic: [
        { label: "Mesures escenari", value: "" },
        { label: "Tarimes", value: "" },
        { label: "Contra rider", value: "" },
        { label: "Pantalla LED", value: "", included: true }
      ]
    };
  }
  function rsBlankItem(section) {
    if (section === "contacts") return { role: "", name: "", phone: "", company: "" };
    if (section === "schedule") return { phase: "", start: "", end: "" };
    if (section === "hospitalitat") return { label: "", value: "", phone: "", location: "", parkingAvailable: true, parkingPlates: "", checkIn: "", checkOut: "", breakfastAvailable: true, breakfastTime: "" };
    return { label: "", value: "" };
  }
  function normalizeRouteSheet(rs, c) {
    if (!rs) return defaultRouteSheet(c);
    if (rs.lloc) {
      var def = defaultRouteSheet(c);
      var out = clone(rs);
      out.lloc = (out.lloc && out.lloc.length) ? out.lloc : def.lloc;
      out.contacts = (out.contacts && out.contacts.length) ? out.contacts : def.contacts;
      out.schedule = (out.schedule && out.schedule.length) ? out.schedule : def.schedule;
      out.hospitalitat = (out.hospitalitat && out.hospitalitat.length) ? out.hospitalitat : def.hospitalitat;
      out.tecnic = (out.tecnic && out.tecnic.length) ? out.tecnic : def.tecnic;
      out.hospitalitat.forEach(function (it) {
        if (it.label && it.label.trim().toLowerCase() === "hotel") it.label = "Allotjament";
      });
      var seenAllotjament = false;
      out.hospitalitat = out.hospitalitat.filter(function (it) {
        var isAllotjament = it.label && it.label.trim().toLowerCase() === "allotjament";
        if (!isAllotjament) return true;
        if (seenAllotjament) return false;
        seenAllotjament = true;
        return true;
      });
      if (!seenAllotjament) {
        out.hospitalitat = out.hospitalitat.concat([def.hospitalitat[def.hospitalitat.length - 1]]);
      }
      var seenPantallaLed = false;
      out.tecnic = out.tecnic.filter(function (it) {
        var isLed = it.label && it.label.trim().toLowerCase() === "pantalla led";
        if (!isLed) return true;
        if (seenPantallaLed) return false;
        seenPantallaLed = true;
        return true;
      });
      if (!seenPantallaLed) {
        out.tecnic = out.tecnic.concat([def.tecnic[def.tecnic.length - 1]]);
      }
      return out;
    }
    return clone({
      lloc: [
        { label: "Recinte", value: rs.venueName || c.venue || "" },
        { label: "Adreça", value: rs.address || "" },
        { label: "Descàrrega", value: rs.unload || "" },
        { label: "Parking", value: rs.parking || "", plates: "" }
      ],
      contacts: (rs.contacts && rs.contacts.length) ? rs.contacts : [{ role: "", name: "", phone: "", company: "" }],
      schedule: (rs.schedule && rs.schedule.length) ? rs.schedule : defaultRouteSheet(c).schedule,
      hospitalitat: [
        { label: "Dietes", value: rs.meals || "", included: true },
        { label: "Catering", value: rs.catering || "", included: true },
        { label: "Camerino", value: rs.dressingRoom || "", included: true },
        { label: "Allotjament", value: "", included: true, phone: "", location: "", parkingAvailable: true, parkingPlates: "", checkIn: "", checkOut: "", breakfastAvailable: true, breakfastTime: "" }
      ],
      tecnic: [
        { label: "Mesures escenari", value: rs.stageSize || "" },
        { label: "Tarimes", value: rs.risers || "" },
        { label: "Contra rider", value: rs.contraRider || "" },
        { label: "Pantalla LED", value: "", included: true }
      ]
    });
  }
  function rsAllFilled(items, fields) {
    return !!(items && items.length) && items.every(function (it) {
      return fields.every(function (f) { return it[f] && String(it[f]).trim(); });
    });
  }
  function rsHospitalitatComplete(items) {
    return !!(items && items.length) && items.every(function (it) {
      return !!(it.label && String(it.label).trim());
    });
  }
  function rsTecnicComplete(items) {
    return !!(items && items.length) && items.every(function (it) {
      if (!it.label || !String(it.label).trim()) return false;
      if (it.label.trim().toLowerCase() === "pantalla led") return true;
      return !!(it.value && String(it.value).trim());
    });
  }
  function rsIsComplete(c) {
    if (!c.routeSheet) return false;
    var rs = c.routeSheet;
    var hasLloc = rsAllFilled(rs.lloc, ["label", "value"]);
    var hasContacts = rsAllFilled(rs.contacts, ["role", "name", "phone", "company"]);
    var hasHospitalitat = rsHospitalitatComplete(rs.hospitalitat);
    var hasTecnic = rsTecnicComplete(rs.tecnic);
    var hasFullSchedule = !!(rs.schedule && rs.schedule.length && rs.schedule.every(function (ph) {
      return ph.phase && ph.start && ph.end;
    }));
    return hasLloc && hasContacts && hasHospitalitat && hasTecnic && hasFullSchedule;
  }

  /* ================= STATE ================= */
  function loadPersisted() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ concerts: S.concerts, invoices: S.invoices, clientDetails: S.clientDetails, companyInfo: S.companyInfo })); } catch (e) {}
  }

  var persisted = loadPersisted();
  var S = {
    loggedIn: false, username: "", password: "", loginError: "",
    page: "grups", profileMenuOpen: false,
    resumRange: "year", resumYear: 2026, yearPickerOpen: false,
    resumBandFilter: [], bandFilterOpen: false,
    calMonthIndex: 7, calSelectedDate: null,
    calBandFilter: [], calBandFilterOpen: false,
    concertsSearch: "", concertsStatusFilter: "tots", concertsTagFilter: "tots",
    concertModalOpen: false, concertModalMode: "new", concertEditId: null,
    cf: { bandId: "", bandName: "", date: TODAY, time: "21:00", venue: "", city: "", amount: "1500", status: "confirmat", attendance: {}, substitutes: {}, noSubstitute: {} },
    cfDatePickerOpen: false, cfPickerYM: null, cfBandDropdownOpen: false,
    routeSheetModalOpen: false, routeSheetConcertId: null, rsf: null,
    routeSheetPreviewOpen: false, routeSheetPreviewId: null,
    grupsTagFilter: [], grupsTagFilterOpen: false,
    bandModalOpen: false, bandDetailId: null, bf: null,
    factStateFilter: "tots", invoiceModalOpen: false, invoiceFormConcertId: "",
    invoicePreviewOpen: false, invoicePreviewId: null,
    dbSearch: "", dbSortKey: "date", dbSortDir: "desc", dbDatePickerFor: null, dbPickerYM: null, dbView: "concerts",
    toastMsg: "", toastShow: false,
    bands: clone(window.APP_DATA.BANDS),
    concerts: persisted && persisted.concerts ? persisted.concerts : clone(window.APP_DATA.CONCERTS),
    invoices: persisted && persisted.invoices ? persisted.invoices : clone(window.APP_DATA.INVOICES),
    clientDetails: persisted && persisted.clientDetails ? persisted.clientDetails : {},
    companyInfo: persisted && persisted.companyInfo ? persisted.companyInfo : { nom: "La Bona Party", cif: "", address: "", iban: "" }
  };
  (function () {
    var cityByClient = {};
    S.concerts.forEach(function (c) { if (c.venue && !cityByClient[c.venue]) cityByClient[c.venue] = c.city; });
    var clientKeys = {};
    S.concerts.forEach(function (c) { if (c.venue) clientKeys[c.venue] = true; });
    S.invoices.forEach(function (i) { if (i.client) clientKeys[i.client] = true; });
    var changed = false;
    Object.keys(clientKeys).forEach(function (name) {
      if (!S.clientDetails[name]) {
        S.clientDetails[name] = fictitiousClientInfo(name, cityByClient[name] || "");
        changed = true;
      }
    });
    if (changed) persist();
  })();
  try {
    var sess = sessionStorage.getItem(SESSION_KEY);
    if (sess) {
      var parsedSess = JSON.parse(sess);
      S.username = parsedSess.username || "";
      S.loggedIn = true;
    }
  } catch (e) {}

  var toastTimer = null;
  function toast(msg) {
    S.toastMsg = msg; S.toastShow = true;
    clearTimeout(toastTimer);
    render();
    toastTimer = setTimeout(function () { S.toastShow = false; render(); }, 2200);
  }

  /* ================= RENDER: LOGIN ================= */
  function renderLogin() {
    return (
      '<div class="login-screen">' +
        '<div class="login-glow"></div>' +
        '<img class="login-bg-logo" src="logo.webp" alt=""/>' +
        '<form id="login-form" class="login-card">' +
          '<div class="login-logo-row">' +
            '<img class="login-logo-img" src="logo.webp" alt="La Bona Party"/>' +
          '</div>' +
          '<div class="login-form">' +
            '<div class="field-group">' +
              '<label class="field-label">Usuari</label>' +
              '<input class="field-input" type="text" autocomplete="username" placeholder="admin@labonaparty.cat" value="' + esc(S.username) + '" data-bind="username" data-fkey="username"/>' +
            '</div>' +
            '<div class="field-group">' +
              '<label class="field-label">Contrasenya</label>' +
              '<input class="field-input" type="password" autocomplete="current-password" placeholder="••••••••" value="' + esc(S.password) + '" data-bind="password" data-fkey="password"/>' +
            '</div>' +
            '<div class="login-error">' + (S.loginError ? esc(S.loginError) : "") + '</div>' +
            '<button type="submit" class="btn-primary">Entrar</button>' +
            '<div class="login-footnote">Has oblidat la contrasenya? <a href="#" data-action="noop">Recupera-la</a></div>' +
            '<div class="login-hint">Accés de prova — usuari: <strong>prova</strong> · contrasenya: <strong>prova</strong></div>' +
          '</div>' +
        '</form>' +
        '<div class="login-copyright">© 2026 La Bona Party — Accés d\'administració</div>' +
      '</div>'
    );
  }

  /* ================= RENDER: SHELL ================= */
  function renderTopNav() {
    var items = PAGES.map(function (p) {
      var active = S.page === p;
      return (
        '<button class="topnav-item ' + (active ? "active" : "") + '" data-action="setPage" data-page="' + p + '" title="' + esc(PAGE_LABELS[p]) + '">' +
          navIcon(p, active ? "var(--accent-text)" : "var(--text-muted)") +
          '<span>' + PAGE_LABELS[p] + '</span>' +
        '</button>'
      );
    }).join("");
    return '<div class="topnav">' + items + '</div>';
  }

  function renderProfileButton() {
    return (
      '<button class="profile-btn" data-action="toggleProfileMenu">' +
        '<div class="profile-btn-avatar">' + USER_INITIALS + '</div>' +
      '</button>'
    );
  }

  function renderMobileTopbar() {
    return (
      '<div class="mobile-topbar mobile-only">' +
        '<img class="mobile-logo-img" src="logo.webp" alt="La Bona Party"/>' +
        pageTitleBadge(S.page, PAGE_LABELS[S.page], true) +
        '<div class="spacer"></div>' +
        renderProfileButton() +
      '</div>'
    );
  }

  function renderPageHeader() {
    return (
      '<div class="page-header desktop-only">' +
        '<div class="page-header-brand"><img class="topbar-logo-img" src="logo.webp" alt="La Bona Party"/></div>' +
        renderTopNav() +
        '<div style="display:flex;align-items:center;gap:16px;">' +
          '<div class="page-date">' + capitalize(formatDateFull(TODAY)) + '</div>' +
          renderProfileButton() +
        '</div>' +
      '</div>'
    );
  }

  function renderProfilePopover() {
    return (
      '<div class="profile-overlay" data-action="closeProfileMenu">' +
        '<div class="profile-popover" data-action="stop">' +
          '<div class="profile-popover-avatar">' + USER_INITIALS + '</div>' +
          '<div class="profile-popover-name">' + esc(USER_NAME) + '</div>' +
          '<div class="profile-popover-role">' + esc(USER_ROLE) + '</div>' +
          '<button class="btn-danger-outline" style="width:100%;" data-action="logout">Tanca sessió</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderBottomNav() {
    var items = PAGES.map(function (p) {
      var active = S.page === p;
      return (
        '<button class="bottom-nav-item" data-action="setPage" data-page="' + p + '" style="color:' + (active ? "var(--accent-text)" : "var(--text-faint)") + '">' +
          navIcon(p, active ? "var(--accent-text)" : "var(--text-faint)") +
          '<span class="bottom-nav-label">' + PAGE_LABELS[p] + '</span>' +
        '</button>'
      );
    }).join("");
    return '<div class="bottom-nav mobile-only">' + items + '</div>';
  }

  function renderToast() {
    return '<div class="toast ' + (S.toastShow ? "show" : "") + '">' + esc(S.toastMsg || "") + '</div>';
  }

  function renderAppShell() {
    return (
      '<div class="app-shell">' +
        '<div class="main-col">' +
          renderMobileTopbar() +
          renderPageHeader() +
          '<main class="content">' +
            renderPageBody() +
          '</main>' +
        '</div>' +
        renderBottomNav() +
      '</div>' +
      (S.profileMenuOpen ? renderProfilePopover() : "") +
      (S.concertModalOpen ? renderConcertModal() : "") +
      (S.routeSheetModalOpen ? renderRouteSheetModal() : "") +
      (S.routeSheetPreviewOpen ? renderRouteSheetPreview() : "") +
      (S.bandModalOpen ? renderBandModal() : "") +
      (S.invoiceModalOpen ? renderInvoiceModal() : "") +
      (S.invoicePreviewOpen ? renderInvoicePreview() : "") +
      renderToast()
    );
  }

  function renderPageBody() {
    switch (S.page) {
      case "resum": return renderResum();
      case "calendari": return renderCalendari();
      case "concerts": return renderConcerts();
      case "grups": return renderGrups();
      case "facturacio": return renderFacturacio();
      case "basedades": return renderBaseDades();
      default: return "";
    }
  }

  /* ================= PAGE: RESUM ================= */
  var RESUM_YEARS = [2026, 2025, 2024, 2023, 2022];

  function computeMonthAgg(concerts, yearFilter) {
    var agg = {};
    for (var m = 0; m < 12; m++) agg[m] = { count: 0, pastCount: 0, futureCount: 0, pendingCount: 0 };
    concerts.forEach(function (c) {
      if (yearFilter && c.date.slice(0, 4) !== String(yearFilter)) return;
      if (c.status === "cancel·lat") return;
      var m2 = parseInt(c.date.slice(5, 7), 10) - 1;
      agg[m2].count += 1;
      if (c.status === "pendent") agg[m2].pendingCount += 1;
      else if (c.date < TODAY) agg[m2].pastCount += 1;
      else agg[m2].futureCount += 1;
    });
    return agg;
  }

  function computeYearAgg(concerts, years) {
    var agg = {};
    years.forEach(function (y) { agg[y] = { count: 0, pastCount: 0, futureCount: 0, pendingCount: 0 }; });
    concerts.forEach(function (c) {
      var y = c.date.slice(0, 4);
      if (!(y in agg) || c.status === "cancel·lat") return;
      agg[y].count += 1;
      if (c.status === "pendent") agg[y].pendingCount += 1;
      else if (c.date < TODAY) agg[y].pastCount += 1;
      else agg[y].futureCount += 1;
    });
    return agg;
  }

  // Facturació: es calcula únicament a partir de les factures ja emeses (import i estat de la factura)
  function computeInvoiceMonthAgg(invoiceRecords, yearFilter) {
    var agg = {};
    for (var m = 0; m < 12; m++) agg[m] = { revenue: 0, paidRevenue: 0, pendingRevenue: 0 };
    invoiceRecords.forEach(function (r) {
      if (yearFilter && r.date.slice(0, 4) !== String(yearFilter)) return;
      var m2 = parseInt(r.date.slice(5, 7), 10) - 1;
      agg[m2].revenue += r.amount;
      if (r.state === "pagada") agg[m2].paidRevenue += r.amount; else agg[m2].pendingRevenue += r.amount;
    });
    return agg;
  }

  // Facturació projectada: concerts ja pactats (confirmats o pendents) que encara no s'han facturat
  function computeProjectedMonthAgg(concerts, invoicedIds, yearFilter) {
    var agg = {};
    for (var m = 0; m < 12; m++) agg[m] = 0;
    concerts.forEach(function (c) {
      if (yearFilter && c.date.slice(0, 4) !== String(yearFilter)) return;
      if (c.status !== "confirmat" && c.status !== "pendent") return;
      if (invoicedIds[c.id]) return;
      var m2 = parseInt(c.date.slice(5, 7), 10) - 1;
      agg[m2] += Math.round(c.amount * 1.21);
    });
    return agg;
  }

  function computeInvoiceYearAgg(invoiceRecords, years) {
    var agg = {};
    years.forEach(function (y) { agg[y] = { revenue: 0, paidRevenue: 0, pendingRevenue: 0 }; });
    invoiceRecords.forEach(function (r) {
      var y = r.date.slice(0, 4);
      if (!(y in agg)) return;
      agg[y].revenue += r.amount;
      if (r.state === "pagada") agg[y].paidRevenue += r.amount; else agg[y].pendingRevenue += r.amount;
    });
    return agg;
  }

  function computeProjectedYearAgg(concerts, invoicedIds, years) {
    var agg = {};
    years.forEach(function (y) { agg[y] = 0; });
    concerts.forEach(function (c) {
      var y = c.date.slice(0, 4);
      if (!(y in agg)) return;
      if (c.status !== "confirmat" && c.status !== "pendent") return;
      if (invoicedIds[c.id]) return;
      agg[y] += Math.round(c.amount * 1.21);
    });
    return agg;
  }

  function renderResum() {
    var bandFilterSet = {};
    S.resumBandFilter.forEach(function (id) { bandFilterSet[id] = true; });
    var srcConcerts = S.resumBandFilter.length ? S.concerts.filter(function (c) { return bandFilterSet[c.bandId]; }) : S.concerts;
    var donutPool = S.resumRange === "year" ?
      srcConcerts.filter(function (c) { return c.date.slice(0, 4) === String(S.resumYear) && c.status !== "cancel·lat"; }) :
      srcConcerts.filter(function (c) { return c.status !== "cancel·lat"; });

    var concertsById = {};
    S.concerts.forEach(function (c) { concertsById[c.id] = c; });
    var invoiceRecords = S.invoices
      .filter(function (i) {
        var c = concertsById[i.concertId];
        return c && (!S.resumBandFilter.length || bandFilterSet[c.bandId]);
      })
      .map(function (i) { return { date: concertsById[i.concertId].date, amount: i.amount, state: i.state }; });
    var periodInvoiceRecords = S.resumRange === "year" ?
      invoiceRecords.filter(function (r) { return r.date.slice(0, 4) === String(S.resumYear); }) :
      invoiceRecords;

    var invoicedIds = {};
    S.invoices.forEach(function (i) {
      var c = concertsById[i.concertId];
      if (c && (!S.resumBandFilter.length || bandFilterSet[c.bandId])) invoicedIds[i.concertId] = true;
    });
    var periodConcertsForProjection = S.resumRange === "year" ?
      srcConcerts.filter(function (c) { return c.date.slice(0, 4) === String(S.resumYear); }) :
      srcConcerts;
    var periodProjectedRevenue = periodConcertsForProjection
      .filter(function (c) { return (c.status === "confirmat" || c.status === "pendent") && !invoicedIds[c.id]; })
      .reduce(function (s, c) { return s + Math.round(c.amount * 1.21); }, 0);

    var selectorLabel = S.resumRange === "all" ? "Tots els temps" : String(S.resumYear);
    var dropdownItems = RESUM_YEARS.map(function (y) {
      var active = S.resumRange === "year" && S.resumYear === y;
      return '<button class="year-option ' + (active ? "active" : "") + '" data-action="setResumYear" data-year="' + y + '">' + y + '</button>';
    }).join("") +
      '<div class="year-option-divider"></div>' +
      '<button class="year-option ' + (S.resumRange === "all" ? "active" : "") + '" data-action="setResumAll">Tots els temps</button>';
    var pills = (
      '<div class="year-select-wrap">' +
        '<button class="pill active" data-action="toggleYearPicker">' + selectorLabel + ' ▾</button>' +
        (S.yearPickerOpen ?
          '<div class="year-picker-overlay" data-action="closeYearPicker"></div>' +
          '<div class="year-dropdown" data-action="stop">' + dropdownItems + '</div>'
          : "") +
      '</div>'
    );

    var bandLabel = S.resumBandFilter.length === 0 ? "Tots els grups" :
      (S.resumBandFilter.length === 1 ? ((S.bands.filter(function (b) { return b.id === S.resumBandFilter[0]; })[0] || {}).name || "1 grup") :
        S.resumBandFilter.length + " grups");
    var bandDropdownItems = (
      '<button class="year-option ' + (S.resumBandFilter.length === 0 ? "active" : "") + '" data-action="setResumBandAll">' +
        '<span class="band-check">' + (S.resumBandFilter.length === 0 ? "✓" : "") + '</span>Tots els grups' +
      '</button>' +
      '<div class="year-option-divider"></div>' +
      S.bands.map(function (b) {
        var checked = !!bandFilterSet[b.id];
        return '<button class="year-option ' + (checked ? "active" : "") + '" data-action="toggleResumBand" data-id="' + b.id + '">' +
          '<span class="band-check">' + (checked ? "✓" : "") + '</span>' + esc(b.name) +
        '</button>';
      }).join("")
    );
    var bandFilterUi = (
      '<div class="year-select-wrap">' +
        '<button class="pill active" data-action="toggleBandFilter">' + esc(bandLabel) + ' ▾</button>' +
        (S.bandFilterOpen ?
          '<div class="year-picker-overlay" data-action="closeBandFilter"></div>' +
          '<div class="year-dropdown band-dropdown" data-action="stop">' + bandDropdownItems + '</div>'
          : "") +
      '</div>'
    );

    function hbarSplitRow(label, valueLabel, pct1, pct2, cls1, cls2, pct3, cls3, exactLabel) {
      var valueHtml = exactLabel ?
        ('<div class="hbar-value-wrap"><span class="hbar-value">' + valueLabel + '</span><span class="hbar-value-exact">' + exactLabel + '</span></div>') :
        ('<div class="hbar-value">' + valueLabel + '</div>');
      return (
        '<div class="hbar-row">' +
          '<div class="hbar-label">' + label + '</div>' +
          '<div class="hbar-track">' +
            (pct1 > 0 ? '<div class="hbar-fill ' + cls1 + '" style="width:' + pct1 + '%"></div>' : "") +
            (pct2 > 0 ? '<div class="hbar-fill ' + cls2 + '" style="width:' + pct2 + '%"></div>' : "") +
            (pct3 > 0 ? '<div class="hbar-fill ' + cls3 + '" style="width:' + pct3 + '%"></div>' : "") +
          '</div>' +
          valueHtml +
        '</div>'
      );
    }
    function vbarSplitCol(label, valueLabel, totalPct, share1, share2, cls1, cls2, share3, cls3, tt1, tt2, tt3, exactLabel) {
      var countHtml = exactLabel ?
        ('<div class="bar-count-wrap"><span class="bar-count">' + valueLabel + '</span><span class="bar-count-exact">' + exactLabel + '</span></div>') :
        ('<div class="bar-count">' + valueLabel + '</div>');
      return (
        '<div class="bar-col">' +
          countHtml +
          '<div class="bar-fill-wrap" style="height:' + totalPct + '%">' +
            (share3 > 0 ? '<div class="bar-seg ' + cls3 + '" style="flex:' + share3 + '">' + (tt3 || "") + '</div>' : "") +
            (share2 > 0 ? '<div class="bar-seg ' + cls2 + '" style="flex:' + share2 + '">' + (tt2 || "") + '</div>' : "") +
            (share1 > 0 ? '<div class="bar-seg ' + cls1 + '" style="flex:' + share1 + '">' + (tt1 || "") + '</div>' : "") +
          '</div>' +
          '<div class="bar-label">' + label + '</div>' +
        '</div>'
      );
    }
    function segTooltip(label, amount, total, valueFmt) {
      var pct = total ? Math.round(amount / total * 100) : 0;
      var valueHtml = amount === total ? "" : '<span class="seg-tooltip-value">' + (valueFmt || formatCurrency)(amount) + '</span>';
      return (
        '<div class="seg-tooltip">' +
          '<span class="seg-tooltip-label">' + label + '</span>' +
          '<span class="seg-tooltip-pct">' + pct + '%</span>' +
          valueHtml +
        '</div>'
      );
    }

    var identityFmt = function (n) { return n; };
    var monthBars, revenueBars, chartContainerClass;
    var chartTitleConcerts = S.resumRange === "all" ? "Concerts anuals" : "Concerts per mes";
    var chartTitleRevenue = S.resumRange === "all" ? "Facturació anual" : "Facturació mensual";
    if (S.resumRange === "all") {
      chartContainerClass = "hbars";
      var years = RESUM_YEARS.slice().sort(function (a, b) { return a - b; });
      var yagg = computeYearAgg(srcConcerts, years);
      var invYagg = computeInvoiceYearAgg(invoiceRecords, years);
      var projYagg = computeProjectedYearAgg(srcConcerts, invoicedIds, years);
      var yMaxCount = Math.max.apply(null, [1].concat(years.map(function (y) { return yagg[y].count; })));
      var yMaxRev = Math.max.apply(null, [1].concat(years.map(function (y) { return invYagg[y].revenue + projYagg[y]; })));
      monthBars = years.map(function (y) {
        var pastPct = Math.round(yagg[y].pastCount / yMaxCount * 100);
        var pendingPct = Math.round((yagg[y].pastCount + yagg[y].pendingCount) / yMaxCount * 100) - pastPct;
        var futurePct = Math.round(yagg[y].count / yMaxCount * 100) - pastPct - pendingPct;
        return hbarSplitRow(y, yagg[y].count, pastPct, futurePct, "concerts-past", "concerts-future", pendingPct, "concerts-pending");
      }).join("");
      revenueBars = years.map(function (y) {
        var yearTotal = invYagg[y].revenue + projYagg[y];
        var paidPct = Math.round(invYagg[y].paidRevenue / yMaxRev * 100);
        var pendingPct = Math.round(invYagg[y].revenue / yMaxRev * 100) - paidPct;
        var projectedPct = Math.round(yearTotal / yMaxRev * 100) - paidPct - pendingPct;
        return hbarSplitRow(y, Math.round(yearTotal / 1000) + "k", paidPct, pendingPct, "revenue-paid", "revenue-pending", projectedPct, "revenue-projected", formatCurrency(yearTotal));
      }).join("");
    } else {
      chartContainerClass = "bars-row";
      var agg = computeMonthAgg(srcConcerts, S.resumYear);
      var invAgg = computeInvoiceMonthAgg(invoiceRecords, S.resumYear);
      var projAgg = computeProjectedMonthAgg(srcConcerts, invoicedIds, S.resumYear);
      var rangeMonths = [];
      for (var m = 0; m <= 11; m++) rangeMonths.push(m);
      var maxCount = Math.max.apply(null, [1].concat(rangeMonths.map(function (mm) { return agg[mm].count; })));
      var maxRev = Math.max.apply(null, [1].concat(rangeMonths.map(function (mm) { return invAgg[mm].revenue + projAgg[mm]; })));

      monthBars = rangeMonths.map(function (mm) {
        var totalPct = Math.round(agg[mm].count / maxCount * 100);
        var monthCount = agg[mm].count;
        var ttPast = agg[mm].pastCount > 0 ? segTooltip("Realitzats", agg[mm].pastCount, monthCount, identityFmt) : "";
        var ttFuture = agg[mm].futureCount > 0 ? segTooltip("Confirmats", agg[mm].futureCount, monthCount, identityFmt) : "";
        var ttPending = agg[mm].pendingCount > 0 ? segTooltip("Pendents de&nbsp;confirmar", agg[mm].pendingCount, monthCount, identityFmt) : "";
        return vbarSplitCol(MONTH_ABBR[mm], agg[mm].count, totalPct, agg[mm].pastCount, agg[mm].futureCount, "concerts-past", "concerts-future", agg[mm].pendingCount, "concerts-pending", ttPast, ttFuture, ttPending);
      }).join("");
      revenueBars = rangeMonths.map(function (mm) {
        var monthTotal = invAgg[mm].revenue + projAgg[mm];
        var totalPct = Math.round(monthTotal / maxRev * 100);
        var ttPaid = invAgg[mm].paidRevenue > 0 ? segTooltip("Facturat i&nbsp;cobrat", invAgg[mm].paidRevenue, monthTotal) : "";
        var ttPending = invAgg[mm].pendingRevenue > 0 ? segTooltip("Facturat, pendent de&nbsp;cobrar", invAgg[mm].pendingRevenue, monthTotal) : "";
        var ttProjected = projAgg[mm] > 0 ? segTooltip("Pactat, pendent de&nbsp;facturar", projAgg[mm], monthTotal) : "";
        return vbarSplitCol(MONTH_ABBR[mm], Math.round(monthTotal / 1000) + "k", totalPct, invAgg[mm].paidRevenue, invAgg[mm].pendingRevenue, "revenue-paid", "revenue-pending", projAgg[mm], "revenue-projected", ttPaid, ttPending, ttProjected, formatCurrency(monthTotal));
      }).join("");
    }

    var periodRevenue = periodInvoiceRecords.reduce(function (s, r) { return s + r.amount; }, 0) + periodProjectedRevenue;

    function pieSlicePath(angleStart, angleEnd) {
      function pt(angleDeg) {
        var rad = (angleDeg - 90) * Math.PI / 180;
        return { x: 18 + 18 * Math.cos(rad), y: 18 + 18 * Math.sin(rad) };
      }
      var p1 = pt(angleStart), p2 = pt(angleEnd);
      var largeArc = angleEnd - angleStart > 180 ? 1 : 0;
      return "M18 18 L" + p1.x + " " + p1.y + " A18 18 0 " + largeArc + " 1 " + p2.x + " " + p2.y + " Z";
    }
    function donutSegTooltip(wrapperCls, label, amount, total, valueFmt) {
      var pct = total ? Math.round(amount / total * 100) : 0;
      return (
        '<div class="donut-tooltip ' + wrapperCls + '">' +
          '<span class="seg-tooltip-label">' + label + '</span>' +
          '<span class="seg-tooltip-pct">' + pct + '%</span>' +
          '<span class="seg-tooltip-value">' + valueFmt(amount) + '</span>' +
        '</div>'
      );
    }

    function renderMiniDonut3(part1, part2, part3, label1, label2, label3, color1, color2, color3, valueFmt) {
      var total = part1 + part2 + part3;
      var nonZero = (part1 > 0 ? 1 : 0) + (part2 > 0 ? 1 : 0) + (part3 > 0 ? 1 : 0);
      var a1 = total ? (part1 / total * 360) : 0;
      var rotation = 270 - a1 / 2; // centra el primer sector a l'esquerra del cercle
      var slices, tips = "";
      if (total === 0) {
        slices = '<circle cx="18" cy="18" r="18" fill="' + color2 + '"></circle>';
      } else if (nonZero === 1) {
        var soloColor = part1 > 0 ? color1 : (part2 > 0 ? color2 : color3);
        var soloCls = part1 > 0 ? "donut-seg-past" : (part2 > 0 ? "donut-seg-future" : "donut-seg-projected");
        slices = '<circle class="' + soloCls + '" cx="18" cy="18" r="18" fill="' + soloColor + '"></circle>';
        if (part1 > 0) tips += donutSegTooltip("donut-tooltip-past", label1, part1, total, valueFmt);
        if (part2 > 0) tips += donutSegTooltip("donut-tooltip-future", label2, part2, total, valueFmt);
        if (part3 > 0) tips += donutSegTooltip("donut-tooltip-projected", label3, part3, total, valueFmt);
      } else {
        var a2 = total ? (part2 / total * 360) : 0;
        var cursor = rotation;
        slices = "";
        if (part1 > 0) {
          slices += '<path class="donut-seg-past" d="' + pieSlicePath(cursor, cursor + a1) + '" fill="' + color1 + '"></path>';
          tips += donutSegTooltip("donut-tooltip-past", label1, part1, total, valueFmt);
          cursor += a1;
        }
        if (part2 > 0) {
          slices += '<path class="donut-seg-future" d="' + pieSlicePath(cursor, cursor + a2) + '" fill="' + color2 + '"></path>';
          tips += donutSegTooltip("donut-tooltip-future", label2, part2, total, valueFmt);
          cursor += a2;
        }
        if (part3 > 0) {
          slices += '<path class="donut-seg-projected" d="' + pieSlicePath(cursor, rotation + 360) + '" fill="' + color3 + '"></path>';
          tips += donutSegTooltip("donut-tooltip-projected", label3, part3, total, valueFmt);
        }
      }
      return (
        '<div class="donut-wrap">' +
          '<svg class="mini-donut" viewBox="0 0 36 36" width="40" height="40">' + slices + '</svg>' +
          tips +
        '</div>'
      );
    }

    var donutPending = donutPool.filter(function (c) { return c.status === "pendent"; }).length;
    var donutDone = donutPool.filter(function (c) { return c.status !== "pendent" && c.date < TODAY; }).length;
    var donutFuture = donutPool.length - donutDone - donutPending;
    var concertsDonut = renderMiniDonut3(
      donutDone, donutFuture, donutPending,
      "Realitzats", "Confirmats", "Pendents de&nbsp;confirmar",
      "var(--accent)", "oklch(0.68 0.19 290 / 0.5)", "oklch(0.68 0.19 290 / 0.25)",
      identityFmt
    );

    var revDonutPaid = 0, revDonutPending = 0;
    periodInvoiceRecords.forEach(function (r) {
      if (r.state === "pagada") revDonutPaid += r.amount; else revDonutPending += r.amount;
    });
    var revenueDonut = renderMiniDonut3(
      revDonutPaid, revDonutPending, periodProjectedRevenue,
      "Facturat i&nbsp;cobrat", "Facturat, pendent de&nbsp;cobrar", "Pactat, pendent de&nbsp;facturar",
      "var(--green)", "oklch(0.72 0.15 155 / 0.5)", "oklch(0.72 0.15 155 / 0.25)",
      formatCurrency
    );

    return (
      '<div style="display:flex;flex-direction:column;gap:22px;">' +
        '<div class="range-pills">' + pills + bandFilterUi + '</div>' +
        '<div class="kpi-grid">' +
          '<div class="card card-centered"><div class="card-title">Total concerts</div><div class="card-value">' + donutPool.length + '</div></div>' +
          '<div class="card card-centered"><div class="card-title">Total facturació (projectat)</div><div class="card-value">' + formatCurrency(periodRevenue) + '</div></div>' +
        '</div>' +
        '<div class="chart-grid">' +
          '<div class="panel"><div class="panel-header-row"><div class="panel-title">' + chartTitleConcerts + '</div>' + (S.resumRange === "all" ? "" : concertsDonut) + '</div><div class="' + chartContainerClass + '">' + monthBars + '</div></div>' +
          '<div class="panel"><div class="panel-header-row"><div class="panel-title">' + chartTitleRevenue + '</div>' + (S.resumRange === "all" ? "" : revenueDonut) + '</div><div class="' + chartContainerClass + '">' + revenueBars + '</div></div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ================= PAGE: CALENDARI ================= */
  function renderCalendari() {
    var cmi = S.calMonthIndex;
    var base = new Date(2026, cmi, 1);
    var y = base.getFullYear(), mIdx = base.getMonth();
    var monthLabel = MONTH_FULL[mIdx] + " de " + y;
    var startOffset = (base.getDay() + 6) % 7;
    var daysInMonth = new Date(y, mIdx + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < startOffset; i++) cells.push(null);
    for (var d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    var calBandSet = {};
    S.calBandFilter.forEach(function (id) { calBandSet[id] = true; });
    var calConcerts = S.calBandFilter.length ? S.concerts.filter(function (c) { return calBandSet[c.bandId]; }) : S.concerts;

    var eventsByDate = {};
    calConcerts.forEach(function (c) { (eventsByDate[c.date] = eventsByDate[c.date] || []).push(c); });

    var selDate = S.calSelectedDate;
    var shownDates;
    if (selDate) {
      shownDates = calConcerts.filter(function (c) { return c.date >= selDate; })
        .sort(function (a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); })
        .reduce(function (acc, c) { if (acc.indexOf(c.date) === -1) acc.push(c.date); return acc; }, [])
        .slice(0, 3);
    } else {
      shownDates = calConcerts.filter(function (c) { return c.date >= TODAY && c.status !== "cancel·lat"; })
        .sort(function (a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); })
        .reduce(function (acc, c) { if (acc.indexOf(c.date) === -1) acc.push(c.date); return acc; }, [])
        .slice(0, 3);
    }

    var weeksHtml = "";
    for (var wStart = 0; wStart < cells.length; wStart += 7) {
      var week = cells.slice(wStart, wStart + 7);
      var daysHtml = week.map(function (dd) {
        if (!dd) return '<button class="cal-day empty" disabled></button>';
        var dateStr = y + "-" + pad2(mIdx + 1) + "-" + pad2(dd);
        var evs = eventsByDate[dateStr] || [];
        var selected = S.calSelectedDate === dateStr;
        var isToday = dateStr === TODAY;
        var dots = evs.map(function (e) {
          return '<span class="cal-day-dot" style="background:' + statusColors(e.status).color + '"></span>';
        }).join("");
        var tooltip = (evs.length && shownDates.indexOf(dateStr) === -1) ? (
          '<div class="cal-day-tooltip">' +
            evs.map(function (e) {
              return (
                '<div class="cal-day-tooltip-row">' +
                  '<span class="cal-day-tooltip-band">' + esc(e.bandName) + '</span>' +
                  '<span class="cal-day-tooltip-city">' + esc(e.city) + '</span>' +
                '</div>'
              );
            }).join("") +
          '</div>'
        ) : "";
        return (
          '<button class="cal-day ' + (selected ? "selected" : "") + ' ' + (isToday ? "today" : "") + '" data-action="calSelectDay" data-date="' + dateStr + '">' +
            '<span class="cal-day-num">' + dd + '</span>' +
            '<div class="cal-day-dots">' + dots + '</div>' +
            tooltip +
          '</button>'
        );
      }).join("");
      weeksHtml += '<div class="cal-week">' + daysHtml + '</div>';
    }

    function dayCardsHtml(dates, byDate) {
      return dates.map(function (date) {
        var dayNum = parseInt(date.slice(8, 10), 10);
        var mIdx = parseInt(date.slice(5, 7), 10) - 1;
        var weekday = WEEKDAY_FULL[new Date(parseInt(date.slice(0, 4), 10), mIdx, dayNum).getDay()];
        var concertsHtml = byDate[date].map(function (c) {
          return (
            '<div class="upcoming-concert-row clickable" data-action="openConcertModal" data-mode="edit" data-id="' + c.id + '">' +
              '<div class="upcoming-concert-top">' +
                '<span class="upcoming-concert-band">' + esc(c.bandName) + '</span>' +
                '<div style="display:flex;align-items:center;gap:2px;">' +
                  '<button class="row-rs-btn" data-action="openRouteSheetModal" data-id="' + c.id + '" title="Edita el full de ruta" aria-label="Edita el full de ruta">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                      '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>' +
                    '</svg>' +
                  '</button>' +
                  '<button class="row-rs-btn' + (rsIsComplete(c) ? " rs-complete" : "") + '" data-action="openRouteSheetPreview" data-id="' + c.id + '" title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta">' +
                    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                      '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>' +
                    '</svg>' +
                  '</button>' +
                '</div>' +
              '</div>' +
              '<div class="upcoming-concert-place">' + esc(c.venue) + ', ' + esc(c.city) + '</div>' +
            '</div>'
          );
        }).join("");
        return (
          '<div class="upcoming-day-card' + (date === S.calSelectedDate ? " cal-hover-highlight" : "") + '" data-date="' + date + '">' +
            '<div class="upcoming-day-card-header">' +
              '<div class="upcoming-day-card-num">' + dayNum + '</div>' +
              '<div class="upcoming-day-card-meta">' +
                '<div class="upcoming-day-card-weekday">' + weekday + '</div>' +
                '<div class="upcoming-day-card-month">' + MONTH_ABBR[mIdx] + '</div>' +
              '</div>' +
              '<div class="spacer"></div>' +
              '<div class="upcoming-day-card-fdr-label">FDR</div>' +
            '</div>' +
            '<div class="upcoming-day-card-concerts">' + concertsHtml + '</div>' +
          '</div>'
        );
      }).join("");
    }
    function groupByDate(list) {
      var byDate = {}; var dates = [];
      list.forEach(function (c) {
        if (!byDate[c.date]) { byDate[c.date] = []; dates.push(c.date); }
        byDate[c.date].push(c);
      });
      return { byDate: byDate, dates: dates };
    }
    var sideTitle, sideContent;
    if (selDate) {
      var forward = groupByDate(
        calConcerts.filter(function (c) { return c.date >= selDate; })
          .sort(function (a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); })
      );
      var selCardsHtml = shownDates.length ? dayCardsHtml(shownDates, forward.byDate) : '<div class="empty-state">Cap actuació propera.</div>';
      sideTitle = capitalize(formatDateFull(selDate));
      sideContent = '<div class="cal-side-panel"><div class="upcoming-days">' + selCardsHtml + '</div></div>';
    } else {
      var upcoming = groupByDate(
        calConcerts.filter(function (c) { return c.date >= TODAY && c.status !== "cancel·lat"; })
          .sort(function (a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); })
      );
      var cardsHtml = shownDates.length ? dayCardsHtml(shownDates, upcoming.byDate) : '<div class="empty-state">Cap actuació propera.</div>';
      sideTitle = "Propers bolos";
      sideContent = '<div class="cal-side-panel"><div class="upcoming-days">' + cardsHtml + '</div></div>';
    }

    var calBandLabel = S.calBandFilter.length === 0 ? "Tots els grups" :
      (S.calBandFilter.length === 1 ? ((S.bands.filter(function (b) { return b.id === S.calBandFilter[0]; })[0] || {}).name || "1 grup") :
        S.calBandFilter.length + " grups");
    var calBandDropdownItems = (
      '<button class="year-option ' + (S.calBandFilter.length === 0 ? "active" : "") + '" data-action="setCalBandAll">' +
        '<span class="band-check">' + (S.calBandFilter.length === 0 ? "✓" : "") + '</span>Tots els grups' +
      '</button>' +
      '<div class="year-option-divider"></div>' +
      S.bands.map(function (b) {
        var checked = !!calBandSet[b.id];
        return '<button class="year-option ' + (checked ? "active" : "") + '" data-action="toggleCalBand" data-id="' + b.id + '">' +
          '<span class="band-check">' + (checked ? "✓" : "") + '</span>' + esc(b.name) +
        '</button>';
      }).join("")
    );
    var calBandFilterUi = (
      '<div class="year-select-wrap">' +
        '<button class="pill active" data-action="toggleCalBandFilter">' + esc(calBandLabel) + ' ▾</button>' +
        (S.calBandFilterOpen ?
          '<div class="year-picker-overlay" data-action="closeCalBandFilter"></div>' +
          '<div class="year-dropdown band-dropdown" data-action="stop">' + calBandDropdownItems + '</div>'
          : "") +
      '</div>'
    );

    return (
      '<div style="display:flex;flex-direction:column;gap:16px;">' +
        '<div class="range-pills">' + calBandFilterUi + '</div>' +
        '<div class="cal-cols">' +
          '<div class="cal-left-col">' +
            '<div class="cal-toolbar">' +
              '<button class="cal-nav-btn" data-action="calPrev">‹</button>' +
              '<div class="cal-month-label">' + capitalize(monthLabel) + '</div>' +
              '<button class="cal-nav-btn" data-action="calNext">›</button>' +
            '</div>' +
            '<div class="cal-grid-panel">' +
              '<div class="cal-weekdays">' + WEEKDAY_SHORT.map(function (w) { return '<div class="cal-weekday">' + w + '</div>'; }).join("") + '</div>' +
              weeksHtml +
            '</div>' +
          '</div>' +
          '<div class="cal-right-col">' +
            '<div class="cal-side-title">' + esc(sideTitle) + '</div>' +
            sideContent +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function deleteConcertBtn(id) {
    return (
      '<button class="row-delete-btn" data-action="deleteConcert" data-id="' + id + '" title="Eliminar concert" aria-label="Eliminar concert">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' +
        '</svg>' +
      '</button>'
    );
  }

  /* ================= PAGE: CONCERTS ================= */
  function renderConcerts() {
    var search = S.concertsSearch.toLowerCase();
    var list = S.concerts.filter(function (c) {
      return (S.concertsStatusFilter === "tots" || c.status === S.concertsStatusFilter) &&
        (S.concertsTagFilter === "tots" || (c.tags && c.tags.indexOf(S.concertsTagFilter) !== -1)) &&
        (!search || c.bandName.toLowerCase().indexOf(search) !== -1 || c.venue.toLowerCase().indexOf(search) !== -1 || c.city.toLowerCase().indexOf(search) !== -1);
    });
    var upcomingList = list.filter(function (c) { return c.date >= TODAY; })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); });
    var pastList = list.filter(function (c) { return c.date < TODAY; })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || b.time.localeCompare(a.time); });

    var tagOpts = uniqueTags(S.concerts).map(function (t) {
      return '<option value="' + esc(t) + '" ' + (S.concertsTagFilter === t ? "selected" : "") + '>' + esc(t) + '</option>';
    }).join("");

    var filterBar = (
      '<div class="filter-bar concerts-filterbar">' +
        '<input class="input search" type="text" placeholder="Cercar grup, sala, ciutat…" value="' + esc(S.concertsSearch) + '" data-bind="concertsSearch" data-fkey="concertsSearch"/>' +
        '<select class="input" data-bind="concertsStatusFilter">' +
          '<option value="tots" ' + (S.concertsStatusFilter === "tots" ? "selected" : "") + '>Tots els estats</option>' +
          '<option value="confirmat" ' + (S.concertsStatusFilter === "confirmat" ? "selected" : "") + '>Confirmat</option>' +
          '<option value="pendent" ' + (S.concertsStatusFilter === "pendent" ? "selected" : "") + '>Pendent</option>' +
          '<option value="cancel·lat" ' + (S.concertsStatusFilter === "cancel·lat" ? "selected" : "") + '>Cancel·lat</option>' +
        '</select>' +
        '<select class="input" data-bind="concertsTagFilter">' +
          '<option value="tots" ' + (S.concertsTagFilter === "tots" ? "selected" : "") + '>Totes les etiquetes</option>' +
          tagOpts +
        '</select>' +
        '<button class="btn-accent" data-action="openConcertModal" data-mode="new">+ Nou concert</button>' +
      '</div>'
    );

    if (upcomingList.length === 0 && pastList.length === 0) {
      return '<div style="display:flex;flex-direction:column;gap:16px;">' + filterBar + '<div class="empty-state">Cap concert coincideix amb els filtres.</div></div>';
    }

    function routeSheetBtns(c) {
      return (
        '<button class="row-rs-btn" data-action="openRouteSheetModal" data-id="' + c.id + '" title="Edita el full de ruta" aria-label="Edita el full de ruta">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>' +
          '</svg>' +
        '</button>' +
        '<button class="row-rs-btn' + (rsIsComplete(c) ? " rs-complete" : "") + '" data-action="openRouteSheetPreview" data-id="' + c.id + '" title="Previsualitza el full de ruta" aria-label="Previsualitza el full de ruta">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>' +
          '</svg>' +
        '</button>'
      );
    }

    var invByConcert = {};
    S.invoices.forEach(function (i) { invByConcert[i.concertId] = i; });
    function concertRow(c) {
      var sc = statusColors(c.status);
      var inv = invByConcert[c.id];
      var invoiceCell = inv ? (function () {
        var ic = statusColors(inv.state);
        return (
          '<div style="display:flex;align-items:center;justify-content:center;">' +
            '<button type="button" class="row-rs-btn" style="color:' + ic.color + ';" data-action="openInvoicePreview" data-id="' + esc(inv.id) + '" title="Visualitza la factura (' + esc(inv.id) + ')" aria-label="Visualitza la factura">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>' +
            '</button>' +
          '</div>'
        );
      })() : (c.status === "confirmat" ? (
        '<div style="display:flex;align-items:center;justify-content:center;">' +
          '<button type="button" class="row-rs-btn" data-action="openInvoiceModal" data-id="' + c.id + '" title="Genera factura" aria-label="Genera factura">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="13" x2="12" y2="17"></line><line x1="10" y1="15" x2="14" y2="15"></line></svg>' +
          '</button>' +
        '</div>'
      ) : '<span class="t-dim">—</span>');
      return (
        '<div class="t-row concerts-cols clickable" data-action="openConcertModal" data-mode="edit" data-id="' + c.id + '">' +
          '<div class="t-dim">' + formatDate(c.date) + '</div>' +
          '<div class="t-strong">' + esc(c.bandName) + '</div>' +
          '<div class="t-dim">' + esc(c.city) + '</div>' +
          '<div class="t-dim">' + esc(c.venue) + '</div>' +
          '<div class="t-dim"></div>' +
          '<div><span class="badge" style="background:' + sc.bg + ';color:' + sc.color + '">' + c.status + '</span></div>' +
          '<div class="rs-btn-group">' + routeSheetBtns(c) + '</div>' +
          '<div style="text-align:center;">' + invoiceCell + '</div>' +
          '<div>' + deleteConcertBtn(c.id) + '</div>' +
        '</div>'
      );
    }

    var rowsDesktop = (
      upcomingList.map(concertRow).join("") +
      (pastList.length ? (
        '<div class="concerts-section-divider">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' +
          '<span>Bolos realitzats (' + pastList.length + ')</span>' +
        '</div>'
      ) : "") +
      pastList.map(concertRow).join("")
    );

    return (
      '<div style="display:flex;flex-direction:column;gap:16px;">' +
        filterBar +
        '<div class="table-wrap no-clip">' +
          '<div class="t-row t-head concerts-cols"><div>Data</div><div>Grup</div><div>Població</div><div>Ubicació</div><div>Festa/entitat</div><div>Estat</div><div style="text-align:center;">FDR</div><div style="text-align:center;">Factura</div><div></div></div>' +
          rowsDesktop +
        '</div>' +
      '</div>'
    );
  }

  /* ================= PAGE: GRUPS ================= */
  function renderGrups() {
    var tagFilterSet = {};
    S.grupsTagFilter.forEach(function (t) { tagFilterSet[t] = true; });
    var list = S.bands.filter(function (b) {
      return !S.grupsTagFilter.length || (b.tags || []).some(function (t) { return tagFilterSet[t]; });
    });
    var allTags = uniqueTags(S.bands);
    var tagFilterLabel = S.grupsTagFilter.length === 0 ? "Totes les etiquetes" :
      (S.grupsTagFilter.length === 1 ? S.grupsTagFilter[0] : S.grupsTagFilter.length + " etiquetes");
    var tagFilterDropdownItems = (
      '<button class="year-option ' + (S.grupsTagFilter.length === 0 ? "active" : "") + '" data-action="setGrupsTagAll">' +
        '<span class="band-check">' + (S.grupsTagFilter.length === 0 ? "✓" : "") + '</span>Totes les etiquetes' +
      '</button>' +
      '<div class="year-option-divider"></div>' +
      allTags.map(function (t) {
        var checked = !!tagFilterSet[t];
        return '<button class="year-option ' + (checked ? "active" : "") + '" data-action="toggleGrupsTag" data-tag="' + esc(t) + '">' +
          '<span class="band-check">' + (checked ? "✓" : "") + '</span>' + esc(t) +
        '</button>';
      }).join("")
    );
    var tagFilterUi = (
      '<div class="year-select-wrap">' +
        '<button class="pill active" data-action="toggleGrupsTagFilter">' + esc(tagFilterLabel) + ' ▾</button>' +
        (S.grupsTagFilterOpen ?
          '<div class="year-picker-overlay" data-action="closeGrupsTagFilter"></div>' +
          '<div class="year-dropdown band-dropdown" data-action="stop">' + tagFilterDropdownItems + '</div>'
          : "") +
      '</div>'
    );
    var cardsHtml = list.length ? list.map(function (b) {
      var tagsHtml = (b.tags || []).map(function (t) {
        var tc = tagColors(t);
        return '<span class="badge" style="background:' + tc.bg + ';color:' + tc.color + '">' + esc(t) + '</span>';
      }).join("");
      return (
        '<div class="band-card" data-action="openBandModal" data-id="' + b.id + '">' +
          '<img class="band-photo" src="' + bandPhotoDataUri(b) + '" alt="' + esc(b.name) + '"/>' +
          '<div class="band-card-top">' +
            '<div class="band-name">' + esc(b.name) + '</div>' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">' + tagsHtml + '</div>' +
          '</div>' +
          '<div class="band-meta">' + esc(b.city) + ' · ' + b.members.length + ' integrants</div>' +
          '<div class="band-foot">' +
            '<span class="band-foot-label">' + b.history + ' actuacions</span>' +
            '<span class="t-strong">' + formatCurrency(b.rate) + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join("") : '<div class="empty-state">Cap grup coincideix amb els filtres.</div>';

    return (
      '<div style="display:flex;flex-direction:column;gap:16px;">' +
        '<div class="filter-bar">' +
          tagFilterUi +
        '</div>' +
        '<div class="band-grid">' + cardsHtml + '</div>' +
      '</div>'
    );
  }

  /* ================= PAGE: FACTURACIO ================= */
  function renderFacturacio() {
    var invoices = S.invoices;
    var list = invoices.filter(function (i) { return S.factStateFilter === "tots" || i.state === S.factStateFilter; })
      .sort(function (a, b) { return b.issueDate.localeCompare(a.issueDate); });

    var rowsDesktop = list.map(function (inv) {
      var sc = statusColors(inv.state);
      return (
        '<div class="t-row fact-cols">' +
          '<div><button type="button" class="link-btn t-dim" style="font-size:inherit;" data-action="openInvoicePreview" data-id="' + esc(inv.id) + '" title="Visualitza la factura" aria-label="Visualitza la factura">' + esc(inv.id) + '</button></div>' +
          '<div class="t-strong">' + esc(inv.client) + '</div>' +
          '<div class="t-dim">' + formatDate(inv.issueDate) + '</div>' +
          '<div>' + formatCurrency(inv.amount) + '</div>' +
          '<div><span class="badge" style="background:' + sc.bg + ';color:' + sc.color + '">' + inv.state + '</span></div>' +
          '<div style="text-align:center;">' +
            '<button type="button" class="row-rs-btn" data-action="openInvoicePreview" data-id="' + esc(inv.id) + '" title="Visualitza la factura" aria-label="Visualitza la factura">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>' +
            '</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");
    var listHtml = list.length ? (
      '<div class="table-wrap scrollx">' +
        '<div class="t-row t-head fact-cols"><div>Factura</div><div>Client / Sala</div><div>Data</div><div>Import</div><div>Estat</div><div></div></div>' +
        rowsDesktop +
      '</div>'
    ) : '<div class="empty-state">Cap factura coincideix amb el filtre.</div>';

    return (
      '<div style="display:flex;flex-direction:column;gap:20px;">' +
        '<div class="card" style="padding:12px 16px;">' +
          '<div class="card-title">Dades de l\'empresa emissora</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;">' +
            '<div style="display:flex;flex-direction:column;width:210px;"><label class="form-label">Nom</label><input class="field-input form-field compact-field" type="text" value="' + esc(S.companyInfo.nom) + '" data-bind="companyInfo.nom" data-fkey="companyInfo.nom"/></div>' +
            '<div style="display:flex;flex-direction:column;width:150px;"><label class="form-label">CIF</label><input class="field-input form-field compact-field" type="text" value="' + esc(S.companyInfo.cif) + '" data-bind="companyInfo.cif" data-fkey="companyInfo.cif"/></div>' +
            '<div style="display:flex;flex-direction:column;width:220px;"><label class="form-label">Adreça</label><input class="field-input form-field compact-field" type="text" value="' + esc(S.companyInfo.address) + '" data-bind="companyInfo.address" data-fkey="companyInfo.address"/></div>' +
            '<div style="display:flex;flex-direction:column;width:220px;"><label class="form-label">Número de compte</label><input class="field-input form-field compact-field" type="text" placeholder="ES00 0000 0000 0000 0000 0000" value="' + esc(S.companyInfo.iban) + '" data-bind="companyInfo.iban" data-fkey="companyInfo.iban"/></div>' +
          '</div>' +
        '</div>' +
        '<div class="filter-bar">' +
          '<select class="input" data-bind="factStateFilter">' +
            '<option value="tots" ' + (S.factStateFilter === "tots" ? "selected" : "") + '>Tots els estats</option>' +
            '<option value="pagada" ' + (S.factStateFilter === "pagada" ? "selected" : "") + '>Pagada</option>' +
            '<option value="pendent" ' + (S.factStateFilter === "pendent" ? "selected" : "") + '>Pendent</option>' +
            '<option value="vençuda" ' + (S.factStateFilter === "vençuda" ? "selected" : "") + '>Vençuda</option>' +
          '</select>' +
          '<div class="spacer"></div>' +
          '<button class="btn-accent" data-action="openInvoiceModal">+ Generar factura</button>' +
        '</div>' +
        listHtml +
      '</div>'
    );
  }

  /* ================= PAGE: BASE DE DADES ================= */
  function renderBaseDades() {
    var searchL = S.dbSearch.toLowerCase();
    var view = S.dbView || "concerts";
    var rows = S.concerts.filter(function (c) {
      return !searchL || c.bandName.toLowerCase().indexOf(searchL) !== -1 || c.venue.toLowerCase().indexOf(searchL) !== -1 || c.city.toLowerCase().indexOf(searchL) !== -1;
    });
    var dir = S.dbSortDir === "asc" ? 1 : -1;
    var keyFns = {
      id: function (c) { return c.id; }, date: function (c) { return c.date; },
      band: function (c) { return c.bandName; }, status: function (c) { return c.status; },
      amount: function (c) { return c.amount; }
    };
    var keyFn = keyFns[S.dbSortKey];
    rows = rows.slice().sort(function (a, b) {
      var ka = keyFn(a), kb = keyFn(b);
      if (ka > kb) return dir; if (ka < kb) return -dir; return 0;
    });
    var invByConcert = {}; S.invoices.forEach(function (i) { invByConcert[i.concertId] = i.state; });
    function sortArrow(key) { return S.dbSortKey === key ? (S.dbSortDir === "asc" ? " ▲" : " ▼") : ""; }

    var rowsDesktop = rows.map(function (r) {
      var idx = S.concerts.indexOf(r);
      var sc = statusColors(r.status);
      return (
        '<div class="t-row db-cols">' +
          '<div class="t-dim">' + esc(r.id) + '</div>' +
          '<div class="db-date-wrap" style="position:relative;">' +
            '<button type="button" class="field-input db-cell-input db-date-btn" data-action="toggleDbDatePicker" data-id="' + r.id + '">' + formatDate(r.date) + '</button>' +
            (S.dbDatePickerFor === r.id ? (
              '<div class="year-picker-overlay" data-action="closeDbDatePicker"></div>' +
              renderDbDatePicker(r.id, r.date)
            ) : "") +
          '</div>' +
          '<input class="field-input db-cell-input" type="text" list="db-band-names" value="' + esc(r.bandName) + '" data-bind="concerts.' + idx + '.bandName" data-fkey="concerts.' + idx + '.bandName"/>' +
          '<input class="field-input db-cell-input" type="text" value="' + esc(r.city) + '" data-bind="concerts.' + idx + '.city" data-fkey="concerts.' + idx + '.city"/>' +
          '<input class="field-input db-cell-input" type="text" value="' + esc(r.venue) + '" data-bind="concerts.' + idx + '.venue" data-fkey="concerts.' + idx + '.venue"/>' +
          '<button type="button" class="status-cycle-btn" data-action="cycleDbStatus" data-id="' + r.id + '" style="background:' + sc.bg + ';color:' + sc.color + '">' + r.status + '</button>' +
          '<div class="db-amount-wrap"><input class="field-input db-cell-input db-amount-input" type="number" value="' + r.amount + '" data-bind="concerts.' + idx + '.amount" data-fkey="concerts.' + idx + '.amount"/><span class="db-amount-suffix">€</span></div>' +
          '<div class="t-dim">' + (invByConcert[r.id] || "—") + '</div>' +
          '<div class="row-actions">' + deleteConcertBtn(r.id) + '</div>' +
        '</div>'
      );
    }).join("");

    var tableOrEmpty = rows.length ? (
      '<div class="table-wrap no-clip">' +
        '<div class="t-row t-head db-cols">' +
          '<button data-action="toggleSort" data-key="id">ID' + sortArrow("id") + '</button>' +
          '<button data-action="toggleSort" data-key="date">Data' + sortArrow("date") + '</button>' +
          '<button data-action="toggleSort" data-key="band">Grup' + sortArrow("band") + '</button>' +
          '<div>Població</div>' +
          '<div>Recinte</div>' +
          '<button data-action="toggleSort" data-key="status">Estat' + sortArrow("status") + '</button>' +
          '<button data-action="toggleSort" data-key="amount">Catxet' + sortArrow("amount") + '</button>' +
          '<div>Factura</div>' +
          '<div></div>' +
        '</div>' +
        rowsDesktop +
      '</div>'
    ) : '<div class="empty-state">Cap registre coincideix amb la cerca.</div>';

    var bandNamesDatalist = (
      '<datalist id="db-band-names">' +
        S.bands.map(function (b) { return '<option value="' + esc(b.name) + '"></option>'; }).join("") +
      '</datalist>'
    );

    var bandRows = S.bands.filter(function (b) {
      return !searchL || b.name.toLowerCase().indexOf(searchL) !== -1;
    });
    var bandsRowsHtml = bandRows.map(function (b) {
      var idx = S.bands.indexOf(b);
      var tagsHtml = (b.tags || []).map(function (t) {
        var tc = tagColors(t);
        return '<span class="badge sm" style="background:' + tc.bg + ';color:' + tc.color + '">' + esc(t) + '</span>';
      }).join("");
      return (
        '<div class="t-row bands-cols">' +
          '<input class="field-input db-cell-input" type="text" value="' + esc(b.name) + '" data-bind="bands.' + idx + '.name" data-fkey="bands.' + idx + '.name"/>' +
          '<div class="db-tags-cell">' + (tagsHtml || '<span class="t-dim">—</span>') + '</div>' +
          '<div class="db-amount-wrap"><input class="field-input db-cell-input db-amount-input" type="number" value="' + b.rate + '" data-bind="bands.' + idx + '.rate" data-fkey="bands.' + idx + '.rate"/><span class="db-amount-suffix">€</span></div>' +
          '<div class="t-dim">' + (b.members || []).length + '</div>' +
          '<div class="t-dim">' + (b.crew || []).length + '</div>' +
        '</div>'
      );
    }).join("");
    var bandsTable = bandRows.length ? (
      '<div class="table-wrap no-clip">' +
        '<div class="t-row t-head bands-cols"><div>Nom del grup</div><div>Etiquetes</div><div>Catxet</div><div>Músics</div><div>Crew</div></div>' +
        bandsRowsHtml +
      '</div>'
    ) : '<div class="empty-state">Cap grup coincideix amb la cerca.</div>';

    var clientsMap = {};
    S.concerts.forEach(function (c) {
      if (!c.venue) return;
      if (!clientsMap[c.venue]) clientsMap[c.venue] = { name: c.venue, invoiceCount: 0, billed: 0, pending: 0 };
    });
    S.invoices.forEach(function (i) {
      if (!clientsMap[i.client]) clientsMap[i.client] = { name: i.client, invoiceCount: 0, billed: 0, pending: 0 };
      clientsMap[i.client].invoiceCount++;
      clientsMap[i.client].billed += i.amount;
      if (i.state === "pendent") clientsMap[i.client].pending += i.amount;
    });
    var clientRows = Object.keys(clientsMap).map(function (k) { return clientsMap[k]; })
      .filter(function (cl) { return !searchL || cl.name.toLowerCase().indexOf(searchL) !== -1; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    var clientsRowsHtml = clientRows.map(function (cl) {
      if (!S.clientDetails[cl.name]) S.clientDetails[cl.name] = { cif: "", nom: "", address: "" };
      var cd = S.clientDetails[cl.name];
      var keyPath = "clientDetails." + esc(cl.name) + ".";
      return (
        '<div class="t-row clients-cols">' +
          '<div class="t-strong">' + esc(cl.name) + '</div>' +
          '<input class="field-input db-cell-input" type="text" placeholder="—" value="' + esc(cd.cif) + '" data-bind="' + keyPath + 'cif" data-fkey="' + keyPath + 'cif"/>' +
          '<input class="field-input db-cell-input" type="text" placeholder="—" value="' + esc(cd.nom) + '" data-bind="' + keyPath + 'nom" data-fkey="' + keyPath + 'nom"/>' +
          '<input class="field-input db-cell-input" type="text" placeholder="—" value="' + esc(cd.address) + '" data-bind="' + keyPath + 'address" data-fkey="' + keyPath + 'address"/>' +
          '<div class="t-dim">' + cl.invoiceCount + '</div>' +
          '<div>' + formatCurrency(cl.billed) + '</div>' +
          '<div style="' + (cl.pending > 0 ? "color:var(--amber);" : "") + '">' + formatCurrency(cl.pending) + '</div>' +
        '</div>'
      );
    }).join("");
    var clientsTable = clientRows.length ? (
      '<div class="table-wrap no-clip">' +
        '<div class="t-row t-head clients-cols"><div>Client</div><div>CIF</div><div>Nom</div><div>Adreça</div><div>Factures emeses</div><div>Facturat</div><div>Pendent</div></div>' +
        clientsRowsHtml +
      '</div>'
    ) : '<div class="empty-state">Cap client coincideix amb la cerca.</div>';

    var countLabel = view === "concerts" ? (rows.length + " registres") : view === "grups" ? (bandRows.length + " grups") : (clientRows.length + " clients");

    return (
      '<div style="display:flex;flex-direction:column;gap:14px;">' +
        '<div class="filter-bar">' +
          '<div class="db-view-toggle">' +
            '<button type="button" class="db-view-btn' + (view === "grups" ? " active" : "") + '" data-action="setDbView" data-view="grups">Grups</button>' +
            '<button type="button" class="db-view-btn' + (view === "concerts" ? " active" : "") + '" data-action="setDbView" data-view="concerts">Concerts</button>' +
            '<button type="button" class="db-view-btn' + (view === "clients" ? " active" : "") + '" data-action="setDbView" data-view="clients">Clients</button>' +
          '</div>' +
          '<input class="input search" style="max-width:340px" type="text" placeholder="Cercar en tots els registres…" value="' + esc(S.dbSearch) + '" data-bind="dbSearch" data-fkey="dbSearch"/>' +
          '<div class="spacer"></div>' +
          '<button class="link-btn" data-action="resetData">Restaurar dades d\'exemple</button>' +
          '<div class="page-label">' + countLabel + '</div>' +
        '</div>' +
        (view === "concerts" ? tableOrEmpty : view === "grups" ? bandsTable : clientsTable) +
        bandNamesDatalist +
      '</div>'
    );
  }

  function renderCfDatePicker() {
    var ym = S.cfPickerYM || (S.cf.date || TODAY).slice(0, 7);
    var y = parseInt(ym.slice(0, 4), 10), mIdx = parseInt(ym.slice(5, 7), 10) - 1;
    var monthLabel = capitalize(MONTH_FULL[mIdx]) + " " + y;
    var base = new Date(y, mIdx, 1);
    var startOffset = (base.getDay() + 6) % 7;
    var daysInMonth = new Date(y, mIdx + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < startOffset; i++) cells.push(null);
    for (var d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    var weekdaysHtml = WEEKDAY_SHORT.map(function (w) { return '<div class="cf-dp-weekday">' + w + '</div>'; }).join("");
    var daysHtml = cells.map(function (dd) {
      if (!dd) return '<button type="button" class="cf-dp-day empty" disabled></button>';
      var dateStr = y + "-" + pad2(mIdx + 1) + "-" + pad2(dd);
      var selected = S.cf.date === dateStr;
      var isToday = dateStr === TODAY;
      return '<button type="button" class="cf-dp-day' + (selected ? " selected" : "") + (isToday ? " today" : "") + '" data-action="cfPickerSelectDate" data-date="' + dateStr + '">' + dd + '</button>';
    }).join("");
    return (
      '<div class="year-dropdown cf-datepicker" data-action="stop">' +
        '<div class="cf-dp-header">' +
          '<button type="button" class="cal-nav-btn" data-action="cfPickerPrevMonth">‹</button>' +
          '<div class="cf-dp-month-label">' + monthLabel + '</div>' +
          '<button type="button" class="cal-nav-btn" data-action="cfPickerNextMonth">›</button>' +
        '</div>' +
        '<div class="cf-dp-grid">' + weekdaysHtml + '</div>' +
        '<div class="cf-dp-grid">' + daysHtml + '</div>' +
      '</div>'
    );
  }

  function renderDbDatePicker(id, currentDate) {
    var ym = S.dbPickerYM || (currentDate || TODAY).slice(0, 7);
    var y = parseInt(ym.slice(0, 4), 10), mIdx = parseInt(ym.slice(5, 7), 10) - 1;
    var monthLabel = capitalize(MONTH_FULL[mIdx]) + " " + y;
    var base = new Date(y, mIdx, 1);
    var startOffset = (base.getDay() + 6) % 7;
    var daysInMonth = new Date(y, mIdx + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < startOffset; i++) cells.push(null);
    for (var d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    var weekdaysHtml = WEEKDAY_SHORT.map(function (w) { return '<div class="cf-dp-weekday">' + w + '</div>'; }).join("");
    var daysHtml = cells.map(function (dd) {
      if (!dd) return '<button type="button" class="cf-dp-day empty" disabled></button>';
      var dateStr = y + "-" + pad2(mIdx + 1) + "-" + pad2(dd);
      var selected = currentDate === dateStr;
      var isToday = dateStr === TODAY;
      return '<button type="button" class="cf-dp-day' + (selected ? " selected" : "") + (isToday ? " today" : "") + '" data-action="dbPickerSelectDate" data-id="' + id + '" data-date="' + dateStr + '">' + dd + '</button>';
    }).join("");
    return (
      '<div class="year-dropdown cf-datepicker" data-action="stop">' +
        '<div class="cf-dp-header">' +
          '<button type="button" class="cal-nav-btn" data-action="dbPickerPrevMonth">‹</button>' +
          '<div class="cf-dp-month-label">' + monthLabel + '</div>' +
          '<button type="button" class="cal-nav-btn" data-action="dbPickerNextMonth">›</button>' +
        '</div>' +
        '<div class="cf-dp-grid">' + weekdaysHtml + '</div>' +
        '<div class="cf-dp-grid">' + daysHtml + '</div>' +
      '</div>'
    );
  }

  /* ================= MODALS ================= */
  function renderConcertModal() {
    var mode = S.concertModalMode;
    var title = mode === "new" ? "Nou concert" : "Detall del concert";
    var cf = S.cf;
    var editingConcert = mode === "edit" ? S.concerts.filter(function (x) { return x.id === S.concertEditId; })[0] : null;
    var rsComplete = editingConcert ? rsIsComplete(editingConcert) : false;
    var rsBadgeColors = rsComplete ? { bg: "oklch(0.72 0.15 155 / 0.16)", color: "oklch(0.78 0.15 155)" } : { bg: "oklch(0.78 0.15 80 / 0.16)", color: "oklch(0.82 0.15 80)" };
    var bandTyped = (cf.bandName || "").trim().toLowerCase();
    var bandMatches = S.bands.filter(function (b) { return !bandTyped || b.name.toLowerCase().indexOf(bandTyped) !== -1; }).slice(0, 8);
    var bandDropdownHtml = S.cfBandDropdownOpen ? (
      '<div class="year-picker-overlay" data-action="closeCfBandDropdown"></div>' +
      '<div class="year-dropdown cf-band-dropdown" data-action="stop">' +
        (bandMatches.length ?
          bandMatches.map(function (b) {
            return '<button type="button" class="year-option" data-action="selectCfBand" data-id="' + b.id + '" data-name="' + esc(b.name) + '">' + esc(b.name) + '</button>';
          }).join("") :
          '<div class="cf-band-noresults">Cap grup coincideix</div>') +
      '</div>'
    ) : "";
    var currentBand = S.bands.filter(function (b) { return b.name.toLowerCase() === bandTyped; })[0] ||
      S.bands.filter(function (b) { return b.id === cf.bandId; })[0];
    var attendance = cf.attendance || {};
    var substitutes = cf.substitutes || {};
    var noSubstitute = cf.noSubstitute || {};
    function personLabel(m) { return m.name + (m.role ? " — " + m.role : ""); }
    function renderAttendanceRows(people) {
      return people.map(function (m) {
        var state = attendance[m.name];
        if (state === "yes") {
          return (
            '<div class="cf-convocat-row cf-convocat-yes" data-action="resetAttendance" data-name="' + esc(m.name) + '" title="Clica per reiniciar">' +
              '<span class="cf-convocat-name">' + esc(personLabel(m)) + '</span>' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
            '</div>'
          );
        } else if (state === "no") {
          return (
            '<div class="cf-convocat-row cf-convocat-no" data-action="resetAttendance" data-name="' + esc(m.name) + '" title="Clica per reiniciar">' +
              '<span class="cf-convocat-name">' + esc(personLabel(m)) + '</span>' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
            '</div>' +
            (noSubstitute[m.name] ? "" : (
              '<div class="cf-substitute-row">' +
                '<input class="field-input cf-substitute-input" type="text" placeholder="Nom del substitut" value="' + esc(substitutes[m.name] || "") + '" data-bind="cf.substitutes.' + esc(m.name) + '" data-fkey="cf.substitutes.' + esc(m.name) + '"/>' +
                '<span class="cf-substitute-role">' + esc(m.role ? " — " + m.role : "") + '</span>' +
                '<button type="button" class="cf-substitute-none-btn" data-action="markNoSubstitute" data-name="' + esc(m.name) + '" title="Sense substitut" aria-label="Sense substitut">' +
                  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
                '</button>' +
              '</div>'
            ))
          );
        }
        return (
          '<div class="cf-convocat-row">' +
            '<span class="cf-convocat-name">' + esc(personLabel(m)) + '</span>' +
            '<div class="cf-convocat-controls">' +
              '<button type="button" class="cf-attend-btn yes" data-action="setAttendance" data-name="' + esc(m.name) + '" data-value="yes" title="Confirma assistència">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
              '</button>' +
              '<button type="button" class="cf-attend-btn no" data-action="setAttendance" data-name="' + esc(m.name) + '" data-value="no" title="No pot assistir">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
              '</button>' +
            '</div>' +
          '</div>'
        );
      }).join("");
    }
    var hasMusics = currentBand && currentBand.members && currentBand.members.length;
    var hasCrew = currentBand && currentBand.crew && currentBand.crew.length;
    var convocatoriaHtml = (hasMusics || hasCrew) ? (
      '<div>' +
        '<div class="modal-title" style="margin:4px 0 12px;">Assistència</div>' +
        (hasMusics ? (
          '<label class="form-label">Músics</label>' +
          '<div class="cf-convocatoria-list">' + renderAttendanceRows(currentBand.members) + '</div>'
        ) : "") +
        (hasCrew ? (
          '<label class="form-label" style="display:block;margin-top:' + (hasMusics ? "12px" : "0") + ';">Crew</label>' +
          '<div class="cf-convocatoria-list">' + renderAttendanceRows(currentBand.crew) + '</div>'
        ) : "") +
      '</div>'
    ) : "";
    return (
      '<div class="modal-overlay" data-action="closeConcertModal">' +
        '<div class="modal" data-action="stop">' +
          '<div class="modal-head">' +
            '<div class="modal-title">' + title + '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
              (mode === "edit" ? (
                '<button type="button" class="row-rs-btn" data-action="deleteConcert" data-id="' + S.concertEditId + '" title="Eliminar" aria-label="Eliminar">' +
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>' +
                '</button>'
              ) : "") +
              '<button type="button" class="row-rs-btn" data-action="saveConcert" title="Desar" aria-label="Desar">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>' +
              '</button>' +
              '<button class="modal-close" data-action="closeConcertModal" title="Cancel·lar" aria-label="Cancel·lar">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="modal-form">' +
            '<div class="form-row">' +
              '<div style="position:relative;">' +
                '<label class="form-label">Grup</label>' +
                '<input class="field-input form-field" type="text" autocomplete="off" placeholder="Escriu el nom del grup…" value="' + esc(cf.bandName) + '" data-bind="cf.bandName" data-fkey="cf.bandName"/>' +
                bandDropdownHtml +
              '</div>' +
              '<div style="position:relative;">' +
                '<label class="form-label">Data</label>' +
                '<input class="field-input form-field" type="text" readonly placeholder="Selecciona una data" value="' + (cf.date ? esc(formatDateLong(cf.date)) : "") + '" data-action="toggleCfDatePicker"/>' +
                (S.cfDatePickerOpen ? (
                  '<div class="year-picker-overlay" data-action="closeCfDatePicker"></div>' +
                  renderCfDatePicker()
                ) : "") +
              '</div>' +
            '</div>' +
            '<div class="form-row">' +
              '<div><label class="form-label">Ubicació</label><input class="field-input form-field" type="text" value="' + esc(cf.venue) + '" data-bind="cf.venue" data-fkey="cf.venue"/></div>' +
              '<div><label class="form-label">Població</label><input class="field-input form-field" type="text" value="' + esc(cf.city) + '" data-bind="cf.city" data-fkey="cf.city"/></div>' +
            '</div>' +
            '<div class="form-row">' +
              '<div><label class="form-label">Catxet (€)</label><input class="field-input form-field" type="text" inputmode="numeric" value="' + esc(cf.amount) + '" data-bind="cf.amount" data-fkey="cf.amount"/></div>' +
              '<div><label class="form-label">Estat</label>' +
                '<button type="button" class="status-cycle-btn" data-action="cycleConcertStatus" style="background:' + statusColors(cf.status).bg + ';color:' + statusColors(cf.status).color + '">' + cf.status + '</button>' +
              '</div>' +
            '</div>' +
            (mode === "edit" ? (
              '<div>' +
                '<label class="form-label">Full de ruta</label>' +
                '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">' +
                  '<span class="badge sm" style="background:' + rsBadgeColors.bg + ';color:' + rsBadgeColors.color + '">' + (rsComplete ? "Acabat" : "Inacabat") + '</span>' +
                  '<button type="button" class="row-rs-btn" data-action="openRouteSheetModal" data-id="' + S.concertEditId + '" title="Editar" aria-label="Editar">' +
                    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>' +
                  '</button>' +
                  '<button type="button" class="row-rs-btn' + (rsComplete ? " rs-complete" : "") + '" data-action="openRouteSheetPreview" data-id="' + S.concertEditId + '" title="Visualitzar" aria-label="Visualitzar">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>' +
                  '</button>' +
                '</div>' +
              '</div>'
            ) : "") +
            convocatoriaHtml +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function rsDragHandle(section, i) {
    return (
      '<div class="rs-drag-handle" draggable="true" data-rs-section="' + section + '" data-rs-index="' + i + '" title="Arrossega per reordenar">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>' +
      '</div>'
    );
  }
  function rsRemoveBtn(section, i) {
    return (
      '<button type="button" class="rs-mini-btn danger" data-action="removeRsItem" data-section="' + section + '" data-index="' + i + '" title="Elimina">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '</button>'
    );
  }
  function rsToggleIconSvg(yes) {
    return yes ?
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' :
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  }
  function rsToggleLabelCell(section, i, it, labelPlaceholder) {
    var included = it.included !== false;
    return (
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<input class="field-input" style="flex:1;min-width:0;" type="text" placeholder="' + esc(labelPlaceholder || "Camp") + '" value="' + esc(it.label) + '" data-bind="rsf.' + section + '.' + i + '.label" data-fkey="rsf.' + section + '.' + i + '.label"/>' +
        '<button type="button" class="rs-toggle-pill ' + (included ? "yes" : "no") + '" data-action="toggleIncluded" data-section="' + section + '" data-index="' + i + '" title="Clica per canviar">' +
          rsToggleIconSvg(included) +
        '</button>' +
      '</div>'
    );
  }
  function rsDetailValueCell(section, i, it, placeholder) {
    return '<input class="field-input" style="flex:1;min-width:0;" type="text" placeholder="' + esc(placeholder || "") + '" value="' + esc(it.value) + '" data-bind="rsf.' + section + '.' + i + '.value" data-fkey="rsf.' + section + '.' + i + '.value"/>';
  }
  function rsToggleFieldButton(section, i, it) {
    var included = it.included !== false;
    return (
      '<button type="button" class="rs-toggle-pill rs-toggle-pill-fixed ' + (included ? "yes" : "no") + '" data-action="toggleIncluded" data-section="' + section + '" data-index="' + i + '" title="Clica per canviar">' +
        '<span>' + esc(it.label) + '</span>' +
        rsToggleIconSvg(included) +
      '</button>'
    );
  }
  function rsToggleFieldRow(section, i, it, placeholder) {
    return (
      '<div style="grid-column: 2 / span 2; display:flex; align-items:center; gap:8px; min-width:0;">' +
        rsToggleFieldButton(section, i, it) +
        rsDetailValueCell(section, i, it, placeholder) +
      '</div>'
    );
  }
  function renderRouteSheetModal() {
    var c = S.concerts.filter(function (x) { return x.id === S.routeSheetConcertId; })[0];
    if (!c || !S.rsf) return "";
    var rsf = S.rsf;

    var RS_LINK_FIELDS = { "adreça": true, "descàrrega": true, "parking": true };
    function rsValuePlaceholder(section, label) {
      if (section === "lloc" && RS_LINK_FIELDS[(label || "").trim().toLowerCase()]) return "Enllaç Google Maps";
      return "";
    }
    function fieldRows(section, items) {
      return items.map(function (it, i) {
        var isParking = section === "lloc" && it.label && it.label.trim().toLowerCase() === "parking";
        var isPantallaLed = section === "tecnic" && it.label && it.label.trim().toLowerCase() === "pantalla led";
        var labelCell = isPantallaLed ?
          rsToggleLabelCell(section, i, it, "Camp") :
          '<input class="field-input" type="text" placeholder="Camp (p.ex. Adreça)" value="' + esc(it.label) + '" data-bind="rsf.' + section + '.' + i + '.label" data-fkey="rsf.' + section + '.' + i + '.label"/>';
        var valueCell = isPantallaLed ?
          rsDetailValueCell(section, i, it, "Mida (p.ex. 3x2m)") :
          '<input class="field-input" type="text" placeholder="' + esc(rsValuePlaceholder(section, it.label)) + '" value="' + esc(it.value) + '" data-bind="rsf.' + section + '.' + i + '.value" data-fkey="rsf.' + section + '.' + i + '.value"/>';
        var mainRow = (
          '<div class="rs-field-row" data-rs-section="' + section + '" data-rs-index="' + i + '">' +
            rsDragHandle(section, i) +
            labelCell +
            valueCell +
            rsRemoveBtn(section, i) +
          '</div>'
        );
        var extraRow = isParking ? (
          '<div class="rs-attached-row">' +
            '<input class="field-input" type="text" placeholder="Matrícules autoritzades, separades per comes" value="' + esc(it.plates || "") + '" data-bind="rsf.' + section + '.' + i + '.plates" data-fkey="rsf.' + section + '.' + i + '.plates"/>' +
          '</div>'
        ) : "";
        return mainRow + extraRow;
      }).join("");
    }

    var contactRows = rsf.contacts.map(function (ct, i) {
      return (
        '<div class="rs-contact-row" data-rs-section="contacts" data-rs-index="' + i + '">' +
          rsDragHandle("contacts", i) +
          '<input class="field-input" type="text" placeholder="Càrrec" value="' + esc(ct.role) + '" data-bind="rsf.contacts.' + i + '.role" data-fkey="rsf.contacts.' + i + '.role"/>' +
          '<input class="field-input" type="text" placeholder="Nom" value="' + esc(ct.name) + '" data-bind="rsf.contacts.' + i + '.name" data-fkey="rsf.contacts.' + i + '.name"/>' +
          '<input class="field-input" type="text" placeholder="Empresa" value="' + esc(ct.company) + '" data-bind="rsf.contacts.' + i + '.company" data-fkey="rsf.contacts.' + i + '.company"/>' +
          '<input class="field-input" type="text" placeholder="Telèfon" value="' + esc(ct.phone) + '" data-bind="rsf.contacts.' + i + '.phone" data-fkey="rsf.contacts.' + i + '.phone"/>' +
          rsRemoveBtn("contacts", i) +
        '</div>'
      );
    }).join("");

    function rsTimePairHtml(path, value) {
      var parts = (value || "").split(":");
      var h = parts[0] || "", m = parts[1] || "";
      return (
        '<div class="rs-time-pair">' +
          '<input type="text" inputmode="numeric" maxlength="2" placeholder="00" class="field-input rs-time-box" value="' + esc(h) + '" data-rs-time-path="' + path + '" data-rs-time-part="h"/>' +
          '<span class="rs-time-sep">:</span>' +
          '<input type="text" inputmode="numeric" maxlength="2" placeholder="00" class="field-input rs-time-box" value="' + esc(m) + '" data-rs-time-path="' + path + '" data-rs-time-part="m"/>' +
        '</div>'
      );
    }

    var phaseRows = rsf.schedule.map(function (ph, i) {
      return (
        '<div class="rs-phase-row" data-rs-section="schedule" data-rs-index="' + i + '">' +
          rsDragHandle("schedule", i) +
          '<input class="field-input" type="text" placeholder="Fase" value="' + esc(ph.phase) + '" data-bind="rsf.schedule.' + i + '.phase" data-fkey="rsf.schedule.' + i + '.phase"/>' +
          rsTimePairHtml("rsf.schedule." + i + ".start", ph.start) +
          rsTimePairHtml("rsf.schedule." + i + ".end", ph.end) +
          rsRemoveBtn("schedule", i) +
        '</div>'
      );
    }).join("");

    function hospitalitatRows(items) {
      var regularHtml = "";
      var hotelHtml = "";
      var FIXED_TOGGLE_LABELS = ["dietes", "catering", "camerino"];
      items.forEach(function (it, i) {
        var isHotel = it.label && it.label.trim().toLowerCase() === "allotjament";
        if (!isHotel) {
          var isFixedToggle = it.label && FIXED_TOGGLE_LABELS.indexOf(it.label.trim().toLowerCase()) !== -1;
          var middleCell = isFixedToggle ?
            rsToggleFieldRow("hospitalitat", i, it, "Detalls (opcional)") :
            (rsToggleLabelCell("hospitalitat", i, it, "Camp (p.ex. Dietes)") + rsDetailValueCell("hospitalitat", i, it, "Detalls (opcional)"));
          regularHtml += (
            '<div class="rs-field-row" data-rs-section="hospitalitat" data-rs-index="' + i + '">' +
              rsDragHandle("hospitalitat", i) +
              middleCell +
              rsRemoveBtn("hospitalitat", i) +
            '</div>'
          );
          return;
        }
        var included = it.included !== false;
        var parkingAvailable = it.parkingAvailable !== false;
        var breakfastAvailable = it.breakfastAvailable !== false;
        hotelHtml = (
          '<div class="rs-hotel-subgroup">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              rsToggleFieldButton("hospitalitat", i, it) +
              '<input class="field-input" style="flex:1;min-width:0;" type="text" placeholder="Nom de l\'allotjament" value="' + esc(it.value) + '" data-bind="rsf.hospitalitat.' + i + '.value" data-fkey="rsf.hospitalitat.' + i + '.value"/>' +
            '</div>' +
            (included ? (
              '<div class="rs-hotel-subgroup-row">' +
                '<input class="field-input" type="text" placeholder="Telèfon de l\'allotjament" value="' + esc(it.phone || "") + '" data-bind="rsf.hospitalitat.' + i + '.phone" data-fkey="rsf.hospitalitat.' + i + '.phone"/>' +
                '<input class="field-input" type="text" placeholder="Enllaç Google Maps" value="' + esc(it.location || "") + '" data-bind="rsf.hospitalitat.' + i + '.location" data-fkey="rsf.hospitalitat.' + i + '.location"/>' +
              '</div>' +
              '<div class="rs-hotel-parking-row">' +
                '<button type="button" class="rs-toggle-pill ' + (parkingAvailable ? "yes" : "no") + '" data-action="toggleHotelParking" data-index="' + i + '" title="Clica per canviar">' +
                  '<span>Pàrquing</span>' +
                  rsToggleIconSvg(parkingAvailable) +
                '</button>' +
                '<input class="field-input rs-parking-count" type="text" placeholder="Matrícules" value="' + esc(it.parkingPlates || "") + '" data-bind="rsf.hospitalitat.' + i + '.parkingPlates" data-fkey="rsf.hospitalitat.' + i + '.parkingPlates"/>' +
              '</div>' +
              '<div class="rs-hotel-specs-row">' +
                '<div class="rs-hotel-checkinout-item">' +
                  '<span class="rs-col-label" style="text-align:left;">Check-in</span>' +
                  rsTimePairHtml("rsf.hospitalitat." + i + ".checkIn", it.checkIn) +
                '</div>' +
                '<div class="rs-hotel-checkinout-item">' +
                  '<span class="rs-col-label" style="text-align:left;">Check-out</span>' +
                  rsTimePairHtml("rsf.hospitalitat." + i + ".checkOut", it.checkOut) +
                '</div>' +
              '</div>' +
              '<div class="rs-hotel-parking-row">' +
                '<button type="button" class="rs-toggle-pill ' + (breakfastAvailable ? "yes" : "no") + '" data-action="toggleHotelBreakfast" data-index="' + i + '" title="Clica per canviar">' +
                  '<span>Esmorzar</span>' +
                  rsToggleIconSvg(breakfastAvailable) +
                '</button>' +
                (breakfastAvailable ? rsTimePairHtml("rsf.hospitalitat." + i + ".breakfastTime", it.breakfastTime) : "") +
              '</div>'
            ) : "") +
          '</div>'
        );
      });
      return regularHtml + hotelHtml;
    }

    var llocRows = fieldRows("lloc", rsf.lloc);
    var hospRows = hospitalitatRows(rsf.hospitalitat);
    var tecRows = fieldRows("tecnic", rsf.tecnic);

    return (
      '<div class="modal-overlay" data-action="closeRouteSheetModal">' +
        '<div class="modal wide rs-modal" data-action="stop">' +
          '<div class="modal-head">' +
            '<div class="modal-title">' + esc(c.bandName) + ' - ' + esc(c.city) + ' - ' + esc(c.date.slice(8, 10) + '/' + c.date.slice(5, 7) + '/' + c.date.slice(2, 4)) + '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
              '<button type="button" class="row-rs-btn' + (rsIsComplete(c) ? " rs-complete" : "") + '" data-action="openRouteSheetPreview" data-id="' + c.id + '" title="Visualitza el PDF" aria-label="Visualitza el PDF">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>' +
              '</button>' +
              '<button type="button" class="row-rs-btn" data-action="saveRouteSheet" title="Desar full de ruta" aria-label="Desar full de ruta">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>' +
              '</button>' +
              '<button class="modal-close" data-action="closeRouteSheetModal">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="modal-form">' +

            '<div class="rs-section-title">' + rsSectionIconSvg("Lloc") + '<span>Lloc</span></div>' +
            '<div class="rs-repeater" data-rs-section="lloc">' + llocRows + '</div>' +
            '<button type="button" class="rs-add-btn" data-action="addRsItem" data-section="lloc">+ Afegeix camp</button>' +

            '<div class="rs-section-title">' + rsSectionIconSvg("Contactes") + '<span>Contactes</span></div>' +
            '<div class="rs-repeater" data-rs-section="contacts">' + contactRows + '</div>' +
            '<button type="button" class="rs-add-btn" data-action="addRsItem" data-section="contacts">+ Afegeix contacte</button>' +

            '<div class="rs-section-title rs-phase-header">' +
              '<span style="display:flex;align-items:center;gap:6px;">' + rsSectionIconSvg("Horaris") + '<span>Horaris</span></span>' +
              '<span class="rs-col-label">Inici</span>' +
              '<span class="rs-col-label">Fi</span>' +
              '<span></span>' +
            '</div>' +
            '<div class="rs-repeater" data-rs-section="schedule">' + phaseRows + '</div>' +
            '<button type="button" class="rs-add-btn" data-action="addRsItem" data-section="schedule">+ Afegeix fase</button>' +

            '<div class="rs-section-title">' + rsSectionIconSvg("Hospitalitat") + '<span>Hospitalitat</span></div>' +
            '<div class="rs-repeater" data-rs-section="hospitalitat">' + hospRows + '</div>' +
            '<button type="button" class="rs-add-btn" data-action="addRsItem" data-section="hospitalitat">+ Afegeix camp</button>' +

            '<div class="rs-section-title">' + rsSectionIconSvg("Detalls tècnics") + '<span>Detalls tècnics</span></div>' +
            '<div class="rs-repeater" data-rs-section="tecnic">' + tecRows + '</div>' +
            '<button type="button" class="rs-add-btn" data-action="addRsItem" data-section="tecnic">+ Afegeix camp</button>' +

            '<div class="modal-actions">' +
              '<div class="spacer"></div>' +
              '<button type="button" class="row-rs-btn' + (rsIsComplete(c) ? " rs-complete" : "") + '" data-action="openRouteSheetPreview" data-id="' + c.id + '" title="Visualitza el PDF" aria-label="Visualitza el PDF">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>' +
              '</button>' +
              '<button type="button" class="row-rs-btn" data-action="saveRouteSheet" title="Desar full de ruta" aria-label="Desar full de ruta">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>' +
              '</button>' +
              '<button type="button" class="row-rs-btn" data-action="closeRouteSheetModal" title="Cancel·lar" aria-label="Cancel·lar">✕</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function formatPhoneDisplay(phone) {
    if (!phone) return "";
    var digits = phone.replace(/[^\d]/g, "");
    if (!digits) return phone;
    var hasPlus = phone.trim().indexOf("+") === 0;
    var cc = "", rest = digits;
    if (hasPlus || digits.length > 9) {
      var ccLen = digits.length - 9;
      if (ccLen > 0 && ccLen <= 3) { cc = digits.slice(0, ccLen); rest = digits.slice(ccLen); }
    }
    var groups = rest.match(/.{1,3}/g) || [rest];
    return (cc ? "+" + cc + " " : "") + groups.join(" ");
  }
  function rsFormatDuration(start, end) {
    if (!start || !end) return "";
    var sp = start.split(":").map(Number), ep = end.split(":").map(Number);
    var sMin = sp[0] * 60 + sp[1], eMin = ep[0] * 60 + ep[1];
    var diff = (eMin - sMin + 1440) % 1440;
    if (diff === 0) return "";
    var h = Math.floor(diff / 60), m = diff % 60;
    return h > 0 ? (h + "h " + pad2(m) + "'") : (m + "'");
  }

  function renderRouteSheetPreview() {
    var c = S.concerts.filter(function (x) { return x.id === S.routeSheetPreviewId; })[0];
    if (!c) return "";
    var rs = normalizeRouteSheet(c.routeSheet, c);
    var RS_LABEL_COLOR = "oklch(0.15 0.01 258)";
    var RS_VALUE_COLOR = "oklch(0.42 0.01 258)";

    function rsField(label, value) {
      return value ? ('<div><span style="color:' + RS_LABEL_COLOR + ';font-weight:600;">' + esc(label) + '&nbsp;</span><span style="color:' + RS_VALUE_COLOR + ';">' + esc(value) + '</span></div>') : "";
    }
    function rsTickCrossIcon(yes) {
      return (
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="' + (yes ? "oklch(0.6 0.15 155)" : "oklch(0.6 0.18 25)") + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;">' +
          (yes ? '<polyline points="20 6 9 17 4 12"></polyline>' : '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>') +
        '</svg>'
      );
    }
    function rsInclusionLine(label, included, value) {
      if (!label) return "";
      return (
        '<div><span style="color:' + RS_LABEL_COLOR + ';font-weight:600;">' + esc(label) + '&nbsp;</span>' +
          rsTickCrossIcon(included) +
          (value ? ('&nbsp;<span style="color:' + RS_VALUE_COLOR + ';">' + esc(value) + '</span>') : "") +
        '</div>'
      );
    }
    var RS_LLOC_ICONS = {
      "adreça": '<path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="18" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line>',
      "descàrrega": '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>',
      "parking": '<circle cx="12" cy="12" r="9.5"></circle><text x="12" y="16.3" text-anchor="middle" font-size="12.5" font-weight="700" font-family="Inter,sans-serif" stroke="none" fill="currentColor">P</text>'
    };
    function rsLlocLine(item) {
      var label = item.label, value = item.value;
      var isParking = label && label.trim().toLowerCase() === "parking";
      var plateList = isParking && item.plates ?
        item.plates.split(/[,;\n]+/).map(function (p) { return p.trim(); }).filter(function (p) { return p; }) : [];
      if (!value && !plateList.length) return "";
      var iconPath = RS_LLOC_ICONS[(label || "").trim().toLowerCase()];
      var isLink = value && /^https?:\/\//i.test(value.trim());
      var content;
      if (iconPath && isLink) {
        content = (
          '<a href="' + esc(value) + '" target="_blank" rel="noopener" title="' + esc(label) + ' — obre a Google Maps" ' +
            'style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:oklch(0.68 0.19 290 / 0.14);color:oklch(0.55 0.19 290);flex:none;">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg>' +
          '</a>'
        );
      } else {
        content = '<span style="color:' + RS_VALUE_COLOR + ';">' + esc(value || "") + '</span>';
      }
      var plateStack = plateList.length ? (
        '<div style="display:flex;flex-direction:column;gap:1px;color:' + RS_VALUE_COLOR + ';">' +
          plateList.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join("") +
        '</div>'
      ) : "";
      return (
        '<div style="display:flex;align-items:center;gap:9px;">' +
          '<span style="color:' + RS_LABEL_COLOR + ';font-weight:600;min-width:66px;flex:none;">' + esc(label) + '</span>' +
          content +
          plateStack +
        '</div>'
      );
    }
    function rsSectionTitle(title) {
      return (
        '<div style="display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:' + RS_LABEL_COLOR + ';margin-bottom:9px;">' +
          rsSectionIconSvg(title) +
          '<span>' + esc(title) + '</span>' +
        '</div>'
      );
    }
    function rsBox(title, linesHtml, flexStyle) {
      if (!linesHtml) return "";
      return (
        '<div style="background:oklch(0.97 0.004 258);border:1px solid oklch(0.88 0.005 258);border-radius:10px;padding:14px 16px;' + (flexStyle || "flex:1;min-width:0;") + '">' +
          rsSectionTitle(title) +
          '<div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">' + linesHtml + '</div>' +
        '</div>'
      );
    }
    function rsRow(boxesHtml) {
      var nonEmpty = boxesHtml.filter(function (b) { return b; });
      if (!nonEmpty.length) return "";
      return '<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;">' + nonEmpty.join("") + '</div>';
    }

    function rsContactActions(ct) {
      if (!ct.phone) return "";
      var digits = ct.phone.replace(/[^\d+]/g, "");
      var intl = digits.indexOf("+") === 0 ? digits.slice(1) : "34" + digits;
      return (
        '<a href="tel:+' + intl + '" title="Truca a ' + esc(ct.phone) + '" ' +
          'style="display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:5px;background:oklch(0.68 0.19 290 / 0.14);color:oklch(0.55 0.19 290);flex:none;margin-left:3px;vertical-align:middle;">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>' +
        '</a>' +
        '<a href="https://wa.me/' + intl + '" target="_blank" rel="noopener" title="WhatsApp a ' + esc(ct.phone) + '" ' +
          'style="display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:5px;background:oklch(0.72 0.15 155 / 0.16);color:oklch(0.6 0.15 155);flex:none;margin-left:3px;vertical-align:middle;">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>' +
        '</a>'
      );
    }

    function rsHotelLine(it) {
      var isHotel = it.label && it.label.trim().toLowerCase() === "allotjament";
      var included = it.included !== false;
      if (!isHotel) return rsInclusionLine(it.label, included, it.value);
      if (!included) return rsInclusionLine(it.label, included, it.value);

      var digits = (it.phone || "").replace(/[^\d+]/g, "");
      var intl = digits ? (digits.indexOf("+") === 0 ? digits.slice(1) : "34" + digits) : "";
      var icons = "";
      if (it.phone) {
        icons += (
          '<a href="tel:+' + intl + '" title="Truca a l\'allotjament" ' +
            'style="display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:5px;background:oklch(0.68 0.19 290 / 0.14);color:oklch(0.55 0.19 290);flex:none;margin-left:6px;vertical-align:middle;">' +
            '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>' +
          '</a>'
        );
      }
      if (it.location) {
        icons += (
          '<a href="' + esc(it.location) + '" target="_blank" rel="noopener" title="Ubicació de l\'allotjament" ' +
            'style="display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:5px;background:oklch(0.68 0.19 290 / 0.14);color:oklch(0.55 0.19 290);flex:none;margin-left:3px;vertical-align:middle;">' +
            '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' +
          '</a>'
        );
      }

      function specLine(label, value) {
        return value ? ('<div><span style="color:' + RS_LABEL_COLOR + ';font-weight:600;">' + esc(label) + '&nbsp;</span><span style="color:' + RS_VALUE_COLOR + ';">' + esc(value) + '</span></div>') : "";
      }

      var lines = [];
      if (it.value || icons) {
        lines.push('<div><span style="color:' + RS_LABEL_COLOR + ';font-weight:600;">Allotjament&nbsp;</span>' + rsTickCrossIcon(true) + (it.value ? ('&nbsp;<span style="color:' + RS_VALUE_COLOR + ';">' + esc(it.value) + '</span>') : "") + icons + '</div>');
      }
      lines.push(specLine("Telèfon", formatPhoneDisplay(it.phone)));
      if (it.value) {
        var parkingAvailable = it.parkingAvailable !== false;
        lines.push(
          '<div><span style="color:' + RS_LABEL_COLOR + ';font-weight:600;">Pàrquing&nbsp;</span>' + rsTickCrossIcon(parkingAvailable) +
          (it.parkingPlates ? ('&nbsp;<span style="color:' + RS_VALUE_COLOR + ';">' + esc(it.parkingPlates) + '</span>') : "") +
          '</div>'
        );
      }
      lines.push(specLine("Check-in", it.checkIn));
      lines.push(specLine("Check-out", it.checkOut));
      if (it.value) {
        var breakfastAvailable = it.breakfastAvailable !== false;
        lines.push(
          '<div><span style="color:' + RS_LABEL_COLOR + ';font-weight:600;">Esmorzar&nbsp;</span>' + rsTickCrossIcon(breakfastAvailable) +
          (breakfastAvailable && it.breakfastTime ? ('&nbsp;<span style="color:' + RS_VALUE_COLOR + ';">' + esc(it.breakfastTime) + '</span>') : "") +
          '</div>'
        );
      }
      lines = lines.filter(function (l) { return l; });
      if (!lines.length) return "";
      return '<div style="border:1px solid oklch(0.88 0.005 258);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;">' + lines.join("") + '</div>';
    }

    var llocLines = rs.lloc.map(function (f) { return rsLlocLine(f); }).join("");

    var contacts = rs.contacts.filter(function (ct) { return ct.role || ct.name; });
    var contactsHtml = !contacts.length ? "" : (
      '<div style="display:grid;grid-template-columns:auto 1fr;column-gap:6px;row-gap:8px;">' +
        contacts.map(function (ct) {
          return (
            '<span style="font-weight:600;color:' + RS_LABEL_COLOR + ';white-space:nowrap;">' + esc(ct.role || "Contacte") + '</span>' +
            '<span style="white-space:nowrap;">' +
              '<span style="color:' + RS_VALUE_COLOR + ';">' + esc(ct.name) + '</span>' +
              (ct.company ? '<span style="color:' + RS_VALUE_COLOR + ';"> — ' + esc(ct.company) + '</span>' : "") +
              (ct.phone ? (
                '<div style="white-space:nowrap;margin-top:2px;">' +
                  '<span style="color:oklch(0.55 0.19 290);">' + esc(formatPhoneDisplay(ct.phone)) + '</span>' +
                  rsContactActions(ct) +
                '</div>'
              ) : "") +
            '</span>'
          );
        }).join("") +
      '</div>'
    );

    var llocBox = rsBox("Lloc", llocLines, "flex:4 1 0;min-width:0;");
    var contactsBox = rsBox("Contactes", contactsHtml, "flex:6 1 0;min-width:0;");

    var hospLines = rs.hospitalitat.map(function (f) { return rsHotelLine(f); }).join("");
    var hospBox = rsBox("Hospitalitat", hospLines);

    function rsTecnicLine(it) {
      var label = (it.label || "").trim().toLowerCase();
      if (label === "pantalla led") return rsInclusionLine(it.label, it.included !== false, it.value);
      if (label === "contra rider") {
        if (!it.value) return "";
        var isApproved = /aprovat/i.test(it.value);
        return (
          '<div><span style="color:' + RS_LABEL_COLOR + ';font-weight:600;">' + esc(it.label) + '&nbsp;</span>' +
            '<span style="color:' + RS_VALUE_COLOR + ';">' + esc(it.value) + '</span>' +
            (isApproved ? '&nbsp;' + rsTickCrossIcon(true) : "") +
          '</div>'
        );
      }
      return rsField(it.label, it.value);
    }
    var tecLines = rs.tecnic.map(function (f) { return rsTecnicLine(f); }).join("");
    var tecBox = rsBox("Detalls tècnics", tecLines);

    var phases = rs.schedule.filter(function (ph) { return ph.phase && (ph.start || ph.end); });
    var phasesHtml = phases.map(function (ph) {
      var isConcert = /concert/i.test(ph.phase);
      var dur = rsFormatDuration(ph.start, ph.end);
      var strong = isConcert ? "font-weight:700;" : "";
      var accent = isConcert ? ("color:" + RS_LABEL_COLOR + ";") : ("color:" + RS_VALUE_COLOR + ";");
      var plainColor = isConcert ? "" : ("color:" + RS_VALUE_COLOR + ";");
      return (
        '<tr style="border-bottom:1px solid oklch(0.88 0.005 258);">' +
          '<td style="padding:9px 0;font-size:12.5px;' + strong + accent + '">' + esc(ph.phase) + '</td>' +
          '<td style="padding:9px 0;font-size:12.5px;' + strong + plainColor + '">' + esc(ph.start) + '</td>' +
          '<td style="padding:9px 0;font-size:12.5px;' + strong + plainColor + '">' + esc(ph.end) + '</td>' +
          '<td style="padding:9px 0;font-size:12.5px;color:' + RS_VALUE_COLOR + ';' + strong + '">' + esc(dur) + '</td>' +
        '</tr>'
      );
    }).join("");
    var horarisHtml = phases.length ? (
      '<div style="background:oklch(0.97 0.004 258);border:1px solid oklch(0.88 0.005 258);border-radius:10px;padding:14px 16px;margin-bottom:14px;">' +
        rsSectionTitle("Horaris") +
        '<table style="width:100%;border-collapse:collapse;">' +
          '<thead><tr style="border-bottom:1.5px solid oklch(0.2 0.01 258);">' +
            '<th style="text-align:left;font-size:10.5px;font-weight:700;color:' + RS_LABEL_COLOR + ';text-transform:uppercase;letter-spacing:0.05em;padding:0 0 7px;">Fase</th>' +
            '<th style="text-align:left;font-size:10.5px;font-weight:700;color:' + RS_LABEL_COLOR + ';text-transform:uppercase;letter-spacing:0.05em;padding:0 0 7px;">Inici</th>' +
            '<th style="text-align:left;font-size:10.5px;font-weight:700;color:' + RS_LABEL_COLOR + ';text-transform:uppercase;letter-spacing:0.05em;padding:0 0 7px;">Fi</th>' +
            '<th style="text-align:left;font-size:10.5px;font-weight:700;color:' + RS_LABEL_COLOR + ';text-transform:uppercase;letter-spacing:0.05em;padding:0 0 7px;">Durada</th>' +
          '</tr></thead>' +
          '<tbody>' + phasesHtml + '</tbody>' +
        '</table>' +
      '</div>'
    ) : "";

    return (
      '<div class="modal-overlay" data-action="closeRouteSheetPreview">' +
        '<div class="modal wide rs-doc-modal" data-action="stop">' +
          '<div class="rs-doc-top-toolbar">' +
            '<div class="spacer"></div>' +
            '<button type="button" class="rs-doc-icon-btn" data-action="openRouteSheetModal" data-id="' + c.id + '" title="Edita">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>' +
            '</button>' +
            '<button type="button" class="rs-doc-icon-btn" data-action="printRouteSheet" title="Descarrega en PDF">' +
              '<svg width="15" height="15" viewBox="0 0 24 24">' +
                '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
                '<polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
                '<text x="12" y="17.5" text-anchor="middle" font-size="6.5" font-weight="800" fill="currentColor" stroke="none" font-family="Arial,sans-serif">PDF</text>' +
              '</svg>' +
            '</button>' +
            '<button type="button" class="rs-doc-icon-btn" data-action="closeRouteSheetPreview" title="Tanca">✕</button>' +
          '</div>' +
          '<div class="rs-doc-scroll">' +
            '<div id="rs-doc-print" class="rs-doc" style="font-family:Inter,system-ui,sans-serif;color:oklch(0.2 0.01 258);background:oklch(0.995 0.002 258);padding:0.6in 0.55in;display:flex;flex-direction:column;">' +

              (!rsIsComplete(c) ? (
                '<div style="margin:-0.6in -0.55in 16px -0.55in;background:oklch(0.78 0.15 80 / 0.5);color:oklch(0.28 0.06 80);padding:14px 0.55in;display:flex;align-items:center;justify-content:center;gap:10px;">' +
                  '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>' +
                  '<span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15px;letter-spacing:0.08em;">INACABAT</span>' +
                '</div>'
              ) : "") +

              (function () {
                var cityLen = (c.city || "").length;
                var citySize = cityLen > 20 ? 18 : cityLen > 16 ? 22 : cityLen > 13 ? 26 : cityLen > 10 ? 30 : cityLen > 7 ? 34 : 38;
                return (
                  '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;margin-bottom:18px;border-bottom:2px solid oklch(0.2 0.01 258);gap:16px;">' +
                    '<div style="min-width:0;flex:1;">' +
                      '<div style="display:flex;align-items:baseline;gap:10px;min-width:0;">' +
                        '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:' + citySize + 'px;text-transform:uppercase;white-space:nowrap;flex:none;">' + esc(c.city) + '</div>' +
                        '<div style="font-size:14px;color:oklch(0.45 0.01 258);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">' + esc(c.venue) + '</div>' +
                      '</div>' +
                      '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:19px;color:oklch(0.2 0.01 258);margin-top:6px;">' + esc(c.bandName) + '</div>' +
                      '<div style="font-size:12px;color:oklch(0.4 0.01 258);margin-top:2px;">' + esc(capitalize(formatDateFull(c.date))) + '</div>' +
                    '</div>' +
                    '<div style="text-align:right;flex:none;">' +
                      '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:19px;letter-spacing:0.04em;color:oklch(0.55 0.19 290);">FULL DE RUTA</div>' +
                    '</div>' +
                  '</div>'
                );
              })() +

              rsRow([llocBox, contactsBox]) +

              horarisHtml +

              rsRow([hospBox, tecBox]) +

              '<div style="margin-top:auto;padding-top:12px;border-top:1px solid oklch(0.88 0.005 258);font-size:10px;color:oklch(0.5 0.01 258);text-align:center;">' +
                'La Bona Party · ' + TODAY.split("-")[0] +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderInvoicePreview() {
    var inv = S.invoices.filter(function (x) { return x.id === S.invoicePreviewId; })[0];
    if (!inv) return "";
    var c = S.concerts.filter(function (x) { return x.id === inv.concertId; })[0];
    var subtotal = c ? c.amount : Math.round(inv.amount / 1.21);
    var vat = inv.amount - subtotal;
    return (
      '<div class="modal-overlay" data-action="closeInvoicePreview">' +
        '<div class="modal wide rs-doc-modal" data-action="stop">' +
          '<div class="rs-doc-top-toolbar">' +
            '<div class="spacer"></div>' +
            '<button type="button" class="rs-doc-icon-btn" data-action="printInvoice" title="Descarrega en PDF">' +
              '<svg width="15" height="15" viewBox="0 0 24 24">' +
                '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
                '<polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
                '<text x="12" y="17.5" text-anchor="middle" font-size="6.5" font-weight="800" fill="currentColor" stroke="none" font-family="Arial,sans-serif">PDF</text>' +
              '</svg>' +
            '</button>' +
            '<button type="button" class="rs-doc-icon-btn" data-action="closeInvoicePreview" title="Tanca">✕</button>' +
          '</div>' +
          '<div class="rs-doc-scroll">' +
            '<div id="invoice-doc-print" class="rs-doc" style="font-family:Inter,system-ui,sans-serif;color:oklch(0.2 0.01 258);background:oklch(0.995 0.002 258);padding:0.75in 0.7in;display:flex;flex-direction:column;">' +

              '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:22px;border-bottom:2px solid oklch(0.2 0.01 258);">' +
                '<div style="display:flex;gap:12px;align-items:center;">' +
                  '<div style="width:40px;height:40px;border-radius:10px;background:oklch(0.55 0.19 290);display:flex;align-items:center;justify-content:center;font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:16px;color:oklch(0.99 0.002 258);flex:none;">LB</div>' +
                  '<div>' +
                    '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:17px;letter-spacing:0.01em;">' + esc((S.companyInfo.nom || "La Bona Party").toUpperCase()) + '</div>' +
                    (S.companyInfo.cif ? '<div style="font-size:11px;color:oklch(0.45 0.01 258);margin-top:2px;">CIF: ' + esc(S.companyInfo.cif) + '</div>' : '<div style="font-size:11px;color:oklch(0.45 0.01 258);margin-top:2px;">Gestió d\'actuacions musicals</div>') +
                    (S.companyInfo.address ? '<div style="font-size:11px;color:oklch(0.45 0.01 258);margin-top:2px;">' + esc(S.companyInfo.address) + '</div>' : "") +
                  '</div>' +
                '</div>' +
                '<div style="text-align:right;">' +
                  '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:26px;letter-spacing:0.04em;color:oklch(0.55 0.19 290);">FACTURA</div>' +
                  '<div style="font-size:12.5px;margin-top:6px;font-weight:600;">' + esc(inv.id) + '</div>' +
                  '<div style="font-size:11px;color:oklch(0.45 0.01 258);margin-top:2px;">Emissió: ' + formatDate(inv.issueDate) + ' · Venciment: ' + formatDate(inv.dueDate) + '</div>' +
                '</div>' +
              '</div>' +

              '<div style="display:flex;justify-content:space-between;gap:40px;padding:26px 0;">' +
                '<div style="flex:1;">' +
                  '<div style="font-size:10.5px;font-weight:600;color:oklch(0.5 0.01 258);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Facturar a</div>' +
                  '<div style="font-size:14px;font-weight:600;">' + esc(inv.client) + '</div>' +
                  (c ? '<div style="font-size:12px;color:oklch(0.4 0.01 258);margin-top:3px;line-height:1.5;">' + esc(c.city) + '</div>' : "") +
                '</div>' +
              '</div>' +

              '<table style="width:100%;border-collapse:collapse;margin-top:8px;">' +
                '<thead>' +
                  '<tr style="border-bottom:1.5px solid oklch(0.2 0.01 258);">' +
                    '<th style="text-align:left;font-size:10.5px;font-weight:600;color:oklch(0.5 0.01 258);text-transform:uppercase;letter-spacing:0.05em;padding:0 0 10px;">Concepte</th>' +
                    '<th style="text-align:left;font-size:10.5px;font-weight:600;color:oklch(0.5 0.01 258);text-transform:uppercase;letter-spacing:0.05em;padding:0 0 10px;">Data</th>' +
                    '<th style="text-align:right;font-size:10.5px;font-weight:600;color:oklch(0.5 0.01 258);text-transform:uppercase;letter-spacing:0.05em;padding:0 0 10px;">Import</th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody>' +
                  '<tr>' +
                    '<td style="padding:14px 0;font-size:13px;">' +
                      '<div style="font-weight:600;">Actuació en directe</div>' +
                      (c ? ('<div style="font-size:11.5px;color:oklch(0.45 0.01 258);margin-top:2px;">' + esc(inv.bandName || c.bandName) + ' — ' + esc(c.venue) + ', ' + esc(c.time) + 'h</div>') : "") +
                    '</td>' +
                    '<td style="padding:14px 0;font-size:13px;color:oklch(0.4 0.01 258);vertical-align:top;">' + (c ? formatDate(c.date) : formatDate(inv.issueDate)) + '</td>' +
                    '<td style="padding:14px 0;font-size:13px;text-align:right;vertical-align:top;font-weight:600;">' + formatCurrency(subtotal) + '</td>' +
                  '</tr>' +
                '</tbody>' +
              '</table>' +

              '<div style="display:flex;justify-content:flex-end;margin-top:20px;">' +
                '<div style="width:240px;display:flex;flex-direction:column;gap:8px;">' +
                  '<div style="display:flex;justify-content:space-between;font-size:13px;color:oklch(0.4 0.01 258);"><span>Subtotal</span><span>' + formatCurrency(subtotal) + '</span></div>' +
                  '<div style="display:flex;justify-content:space-between;font-size:13px;color:oklch(0.4 0.01 258);"><span>IVA (21%)</span><span>' + formatCurrency(vat) + '</span></div>' +
                  '<div style="display:flex;justify-content:space-between;font-size:17px;font-weight:700;border-top:1.5px solid oklch(0.2 0.01 258);padding-top:10px;margin-top:2px;"><span>Total</span><span>' + formatCurrency(inv.amount) + '</span></div>' +
                '</div>' +
              '</div>' +

              '<div style="flex:1;"></div>' +

              '<div style="border-top:1px solid oklch(0.88 0.005 258);padding-top:16px;display:flex;justify-content:space-between;gap:30px;">' +
                '<div style="font-size:11px;color:oklch(0.5 0.01 258);line-height:1.6;">' +
                  '<div style="font-weight:600;color:oklch(0.3 0.01 258);margin-bottom:3px;">Dades de pagament</div>' +
                  'Referència: ' + esc(inv.id) +
                  (S.companyInfo.iban ? '<br>Compte: ' + esc(S.companyInfo.iban) : "") +
                '</div>' +
                '<div style="font-size:11px;color:oklch(0.5 0.01 258);text-align:right;line-height:1.6;">' +
                  'Estat: ' + esc(inv.state) + '.<br>Gràcies per confiar en La Bona Party.' +
                '</div>' +
              '</div>' +

            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderBandModal() {
    var b = S.bands.filter(function (x) { return x.id === S.bandDetailId; })[0];
    if (!b || !S.bf) return "";
    var bf = S.bf;
    function xIcon() {
      return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    }
    var tagsHtml = bf.tags.map(function (t, i) {
      return (
        '<div style="display:flex;align-items:center;gap:4px;">' +
          '<input class="field-input" style="width:110px;padding:6px 8px;font-size:12px;" type="text" placeholder="Etiqueta" value="' + esc(t) + '" data-bind="bf.tags.' + i + '" data-fkey="bf.tags.' + i + '"/>' +
          '<button type="button" class="rs-mini-btn danger" data-action="removeBandTag" data-index="' + i + '" title="Elimina">' + xIcon() + '</button>' +
        '</div>'
      );
    }).join("");
    function personRow(listName, i, p) {
      return (
        '<div style="display:flex;gap:6px;align-items:center;">' +
          '<input class="field-input" style="flex:1;min-width:0;" type="text" placeholder="Nom" value="' + esc(p.name) + '" data-bind="bf.' + listName + '.' + i + '.name" data-fkey="bf.' + listName + '.' + i + '.name"/>' +
          '<input class="field-input" style="flex:1;min-width:0;" type="text" placeholder="Instrument/funció" value="' + esc(p.role) + '" data-bind="bf.' + listName + '.' + i + '.role" data-fkey="bf.' + listName + '.' + i + '.role"/>' +
          '<button type="button" class="rs-mini-btn danger" data-action="removeBandPerson" data-list="' + listName + '" data-index="' + i + '" title="Elimina">' + xIcon() + '</button>' +
        '</div>'
      );
    }
    var musicsHtml = bf.members.map(function (p, i) { return personRow("members", i, p); }).join("");
    var crewHtml = bf.crew.map(function (p, i) { return personRow("crew", i, p); }).join("");
    return (
      '<div class="modal-overlay" data-action="closeBandModal">' +
        '<div class="modal wide band-edit-modal" data-action="stop">' +
          '<div class="band-modal-head" style="background-image:linear-gradient(180deg, rgba(10,10,15,0.2), rgba(10,10,15,0.8)), url(&quot;' + bandPhotoDataUri(b) + '&quot;);">' +
            '<div style="width:100%;">' +
              '<input class="field-input" style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;font-weight:700;background:oklch(1 0 0 / 0.12);border-color:transparent;color:#fff;" type="text" value="' + esc(bf.name) + '" data-bind="bf.name" data-fkey="bf.name"/>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;">' +
                tagsHtml +
                '<button type="button" class="rs-add-btn" style="color:#fff;align-self:center;margin-top:0;" data-action="addBandTag">+ Etiqueta</button>' +
              '</div>' +
            '</div>' +
            '<button class="modal-close" data-action="closeBandModal">✕</button>' +
          '</div>' +
          '<div class="modal-form">' +
            '<div class="form-row">' +
              '<div><label class="form-label">Ciutat</label><input class="field-input form-field" type="text" value="' + esc(bf.city) + '" data-bind="bf.city" data-fkey="bf.city"/></div>' +
              '<div><label class="form-label">Catxet (€)</label><input class="field-input form-field" type="text" inputmode="numeric" value="' + esc(bf.rate) + '" data-bind="bf.rate" data-fkey="bf.rate"/></div>' +
            '</div>' +
            '<div class="form-row">' +
              '<div><label class="form-label">Contacte</label><input class="field-input form-field" type="text" value="' + esc(bf.contact) + '" data-bind="bf.contact" data-fkey="bf.contact"/></div>' +
              '<div><label class="form-label">Telèfon</label><input class="field-input form-field" type="text" value="' + esc(bf.phone) + '" data-bind="bf.phone" data-fkey="bf.phone"/></div>' +
            '</div>' +
            '<div>' +
              '<label class="form-label">Músics</label>' +
              '<div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">' + musicsHtml + '</div>' +
              '<button type="button" class="rs-add-btn" data-action="addBandPerson" data-list="members" style="margin-top:8px;">+ Afegeix músic</button>' +
            '</div>' +
            '<div>' +
              '<label class="form-label">Crew</label>' +
              '<div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">' + crewHtml + '</div>' +
              '<button type="button" class="rs-add-btn" data-action="addBandPerson" data-list="crew" style="margin-top:8px;">+ Afegeix crew</button>' +
            '</div>' +
            '<div class="modal-actions">' +
              '<div class="spacer"></div>' +
              '<button class="btn-outline" data-action="closeBandModal">Cancel·lar</button>' +
              '<button class="btn-save" data-action="saveBand">Desar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderInvoiceModal() {
    var billedConcertIds = {}; S.invoices.forEach(function (i) { billedConcertIds[i.concertId] = true; });
    var unbilled = S.concerts.filter(function (c) { return c.status === "confirmat" && !billedConcertIds[c.id]; });
    var current = S.invoiceFormConcertId || (unbilled[0] && unbilled[0].id) || "";
    var concert = S.concerts.filter(function (c) { return c.id === current; })[0];
    var body;
    if (unbilled.length) {
      var opts = unbilled.map(function (c) {
        return '<option value="' + c.id + '" ' + (current === c.id ? "selected" : "") + '>' + esc(c.bandName) + ' — ' + formatDate(c.date) + ' (' + esc(c.venue) + ')</option>';
      }).join("");
      body = (
        '<div class="modal-form">' +
          '<div>' +
            '<label class="form-label">Concert sense facturar</label>' +
            '<select class="field-input form-field" data-bind="invoiceFormConcertId">' + opts + '</select>' +
          '</div>' +
          '<div class="invoice-preview">' +
            '<span style="color:var(--text-faint)">Import (amb IVA)</span>' +
            '<span class="t-strong">' + (concert ? formatCurrency(Math.round(concert.amount * 1.21)) : "—") + '</span>' +
          '</div>' +
          '<div class="modal-actions">' +
            '<div class="spacer"></div>' +
            '<button class="btn-outline" data-action="closeInvoiceModal">Cancel·lar</button>' +
            '<button class="btn-save" data-action="saveInvoice">Generar</button>' +
          '</div>' +
        '</div>'
      );
    } else {
      body = '<div class="cal-empty" style="padding:20px 0;">Tots els concerts confirmats ja tenen factura.</div>';
    }
    return (
      '<div class="modal-overlay" data-action="closeInvoiceModal">' +
        '<div class="modal narrow" data-action="stop">' +
          '<div class="modal-head">' +
            '<div class="modal-title">Generar factura</div>' +
            '<button class="modal-close" data-action="closeInvoiceModal">✕</button>' +
          '</div>' +
          body +
        '</div>' +
      '</div>'
    );
  }

  /* ================= ACTIONS ================= */
  var Actions = {
    noop: function () {},
    stop: function () {},
    setPage: function (el) {
      S.page = el.dataset.page; S.profileMenuOpen = false; S.yearPickerOpen = false; S.bandFilterOpen = false; S.grupsTagFilterOpen = false; S.calBandFilterOpen = false; render();
    },
    toggleProfileMenu: function () { S.profileMenuOpen = !S.profileMenuOpen; S.yearPickerOpen = false; S.bandFilterOpen = false; render(); },
    closeProfileMenu: function () { S.profileMenuOpen = false; render(); },
    logout: function () {
      S.loggedIn = false; S.page = "grups"; S.profileMenuOpen = false;
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
      render();
    },
    login: function () {
      if (!S.username.trim() || !S.password.trim()) { S.loginError = "Introdueix usuari i contrasenya."; render(); return; }
      if (S.username.trim() !== DEMO_USERNAME || S.password !== DEMO_PASSWORD) {
        S.loginError = "Usuari o contrasenya incorrectes."; render(); return;
      }
      S.loggedIn = true; S.loginError = "";
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: S.username })); } catch (e) {}
      render();
    },
    toggleYearPicker: function () { S.yearPickerOpen = !S.yearPickerOpen; S.bandFilterOpen = false; S.profileMenuOpen = false; render(); },
    closeYearPicker: function () { S.yearPickerOpen = false; render(); },
    setResumYear: function (el) { S.resumRange = "year"; S.resumYear = parseInt(el.dataset.year, 10); S.yearPickerOpen = false; render(); },
    setResumAll: function () { S.resumRange = "all"; S.yearPickerOpen = false; render(); },
    toggleBandFilter: function () { S.bandFilterOpen = !S.bandFilterOpen; S.yearPickerOpen = false; S.profileMenuOpen = false; render(); },
    closeBandFilter: function () { S.bandFilterOpen = false; render(); },
    setResumBandAll: function () { S.resumBandFilter = []; render(); },
    toggleResumBand: function (el) {
      var dropdown = app.querySelector(".band-dropdown");
      var scrollTop = dropdown ? dropdown.scrollTop : 0;
      var id = el.dataset.id;
      var idx = S.resumBandFilter.indexOf(id);
      if (idx === -1) S.resumBandFilter = S.resumBandFilter.concat([id]);
      else S.resumBandFilter = S.resumBandFilter.slice(0, idx).concat(S.resumBandFilter.slice(idx + 1));
      render();
      var newDropdown = app.querySelector(".band-dropdown");
      if (newDropdown) newDropdown.scrollTop = scrollTop;
    },
    toggleCalBandFilter: function () { S.calBandFilterOpen = !S.calBandFilterOpen; render(); },
    closeCalBandFilter: function () { S.calBandFilterOpen = false; render(); },
    setCalBandAll: function () { S.calBandFilter = []; render(); },
    toggleCalBand: function (el) {
      var dropdown = app.querySelector(".band-dropdown");
      var scrollTop = dropdown ? dropdown.scrollTop : 0;
      var id = el.dataset.id;
      var idx = S.calBandFilter.indexOf(id);
      if (idx === -1) S.calBandFilter = S.calBandFilter.concat([id]);
      else S.calBandFilter = S.calBandFilter.slice(0, idx).concat(S.calBandFilter.slice(idx + 1));
      render();
      var newDropdown = app.querySelector(".band-dropdown");
      if (newDropdown) newDropdown.scrollTop = scrollTop;
    },
    toggleGrupsTagFilter: function () { S.grupsTagFilterOpen = !S.grupsTagFilterOpen; render(); },
    closeGrupsTagFilter: function () { S.grupsTagFilterOpen = false; render(); },
    setGrupsTagAll: function () { S.grupsTagFilter = []; render(); },
    toggleGrupsTag: function (el) {
      var dropdown = app.querySelector(".band-dropdown");
      var scrollTop = dropdown ? dropdown.scrollTop : 0;
      var tag = el.dataset.tag;
      var idx = S.grupsTagFilter.indexOf(tag);
      if (idx === -1) S.grupsTagFilter = S.grupsTagFilter.concat([tag]);
      else S.grupsTagFilter = S.grupsTagFilter.slice(0, idx).concat(S.grupsTagFilter.slice(idx + 1));
      render();
      var newDropdown = app.querySelector(".band-dropdown");
      if (newDropdown) newDropdown.scrollTop = scrollTop;
    },
    calPrev: function () { S.calMonthIndex -= 1; S.calSelectedDate = null; render(); },
    calNext: function () { S.calMonthIndex += 1; S.calSelectedDate = null; render(); },
    calSelectDay: function (el) { S.calSelectedDate = el.dataset.date; render(); },
    openConcertModal: function (el) {
      var mode = el.dataset.mode;
      if (mode === "new") {
        S.concertModalMode = "new"; S.concertEditId = null;
        S.cf = { bandId: (S.bands[0] && S.bands[0].id) || "", bandName: (S.bands[0] && S.bands[0].name) || "", date: TODAY, time: "21:00", venue: "", city: "", amount: "1500", status: "confirmat", attendance: {}, substitutes: {}, noSubstitute: {} };
      } else {
        var id = el.dataset.id;
        var c = S.concerts.filter(function (x) { return x.id === id; })[0];
        if (!c) return;
        S.concertModalMode = "edit"; S.concertEditId = id;
        S.cf = { bandId: c.bandId, bandName: c.bandName, date: c.date, time: c.time, venue: c.venue, city: c.city, amount: String(c.amount), status: c.status, attendance: Object.assign({}, c.attendance || {}), substitutes: Object.assign({}, c.substitutes || {}), noSubstitute: Object.assign({}, c.noSubstitute || {}) };
      }
      S.cfDatePickerOpen = false;
      S.concertModalOpen = true; render();
    },
    closeConcertModal: function () { S.concertModalOpen = false; render(); },
    toggleCfDatePicker: function () {
      S.cfDatePickerOpen = !S.cfDatePickerOpen;
      if (S.cfDatePickerOpen) { S.cfPickerYM = (S.cf.date || TODAY).slice(0, 7); S.cfBandDropdownOpen = false; }
      render();
    },
    closeCfDatePicker: function () { S.cfDatePickerOpen = false; render(); },
    cfPickerPrevMonth: function () {
      var p = S.cfPickerYM.split("-").map(Number);
      var d = new Date(p[0], p[1] - 2, 1);
      S.cfPickerYM = d.getFullYear() + "-" + pad2(d.getMonth() + 1);
      render();
    },
    cfPickerNextMonth: function () {
      var p = S.cfPickerYM.split("-").map(Number);
      var d = new Date(p[0], p[1], 1);
      S.cfPickerYM = d.getFullYear() + "-" + pad2(d.getMonth() + 1);
      render();
    },
    cfPickerSelectDate: function (el) {
      S.cf.date = el.dataset.date;
      S.cfDatePickerOpen = false;
      render();
    },
    toggleDbDatePicker: function (el) {
      var id = el.dataset.id;
      if (S.dbDatePickerFor === id) { S.dbDatePickerFor = null; render(); return; }
      var c = S.concerts.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      S.dbDatePickerFor = id;
      S.dbPickerYM = (c.date || TODAY).slice(0, 7);
      render();
    },
    closeDbDatePicker: function () { S.dbDatePickerFor = null; render(); },
    dbPickerPrevMonth: function () {
      var p = S.dbPickerYM.split("-").map(Number);
      var d = new Date(p[0], p[1] - 2, 1);
      S.dbPickerYM = d.getFullYear() + "-" + pad2(d.getMonth() + 1);
      render();
    },
    dbPickerNextMonth: function () {
      var p = S.dbPickerYM.split("-").map(Number);
      var d = new Date(p[0], p[1], 1);
      S.dbPickerYM = d.getFullYear() + "-" + pad2(d.getMonth() + 1);
      render();
    },
    dbPickerSelectDate: function (el) {
      var id = el.dataset.id;
      var c = S.concerts.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      c.date = el.dataset.date;
      S.dbDatePickerFor = null;
      persist(); render();
    },
    closeCfBandDropdown: function () { S.cfBandDropdownOpen = false; render(); },
    selectCfBand: function (el) {
      S.cf.bandName = el.dataset.name;
      S.cf.bandId = el.dataset.id;
      S.cfBandDropdownOpen = false;
      S.cf.attendance = {};
      S.cf.substitutes = {};
      S.cf.noSubstitute = {};
      render();
    },
    setAttendance: function (el) {
      var name = el.dataset.name;
      var value = el.dataset.value;
      S.cf.attendance = S.cf.attendance || {};
      S.cf.attendance[name] = value;
      if (value === "no") {
        S.cf.substitutes = S.cf.substitutes || {};
        if (S.cf.substitutes[name] === undefined) S.cf.substitutes[name] = "";
      }
      render();
    },
    resetAttendance: function (el) {
      var name = el.dataset.name;
      if (S.cf.attendance) delete S.cf.attendance[name];
      if (S.cf.substitutes) delete S.cf.substitutes[name];
      if (S.cf.noSubstitute) delete S.cf.noSubstitute[name];
      render();
    },
    markNoSubstitute: function (el) {
      var name = el.dataset.name;
      S.cf.noSubstitute = S.cf.noSubstitute || {};
      S.cf.noSubstitute[name] = true;
      if (S.cf.substitutes) S.cf.substitutes[name] = "";
      render();
    },
    cycleConcertStatus: function () {
      var order = ["confirmat", "pendent", "cancel·lat"];
      var idx = order.indexOf(S.cf.status);
      S.cf.status = order[(idx + 1) % order.length];
      render();
    },
    cycleDbStatus: function (el) {
      var order = ["confirmat", "pendent", "cancel·lat"];
      var c = S.concerts.filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!c) return;
      var idx = order.indexOf(c.status);
      c.status = order[(idx + 1) % order.length];
      persist(); render();
    },
    saveConcert: function () {
      var typedName = (S.cf.bandName || "").trim();
      var typedLower = typedName.toLowerCase();
      var band = S.bands.filter(function (b) { return b.name.toLowerCase() === typedLower; })[0];
      if (!band && S.concertEditId) {
        band = S.bands.filter(function (b) { return b.id === S.cf.bandId; })[0];
        if (band && typedName && band.name !== typedName) {
          band.name = typedName;
          S.concerts.forEach(function (c) { if (c.bandId === band.id) c.bandName = typedName; });
        }
      }
      if (!band && typedName) {
        band = { id: "b" + Date.now(), name: typedName, tags: [], city: S.cf.city.trim() || "—", rate: parseInt(S.cf.amount, 10) || 0, contact: "", phone: "", members: [], crew: [] };
        S.bands = S.bands.concat([band]);
      }
      band = band || S.bands.filter(function (b) { return b.id === S.cf.bandId; })[0] || S.bands[0];
      if (!band) return;
      var existing = S.concertEditId ? S.concerts.filter(function (c) { return c.id === S.concertEditId; })[0] : null;
      var rec = {
        id: S.concertEditId || ("c" + Date.now()),
        date: S.cf.date || TODAY, time: S.cf.time || "21:00",
        venue: S.cf.venue.trim() || "Sala per determinar",
        city: S.cf.city.trim() || band.city,
        bandId: band.id, bandName: band.name, tags: (band.tags || []).slice(),
        status: S.cf.status, amount: parseInt(S.cf.amount, 10) || 0,
        attendance: Object.assign({}, S.cf.attendance || {}),
        substitutes: Object.assign({}, S.cf.substitutes || {}),
        noSubstitute: Object.assign({}, S.cf.noSubstitute || {}),
        routeSheet: existing ? existing.routeSheet : undefined
      };
      if (S.concertEditId) { S.concerts = S.concerts.map(function (c) { return c.id === rec.id ? rec : c; }); }
      else { S.concerts = [rec].concat(S.concerts); }
      S.concertModalOpen = false; persist(); render(); toast("Concert desat.");
    },
    deleteConcert: function (el) {
      var id = el.dataset.id;
      if (!confirm("Segur que vols eliminar aquest concert?")) return;
      S.concerts = S.concerts.filter(function (c) { return c.id !== id; });
      S.invoices = S.invoices.filter(function (i) { return i.concertId !== id; });
      S.concertModalOpen = false; persist(); render(); toast("Concert eliminat.");
    },
    openRouteSheetModal: function (el) {
      var id = el.dataset.id;
      var c = S.concerts.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      S.routeSheetConcertId = id;
      S.rsf = normalizeRouteSheet(c.routeSheet, c);
      S.concertModalOpen = false;
      S.routeSheetPreviewOpen = false;
      S.routeSheetModalOpen = true;
      render();
    },
    closeRouteSheetModal: function () { S.routeSheetModalOpen = false; render(); },
    saveRouteSheet: function () {
      var id = S.routeSheetConcertId;
      var rsf = clone(S.rsf);
      S.concerts = S.concerts.map(function (c) {
        if (c.id !== id) return c;
        var updated = clone(c);
        updated.routeSheet = rsf;
        return updated;
      });
      persist(); render(); toast("Full de ruta desat.");
    },
    addRsItem: function (el) {
      var section = el.dataset.section;
      S.rsf[section].push(rsBlankItem(section));
      render();
    },
    removeRsItem: function (el) {
      var section = el.dataset.section, idx = parseInt(el.dataset.index, 10);
      S.rsf[section].splice(idx, 1);
      render();
    },
    toggleHotelParking: function (el) {
      var idx = parseInt(el.dataset.index, 10);
      var it = S.rsf.hospitalitat[idx];
      it.parkingAvailable = it.parkingAvailable === false;
      render();
    },
    toggleHotelBreakfast: function (el) {
      var idx = parseInt(el.dataset.index, 10);
      var it = S.rsf.hospitalitat[idx];
      it.breakfastAvailable = it.breakfastAvailable === false;
      render();
    },
    toggleIncluded: function (el) {
      var section = el.dataset.section, idx = parseInt(el.dataset.index, 10);
      var it = S.rsf[section][idx];
      it.included = it.included === false;
      render();
    },
    openRouteSheetPreview: function (el) {
      var id = el.dataset.id;
      var c = S.concerts.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      S.routeSheetPreviewId = id; S.routeSheetPreviewOpen = true; render();
    },
    printRouteSheet: function () { window.print(); },
    closeRouteSheetPreview: function () { S.routeSheetPreviewOpen = false; render(); },
    openInvoicePreview: function (el) {
      var id = el.dataset.id;
      var inv = S.invoices.filter(function (x) { return x.id === id; })[0];
      if (!inv) return;
      S.invoicePreviewId = id; S.invoicePreviewOpen = true; render();
    },
    printInvoice: function () { window.print(); },
    closeInvoicePreview: function () { S.invoicePreviewOpen = false; render(); },
    openBandModal: function (el) {
      var id = el.dataset.id;
      var b = S.bands.filter(function (x) { return x.id === id; })[0];
      if (!b) return;
      S.bandDetailId = id;
      S.bf = {
        name: b.name, tags: (b.tags || []).slice(), city: b.city, rate: String(b.rate), contact: b.contact, phone: b.phone,
        members: (b.members || []).map(function (p) { return { name: p.name, role: p.role }; }),
        crew: (b.crew || []).map(function (p) { return { name: p.name, role: p.role }; })
      };
      S.bandModalOpen = true; render();
    },
    closeBandModal: function () { S.bandModalOpen = false; render(); },
    addBandTag: function () { S.bf.tags.push(""); render(); },
    removeBandTag: function (el) {
      var idx = parseInt(el.dataset.index, 10);
      S.bf.tags.splice(idx, 1);
      render();
    },
    addBandPerson: function (el) {
      var list = el.dataset.list;
      S.bf[list].push({ name: "", role: "" });
      render();
    },
    removeBandPerson: function (el) {
      var list = el.dataset.list;
      var idx = parseInt(el.dataset.index, 10);
      S.bf[list].splice(idx, 1);
      render();
    },
    saveBand: function () {
      var id = S.bandDetailId;
      var bf = S.bf;
      var newName = (bf.name || "").trim();
      S.bands = S.bands.map(function (b) {
        if (b.id !== id) return b;
        var updated = clone(b);
        updated.name = newName || b.name;
        updated.tags = bf.tags.filter(function (t) { return t && t.trim(); });
        updated.city = (bf.city || "").trim();
        updated.rate = parseInt(bf.rate, 10) || 0;
        updated.contact = (bf.contact || "").trim();
        updated.phone = (bf.phone || "").trim();
        updated.members = bf.members.filter(function (p) { return p.name && p.name.trim(); });
        updated.crew = bf.crew.filter(function (p) { return p.name && p.name.trim(); });
        return updated;
      });
      var savedBand = S.bands.filter(function (b) { return b.id === id; })[0];
      S.concerts.forEach(function (c) {
        if (c.bandId !== id) return;
        c.bandName = newName || c.bandName;
        c.tags = savedBand.tags.slice();
      });
      S.bandModalOpen = false; persist(); render(); toast("Grup desat.");
    },
    openInvoiceModal: function (el) { S.invoiceFormConcertId = (el && el.dataset.id) || ""; S.invoiceModalOpen = true; render(); },
    closeInvoiceModal: function () { S.invoiceModalOpen = false; render(); },
    saveInvoice: function () {
      var billedConcertIds = {}; S.invoices.forEach(function (i) { billedConcertIds[i.concertId] = true; });
      var unbilled = S.concerts.filter(function (c) { return c.status === "confirmat" && !billedConcertIds[c.id]; });
      var concertId = S.invoiceFormConcertId || (unbilled[0] && unbilled[0].id);
      var c = S.concerts.filter(function (x) { return x.id === concertId; })[0];
      if (!c) return;
      var year = TODAY.slice(0, 4);
      var num = S.invoices.filter(function (i) { return i.issueDate.slice(0, 4) === year; }).length + 1;
      var rec = {
        id: "F-" + year + "-" + String(num).padStart(3, "0"), concertId: c.id, client: c.venue, bandName: c.bandName,
        issueDate: TODAY, dueDate: addDays(TODAY, 30), amount: Math.round(c.amount * 1.21), state: "pendent"
      };
      S.invoices = [rec].concat(S.invoices);
      S.invoiceModalOpen = false; persist(); render(); toast("Factura generada.");
    },
    toggleSort: function (el) {
      var key = el.dataset.key;
      if (S.dbSortKey === key) { S.dbSortDir = S.dbSortDir === "asc" ? "desc" : "asc"; }
      else { S.dbSortKey = key; S.dbSortDir = "asc"; }
      render();
    },
    resetData: function () {
      if (!confirm("Restaurar totes les dades d'exemple? Es perdran els canvis fets.")) return;
      S.concerts = clone(window.APP_DATA.CONCERTS);
      S.invoices = clone(window.APP_DATA.INVOICES);
      var cityByClient = {};
      S.concerts.forEach(function (c) { if (c.venue && !cityByClient[c.venue]) cityByClient[c.venue] = c.city; });
      var clientKeys = {};
      S.concerts.forEach(function (c) { if (c.venue) clientKeys[c.venue] = true; });
      S.invoices.forEach(function (i) { if (i.client) clientKeys[i.client] = true; });
      S.clientDetails = {};
      Object.keys(clientKeys).forEach(function (name) {
        S.clientDetails[name] = fictitiousClientInfo(name, cityByClient[name] || "");
      });
      persist(); render(); toast("Dades restaurades.");
    },
    setDbView: function (el) { S.dbView = el.dataset.view; S.dbSearch = ""; render(); }
  };

  /* ================= EVENT WIRING ================= */
  var app = document.getElementById("app");

  var rsTimeAdvancing = false;
  function rsTimeBoxInput(e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains("rs-time-box")) return;
    var digits = el.value.replace(/\D/g, "").slice(0, 2);
    if (digits !== el.value) el.value = digits;
    var pair = el.closest(".rs-time-pair");
    if (!pair) return;
    var hEl = pair.querySelector('[data-rs-time-part="h"]');
    var mEl = pair.querySelector('[data-rs-time-part="m"]');
    var path = el.dataset.rsTimePath;
    if (el.dataset.rsTimePart === "h" && digits.length === 2) {
      setPath(S, path, hEl.value + ":" + mEl.value);
      mEl.focus();
      mEl.setSelectionRange(0, mEl.value.length);
    } else if (el.dataset.rsTimePart === "m" && digits.length === 2 && path.slice(-6) === ".start") {
      var hh = hEl.value.length === 1 ? "0" + hEl.value : (hEl.value || "00");
      var mm = mEl.value.length === 1 ? "0" + mEl.value : (mEl.value || "00");
      rsTimeAdvancing = true;
      setPath(S, path, hh + ":" + mm);
      render();
      rsTimeAdvancing = false;
      var endPath = path.slice(0, -6) + ".end";
      var endHourEl = app.querySelector('[data-rs-time-path="' + endPath + '"][data-rs-time-part="h"]');
      if (endHourEl) {
        endHourEl.focus();
        endHourEl.setSelectionRange(0, endHourEl.value.length);
      }
    } else {
      setPath(S, path, hEl.value + ":" + mEl.value);
    }
  }
  function rsTimeBoxFocusOut(e) {
    if (rsTimeAdvancing) return;
    var el = e.target;
    if (!el.classList || !el.classList.contains("rs-time-box")) return;
    var pair = el.closest(".rs-time-pair");
    if (!pair) return;
    if (e.relatedTarget && pair.contains(e.relatedTarget)) return;
    var hEl = pair.querySelector('[data-rs-time-part="h"]');
    var mEl = pair.querySelector('[data-rs-time-part="m"]');
    var path = el.dataset.rsTimePath;
    if (hEl.value === "" && mEl.value === "") { setPath(S, path, ""); render(); return; }
    var hh = hEl.value.length === 1 ? "0" + hEl.value : (hEl.value || "00");
    var mm = mEl.value.length === 1 ? "0" + mEl.value : (mEl.value || "00");
    setPath(S, path, hh + ":" + mm);
    render();
  }
  function rsTimeBoxKeydown(e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains("rs-time-box")) return;
    if (e.key === "Backspace" && el.value === "" && el.dataset.rsTimePart === "m") {
      var pair = el.closest(".rs-time-pair");
      var hEl = pair && pair.querySelector('[data-rs-time-part="h"]');
      if (hEl) { hEl.focus(); hEl.setSelectionRange(hEl.value.length, hEl.value.length); }
    }
  }

  function bindHandler(e) {
    if (e.isComposing) return;
    var el = e.target;
    var bind = el.dataset.bind;
    if (!bind) return;
    var isSegmented = el.type === "time" || el.type === "date" || el.type === "month" || el.type === "week";
    if (isSegmented && e.type === "input") {
      setPath(S, bind, el.value);
      return;
    }
    var fkey = el.dataset.fkey || bind;
    var selStart, selEnd, canSelect = false;
    try {
      if (typeof el.selectionStart === "number") { selStart = el.selectionStart; selEnd = el.selectionEnd; canSelect = true; }
    } catch (err) {}
    var value = el.type === "number" ? (el.value === "" ? 0 : parseFloat(el.value)) : el.value;
    setPath(S, bind, value);
    if (bind === "username" || bind === "password") S.loginError = "";
    if (bind.indexOf("concerts.") === 0 || bind.indexOf("bands.") === 0 || bind.indexOf("clientDetails.") === 0 || bind.indexOf("companyInfo.") === 0) persist();
    render();
    var newEl = app.querySelector('[data-fkey="' + fkey + '"]') || app.querySelector('[data-bind="' + bind + '"]');
    if (newEl) {
      newEl.focus();
      if (canSelect && newEl.setSelectionRange) {
        try { newEl.setSelectionRange(selStart, selEnd); } catch (err) {}
      }
    }
  }

  function onClick(e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.dataset.action;
    if (action === "noop" || action === "stop") { e.preventDefault(); return; }
    var fn = Actions[action];
    if (fn) { e.preventDefault(); fn(el, e); }
  }

  function onSubmit(e) {
    var form = e.target.closest("#login-form");
    if (form) { e.preventDefault(); Actions.login(); }
  }

  var rsDragState = null;
  function rsRowEl(el) { return el.closest(".rs-field-row, .rs-contact-row, .rs-phase-row"); }
  function commitRsOrder(section) {
    var repeater = app.querySelector('.rs-repeater[data-rs-section="' + section + '"]');
    if (!repeater) return;
    var rows = repeater.children;
    var arr = S.rsf[section];
    var newArr = [];
    for (var i = 0; i < rows.length; i++) newArr.push(arr[parseInt(rows[i].dataset.rsIndex, 10)]);
    S.rsf[section] = newArr;
    render();
  }
  function onDragStart(e) {
    var handle = e.target.closest(".rs-drag-handle");
    if (!handle) return;
    var row = rsRowEl(handle);
    if (!row) return;
    rsDragState = { section: handle.dataset.rsSection, sourceEl: row };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", ""); } catch (err) {}
    }
    row.classList.add("rs-dragging");
  }
  function onDragOver(e) {
    if (!rsDragState) return;
    var row = rsRowEl(e.target);
    if (!row || row.dataset.rsSection !== rsDragState.section || row === rsDragState.sourceEl) {
      if (row) e.preventDefault();
      return;
    }
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    var rect = row.getBoundingClientRect();
    var before = (e.clientY - rect.top) < rect.height / 2;
    var parent = row.parentNode;
    if (before) parent.insertBefore(rsDragState.sourceEl, row);
    else parent.insertBefore(rsDragState.sourceEl, row.nextSibling);
  }
  function onDrop(e) {
    if (!rsDragState) return;
    e.preventDefault();
    var section = rsDragState.section;
    rsDragState = null;
    commitRsOrder(section);
  }
  function onDragEnd() {
    if (rsDragState) { commitRsOrder(rsDragState.section); rsDragState = null; }
  }

  app.addEventListener("click", onClick);
  app.addEventListener("input", bindHandler);
  app.addEventListener("change", bindHandler);
  app.addEventListener("compositionend", bindHandler);
  app.addEventListener("input", rsTimeBoxInput);
  app.addEventListener("focusout", rsTimeBoxFocusOut);
  app.addEventListener("keydown", rsTimeBoxKeydown);
  function openCfBandDropdown(selStart, selEnd) {
    S.cfBandDropdownOpen = true;
    S.cfDatePickerOpen = false;
    render();
    var el = app.querySelector('[data-fkey="cf.bandName"]');
    if (el) {
      el.focus();
      if (typeof selStart === "number" && el.setSelectionRange) { try { el.setSelectionRange(selStart, selEnd); } catch (err) {} }
    }
  }
  var cfBandFieldMouseDown = false;
  app.addEventListener("mousedown", function (e) {
    cfBandFieldMouseDown = e.target.dataset && e.target.dataset.fkey === "cf.bandName";
  });
  app.addEventListener("mouseup", function (e) {
    if (e.target.dataset && e.target.dataset.fkey === "cf.bandName" && !S.cfBandDropdownOpen) {
      openCfBandDropdown(e.target.selectionStart, e.target.selectionEnd);
    }
    cfBandFieldMouseDown = false;
  });
  app.addEventListener("focusin", function (e) {
    if (e.target.dataset.fkey === "cf.bandName" && !S.cfBandDropdownOpen && !cfBandFieldMouseDown) {
      openCfBandDropdown();
    }
  });
  app.addEventListener("submit", onSubmit);
  app.addEventListener("dragstart", onDragStart);
  app.addEventListener("dragover", onDragOver);
  app.addEventListener("drop", onDrop);
  app.addEventListener("dragend", onDragEnd);

  var calHoverActiveDate = null;
  var calHoverTimer = null;
  function clearCalHoverHighlight() {
    if (calHoverTimer) { clearTimeout(calHoverTimer); calHoverTimer = null; }
    var dayEl = document.querySelector(".cal-day.cal-hover-highlight");
    if (dayEl) dayEl.classList.remove("cal-hover-highlight");
    var cardEl = document.querySelector(".upcoming-day-card.cal-hover-highlight");
    if (cardEl) cardEl.classList.remove("cal-hover-highlight");
    calHoverActiveDate = null;
  }
  app.addEventListener("mouseover", function (e) {
    var dayEl = e.target.closest && e.target.closest(".cal-day:not(.empty)");
    if (!dayEl) return;
    var date = dayEl.dataset.date;
    if (date === calHoverActiveDate) return;
    clearCalHoverHighlight();
    calHoverActiveDate = date;
    dayEl.classList.add("cal-hover-highlight");
    var card = app.querySelector('.upcoming-day-card[data-date="' + date + '"]');
    if (!card) return;
    card.classList.add("cal-hover-highlight");
    calHoverTimer = setTimeout(function () {
      calHoverTimer = null;
      var panel = card.closest(".cal-side-panel");
      if (panel) {
        var cardRect = card.getBoundingClientRect();
        var panelRect = panel.getBoundingClientRect();
        if (cardRect.top < panelRect.top || cardRect.bottom > panelRect.bottom) {
          card.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    }, 500);
  });
  app.addEventListener("mouseout", function (e) {
    var dayEl = e.target.closest && e.target.closest(".cal-day:not(.empty)");
    if (!dayEl) return;
    var toEl = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".cal-day:not(.empty)");
    if (toEl === dayEl) return;
    clearCalHoverHighlight();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (S.cfDatePickerOpen) { S.cfDatePickerOpen = false; render(); }
    else if (S.dbDatePickerFor) { S.dbDatePickerFor = null; render(); }
    else if (S.cfBandDropdownOpen) { S.cfBandDropdownOpen = false; render(); }
    else if (S.concertModalOpen) { S.concertModalOpen = false; render(); }
    else if (S.routeSheetModalOpen) { S.routeSheetModalOpen = false; render(); }
    else if (S.routeSheetPreviewOpen) { S.routeSheetPreviewOpen = false; render(); }
    else if (S.bandModalOpen) { S.bandModalOpen = false; render(); }
    else if (S.invoiceModalOpen) { S.invoiceModalOpen = false; render(); }
    else if (S.profileMenuOpen) { S.profileMenuOpen = false; render(); }
    else if (S.yearPickerOpen) { S.yearPickerOpen = false; render(); }
    else if (S.bandFilterOpen) { S.bandFilterOpen = false; render(); }
    else if (S.grupsTagFilterOpen) { S.grupsTagFilterOpen = false; render(); }
    else if (S.calBandFilterOpen) { S.calBandFilterOpen = false; render(); }
  });

  /* ================= RENDER LOOP ================= */
  function render() {
    var modalEl = app.querySelector(".modal");
    var savedScroll = modalEl ? modalEl.scrollTop : 0;
    app.innerHTML = S.loggedIn ? renderAppShell() : renderLogin();
    var newModalEl = app.querySelector(".modal");
    if (newModalEl) newModalEl.scrollTop = savedScroll;
  }

  render();
})();
