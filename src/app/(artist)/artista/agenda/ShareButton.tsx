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
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        Comparteix
      </button>
      {open && <ShareMonthModal bands={bands} concerts={concerts} today={today} onClose={() => setOpen(false)} />}
    </>
  );
}
