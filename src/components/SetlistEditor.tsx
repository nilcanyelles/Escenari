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
  const [addMenuOpen, setAddMenuOpen] = useState(false);
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

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= songs.length) return;
    const next = songs.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setSongs(next);
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
            <div className="rider-table-head setlist-cols"><div>#</div><div>Cançó</div><div>Durada</div><div>To</div><div>Notes</div><div></div></div>
            {songs.map((s, i) => (
              <div key={i} className="rider-table-row setlist-cols">
                <div className="setlist-order">
                  <span className="setlist-num">{i + 1}</span>
                  <span className="setlist-arrows">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>▲</button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === songs.length - 1}>▼</button>
                  </span>
                </div>
                <input className="field-input compact-field" placeholder="Títol" value={s.title} onChange={(e) => update(i, { title: e.target.value })} />
                <input className="field-input compact-field" placeholder="3:45" value={s.duration} onChange={(e) => update(i, { duration: e.target.value })} />
                <input className="field-input compact-field" placeholder="Am" value={s.key} onChange={(e) => update(i, { key: e.target.value })} />
                <input className="field-input compact-field" placeholder="Solo llarg, enllaça amb la següent…" value={s.notes} onChange={(e) => update(i, { notes: e.target.value })} />
                <button type="button" className="row-delete-btn" onClick={() => setSongs(songs.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
          <div>
            <button type="button" className="btn-outline" onClick={() => setAddMenuOpen((o) => !o)}>
              {addMenuOpen ? "Amaga els suggeriments ▲" : "+ Afegeix cançó…"}
            </button>
            {addMenuOpen && (
              <div className="instr-panel">
                <div>
                  <div className="instr-cat-title">Del repertori</div>
                  {librarySuggestions.length > 0 ? (
                    <div className="access-box-list">
                      {librarySuggestions.map((s) => (
                        <button key={s.id} type="button" className="access-chip" onClick={() => addFromLibrary(s)}>
                          {s.title}{s.duration ? ` · ${s.duration}` : ""}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="t-dim" style={{ fontSize: 12 }}>
                      {librarySongs.length === 0 ? "Encara no hi ha cap cançó al repertori." : "Ja hi són totes les cançons del repertori."}
                    </div>
                  )}
                </div>
                <button type="button" className="btn-ghost-sm" onClick={addBlank}>+ Entrada en blanc (fora del repertori)</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
