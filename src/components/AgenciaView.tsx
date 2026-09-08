"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AgencyMember, AgencyInvitation } from "@/lib/agency";
import { personPhotoDataUri, bandPhotoDataUri } from "@/lib/tags";
import VerifiedTick from "@/components/VerifiedTick";
import {
  inviteAgencyMembersAction, revokeAgencyInvitationAction, setAgencyMemberAction, removeAgencyMemberAction, saveAgencyInfoAction,
} from "@/app/(app)/agencia/actions";
import { createPortalSessionAction } from "@/app/(app)/billing-actions";
import { PLANS, AGENCY_TIERS, type BillingInfo, type PlanKey } from "@/lib/plans";
import CreateGroupModal from "@/components/CreateGroupModal";
import UpgradeModal from "@/components/UpgradeModal";
import PlanLock from "@/components/PlanLock";
import ContactesView from "@/components/ContactesView";
import type { Contact, Band } from "@/lib/types";
import type { ContactInteraction } from "@/lib/contacts-data";
import { logoBox } from "@/lib/logo";

type BandOpt = { id: string; name: string; city: string; logo: string; logoAspect: string; color1: string; color2: string; memberCount: number };

function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.63 22 9.24 16.5 13.97 18.18 21 12 17.27 5.82 21 7.5 13.97 2 9.24 8.91 8.63 12 2"></polygon>
    </svg>
  );
}

// El pla d'agència immediatament superior a l'actual (per quan s'arriba al
// límit de grups).
function nextAgencyTier(current: PlanKey): PlanKey {
  const i = AGENCY_TIERS.indexOf(current);
  if (i < 0) return "agencia_s";
  return AGENCY_TIERS[Math.min(i + 1, AGENCY_TIERS.length - 1)];
}

// Targeta del pla: què tens, fins quan, i els botons per canviar-lo o
// gestionar la subscripció (Stripe).
function BillingCard({ billing, isOwner, notice }: { billing: BillingInfo; isOwner: boolean; notice: string }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState("");
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ca-ES") : "");
  let line = "";
  if (billing.status === "comped") line = "Sense cost.";
  else if (billing.trialActive) line = `Prova amb tot inclòs fins al ${fmt(billing.trialEndsAt)}. Després, pla gratuït: 1 grup, 3 enllaços actius, sense contractes ni factures.`;
  else if (billing.status === "past_due") line = "Hi ha un pagament pendent — revisa la targeta des de “Gestiona la subscripció”.";
  else if (billing.plan !== "free" && billing.status === "active") line = `Es renova el ${fmt(billing.currentPeriodEnd)}.`;
  else if (billing.plan !== "free" && ["canceled", "unpaid", "incomplete_expired"].includes(billing.status)) line = "La subscripció s'ha cancel·lat: tornes al pla gratuït.";
  else if (billing.founder) line = "Membre fundador: pla Grup de per vida.";
  else line = "Pla gratuït: 1 grup, 3 enllaços actius per grup, sense contractes ni factures.";

  async function portal() {
    setPortalBusy(true);
    setError("");
    const res = await createPortalSessionAction();
    if (res.url) { window.location.href = res.url; return; }
    setError(res.error || "No s'ha pogut obrir el portal.");
    setPortalBusy(false);
  }

  return (
    <div className="panel bill-card">
      {notice === "ok" && <div className="sx-notice ok" style={{ marginBottom: 12 }}>Pagament completat — gràcies! El pla ja està actiu.</div>}
      {notice === "cancel" && <div className="sx-notice err" style={{ marginBottom: 12 }}>Pagament cancel·lat: no s&apos;ha canviat res.</div>}
      <div className="bill-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="form-label">El teu pla</div>
          <div className="bill-plan">
            {PLANS[billing.effective].label}
            {billing.trialActive && <span className="badge ag-owner-badge" style={{ marginLeft: 8 }}>prova</span>}
            {billing.founder && <span className="badge ag-owner-badge" style={{ marginLeft: 8 }}>fundador</span>}
            {billing.status === "past_due" && <span className="badge" style={{ marginLeft: 8, background: "oklch(0.68 0.18 25 / 0.16)", color: "var(--red)" }}>pagament pendent</span>}
          </div>
          <div className="t-dim" style={{ fontSize: 12.5 }}>{line}</div>
          {error && <div className="fin-neg" style={{ fontSize: 12.5, marginTop: 4 }}>{error}</div>}
        </div>
        {isOwner && billing.status !== "comped" && (
          <div className="bill-actions">
            <button type="button" className="btn-save" onClick={() => setUpgradeOpen(true)}>{billing.plan === "free" ? "Tria un pla" : "Canvia de pla"}</button>
            {billing.hasSubscription && (
              <button type="button" className="btn-outline" disabled={portalBusy} onClick={portal}>{portalBusy ? "Obrint…" : "Gestiona la subscripció"}</button>
            )}
          </div>
        )}
      </div>
      {upgradeOpen && <UpgradeModal billing={billing} onClose={() => setUpgradeOpen(false)} />}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
  );
}

