"use client";

import { useEffect } from "react";

// Diàleg de confirmació propi (mai el confirm() del navegador), amb el
// mateix aspecte que els de ConcertModal (.cf-confirm-*). "danger" pinta
// el botó de confirmar en vermell (eliminar, treure...).
export default function ConfirmDialog({ title, message, confirmLabel = "Elimina", cancelLabel = "Cancel·la", danger = true, busy = false, onConfirm, onCancel }: {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="modal-overlay cf-confirm-overlay" onClick={(e) => { e.stopPropagation(); if (!busy) onCancel(); }}>
      <div className="modal cf-confirm-modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {title && <div className="cf-confirm-title">{title}</div>}
        <div className="cf-confirm-message">{message}</div>
        <div className="modal-actions cf-confirm-actions">
          <button type="button" className="btn-outline" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
          {/* Sense autofocus al botó de confirmar: un Enter distret no ha
              d'eliminar res. */}
          <button type="button" className={danger ? "btn-danger-outline" : "btn-save"} disabled={busy} onClick={onConfirm}>
            {busy ? "Un moment…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
