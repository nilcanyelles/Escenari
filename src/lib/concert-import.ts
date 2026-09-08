import { normalize } from "./text";
import { pad2 } from "./format";

// Importació de concerts des d'un Excel — les mateixes columnes que la
// plantilla que es descarrega des de la pàgina de concerts (i les d'una
// exportació típica d'altres eines de gestió: Data, Estat, Artista, Nom,
// Població, País, Recinte i contacte). Les capçaleres es reconeixen sense
// distingir majúscules ni accents, i amb uns quants sinònims; les columnes
// que no es reconeixen s'ignoren.
export const IMPORT_COLUMNS = [
  { key: "date", header: "Data", hint: "dd/mm/aaaa", required: true },
  { key: "time", header: "Hora", hint: "hh:mm (opcional)" },
  { key: "status", header: "Estat", hint: "Confirmat, Reservat, Pendent o Cancel·lat" },
  { key: "band", header: "Artista", hint: "nom del grup — es crea si no existeix", required: true },
  { key: "title", header: "Nom", hint: "festa o entitat" },
  { key: "city", header: "Població" },
  { key: "country", header: "País" },
  { key: "venue", header: "Recinte" },
  { key: "amount", header: "Import", hint: "€ (opcional)" },
  { key: "contactName", header: "Contacte Nom" },
  { key: "contactCompany", header: "Empresa" },
  { key: "contactPhone", header: "Contacte Telèfon" },
  { key: "contactEmail", header: "Contacte Email" },
] as const;
export type ImportColumnKey = typeof IMPORT_COLUMNS[number]["key"];

export type ImportedConcert = {
  date: string; // aaaa-mm-dd
  time: string; // hh:mm o buit
  status: "confirmat" | "pendent" | "reservat" | "cancel·lat";
  band: string;
  title: string;
  city: string;
  country: string;
  venue: string;
  amount: number;
  contactName: string;
  contactCompany: string;
  contactPhone: string;
  contactEmail: string;
};

export type ParsedImport = {
  concerts: ImportedConcert[];
  // Files que no s'importaran (número de fila de l'Excel, començant per 1
  // a la capçalera) i per què.
  errors: { row: number; message: string }[];
  // Columnes obligatòries que no s'han trobat a la capçalera.
  missing: ImportColumnKey[];
  // Capçaleres de l'Excel que no s'han reconegut (s'ignoren).
  unknownHeaders: string[];
  totalRows: number;
};

const HEADER_ALIASES: Record<ImportColumnKey, string[]> = {
  date: ["data", "date", "fecha", "dia"],
  time: ["hora", "time", "hora concert", "hora exacta"],
  status: ["estat", "estado", "status"],
  band: ["artista", "grup", "grupo", "band", "artist", "banda"],
  title: ["nom", "nombre", "festa", "festa/entitat", "festa entitat", "titol", "title", "event", "esdeveniment", "entitat"],
  city: ["poblacio", "ciutat", "ciudad", "city", "poblacion", "municipi", "localitat"],
  country: ["pais", "country"],
  venue: ["recinte", "ubicacio", "ubicacion", "venue", "sala", "lloc", "recinto"],
  amount: ["import", "importe", "caixet", "cache", "amount", "preu", "precio", "price"],
  contactName: ["contacte nom", "contacto nombre", "contact name", "contacte", "contacto", "contact", "nom contacte"],
  contactCompany: ["empresa", "company", "organitzador", "promotor"],
  contactPhone: ["contacte telefon", "contacto telefono", "contact phone", "telefon", "telefono", "phone", "tel", "mobil"],
  contactEmail: ["contacte email", "contacto email", "contact email", "email", "correu", "correo", "e-mail", "mail"],
};

function headerKey(h: unknown): string {
  return normalize(String(h ?? "")).replace(/[^a-z0-9/ -]/g, "").replace(/\s+/g, " ").trim();
}

// Capçalera de l'Excel → clau de columna (null si no es reconeix).
export function mapHeaders(headers: unknown[]): (ImportColumnKey | null)[] {
  const keys = Object.keys(HEADER_ALIASES) as ImportColumnKey[];
  return headers.map((h) => {
    const k = headerKey(h);
    if (!k) return null;
    return keys.find((key) => HEADER_ALIASES[key].includes(k)) || null;
  });
}

