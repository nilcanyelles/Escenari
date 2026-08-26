"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Band, Concert } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { tagColors, bandPhotoDataUri, personPhotoDataUri, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import type { LinkedMember, BackupRequest } from "@/lib/group-data";
import type { Rider, Setlist, BandEditor } from "@/lib/material-types";
import type { Song, BandFile } from "@/lib/songs";
import { saveBandBackupsAction, setBackupRequestStatusAction, respondBackupApplicationAction, setShowFeesAction, type BackupPerson } from "@/app/(app)/grup/actions";
import BandModal from "@/components/BandModal";
import { RidersPanel, SetlistsPanel } from "@/components/MaterialPanels";
import SongsPanel from "@/components/SongsPanel";
import FilesPanel from "@/components/FilesPanel";
import BentoGrid, { type BentoCard } from "@/components/BentoGrid";

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

export default function GroupHomeView({ band, allBands, concerts, linkedMembers, backupRequests, concertCountByPerson, riders, setlists, editors, songs, files, today }: {
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
  today: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"inici" | "equip" | "cancons" | "riders" | "setlists" | "fitxers">("inici");
  const [editOpen, setEditOpen] = useState(false);
  const [showFees, setShowFees] = useState(!!band.showFees);
  const [backups, setBackups] = useState<BackupPerson[]>(() =>
    ((band as unknown as { backups?: BackupPerson[] }).backups || []).map((b) => ({ name: b.name || "", instruments: b.instruments || [], phone: b.phone || "", email: b.email || "" }))
  );
  const [backupDraft, setBackupDraft] = useState<BackupPerson | null>(null);
  const [savingBackups, setSavingBackups] = useState(false);

  const total = concerts.filter((c) => c.status !== "cancel·lat").length;
  const upcoming = concerts.filter((c) => c.date >= today && c.status !== "cancel·lat");
  const linkedByName: Record<string, LinkedMember> = {};
  linkedMembers.forEach((m) => { linkedByName[m.memberName] = m; });

  const openRequests = backupRequests.filter((r) => r.status === "oberta");
  const concertsById: Record<string, Concert> = {};
  concerts.forEach((c) => { concertsById[c.id] = c; });

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

      {/* Capçalera del grup */}
      <div className="group-hero" style={band.color1 ? { ["--band-accent" as string]: band.color1 } : undefined}>
        <img className="group-hero-photo" src={band.logo || bandPhotoDataUri(band)} alt={band.name} />
        <div className="group-hero-main">
          <div className="group-hero-name">{band.name}</div>
          <div className="group-hero-meta">
            {(band.city || "").split(",")[0]}{band.rate ? ` · ${formatCurrency(band.rate)} per bolo` : ""}
          </div>
          <div className="group-hero-tags">
            {(band.tags || []).map((t) => {
              const tc = tagColors(t);
              return <span key={t} className="badge" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
            })}
          </div>
        </div>
        <div className="group-hero-actions">
          <label className="show-fees-toggle" title="Si està activat, els membres veuen el caixet de cada bolo a la seva àrea d'artista">
            <input
              type="checkbox" checked={showFees}
              onChange={async (e) => {
                setShowFees(e.target.checked);
                await setShowFeesAction(band.id, e.target.checked);
                router.refresh();
              }}
            />
            Els membres veuen el caixet
          </label>
          <button type="button" className="btn-outline" onClick={() => setEditOpen(true)}>Edita el grup</button>
        </div>
      </div>

      {/* Subtabs */}
      <div className="stats-tabs group-tabs">
        <button className={"stats-tab" + (tab === "inici" ? " active" : "")} onClick={() => setTab("inici")}>Inici</button>
        <button className={"stats-tab" + (tab === "equip" ? " active" : "")} onClick={() => setTab("equip")}>Equip</button>
        <button className={"stats-tab" + (tab === "cancons" ? " active" : "")} onClick={() => setTab("cancons")}>Cançons</button>
        <button className={"stats-tab" + (tab === "riders" ? " active" : "")} onClick={() => setTab("riders")}>Riders</button>
        <button className={"stats-tab" + (tab === "setlists" ? " active" : "")} onClick={() => setTab("setlists")}>Setlists</button>
        <button className={"stats-tab" + (tab === "fitxers" ? " active" : "")} onClick={() => setTab("fitxers")}>Fitxers</button>
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
                <div className="bento-members">
                  {band.members.slice(0, 8).map((m) => {
                    const ins = instrumentsFor(m)[0] || "";
                    const icon = ins ? instrumentIconFor(ins) : null;
                    const linked = !!linkedByName[m.name];
                    return (
                      <div key={m.name} className={"bento-member" + (linked ? " linked" : "")} title={`${m.name}${ins ? " — " + ins : ""}`}>
                        <div className="bento-member-avatar">
                          <img src={personPhotoDataUri(m.name)} alt="" />
                          {icon && <span className="bento-member-instr"><img src={icon} alt="" /></span>}
                        </div>
                        <span className="bento-member-name">{m.name.split(" ")[0]}</span>
                        {ins && <span className="bento-member-role">{ins}</span>}
                      </div>
                    );
                  })}
                  {band.members.length > 8 && <div className="bento-member-more">+{band.members.length - 8}</div>}
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
              onClick: () => router.push("/agenda"),
              content: (
                <div className="bento-gigs">
                  {upcoming.slice(0, 5).map((c) => (
                    <div key={c.id} className="bento-gig" onClick={(e) => { e.stopPropagation(); router.push(`/concerts/${c.id}`); }}>
                      <span className="bento-gig-date">{formatDate(c.date)}</span>
                      <span className="bento-gig-place">{c.city || c.venue || "—"}{c.venue && c.city ? ` · ${c.venue}` : ""}</span>
                      <span className="badge" style={{ marginLeft: "auto" }}>{c.status}</span>
                    </div>
                  ))}
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
              key: "fitxers",
              label: "Arxiu",
              title: `${files.filter((f) => !f.songId).length} fitxers`,
              description: "Contractes, cartells, àudios",
              onClick: () => setTab("fitxers"),
            },
          ] as BentoCard[])}
        />
      )}

      {tab === "cancons" && <SongsPanel band={band} songs={songs} canEdit={true} />}
      {tab === "fitxers" && <FilesPanel band={band} files={files} canEdit={true} />}
      {tab === "riders" && (
        <RidersPanel band={band} riders={riders} linkedMembers={linkedMembers} editors={editors} canEdit={true} isManager={true} />
      )}
      {tab === "setlists" && (
        <SetlistsPanel band={band} setlists={setlists} linkedMembers={linkedMembers} editors={editors} canEdit={true} isManager={true} songs={songs} />
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
        <div className="panel-title" style={{ marginBottom: 14 }}>Membres</div>
        {band.members.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Aquest grup encara no té membres — edita el grup per afegir-n&apos;hi.</div>
        ) : (
          <div className="member-grid">
            {band.members.map((m) => {
              const linked = linkedByName[m.name];
              const inss = instrumentsFor(m);
              return (
                <div key={m.name} className="member-card">
                  <img className="member-photo" src={personPhotoDataUri(m.name)} alt={m.name} />
                  <div className="member-card-body">
                    <div className="member-name">
                      {m.name}
                      {linked && (
                        <span className="member-linked" title={`Usuari d'Escenari: ${linked.email}`}>
                          <img src="/logo-mark.png" alt="Escenari" />
                        </span>
                      )}
                    </div>
                    <InstrumentChips items={inss} />
                    <div className="member-count">{concertCountByPerson[m.name] || 0} concerts</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Crew */}
      {band.crew.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 14 }}>Equip tècnic</div>
          <div className="member-grid">
            {band.crew.map((m) => (
              <div key={m.name} className="member-card">
                <img className="member-photo" src={personPhotoDataUri(m.name)} alt={m.name} />
                <div className="member-card-body">
                  <div className="member-name">{m.name}</div>
                  <div className="member-count">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suplents */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">Suplents de confiança{savingBackups ? " · desant…" : ""}</div>
          {!backupDraft && (
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
                <button
                  type="button" className="row-delete-btn" title="Treu el suplent"
                  onClick={() => persistBackups(backups.filter((_, j) => j !== i))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
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

      {/* Cerques de suplent publicades */}
      {openRequests.length > 0 && (
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

      {/* Pròxims bolos del grup */}
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 14 }}>Pròxims bolos</div>
        {upcoming.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Cap bolo a la vista.</div>
        ) : (
          <div className="group-upcoming-list">
            {upcoming.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/concerts/${c.id}`} className="group-upcoming-row">
                <span className="t-strong">{formatDate(c.date)}</span>
                <span className="t-dim">{c.city || "—"}</span>
                <span className="t-dim">{c.venue || "—"}</span>
                <span className="badge" style={{ marginLeft: "auto" }}>{c.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      </>)}

      {editOpen && (
        <BandModal
          key={band.id}
          band={band}
          allBands={allBands}
          concertCountByPerson={concertCountByPerson}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
