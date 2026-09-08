"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Concert, Band } from "@/lib/types";
import RouteSheetPreview from "@/components/RouteSheetPreview";
import ConcertPosterModal from "@/components/ConcertPosterModal";
import { InstagramIcon } from "@/components/SocialIcons";
import { createAttendanceLinkAction } from "@/app/conf/actions";

function FdrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <text x="12" y="17.5" textAnchor="middle" fontSize="6.3" fontWeight="700" fontFamily="Inter,sans-serif" stroke="none" fill="currentColor">FDR</text>
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
  );
}

// Botons de compartir del bolo: descarregar el full de ruta (amb el seu
// propi botó d'imprimir) i compartir — que desplega un petit menú amb dues
// maneres de compartir: el cartell d'Instagram (obre el generador de
// sempre) o un WhatsApp amb un missatge fet i l'enllaç públic de "confirma
// l'assistència" (el mateix que ja es fa servir des de la fitxa del
// concert), perquè qui el rebi vegi els detalls sense necessitat de compte.
// Es fa servir tant a la vista del dia de bolo com a la targeta "Proper
// concert" d'Inici — "iconBtnClass" i "base" deixen que cada lloc hi
// encaixi el seu propi estil de botó i les seves pròpies rutes (l'àrea
// d'artista viu sota "/artista"). "onInstagramClick", si es dona, substitueix
// l'obertura del modal del pòster (útil quan qui crida el vol incrustar
// tal qual en comptes de com a finestra flotant — la targeta "Proper
// concert").
export default function DiaTopActions({ concert, band, iconBtnClass = "dia-top-icon-btn", base = "", onInstagramClick }: {
  concert: Concert; band: Band | null; iconBtnClass?: string; base?: string; onInstagramClick?: () => void;
}) {
  const router = useRouter();
  const [rsOpen, setRsOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [waText, setWaText] = useState("");
  const shareWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (shareWrapRef.current && !shareWrapRef.current.contains(e.target as Node)) setShareMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [shareMenuOpen]);

  // Prepara el missatge per defecte i l'obre en un editor abans d'enviar-lo
  // — mai directe a WhatsApp, perquè es pugui retocar el text primer.
  async function openWhatsAppEditor() {
    setShareMenuOpen(false);
    setWaBusy(true);
    let token = concert.attToken || "";
    if (!token) {
      const r = await createAttendanceLinkAction(concert.id);
      token = r.token;
    }
    setWaBusy(false);
    const city = (concert.city || "").split(",")[0];
    setWaText(`Tot a punt per l'actuació de ${concert.bandName} a ${city}. Clica a l'enllaç per veure els detalls: ${window.location.origin}/conf/${token}`);
  }
  function sendWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, "_blank");
    setWaText("");
  }

  return (
    <>
      <div className="dia-top-actions">
        <button type="button" className={iconBtnClass} title="Full de ruta" onClick={() => setRsOpen(true)}><FdrIcon /></button>
        <div className="dia-share-wrap" ref={shareWrapRef}>
          <button type="button" className={iconBtnClass} title="Comparteix" onClick={() => setShareMenuOpen((v) => !v)}><ShareIcon /></button>
          {shareMenuOpen && (
            <div className="dia-share-menu">
              <button type="button" className="dia-share-menu-item" onClick={() => { setShareMenuOpen(false); if (onInstagramClick) onInstagramClick(); else setPosterOpen(true); }}>
                <InstagramIcon /> Instagram
              </button>
              <button type="button" className="dia-share-menu-item" disabled={waBusy} onClick={openWhatsAppEditor}>
                <WhatsAppIcon /> {waBusy ? "Preparant…" : "WhatsApp"}
              </button>
            </div>
          )}
        </div>
      </div>
      {rsOpen && (
        <RouteSheetPreview concert={concert} onClose={() => setRsOpen(false)} onEdit={() => router.push(`${base}/concerts/${concert.id}`)} />
      )}
      {posterOpen && (
        <ConcertPosterModal concert={concert} band={band} onClose={() => setPosterOpen(false)} />
      )}
      {waText && createPortal(
        <div className="modal-overlay" onClick={() => setWaText("")}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <div className="modal-title">Missatge per WhatsApp</div>
              <button type="button" className="modal-close" onClick={() => setWaText("")}>✕</button>
            </div>
            <textarea className="field-input rider-textarea" rows={5} value={waText} onChange={(e) => setWaText(e.target.value)} autoFocus />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" className="btn-outline" onClick={() => setWaText("")}>Cancel·la</button>
              <button type="button" className="btn-save" onClick={sendWhatsApp}>Obre WhatsApp</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
