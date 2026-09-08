"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Contact } from "@/lib/types";

// Camp de "Nom" de contacte amb suggeriments: mostra sota l'input els
// contactes ja desats a l'agència (full de ruta, informació general...)
// que coincideixin pel nom, i en triar-ne un omple la resta de camps que
// el component pare li passi. Es porta com a portal a document.body (com
// el selector de vehicles) perquè cap secció on s'utilitza aquest camp
// quedi tallada per un ancestor amb overflow:hidden.
export default function ContactAutocomplete({
  value,
  onNameChange,
  onPick,
  contacts,
  placeholder = "Nom",
  className = "field-input",
}: {
  value: string;
  onNameChange: (v: string) => void;
  onPick: (contact: Contact) => void;
  contacts: Contact[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);

  function updatePos() {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  const q = value.trim().toLowerCase();
  const matches = (q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts).slice(0, 8);

  return (
    <>
      <input
        ref={inputRef}
        className={className}
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => { onNameChange(e.target.value); updatePos(); setOpen(true); }}
        onFocus={() => { updatePos(); setOpen(true); }}
      />
      {open && mounted && pos && matches.length > 0 && createPortal(
        <>
          <div className="year-picker-overlay" onClick={() => setOpen(false)}></div>
          <div
            className="year-dropdown cf-band-dropdown contact-ac-list"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: Math.max(pos.width, 230) }}
            onClick={(e) => e.stopPropagation()}
          >
            {matches.map((c) => (
              <button
                type="button"
                key={c.id}
                className="year-option contact-ac-item"
                onClick={() => { onPick(c); setOpen(false); }}
              >
                <span className="contact-ac-name">{c.name}</span>
                {(c.role || c.company || c.phone) && (
                  <span className="contact-ac-meta">{[c.role, c.company, c.phone].filter(Boolean).join(" · ")}</span>
                )}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
