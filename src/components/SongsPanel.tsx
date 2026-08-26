"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import type { Song } from "@/lib/songs";
import { transposeChord, parseChordLine, hasChords } from "@/lib/songs";
import { saveSongAction, deleteSongAction, importSongsAction, uploadFileAction, deleteFileAction } from "@/app/(app)/grup/songs-actions";
import SpecularButton from "@/components/SpecularButton";

function fmtSize(bytes: number): string {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

// Lletra amb acords [Am] pintats damunt del text, amb transposició.
export function LyricsView({ lyrics, semitones }: { lyrics: string; semitones: number }) {
  return (
    <div className="lyrics-view">
      {lyrics.split("\n").map((line, i) => {
        const chunks = parseChordLine(line);
        const anyChord = chunks.some((c) => c.chord);
        if (!anyChord) return <div key={i} className="lyrics-line">{line || " "}</div>;
        return (
          <div key={i} className="lyrics-line lyrics-line-chords">
            {chunks.map((c, j) => (
              <span key={j} className="lyrics-chunk">
                <span className="lyrics-chord">{c.chord ? transposeChord(c.chord, semitones) : " "}</span>
                <span>{c.text || (c.chord ? " " : "")}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SongEditor({ band, song, canEdit, onClose }: { band: Band; song: Song | null; canEdit: boolean; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: song?.title || "",
    artist: song?.artist || "",
    tempo: song?.tempo ? String(song.tempo) : "",
    songKey: song?.songKey || "",
    duration: song?.duration || "",
    notes: song?.notes || "",
    lyrics: song?.lyrics || "",
  });
  const [songId, setSongId] = useState<string | null>(song?.id || null);
  const [semitones, setSemitones] = useState(0);
  const [tab, setTab] = useState<"edita" | "vista">(song?.lyrics ? "vista" : "edita");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function persist(): Promise<string | null> {
    setSaving(true);
    const { id } = await saveSongAction({
      id: songId, bandId: band.id, title: form.title, artist: form.artist,
      tempo: parseInt(form.tempo, 10) || 0, songKey: form.songKey, duration: form.duration,
      notes: form.notes, lyrics: form.lyrics,
    });
    setSongId(id);
    router.refresh();
    setSaving(false);
    return id;
  }

  async function handleUpload(file: File) {
    const id = songId || (await persist());
    if (!id) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("bandId", band.id);
    fd.set("songId", id);
    fd.set("file", file);
    const res = await uploadFileAction(fd);
    if (!res.ok) alert(res.error);
    router.refresh();
    setUploading(false);
  }

  // Memo de veu: grava directament dins de l'app.
  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const ext = (rec.mimeType || "").includes("mp4") ? "m4a" : "webm";
        await handleUpload(new File([blob], `memo-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`, { type: blob.type }));
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      alert("No s'ha pogut accedir al micròfon.");
    }
  }

  const files = song?.files || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide song-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <input className="rider-name-input" placeholder="Títol de la cançó" value={form.title} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, title: e.target.value })} onBlur={() => canEdit && persist()} />
          <div className="t-dim" style={{ fontSize: 12, marginRight: 12 }}>{saving ? "Desant…" : songId ? "Desat ✓" : ""}</div>
          <button className="cf-head-close" onClick={onClose}>✕</button>
        </div>

        <div className="song-editor-body">
          <div className="song-meta-row">
            <label className="song-meta">Artista<input className="field-input compact-field" value={form.artist} disabled={!canEdit} onChange={(e) => setForm({ ...form, artist: e.target.value })} onBlur={() => canEdit && persist()} /></label>
            <label className="song-meta">Tempo (BPM)<input className="field-input compact-field" type="number" value={form.tempo} disabled={!canEdit} onChange={(e) => setForm({ ...form, tempo: e.target.value })} onBlur={() => canEdit && persist()} /></label>
            <label className="song-meta">To<input className="field-input compact-field" placeholder="Am" value={form.songKey} disabled={!canEdit} onChange={(e) => setForm({ ...form, songKey: e.target.value })} onBlur={() => canEdit && persist()} /></label>
            <label className="song-meta">Durada<input className="field-input compact-field" placeholder="3:45" value={form.duration} disabled={!canEdit} onChange={(e) => setForm({ ...form, duration: e.target.value })} onBlur={() => canEdit && persist()} /></label>
          </div>

          <div className="song-lyrics-head">
            <div className="stats-tabs">
              <button className={"stats-tab" + (tab === "edita" ? " active" : "")} onClick={() => setTab("edita")}>Edita</button>
              <button className={"stats-tab" + (tab === "vista" ? " active" : "")} onClick={() => setTab("vista")}>Vista</button>
            </div>
            {hasChords(form.lyrics) && (
              <div className="transpose-ctl">
                Transposa
                <button type="button" onClick={() => setSemitones((s) => s - 1)}>−</button>
                <span className="transpose-val">{semitones > 0 ? "+" + semitones : semitones}</span>
                <button type="button" onClick={() => setSemitones((s) => s + 1)}>+</button>
              </div>
            )}
          </div>

          {tab === "edita" ? (
            <>
              <textarea
                className="field-input rider-textarea song-lyrics-input" rows={12} disabled={!canEdit}
                placeholder={"Lletra amb acords entre claudàtors:\n[Am]Quan surt el [F]sol a la pla[C]ça…"}
                value={form.lyrics}
                onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
                onBlur={() => canEdit && persist()}
              />
              <div className="t-dim" style={{ fontSize: 11 }}>Format ChordPro: escriu els acords entre [claudàtors] i sortiran damunt de la lletra.</div>
            </>
          ) : (
            form.lyrics.trim() ? <LyricsView lyrics={form.lyrics} semitones={semitones} /> : <div className="t-dim" style={{ fontSize: 13 }}>Sense lletra encara.</div>
          )}

          <label className="song-meta" style={{ width: "100%" }}>Notes
            <textarea className="field-input rider-textarea" rows={2} value={form.notes} disabled={!canEdit} onChange={(e) => setForm({ ...form, notes: e.target.value })} onBlur={() => canEdit && persist()} />
          </label>

          {/* Adjunts */}
          <div className="rider-block-head">
            <div className="rider-block-title">Gravacions i documents</div>
            {canEdit && (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={"btn-outline" + (recording ? " rec-active" : "")} onClick={toggleRecording}>
                  {recording ? "⏹ Atura la gravació" : "🎙 Memo de veu"}
                </button>
                <button type="button" className="btn-outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  {uploading ? "Pujant…" : "+ Adjunta fitxer"}
                </button>
                <input ref={fileInput} type="file" hidden accept=".mp3,.m4a,.wav,.ogg,.aac,.mp4,.mov,.pdf,.jpg,.jpeg,.png,.txt,.docx"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
              </div>
            )}
          </div>
          {files.length === 0 ? (
            <div className="t-dim" style={{ fontSize: 12 }}>Adjunta gravacions de referència, partitures en PDF o vídeos (màx. 15 MB per fitxer).</div>
          ) : (
            <div className="file-list">
              {files.map((f) => (
                <div key={f.id} className="file-row">
                  <span className="file-icon">{f.mime.startsWith("audio") ? "🎧" : f.mime.startsWith("video") ? "🎬" : f.mime.includes("pdf") ? "📄" : "📎"}</span>
                  <div className="file-row-main">
                    <a href={`/api/file/${f.id}`} target="_blank" rel="noreferrer" className="file-name">{f.name}</a>
                    {f.mime.startsWith("audio") && <audio controls preload="none" src={`/api/file/${f.id}`} className="file-audio" />}
                  </div>
                  <span className="t-dim" style={{ fontSize: 11 }}>{fmtSize(f.size)}</span>
                  {canEdit && (
                    <button type="button" className="row-delete-btn" onClick={async () => { await deleteFileAction(band.id, f.id); router.refresh(); }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SongsPanel({ band, songs, canEdit }: { band: Band; songs: Song[]; canEdit: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ song: Song | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  const q = search.trim().toLowerCase();
  const list = songs.filter((s) => !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  const editingSong = editing?.song ? songs.find((s) => s.id === editing.song!.id) || editing.song : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 12 }}>
          <div className="panel-title">Repertori</div>
          {canEdit && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button type="button" className="btn-outline" onClick={() => setImportOpen((v) => !v)}>Importa</button>
              <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.3} baseColor="#8b7bff" lineColor="#ffffff" onClick={() => setEditing({ song: null })}>
                + Nova cançó
              </SpecularButton>
            </div>
          )}
        </div>

        {importOpen && (
          <div className="import-box">
            <div className="t-dim" style={{ fontSize: 12 }}>Una cançó per línia: <code>Títol; Artista; Durada; To; Tempo</code> (només el títol és obligatori).</div>
            <textarea className="field-input rider-textarea" rows={5} value={importText} onChange={(e) => setImportText(e.target.value)}
              placeholder={"La nit és nostra; ; 3:45; Am; 120\nCamins; Sopa de Cabra; 4:10; C"} />
            <button type="button" className="btn-save" disabled={importing} style={{ alignSelf: "flex-start" }}
              onClick={async () => {
                setImporting(true);
                const { imported } = await importSongsAction(band.id, importText);
                setImportText(""); setImportOpen(false); setImporting(false);
                router.refresh();
                alert(`${imported} cançons importades.`);
              }}>{importing ? "Important…" : "Importa"}</button>
          </div>
        )}

        <input className="input search" style={{ marginBottom: 12, maxWidth: 320 }} placeholder="Cerca per títol o artista…" value={search} onChange={(e) => setSearch(e.target.value)} />

        {list.length === 0 ? (
          <div className="empty-state">{songs.length ? "Cap cançó coincideix amb la cerca." : "Encara no hi ha cançons al repertori."}</div>
        ) : (
          <div className="song-list">
            <div className="t-row t-head song-cols"><div>Títol</div><div>Artista</div><div>To</div><div>Tempo</div><div>Durada</div><div>Adjunts</div><div></div></div>
            {list.map((s) => (
              <div key={s.id} className="t-row song-cols clickable" onClick={() => setEditing({ song: s })}>
                <div className="t-strong">{s.title}{hasChords(s.lyrics) && <span className="song-chord-badge" title="Té acords">♪</span>}</div>
                <div className="t-dim">{s.artist || "—"}</div>
                <div className="t-dim">{s.songKey || "—"}</div>
                <div className="t-dim">{s.tempo || "—"}</div>
                <div className="t-dim">{s.duration || "—"}</div>
                <div className="t-dim">{s.files.length ? `${s.files.length} 📎` : "—"}</div>
                <div onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <button type="button" className="row-delete-btn" title="Elimina"
                      onClick={async () => {
                        if (!confirm(`Eliminar "${s.title}" del repertori?`)) return;
                        await deleteSongAction(band.id, s.id);
                        router.refresh();
                      }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && <SongEditor band={band} song={editingSong} canEdit={canEdit} onClose={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}
