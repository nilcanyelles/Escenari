"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonProfileData } from "@/lib/person-profile";
import { MONTH_FULL, WEEKDAY_SHORT, pad2, capitalize, formatDate } from "@/lib/format";
import { personPhotoDataUri, bandPhotoDataUri, instrumentIconFor } from "@/lib/tags";
import { updateProfileInfoAction, uploadProfilePhotoAction, updatePersonAction } from "../profile-actions";
import { setMemberPermAction } from "@/app/(app)/grup/actions";
import { DEFAULT_PERMS, PERM_LABELS } from "@/lib/perms";
import type { MemberPerms } from "@/lib/types";
import ProfileShareModal from "./ProfileShareModal";
import InstrumentPicker from "@/components/InstrumentPicker";

// Permisos del membre en un grup, editables pel gestor des del perfil.
function BandPermsRow({ bandId, memberName, initial }: { bandId: string; memberName: string; initial: Partial<MemberPerms> }) {
  const router = useRouter();
  const [perms, setPerms] = useState<MemberPerms>({ ...DEFAULT_PERMS, ...initial });
  return (
    <div className="perm-row" style={{ marginTop: 6 }}>
      {PERM_LABELS.map(({ key, label }) => (
        <button
          key={key} type="button"
          className={"perm-chip" + (perms[key] ? " on" : "")}
          title={`${label}: ${perms[key] ? "permès (clic per treure)" : "no permès (clic per donar)"}`}
          onClick={async () => {
            const v = !perms[key];
            setPerms((p) => ({ ...p, [key]: v }));
            await setMemberPermAction(bandId, memberName, key, v);
            router.refresh();
          }}
        >{label}</button>
      ))}
    </div>
  );
}

