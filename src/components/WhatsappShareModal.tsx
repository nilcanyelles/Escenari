"use client";

import { useState } from "react";
import type { Concert } from "@/lib/types";
import { capitalize, formatDateLong } from "@/lib/format";

export default function WhatsappShareModal({ concert, onClose }: { concert: Concert; onClose: () => void }) {
  const [text, setText] = useState(
    () => `Acabem de tancar una actuació amb ${concert.bandName} pel ${capitalize(formatDateLong(concert.date))} a ${concert.city}! Confirmeu l'assistència a través de l'Escenari (enllaç per a confirmar assistència)`
  );

  function handleShare() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Comparteix per WhatsApp</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <textarea className="wa-share-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={6} />
          <button type="button" className="btn-save" onClick={handleShare}>Obrir WhatsApp</button>
        </div>
      </div>
    </div>
  );
}
