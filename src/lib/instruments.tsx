// Catàleg d'instruments agrupat per família, amb una icona SVG de línia per a
// cadascun (dibuixades amb el mateix llenguatge visual que les icones de la nav).

export type IconKey =
  | "mic" | "guitar" | "violin" | "harp"
  | "drumkit" | "drum" | "handdrum" | "mallet" | "chimes" | "gong" | "triangle" | "castanets" | "tambourine" | "shaker" | "cymbal"
  | "piano" | "organ" | "accordion" | "synth" | "drummachine"
  | "flute" | "reed" | "sax" | "trumpet" | "harmonica" | "ocarina" | "whistle" | "bagpipe"
  | "note";

const ICON_PATHS: Record<IconKey, string> = {
  mic: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>',
  guitar: '<circle cx="8.5" cy="15.5" r="5.5"/><circle cx="8.5" cy="15.5" r="1.7"/><line x1="12.5" y1="11.5" x2="20" y2="4"/><path d="M18.5 2.5 21.5 5.5"/>',
  violin: '<path d="M12 7.5c-2.8 0-3.8 1.8-3 3.4.7 1.5-1 1.7-1 3.6a4 4 0 0 0 8 0c0-1.9-1.7-2.1-1-3.6.8-1.6-.2-3.4-3-3.4z"/><line x1="12" y1="7.5" x2="12" y2="2"/><line x1="10" y1="3.5" x2="14" y2="3.5"/><line x1="16.5" y1="21.5" x2="21.5" y2="16.5"/>',
  harp: '<path d="M5.5 21V8a6.5 6.5 0 0 1 13 0v13"/><line x1="8.5" y1="21" x2="8.5" y2="5.5"/><line x1="12" y1="21" x2="12" y2="4"/><line x1="15.5" y1="21" x2="15.5" y2="5.5"/><line x1="4" y1="21" x2="20" y2="21"/>',
  drumkit: '<circle cx="12" cy="14.5" r="5"/><line x1="4.5" y1="4.5" x2="9.5" y2="10.5"/><line x1="19.5" y1="4.5" x2="14.5" y2="10.5"/><ellipse cx="4.5" cy="4.5" rx="2.5" ry="1"/><ellipse cx="19.5" cy="4.5" rx="2.5" ry="1"/>',
  drum: '<ellipse cx="12" cy="7.5" rx="8" ry="2.8"/><path d="M4 7.5v8c0 1.6 3.6 2.9 8 2.9s8-1.3 8-2.9v-8"/><line x1="7.5" y1="10" x2="10" y2="15.5"/><line x1="16.5" y1="10" x2="14" y2="15.5"/>',
  handdrum: '<circle cx="8" cy="13" r="5.2"/><circle cx="17.2" cy="14.8" r="3.8"/>',
  mallet: '<rect x="4" y="6.5" width="16" height="3" rx="1"/><rect x="5.7" y="11.5" width="12.6" height="3" rx="1"/><rect x="7.4" y="16.5" width="9.2" height="3" rx="1"/>',
  chimes: '<line x1="4.5" y1="4" x2="19.5" y2="4"/><line x1="7" y1="4" x2="7" y2="15"/><line x1="10.3" y1="4" x2="10.3" y2="18"/><line x1="13.6" y1="4" x2="13.6" y2="16"/><line x1="17" y1="4" x2="17" y2="20"/>',
  gong: '<path d="M4 4.5h16"/><path d="M6.5 4.5 8 8"/><path d="M17.5 4.5 16 8"/><circle cx="12" cy="14" r="6"/><circle cx="12" cy="14" r="1.8"/>',
  triangle: '<path d="M12 4.5 20.5 19.5H3.5z"/><line x1="16.5" y1="15" x2="21" y2="10.5"/>',
  castanets: '<circle cx="12" cy="7.7" r="4.7"/><path d="M7.3 12.5a4.7 4.7 0 1 0 9.4 0"/><line x1="7.3" y1="7.7" x2="7.3" y2="12.5"/><line x1="16.7" y1="7.7" x2="16.7" y2="12.5"/>',
  tambourine: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="19" r="0.8"/><circle cx="5.9" cy="15.5" r="0.8"/><circle cx="18.1" cy="15.5" r="0.8"/><path d="M8.5 8.5 15.5 8.5"/>',
  shaker: '<circle cx="9" cy="8" r="5"/><path d="M11.5 12.2 15.5 21"/><circle cx="7.5" cy="6.5" r="0.7"/><circle cx="10.5" cy="9.5" r="0.7"/>',
  cymbal: '<ellipse cx="12" cy="10" rx="9" ry="2.6"/><circle cx="12" cy="9" r="1"/><line x1="12" y1="12.6" x2="12" y2="21"/><line x1="9" y1="21" x2="15" y2="21"/>',
  piano: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><line x1="7.5" y1="11" x2="7.5" y2="18"/><line x1="12" y1="11" x2="12" y2="18"/><line x1="16.5" y1="11" x2="16.5" y2="18"/>',
  organ: '<line x1="6" y1="19" x2="6" y2="8.5"/><line x1="9" y1="19" x2="9" y2="5.5"/><line x1="12" y1="19" x2="12" y2="3.5"/><line x1="15" y1="19" x2="15" y2="5.5"/><line x1="18" y1="19" x2="18" y2="8.5"/><line x1="4" y1="19" x2="20" y2="19"/>',
  accordion: '<rect x="4" y="5" width="4.5" height="14" rx="1"/><rect x="15.5" y="5" width="4.5" height="14" rx="1"/><line x1="10.7" y1="6.5" x2="10.7" y2="17.5"/><line x1="13.3" y1="6.5" x2="13.3" y2="17.5"/><circle cx="6.2" cy="9" r="0.7"/><circle cx="6.2" cy="12" r="0.7"/><circle cx="6.2" cy="15" r="0.7"/>',
  synth: '<rect x="3" y="7" width="18" height="10" rx="1.5"/><circle cx="7" cy="10" r="1.1"/><circle cx="12" cy="10" r="1.1"/><circle cx="17" cy="10" r="1.1"/><line x1="3" y1="13.5" x2="21" y2="13.5"/><line x1="7" y1="13.5" x2="7" y2="17"/><line x1="11" y1="13.5" x2="11" y2="17"/><line x1="15" y1="13.5" x2="15" y2="17"/>',
  drummachine: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><circle cx="6.8" cy="9.2" r="0.9"/><circle cx="17.2" cy="9.2" r="0.9"/><rect x="5.7" y="12.3" width="3" height="3"/><rect x="10.5" y="12.3" width="3" height="3"/><rect x="15.3" y="12.3" width="3" height="3"/>',
  flute: '<rect x="2" y="10.4" width="20" height="3.2" rx="1.6"/><circle cx="10" cy="12" r="0.7"/><circle cx="13.5" cy="12" r="0.7"/><circle cx="17" cy="12" r="0.7"/>',
  reed: '<path d="M10.6 2.5h2.8L15 13.8a4.6 4.6 0 0 1-3 5.7 4.6 4.6 0 0 1-3-5.7z"/><circle cx="12" cy="7.5" r="0.7"/><circle cx="12" cy="10.5" r="0.7"/><circle cx="12" cy="13.5" r="0.7"/>',
  sax: '<path d="M15.5 2.5v10a5.5 5.5 0 0 1-11 0v-1.5"/><path d="M4.5 11c-.8 2.8.4 5.6 3 7"/><line x1="13.5" y1="5" x2="15.5" y2="5"/><line x1="13.5" y1="8" x2="15.5" y2="8"/>',
  trumpet: '<path d="M2 11h9"/><path d="M11 8.5c4 0 6.5-2 8.5-3.5v12c-2-1.5-4.5-3.5-8.5-3.5"/><line x1="11" y1="8.5" x2="11" y2="13.5"/><line x1="5" y1="11" x2="5" y2="15"/><line x1="7.5" y1="11" x2="7.5" y2="15"/><line x1="10" y1="11" x2="10" y2="15"/>',
  harmonica: '<rect x="3" y="9" width="18" height="6" rx="1.2"/><line x1="6.5" y1="11" x2="6.5" y2="13"/><line x1="9.5" y1="11" x2="9.5" y2="13"/><line x1="12.5" y1="11" x2="12.5" y2="13"/><line x1="15.5" y1="11" x2="15.5" y2="13"/><line x1="18.5" y1="11" x2="18.5" y2="13"/>',
  ocarina: '<ellipse cx="12" cy="13" rx="8.5" ry="5.5" transform="rotate(-15 12 13)"/><circle cx="9.5" cy="14" r="0.7"/><circle cx="13" cy="13" r="0.7"/><circle cx="16" cy="11.5" r="0.7"/><path d="M18.5 7.5 21 5"/>',
  whistle: '<path d="M4 9h9.5a4.5 4.5 0 1 1-4.7 7.6L4 13.7z"/><circle cx="10" cy="6.5" r="0.01"/>',
  bagpipe: '<ellipse cx="10" cy="13.5" rx="5.5" ry="4.4"/><line x1="8" y1="9.5" x2="8" y2="4"/><line x1="11" y1="9.4" x2="11" y2="2.5"/><path d="M14.5 11.2 21 7.5"/><path d="M14 16.5 19.5 19.5"/>',
  note: '<path d="M9 18V5l11-2v11"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="14" r="3"/>',
};