// Calendari mensual amb l'estat d'assistència de la persona a cada bolo.
function AttendanceCalendar({ concerts, today }: { concerts: PersonProfileData["concerts"]; today: string }) {
  const [ym, setYm] = useState(() => today.slice(0, 7));
  const [y, m] = ym.split("-").map(Number);

  function shift(delta: number) {
    let mm = m + delta, yy = y;
    if (mm < 1) { mm = 12; yy--; }
    if (mm > 12) { mm = 1; yy++; }
    setYm(`${yy}-${pad2(mm)}`);
  }

  const base = new Date(y, m - 1, 1);
  const startOffset = (base.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDay = useMemo(() => {
    const map: Record<number, PersonProfileData["concerts"]> = {};
    concerts.forEach((c) => {
      if (c.date.slice(0, 7) !== ym) return;
      const d = parseInt(c.date.slice(8, 10), 10);
      (map[d] = map[d] || []).push(c);
    });
    return map;
  }, [concerts, ym]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="pv-cal">
      <div className="pv-cal-head">
        <button type="button" className="cal-nav-btn" onClick={() => shift(-1)}>‹</button>
        <span className="pv-cal-title">{capitalize(MONTH_FULL[m - 1])} {y}</span>
        <button type="button" className="cal-nav-btn" onClick={() => shift(1)}>›</button>
        <div className="pv-cal-legend">
          <span><i className="pv-dot yes"></i>Confirmat</span>
          <span><i className="pv-dot pending"></i>Pendent</span>
          <span><i className="pv-dot no"></i>No pot</span>
        </div>
      </div>
      <div className="pv-cal-grid">
        {WEEKDAY_SHORT.map((w) => <div key={w} className="pv-cal-wd">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={"e" + i} className="pv-cal-day empty"></div>;
          const evs = byDay[d] || [];
          const dateStr = `${ym}-${pad2(d)}`;
          return (
            <div key={dateStr} className={"pv-cal-day" + (dateStr === today ? " today" : "") + (evs.length ? " has" : "")}>
              <span className="pv-cal-num">{d}</span>
              <div className="pv-cal-evs">
                {evs.slice(0, 2).map((c) => (
                  <div key={c.id} className={"pv-cal-ev " + c.answer} title={`${c.bandName} · ${c.city || c.venue}`}>
                    {(c.city || c.venue || c.bandName).split(",")[0]}
                  </div>
                ))}
                {evs.length > 2 && <div className="pv-cal-ev more">+{evs.length - 2}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProfileView({ data, isOwner, isManager, today }: {
  data: PersonProfileData;
  isOwner: boolean;
  isManager: boolean;
  today: string;
}) {
  const router = useRouter();
  const canEditAll = isOwner || (isManager && !data.clerkUserId);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: data.name,
    instruments: data.instruments,
    bio: data.bio,
    igHandle: data.igHandle,
    phone: data.phone,
    email: data.email,
    hidden: new Set(data.hiddenBands),
  });
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email).then(() => {
      setEmailCopied(true);
      window.setTimeout(() => setEmailCopied(false), 1500);
    });
  }

  // localPhoto: vista prèvia immediata just després de pujar una foto nova.
  const photoUrl = localPhoto || (data.photoFileId ? `/api/file/${data.photoFileId}?v=${data.photoFileId}` : personPhotoDataUri(data.name));
  const upcoming = data.concerts.filter((c) => c.date >= today);
  const signedIn = isOwner || isManager;

  // Grups del perfil: si és músic i crew del mateix grup alhora, una sola
  // entrada amb els dos rols junts, no dues de separades.
  const groupEntries = (() => {
    const byBandId = new Map<string, { bandId: string; name: string; logo: string; color1: string; roleText: string }>();
    data.bands.forEach((b) => {
      byBandId.set(b.id, { bandId: b.id, name: b.name, logo: b.logo, color1: b.color1, roleText: b.instruments.join(", ") || b.role });
    });
    data.crewRoles.forEach((c) => {
      const crewText = c.role || "Crew";
      const existing = byBandId.get(c.bandId);
      if (existing) existing.roleText = `${existing.roleText} · ${crewText}`;
      else byBandId.set(c.bandId, { bandId: c.bandId, name: c.bandName, logo: c.logo, color1: c.color1, roleText: crewText });
    });
    return Array.from(byBandId.values());
  })();

  async function handleSave() {
    setSaving(true);
    if (canEditAll) {
      await updatePersonAction(data.token, {
        name: form.name,
        instruments: form.instruments,
        phone: form.phone,
        email: form.email,
      });
    }
    if (isOwner || (isManager && !data.clerkUserId)) {
      await updateProfileInfoAction(data.token, {
        bio: form.bio,
        igHandle: form.igHandle,
        hiddenBands: Array.from(form.hidden),
      });
    }
    setEditOpen(false);
    router.refresh();
    setSaving(false);
  }

  function togglePlay(songId: string, fileId: string) {
    if (playing === songId) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = `/api/file/${fileId}`;
    audioRef.current.play();
    audioRef.current.onended = () => setPlaying(null);
    setPlaying(songId);
  }

  return (
    <div className="pv">
      {/* Barra superior */}
      <div className="pv-topbar">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {isManager && <button type="button" className="cd-back" style={{ border: "none", background: "transparent", cursor: "pointer", font: "inherit" }} onClick={() => router.push("/grup")}>← Torna al grup</button>}
          {isOwner && !isManager && <button type="button" className="cd-back" style={{ border: "none", background: "transparent", cursor: "pointer", font: "inherit" }} onClick={() => router.push("/artista")}>← Els meus bolos</button>}
          <span className="pf-brand" style={{ margin: 0 }}>ESCENARI</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {(isOwner || isManager) && !editOpen && (
            <button type="button" className="btn-outline" onClick={() => setEditOpen(true)}>Edita el perfil</button>
          )}
          <button type="button" className="btn-save" onClick={() => setShareOpen(true)}>Comparteix</button>
        </div>
      </div>

      <div className="pv-grid">
        {/* Columna esquerra: identitat */}
        <aside className="pv-side">
          <div className="pv-photo-wrap">
            <img className="pv-photo" src={photoUrl} alt={data.name} />
            {(isOwner || isManager) && (
              <>
                <button type="button" className="pv-photo-edit" title="Canvia la foto" onClick={() => photoInput.current?.click()}>📷</button>
                <input ref={photoInput} type="file" hidden accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.set("token", data.token);
                    fd.set("file", f);
                    const res = await uploadProfilePhotoAction(fd);
                    if (!res.ok) alert(res.error);
                    else setLocalPhoto(URL.createObjectURL(f)); // vista prèvia immediata
                    router.refresh();
                    e.target.value = "";
                  }} />
              </>
            )}
          </div>

          <h1 className="pv-name">{data.name}</h1>
          {data.igHandle && (
            <a className="pv-ig" href={`https://instagram.com/${data.igHandle}`} target="_blank" rel="noreferrer">@{data.igHandle}</a>
          )}
          {data.bio && <p className="pv-bio">{data.bio}</p>}

          {(data.phone || data.email || data.igHandle) && (
              <div className="pv-contact">
                {data.phone && (
                  <a className="pv-contact-btn" href={`tel:${data.phone.replace(/\s/g, "")}`} title={`Truca — ${data.phone}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  </a>
                )}
                {data.phone && (
                  <a className="pv-contact-btn" href={`https://wa.me/${data.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                  </a>
                )}
                {data.email && (
                  <span style={{ position: "relative" }}>
                    <button type="button" className="pv-contact-btn" title={emailCopied ? "Correu copiat" : `Copia el correu — ${data.email}`} onClick={() => copyEmail(data.email)}>
                      {emailCopied ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 6-10 7L2 6"></path></svg>
                      )}
                    </button>
                    {emailCopied && <span className="copy-email-toast">{data.email} copiat</span>}
                  </span>
                )}
                {data.igHandle && (
                  <a className="pv-contact-btn" href={`https://instagram.com/${data.igHandle}`} target="_blank" rel="noreferrer" title={`Instagram — @${data.igHandle}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                  </a>
                )}
              </div>
          )}

          <div className="pv-stats">
            <div className="pv-stat"><span className="pv-stat-n">{data.totalConcerts}</span><span>concerts fets</span></div>
            <div className="pv-stat"><span className="pv-stat-n">{upcoming.length}</span><span>a la vista</span></div>
            {data.since && <div className="pv-stat"><span className="pv-stat-n">{data.since}</span><span>en actiu des de</span></div>}
          </div>

          <div className="pv-section-title">Instruments</div>
          <div className="pv-chips">
            {data.instruments.length ? data.instruments.map((ins) => {
              const icon = instrumentIconFor(ins);
              return <span key={ins} className="pv-chip">{icon && <img src={icon} alt="" />}{ins}</span>;
            }) : <span className="t-dim" style={{ fontSize: 12.5 }}>—</span>}
          </div>

          <div className="pv-section-title">Grups</div>
          <div className="pv-bands">
            {/* Com a músic i com a crew: si és totes dues coses del mateix
                grup, una sola entrada amb els dos rols junts (instrument i
                càrrec); si són grups diferents, una entrada per cada un. */}
            {groupEntries.map((g) => (
              <div key={g.bandId} className="pv-band" style={{ ["--pv-accent" as string]: g.color1 || "#8b7bff", flexWrap: "wrap" }}>
                <img src={g.logo || bandPhotoDataUri({ id: g.bandId, name: g.name })} alt="" />
                <div>
                  <div className="pv-band-name">{g.name}</div>
                  <div className="pv-band-role">{g.roleText}</div>
                </div>
              </div>
            ))}
            {groupEntries.length === 0 && <span className="t-dim" style={{ fontSize: 12.5 }}>Cap grup visible.</span>}
          </div>
        </aside>

        {/* Columna dreta: calendari + cançons */}
        <main className="pv-main">
          <div className="pv-panel">
            <div className="pv-panel-title">Calendari de bolos</div>
            <AttendanceCalendar concerts={data.concerts} today={today} />
          </div>

          <div className="pv-panel">
            <div className="pv-panel-title">
              Cançons que toca
              <span className="t-dim" style={{ fontSize: 12, fontWeight: 400, marginLeft: 10 }}>{data.songs.length} temes</span>
            </div>
            {data.songs.length === 0 ? (
              <div className="t-dim" style={{ fontSize: 13 }}>Els seus grups encara no tenen repertori penjat.</div>
            ) : (
              <div className="sp-list">
                <div className="sp-row sp-head">
                  <span className="sp-idx">#</span>
                  <span></span>
                  <span>Títol</span>
                  <span className="sp-band-col">Grup</span>
                  <span className="sp-dur">⏱</span>
                </div>
                {data.songs.map((s, i) => (
                  <div key={s.id} className={"sp-row" + (playing === s.id ? " playing" : "")}>
                    <span className="sp-idx">
                      {signedIn && s.audioFileId ? (
                        <button type="button" className="sp-play" onClick={() => togglePlay(s.id, s.audioFileId!)}>
                          {playing === s.id ? "❚❚" : "▶"}
                        </button>
                      ) : (
                        <span className="sp-num">{i + 1}</span>
                      )}
                    </span>
                    {s.coverUrl || s.bandLogo ? (
                      <img className="sp-cover sp-cover-img" src={s.coverUrl || s.bandLogo} alt="" loading="lazy" />
                    ) : (
                      <span className="sp-cover" style={{ background: `linear-gradient(135deg, ${s.bandColor}, #17141f)` }}>♪</span>
                    )}
                    <span className="sp-title-wrap">
                      <span className="sp-title">{s.title}</span>
                      <span className="sp-artist">{s.artist || s.bandName}</span>
                    </span>
                    <span className="sp-band-col">{s.bandName}</span>
                    <span className="sp-dur">{s.duration || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Editor */}
      {editOpen && (
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Edita el perfil</div>
              <button className="cf-head-close" onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <div className="modal-form" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {canEditAll ? (
                <>
                  <div><label className="form-label">Nom</label>
                    <input className="field-input form-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><label className="form-label">Instruments</label>
                    <InstrumentPicker value={form.instruments} onChange={(next) => setForm({ ...form, instruments: next })} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div><label className="form-label">Telèfon (trucades i WhatsApp)</label>
                      <input className="field-input form-field" placeholder="+34 600 000 000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><label className="form-label">Correu</label>
                      <input className="field-input form-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  </div>
                </>
              ) : (
                <div className="t-dim" style={{ fontSize: 12.5 }}>
                  Aquest músic té compte d&apos;Escenari: el nom i els instruments els gestiona des del seu perfil.
                </div>
              )}
              {(isOwner || (isManager && !data.clerkUserId)) && (
                <>
                  <div><label className="form-label">Bio</label>
                    <textarea className="field-input rider-textarea" rows={3} placeholder="Presenta't en dues frases…" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
                  <div><label className="form-label">Instagram</label>
                    <input className="field-input form-field" placeholder="@elteuusuari" value={form.igHandle} onChange={(e) => setForm({ ...form, igHandle: e.target.value })} /></div>
                  <div>
                    <label className="form-label">Grups visibles al perfil públic</label>
                    <div className="access-box-list" style={{ marginTop: 6 }}>
                      {data.allBandIds.map((b) => {
                        const visible = !form.hidden.has(b.id);
                        return (
                          <button key={b.id} type="button" className={"access-chip" + (visible ? " active" : "")}
                            onClick={() => {
                              const next = new Set(form.hidden);
                              if (visible) next.add(b.id); else next.delete(b.id);
                              setForm({ ...form, hidden: next });
                            }}>{visible ? "✓ " : ""}{b.name}</button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              <div className="modal-actions">
                <div className="spacer"></div>
                <button className="btn-outline" onClick={() => setEditOpen(false)}>Cancel·la</button>
                <button className="btn-save" disabled={saving} onClick={handleSave}>{saving ? "Desant…" : "Desa"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shareOpen && <ProfileShareModal data={data} photoUrl={photoUrl} onClose={() => setShareOpen(false)} />}

      <div className="pf-footer" style={{ paddingBottom: 28 }}>Perfil de músic generat amb Escenari</div>
    </div>
  );
}
