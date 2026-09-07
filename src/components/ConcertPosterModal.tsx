"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Concert, Band } from "@/lib/types";
import ConcertPosterEditor from "@/components/ConcertPosterEditor";

// Embolcall en modal de l'editor del pòster (ConcertPosterEditor) — es fa
// servir a tots els llocs on el pòster s'obre com a finestra flotant (vista
// del dia de bolo, fitxa del concert...). A la targeta "Proper concert"
// d'Inici, en canvi, l'editor s'incrusta directament dins la targeta
// (sense aquest embolcall) perquè hi quedi integrat.
export default function ConcertPosterModal({ concert, band, onClose }: { concert: Concert; band: Band | null; onClose: () => void }) {
  // Penjat de <body> via portal: obert des d'una targeta amb efecte
  // d'inclinació en passar-hi el ratolí (BentoGrid, transform per GSAP),
  // "position: fixed" queda atrapat dins de qualsevol avantpassat amb
  // "transform" en comptes del viewport — sense portal, l'overlay es
  // quedava enganxat (i es movia amb el scroll) dins de la pròpia targeta.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-month-modal" onClick={(e) => e.stopPropagation()}>
        <ConcertPosterEditor concert={concert} band={band} onClose={onClose} />
      </div>
    </div>,
    document.body
  );
}
