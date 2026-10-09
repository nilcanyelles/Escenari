"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import { songDurationSecs, formatTotalDuration, type Setlist, type Song } from "@/lib/material-types";
import type { Song as LibrarySong } from "@/lib/songs";
import { uniqueTags, tagColors } from "@/lib/tags";
import { saveSetlistAction, uploadSetlistCoverAction } from "@/app/(app)/grup/material-actions";

function ScoreIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  );
}
function WaveformIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="10" x2="4" y2="14"></line>
      <line x1="9" y1="6" x2="9" y2="18"></line>
      <line x1="14" y1="3" x2="14" y2="21"></line>
      <line x1="19" y1="8" x2="19" y2="16"></line>
    </svg>
  );
}

type EditorBand = Pick<Band, "id" | "name" | "color1" | "logo">;

export default function SetlistEditor({ band, setlist, librarySongs = [], onClose }: { band: EditorBand | null; setlist: Setlist | null; librarySongs?: LibrarySong[]; onClose: () => void }) {
  const router = useRouter();
  const bandName = band?.name || "Les meves cançons";
  const bandColor = band?.color1 || "#8b7bff";
  const [name, setName] = useState(setlist?.name || "Setlist");
  const [songs, setSongs] = useState<Song[]>(setlist?.songs?.length ? setlist.songs : [{ title: "", duration: "", key: "", notes: "" }]);
  const [setlistId, setSetlistId] = useState<string | null>(setlist?.id || null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState(setlist?.coverUrl || "");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      const { id } = await saveSetlistAction({ id: setlistId, bandId: band?.id || null, name, songs });
      setSetlistId(id);
      router.refresh();
      setSaving(false);
    }, 700);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, songs]);

  const totalSecs = songs.reduce((s, song) => s + songDurationSecs(song.duration), 0);

  function handleDrop(i: number) {
    setDragOverIndex(null);
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); return; }
    setSongs((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(dragIndex, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  function update(i: number, patch: Partial<Song>) {
    setSongs((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function addBlank() {
    setSongs((prev) => prev.concat([{ title: "", duration: "", key: "", notes: "" }]));
  }

  function toLibraryEntry(s: LibrarySong): Song {
    return { title: s.title, duration: s.duration, key: s.songKey, notes: "", songId: s.id };
  }
  function addFromLibrary(s: LibrarySong) {
    setSongs((prev) => {
      const base = prev.length === 1 && !prev[0].title.trim() ? [] : prev;
      return base.concat([toLibraryEntry(s)]);
    });
  }
  function addAllFiltered() {
    if (!displaySuggestions.length) return;
    setSongs((prev) => {
      const base = prev.length === 1 && !prev[0].title.trim() ? [] : prev;
      return base.concat(displaySuggestions.map(toLibraryEntry));
    });
  }
  function toggleTag(t: string) {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverPreview(URL.createObjectURL(file));
    setCoverUploading(true);
    // Una setlist nova encara no té id fins al primer autodesat — si encara
    // no n'hi ha, es desa ara mateix per poder-hi penjar la foto.
    let id = setlistId;
    if (!id) {
      const saved = await saveSetlistAction({ id: null, bandId: band?.id || null, name, songs });
      id = saved.id;
      setSetlistId(id);
    }
    const fd = new FormData();
    if (band) fd.set("bandId", band.id);
    fd.set("setlistId", id);
    fd.set("file", file);
    const res = await uploadSetlistCoverAction(fd);
    if (res.ok && res.url) setCoverUrl(res.url);
    setCoverUploading(false);
    router.refresh();
  }

  // Cançó del repertori d'on ve cada entrada (si en ve) — per mostrar-hi
  // la mateixa carátula i etiquetes que al Repertori, no només el títol.
  const librarySongById = new Map(librarySongs.map((s) => [s.id, s]));

  // Cançons del repertori que encara no són en aquesta setlist — es
  // recalcula sol a mesura que n'afegeixes, així els suggeriments sempre
  // reflecteixen el que falta.
  const addedSongIds = new Set(songs.map((s) => s.songId).filter(Boolean));
  const librarySuggestions = librarySongs.filter((s) => !addedSongIds.has(s.id));
  // Etiquetes de les cançons encara no afegides: triar-ne una (o diverses)
  // filtra la llista de sota a les cançons que la tenen.
  const suggestionTags = uniqueTags(librarySuggestions);
  const filteredSuggestions = selectedTags.length
    ? librarySuggestions.filter((s) => s.tags.some((t) => selectedTags.includes(t)))
    : librarySuggestions;
  // Un cop afegides totes les cançons de l'etiqueta triada, no es queda la
  // llista buida: es mostra directament la resta del repertori (sense
  // aquella etiqueta) perquè es pugui continuar afegint-ne.
  const showingOthers = selectedTags.length > 0 && filteredSuggestions.length === 0 && librarySuggestions.length > 0;
  const displaySuggestions = showingOthers ? librarySuggestions : filteredSuggestions;
  // Quina cançó és "visible" ara mateix (ni afegida ni amagada pel filtre
  // d'etiquetes). Es fa servir per amagar-la en lloc de treure-la del
  // renderitzat: així cada bombolla manté sempre la mateixa posició (no hi
  // ha reordenació del flex) tant en afegir una cançó com en triar/treure
  // una etiqueta — només apareix i desapareix al seu lloc.
  function isVisible(s: LibrarySong): boolean {
    if (addedSongIds.has(s.id)) return false;
    if (showingOthers || selectedTags.length === 0) return true;
    return s.tags.some((t) => selectedTags.includes(t));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide setlist-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <button type="button" className="setlist-cover-btn" title="Canvia la foto de la setlist" onClick={() => coverInput.current?.click()}>
            {coverPreview || coverUrl ? (
              <img className="setlist-cover-img" src={coverPreview || coverUrl} alt="" />
            ) : (
              <span className="setlist-cover-placeholder">♪</span>
            )}
            <span className="setlist-cover-edit">{coverUploading ? "…" : "📷"}</span>
          </button>
          <input ref={coverInput} type="file" hidden accept="image/*" onChange={handleCoverChange} />
          <input className="rider-name-input" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="t-dim" style={{ fontSize: 12, marginRight: 12 }}>{saving ? "Desant…" : "Desat ✓"}</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onClose}>✕</button>
        </div>

        <div className="setlist-editor-body">
          <div className="setlist-summary">
            <span>{songs.filter((s) => s.title.trim()).length} cançons</span>
            <span>Durada total: <strong>{formatTotalDuration(totalSecs)}</strong></span>
          </div>

          <div className="setlist-editor-content">
            <div className="sp-list">
              <div className="sp-row sp-head setlist-sp-row">
                <span className="sp-idx">#</span>
                <span></span>
                <span>Cançó</span>
                <span>Comentari</span>
                <span className="sp-actions"></span>
              </div>
              {songs.map((s, i) => {
                const lib = s.songId ? librarySongById.get(s.songId) : undefined;
                const coverColor = bandColor;
                return (
                  <div
                    key={i}
                    className={"sp-row setlist-sp-row" + (dragOverIndex === i ? " setlist-row-dragover" : "") + (dragIndex === i ? " setlist-row-dragging" : "")}
                    onDragOver={(e) => { e.preventDefault(); if (dragIndex !== null && dragOverIndex !== i) setDragOverIndex(i); }}
                    onDragLeave={() => setDragOverIndex((v) => (v === i ? null : v))}
                    onDrop={() => handleDrop(i)}
                  >
                    <span
                      className="sp-idx sp-drag-handle"
                      draggable
                      title="Arrossega per canviar l'ordre"
                      onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ marginRight: 4, opacity: 0.5 }}>
                        <circle cx="8" cy="6" r="1.6"></circle><circle cx="16" cy="6" r="1.6"></circle>
                        <circle cx="8" cy="12" r="1.6"></circle><circle cx="16" cy="12" r="1.6"></circle>
                        <circle cx="8" cy="18" r="1.6"></circle><circle cx="16" cy="18" r="1.6"></circle>
                      </svg>
                      {i + 1}
                    </span>
                    {lib?.coverUrl || band?.logo ? (
                      <img className="sp-cover sp-cover-img" src={lib?.coverUrl || band?.logo} alt="" draggable={false} />
                    ) : (
                      <span className="sp-cover" style={{ background: `linear-gradient(135deg, ${coverColor}, #17141f)` }}>♪</span>
                    )}
                    <span className="sp-title-wrap">
                      <span className="sp-title-row">
                        <input className="setlist-title-input" placeholder="Títol" value={s.title} onChange={(e) => update(i, { title: e.target.value })} />
                        {lib?.tags.map((t) => {
                          const tc = tagColors(t);
                          return <span key={t} className="badge sm" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
                        })}
                      </span>
                      <span className="sp-artist">
                        {bandName}
                        {(() => {
                          if (!lib?.files.length) return null;
                          const scoreCount = lib.files.filter((f) => !f.mime.startsWith("audio")).length;
                          const audioCount = lib.files.length - scoreCount;
                          return (
                            <>
                              {scoreCount > 0 && <span className="sp-file-count" title="Partitures"><ScoreIcon />{scoreCount}</span>}
                              {audioCount > 0 && <span className="sp-file-count" title="Àudios"><WaveformIcon />{audioCount}</span>}
                            </>
                          );
                        })()}
                      </span>
                    </span>
                    <input
                      className="field-input compact-field setlist-comment-input" placeholder="Solo llarg, enllaça amb la següent…"
                      value={s.notes} onChange={(e) => update(i, { notes: e.target.value })}
                    />
                    <span className="sp-actions">
                      <button type="button" className="row-delete-btn" onClick={() => setSongs(songs.filter((_, j) => j !== i))}>✕</button>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="instr-panel">
              <div className="panel-header-row" style={{ marginBottom: 0 }}>
                <div className="instr-cat-title">Del repertori</div>
                {displaySuggestions.length > 0 && (
                  <button type="button" className="link-btn" onClick={addAllFiltered}>+ Afegeix-les totes ({displaySuggestions.length})</button>
                )}
              </div>
              {suggestionTags.length > 0 && (
                <div className="access-box-list">
                  {suggestionTags.map((t) => {
                    const tc = tagColors(t);
                    const active = selectedTags.includes(t);
                    return (
                      <button
                        key={t} type="button" className="badge sm setlist-tag-filter-chip" onClick={() => toggleTag(t)}
                        style={{ background: tc.bg, color: tc.color, boxShadow: active ? `0 0 0 2px ${tc.color}` : "none" }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
              {showingOthers && (
                <div className="t-dim" style={{ fontSize: 12 }}>Ja hi has afegit totes les cançons amb aquesta etiqueta — la resta del repertori:</div>
              )}
              {librarySongs.length > 0 ? (
                <div className="access-box-list">
                  {librarySongs.map((s) => {
                    const visible = isVisible(s);
                    return (
                      <button
                        key={s.id} type="button" className="access-chip"
                        style={visible ? undefined : { visibility: "hidden" }}
                        aria-hidden={!visible}
                        tabIndex={visible ? 0 : -1}
                        onClick={() => visible && addFromLibrary(s)}
                      >
                        + {s.title}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="t-dim" style={{ fontSize: 12 }}>Encara no hi ha cap cançó al repertori.</div>
              )}
              {librarySongs.length > 0 && displaySuggestions.length === 0 && (
                <div className="t-dim" style={{ fontSize: 12 }}>Ja has afegit totes les cançons del repertori.</div>
              )}
            </div>
            <button type="button" className="btn-ghost-sm" onClick={addBlank}>+ Entrada en blanc (fora del repertori)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
