// Seccions del formulari de regidor que un enllaç pot donar accés a veure
// i omplir — compartit entre la creació de l'enllaç (Comparteix) i el
// formulari públic en si (PublicShareForm hi té la seva pròpia còpia local
// del tipus "Section", idèntica, per no dependre d'aquí).
export type ShareSection = "info" | "lloc" | "contacts" | "schedule" | "hospitalitat" | "tecnic";

export const ALL_SHARE_SECTIONS: ShareSection[] = ["info", "lloc", "contacts", "schedule", "hospitalitat", "tecnic"];

export const SHARE_SECTION_LABELS: Record<ShareSection, string> = {
  info: "Informació general",
  lloc: "El lloc",
  contacts: "Contactes",
  schedule: "Horaris",
  hospitalitat: "Hospitalitat",
  tecnic: "Detalls tècnics",
};

// Clau de RS_SECTION_ICONS (route-sheet.ts) que li pertoca a cada secció —
// hi són gairebé iguals, només "Lloc" (allà) vs "El lloc" (aquí) difereix.
export const SHARE_SECTION_ICON_TITLE: Record<ShareSection, string> = {
  info: "Informació general",
  lloc: "Lloc",
  contacts: "Contactes",
  schedule: "Horaris",
  hospitalitat: "Hospitalitat",
  tecnic: "Detalls tècnics",
};

// "Tot" si hi són totes les seccions; si no, la llista de noms triats.
export function shareSectionsLabel(sections: string[]): string {
  if (!sections.length) return "—";
  if (ALL_SHARE_SECTIONS.every((s) => sections.includes(s))) return "Tot";
  return sections.map((s) => SHARE_SECTION_LABELS[s as ShareSection] || s).join(", ");
}
