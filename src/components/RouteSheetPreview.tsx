"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Concert } from "@/lib/types";
import RouteSheetPreviewDoc from "@/components/RouteSheetPreviewDoc";

export default function RouteSheetPreview({ concert, onClose, onEdit }: { concert: Concert; onClose: () => void; onEdit: () => void }) {
  // Penjat de <body> via portal: en imprimir, el CSS de @media print amaga
  // tots els altres fills de <body> i deixa només aquest overlay, així no
  // queda cap pàgina en blanc abans/després (la resta de l'app ja no ocupa
  // espai al flux, en comptes de només quedar invisible).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide rs-doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rs-doc-top-toolbar">
          <div className="spacer"></div>
          <button type="button" className="rs-doc-icon-btn" title="Edita" onClick={onEdit}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
          <button type="button" className="rs-doc-icon-btn" title="Descarrega en PDF" onClick={() => window.print()}>
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></polyline>
              <text x="12" y="17.5" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="currentColor" stroke="none" fontFamily="Arial,sans-serif">PDF</text>
            </svg>
          </button>
          <button type="button" className="rs-doc-icon-btn" title="Tanca" onClick={onClose}>✕</button>
        </div>
        <div className="rs-doc-scroll">
          <RouteSheetPreviewDoc concert={concert} />
        </div>
      </div>
    </div>,
    document.body
  );
}