// Capçalera d'Agència: nom i logotip, editables en el propi títol amb un
// llapis — només un admin el veu; els altres membres el nom/logo en mode
// lectura.
function AgencyHeader({ agency, canEdit }: { agency: { name: string; logo: string }; canEdit: boolean }) {
  const router = useRouter();
  const logoRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [name, setName] = useState(agency.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shownLogo = logoPreview || agency.logo;

  async function save() {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("agencyName", name);
    const f = logoRef.current?.files?.[0];
    if (f) fd.set("agencyLogo", f);
    const res = await saveAgencyInfoAction(fd);
    setBusy(false);
    if (!res.ok) { setError(res.error || "No s'ha pogut desar"); return; }
    setLogoPreview(null);
    setEditing(false);
    router.refresh();
  }

  function cancel() {
    setName(agency.name);
    setLogoPreview(null);
    setError("");
    setEditing(false);
  }

  return (
    <div className="ag-head">
      {editing ? (
        <button type="button" className="ag-logo-edit" onClick={() => logoRef.current?.click()} title="Canvia el logotip de l'agència">
          {shownLogo ? <img src={shownLogo} alt="" /> : <span>🏢</span>}
          <span className="ag-logo-edit-hint">Canvia</span>
        </button>
      ) : agency.logo ? (
        <img className="ag-logo" src={agency.logo} alt="" />
      ) : (
        <span className="ag-logo ag-logo-empty">🏢</span>
      )}
      <input
        ref={logoRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogoPreview(URL.createObjectURL(f)); }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            className="field-input ag-name-input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Nom de l'agència" autoFocus
          />
        ) : (
          <div className="sx-title" style={{ fontSize: 22, display: "flex", alignItems: "center", gap: 8 }}>
            {agency.name || "La teva agència"}
            {canEdit && (
              <button type="button" className="ag-edit-pencil" onClick={() => setEditing(true)} title="Edita el nom i el logotip">
                <PencilIcon />
              </button>
            )}
          </div>
        )}
        <div className="t-dim" style={{ fontSize: 12.5 }}>Agència</div>
        {error && <div className="fin-neg" style={{ fontSize: 12.5, marginTop: 4 }}>{error}</div>}
      </div>
      {editing && (
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <button type="button" className="btn-outline" disabled={busy} onClick={cancel}>Cancel·la</button>
          <button type="button" className="btn-save" disabled={busy} onClick={save}>{busy ? "Desant…" : "Desa"}</button>
        </div>
      )}
    </div>
  );
}

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
// només els assignats) i el botó de treure'l. Només un admin ho edita.
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
          <div className="member-name">{m.name}<VerifiedTick size={12} title="Compte d'Escenari (membre de l'agència)" />{isMe && <span className="t-dim" style={{ fontWeight: 400, fontSize: 12 }}> · tu</span>}</div>
          <div className="t-dim" style={{ fontSize: 12 }}>{m.email}</div>
        </div>
        {state.agencyOwner ? <span className="badge ag-owner-badge"><StarIcon />Admin de l&apos;agència</span> : null}
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
            <span className="form-label">Admin de l&apos;agència</span>
            <Switch on={state.agencyOwner} disabled={busy || isMe} onChange={(v) => patch({ agencyOwner: v })} title={isMe ? "Un altre admin t'ho pot canviar" : undefined} />
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

// Targeta de grup a la graella de "Grups" — clicar-la selecciona el grup
// (mateixa cookie que el menú lateral) i porta a la seva pàgina.
function AgencyGroupCard({ b }: { b: BandOpt }) {
  const router = useRouter();
  function open() {
    document.cookie = `escenari_band=${encodeURIComponent(b.id)}; path=/; max-age=31536000; samesite=lax`;
    router.push("/grup");
    router.refresh();
  }
  const c1 = b.color1 || "#8b7bff";
  const c2 = b.color2 || "#3b3358";
  return (
    <button type="button" className="artist-band-card clickable" onClick={open}>
      <div className="artist-band-banner" style={{ background: `linear-gradient(120deg, ${c1}, ${c2})` }}></div>
      <div className="artist-band-body">
        <img className="artist-band-logo" style={logoBox(b.logoAspect, 52)} src={b.logo || bandPhotoDataUri({ id: b.id, name: b.name })} alt="" />
        <div className="artist-band-name">{b.name}</div>
        <div className="artist-band-meta">
          {b.city ? `${b.city} · ` : ""}
          {b.memberCount} {b.memberCount === 1 ? "membre" : "membres"}
        </div>
      </div>
    </button>
  );
}

