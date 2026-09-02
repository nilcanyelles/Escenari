"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Concert } from "@/lib/types";
import type { Rider, Setlist, BandEditor } from "@/lib/material-types";
import { songDurationSecs, formatTotalDuration } from "@/lib/material-types";
import type { LinkedMember } from "@/lib/group-data";
import { emptyRiderContent } from "@/lib/material-types";
import type { Song as LibrarySong } from "@/lib/songs";
import { today, pad2, capitalize, MONTH_FULL, WEEKDAY_SHORT } from "@/lib/format";
import { saveRiderAction, deleteRiderAction, deleteSetlistAction, setBandEditorAction } from "@/app/(app)/grup/material-actions";
import { setConcertMaterialAction } from "@/app/(app)/grup/material-actions";
import SetlistEditor from "@/components/SetlistEditor";
import SpecularButton from "@/components/SpecularButton";

function publicUrl(token: string): string {
  return `${window.location.origin}/m/${token}`;
}

function ShareBtns({ token, what, bandName }: { token: string; what: string; bandName: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button type="button" className="row-rs-btn" title="Obre el PDF" aria-label="Obre el PDF" onClick={() => window.open(publicUrl(token), "_blank")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
      </button>
      <button
        type="button" className="row-rs-btn" title={copied ? "Copiat ✓" : "Copia l'enllaç"} aria-label="Copia l'enllaç"
        onClick={async () => {
          await navigator.clipboard.writeText(publicUrl(token));
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
        )}
      </button>
      <button
        type="button" className="row-rs-btn cd-wa-btn" title="WhatsApp" aria-label="WhatsApp"
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${what} de ${bandName}: ${publicUrl(token)}`)}`, "_blank")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      </button>
    </>
  );
}

// Calendari mensual per assignar una setlist a un assaig o bolo: cada dia
// amb un esdeveniment és clicable, i el que ja té aquesta setlist assignada
// surt en verd amb un tick.
function initialMonthOffset(concerts: Concert[], todayStr: string): number {
  if (!concerts.length) return 0;
  const upcoming = concerts.filter((c) => c.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0];
  const target = upcoming || concerts.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const now = new Date();
  const t = new Date(parseInt(target.date.slice(0, 4), 10), parseInt(target.date.slice(5, 7), 10) - 1, 1);
  return (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth());
}

function AssignSetlistModal({ setlist, concerts, onClose, onDone }: {
  setlist: Setlist;
  concerts: Concert[];
  onClose: () => void;
  onDone: (concertId: string, assign: boolean) => Promise<void>;
}) {
  const todayStr = today();
  const [monthOffset, setMonthOffset] = useState(() => initialMonthOffset(concerts, todayStr));
  const [busyId, setBusyId] = useState<string | null>(null);

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const y = base.getFullYear(), mIdx = base.getMonth();
  const startOffset = (base.getDay() + 6) % 7;
  const daysInMonth = new Date(y, mIdx + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDate: Record<string, Concert[]> = {};
  concerts.forEach((c) => { (eventsByDate[c.date] = eventsByDate[c.date] || []).push(c); });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal assign-cal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="rider-name-input" style={{ fontWeight: 700, fontSize: 16 }}>Assigna &ldquo;{setlist.name}&rdquo;</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onClose}>✕</button>
        </div>
        <div className="t-dim" style={{ fontSize: 12.5, margin: "2px 0 14px" }}>
          Clica l&apos;assaig o bolo on vols que surti aquesta setlist.
        </div>
        <div className="assign-cal-nav">
          <button type="button" className="row-rs-btn" title="Mes anterior" onClick={() => setMonthOffset((v) => v - 1)}>‹</button>
          <div className="assign-cal-title">{capitalize(MONTH_FULL[mIdx])} {y}</div>
          <button type="button" className="row-rs-btn" title="Mes següent" onClick={() => setMonthOffset((v) => v + 1)}>›</button>
        </div>
        <div className="assign-cal-grid">
          {WEEKDAY_SHORT.map((w) => <span key={w} className="assign-cal-wd">{w}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={"e" + i}></span>;
            const dateStr = `${y}-${pad2(mIdx + 1)}-${pad2(d)}`;
            const evs = eventsByDate[dateStr] || [];
            const ev = evs[0];
            const assigned = !!ev && ev.setlistId === setlist.id;
            return (
              <button
                key={dateStr}
                type="button"
                className={"assign-cal-day" + (dateStr === todayStr ? " today" : "") + (evs.length ? " has" : "") + (assigned ? " assigned" : "")}
                disabled={!ev || busyId === ev.id}
                title={ev ? `${(ev.kind || "bolo") === "assaig" ? "Assaig" : "Bolo"}${ev.venue ? " · " + ev.venue : ""}` : undefined}
                onClick={async () => {
                  if (!ev) return;
                  setBusyId(ev.id);
                  await onDone(ev.id, !assigned);
                  setBusyId(null);
                }}
              >
                <span className="assign-cal-daynum">{d}</span>
                {assigned && <span className="assign-cal-check">✓</span>}
              </button>
            );
          })}
        </div>
        {concerts.length === 0 && (
          <div className="t-dim" style={{ fontSize: 12.5, marginTop: 10 }}>Aquest grup encara no té cap assaig ni bolo.</div>
        )}
      </div>
    </div>
  );
}

