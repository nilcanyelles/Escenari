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
  return { bg: "oklch(0.68 0.18 25 / 0.16)", color: "oklch(0.74 0.18 25)" };
}
