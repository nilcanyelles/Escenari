"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Contact, ContactKind } from "@/lib/types";
import { deleteContactAction } from "@/app/(app)/contactes/actions";
import ContactModal from "@/components/ContactModal";

const PAGE_SIZE = 50;

const KIND_META: Record<ContactKind, { label: string; hue: number }> = {
  grup: { label: "Grup", hue: 290 },
  ruta: { label: "Full de ruta", hue: 220 },
  empresa: { label: "Empresa", hue: 155 },
};

function DeleteContactBtn({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="row-delete-btn"
      title="Eliminar contacte"
      aria-label="Eliminar contacte"
      onClick={async (e) => {
        e.stopPropagation();
        if (!confirm("Segur que vols eliminar aquest contacte?")) return;
        await deleteContactAction(id);
        router.refresh();
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  );
}

export default function ContactesView({ contacts }: { contacts: Contact[] }) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"tots" | ContactKind>("tots");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const q = search.trim().toLowerCase();
  const list = contacts.filter((c) => {
    if (kindFilter !== "tots" && !c.kinds.includes(kindFilter)) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q)
    );
  });

  useEffect(() => { setVisible(PAGE_SIZE); }, [search, kindFilter]);

  const openContact = openId ? contacts.find((c) => c.id === openId) || null : null;

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glow-blooms" aria-hidden="true"></div>
      <div className="filter-bar contactes-filterbar">
        <input className="input search" type="text" placeholder="Cerca nom, empresa, telèfon, correu…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "tots" | ContactKind)}>
          <option value="tots">Tots els contactes</option>
          <option value="grup">Músics i crew</option>
          <option value="ruta">Full de ruta</option>
          <option value="empresa">Empreses</option>
        </select>
        <button className="glow-cta" onClick={() => setCreating(true)}>+ Nou contacte</button>
      </div>

      {list.length ? (
        <div className="contactes-list">
          <div className="t-row t-head contactes-cols">
            <div>Nom</div><div>Tipus</div><div>Rol / Empresa</div><div>Telèfon</div><div>Correu</div><div></div>
          </div>
          <div className="table-wrap no-clip">
            {list.slice(0, visible).map((c) => (
              <div key={c.id} className="t-row contactes-cols clickable" onClick={() => setOpenId(c.id)}>
                <div className="t-strong">{c.name}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {c.kinds.map((k) => {
                    const meta = KIND_META[k] || { label: k, hue: 258 };
                    return <span key={k} className="badge" style={{ background: `oklch(0.72 0.14 ${meta.hue} / 0.16)`, color: `oklch(0.75 0.14 ${meta.hue})` }}>{meta.label}</span>;
                  })}
                </div>
                <div className="t-dim">{c.role || c.company || "—"}</div>
                <div className="t-dim">{c.phone || "—"}</div>
                <div className="t-dim">{c.email || "—"}</div>
                <div onClick={(e) => e.stopPropagation()}><DeleteContactBtn id={c.id} /></div>
              </div>
            ))}
          </div>
          {visible < list.length && (
            <button type="button" className="load-more-btn" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Mostra {Math.min(PAGE_SIZE, list.length - visible)} més ({list.length - visible} restants)
            </button>
          )}
        </div>
      ) : (
        <div className="empty-state">Cap contacte coincideix amb els filtres.</div>
      )}

      {openContact && <ContactModal key={openContact.id} contact={openContact} onClose={() => setOpenId(null)} />}
      {creating && <ContactModal key="new" contact={null} onClose={() => setCreating(false)} />}
    </div>
  );
}
