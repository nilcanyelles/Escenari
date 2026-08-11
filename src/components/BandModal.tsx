"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Band, Person } from "@/lib/types";
import { bandPhotoDataUri } from "@/lib/tags";
import { saveBandAction } from "@/app/(app)/grups/actions";

type Bf = {
  name: string;
  tags: string[];
  city: string;
  rate: string;
  contact: string;
  phone: string;
  members: Person[];
  crew: Person[];
};

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}

export default function BandModal({ band, onClose }: { band: Band; onClose: () => void }) {
  const router = useRouter();
  const [bf, setBf] = useState<Bf>({
    name: band.name, tags: (band.tags || []).slice(), city: band.city, rate: String(band.rate),
    contact: band.contact, phone: band.phone,
    members: (band.members || []).map((p) => ({ name: p.name, role: p.role })),
    crew: (band.crew || []).map((p) => ({ name: p.name, role: p.role })),
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await saveBandAction({ id: band.id, ...bf });
    router.refresh();
    setSaving(false);
    onClose();
  }

  function personRow(listName: "members" | "crew", i: number, p: Person) {
    return (
      <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Nom" value={p.name}
          onChange={(e) => setBf((prev) => { const list = [...prev[listName]]; list[i] = { ...list[i], name: e.target.value }; return { ...prev, [listName]: list }; })} />
        <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Instrument/funció" value={p.role}
          onChange={(e) => setBf((prev) => { const list = [...prev[listName]]; list[i] = { ...list[i], role: e.target.value }; return { ...prev, [listName]: list }; })} />
        <button type="button" className="rs-mini-btn danger" title="Elimina"
          onClick={() => setBf((prev) => ({ ...prev, [listName]: prev[listName].filter((_, idx) => idx !== i) }))}>
          <XIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide band-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="band-modal-head" style={{ backgroundImage: `linear-gradient(180deg, rgba(10,10,15,0.2), rgba(10,10,15,0.8)), url("${bandPhotoDataUri(band)}")` }}>
          <div style={{ width: "100%" }}>
            <input className="field-input" style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 17, fontWeight: 700, background: "oklch(1 0 0 / 0.12)", borderColor: "transparent", color: "#fff" }}
              type="text" value={bf.name} onChange={(e) => setBf((prev) => ({ ...prev, name: e.target.value }))} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
              {bf.tags.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="field-input" style={{ width: 110, padding: "6px 8px", fontSize: 12 }} type="text" placeholder="Etiqueta" value={t}
                    onChange={(e) => setBf((prev) => { const tags = [...prev.tags]; tags[i] = e.target.value; return { ...prev, tags }; })} />
                  <button type="button" className="rs-mini-btn danger" title="Elimina"
                    onClick={() => setBf((prev) => ({ ...prev, tags: prev.tags.filter((_, idx) => idx !== i) }))}>
                    <XIcon />
                  </button>
                </div>
              ))}
              <button type="button" className="rs-add-btn" style={{ color: "#fff", alignSelf: "center", marginTop: 0 }}
                onClick={() => setBf((prev) => ({ ...prev, tags: [...prev.tags, ""] }))}>+ Etiqueta</button>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <div className="form-row">
            <div><label className="form-label">Ciutat</label><input className="field-input form-field" type="text" value={bf.city} onChange={(e) => setBf((prev) => ({ ...prev, city: e.target.value }))} /></div>
            <div><label className="form-label">Catxet (€)</label><input className="field-input form-field" type="text" inputMode="numeric" value={bf.rate} onChange={(e) => setBf((prev) => ({ ...prev, rate: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div><label className="form-label">Contacte</label><input className="field-input form-field" type="text" value={bf.contact} onChange={(e) => setBf((prev) => ({ ...prev, contact: e.target.value }))} /></div>
            <div><label className="form-label">Telèfon</label><input className="field-input form-field" type="text" value={bf.phone} onChange={(e) => setBf((prev) => ({ ...prev, phone: e.target.value }))} /></div>
          </div>
          <div>
            <label className="form-label">Músics</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {bf.members.map((p, i) => personRow("members", i, p))}
            </div>
            <button type="button" className="rs-add-btn" style={{ marginTop: 8 }}
              onClick={() => setBf((prev) => ({ ...prev, members: [...prev.members, { name: "", role: "" }] }))}>+ Afegeix músic</button>
          </div>
          <div>
            <label className="form-label">Crew</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {bf.crew.map((p, i) => personRow("crew", i, p))}
            </div>
            <button type="button" className="rs-add-btn" style={{ marginTop: 8 }}
              onClick={() => setBf((prev) => ({ ...prev, crew: [...prev.crew, { name: "", role: "" }] }))}>+ Afegeix crew</button>
          </div>
          <div className="modal-actions">
            <div className="spacer"></div>
            <button className="btn-outline" onClick={onClose}>Cancel·lar</button>
            <button className="btn-save" disabled={saving} onClick={handleSave}>Desar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
