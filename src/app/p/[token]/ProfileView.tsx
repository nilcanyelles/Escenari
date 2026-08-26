"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonProfileData } from "@/lib/person-profile";
import { MONTH_FULL, WEEKDAY_SHORT, pad2, capitalize, formatDate } from "@/lib/format";
import { personPhotoDataUri, bandPhotoDataUri, instrumentIconFor } from "@/lib/tags";
import { updateProfileInfoAction, uploadProfilePhotoAction, updatePersonAction } from "../profile-actions";
import ProfileShareModal from "./ProfileShareModal";

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
    instruments: data.instruments.join(", "),
    bio: data.bio,
    igHandle: data.igHandle,
    hidden: new Set(data.hiddenBands),
  });
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  // localPhoto: vista prèvia immediata just després de pujar una foto nova.
  const photoUrl = localPhoto || (data.photoFileId ? `/api/file/${data.photoFileId}?v=${data.photoFileId}` : personPhotoDataUri(data.name));
  const upcoming = data.concerts.filter((c) => c.date >= today);
  const signedIn = isOwner || isManager;

  async function handleSave() {
    setSaving(true);
    if (canEditAll) {
      await updatePersonAction(data.token, {
        name: form.name,
        instruments: form.instruments.split(",").map((s) => s.trim()).filter(Boolean),
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
            {data.bands.map((b) => (
              <div key={b.id} className="pv-band" style={{ ["--pv-accent" as string]: b.color1 || "#8b7bff" }}>
                <img src={b.logo || bandPhotoDataUri(b)} alt="" />
                <div>
                  <div className="pv-band-name">{b.name}</div>
                  <div className="pv-band-role">{b.instruments.join(", ") || b.role}</div>
                </div>
              </div>
            ))}
            {data.bands.length === 0 && <span className="t-dim" style={{ fontSize: 12.5 }}>Cap grup visible.</span>}
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
                  <div><label className="form-label">Instruments (separats per comes)</label>
                    <input className="field-input form-field" value={form.instruments} onChange={(e) => setForm({ ...form, instruments: e.target.value })} /></div>
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
