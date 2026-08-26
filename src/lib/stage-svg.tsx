// Llibreria d'elements d'escenari en SVG (vista zenital estilitzada) per al
// plànol del rider. Tot vectorial: es veu net al canvas fosc i al PDF blanc.

export type StageKindDef = { kind: string; label: string; svg: React.ReactNode; defaultScale?: number };
export type StageCategory = { id: string; label: string; color: string; items: StageKindDef[] };

const WOOD = "#c58a4a";
const WOOD_D = "#8a5a2b";
const SKIN = "#e8c39e";
const METAL = "#c9ccd6";
const METAL_D = "#8f93a3";
const DARK = "#3a3d47";
const DARKER = "#22242b";
const BRASS = "#d9a53f";
const RED = "#c8474e";
const CREAM = "#efe6d8";

function Drumkit() {
  return (
    <g>
      <circle cx="32" cy="38" r="15" fill={CREAM} stroke={DARK} strokeWidth="2" />
      <circle cx="32" cy="38" r="10" fill="#f7f2e9" stroke={METAL_D} strokeWidth="1" />
      <circle cx="16" cy="24" r="8" fill={CREAM} stroke={DARK} strokeWidth="1.6" />
      <circle cx="33" cy="16" r="7" fill={CREAM} stroke={DARK} strokeWidth="1.6" />
      <circle cx="48" cy="24" r="8" fill={CREAM} stroke={DARK} strokeWidth="1.6" />
      <circle cx="10" cy="44" r="7.5" fill={BRASS} stroke={WOOD_D} strokeWidth="1.4" />
      <circle cx="54" cy="42" r="8.5" fill={BRASS} stroke={WOOD_D} strokeWidth="1.4" />
      <circle cx="10" cy="44" r="1.6" fill={WOOD_D} />
      <circle cx="54" cy="42" r="1.6" fill={WOOD_D} />
    </g>
  );
}
function Cajon() {
  return (
    <g>
      <rect x="16" y="12" width="32" height="40" rx="4" fill={WOOD} stroke={WOOD_D} strokeWidth="2" />
      <rect x="21" y="17" width="22" height="30" rx="3" fill="none" stroke={WOOD_D} strokeWidth="1.4" />
      <circle cx="32" cy="26" r="4" fill={WOOD_D} />
    </g>
  );
}
function Congas() {
  return (
    <g>
      <circle cx="21" cy="32" r="12" fill={SKIN} stroke={WOOD_D} strokeWidth="2.4" />
      <circle cx="45" cy="32" r="10" fill={SKIN} stroke={WOOD_D} strokeWidth="2.4" />
      <circle cx="21" cy="32" r="8" fill="#f2dcc0" />
      <circle cx="45" cy="32" r="6.5" fill="#f2dcc0" />
    </g>
  );
}
function Timbal() {
  return (
    <g>
      <circle cx="32" cy="32" r="16" fill={CREAM} stroke={DARK} strokeWidth="2.4" />
      <circle cx="32" cy="32" r="11" fill="#f7f2e9" stroke={METAL_D} strokeWidth="1.2" />
      <circle cx="32" cy="15" r="2.4" fill={METAL_D} />
      <circle cx="46" cy="41" r="2.4" fill={METAL_D} />
      <circle cx="18" cy="41" r="2.4" fill={METAL_D} />
    </g>
  );
}
function ElectricGuitar() {
  return (
    <g transform="rotate(35 32 32)">
      <rect x="29.4" y="6" width="5.2" height="26" rx="2" fill={WOOD_D} />
      <path d="M32 28c-7 0-11 5-10.5 11 .3 4.5 3 8.5 6 10.5-1.5 2.5-.8 6 3 7.5h3c3.8-1.5 4.5-5 3-7.5 3-2 5.7-6 6-10.5.5-6-3.5-11-10.5-11z" fill={RED} stroke="#8f3238" strokeWidth="1.6" />
      <rect x="30.6" y="34" width="2.8" height="12" rx="1.2" fill={DARKER} />
      <rect x="27.4" y="4" width="9.2" height="5" rx="2" fill={DARK} />
    </g>
  );
}
function AcousticGuitar() {
  return (
    <g transform="rotate(35 32 32)">
      <rect x="29.6" y="5" width="4.8" height="24" rx="2" fill={WOOD_D} />
      <path d="M32 26c-5.4 0-8.5 3.4-8.8 7.4-.2 2.6.8 4.3.4 6.4-.5 2.6-2.4 4-2.2 7.4.3 5.4 5 9.8 10.6 9.8s10.3-4.4 10.6-9.8c.2-3.4-1.7-4.8-2.2-7.4-.4-2.1.6-3.8.4-6.4-.3-4-3.4-7.4-8.8-7.4z" fill={WOOD} stroke={WOOD_D} strokeWidth="1.6" />
      <circle cx="32" cy="38" r="4.6" fill={DARKER} />
      <rect x="28" y="3" width="8" height="4.6" rx="1.6" fill={DARK} />
    </g>
  );
}
function Bass() {
  return (
    <g transform="rotate(35 32 32)">
      <rect x="29.8" y="3" width="4.4" height="30" rx="2" fill={DARKER} />
      <path d="M32 32c-6.4 0-10 4.6-9.6 10 .3 4 2.6 7.6 5.4 9.4-1.3 2.3-.7 5.4 2.7 6.8h3c3.4-1.4 4-4.5 2.7-6.8 2.8-1.8 5.1-5.4 5.4-9.4.4-5.4-3.2-10-9.6-10z" fill="#4a5568" stroke={DARKER} strokeWidth="1.6" />
      <rect x="30.8" y="38" width="2.4" height="11" rx="1" fill={DARKER} />
      <rect x="28" y="1.6" width="8" height="4.4" rx="1.6" fill={DARK} />
    </g>
  );
}
function Violin() {
  return (
    <g transform="rotate(30 32 32)">
      <rect x="30.2" y="8" width="3.6" height="18" rx="1.6" fill={WOOD_D} />
      <path d="M32 24c-4 0-6.2 2.4-6.4 5.2-.1 1.8.6 3 .3 4.4-.4 1.9-1.8 2.9-1.6 5.3.2 4 3.6 7.1 7.7 7.1s7.5-3.1 7.7-7.1c.2-2.4-1.2-3.4-1.6-5.3-.3-1.4.4-2.6.3-4.4-.2-2.8-2.4-5.2-6.4-5.2z" fill={WOOD} stroke={WOOD_D} strokeWidth="1.4" />
      <rect x="31.2" y="28" width="1.6" height="14" fill={DARKER} />
    </g>
  );
}
function Keyboard() {
  return (
    <g>
      <rect x="6" y="22" width="52" height="20" rx="3" fill={DARK} stroke={DARKER} strokeWidth="1.6" />
      <rect x="9" y="27" width="46" height="12" rx="1.4" fill="#f5f2ea" />
      {[14, 19, 24, 29, 34, 39, 44, 49].map((x) => (
        <rect key={x} x={x} y="27" width="2.6" height="7" fill={DARKER} />
      ))}
    </g>
  );
}
function Sax() {
  return (
    <g transform="rotate(15 32 32)">
      <path d="M38 8c-4 0-6 2.6-6 6v22c0 4-2 6-5 6s-5-2-5-5.4c0-2 1-3.6 2.6-4.6" fill="none" stroke={BRASS} strokeWidth="5.4" strokeLinecap="round" />
      <circle cx="21" cy="43" r="6.4" fill={BRASS} stroke="#a97e2c" strokeWidth="1.6" />
      <circle cx="34.6" cy="20" r="1.7" fill="#a97e2c" />
      <circle cx="34.6" cy="27" r="1.7" fill="#a97e2c" />
      <circle cx="34.6" cy="34" r="1.7" fill="#a97e2c" />
    </g>
  );
}
function Trumpet() {
  return (
    <g transform="rotate(-18 32 32)">
      <rect x="8" y="29" width="34" height="5.6" rx="2.8" fill={BRASS} />
      <path d="M40 24c6 1.6 10 4.4 12 8-2 3.6-6 6.4-12 8z" fill={BRASS} stroke="#a97e2c" strokeWidth="1.4" />
      <rect x="18" y="24" width="3" height="9" rx="1.4" fill="#a97e2c" />
      <rect x="24" y="24" width="3" height="9" rx="1.4" fill="#a97e2c" />
      <rect x="30" y="24" width="3" height="9" rx="1.4" fill="#a97e2c" />
    </g>
  );
}
function Flute() {
  return (
    <g transform="rotate(-30 32 32)">
      <rect x="8" y="29.4" width="48" height="5.2" rx="2.6" fill={METAL} stroke={METAL_D} strokeWidth="1.2" />
      {[20, 27, 34, 41].map((x) => <circle key={x} cx={x} cy="32" r="1.6" fill={METAL_D} />)}
    </g>
  );
}
function MicStand() {
  return (
    <g>
      <circle cx="32" cy="44" r="10" fill="none" stroke={METAL_D} strokeWidth="2.4" />
      <line x1="32" y1="44" x2="32" y2="18" stroke={METAL} strokeWidth="3" strokeLinecap="round" />
      <rect x="27.4" y="8" width="9.2" height="13" rx="4.6" fill={DARK} stroke={DARKER} strokeWidth="1.4" />
      <path d="M28 13h8" stroke={METAL_D} strokeWidth="1" />
      <path d="M28 16h8" stroke={METAL_D} strokeWidth="1" />
    </g>
  );
}
function Wireless() {
  return (
    <g transform="rotate(20 32 32)">
      <rect x="27.4" y="10" width="9.2" height="14" rx="4.6" fill={DARK} stroke={DARKER} strokeWidth="1.4" />
      <rect x="29.4" y="24" width="5.2" height="26" rx="2.6" fill={METAL_D} />
      <path d="M29 15h6M29 18h6" stroke={METAL_D} strokeWidth="1" />
    </g>
  );
}
function DiBox() {
  return (
    <g>
      <rect x="16" y="22" width="32" height="20" rx="3" fill={DARK} stroke={DARKER} strokeWidth="1.6" />
      <circle cx="24" cy="32" r="3.4" fill={METAL} />
      <circle cx="40" cy="32" r="3.4" fill={METAL} />
      <text x="32" y="19" textAnchor="middle" fontSize="9" fontWeight="700" fill={METAL_D} fontFamily="Inter,sans-serif">DI</text>
    </g>
  );
}
function Wedge() {
  return (
    <g>
      <path d="M12 40 L52 40 L46 22 L18 22 Z" fill={DARK} stroke={DARKER} strokeWidth="2" />
      <path d="M18 22 L46 22 L44 16 L20 16 Z" fill={DARKER} />
      <circle cx="32" cy="31" r="6" fill="none" stroke={METAL_D} strokeWidth="2" />
      <circle cx="32" cy="31" r="2" fill={METAL_D} />
    </g>
  );
}
function PaSpeaker() {
  return (
    <g>
      <rect x="18" y="6" width="28" height="52" rx="4" fill={DARK} stroke={DARKER} strokeWidth="2" />
      <circle cx="32" cy="40" r="10" fill="none" stroke={METAL_D} strokeWidth="2.4" />
      <circle cx="32" cy="40" r="3.4" fill={METAL_D} />
      <circle cx="32" cy="18" r="5" fill="none" stroke={METAL_D} strokeWidth="2" />
    </g>
  );
}
function Mixer() {
  return (
    <g>
      <rect x="8" y="16" width="48" height="32" rx="4" fill={DARK} stroke={DARKER} strokeWidth="2" />
      {[15, 22, 29, 36, 43].map((x) => (
        <g key={x}>
          <line x1={x} y1="22" x2={x} y2="40" stroke={METAL_D} strokeWidth="2" />
          <rect x={x - 2.6} y={26 + ((x * 7) % 9)} width="5.2" height="4" rx="1" fill={CREAM} />
        </g>
      ))}
      <circle cx="51" cy="24" r="2.4" fill={RED} />
      <circle cx="51" cy="32" r="2.4" fill={BRASS} />
    </g>
  );
}
function Iem() {
  return (
    <g>
      <rect x="20" y="18" width="24" height="28" rx="4" fill={DARK} stroke={DARKER} strokeWidth="1.8" />
      <rect x="24" y="23" width="16" height="7" rx="1.6" fill="#7fd1b9" />
      <path d="M26 46c0 6 12 6 12 0" fill="none" stroke={METAL_D} strokeWidth="2" />
      <circle cx="26" cy="49" r="2.6" fill={METAL_D} />
      <circle cx="38" cy="49" r="2.6" fill={METAL_D} />
    </g>
  );
}
function Person() {
  return (
    <g>
      <circle cx="32" cy="24" r="9" fill={SKIN} stroke="#c79b74" strokeWidth="1.6" />
      <path d="M14 52c2-11 8.5-16 18-16s16 5 18 16z" fill={DARK} stroke={DARKER} strokeWidth="1.6" />
    </g>
  );
}
function Tech() {
  return (
    <g>
      <circle cx="32" cy="24" r="9" fill={SKIN} stroke="#c79b74" strokeWidth="1.6" />
      <path d="M23 20a9 9 0 0 1 18 0z" fill={RED} />
      <path d="M14 52c2-11 8.5-16 18-16s16 5 18 16z" fill="#4a5568" stroke={DARKER} strokeWidth="1.6" />
    </g>
  );
}
function Amp() {
  return (
    <g>
      <rect x="12" y="14" width="40" height="36" rx="4" fill="#5b4632" stroke={WOOD_D} strokeWidth="2" />
      <rect x="16" y="26" width="32" height="20" rx="2" fill={DARKER} />
      <path d="M16 26h32M16 32h32M16 38h32" stroke="#454851" strokeWidth="1.4" />
      <circle cx="20" cy="20" r="2" fill={METAL} />
      <circle cx="27" cy="20" r="2" fill={METAL} />
      <circle cx="34" cy="20" r="2" fill={METAL} />
    </g>
  );
}
function Riser() {
  return (
    <g>
      <rect x="6" y="14" width="52" height="36" rx="3" fill="none" stroke={METAL_D} strokeWidth="2.6" strokeDasharray="7 4" />
      <text x="32" y="36" textAnchor="middle" fontSize="10" fontWeight="700" fill={METAL_D} fontFamily="Inter,sans-serif">TARIMA</text>
    </g>
  );
}
function StageTable() {
  return (
    <g>
      <rect x="10" y="20" width="44" height="24" rx="3" fill={WOOD} stroke={WOOD_D} strokeWidth="2" />
      <rect x="14" y="24" width="36" height="16" rx="2" fill="none" stroke={WOOD_D} strokeWidth="1.2" opacity="0.5" />
    </g>
  );
}
function PowerDrop() {
  return (
    <g>
      <circle cx="32" cy="32" r="15" fill="#f2c94c" stroke="#b08b1e" strokeWidth="2.4" />
      <path d="M35 20l-9 14h6l-3 10 10-15h-6z" fill={DARKER} />
    </g>
  );
}

