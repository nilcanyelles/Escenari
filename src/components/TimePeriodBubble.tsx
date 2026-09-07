"use client";

import { timePeriodFor, nextTimePeriodValue } from "@/lib/format";

// Icona pròpia per a cada tram del dia — un sol que va pujant i baixant
// per l'horitzó a mesura que avança el cicle, i la lluna per a la matinada.
// Fitxer propi (no dins ConcertDetailView ni CalendariView) perquè el fan
// servir tots dos, i entre ells ja hi ha una dependència en l'altre sentit
// (CalendariView importa NewEventButton) que provocaria un cicle.
export function TimePeriodIcon({ period }: { period: string }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (period === "Matí") return (
    <svg {...common}><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="2" x2="12" y2="9"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line><line x1="23" y1="22" x2="1" y2="22"></line><polyline points="8 6 12 2 16 6"></polyline></svg>
  );
  if (period === "Migdia") return (
    <svg {...common}><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
  );
  if (period === "Tarda") return (
    <svg {...common}><circle cx="9" cy="9" r="3.2"></circle><line x1="9" y1="2.5" x2="9" y2="4"></line><line x1="3.9" y1="3.9" x2="4.9" y2="4.9"></line><line x1="2.5" y1="9" x2="4" y2="9"></line><path d="M5.5 20h11.5a3.7 3.7 0 0 0 .4-7.38A5.5 5.5 0 0 0 6.9 14.7 3.2 3.2 0 0 0 5.5 20z"></path></svg>
  );
  if (period === "Vespre") return (
    <svg {...common}><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="9" x2="12" y2="2"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line><line x1="23" y1="22" x2="1" y2="22"></line><polyline points="16 5 12 9 8 5"></polyline></svg>
  );
  // Matinada (i estat inicial sense hora encara triada).
  return <svg {...common}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>;
}

// Bombola de "Hora aproximada": cada clic fa cicle Matí → Migdia → Tarda →
// Vespre → Matinada → Matí… Per sota es desa una hora real representativa
// del tram (perquè ICS, contractes, factures i ordenació no s'hagin de
// tocar), però el que es veu i s'edita aquí és només el tram del dia.
export default function TimePeriodBubble({ time, onChange }: { time: string; onChange: (v: string) => void }) {
  const period = timePeriodFor(time);
  return (
    <button type="button" className="cd-time-bubble" onClick={() => onChange(nextTimePeriodValue(time))}>
      <TimePeriodIcon period={period || "Matinada"} />
      <span>{period || "Sense hora"}</span>
    </button>
  );
}
