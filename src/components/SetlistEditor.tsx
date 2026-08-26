"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import { songDurationSecs, formatTotalDuration, type Setlist, type Song } from "@/lib/material-types";
import { saveSetlistAction } from "@/app/(app)/grup/material-actions";

export default function SetlistEditor({ band, setlist, onClose }: { band: Band; setlist: Setlist | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(setlist?.name || "Setlist");
  const [songs, setSongs] = useState<Song[]>(setlist?.songs?.length ? setlist.songs : [{ title: "", duration: "", key: "", notes: "" }]);
  const [setlistId, setSetlistId] = useState<string | null>(setlist?.id || null);
  const [saving, setSaving] = useState(false);
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
          <button type="button" className="btn-outline" style={{ alignSelf: "flex-start" }}
            onClick={() => setSongs(songs.concat([{ title: "", duration: "", key: "", notes: "" }]))}>+ Afegeix cançó</button>
        </div>
      </div>
    </div>
  );
}
