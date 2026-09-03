import type { Concert } from "./types";

export const RS_SECTION_ICONS: Record<string, string> = {
  "Lloc": '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
  "Contactes": '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
  "Horaris": '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
  "Hospitalitat": '<path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line>',
  "Detalls tècnics": '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
};

export const RS_LLOC_ICONS: Record<string, string> = {
  "adreça": '<path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="18" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line>',
  "descàrrega": '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>',
  "parking": '<circle cx="12" cy="12" r="9.5"></circle><text x="12" y="16.3" text-anchor="middle" font-size="12.5" font-weight="700" font-family="Inter,sans-serif" stroke="none" fill="currentColor">P</text>',
};

export type LlocItem = { label: string; value: string; plates?: string };
export type ContactItem = { role: string; name: string; phone: string; company: string };
export type ScheduleItem = { phase: string; start: string; end: string };
export type HospitalitatItem = {
  label: string; value: string; included?: boolean;
  phone?: string; location?: string; parkingAvailable?: boolean; parkingPlates?: string;
  checkIn?: string; checkOut?: string; breakfastAvailable?: boolean; breakfastTime?: string;
};
// "status" només s'usa per al camp especial "Contra rider": l'estat
// d'aprovació, en un cicle de 3 (mai desat com a opció predeterminada, és
// propi de cada concert — vegeu stripSectionForDefault).
export type TecnicItem = { label: string; value: string; included?: boolean; status?: "aprovat" | "no-rebut" | "esperant-canvis" };

export type RouteSheet = {
  lloc: LlocItem[];
  contacts: ContactItem[];
  schedule: ScheduleItem[];
  hospitalitat: HospitalitatItem[];
  tecnic: TecnicItem[];
};

// Plantilla de "només opcions" que un grup pot desar per secció (etiquetes,
// fases, càrrecs i interruptors — mai valors, telèfons, enllaços o dates,
// que són propis de cada concert). Es fa servir per inicialitzar el full de
// ruta de concerts nous d'aquell grup en comptes de la plantilla genèrica.
export type RouteSheetDefaults = Partial<RouteSheet>;

export function defaultRouteSheet(c: { venue?: string; time?: string }, bandDefault?: RouteSheetDefaults | null): RouteSheet {
  const base: RouteSheet = {
    // El recinte i la població ja es mostren sempre a dalt de tot, en
    // directe des de la pestanya Informació (mai com a camp lliure que es
    // pugui desincronitzar) — aquí només queden els detalls que sí que són
    // propis del full de ruta.
    lloc: [
      { label: "Adreça", value: "" },
      { label: "Descàrrega", value: "" },
      { label: "Parking", value: "", plates: "" },
      { label: "Número de vehicles", value: "", plates: "" },
    ],
    contacts: [{ role: "", name: "", phone: "", company: "" }],
    schedule: [
      { phase: "Arribada", start: "", end: "" },
      { phase: "Muntatge", start: "", end: "" },
      { phase: "Proves de so", start: "", end: "" },
      { phase: "Concert", start: c.time || "", end: "" },
    ],
    // "included" es queda sense definir (ni sí ni no) fins que es cliqui
    // explícitament un dels dos botons (tick/creu) — no ha d'aparèixer cap
    // opció ja activada o desactivada per defecte.
    hospitalitat: [
      { label: "Dietes", value: "" },
      { label: "Catering", value: "" },
      { label: "Camerino", value: "" },
      { label: "Allotjament", value: "", phone: "", location: "", parkingPlates: "", checkIn: "", checkOut: "", breakfastTime: "" },
    ],
    tecnic: [
      { label: "Mesures escenari", value: "" },
      { label: "Tarimes", value: "" },
      { label: "Contra rider", value: "" },
      { label: "Backline", value: "" },
      { label: "Pantalla LED", value: "" },
    ],
  };
  if (bandDefault) {
    if (bandDefault.lloc && bandDefault.lloc.length) base.lloc = JSON.parse(JSON.stringify(bandDefault.lloc));
    if (bandDefault.contacts && bandDefault.contacts.length) base.contacts = JSON.parse(JSON.stringify(bandDefault.contacts));
    if (bandDefault.schedule && bandDefault.schedule.length) {
      base.schedule = (JSON.parse(JSON.stringify(bandDefault.schedule)) as ScheduleItem[]).map((ph) =>
        ph.phase && ph.phase.trim().toLowerCase() === "concert" ? { ...ph, start: c.time || ph.start } : ph
      );
    }
    if (bandDefault.hospitalitat && bandDefault.hospitalitat.length) base.hospitalitat = JSON.parse(JSON.stringify(bandDefault.hospitalitat));
    if (bandDefault.tecnic && bandDefault.tecnic.length) base.tecnic = JSON.parse(JSON.stringify(bandDefault.tecnic));
  }
  return base;
}

