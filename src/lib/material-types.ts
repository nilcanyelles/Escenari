// Models de rider tècnic i setlist (el "material" d'un grup).
//
// Un rider agrupa tots els "subriders": contactes del grup, plànol d'escenari,
// llista d'entrades, llista de sortides, hospitalitat, llums, àudio, backline
// i pàgines extra adjuntes.

export type RiderContact = { role: string; name: string; phone: string; email: string };
export type RiderInput = { ch: string; source: string; mic: string; stand: string; notes: string };
export type RiderOutput = { ch: string; dest: string; kind: string; notes: string };
export type RiderMonitor = { who: string; kind: string; notes: string };
export type RiderBacklineItem = { item: string; providedBy: "grup" | "organitzacio"; notes: string };
export type RiderPage = { title: string; body: string };

export type StageItem = { id: string; kind: string; label: string; x: number; y: number; scale: number };
export type StageSetup = { widthM: number; depthM: number; items: StageItem[] };

export type RiderContent = {
  intro: string;
  contacts: RiderContact[];
  stage: StageSetup;
  inputs: RiderInput[];
  outputs: RiderOutput[];
  monitors: RiderMonitor[];
  backline: RiderBacklineItem[];
  audio: string;
  lighting: string;
  power: string;
  hospitality: string;
  notes: string;
  pages: RiderPage[];
};

export type Rider = {
  id: string;
  bandId: string;
  name: string;
  content: RiderContent;
  publicToken: string;
  updatedAt: string;
};

export type RiderApproval = {
  id: string;
  concertId: string;
  riderId: string;
  recipientName: string;
  recipientEmail: string;
  status: "pendent" | "contrarider" | "aprovat";
  counterNote: string;
  hasCounter: boolean;
  emailSentAt: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type Song = { title: string; duration: string; key: string; notes: string };

export type Setlist = {
  id: string;
  bandId: string;
  name: string;
  songs: Song[];
  publicToken: string;
  updatedAt: string;
};

export type BandEditor = { clerkUserId: string; canRiders: boolean; canSetlists: boolean };

export function emptyRiderContent(): RiderContent {
  return {
    intro: "",
    contacts: [{ role: "Contacte principal", name: "", phone: "", email: "" }],
    stage: { widthM: 8, depthM: 6, items: [] },
    inputs: [{ ch: "1", source: "", mic: "", stand: "", notes: "" }],
    outputs: [],
    monitors: [],
    backline: [],
    audio: "",
    lighting: "",
    power: "",
    hospitality: "",
    notes: "",
    pages: [],
  };
}

// Mapa d'etiquetes antigues (escenari v1: icones png/emoji) a tipus de la
// llibreria SVG nova, per no perdre plànols ja fets.
const LEGACY_KIND_GUESS: [RegExp, string][] = [
  [/bateria/i, "drumkit"], [/caix/i, "cajon"], [/bongo|conga/i, "congas"],
  [/guitarra el/i, "electric-guitar"], [/guitarra/i, "acoustic-guitar"], [/baix/i, "bass"],
  [/violí|viola/i, "violin"], [/tecla|piano|sintetitzador/i, "keyboard"],
  [/saxo/i, "sax"], [/trompeta|fiscorn|corneta/i, "trumpet"], [/flauta|flabiol|gralla|dolçaina/i, "flute"],
  [/veu|micro/i, "mic"], [/monitor/i, "wedge"], [/di\b/i, "di"], [/ampli/i, "amp"],
  [/corrent/i, "power"], [/taula/i, "mixer"],
];

function guessKind(label: string): string {
  for (const [re, kind] of LEGACY_KIND_GUESS) if (re.test(label)) return kind;
  return "person";
}

export function normalizeRiderContent(c: unknown): RiderContent {
  const def = emptyRiderContent();
  if (!c || typeof c !== "object") return def;
  const o = c as Record<string, unknown>;

  // Escenari: format nou {widthM, depthM, items} o format antic (array pla).
  let stage: StageSetup = def.stage;
  const rawStage = o.stage;
  if (Array.isArray(rawStage)) {
    stage = {
      widthM: 8,
      depthM: 6,
      items: rawStage.map((it: { id: string; label: string; x: number; y: number }) => ({
        id: it.id, kind: guessKind(it.label || ""), label: it.label || "", x: it.x, y: it.y, scale: 1,
      })),
    };
  } else if (rawStage && typeof rawStage === "object") {
    const s = rawStage as Partial<StageSetup>;
    stage = {
      widthM: Number(s.widthM) || 8,
      depthM: Number(s.depthM) || 6,
      items: Array.isArray(s.items) ? s.items.map((it) => ({ ...it, scale: Number(it.scale) || 1 })) : [],
    };
  }

  return {
    intro: (o.intro as string) || "",
    contacts: Array.isArray(o.contacts) && o.contacts.length ? (o.contacts as RiderContact[]) : def.contacts,
    stage,
    inputs: Array.isArray(o.inputs) && (o.inputs as RiderInput[]).length ? (o.inputs as RiderInput[]) : def.inputs,
    outputs: Array.isArray(o.outputs) ? (o.outputs as RiderOutput[]) : [],
    monitors: Array.isArray(o.monitors) ? (o.monitors as RiderMonitor[]) : [],
    backline: Array.isArray(o.backline) ? (o.backline as RiderBacklineItem[]) : [],
    audio: (o.audio as string) || (o.foh as string) || "",
    lighting: (o.lighting as string) || "",
    power: (o.power as string) || "",
    hospitality: (o.hospitality as string) || "",
    notes: (o.notes as string) || "",
    pages: Array.isArray(o.pages) ? (o.pages as RiderPage[]) : [],
  };
}

// "3:45" o "3" → segons; buit → 0.
export function songDurationSecs(d: string): number {
  const t = (d || "").trim();
  if (!t) return 0;
  const parts = t.split(":").map((p) => parseInt(p, 10) || 0);
  if (parts.length === 1) return parts[0] * 60;
  return parts[0] * 60 + parts[1];
}

export function formatTotalDuration(totalSecs: number): string {
  if (!totalSecs) return "—";
  const h = Math.floor(totalSecs / 3600);
  const m = Math.round((totalSecs % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m} min`;
}