// Caixa de permisos: quins membres amb compte d'Escenari poden editar.
function AccessBox({ band, linkedMembers, editors, kind }: { band: Band; linkedMembers: LinkedMember[]; editors: BandEditor[]; kind: "riders" | "setlists" }) {
  const router = useRouter();
  const byId: Record<string, BandEditor> = {};
  editors.forEach((e) => { byId[e.clerkUserId] = e; });
  if (!linkedMembers.length) {
    return <div className="t-dim" style={{ fontSize: 12 }}>Cap membre del grup té compte d&apos;Escenari encara — quan en tinguin, aquí podràs donar-los permís d&apos;edició.</div>;
  }
  return (
    <div className="access-box">
      <div className="access-box-title">Qui pot editar (a més de tu)</div>
      <div className="access-box-list">
        {linkedMembers.map((m) => {
          const cur = byId[m.clerkUserId] || { clerkUserId: m.clerkUserId, canRiders: false, canSetlists: false };
          const active = kind === "riders" ? cur.canRiders : cur.canSetlists;
          return (
            <button
              key={m.clerkUserId}
              type="button"
              className={"access-chip" + (active ? " active" : "")}
              onClick={async () => {
                await setBandEditorAction(band.id, m.clerkUserId, {
                  canRiders: kind === "riders" ? !active : cur.canRiders,
                  canSetlists: kind === "setlists" ? !active : cur.canSetlists,
                });
                router.refresh();
              }}
            >
              {active ? "✓ " : ""}{m.memberName || m.profileName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RidersPanel({ band, riders, linkedMembers, editors, canEdit, isManager }: {
  band: Band;
  riders: Rider[];
  linkedMembers: LinkedMember[];
  editors: BandEditor[];
  canEdit: boolean;
  isManager: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleNewRider() {
    setCreating(true);
    const { id } = await saveRiderAction({ id: null, bandId: band.id, name: "Rider tècnic", content: emptyRiderContent() });
    router.push(`/rider/${id}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 12 }}>
          <div className="panel-title">Riders tècnics</div>
          {canEdit && (
            <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.3} baseColor="#8b7bff" lineColor="#ffffff" disabled={creating} onClick={handleNewRider}>
              {creating ? "Creant…" : "+ Nou rider"}
            </SpecularButton>
          )}
        </div>
        <div className="t-dim" style={{ fontSize: 13, marginBottom: 14 }}>
          El rider és el document que reps la sala o el festival abans del bolo: escenari, entrades de so, backline,
          monitors i hospitalitat. Crea&apos;n un per cada format del grup (banda completa, acústic…) i assigna&apos;l a cada concert.
        </div>
        {riders.length === 0 ? (
          <div className="empty-state">Encara no hi ha cap rider.</div>
        ) : (
          <div className="material-list">
            {riders.map((r) => {
              const channels = r.content.inputs.filter((i) => i.source.trim()).length;
              return (
                <div key={r.id} className="material-card">
                  <div className="material-card-icon">🎚</div>
                  <div className="material-card-main">
                    <div className="member-name">{r.name}</div>
                    <div className="t-dim" style={{ fontSize: 12 }}>
                      {channels} canals · {r.content.stage.items.length} elements a l&apos;escenari · {r.content.stage.widthM}×{r.content.stage.depthM} m
                    </div>
                  </div>
                  <div className="material-card-actions">
                    {canEdit && <button type="button" className="btn-outline" onClick={() => router.push(`/rider/${r.id}`)}>Edita</button>}
                    <ShareBtns token={r.publicToken} what="Rider tècnic" bandName={band.name} />
                    {canEdit && (
                      <button type="button" className="row-delete-btn" title="Elimina el rider"
                        onClick={async () => {
                          if (!confirm(`Eliminar el rider "${r.name}"?`)) return;
                          await deleteRiderAction(band.id, r.id);
                          router.refresh();
                        }}>✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isManager && (
        <div className="panel">
          <AccessBox band={band} linkedMembers={linkedMembers} editors={editors} kind="riders" />
        </div>
      )}
    </div>
  );
}

export function SetlistsPanel({ band, setlists, linkedMembers, editors, canEdit, isManager, songs, concerts = [] }: {
  band: Band;
  setlists: Setlist[];
  linkedMembers: LinkedMember[];
  editors: BandEditor[];
  canEdit: boolean;
  isManager: boolean;
  songs?: LibrarySong[];
  concerts?: Concert[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ setlist: Setlist | null } | null>(null);
  const [assigning, setAssigning] = useState<Setlist | null>(null);
  // Assaigs i bolos d'aquest grup on es pot penjar una setlist.
  const assignableConcerts = concerts.filter((c) => (c.kind || "bolo") === "bolo" || c.kind === "assaig");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 12 }}>
          <div className="panel-title">Setlists</div>
          {canEdit && <button type="button" className="glow-cta" onClick={() => setEditing({ setlist: null })}>+ Nova setlist</button>}
        </div>
        {setlists.length === 0 ? (
          <div className="empty-state">Encara no hi ha cap setlist.</div>
        ) : (
          <div className="material-list">
            {setlists.map((s) => {
              const total = s.songs.reduce((acc, song) => acc + songDurationSecs(song.duration), 0);
              return (
                <div key={s.id} className="material-card">
                  <div className="material-card-icon">🎵</div>
                  <div className="material-card-main">
                    <div className="member-name">{s.name}</div>
                    <div className="t-dim" style={{ fontSize: 12 }}>
                      {s.songs.filter((x) => x.title.trim()).length} cançons · {formatTotalDuration(total)}
                    </div>
                  </div>
                  <div className="material-card-actions">
                    <button type="button" className="btn-outline stage-mode-btn" title="Mode escenari: lletres a pantalla completa amb auto-scroll" onClick={() => router.push(`/escenari-mode/${s.id}`)}>▶ Escenari</button>
                    <ShareBtns token={s.publicToken} what="Setlist" bandName={band.name} />
                    {isManager && (
                      <button type="button" className="row-rs-btn" title="Assigna a un assaig o bolo" aria-label="Assigna a un assaig o bolo"
                        onClick={() => setAssigning(s)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="12" y1="14" x2="12" y2="18"></line><line x1="10" y1="16" x2="14" y2="16"></line></svg>
                      </button>
                    )}
                    {canEdit && (
                      <button type="button" className="row-rs-btn" title="Edita la setlist" aria-label="Edita la setlist" onClick={() => setEditing({ setlist: s })}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                      </button>
                    )}
                    {canEdit && (
                      <button type="button" className="row-delete-btn" title="Elimina la setlist"
                        onClick={async () => {
                          if (!confirm(`Eliminar la setlist "${s.name}"?`)) return;
                          await deleteSetlistAction(band.id, s.id);
                          router.refresh();
                        }}>✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isManager && (
        <div className="panel">
          <AccessBox band={band} linkedMembers={linkedMembers} editors={editors} kind="setlists" />
        </div>
      )}
      {editing && <SetlistEditor band={band} setlist={editing.setlist} librarySongs={songs || []} onClose={() => { setEditing(null); router.refresh(); }} />}
      {assigning && (
        <AssignSetlistModal
          setlist={assigning}
          concerts={assignableConcerts}
          onClose={() => setAssigning(null)}
          onDone={async (concertId, assign) => {
            await setConcertMaterialAction(concertId, "setlist", assign ? assigning.id : null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