export default function AgenciaView({ agency, me, members, invitations, bands, billing, groups, billingNotice = "", contacts = [], allBands = [], concertCountByPerson = {}, interactions = [] }: {
  agency: { name: string; logo: string };
  me: { clerkUserId: string; agencyOwner: boolean; canCreateGroups: boolean };
  members: AgencyMember[];
  invitations: AgencyInvitation[];
  bands: BandOpt[];
  billing: BillingInfo;
  groups: { count: number; cap: number | null; reached: boolean };
  billingNotice?: string;
  // Pestanya Contactes (la mateixa vista que /contactes, incrustada).
  contacts?: Contact[];
  allBands?: Band[];
  concertCountByPerson?: Record<string, number>;
  interactions?: ContactInteraction[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get("tab");
  const initialTab = initialTabParam === "grups" || initialTabParam === "membres" || initialTabParam === "contactes" ? initialTabParam : "inici";
  const [tab, setTab] = useState<"inici" | "grups" | "membres" | "contactes">(initialTab);

  const canInvite = billing.caps.agency;
  const createBtn = (cls: string) => groups.reached ? (
    <PlanLock billing={billing} required={nextAgencyTier(billing.effective)} compact canUpgrade={me.agencyOwner}
      title={`El pla ${PLANS[billing.effective].label} permet ${groups.cap} ${groups.cap === 1 ? "grup" : "grups"}`} />
  ) : (
    <button type="button" className={cls} onClick={() => setCreateOpen(true)}>+ Crea un grup</button>
  );
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

      <AgencyHeader agency={agency} canEdit={me.agencyOwner} />

      <div className="stats-tabs group-tabs">
        <button className={"stats-tab" + (tab === "inici" ? " active" : "")} onClick={() => setTab("inici")}>Inici</button>
        <button className={"stats-tab" + (tab === "grups" ? " active" : "")} onClick={() => setTab("grups")}>Grups</button>
        <button className={"stats-tab" + (tab === "membres" ? " active" : "")} onClick={() => setTab("membres")}>Membres</button>
        <button className={"stats-tab" + (tab === "contactes" ? " active" : "")} onClick={() => setTab("contactes")}>Contactes</button>
      </div>

      {tab === "inici" && (
        <BillingCard billing={billing} isOwner={me.agencyOwner} notice={billingNotice} />
      )}

      {tab === "contactes" && (
        <ContactesView contacts={contacts} allBands={allBands} concertCountByPerson={concertCountByPerson} interactions={interactions} embedded />
      )}

      {tab === "grups" && (
        <div className="panel">
          <div className="panel-header-row" style={{ marginBottom: 12 }}>
            <div>
              <div className="panel-title">Grups de l&apos;agència</div>
              <div className="t-dim" style={{ fontSize: 12.5 }}>{groups.count} {groups.count === 1 ? "grup" : "grups"}{groups.cap != null ? ` de ${groups.cap} del pla ${PLANS[billing.effective].label}` : ""}</div>
            </div>
            {me.canCreateGroups && createBtn("glow-cta")}
          </div>
          {bands.length === 0 ? (
            <div className="t-dim" style={{ fontSize: 13 }}>Encara no hi ha cap grup. Crea el primer: nom, logotip, colors i el seu equip, amb un enllaç per a cadascú.</div>
          ) : (
            <div className="artist-band-grid">
              {bands.map((b) => <AgencyGroupCard key={b.id} b={b} />)}
            </div>
          )}
        </div>
      )}

      {tab === "membres" && (
        <>
          <div className="panel">
            <div className="panel-header-row" style={{ marginBottom: 12 }}>
              <div>
                <div className="panel-title">Membres de l&apos;agència</div>
                <div className="t-dim" style={{ fontSize: 12.5 }}>
                  {me.agencyOwner ? "Decideix què pot fer cadascú: crear grups, i veure tots els grups o només els que li assignis." : "Només un admin de l'agència pot canviar permisos."}
                </div>
              </div>
              {me.agencyOwner && (canInvite
                ? <button type="button" className="btn-outline" onClick={() => setInviteOpen((v) => !v)}>{inviteOpen ? "Tanca" : "+ Convida algú"}</button>
                : <PlanLock billing={billing} feature="agency" compact canUpgrade title="Convidar membres de l'agència necessita un pla d'Agència" />)}
            </div>

            {inviteOpen && me.agencyOwner && canInvite && (
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
        </>
      )}

      {createOpen && <CreateGroupModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
