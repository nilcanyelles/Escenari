"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import type { Rider, Setlist, BandEditor } from "@/lib/material-types";
import { songDurationSecs, formatTotalDuration } from "@/lib/material-types";
import type { LinkedMember } from "@/lib/group-data";
import { emptyRiderContent } from "@/lib/material-types";
import { saveRiderAction, deleteRiderAction, deleteSetlistAction, setBandEditorAction } from "@/app/(app)/grup/material-actions";
import SetlistEditor from "@/components/SetlistEditor";
import SpecularButton from "@/components/SpecularButton";

function publicUrl(token: string): string {
  return `${window.location.origin}/m/${token}`;
}

function ShareBtns({ token, what, bandName }: { token: string; what: string; bandName: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button type="button" className="btn-outline" onClick={() => window.open(publicUrl(token), "_blank")}>PDF</button>
      <button
        type="button" className="btn-outline"
        onClick={async () => {
          await navigator.clipboard.writeText(publicUrl(token));
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >{copied ? "Copiat ✓" : "Copia enllaç"}</button>
      <button
        type="button" className="btn-outline cd-wa-btn"
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${what} de ${bandName}: ${publicUrl(token)}`)}`, "_blank")}
      >WhatsApp</button>
    </>
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

export function SetlistsPanel({ band, setlists, linkedMembers, editors, canEdit, isManager }: {
  band: Band;
  setlists: Setlist[];
  linkedMembers: LinkedMember[];
  editors: BandEditor[];
  canEdit: boolean;
  isManager: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ setlist: Setlist | null } | null>(null);

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
                    {canEdit && <button type="button" className="btn-outline" onClick={() => setEditing({ setlist: s })}>Edita</button>}
                    <ShareBtns token={s.publicToken} what="Setlist" bandName={band.name} />
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
      {editing && <SetlistEditor band={band} setlist={editing.setlist} onClose={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}
