"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgencyMember, AgencyInvitation } from "@/lib/agency";
import { personPhotoDataUri, bandPhotoDataUri } from "@/lib/tags";
import { inviteAgencyMembersAction, revokeAgencyInvitationAction, setAgencyMemberAction, removeAgencyMemberAction } from "@/app/(app)/configuracio/actions";
import CreateGroupModal from "@/components/CreateGroupModal";

type BandOpt = { id: string; name: string; logo: string; color1: string };

function CopyBtn({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="btn-outline" style={small ? { padding: "6px 10px", fontSize: 12 } : undefined}
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>
      {copied ? "Copiat ✓" : "Copia l'enllaç"}
    </button>
  );
}

function Switch({ on, disabled, onChange, title }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={"perm-switch" + (on ? " on" : "")} disabled={disabled} title={title} onClick={() => onChange(!on)}>
      <span className="perm-switch-knob"></span>
      <span className="perm-switch-text">{on ? "Sí" : "No"}</span>
    </button>
  );
}

// Fila d'un membre: càrrec, permisos (crear grups, veure tots els grups o
// només els assignats) i el botó de treure'l. Només qui mana ho edita.
function MemberRow({ m, bands, canEdit, isMe }: { m: AgencyMember; bands: BandOpt[]; canEdit: boolean; isMe: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(m);
  const [busy, setBusy] = useState(false);

  async function patch(p: Parameters<typeof setAgencyMemberAction>[1]) {
    setBusy(true);
    setState((s) => ({ ...s, ...(p.agencyRole !== undefined ? { agencyRole: p.agencyRole } : {}), ...(p.agencyOwner !== undefined ? { agencyOwner: p.agencyOwner } : {}),
      ...(p.canCreateGroups !== undefined ? { canCreateGroups: p.canCreateGroups } : {}), ...(p.viewAllGroups !== undefined ? { viewAllGroups: p.viewAllGroups } : {}),
      ...(p.assignedBandIds !== undefined ? { assignedBandIds: p.assignedBandIds } : {}) }));
    try {
      await setAgencyMemberAction(m.clerkUserId, p);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      setState(m);
    }
    setBusy(false);
    router.refresh();
  }

  const editable = canEdit && !state.agencyOwner;
  return (
    <div className={"ag-member" + (state.agencyOwner ? " owner" : "")}>
      <div className="ag-member-head">
        <img className="subs-photo" src={m.photoFileId ? `/api/file/${m.photoFileId}` : personPhotoDataUri(m.name)} alt="" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="member-name">{m.name}{isMe && <span className="t-dim" style={{ fontWeight: 400, fontSize: 12 }}> · tu</span>}</div>
          <div className="t-dim" style={{ fontSize: 12 }}>{m.email}</div>
        </div>
        {state.agencyOwner ? <span className="badge ag-owner-badge">Mana a l&apos;agència</span> : null}
        {canEdit && !isMe && !state.agencyOwner && (
          <button type="button" className="row-delete-btn" title="Treu de l'agència" disabled={busy}
            onClick={async () => { if (!confirm(`Treure ${m.name} de l'agència?`)) return; await removeAgencyMemberAction(m.clerkUserId); router.refresh(); }}>✕</button>
        )}
      </div>
      <div className="ag-member-grid">
        <label className="ag-field">
          <span className="form-label">Càrrec</span>
          {canEdit ? (
            <input className="field-input compact-field" defaultValue={state.agencyRole} placeholder="Mànager, booking…" disabled={busy}
              onBlur={(e) => { if (e.target.value.trim() !== state.agencyRole) patch({ agencyRole: e.target.value.trim() }); }} />
          ) : <span style={{ fontSize: 13 }}>{state.agencyRole || "—"}</span>}
        </label>
        <div className="ag-field">
          <span className="form-label">Pot crear grups</span>
          <Switch on={state.canCreateGroups} disabled={!editable || busy} onChange={(v) => patch({ canCreateGroups: v })} />
        </div>
        <div className="ag-field">
          <span className="form-label">Veu tots els grups</span>
          <Switch on={state.viewAllGroups} disabled={!editable || busy} onChange={(v) => patch({ viewAllGroups: v })} />
        </div>
        {canEdit && (
          <div className="ag-field">
            <span className="form-label">Mana a l&apos;agència</span>
            <Switch on={state.agencyOwner} disabled={busy || isMe} onChange={(v) => patch({ agencyOwner: v })} title={isMe ? "Un altre responsable t'ho pot canviar" : undefined} />
          </div>
        )}
      </div>
      {!state.viewAllGroups && (
        <div className="ag-assign">
          <span className="form-label">Grups assignats</span>
          <div className="access-box-list" style={{ marginTop: 6 }}>
            {bands.length === 0 && <span className="t-dim" style={{ fontSize: 12 }}>Encara no hi ha grups.</span>}
            {bands.map((b) => {
              const on = state.assignedBandIds.includes(b.id);
              return (
                <button key={b.id} type="button" className={"access-chip lib-chip" + (on ? " active" : "")} disabled={!editable || busy}
                  onClick={() => patch({ assignedBandIds: on ? state.assignedBandIds.filter((x) => x !== b.id) : state.assignedBandIds.concat([b.id]) })}>
                  <img src={b.logo || bandPhotoDataUri({ id: b.id, name: b.name })} alt="" />{on ? "✓ " : ""}{b.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgencySettingsView({ agency, me, members, invitations, bands }: {
  agency: { name: string; logo: string };
  me: { clerkUserId: string; agencyOwner: boolean; canCreateGroups: boolean };
  members: AgencyMember[];
  invitations: AgencyInvitation[];
  bands: BandOpt[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", role: "", email: "", canCreateGroups: true, viewAllGroups: true, assignedBandIds: [] as string[] });
  const [inviting, setInviting] = useState(false);
  const [lastLinks, setLastLinks] = useState<{ name: string; email: string; url: string }[]>([]);

  async function sendInvite() {
    if (!draft.name.trim() && !draft.email.trim()) return;
    setInviting(true);
    const out = await inviteAgencyMembersAction([draft]);
    setLastLinks(out);
    setDraft({ name: "", role: "", email: "", canCreateGroups: true, viewAllGroups: true, assignedBandIds: [] });
    setInviting(false);
    router.refresh();
  }

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      <div className="ag-head">
        {agency.logo ? <img className="ag-logo" src={agency.logo} alt="" /> : <span className="ag-logo ag-logo-empty">🏢</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sx-title" style={{ fontSize: 22 }}>{agency.name || "La teva agència"}</div>
          <div className="t-dim" style={{ fontSize: 12.5 }}>Configuració · el nom i el logotip es canvien des del teu perfil (a dalt a la dreta)</div>
        </div>
        {me.canCreateGroups && <button type="button" className="glow-cta" onClick={() => setCreateOpen(true)}>+ Crea un grup</button>}
      </div>

      {/* Membres */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 12 }}>
          <div>
            <div className="panel-title">Membres de l&apos;agència</div>
            <div className="t-dim" style={{ fontSize: 12.5 }}>
              {me.agencyOwner ? "Decideix què pot fer cadascú: crear grups, i veure tots els grups o només els que li assignis." : "Només qui mana a l'agència pot canviar permisos."}
            </div>
          </div>
          {me.agencyOwner && <button type="button" className="btn-outline" onClick={() => setInviteOpen((v) => !v)}>{inviteOpen ? "Tanca" : "+ Convida algú"}</button>}
        </div>

        {inviteOpen && me.agencyOwner && (
          <div className="ag-invite-form">
            <div className="fin-form-grid">
              <input className="field-input compact-field" placeholder="Nom *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <input className="field-input compact-field" placeholder="Càrrec" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
              <input className="field-input compact-field" type="email" placeholder="Correu (opcional)" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div className="ag-member-grid" style={{ marginTop: 10 }}>
              <div className="ag-field"><span className="form-label">Pot crear grups</span><Switch on={draft.canCreateGroups} onChange={(v) => setDraft({ ...draft, canCreateGroups: v })} /></div>
              <div className="ag-field"><span className="form-label">Veu tots els grups</span><Switch on={draft.viewAllGroups} onChange={(v) => setDraft({ ...draft, viewAllGroups: v })} /></div>
            </div>
            {!draft.viewAllGroups && (
              <div className="access-box-list" style={{ marginTop: 8 }}>
                {bands.map((b) => {
                  const on = draft.assignedBandIds.includes(b.id);
                  return (
                    <button key={b.id} type="button" className={"access-chip lib-chip" + (on ? " active" : "")}
                      onClick={() => setDraft({ ...draft, assignedBandIds: on ? draft.assignedBandIds.filter((x) => x !== b.id) : draft.assignedBandIds.concat([b.id]) })}>
                      <img src={b.logo || bandPhotoDataUri({ id: b.id, name: b.name })} alt="" />{on ? "✓ " : ""}{b.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button type="button" className="btn-save" disabled={inviting || (!draft.name.trim() && !draft.email.trim())} onClick={sendInvite}>{inviting ? "Creant…" : "Crea la invitació"}</button>
              <span className="t-dim" style={{ fontSize: 12 }}>Obtindràs un enllaç per passar-li; amb correu, també se li envia.</span>
            </div>
            {lastLinks.length > 0 && (
              <div className="ob-links" style={{ marginTop: 10 }}>
                {lastLinks.map((l) => (
                  <div key={l.url} className="ob-link-row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="t-strong" style={{ fontSize: 13 }}>{l.name || l.email}</div>
                      <div className="t-dim" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</div>
                    </div>
                    <CopyBtn text={l.url} small />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="ag-members">
          {members.map((m) => <MemberRow key={m.clerkUserId} m={m} bands={bands} canEdit={me.agencyOwner} isMe={m.clerkUserId === me.clerkUserId} />)}
        </div>
      </div>

      {/* Invitacions pendents */}
      {invitations.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}>Invitacions pendents</div>
          <div className="ob-links">
            {invitations.map((inv) => (
              <div key={inv.id} className="ob-link-row">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="t-strong" style={{ fontSize: 13 }}>{inv.name || inv.email}{inv.roleLabel ? <span className="t-dim" style={{ fontWeight: 400 }}> · {inv.roleLabel}</span> : null}</div>
                  <div className="t-dim" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email ? inv.email + " · " : ""}{inv.url}</div>
                </div>
                <CopyBtn text={inv.url} small />
                {me.agencyOwner && (
                  <button type="button" className="row-delete-btn" title="Anul·la la invitació" onClick={async () => { await revokeAgencyInvitationAction(inv.id); router.refresh(); }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grups de l'agència */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 12 }}>
          <div className="panel-title">Grups de l&apos;agència</div>
          {me.canCreateGroups && <button type="button" className="btn-outline" onClick={() => setCreateOpen(true)}>+ Crea un grup</button>}
        </div>
        {bands.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Encara no hi ha cap grup. Crea el primer: nom, logotip, colors i el seu equip, amb un enllaç per a cadascú.</div>
        ) : (
          <div className="access-box-list">
            {bands.map((b) => (
              <span key={b.id} className="access-chip lib-chip active" style={{ cursor: "default" }}>
                <img src={b.logo || bandPhotoDataUri({ id: b.id, name: b.name })} alt="" />{b.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {createOpen && <CreateGroupModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
