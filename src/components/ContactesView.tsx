"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Contact, ContactKind } from "@/lib/types";
import { deleteContactAction } from "@/app/(app)/contactes/actions";
import { splitInstruments } from "@/lib/tags";
import { instrumentIconKey } from "@/lib/instruments";
import { InstrumentIcon } from "@/components/InstrumentPicker";
import { CrewRoleSvg, crewRoleIconKey } from "@/lib/crewRoles";
import ContactModal from "@/components/ContactModal";
import MemberProfileModal from "@/components/MemberProfileModal";
import ContactFollowups from "@/components/ContactFollowups";
import type { ContactInteraction } from "@/lib/contacts-data";
import { normalize } from "@/lib/text";

const PAGE_SIZE = 50;

const KIND_META: Record<ContactKind, { label: string; hue: number }> = {
  grup: { label: "Artista", hue: 290 },
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

// Membre trobat als grups amb aquest nom: instruments (músic) o funcions
// (crew), combinats de tots els grups on toca — mateixa lògica que la fitxa
// de perfil, perquè les bombolles concordin amb el que es veu allà.
function bandBadgesFor(name: string, allBands: Band[]) {
  const instruments: string[] = [];
  const functions: string[] = [];
  const bandNames: string[] = [];
  const seenI: Record<string, boolean> = {};
  const seenF: Record<string, boolean> = {};
  const seenB: Record<string, boolean> = {};
  let inBands = false;
  let isMusician = false;
  let isCrew = false;
  allBands.forEach((b) => {
    let inThisBand = false;
    (b.members || []).forEach((p) => {
      if (p.name !== name) return;
      inBands = true; inThisBand = true; isMusician = true;
      const list = p.instruments && p.instruments.length ? p.instruments : splitInstruments(p.role);
      list.forEach((i) => { const k = i.toLowerCase(); if (!seenI[k]) { seenI[k] = true; instruments.push(i); } });
    });
    (b.crew || []).forEach((p) => {
      if (p.name !== name) return;
      inBands = true; inThisBand = true; isCrew = true;
      splitInstruments(p.role).forEach((fn) => { const k = fn.toLowerCase(); if (!seenF[k]) { seenF[k] = true; functions.push(fn); } });
    });
    if (inThisBand) {
      const k = b.name.toLowerCase();
      if (!seenB[k]) { seenB[k] = true; bandNames.push(b.name); }
    }
  });
  return { inBands, isMusician, isCrew, instruments, functions, bandNames };
}

export default function ContactesView({ contacts, allBands, concertCountByPerson, interactions = [] }: { contacts: Contact[]; allBands: Band[]; concertCountByPerson: Record<string, number>; interactions?: ContactInteraction[] }) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"tots" | ContactKind>("tots");
  const [openId, setOpenId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const badgesByName = useMemo(() => {
    const map: Record<string, ReturnType<typeof bandBadgesFor>> = {};
    contacts.forEach((c) => {
      if (c.kinds.includes("grup")) map[c.name] = bandBadgesFor(c.name, allBands);
    });
    return map;
  }, [contacts, allBands]);

  // Cerca sense distingir accents ni majúscules.
  const q = normalize(search.trim());
  const list = contacts.filter((c) => {
    if (kindFilter !== "tots" && !c.kinds.includes(kindFilter)) return false;
    if (!q) return true;
    const info = badgesByName[c.name];
    const typeLabels = c.kinds.includes("grup")
      ? [info?.isMusician && "artista", info?.isCrew && "crew"].filter(Boolean).join(" ")
      : c.kinds.map((k) => KIND_META[k]?.label || k).join(" ");
    return (
      normalize(c.name).includes(q) ||
      normalize(c.company).includes(q) ||
      normalize(c.phone).includes(q) ||
      normalize(c.email).includes(q) ||
      normalize(c.role).includes(q) ||
      normalize(typeLabels).includes(q) ||
      (info?.instruments.some((i) => normalize(i).includes(q)) ?? false) ||
      (info?.functions.some((f) => normalize(f).includes(q)) ?? false) ||
      (info?.bandNames.some((b) => normalize(b).includes(q)) ?? false)
    );
  });

  useEffect(() => { setVisible(PAGE_SIZE); }, [search, kindFilter]);

  const openContact = openId ? contacts.find((c) => c.id === openId) || null : null;

  function openRow(c: Contact) {
    const info = badgesByName[c.name];
    if (c.kinds.includes("grup") && info?.inBands) setProfileName(c.name);
    else setOpenId(c.id);
  }

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glow-blooms" aria-hidden="true"></div>
      <ContactFollowups contacts={contacts} interactions={interactions} />
      <div className="filter-bar contactes-filterbar">
        <input className="input search" type="text" placeholder="Cerca nom, instrument, tipus, grup, empresa, telèfon, correu…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <div>Nom</div><div>Tipus</div><div>Instrument/càrrec</div><div>Grup/Empresa</div><div>Telèfon</div><div>Correu</div><div></div>
          </div>
          <div className="table-wrap no-clip">
            {list.slice(0, visible).map((c) => {
              const info = badgesByName[c.name];
              return (
                <div key={c.id} className="t-row contactes-cols clickable" onClick={() => openRow(c)}>
                  <div className="t-strong">{c.name}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {c.kinds.includes("grup") ? (
                      <>
                        {info?.isMusician && <span className="badge" style={{ background: `oklch(0.72 0.14 290 / 0.16)`, color: `oklch(0.75 0.14 290)` }}>Artista</span>}
                        {info?.isCrew && <span className="badge" style={{ background: `oklch(0.8 0.14 70 / 0.2)`, color: `oklch(0.75 0.16 70)` }}>Crew</span>}
                        {!info?.isMusician && !info?.isCrew && <span className="badge" style={{ background: `oklch(0.72 0.14 290 / 0.16)`, color: `oklch(0.75 0.14 290)` }}>Artista</span>}
                      </>
                    ) : (
                      c.kinds.map((k) => {
                        const meta = KIND_META[k] || { label: k, hue: 258 };
                        return <span key={k} className="badge" style={{ background: `oklch(0.72 0.14 ${meta.hue} / 0.16)`, color: `oklch(0.75 0.14 ${meta.hue})` }}>{meta.label}</span>;
                      })
                    )}
                  </div>
                  <div className="t-dim" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    {info?.instruments.length || info?.functions.length ? (
                      <>
                        {info.instruments.map((instr, i) => (
                          <span key={"i" + i} className="badge instrument-badge sm">
                            <InstrumentIcon name={instr} icon={instrumentIconKey(instr)} />
                            {instr}
                          </span>
                        ))}
                        {info.functions.map((fn, i) => (
                          <span key={"f" + i} className="badge instrument-badge crew-badge sm">
                            <CrewRoleSvg icon={crewRoleIconKey(fn)} size={14} />
                            {fn}
                          </span>
                        ))}
                      </>
                    ) : (c.role || c.company || "—")}
                  </div>
                  <div className="t-dim">
                    {c.kinds.includes("grup")
                      ? (info?.bandNames.length ? info.bandNames.join(", ") : "—")
                      : (c.company || "—")}
                  </div>
                  <div className="t-dim" onClick={(e) => e.stopPropagation()}>
                    {c.phone ? <a className="quick-link" href={`tel:${c.phone.replace(/\s/g, "")}`} title="Truca">{c.phone}</a> : "—"}
                  </div>
                  <div className="t-dim" onClick={(e) => e.stopPropagation()}>
                    {c.email ? <a className="quick-link" href={`mailto:${c.email}`} title="Escriu un correu">{c.email}</a> : "—"}
                  </div>
                  <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {c.address && (
                      <a className="row-rs-btn" style={{ textDecoration: "none" }} title={`Mapa: ${c.address}`}
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer">🗺</a>
                    )}
                    <DeleteContactBtn id={c.id} />
                  </div>
                </div>
              );
            })}
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

      {profileName && (
        <MemberProfileModal
          key={profileName}
          name={profileName}
          allBands={allBands}
          concertCountByPerson={concertCountByPerson}
          onClose={() => setProfileName(null)}
          onRenamed={(newName) => setProfileName(newName)}
        />
      )}
      {openContact && <ContactModal key={openContact.id} contact={openContact} onClose={() => setOpenId(null)} />}
      {creating && <ContactModal key="new" contact={null} onClose={() => setCreating(false)} />}
    </div>
  );
}
