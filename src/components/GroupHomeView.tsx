"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Band, Concert } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { tagColors, bandPhotoDataUri, personPhotoDataUri, personPhotoDataUriColored, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import type { LinkedMember, BackupRequest } from "@/lib/group-data";
import type { Rider, Setlist, BandEditor } from "@/lib/material-types";
import type { Song, BandFile } from "@/lib/songs";
import { saveBandBackupsAction, setBackupRequestStatusAction, respondBackupApplicationAction, addBandPersonAction, removeBandPersonAction, invitePersonAction, setMemberPermAction, type BackupPerson } from "@/app/(app)/grup/actions";
import { setMyAttendanceAction } from "@/app/(artist)/actions";
import { memberPerms, PERM_LABELS } from "@/lib/perms";
import type { MemberPerms } from "@/lib/types";
import GroupAppearanceModal from "@/components/GroupAppearanceModal";
import { RidersPanel, SetlistsPanel } from "@/components/MaterialPanels";
import SongsPanel from "@/components/SongsPanel";

import BentoGrid, { type BentoCard } from "@/components/BentoGrid";
import ChromaGrid, { type ChromaItem } from "@/components/ChromaGrid";
import { normalize } from "@/lib/text";
import { bandColor } from "@/lib/tags";
import type { Person } from "@/lib/types";
import { openPersonProfileAction } from "@/app/p/profile-actions";

// Fila de permisos que el gestor commuta a la targeta de cada membre: què
// pot crear (cançons, riders, setlists), si pot afegir gent i esdeveniments.
function PermsRow({ bandId, member }: { bandId: string; member: Person }) {
  const router = useRouter();
  const [perms, setPerms] = useState<MemberPerms>(() => memberPerms(member));
  return (
    <div className="perm-row" title="Què pot fer aquest membre">
      {PERM_LABELS.map(({ key, label }) => (
        <button
          key={key} type="button"
          className={"perm-chip" + (perms[key] ? " on" : "")}
          title={`${label}: ${perms[key] ? "permès (clic per treure)" : "no permès (clic per donar)"}`}
          onClick={async () => {
            const v = !perms[key];
            setPerms((p) => ({ ...p, [key]: v }));
            await setMemberPermAction(bandId, member.name, key, v);
            router.refresh();
          }}
        >{label}</button>
      ))}
    </div>
  );
}

// Targetes "chroma" per a l'equip: colors del grup, nom, instrument i @ estil
// Instagram; el clic obre la pàgina de perfil del músic.
function personChromaItem(
  p: Person,
  concertCount: number | null,
  band: Band,
  onOpen: (name: string) => void,
  photosByName: Record<string, string>,
  igByName: Record<string, string>,
  linked: boolean,
  onInvite?: (name: string) => void,
  footer?: React.ReactNode,
): ChromaItem {
  const realIg = igByName[normalize(p.name)] || "";
  const handle = "@" + (realIg || normalize(p.name).replace(/\s+/g, ""));
  const inss = instrumentsFor(p);
  const c1 = band.color1 || bandColor(band.id).color;
  const c2 = band.color2 || bandColor(band.id + "x").color;
  const photoId = photosByName[normalize(p.name)];

  // Trucar, WhatsApp i correu sempre visibles; sense dades, porten al perfil
  // (on el gestor o el músic poden afegir-les).
  const missing = (what: string) => () => {
    alert(`${p.name} encara no té ${what} desat — afegeix-lo des del seu perfil (Edita el perfil).`);
    onOpen(p.name);
  };
  const actions: ChromaItem["actions"] = [
    p.phone
      ? { icon: "📞", title: `Truca ${p.name}`, href: `tel:${p.phone.replace(/\s/g, "")}` }
      : { icon: "📞", title: "Sense telèfon — afegeix-lo al perfil", onClick: missing("el telèfon") },
    (p.whatsapp || p.phone)
      ? { icon: "💬", title: "WhatsApp", href: `https://wa.me/${(p.whatsapp || p.phone || "").replace(/[^\d]/g, "")}` }
      : { icon: "💬", title: "Sense telèfon — afegeix-lo al perfil", onClick: missing("el telèfon") },
    p.email
      ? { icon: "✉️", title: `Escriu a ${p.email}`, href: `mailto:${p.email}` }
      : { icon: "✉️", title: "Sense correu — afegeix-lo al perfil", onClick: missing("el correu") },
    { icon: "📸", title: `Instagram ${handle}`, href: `https://instagram.com/${handle.slice(1)}` },
  ];
  if (!linked && onInvite) actions.push({ icon: "🔗", title: "Convida a reclamar aquest perfil", onClick: () => onInvite(p.name) });

  return {
    image: photoId ? `/api/file/${photoId}` : personPhotoDataUriColored(p.name, c1, c2),
    title: p.name,
    subtitle: inss.length ? inss.slice(0, 2).join(", ") : p.role || "—",
    handle,
    location: concertCount !== null ? `${concertCount} concerts` : undefined,
    borderColor: c1,
    gradient: `linear-gradient(150deg, ${c1}, ${c2})`,
    onClick: () => onOpen(p.name),
    actions,
    footer,
  };
}

