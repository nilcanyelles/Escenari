"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import { songDurationSecs, formatTotalDuration, type Setlist, type Song } from "@/lib/material-types";
import type { Song as LibrarySong } from "@/lib/songs";
import { uniqueTags, tagColors } from "@/lib/tags";
import { saveSetlistAction } from "@/app/(app)/grup/material-actions";

export default function SetlistEditor({ band, setlist, librarySongs = [], onClose }: { band: Band; setlist: Setlist | null; librarySongs?: LibrarySong[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(setlist?.name || "Setlist");
  const [songs, setSongs] = useState<Song[]>(setlist?.songs?.length ? setlist.songs : [{ title: "", duration: "", key: "", notes: "" }]);
  const [setlistId, setSetlistId] = useState<string | null>(setlist?.id || null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const saveTimer = useRef<number | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      const { id } = await saveSetlistAction({ id: setlistId, bandId: band.id, name, songs });
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide setlist-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
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
                <span className="sp-dur">⏱</span>
                <span className="sp-actions"></span>
              </div>
              {songs.map((s, i) => {
                const lib = s.songId ? librarySongById.get(s.songId) : undefined;
                const coverColor = band.color1 || "#8b7bff";
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
                    {lib?.coverUrl || band.logo ? (
                      <img className="sp-cover sp-cover-img" src={lib?.coverUrl || band.logo} alt="" draggable={false} />
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
                      <span className="sp-artist">{band.name}{lib?.files.length ? ` · ${lib.files.length} 📎` : ""}</span>
                    </span>
                    <input
                      className="field-input compact-field setlist-comment-input" placeholder="Solo llarg, enllaça amb la següent…"
                      value={s.notes} onChange={(e) => update(i, { notes: e.target.value })}
                    />
                    <span className="sp-dur">{s.duration || "—"}</span>
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
              {displaySuggestions.length > 0 ? (
                <div className="access-box-list">
                  {displaySuggestions.map((s) => (
                    <button key={s.id} type="button" className="access-chip" onClick={() => addFromLibrary(s)}>
                      + {s.title}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="t-dim" style={{ fontSize: 12 }}>
                  {librarySongs.length === 0 ? "Encara no hi ha cap cançó al repertori." : "Ja has afegit totes les cançons del repertori."}
                </div>
              )}
            </div>
            <button type="button" className="btn-ghost-sm" onClick={addBlank}>+ Entrada en blanc (fora del repertori)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