// Data en qualsevol dels formats habituals (dd/mm/aaaa, dd-mm-aaaa,
// aaaa-mm-dd, un Date de JavaScript o el número de sèrie d'Excel) →
// aaaa-mm-dd, o null si no s'entén.
export function parseImportDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.getFullYear() + "-" + pad2(v.getMonth() + 1) + "-" + pad2(v.getDate());
  }
  if (typeof v === "number") {
    // Número de sèrie d'Excel: dies des del 30/12/1899.
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    const mo = Number(m[2]), d = Number(m[1]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  return null;
}

// Hora ("21:00", "21.30", "21h", una fracció de dia d'Excel o un Date) → hh:mm o "".
export function parseImportTime(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : pad2(v.getHours()) + ":" + pad2(v.getMinutes());
  if (typeof v === "number") {
    const frac = v - Math.floor(v);
    const mins = Math.round(frac * 24 * 60);
    return pad2(Math.floor(mins / 60) % 24) + ":" + pad2(mins % 60);
  }
  const m = String(v).trim().match(/^(\d{1,2})(?:[:.h](\d{2}))?\s*h?$/i);
  if (!m) return "";
  const h = Number(m[1]);
  if (h > 23) return "";
  return pad2(h) + ":" + (m[2] || "00");
}

export function parseImportStatus(v: unknown): ImportedConcert["status"] {
  const s = normalize(String(v ?? "")).replace(/[^a-z]/g, "");
  if (!s) return "confirmat";
  if (s.startsWith("confirm")) return "confirmat";
  if (s.startsWith("reserv") || s === "hold" || s.startsWith("opci")) return "reservat";
  if (s.startsWith("cancel") || s.startsWith("anul")) return "cancel·lat";
  return "pendent";
}

// "1.500,00 €", "1500", 1500 → 1500 (enter; sense decimals als caixets).
export function parseImportAmount(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Math.max(0, Math.round(v));
  let s = String(v).replace(/[€\s]/g, "");
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return "";
  return String(v).trim();
}

// Files de l'Excel (la primera és la capçalera) → concerts a punt
// d'importar + errors fila a fila. No toca la base de dades.
export function parseImportRows(headers: unknown[], rows: unknown[][]): ParsedImport {
  const mapped = mapHeaders(headers);
  const col = (key: ImportColumnKey) => mapped.indexOf(key);
  const missing = IMPORT_COLUMNS.filter((c) => "required" in c && c.required && col(c.key) < 0).map((c) => c.key);
  const unknownHeaders = headers.map((h, i) => (mapped[i] === null && cellText(h) ? cellText(h) : "")).filter(Boolean);

  const concerts: ImportedConcert[] = [];
  const errors: { row: number; message: string }[] = [];
  let totalRows = 0;
  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const cells = Array.isArray(r) ? r : [];
    if (!cells.some((c) => cellText(c) || c instanceof Date || typeof c === "number")) return; // fila buida
    totalRows++;
    const get = (key: ImportColumnKey): unknown => { const idx = col(key); return idx >= 0 ? cells[idx] : ""; };
    const date = parseImportDate(get("date"));
    const band = cellText(get("band"));
    if (!date) { errors.push({ row: rowNum, message: "data no vàlida" + (cellText(get("date")) ? ` («${cellText(get("date"))}»)` : "") }); return; }
    if (!band) { errors.push({ row: rowNum, message: "falta l'artista" }); return; }
    concerts.push({
      date,
      time: parseImportTime(get("time")),
      status: parseImportStatus(get("status")),
      band,
      title: cellText(get("title")),
      city: cellText(get("city")),
      country: cellText(get("country")),
      venue: cellText(get("venue")),
      amount: parseImportAmount(get("amount")),
      contactName: cellText(get("contactName")),
      contactCompany: cellText(get("contactCompany")),
      contactPhone: cellText(get("contactPhone")),
      contactEmail: cellText(get("contactEmail")),
    });
  });
  return { concerts, errors, missing, unknownHeaders, totalRows };
}
