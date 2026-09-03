export const MONTH_ABBR = ["gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des"];
export const MONTH_FULL = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
export const WEEKDAY_FULL = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];
export const WEEKDAY_SHORT = ["dl", "dt", "dc", "dj", "dv", "ds", "dg"];

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function today(): string {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

export function addDays(dateStr: string, n: number): string {
  const p = dateStr.split("-").map(Number);
  const d = new Date(p[0], p[1] - 1, p[2] + n);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

// Hora aproximada del concert: la casella de la pestanya Informació general
// és una bombolla que fa cicle entre aquests 5 moments del dia en comptes
// d'un selector d'hora exacta — però per sota segueix desant una hora real
// (representativa del tram) perquè tota la resta de l'app (ICS, contractes,
// factures, ordenació...) continuï funcionant sense tocar-hi res.
export const TIME_PERIODS = ["Matí", "Migdia", "Tarda", "Vespre", "Matinada"] as const;
const TIME_PERIOD_REPRESENTATIVE: Record<string, string> = {
  "Matí": "09:00", "Migdia": "13:00", "Tarda": "17:00", "Vespre": "20:30", "Matinada": "02:00",
};
// Article/preposició correctes en català per a cada tram ("al matí", "a la tarda"...).
const TIME_PERIOD_PHRASE: Record<string, string> = {
  "Matí": "al matí", "Migdia": "al migdia", "Tarda": "a la tarda", "Vespre": "al vespre", "Matinada": "a la matinada",
};

// Tram del dia a què pertany una hora HH:MM (o "" si no n'hi ha).
export function timePeriodFor(time: string): string | null {
  if (!/^\d{2}:\d{2}/.test(time || "")) return null;
  const h = parseInt(time.slice(0, 2), 10);
  if (h >= 6 && h < 12) return "Matí";
  if (h >= 12 && h < 15) return "Migdia";
  if (h >= 15 && h < 19) return "Tarda";
  if (h >= 19 || h === 0) return "Vespre";
  return "Matinada";
}

// Hora representativa del següent tram del cicle (Matí → Migdia → Tarda →
// Vespre → Matinada → Matí…), a partir de l'hora actual (o buida).
export function nextTimePeriodValue(time: string): string {
  const cur = timePeriodFor(time);
  const idx = cur ? TIME_PERIODS.indexOf(cur as typeof TIME_PERIODS[number]) : -1;
  const next = TIME_PERIODS[(idx + 1) % TIME_PERIODS.length];
  return TIME_PERIOD_REPRESENTATIVE[next];
}

// Text per a mostrar l'hora: el tram del dia si en sap un ("Vespre"), la
// pròpia hora si no encaixa en cap tram, o buit.
export function formatConcertTime(time: string): string {
  if (!time) return "";
  return timePeriodFor(time) || time;
}

// Frase natural ("al vespre", "a les 20:30h"...) per encaixar dins de
// textos com "el concert és ${formatConcertTimePhrase(time)}".
export function formatConcertTimePhrase(time: string): string {
  if (!time) return "";
  const period = timePeriodFor(time);
  return period ? TIME_PERIOD_PHRASE[period] : `a les ${time}h`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthWithPrep(monthFull: string): string {
  return /^[aeiouàéèíòóú]/i.test(monthFull) ? "d'" + monthFull : "de " + monthFull;
}

export function formatDate(dateStr: string): string {
  const p = dateStr.split("-").map(Number);
  return p[2] + " " + MONTH_ABBR[p[1] - 1] + " " + p[0];
}

export function formatDateFull(dateStr: string): string {
  const p = dateStr.split("-").map(Number);
  const dt = new Date(p[0], p[1] - 1, p[2]);
  return WEEKDAY_FULL[dt.getDay()] + ", " + p[2] + " " + monthWithPrep(MONTH_FULL[p[1] - 1]) + " de " + p[0];
}

export function formatDateLong(dateStr: string): string {
  const p = dateStr.split("-").map(Number);
  return p[2] + " " + monthWithPrep(MONTH_FULL[p[1] - 1]) + " de " + p[0];
}

export function formatCurrency(n: number): string {
  const isInt = Number.isInteger(n);
  return new Intl.NumberFormat("ca-ES", { minimumFractionDigits: isInt ? 0 : 2, maximumFractionDigits: 2 }).format(n) + " €";
}

export function statusColors(status: string): { bg: string; color: string } {
  if (status === "confirmat" || status === "pagada") return { bg: "oklch(0.72 0.15 155 / 0.16)", color: "oklch(0.78 0.15 155)" };
  if (status === "pendent") return { bg: "oklch(0.78 0.15 80 / 0.16)", color: "oklch(0.82 0.15 80)" };
  if (status === "reservat") return { bg: "oklch(0.7 0.14 230 / 0.16)", color: "oklch(0.76 0.13 230)" };
  return { bg: "oklch(0.68 0.18 25 / 0.16)", color: "oklch(0.74 0.18 25)" };
}

// Dies transcorreguts entre dues dates (aaaa-mm-dd).
export function daysBetween(a: string, b: string): number {
  const pa = a.split("-").map(Number), pb = b.split("-").map(Number);
  const da = new Date(pa[0], pa[1] - 1, pa[2]), dbb = new Date(pb[0], pb[1] - 1, pb[2]);
  return Math.round((dbb.getTime() - da.getTime()) / 86400000);
}