// Retalla una secció a només les "opcions" que en defineixen l'estructura
// (etiqueta/fase/càrrec i interruptors sí/no), descartant qualsevol detall o
// enllaç propi d'aquell concert en concret (valors, telèfons, adreces,
// matrícules, hores, noms de contacte...).
export function stripSectionForDefault<K extends keyof RouteSheet>(section: K, items: RouteSheet[K]): RouteSheet[K] {
  if (section === "lloc") {
    return (items as LlocItem[]).map((it) => ({ label: it.label, value: "" })) as RouteSheet[K];
  }
  if (section === "contacts") {
    return (items as ContactItem[]).map((it) => ({ role: it.role, name: "", phone: "", company: "" })) as RouteSheet[K];
  }
  if (section === "schedule") {
    return (items as ScheduleItem[]).map((it) => ({ phase: it.phase, start: "", end: "" })) as RouteSheet[K];
  }
  if (section === "hospitalitat") {
    return (items as HospitalitatItem[]).map((it) => ({
      label: it.label, value: "", included: it.included,
      parkingAvailable: it.parkingAvailable, breakfastAvailable: it.breakfastAvailable,
    })) as RouteSheet[K];
  }
  return (items as TecnicItem[]).map((it) => ({ label: it.label, value: "", included: it.included })) as RouteSheet[K];
}

export function rsBlankItem(section: keyof RouteSheet) {
  if (section === "contacts") return { role: "", name: "", phone: "", company: "" };
  if (section === "schedule") return { phase: "", start: "", end: "" };
  if (section === "hospitalitat") return { label: "", value: "", phone: "", location: "", parkingPlates: "", checkIn: "", checkOut: "", breakfastTime: "" };
  return { label: "", value: "" };
}

export function normalizeRouteSheet(rs: RouteSheet | null | undefined, c: { venue?: string; time?: string }, bandDefault?: RouteSheetDefaults | null): RouteSheet {
  if (!rs) return defaultRouteSheet(c, bandDefault);
  const def = defaultRouteSheet(c, bandDefault);
  const out: RouteSheet = JSON.parse(JSON.stringify(rs));
  out.lloc = out.lloc && out.lloc.length ? out.lloc : def.lloc;
  out.contacts = out.contacts && out.contacts.length ? out.contacts : def.contacts;
  out.schedule = out.schedule && out.schedule.length ? out.schedule : def.schedule;
  out.hospitalitat = out.hospitalitat && out.hospitalitat.length ? out.hospitalitat : def.hospitalitat;
  out.tecnic = out.tecnic && out.tecnic.length ? out.tecnic : def.tecnic;

  out.hospitalitat.forEach((it) => { if (it.label && it.label.trim().toLowerCase() === "hotel") it.label = "Allotjament"; });
  let seenAllotjament = false;
  out.hospitalitat = out.hospitalitat.filter((it) => {
    const isAllotjament = it.label && it.label.trim().toLowerCase() === "allotjament";
    if (!isAllotjament) return true;
    if (seenAllotjament) return false;
    seenAllotjament = true;
    return true;
  });
  if (!seenAllotjament) out.hospitalitat = out.hospitalitat.concat([def.hospitalitat[def.hospitalitat.length - 1]]);

  let seenPantallaLed = false;
  out.tecnic = out.tecnic.filter((it) => {
    const isLed = it.label && it.label.trim().toLowerCase() === "pantalla led";
    if (!isLed) return true;
    if (seenPantallaLed) return false;
    seenPantallaLed = true;
    return true;
  });
  if (!seenPantallaLed) out.tecnic = out.tecnic.concat([def.tecnic[def.tecnic.length - 1]]);

  // Camps nous que un full de ruta ja desat abans de la seva existència no
  // té: s'afegeixen (un cop) al final, mai duplicats.
  const hasVehicleCount = out.lloc.some((it) => it.label && it.label.trim().toLowerCase() === "número de vehicles");
  if (!hasVehicleCount) {
    const def2 = def.lloc.find((it) => it.label.trim().toLowerCase() === "número de vehicles");
    if (def2) out.lloc = out.lloc.concat([def2]);
  }
  const hasBackline = out.tecnic.some((it) => it.label && it.label.trim().toLowerCase() === "backline");
  if (!hasBackline) {
    const def3 = def.tecnic.find((it) => it.label.trim().toLowerCase() === "backline");
    if (def3) out.tecnic = out.tecnic.concat([def3]);
  }

  return out;
}

