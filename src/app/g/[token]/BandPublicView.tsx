"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BandPublicData } from "@/lib/band-public";
import type { SocialPlatform } from "@/lib/types";
import { bandPhotoDataUri, personPhotoDataUriColored, instrumentIconFor, tagColors } from "@/lib/tags";
import { SOCIAL_PLATFORMS, PLATFORM_META, FOLLOWERS_KEY, formatHeroNumber } from "@/lib/social-history";
import { InstagramIcon, YoutubeIcon, TiktokIcon, SpotifyIcon } from "@/components/SocialIcons";
import { updateBandBioAction, updateBandActiveSinceAction } from "../actions";
import BandShareModal from "./BandShareModal";
import type { PublicMember } from "@/lib/band-public";
import VerifiedTick from "@/components/VerifiedTick";
import { logoRatio } from "@/lib/logo";
import BackLink from "@/components/BackLink";

const ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: <InstagramIcon />, tiktok: <TiktokIcon />, spotify: <SpotifyIcon />, youtube: <YoutubeIcon />,
};

function EditIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
  );
}

// Una persona (músic o crew) a la llista pública — mateixa fila per a tots
// dos grups (músics i crew hi surten com a llista, no com a targetes),
// només canvia d'on surt el subtítol (instruments o càrrec).
function MemberRow({ m, c1, c2 }: { m: PublicMember; c1: string; c2: string }) {
  return (
    <div className="pv-member-row">
      <img className="pv-member-row-photo" src={m.photoFileId ? `/api/file/${m.photoFileId}` : personPhotoDataUriColored(m.name, c1, c2)} alt="" />
      <div className="pv-member-row-main">
        <span className="pv-member-row-name">{m.name}{m.linked && <VerifiedTick size={12} />}</span>
        <span className="pv-member-row-sub">
          {m.instruments.length ? m.instruments.slice(0, 2).map((ins) => {
            const icon = instrumentIconFor(ins);
            return <span key={ins}>{icon && <img src={icon} alt="" />}{ins}</span>;
          }) : (m.role || "—")}
        </span>
      </div>
      {m.igHandle && <a className="pv-ig" href={`https://instagram.com/${m.igHandle}`} target="_blank" rel="noreferrer">@{m.igHandle}</a>}
    </div>
  );
}

