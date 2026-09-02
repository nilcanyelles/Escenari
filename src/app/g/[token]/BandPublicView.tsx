"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BandPublicData } from "@/lib/band-public";
import type { SocialPlatform } from "@/lib/types";
import { bandPhotoDataUri, personPhotoDataUriColored, instrumentIconFor, tagColors } from "@/lib/tags";
import { SOCIAL_PLATFORMS, PLATFORM_META, FOLLOWERS_KEY, formatNumber } from "@/lib/social-history";
import { InstagramIcon, YoutubeIcon, TiktokIcon, SpotifyIcon } from "@/components/SocialIcons";
import { updateBandBioAction } from "../actions";
import BandShareModal from "./BandShareModal";

const ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: <InstagramIcon />, tiktok: <TiktokIcon />, spotify: <SpotifyIcon />, youtube: <YoutubeIcon />,
};

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

  const socialLinks = SOCIAL_PLATFORMS.filter((p) => data.socialLinks[p]);
  // Xifres que es mostren: els seguidors de cada xarxa amb seguiment (i els
  // oients mensuals de Spotify, si hi són).
  const figures: { key: string; platform: SocialPlatform; value: number; label: string }[] = [];
  data.trackedPlatforms.forEach((p) => {
    const v = data.socialStats[FOLLOWERS_KEY[p]];
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
            <button type="button" className="cd-back" style={{ border: "none", background: "transparent", cursor: "pointer", font: "inherit" }} onClick={() => router.push(backHref)}>
              ← Torna al grup
            </button>
          )}
          <span className="pf-brand" style={{ margin: 0 }}>ESCENARI</span>
        </div>
        <button type="button" className="btn-save" onClick={() => setShareOpen(true)}>Comparteix</button>
      </div>

      <div className="pv-grid">
        {/* Esquerra: logo i identitat */}
        <aside className="pv-side">
          <img className="gp-logo" src={logo} alt={data.name} />
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
            <div className="pv-stat"><span className="pv-stat-n">{data.members.length}</span><span>membres</span></div>
            {data.stats.since && <div className="pv-stat"><span className="pv-stat-n">{data.stats.since}</span><span>en actiu des de</span></div>}
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
              Membres
              <span className="t-dim" style={{ fontSize: 12, fontWeight: 400, marginLeft: 10 }}>{data.members.length}</span>
            </div>
            {data.members.length === 0 ? (
              <div className="t-dim" style={{ fontSize: 13 }}>Encara no hi ha membres.</div>
            ) : (
              <div className="gp-members" style={{ ["--gp-accent" as string]: c1 }}>
                {data.members.map((m) => (
                  <div key={m.name} className="gp-member">
                    <img className="gp-member-photo" src={m.photoFileId ? `/api/file/${m.photoFileId}` : personPhotoDataUriColored(m.name, c1, c2)} alt="" />
                    <div className="gp-member-name">{m.name}</div>
                    <div className="gp-member-ins">
                      {m.instruments.length ? m.instruments.slice(0, 2).map((ins) => {
                        const icon = instrumentIconFor(ins);
                        return <span key={ins}>{icon && <img src={icon} alt="" />}{ins}</span>;
                      }) : (m.role || "—")}
                    </div>
                    {m.igHandle && <a className="pv-ig" href={`https://instagram.com/${m.igHandle}`} target="_blank" rel="noreferrer">@{m.igHandle}</a>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {figures.length > 0 && (
            <div className="pv-panel">
              <div className="pv-panel-title">En xifres</div>
              <div className="gp-stats">
                {figures.map((f) => (
                  <div key={f.key} className="gp-stat">
                    <span className="gp-stat-n">
                      <span className="bento-social-icon" style={{ background: PLATFORM_META[f.platform].gradient, width: 26, height: 26 }}>{ICONS[f.platform]}</span>
                      {formatNumber(f.value)}
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

      <div className="pf-footer" style={{ paddingBottom: 28 }}>Pàgina de grup generada amb Escenari</div>
    </div>
  );
}