export const STAGE_LIBRARY: StageCategory[] = [
  {
    id: "percussio", label: "Percussió", color: "#e0913f",
    items: [
      { kind: "drumkit", label: "Bateria", svg: <Drumkit />, defaultScale: 1.6 },
      { kind: "cajon", label: "Caixó", svg: <Cajon /> },
      { kind: "congas", label: "Congues", svg: <Congas /> },
      { kind: "timbal", label: "Timbal", svg: <Timbal /> },
    ],
  },
  {
    id: "cordes", label: "Cordes", color: "#5aa869",
    items: [
      { kind: "electric-guitar", label: "Guitarra elèctrica", svg: <ElectricGuitar /> },
      { kind: "acoustic-guitar", label: "Guitarra acústica", svg: <AcousticGuitar /> },
      { kind: "bass", label: "Baix", svg: <Bass /> },
      { kind: "violin", label: "Violí", svg: <Violin /> },
    ],
  },
  {
    id: "teclats", label: "Teclats", color: "#5a7fd6",
    items: [{ kind: "keyboard", label: "Teclat", svg: <Keyboard />, defaultScale: 1.3 }],
  },
  {
    id: "vent", label: "Vent", color: "#c8a13f",
    items: [
      { kind: "sax", label: "Saxo", svg: <Sax /> },
      { kind: "trumpet", label: "Trompeta", svg: <Trumpet /> },
      { kind: "flute", label: "Flauta", svg: <Flute /> },
    ],
  },
  {
    id: "micros", label: "Micros i DI", color: "#a86bc9",
    items: [
      { kind: "mic", label: "Peu de micro", svg: <MicStand /> },
      { kind: "wireless", label: "Micro sense fils", svg: <Wireless /> },
      { kind: "di", label: "Caixa DI", svg: <DiBox />, defaultScale: 0.8 },
    ],
  },
  {
    id: "audio", label: "Àudio", color: "#d65a76",
    items: [
      { kind: "wedge", label: "Monitor cunya", svg: <Wedge /> },
      { kind: "pa", label: "Altaveu PA", svg: <PaSpeaker />, defaultScale: 1.2 },
      { kind: "mixer", label: "Taula de so", svg: <Mixer />, defaultScale: 1.2 },
      { kind: "iem", label: "In-ear (petaca)", svg: <Iem />, defaultScale: 0.8 },
      { kind: "amp", label: "Amplificador", svg: <Amp /> },
    ],
  },
  {
    id: "persones", label: "Persones", color: "#6bc9b8",
    items: [
      { kind: "person", label: "Músic", svg: <Person /> },
      { kind: "tech", label: "Tècnic", svg: <Tech /> },
    ],
  },
  {
    id: "escenari", label: "Escenari", color: "#9aa0b5",
    items: [
      { kind: "riser", label: "Tarima", svg: <Riser />, defaultScale: 1.6 },
      { kind: "table", label: "Taula", svg: <StageTable /> },
      { kind: "power", label: "Presa de corrent", svg: <PowerDrop />, defaultScale: 0.7 },
    ],
  },
];

const KIND_MAP: Record<string, StageKindDef> = {};
STAGE_LIBRARY.forEach((cat) => cat.items.forEach((it) => { KIND_MAP[it.kind] = it; }));

export function stageKindDef(kind: string): StageKindDef {
  return KIND_MAP[kind] || KIND_MAP["person"];
}

export function StageItemSvg({ kind, size = 44 }: { kind: string; size?: number }) {
  const def = stageKindDef(kind);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block" }}>
      {def.svg}
    </svg>
  );
}