export function InstrumentSvg({ icon, size = 15, className }: { icon: IconKey; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[icon] || ICON_PATHS.note }}
    />
  );
}

export type InstrumentCategory = { name: string; items: { name: string; icon: IconKey }[] };

function cat(name: string, defIcon: IconKey, items: (string | [string, IconKey])[]): InstrumentCategory {
  return {
    name,
    items: items.map((i) => (typeof i === "string" ? { name: i, icon: defIcon } : { name: i[0], icon: i[1] })),
  };
}

export const INSTRUMENT_CATEGORIES: InstrumentCategory[] = [
  cat("Veu", "mic", ["Veu", "Cors"]),
  cat("Corda", "guitar", [
    "Guitarra", "Guitarra acústica", "Guitarra espanyola", "Guitarra elèctrica", "Baix elèctric",
    ["Violí", "violin"], ["Viola", "violin"], ["Violoncel", "violin"], ["Contrabaix", "violin"],
    ["Arpa", "harp"], "Banjo", "Mandolina", "Ukelele", "Llaüt", "Bandúrria", "Balalaica", "Guitarró",
  ]),
  cat("Vent", "reed", [
    ["Flauta", "flute"], ["Flauta travessera", "flute"], ["Flautí", "flute"], ["Piccolo", "flute"],
    "Clarinet", "Oboè", "Fagot", "Contrafagot", "Corn anglès",
    ["Saxofon soprano", "sax"], ["Saxofon alto", "sax"], ["Saxofon tenor", "sax"], ["Saxofon baríton", "sax"],
    ["Trompeta", "trumpet"], ["Corneta", "trumpet"], ["Fiscorn", "trumpet"], ["Trombó", "trumpet"],
    ["Bombardó", "trumpet"], ["Tuba", "trumpet"],
    ["Harmònica", "harmonica"], ["Melòdica", "harmonica"], ["Ocarina", "ocarina"], ["Xiulet", "whistle"],
  ]),
  cat("Percussió", "drum", [
    ["Bateria", "drumkit"], "Bombo", "Tabal", "Timbal", "Timbala", "Surdo", "Contrasurdo",
    ["Caixa de percussió", "drum"], ["Caixó", "handdrum"], ["Bongos", "handdrum"], ["Darbukka", "handdrum"], ["Pandero", "handdrum"],
    ["Pandereta", "tambourine"], ["Castanyoles", "castanets"], ["Maraques", "shaker"], ["Xequeré", "shaker"],
    ["Triangle", "triangle"], ["Gong", "gong"], ["Plats", "cymbal"], ["Platerets", "cymbal"], ["Címbals", "cymbal"],
    ["Xilòfon", "mallet"], ["Vibràfon", "mallet"], ["Metal·lòfon", "mallet"], ["Glockenspiel", "mallet"],
    ["Campanes tubulars", "chimes"],
  ]),
  cat("Tecles", "piano", [
    "Piano", ["Orgue", "organ"], "Celesta", ["Acordió cromàtic", "accordion"], ["Acordió diatònic", "accordion"],
  ]),
  cat("Electrònica", "synth", [
    "Sintetitzador", ["Caixa de ritmes", "drummachine"],
  ]),
  cat("Tradicional", "reed", [
    "Gralla seca", "Gralla dolça", "Gralla baixa", "Dolçaina", "Tarota", "Tenora", "Tible",
    ["Sac de gemecs", "bagpipe"], ["Gaita", "bagpipe"], ["Cornamusa", "bagpipe"],
    ["Flabiol", "flute"], ["Flabiol i tamborí", "flute"], ["Tamborí", "drum"],
  ]),
];

const ICON_BY_NAME: Record<string, IconKey> = {};
INSTRUMENT_CATEGORIES.forEach((c) => c.items.forEach((i) => { ICON_BY_NAME[i.name.toLowerCase()] = i.icon; }));

export function instrumentIconKey(name: string): IconKey {
  return ICON_BY_NAME[(name || "").trim().toLowerCase()] || "note";
}
