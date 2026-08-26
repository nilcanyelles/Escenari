"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Song } from "@/lib/songs";
import { hasChords } from "@/lib/songs";
import { instrumentIconFor, INSTRUMENT_PRESETS } from "@/lib/tags";
import { LyricsView } from "@/components/SongsPanel";
import { saveSongAction, uploadFileAction, deleteFileAction, lookupSongAction } from "@/app/(app)/grup/songs-actions";
import SpecularButton from "@/components/SpecularButton";

function fmtSize(bytes: number): string {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

export default function SongStudio({ song, bandId, bandName, bandLogo, bandColor, bandInstruments, backHref }: {
  song: Song;
  bandId: string;
  bandName: string;
  bandLogo: string;
  bandColor: string;
  bandInstruments: string[];
  backHref: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: song.title,
    artist: song.artist,
    tempo: song.tempo ? String(song.tempo) : "",
    songKey: song.songKey,
    duration: song.duration,
    notes: song.notes,
    lyrics: song.lyrics,
    coverUrl: song.coverUrl,
  });
  const [instruments, setInstruments] = useState<string[]>(song.instruments || []);
  const [customIns, setCustomIns] = useState("");
  const [semitones, setSemitones] = useState(0);
  const [tab, setTab] = useState<"edita" | "vista">(song.lyrics ? "vista" : "edita");
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // "" general, o instrument
  const [recording, setRecording] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadForRef = useRef<string>("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const saveTimer = useRef<number | null>(null);
  const isFirst = useRef(true);

  // Desat automàtic amb debounce.
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      await saveSongAction({
        id: song.id, bandId, title: form.title, artist: form.artist,
        tempo: parseInt(form.tempo, 10) || 0, songKey: form.songKey, duration: form.duration,
        notes: form.notes, lyrics: form.lyrics, coverUrl: form.coverUrl, instruments,
      });
      router.refresh();
      setSaving(false);
    }, 700);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, instruments]);

  async function handleLookup() {
    if (!form.title.trim()) { setLookupMsg("Escriu primer el títol"); return; }
    setLooking(true);
    setLookupMsg(null);
    const res = await lookupSongAction(bandId, form.title, form.artist);
    if (!res.found) setLookupMsg("No s'ha trobat res 😕");
    else {
      setForm((p) => ({
        ...p,
        artist: p.artist || res.artist || "",
        duration: p.duration || res.duration || "",
        tempo: p.tempo || (res.bpm ? String(res.bpm) : ""),
        coverUrl: res.coverUrl || p.coverUrl,
        lyrics: p.lyrics.trim() ? p.lyrics : (res.lyrics || ""),
      }));
      setLookupMsg("Dades trobades ✓");
    }
    setLooking(false);
  }

  async function doUpload(file: File, instrument: string) {
    setUploading(instrument || "general");
    const fd = new FormData();
    fd.set("bandId", bandId);
    fd.set("songId", song.id);
    fd.set("instrument", instrument);
    fd.set("file", file);
    const res = await uploadFileAction(fd);
    if (!res.ok) alert(res.error);
    router.refresh();
    setUploading(null);
  }

  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); return; }
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
        await doUpload(new File([blob], `memo-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`, { type: blob.type }), "");
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      alert("No s'ha pogut accedir al micròfon.");
    }
  }

  function toggleInstrument(ins: string) {
    setInstruments((prev) => {
      const k = ins.toLowerCase();
      return prev.some((x) => x.toLowerCase() === k) ? prev.filter((x) => x.toLowerCase() !== k) : prev.concat([ins]);
    });
  }

  const generalFiles = song.files.filter((f) => !f.instrument);
  const scoresByInstrument = (ins: string) => song.files.filter((f) => f.instrument.toLowerCase() === ins.toLowerCase());
  const allChips = Array.from(new Set([...bandInstruments, ...instruments]));

  return (
    <div className="studio">
      {/* Barra superior */}
      <div className="studio-topbar">
        <Link href={backHref} className="cd-back">← Surt</Link>
        <div className="studio-band-name">{bandName}</div>
        <input className="rider-name-input studio-name" value={form.title} placeholder="Títol de la cançó"
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div className="studio-topbar-right">
          <span className="t-dim" style={{ fontSize: 12 }}>{saving ? "Desant…" : "Desat ✓"}</span>
          <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.3} baseColor="#8b7bff" lineColor="#ffffff" disabled={looking} onClick={handleLookup}>
            {looking ? "Cercant…" : "🔍 Autocompleta"}
          </SpecularButton>
        </div>
      </div>
      {lookupMsg && <div className="ss-lookup-msg">{lookupMsg}</div>}

      <div className="ss-body">
        {/* Lletra i acords */}
        <div className="ss-main">
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
                className="field-input rider-textarea ss-lyrics"
                placeholder={"Lletra amb acords entre claudàtors:\n[Am]Quan surt el [F]sol a la pla[C]ça…"}
                value={form.lyrics}
                onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
              />
              <div className="t-dim" style={{ fontSize: 11 }}>Format ChordPro: acords entre [claudàtors], surten damunt de la lletra.</div>
            </>
          ) : (
            <div className="ss-lyrics-view">
              {form.lyrics.trim() ? <LyricsView lyrics={form.lyrics} semitones={semitones} /> : <div className="t-dim" style={{ fontSize: 13 }}>Sense lletra encara — escriu-la a Edita o prova l&apos;Autocompleta.</div>}
            </div>
          )}
        </div>

        {/* Columna lateral */}
        <div className="ss-side">
          <div className="ss-card">
            <div className="ss-cover-row">
              <img className="ss-cover" src={form.coverUrl || bandLogo || undefined} alt=""
                style={!form.coverUrl && !bandLogo ? { background: `linear-gradient(135deg, ${bandColor}, #17141f)` } : undefined} />
              <div className="ss-meta-grid">
                <label className="song-meta">Artista<input className="field-input compact-field" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} /></label>
                <div className="song-meta-pair">
                  <label className="song-meta">BPM<input className="field-input compact-field" type="number" value={form.tempo} onChange={(e) => setForm({ ...form, tempo: e.target.value })} /></label>
                  <label className="song-meta">To<input className="field-input compact-field" placeholder="Am" value={form.songKey} onChange={(e) => setForm({ ...form, songKey: e.target.value })} /></label>
                  <label className="song-meta">Durada<input className="field-input compact-field" placeholder="3:45" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></label>
                </div>
              </div>
            </div>
            <label className="song-meta">Notes
              <textarea className="field-input rider-textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>

          {/* Instruments d'aquesta cançó */}
          <div className="ss-card">
            <div className="rider-block-title">Instruments que hi sonen</div>
            <div className="access-box-list">
              {allChips.map((ins) => {
                const on = instruments.some((x) => x.toLowerCase() === ins.toLowerCase());
                const icon = instrumentIconFor(ins);
                return (
                  <button key={ins} type="button" className={"access-chip" + (on ? " active" : "")} onClick={() => toggleInstrument(ins)}>
                    {icon && <img src={icon} alt="" style={{ width: 14, height: 14, objectFit: "contain", marginRight: 5, verticalAlign: "-2px" }} />}
                    {on ? "✓ " : ""}{ins}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="field-input compact-field" list="ss-ins-presets" placeholder="Afegeix un altre instrument…" value={customIns}
                onChange={(e) => setCustomIns(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && customIns.trim()) { toggleInstrument(customIns.trim()); setCustomIns(""); } }} />
              <button type="button" className="btn-outline" disabled={!customIns.trim()}
                onClick={() => { toggleInstrument(customIns.trim()); setCustomIns(""); }}>+</button>
              <datalist id="ss-ins-presets">
                {INSTRUMENT_PRESETS.map((i) => <option key={i} value={i} />)}
              </datalist>
            </div>
          </div>

          {/* Partitures per instrument */}
          <div className="ss-card">
            <div className="rider-block-title">Partitures per instrument</div>
            {instruments.length === 0 ? (
              <div className="t-dim" style={{ fontSize: 12 }}>Marca primer els instruments de la cançó: cada un tindrà el seu espai de partitures.</div>
            ) : (
              instruments.map((ins) => {
                const scores = scoresByInstrument(ins);
                const icon = instrumentIconFor(ins);
                return (
                  <div key={ins} className="ss-score-block">
                    <div className="ss-score-head">
                      <span className="ss-score-ins">{icon && <img src={icon} alt="" />}{ins}</span>
                      <button type="button" className="btn-outline" disabled={uploading === ins}
                        onClick={() => { uploadForRef.current = ins; fileInput.current?.click(); }}>
                        {uploading === ins ? "Pujant…" : "+ Partitura"}
                      </button>
                    </div>
                    {scores.map((f) => (
                      <div key={f.id} className="file-row">
                        <span className="file-icon">📄</span>
                        <div className="file-row-main"><a href={`/api/file/${f.id}`} target="_blank" rel="noreferrer" className="file-name">{f.name}</a></div>
                        <span className="t-dim" style={{ fontSize: 11 }}>{fmtSize(f.size)}</span>
                        <button type="button" className="row-delete-btn" onClick={async () => { await deleteFileAction(bandId, f.id); router.refresh(); }}>✕</button>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* Gravacions generals */}
          <div className="ss-card">
            <div className="rider-block-head">
              <div className="rider-block-title">Gravacions i documents</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={"btn-outline" + (recording ? " rec-active" : "")} onClick={toggleRecording}>
                  {recording ? "⏹ Atura" : "🎙 Memo"}
                </button>
                <button type="button" className="btn-outline" disabled={uploading === "general"}
                  onClick={() => { uploadForRef.current = ""; fileInput.current?.click(); }}>
                  {uploading === "general" ? "Pujant…" : "+ Fitxer"}
                </button>
              </div>
            </div>
            {generalFiles.length === 0 ? (
              <div className="t-dim" style={{ fontSize: 11.5 }}>Gravacions de referència, vídeos… (màx. 15 MB).</div>
            ) : (
              generalFiles.map((f) => (
                <div key={f.id} className="file-row">
                  <span className="file-icon">{f.mime.startsWith("audio") ? "🎧" : f.mime.startsWith("video") ? "🎬" : f.mime.includes("pdf") ? "📄" : "📎"}</span>
                  <div className="file-row-main">
                    <a href={`/api/file/${f.id}`} target="_blank" rel="noreferrer" className="file-name">{f.name}</a>
                    {f.mime.startsWith("audio") && <audio controls preload="none" src={`/api/file/${f.id}`} className="file-audio" />}
                  </div>
                  <span className="t-dim" style={{ fontSize: 11 }}>{fmtSize(f.size)}</span>
                  <button type="button" className="row-delete-btn" onClick={async () => { await deleteFileAction(bandId, f.id); router.refresh(); }}>✕</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <input ref={fileInput} type="file" hidden accept=".mp3,.m4a,.wav,.ogg,.aac,.mp4,.mov,.pdf,.jpg,.jpeg,.png,.txt,.docx"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f, uploadForRef.current); e.target.value = ""; }} />
    </div>
  );
}
