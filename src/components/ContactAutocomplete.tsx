"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Contact } from "@/lib/types";

// Camp de "Nom" de contacte amb suggeriments: mostra sota l'input els
// contactes ja desats a l'agència (full de ruta, informació general...)
// que coincideixin pel nom, i en triar-ne un omple la resta de camps que
// el component pare li passi. La font pot ser una llista local (dins
// l'app) o una cerca remota ("searchAction", al formulari públic). Si cap
// contacte coincideix exactament amb el que s'escriu, pot oferir crear-lo
// de nou ("onCreate"). Es porta com a portal a document.body (com el
// selector de vehicles) perquè cap secció on s'utilitza aquest camp quedi
// tallada per un ancestor amb overflow:hidden.
export default function ContactAutocomplete({
  value,
  onNameChange,
  onPick,
  contacts = [],
  searchAction,
  onCreate,
  placeholder = "Nom",
  className = "field-input",
}: {
  value: string;
  onNameChange: (v: string) => void;
  onPick: (contact: Contact) => void;
  contacts?: Contact[];
  // Font remota: es consulta en escriure (mínim 2 lletres), en comptes de
  // filtrar la llista local.
  searchAction?: (q: string) => Promise<Contact[]>;
  // "Crea «nom» com a contacte nou" quan cap resultat coincideix exactament.
  onCreate?: (name: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [remote, setRemote] = useState<Contact[]>([]);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  function updatePos() {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  const q = value.trim().toLowerCase();

  useEffect(() => {
    if (!searchAction) return;
    if (timer.current) window.clearTimeout(timer.current);
    if (q.length < 2) { setRemote([]); return; }
    const current = value.trim();
    timer.current = window.setTimeout(async () => {
      const r = await searchAction(current);
      setRemote(r);
    }, 250);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [value, q, searchAction]);

  const matches = (searchAction ? remote : (q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts)).slice(0, 8);
  const exact = matches.some((c) => c.name.trim().toLowerCase() === q);
  const showCreate = !!onCreate && q.length >= 2 && !exact;
  const showList = open && mounted && pos && (matches.length > 0 || showCreate);

  async function create() {
    if (!onCreate) return;
    setCreating(true);
    try { await onCreate(value.trim()); } finally { setCreating(false); setOpen(false); }
  }

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
      {showList && createPortal(
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
            {showCreate && (
              <button type="button" className="year-option contact-ac-item contact-ac-create" disabled={creating} onClick={create}>
                <span className="contact-ac-name">＋ Crea «{value.trim()}» com a contacte nou</span>
                <span className="contact-ac-meta">{creating ? "Creant…" : "Es desa a Contactes de l'agència"}</span>
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
