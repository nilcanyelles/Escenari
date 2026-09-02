"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import { songDurationSecs, formatTotalDuration, type Setlist, type Song } from "@/lib/material-types";
import type { Song as LibrarySong } from "@/lib/songs";
import { saveSetlistAction } from "@/app/(app)/grup/material-actions";

export default function SetlistEditor({ band, setlist, librarySongs = [], onClose }: { band: Band; setlist: Setlist | null; librarySongs?: LibrarySong[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(setlist?.name || "Setlist");
  const [songs, setSongs] = useState<Song[]>(setlist?.songs?.length ? setlist.songs : [{ title: "", duration: "", key: "", notes: "" }]);
  const [setlistId, setSetlistId] = useState<string | null>(setlist?.id || null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
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

  function addFromLibrary(s: LibrarySong) {
    setSongs((prev) => {
      const base = prev.length === 1 && !prev[0].title.trim() ? [] : prev;
      return base.concat([{ title: s.title, duration: s.duration, key: s.songKey, notes: "", songId: s.id }]);
    });
  }

  // Cançons del repertori que encara no són en aquesta setlist — es
  // recalcula sol a mesura que n'afegeixes, així els suggeriments sempre
  // reflecteixen el que falta.
  const addedSongIds = new Set(songs.map((s) => s.songId).filter(Boolean));
  const librarySuggestions = librarySongs.filter((s) => !addedSongIds.has(s.id));

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

          <div className="rider-table">
            <div className="rider-table-head setlist-cols">
              <div className="setlist-title-cell"><span className="setlist-num-head">#</span>Cançó</div>
              <div>Notes</div>
              <div></div>
            </div>
            {songs.map((s, i) => (
              <div
                key={i}
                className={"rider-table-row setlist-cols" + (dragOverIndex === i ? " setlist-row-dragover" : "") + (dragIndex === i ? " setlist-row-dragging" : "")}
                onDragOver={(e) => { e.preventDefault(); if (dragIndex !== null && dragOverIndex !== i) setDragOverIndex(i); }}
                onDragLeave={() => setDragOverIndex((v) => (v === i ? null : v))}
                onDrop={() => handleDrop(i)}
              >
                <div className="setlist-title-cell">
                  <div className="setlist-order">
                    <span
                      className="setlist-drag-handle"
                      draggable
                      title="Arrossega per canviar l'ordre"
                      onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                    >⠿</span>
                    <span className="setlist-num">{i + 1}</span>
                  </div>
                  <input className="field-input compact-field" placeholder="Títol" value={s.title} onChange={(e) => update(i, { title: e.target.value })} />
                </div>
                <input className="field-input compact-field" placeholder="Solo llarg, enllaça amb la següent…" value={s.notes} onChange={(e) => update(i, { notes: e.target.value })} />
                <button type="button" className="row-delete-btn" onClick={() => setSongs(songs.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
          <div className="instr-panel">
            <div>
              <div className="instr-cat-title">Del repertori</div>
              {librarySuggestions.length > 0 ? (
                <div className="access-box-list">
                  {librarySuggestions.map((s) => (
                    <button key={s.id} type="button" className="access-chip" onClick={() => addFromLibrary(s)}>
                      {s.title}
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
