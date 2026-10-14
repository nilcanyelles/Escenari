"use client";

import { useState } from "react";
import type { Band, Concert } from "@/lib/types";
import ShareMonthModal from "@/components/ShareMonthModal";

// Mateix botó "Comparteix" que té el gestor a /agenda (obre el mateix
// ShareMonthModal, amb l'opció de compartir els propers concerts a l'story)
// — els músics no tenien cap manera d'arribar-hi.
export default function ArtistAgendaShareButton({ bands, concerts, today }: { bands: Band[]; concerts: Concert[]; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-outline agenda-kpi-share" style={{ marginBottom: 14 }} onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "-3px" }}>
          <rect x="3" y="3" width="18" height="18" rx="4"></rect>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"></circle>
          <path d="M21 15l-5-5L5 21"></path>
        </svg>
        Comparteix
      </button>
      {open && <ShareMonthModal bands={bands} concerts={concerts} today={today} onClose={() => setOpen(false)} />}
    </>
  );
}