function InstrumentChips({ items }: { items: string[] }) {
  return (
    <div className="member-instruments">
      {items.slice(0, 3).map((ins) => {
        const icon = instrumentIconFor(ins);
        return (
          <span key={ins} className="member-instrument-chip" title={ins}>
            {icon && <img src={icon} alt="" />}
            {ins}
          </span>
        );
      })}
      {items.length > 3 && <span className="member-instrument-chip">+{items.length - 3}</span>}
    </div>
  );
}

export default function GroupHomeView({ band, allBands, concerts, linkedMembers, backupRequests, concertCountByPerson, riders, setlists, editors, songs, files, photosByName = {}, igByName = {}, viewer = "manager", caps, myName = "", today }: {
  band: Band;
  allBands: Band[];
  concerts: Concert[];
  linkedMembers: LinkedMember[];
  backupRequests: BackupRequest[];
  concertCountByPerson: Record<string, number>;
  riders: Rider[];
  setlists: Setlist[];
  editors: BandEditor[];
  songs: Song[];
  files: BandFile[];
  photosByName?: Record<string, string>;
  igByName?: Record<string, string>;
  viewer?: "manager" | "artist";
  caps?: MemberPerms;
  myName?: string;
  today: string;
}) {
  const router = useRouter();
  const isMgr = viewer === "manager";
  const base = isMgr ? "" : "/artista"; // rutes de l'àrea d'artista
  const can: MemberPerms = isMgr
    ? { songs: true, riders: true, setlists: true, members: true, events: true }
    : (caps || { songs: true, riders: true, setlists: true, members: false, events: false });
  const [tab, setTab] = useState<"inici" | "equip" | "cancons" | "riders" | "setlists">("inici");
  const [editOpen, setEditOpen] = useState(false);
  const [addKind, setAddKind] = useState<"member" | "crew" | null>(null);
  const [addForm, setAddForm] = useState({ name: "", instruments: "", role: "", phone: "", email: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [joinCopied, setJoinCopied] = useState(false);
  const [backups, setBackups] = useState<BackupPerson[]>(() =>
    ((band as unknown as { backups?: BackupPerson[] }).backups || []).map((b) => ({ name: b.name || "", instruments: b.instruments || [], phone: b.phone || "", email: b.email || "" }))
  );
  const [backupDraft, setBackupDraft] = useState<BackupPerson | null>(null);
  const [savingBackups, setSavingBackups] = useState(false);

  const total = concerts.filter((c) => c.status !== "cancel·lat").length;
  const upcoming = concerts.filter((c) => c.date >= today && c.status !== "cancel·lat");
  // KPI de ritme: mitjana de concerts per mes d'enguany.
  const yearStr = today.slice(0, 4);
  const yearCount = concerts.filter((c) => c.date.slice(0, 4) === yearStr && c.status !== "cancel·lat").length;
  const monthsElapsed = parseInt(today.slice(5, 7), 10);
  const concertsPerMonth = (yearCount / Math.max(1, monthsElapsed)).toFixed(1).replace(".", ",");
  const monthCount = concerts.filter((c) => c.date.slice(0, 7) === today.slice(0, 7) && c.status !== "cancel·lat").length;
  const linkedByName: Record<string, LinkedMember> = {};
  linkedMembers.forEach((m) => { linkedByName[m.memberName] = m; });

  const openRequests = backupRequests.filter((r) => r.status === "oberta");
  const concertsById: Record<string, Concert> = {};
  concerts.forEach((c) => { concertsById[c.id] = c; });

  // Obre la pàgina de perfil compartible de la persona.
  async function openProfile(name: string) {
    const { token } = await openPersonProfileAction(name);
    router.push(`/p/${token}`);
  }

  // Convida algú (per correu) a reclamar un perfil creat a mà.
  async function handleInvite(name: string) {
    const email = window.prompt(`Correu de ${name} perquè reclami aquest perfil quan es registri a Escenari:`);
    if (!email) return;
    const res = await invitePersonAction(band.id, name, email);
    alert(res.ok ? `Invitació creada: quan ${email} es registri i l'accepti, quedarà vinculat a "${name}".` : res.error);
    router.refresh();
  }

  async function handleAddPerson() {
    if (!addForm.name.trim() || !addKind) return;
    setAddSaving(true);
    try {
      await addBandPersonAction(band.id, addKind, {
        name: addForm.name,
        role: addForm.role,
        instruments: addForm.instruments.split(",").map((s) => s.trim()).filter(Boolean),
        phone: addForm.phone,
        email: addForm.email,
      });
      setAddForm({ name: "", instruments: "", role: "", phone: "", email: "" });
      setAddKind(null);
      router.refresh();
    } catch (err) {
      alert(String(err instanceof Error ? err.message : err));
    }
    setAddSaving(false);
  }

  const memberEmails = band.members.map((m) => m.email).filter(Boolean) as string[];
  const joinMsg = (rol: "membre" | "tècnic") =>
    `Uneix-te a ${band.name} a Escenari com a ${rol}: registra't a escenari i introdueix el codi ${band.joinCode} a "Els meus grups".`;

  async function persistBackups(next: BackupPerson[]) {
    setSavingBackups(true);
    setBackups(next);
    await saveBandBackupsAction(band.id, next);
    router.refresh();
    setSavingBackups(false);
  }

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      {/* Capçalera estil LinkedIn: portada ampla + logo superposat */}
      <div className="group-hero-li" style={{ ["--band-accent" as string]: band.color1 || "#8b7bff" }}>
        <div
          className="group-cover"
          style={{
            backgroundImage: band.coverUrl
              ? `url(${band.coverUrl})`
              : `linear-gradient(120deg, ${band.color1 || "#8b7bff"}, ${band.color2 || "#3b3358"})`,
          }}
        ></div>
        <div className="group-hero-li-row">
          <img className="group-hero-li-logo" src={band.logo || bandPhotoDataUri(band)} alt={band.name} />
          <div className="group-hero-li-main">
            <div className="group-hero-name">{band.name}</div>
            <div className="group-hero-tags">
              {(band.tags || []).map((t) => {
                const tc = tagColors(t);
                return <span key={t} className="badge" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
              })}
            </div>
          </div>
          <div className="group-hero-actions">
            {isMgr && <button type="button" className="btn-outline" onClick={() => setEditOpen(true)}>Edita el grup</button>}
          </div>
        </div>
      </div>

      {/* Subtabs */}
      <div className="stats-tabs group-tabs">
        <button className={"stats-tab" + (tab === "inici" ? " active" : "")} onClick={() => setTab("inici")}>Inici</button>
        <button className={"stats-tab" + (tab === "equip" ? " active" : "")} onClick={() => setTab("equip")}>Equip</button>
        <button className={"stats-tab" + (tab === "cancons" ? " active" : "")} onClick={() => setTab("cancons")}>Cançons</button>
        <button className={"stats-tab" + (tab === "riders" ? " active" : "")} onClick={() => setTab("riders")}>Riders</button>
        <button className={"stats-tab" + (tab === "setlists" ? " active" : "")} onClick={() => setTab("setlists")}>Setlists</button>

      </div>

      {tab === "inici" && (
        <BentoGrid
          cards={([
            {
              key: "membres",
              label: "Equip",
              title: `${band.members.length} integrants`,
              description: `${linkedMembers.length} amb compte d'Escenari${band.crew.length ? ` · ${band.crew.length} crew` : ""}`,
              colSpan: 2,
              rowSpan: 2,
              onClick: () => setTab("equip"),
              content: (
                <div className="bento-chroma">
                  <ChromaGrid
                    className="chroma-compact"
                    items={band.members.slice(0, 4).map((m) => personChromaItem(m, null, band, openProfile, photosByName, igByName, !!linkedByName[m.name]))}
                    columns={4}
                    cardWidth={104}
                    radius={150}
                  />
                </div>
              ),
            },
            {
              key: "bolos",
              label: "Agenda",
              title: `${upcoming.length} bolos a la vista`,
              description: `${total} concerts en total`,
              colSpan: 2,
              rowSpan: 2,
              onClick: () => router.push(base + "/agenda"),
              content: (
                <div className="bento-gigs">
                  {upcoming.slice(0, 5).map((c) => {
                    const myAns = myName ? (c.attendance || {})[myName] : undefined;
                    return (
                      <div key={c.id} className="bento-gig" onClick={(e) => { e.stopPropagation(); router.push(`${base}/concerts/${c.id}`); }}>
                        <span className="bento-gig-date">{formatDate(c.date)}</span>
                        <span className="bento-gig-place">{c.city || c.venue || "—"}{c.venue && c.city ? ` · ${c.venue}` : ""}</span>
                        {!isMgr && myName ? (
                          <span className="bento-gig-att" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button" className={"bento-att-btn yes" + (myAns === "yes" ? " active" : "")}
                              title="Hi seré"
                              onClick={async () => { await setMyAttendanceAction(c.id, "yes"); router.refresh(); }}
                            >✓</button>
                            <button
                              type="button" className={"bento-att-btn no" + (myAns === "no" ? " active" : "")}
                              title="No hi seré"
                              onClick={async () => { await setMyAttendanceAction(c.id, "no"); router.refresh(); }}
                            >✗</button>
                          </span>
                        ) : (
                          <span className="badge" style={{ marginLeft: "auto" }}>{c.status}</span>
                        )}
                      </div>
                    );
                  })}
                  {upcoming.length === 0 && <span className="t-dim" style={{ fontSize: 12.5 }}>Cap bolo programat.</span>}
                </div>
              ),
            },
            {
              key: "cancons",
              label: "Repertori",
              title: `${songs.length} cançons`,
              description: "Lletres, acords i gravacions",
              onClick: () => setTab("cancons"),
            },
            {
              key: "riders",
              label: "Tècnica",
              title: `${riders.length} riders`,
              description: "Plànol d'escenari i aprovacions",
              onClick: () => setTab("riders"),
            },
            {
              key: "setlists",
              label: "Directe",
              title: `${setlists.length} setlists`,
              description: "Amb mode escenari",
              onClick: () => setTab("setlists"),
            },
            {
              key: "ritme",
              label: "Ritme",
              title: `${concertsPerMonth} concerts/mes`,
              description: `${monthCount} aquest mes · mitjana d'enguany`,
              onClick: () => router.push(base + "/estadistiques"),
            },
          ] as BentoCard[])}
        />
      )}

      {tab === "cancons" && <SongsPanel band={band} songs={songs} canEdit={can.songs} />}

      {tab === "riders" && (
        <RidersPanel band={band} riders={riders} linkedMembers={linkedMembers} editors={editors} canEdit={can.riders} isManager={isMgr} />
      )}
      {tab === "setlists" && (
        <SetlistsPanel band={band} setlists={setlists} linkedMembers={linkedMembers} editors={editors} canEdit={can.setlists} isManager={isMgr} songs={songs} />
      )}

      {tab === "equip" && (<>
      {/* KPIs */}
      <div className="kpi-grid kpi-grid-4">
        <div className="card card-centered"><div className="card-title">Integrants</div><div className="card-value">{band.members.length}</div></div>
        <div className="card card-centered"><div className="card-title">Concerts totals</div><div className="card-value">{total}</div></div>
        <div className="card card-centered"><div className="card-title">Pròxims bolos</div><div className="card-value">{upcoming.length}</div></div>
        <div className="card card-centered"><div className="card-title">Suplents</div><div className="card-value">{backups.length}</div></div>
      </div>

      {/* Membres */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">Membres</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {memberEmails.length > 0 && (
              <a className="btn-outline" style={{ textDecoration: "none" }} title={`Correu a tot el grup (${memberEmails.length} adreces)`}
                href={`mailto:?bcc=${encodeURIComponent(memberEmails.join(","))}&subject=${encodeURIComponent(band.name)}`}>
                ✉️ Correu a tot el grup
              </a>
            )}
            {can.members && addKind !== "member" && <button type="button" className="btn-outline" onClick={() => setAddKind("member")}>+ Afegeix membre</button>}
          </div>
        </div>
        {band.members.length === 0 && addKind !== "member" ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Aquest grup encara no té membres — afegeix-ne amb el botó de dalt.</div>
        ) : (
          band.members.length > 0 && (
            <ChromaGrid
              items={band.members.map((m) => personChromaItem(
                m, concertCountByPerson[m.name] || 0, band, openProfile, photosByName, igByName,
                !!linkedByName[m.name], isMgr ? handleInvite : undefined,
                isMgr ? <PermsRow bandId={band.id} member={m} /> : undefined,
              ))}
              columns={4}
              cardWidth={190}
              radius={240}
            />
          )
        )}
        {addKind === "member" && (
          <div className="fin-form" style={{ marginTop: 14 }}>
            <div className="fin-form-grid">
              <input className="field-input compact-field" placeholder="Nom *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              <input className="field-input compact-field" placeholder="Instruments (separats per comes)" value={addForm.instruments} onChange={(e) => setAddForm({ ...addForm, instruments: e.target.value })} />
              <input className="field-input compact-field" placeholder="Telèfon" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
              <input className="field-input compact-field" type="email" placeholder="Correu" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => setAddKind(null)}>Cancel·la</button>
              <button type="button" className="btn-save" disabled={addSaving || !addForm.name.trim()} onClick={handleAddPerson}>{addSaving ? "Desant…" : "Afegeix membre"}</button>
            </div>
          </div>
        )}
      </div>

      {/* Equip tècnic */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">Equip tècnic</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {band.crew.some((c) => c.email) && (
              <a className="btn-outline" style={{ textDecoration: "none" }} title="Correu a tot l'equip tècnic"
                href={`mailto:?bcc=${encodeURIComponent(band.crew.map((c) => c.email).filter(Boolean).join(","))}&subject=${encodeURIComponent(band.name)}`}>
                ✉️ Correu al tècnic
              </a>
            )}
            {can.members && addKind !== "crew" && <button type="button" className="btn-outline" onClick={() => setAddKind("crew")}>+ Afegeix tècnic</button>}
          </div>
        </div>
        {band.crew.length === 0 && addKind !== "crew" ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Sense equip tècnic encara.</div>
        ) : (
          band.crew.length > 0 && (
            <ChromaGrid
              items={band.crew.map((m) => personChromaItem(m, null, band, openProfile, photosByName, igByName, !!linkedByName[m.name], isMgr ? handleInvite : undefined))}
              columns={4}
              cardWidth={190}
              radius={240}
            />
          )
        )}
        {addKind === "crew" && (
          <div className="fin-form" style={{ marginTop: 14 }}>
            <div className="fin-form-grid">
              <input className="field-input compact-field" placeholder="Nom *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              <input className="field-input compact-field" placeholder="Funció (so, llums, backliner…)" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} />
              <input className="field-input compact-field" placeholder="Telèfon" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
              <input className="field-input compact-field" type="email" placeholder="Correu" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => setAddKind(null)}>Cancel·la</button>
              <button type="button" className="btn-save" disabled={addSaving || !addForm.name.trim()} onClick={handleAddPerson}>{addSaving ? "Desant…" : "Afegeix tècnic"}</button>
            </div>
          </div>
        )}
      </div>

      {/* Uneix-te al grup (només el gestor comparteix el codi) */}
      {isMgr && (
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 10 }}>Uneix-te al grup</div>
        <div className="t-dim" style={{ fontSize: 13, marginBottom: 12 }}>
          Comparteix el codi: qui es registri a Escenari i l&apos;introdueixi a &ldquo;Els meus grups&rdquo; quedarà
          vinculat a aquest grup, com a músic o com a tècnic de so segons el que triï en unir-s&apos;hi.
          Si la persona ja existeix aquí creada a mà, usa el botó 🔗 de la seva targeta per convidar-la a reclamar el perfil.
        </div>
        <div className="join-box">
          <span className="join-code">{band.joinCode || "—"}</span>
          <button type="button" className="btn-outline"
            onClick={async () => {
              await navigator.clipboard.writeText(joinMsg("membre"));
              setJoinCopied(true);
              window.setTimeout(() => setJoinCopied(false), 1600);
            }}>{joinCopied ? "Copiat ✓" : "Copia el missatge"}</button>
          <button type="button" className="btn-outline cd-wa-btn"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(joinMsg("membre"))}`, "_blank")}>WhatsApp</button>
        </div>
      </div>
      )}

      {/* Suplents */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">Suplents de confiança{savingBackups ? " · desant…" : ""}</div>
          {can.members && !backupDraft && (
            <button type="button" className="btn-outline" onClick={() => setBackupDraft({ name: "", instruments: [], phone: "", email: "" })}>+ Afegeix suplent</button>
          )}
        </div>
        {backups.length === 0 && !backupDraft ? (
          <div className="t-dim" style={{ fontSize: 13 }}>
            Sense suplents. Quan algú digui que no pot venir a un bolo, els suplents d&apos;aquesta llista són la primera opció.
          </div>
        ) : (
          <div className="backup-list">
            {backups.map((b, i) => (
              <div key={i} className="backup-row">
                <img className="member-photo backup-photo" src={personPhotoDataUri(b.name)} alt="" />
                <div className="backup-row-main">
                  <div className="member-name">{b.name}</div>
                  <InstrumentChips items={b.instruments} />
                </div>
                <div className="t-dim" style={{ fontSize: 12 }}>{b.phone}</div>
                {can.members && <button
                  type="button" className="row-delete-btn" title="Treu el suplent"
                  onClick={() => persistBackups(backups.filter((_, j) => j !== i))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>}
              </div>
            ))}
          </div>
        )}
        {backupDraft && (
          <div className="backup-add-form">
            <input className="field-input form-field compact-field" placeholder="Nom" value={backupDraft.name}
              onChange={(e) => setBackupDraft({ ...backupDraft, name: e.target.value })} />
            <input className="field-input form-field compact-field" placeholder="Instruments (separats per comes)"
              value={backupDraft.instruments.join(", ")}
              onChange={(e) => setBackupDraft({ ...backupDraft, instruments: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            <input className="field-input form-field compact-field" placeholder="Telèfon" value={backupDraft.phone}
              onChange={(e) => setBackupDraft({ ...backupDraft, phone: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => setBackupDraft(null)}>Cancel·la</button>
              <button
                type="button" className="btn-save" disabled={!backupDraft.name.trim()}
                onClick={async () => { await persistBackups(backups.concat([backupDraft])); setBackupDraft(null); }}
              >Desa</button>
            </div>
          </div>
        )}
      </div>

      {/* Cerques de suplent publicades (gestió del gestor) */}
      {isMgr && openRequests.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 14 }}>Cerques de suplent obertes</div>
          <div className="backup-request-list">
            {openRequests.map((r) => {
              const c = concertsById[r.concertId];
              return (
                <div key={r.id} className="backup-request-card">
                  <div className="backup-request-head">
                    <div>
                      <div className="member-name">
                        {c ? `${formatDate(c.date)} · ${c.city || c.venue}` : r.concertId}
                      </div>
                      <div className="t-dim" style={{ fontSize: 12 }}>
                        Substitueix: {r.memberName || "—"}{r.instruments.length ? ` (${r.instruments.join(", ")})` : ""}
                      </div>
                    </div>
                    <button type="button" className="btn-outline" onClick={async () => { await setBackupRequestStatusAction(r.id, "cancel·lada"); router.refresh(); }}>
                      Retira la cerca
                    </button>
                  </div>
                  {r.applications.length === 0 ? (
                    <div className="t-dim" style={{ fontSize: 12 }}>Encara sense candidatures — els músics d&apos;Escenari la veuen a la seva borsa de suplències.</div>
                  ) : (
                    <div className="backup-apps">
                      {r.applications.map((a) => (
                        <div key={a.clerkUserId} className="backup-app-row">
                          <img className="member-photo backup-photo" src={personPhotoDataUri(a.name)} alt="" />
                          <div className="backup-row-main">
                            <div className="member-name">{a.name}</div>
                            <InstrumentChips items={a.instruments} />
                            {a.message && <div className="t-dim" style={{ fontSize: 12 }}>&ldquo;{a.message}&rdquo;</div>}
                          </div>
                          {a.status === "pendent" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" className="btn-save" onClick={async () => { await respondBackupApplicationAction(r.id, a.clerkUserId, "acceptada"); router.refresh(); }}>Accepta</button>
                              <button type="button" className="btn-outline" onClick={async () => { await respondBackupApplicationAction(r.id, a.clerkUserId, "rebutjada"); router.refresh(); }}>Rebutja</button>
                            </div>
                          ) : (
                            <span className="badge">{a.status}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      </>)}

      {editOpen && (
        <GroupAppearanceModal key={band.id} band={band} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}