function rsAllFilled<T extends Record<string, unknown>>(items: T[] | undefined, fields: (keyof T)[]): boolean {
  return !!(items && items.length) && items.every((it) => fields.every((f) => it[f] && String(it[f]).trim()));
}
function rsHospitalitatComplete(items: HospitalitatItem[] | undefined): boolean {
  return !!(items && items.length) && items.every((it) => !!(it.label && String(it.label).trim()));
}
function rsTecnicComplete(items: TecnicItem[] | undefined): boolean {
  return !!(items && items.length) && items.every((it) => {
    if (!it.label || !String(it.label).trim()) return false;
    if (it.label.trim().toLowerCase() === "pantalla led") return true;
    return !!(it.value && String(it.value).trim());
  });
}

// Percentatge de camps emplenats del full de ruta (0-100). Només compta els
// camps que l'usuari ha d'omplir de debò — l'etiqueta/fase ja ve preomplerta
// per defecte (Recinte, Arribada, Dietes...), així que no compta com a
// progrés; sí que compten el valor de cada camp de lloc/hospitalitat/tècnic,
// les hores d'inici i fi de cada fase de l'horari, i els contactes (que no
// tenen cap valor per defecte).
export function rsCompletionPercent(c: Concert): number {
  const rs = c.routeSheet as RouteSheet | null | undefined;
  if (!rs) return 0;
  let total = 0, filled = 0;
  const check = (v: unknown) => { total++; if (v && String(v).trim()) filled++; };

  (rs.lloc || []).forEach((it) => { check(it.value); });
  (rs.contacts || []).forEach((it) => { check(it.role); check(it.name); check(it.phone); check(it.company); });
  (rs.schedule || []).forEach((it) => { check(it.start); check(it.end); });
  (rs.hospitalitat || []).forEach((it) => { check(it.value); });
  (rs.tecnic || []).forEach((it) => {
    if (!(it.label && it.label.trim().toLowerCase() === "pantalla led")) check(it.value);
  });

  if (!total) return 0;
  return Math.round((filled / total) * 100);
}

export function rsIsComplete(c: Concert): boolean {
  const rs = c.routeSheet as RouteSheet | null | undefined;
  if (!rs) return false;
  const hasLloc = rsAllFilled(rs.lloc, ["label", "value"]);
  const hasContacts = rsAllFilled(rs.contacts, ["role", "name", "phone", "company"]);
  const hasHospitalitat = rsHospitalitatComplete(rs.hospitalitat);
  const hasTecnic = rsTecnicComplete(rs.tecnic);
  const hasFullSchedule = !!(rs.schedule && rs.schedule.length && rs.schedule.every((ph) => ph.phase && ph.start && ph.end));
  return hasLloc && hasContacts && hasHospitalitat && hasTecnic && hasFullSchedule;
}

export function formatPhoneDisplay(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return phone;
  const hasPlus = phone.trim().indexOf("+") === 0;
  let cc = "", rest = digits;
  if (hasPlus || digits.length > 9) {
    const ccLen = digits.length - 9;
    if (ccLen > 0 && ccLen <= 3) { cc = digits.slice(0, ccLen); rest = digits.slice(ccLen); }
  }
  const groups = rest.match(/.{1,3}/g) || [rest];
  return (cc ? "+" + cc + " " : "") + groups.join(" ");
}

export function rsFormatDuration(start?: string, end?: string): string {
  if (!start || !end) return "";
  const sp = start.split(":").map(Number), ep = end.split(":").map(Number);
  const sMin = sp[0] * 60 + sp[1], eMin = ep[0] * 60 + ep[1];
  const diff = (eMin - sMin + 1440) % 1440;
  if (diff === 0) return "";
  const h = Math.floor(diff / 60), m = diff % 60;
  return h > 0 ? h + "h " + String(m).padStart(2, "0") + "'" : m + "'";
}