// Pàgina pública del grup: logo a l'esquerra; a la dreta el text de
// presentació (que el gestor edita aquí mateix), els membres i les xifres.
export default function BandPublicView({ data, canEdit, backHref }: {
  data: BandPublicData;
  canEdit: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const [bio, setBio] = useState(data.bio);
  const [draft, setDraft] = useState(data.bio);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Any en actiu: per defecte es calcula sol (data.stats.since), però es
  // pot corregir a mà — "since" es queda amb el que s'acaba mostrant
  // (l'escrit a mà, o el calculat si encara no s'ha tocat).
  const [since, setSince] = useState(data.stats.since);
  const [sinceDraft, setSinceDraft] = useState(data.activeSince);
  const [editingSince, setEditingSince] = useState(false);
  const [savingSince, setSavingSince] = useState(false);

  const c1 = data.color1 || "#8b7bff";
  const c2 = data.color2 || "#e86bd0";
  const logo = data.logo || bandPhotoDataUri({ id: data.bandId, name: data.name, tags: data.tags });

  async function saveBio() {
    setSaving(true);
    await updateBandBioAction(data.token, draft);
    setBio(draft.trim());
    setEditing(false);
    setSaving(false);
    router.refresh();
  }

  async function saveSince() {
    setSavingSince(true);
    await updateBandActiveSinceAction(data.token, sinceDraft);
    const clean = /^\d{4}$/.test(sinceDraft.trim()) ? sinceDraft.trim() : "";
    // Sense any escrit a mà, torna a mostrar el calculat del primer
    // concert (autoSince, no data.stats.since — aquell ja portaria
    // l'escrit a mà d'abans si n'hi havia).
    setSince(clean || data.autoSince);
    setEditingSince(false);
    setSavingSince(false);
    router.refresh();
  }

  const socialLinks = SOCIAL_PLATFORMS.filter((p) => data.socialLinks[p]);
  // Xifres que es mostren: els seguidors de cada xarxa amb seguiment (i els
  // oients mensuals de Spotify, si hi són).
  const figures: { key: string; platform: SocialPlatform; value: number; label: string }[] = [];
  data.trackedPlatforms.forEach((p) => {
    const key = FOLLOWERS_KEY[p];
    const v = key ? data.socialStats[key] : undefined;
    if (v != null) figures.push({ key: p + "-f", platform: p, value: v, label: `${PLATFORM_META[p].metrics[0].label.toLowerCase()} a ${PLATFORM_META[p].label}` });
    if (p === "spotify" && data.socialStats.spotifyMonthlyListeners != null) {
      figures.push({ key: "spotify-ml", platform: p, value: data.socialStats.spotifyMonthlyListeners, label: "oients mensuals a Spotify" });
    }
  });

  return (
    <div className="pv" style={{ ["--pv-accent" as string]: c1 }}>
      <div className="pv-topbar">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {backHref && (
            <BackLink onClick={() => router.push(backHref)}>Torna al grup</BackLink>
          )}
          <span className="pf-brand" style={{ margin: 0 }}>ESCENARI</span>
        </div>
        <button type="button" className="btn-save" onClick={() => setShareOpen(true)}>Comparteix</button>
      </div>

      <div className="pv-grid">
        {/* Esquerra: logo i identitat */}
        <aside className="pv-side">
          <img className="gp-logo" style={{ aspectRatio: String(logoRatio(data.logoAspect)) }} src={logo} alt={data.name} />
          <h1 className="pv-name">{data.name}</h1>
          {data.city && <span className="t-dim" style={{ fontSize: 13 }}>{data.city}</span>}
          {data.tags.length > 0 && (
            <div className="gp-tags">
              {data.tags.map((t) => {
                const tc = tagColors(t);
                return <span key={t} className="badge" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
              })}
            </div>
          )}
          {socialLinks.length > 0 && (
            <div className="gp-socials">
              {socialLinks.map((p) => (
                <a key={p} className="gp-social" style={{ background: PLATFORM_META[p].gradient }} href={data.socialLinks[p]} target="_blank" rel="noreferrer" title={PLATFORM_META[p].label}>
                  {ICONS[p]}
                </a>
              ))}
            </div>
          )}
          <div className="pv-stats">
            <div className="pv-stat"><span className="pv-stat-n">{data.stats.concertsDone}</span><span>concerts fets</span></div>
            <div className="pv-stat"><span className="pv-stat-n">{data.stats.upcoming}</span><span>a la vista</span></div>
            <div className="pv-stat"><span className="pv-stat-n">{data.members.length}</span><span>músics</span></div>
            {data.crew.length > 0 && <div className="pv-stat"><span className="pv-stat-n">{data.crew.length}</span><span>crew</span></div>}
            {(since || canEdit) && (
              <div className="pv-stat">
                {editingSince ? (
                  <input
                    className="field-input compact-field pv-stat-input" type="text" inputMode="numeric" maxLength={4} autoFocus
                    placeholder={data.autoSince || "Any"} value={sinceDraft}
                    onChange={(e) => setSinceDraft(e.target.value.replace(/[^\d]/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") saveSince(); if (e.key === "Escape") setEditingSince(false); }}
                  />
                ) : (
                  <span className="pv-stat-n">
                    {since || "—"}
                    {canEdit && (
                      <button type="button" className="pv-stat-edit" title="Edita l'any en actiu" onClick={() => { setSinceDraft(data.activeSince); setEditingSince(true); }}>
                        <EditIcon />
                      </button>
                    )}
                  </span>
                )}
                <span>
                  en actiu des de
                  {editingSince && (
                    <>
                      {" "}<button type="button" className="link-btn" style={{ fontSize: 11 }} disabled={savingSince} onClick={saveSince}>{savingSince ? "…" : "Desa"}</button>
                      {" "}<button type="button" className="link-btn" style={{ fontSize: 11 }} onClick={() => setEditingSince(false)}>Cancel·la</button>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Dreta: presentació, membres i xifres */}
        <main className="pv-main">
          <div className="pv-panel">
            <div className="gp-panel-head">
              <div className="pv-panel-title">Sobre {data.name}</div>
              {canEdit && !editing && (
                <button type="button" className="btn-outline" onClick={() => { setDraft(bio); setEditing(true); }}>Edita el text</button>
              )}
            </div>
            {editing ? (
              <>
                <textarea
                  className="field-input rider-textarea" rows={6} autoFocus
                  placeholder="Presenta el grup: estil, d'on sou, què oferiu en directe…"
                  value={draft} onChange={(e) => setDraft(e.target.value)}
                />
                <div className="modal-actions">
                  <div className="spacer"></div>
                  <button type="button" className="btn-outline" onClick={() => setEditing(false)}>Cancel·la</button>
                  <button type="button" className="btn-save" disabled={saving} onClick={saveBio}>{saving ? "Desant…" : "Desa"}</button>
                </div>
              </>
            ) : (
              <p className={"gp-bio" + (bio ? "" : " empty")}>
                {bio || (canEdit ? "Encara no hi ha text de presentació — escriu-lo amb “Edita el text”." : "Aquest grup encara no té presentació.")}
              </p>
            )}
          </div>

          <div className="pv-panel">
            <div className="pv-panel-title">
              Músics
              <span className="t-dim" style={{ fontSize: 12, fontWeight: 400, marginLeft: 10 }}>{data.members.length}</span>
            </div>
            {data.members.length === 0 ? (
              <div className="t-dim" style={{ fontSize: 13 }}>Encara no hi ha músics.</div>
            ) : (
              <div className="pv-member-list" style={{ ["--gp-accent" as string]: c1 }}>
                {data.members.map((m) => <MemberRow key={m.name} m={m} c1={c1} c2={c2} />)}
              </div>
            )}
          </div>

          {data.crew.length > 0 && (
            <div className="pv-panel">
              <div className="pv-panel-title">
                Crew
                <span className="t-dim" style={{ fontSize: 12, fontWeight: 400, marginLeft: 10 }}>{data.crew.length}</span>
              </div>
              <div className="pv-member-list" style={{ ["--gp-accent" as string]: c1 }}>
                {data.crew.map((m) => <MemberRow key={m.name} m={m} c1={c1} c2={c2} />)}
              </div>
            </div>
          )}

          {figures.length > 0 && (
            <div className="pv-panel">
              <div className="pv-panel-title">En xifres</div>
              <div className="gp-stats">
                {figures.map((f) => (
                  <div key={f.key} className="gp-stat">
                    <span className="gp-stat-n">
                      <span className="bento-social-icon" style={{ background: PLATFORM_META[f.platform].gradient, width: 26, height: 26 }}>{ICONS[f.platform]}</span>
                      {formatHeroNumber(f.value)}
                    </span>
                    <span className="gp-stat-l">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Imatge compartible (PNG) amb tot el que hi ha a la pàgina */}
      {shareOpen && <BandShareModal data={{ ...data, bio }} logoUrl={logo} onClose={() => setShareOpen(false)} />}

      <div className="cfm-footer" style={{ paddingBottom: 28 }}>
        <img className="brand-mark" src="/logo-mark.png" alt="" />
        <span className="brand-name">ESCENARI</span>
      </div>
    </div>
  );
}
