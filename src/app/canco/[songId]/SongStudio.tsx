"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Song } from "@/lib/songs";
import { convertChordLyrics } from "@/lib/chords-detect";
import { instrumentIconFor } from "@/lib/tags";
import { INSTRUMENT_CATEGORIES } from "@/lib/instruments";
import { InstrumentIcon } from "@/components/InstrumentPicker";
import { normalize } from "@/lib/text";
import { saveSongAction, uploadFileAction, deleteFileAction, lookupSongAction } from "@/app/(app)/grup/songs-actions";
import StorageManagerModal from "@/components/StorageManagerModal";
import SpecularButton from "@/components/SpecularButton";

function fmtSize(bytes: number): string {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

function fmtAudioDuration(secs: number): string {
  if (!isFinite(secs) || secs <= 0) return "";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Rodoneta de progrés per a la pujada d'un fitxer (0-100).
function UploadRing({ percent, size = 20 }: { percent: number; size?: number }) {
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, percent)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: "none", display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

// Etiqueta reservada per a les partitures/àudios que no són d'un instrument
// concret, sinó de totes les veus alhora.
const ALL_VOICES_INS = "Totes les veus";

// Etiqueta reservada per a la resta de pistes que no sonen en directe
// (efectes, claqueta, instruments gravats…) — la llista varia a cada cançó,
// per això no hi ha una categoria fixa: simplement s'hi pengen tants àudios
// com calgui.
const BACKING_TRACK_INS = "Backing track";
const BACKING_TRACK_LABEL = "Àudios";

// "Saxofon tenor 2" -> "Saxofon tenor" (per agrupar instàncies del mateix instrument).
function instrumentBaseName(s: string): string {
  return s.replace(/\s+\d+$/, "").trim();
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
  // Els instruments propis del grup surten preseleccionats de bon
  // començament (només quan la cançó encara no en té cap de desat).
  const [instruments, setInstruments] = useState<string[]>(song.instruments && song.instruments.length ? song.instruments : bandInstruments);
  // La caixa de lletra i acords només té sentit si algú hi canta.
  const hasVoice = instruments.some((x) => {
    const base = instrumentBaseName(x).toLowerCase();
    return base === "veu" || base === "cors";
  });
  const [customIns, setCustomIns] = useState("");
  const [insMenuOpen, setInsMenuOpen] = useState(false);
  const [audiosOpen, setAudiosOpen] = useState(false);
  const [storageManagerOpen, setStorageManagerOpen] = useState(false);
  const [audioDurations, setAudioDurations] = useState<Record<string, string>>({});
  const [backingProgress, setBackingProgress] = useState<{ index: number; total: number; percent: number } | null>(null);
  // Per defecte la casella de lletra i acords surt petita i a sobre de tot;
  // amb aquest botó s'amplia a la vista grossa d'abans (dues columnes).
  const [lyricsExpanded, setLyricsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // instrument, o ALL_VOICES_INS
  const fileInput = useRef<HTMLInputElement>(null);
  const backingFileInput = useRef<HTMLInputElement>(null);
  const uploadForRef = useRef<string>("");
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

  async function handleSaveAndExit() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaving(true);
    await saveSongAction({
      id: song.id, bandId, title: form.title, artist: form.artist,
      tempo: parseInt(form.tempo, 10) || 0, songKey: form.songKey, duration: form.duration,
      notes: form.notes, lyrics: form.lyrics, coverUrl: form.coverUrl, instruments,
    });
    setSaving(false);
    router.push(backHref);
  }

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

  const SCORE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.docx,.txt";
  const AUDIO_ACCEPT = ".mp3,.m4a,.wav,.ogg,.aac,.mp4";

  function openUpload(instrument: string) {
    uploadForRef.current = instrument;
    if (fileInput.current) fileInput.current.accept = SCORE_ACCEPT;
    fileInput.current?.click();
  }

  async function doUpload(file: File, instrument: string) {
    setUploading(instrument);
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

  // Puja un fitxer via XHR (no server action) perquè es pugui llegir el
  // progrés real de pujada byte a byte.
  function uploadWithProgress(file: File, instrument: string, onProgress: (pct: number) => void): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/songs/upload");

      // Animació de progrés en dues fases: puja ràpid del 0 al 95% en 3
      // segons (l'enviament dels bytes sol ser gairebé instantani), i
      // després avança cada cop més a poc a poc mentre el servidor encara
      // processa i desa el fitxer — mai arriba del tot fins que respon.
      const startedAt = performance.now();
      const RAMP_MS = 3000;
      const RAMP_TARGET = 95;
      let simulated = 0;
      const timer = window.setInterval(() => {
        const elapsed = performance.now() - startedAt;
        simulated = elapsed < RAMP_MS ? (elapsed / RAMP_MS) * RAMP_TARGET : simulated + (99 - simulated) * 0.035;
        onProgress(Math.round(simulated));
      }, 100);
      const stopSim = () => window.clearInterval(timer);

      xhr.onload = () => {
        stopSim();
        onProgress(100);
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({ ok: xhr.status >= 200 && xhr.status < 300, error: "Error pujant el fitxer" }); }
      };
      xhr.onerror = () => { stopSim(); resolve({ ok: false, error: "Error de xarxa" }); };
      const fd = new FormData();
      fd.set("bandId", bandId);
      fd.set("songId", song.id);
      fd.set("instrument", instrument);
      fd.set("file", file);
      xhr.send(fd);
    });
  }

  // Puja diversos àudios d'un cop (backing track): un darrere l'altre, amb
  // rodoneta de progrés i comptador "i/total".
  async function doUploadMany(files: FileList, instrument: string) {
    const list = Array.from(files);
    setUploading(instrument);
    for (let i = 0; i < list.length; i++) {
      setBackingProgress({ index: i + 1, total: list.length, percent: 0 });
      const res = await uploadWithProgress(list[i], instrument, (pct) => {
        setBackingProgress({ index: i + 1, total: list.length, percent: pct });
      });
      if (!res.ok) {
        if (res.error && res.error.includes("pistes d'àudio")) { setStorageManagerOpen(true); break; }
        alert(res.error || "Error pujant un fitxer");
      }
    }
    setBackingProgress(null);
    setUploading(null);
    router.refresh();
  }

  // Afegeix una instància d'un instrument. Si ja n'hi ha un igual, numera
  // totes dues instàncies ("Saxofon tenor 1", "Saxofon tenor 2"…) perquè es
  // puguin afegir diversos músics del mateix instrument.
  function addInstrumentInstance(name: string) {
    const base = name.trim();
    if (!base) return;
    setInstruments((prev) => {
      const matches = prev.filter((x) => instrumentBaseName(x).toLowerCase() === base.toLowerCase());
      if (matches.length === 0) return prev.concat([base]);
      if (matches.length === 1 && matches[0].toLowerCase() === base.toLowerCase()) {
        const idx = prev.indexOf(matches[0]);
        const next = prev.slice();
        next[idx] = base + " 1";
        next.push(base + " 2");
        return next;
      }
      let maxN = 0;
      matches.forEach((m) => {
        const mm = /\s+(\d+)$/.exec(m);
        if (mm) maxN = Math.max(maxN, parseInt(mm[1], 10));
      });
      return prev.concat([base + " " + (maxN + 1)]);
    });
  }

  // Elimina una instància concreta. Si en queda només una del mateix
  // instrument, li treu el número (torna a ser "Saxofon tenor" sol).
  function removeInstrumentInstance(exact: string) {
    setInstruments((prev) => {
      const idx = prev.indexOf(exact);
      if (idx === -1) return prev;
      const next = prev.slice(0, idx).concat(prev.slice(idx + 1));
      const base = instrumentBaseName(exact);
      const remaining = next.filter((x) => instrumentBaseName(x).toLowerCase() === base.toLowerCase());
      if (remaining.length === 1 && /\s+\d+$/.test(remaining[0])) {
        next[next.indexOf(remaining[0])] = base;
      }
      return next;
    });
  }

  const scoresByInstrument = (ins: string) => song.files.filter((f) => f.instrument.toLowerCase() === ins.toLowerCase());
  const backingFiles = scoresByInstrument(BACKING_TRACK_INS);

  // Cerca en viu dins del mateix menú de bombolles, en lloc d'un desplegable
  // natiu a part.
  const insQuery = normalize(customIns.trim());
  const filteredInsCategories = insQuery
    ? INSTRUMENT_CATEGORIES.map((c) => ({ name: c.name, items: c.items.filter((i) => normalize(i.name).includes(insQuery)) })).filter((c) => c.items.length > 0)
    : INSTRUMENT_CATEGORIES;

  return (
    <div className="studio">
      {/* Barra superior */}
      <div className="studio-topbar">
        <Link href={backHref} className="cd-back">← Surt</Link>
        <div className="studio-band-name">{bandName}</div>
        <div className="studio-name studio-name-display">{form.title || "Sense títol"}</div>
        <div className="studio-topbar-right">
          <span className="t-dim" style={{ fontSize: 12 }}>{saving ? "Desant…" : "Desat ✓"}</span>
          <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.3} baseColor="#8b7bff" lineColor="#ffffff" disabled={looking} onClick={handleLookup}>
            {looking ? "Cercant…" : "🔍 Autocompleta"}
          </SpecularButton>
          <button type="button" className="btn-save" disabled={saving} onClick={handleSaveAndExit}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "-2px" }}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {saving ? "Desant…" : "Desa"}
          </button>
        </div>
      </div>
      {lookupMsg && <div className="ss-lookup-msg">{lookupMsg}</div>}

      {/* Títol, artista i altres dades bàsiques — sempre a dalt de tot */}
      <div className="ss-top-wrap">
        <div className="ss-card ss-top-card">
          <div className="ss-cover-row">
            <img className="ss-cover" src={form.coverUrl || bandLogo || undefined} alt=""
              style={!form.coverUrl && !bandLogo ? { background: `linear-gradient(135deg, ${bandColor}, #17141f)` } : undefined} />
            <div className="ss-meta-grid">
              <label className="song-meta">Títol<input className="field-input compact-field" value={form.title} placeholder="Títol de la cançó" onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
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
        <div className="ss-card ss-top-card">
          <div className="rider-block-title">Instruments que hi sonen</div>

          {instruments.length > 0 && (
            <div className="access-box-list">
              {instruments.map((ins) => {
                const icon = instrumentIconFor(instrumentBaseName(ins));
                return (
                  <button key={ins} type="button" className="access-chip active" onClick={() => removeInstrumentInstance(ins)} title="Elimina">
                    {icon && <img src={icon} alt="" style={{ width: 14, height: 14, objectFit: "contain", marginRight: 5, verticalAlign: "-2px" }} />}
                    {ins} ✕
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            <button type="button" className="btn-outline" onClick={() => setInsMenuOpen((o) => !o)}>
              {insMenuOpen ? "Amaga la llista ▲" : "+ Afegeix un instrument…"}
            </button>
            {insMenuOpen && (
              <div className="instr-panel">
                <input
                  className="field-input compact-field"
                  placeholder="Cerca un instrument…"
                  value={customIns}
                  onChange={(e) => setCustomIns(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (filteredInsCategories.length === 0) {
                      if (customIns.trim()) { addInstrumentInstance(customIns.trim()); setCustomIns(""); }
                      return;
                    }
                    const flat = filteredInsCategories.flatMap((c) => c.items);
                    const pick = flat.find((i) => normalize(i.name) === insQuery) || (flat.length === 1 ? flat[0] : null);
                    if (pick) { addInstrumentInstance(pick.name); setCustomIns(""); }
                  }}
                />
                {filteredInsCategories.map((c) => (
                  <div key={c.name}>
                    <div className="instr-cat-title">{c.name}</div>
                    <div className="instr-grid">
                      {c.items.map((i) => {
                        const active = instruments.some((x) => instrumentBaseName(x).toLowerCase() === i.name.toLowerCase());
                        return (
                          <button key={i.name} type="button" className={"instr-pill" + (active ? " active" : "")}
                            onClick={() => addInstrumentInstance(i.name)} title={active ? `Afegeix un altre ${i.name}` : `Afegeix ${i.name}`}>
                            <InstrumentIcon name={i.name} icon={i.icon} />
                            {i.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {filteredInsCategories.length === 0 && customIns.trim() && (
                  <button type="button" className="btn-ghost-sm" onClick={() => { addInstrumentInstance(customIns.trim()); setCustomIns(""); }}>
                    + Afegeix «{customIns.trim()}»
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ss-body">
        {/* Lletra i acords — només si hi ha algun instrument de veu (Veu/Cors) */}
        {hasVoice && (
          <div className="ss-main">
            <div className="song-lyrics-head">
              <div className="rider-block-title" style={{ margin: 0 }}>Lletra i acords</div>
              <button type="button" className="btn-outline ss-expand-btn" onClick={() => setLyricsExpanded((v) => !v)}>
                {lyricsExpanded ? "⤡ Redueix" : "⤢ Amplia"}
              </button>
            </div>
            <textarea
              className={"field-input rider-textarea ss-lyrics" + (lyricsExpanded ? "" : " ss-lyrics-compact")}
              placeholder={"Lletra amb acords entre claudàtors:\n[Am]Quan surt el [F]sol a la pla[C]ça…"}
              value={form.lyrics}
              onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (!pasted) return;
                const converted = convertChordLyrics(pasted);
                if (converted === pasted) return; // cap línia d'acords detectada: comportament normal
                e.preventDefault();
                const el = e.currentTarget;
                const start = el.selectionStart, end = el.selectionEnd;
                const newValue = form.lyrics.slice(0, start) + converted + form.lyrics.slice(end);
                setForm({ ...form, lyrics: newValue });
                const caret = start + converted.length;
                requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = caret; });
              }}
            />
            <div className="t-dim" style={{ fontSize: 11 }}>Format ChordPro: acords entre [claudàtors], surten damunt de la lletra. Si enganxes lletra amb els acords en una línia a part, es detecten i s&apos;ajunten soles.</div>
          </div>
        )}

        {/* Columna lateral */}
        <div className="ss-side">
          {/* Partitures */}
          <div className="ss-card">
            <div className="rider-block-title">Partitures i gravacions</div>

            {/* Totes les veus alhora (partitura general) */}
            <div className="ss-score-block">
              <div className="ss-score-head">
                <span className="ss-score-ins">📜 {ALL_VOICES_INS}</span>
                <button type="button" className="btn-outline" disabled={uploading === ALL_VOICES_INS}
                  onClick={() => openUpload(ALL_VOICES_INS)}>
                  {uploading === ALL_VOICES_INS ? "Pujant…" : "+ Partitura"}
                </button>
              </div>
              {scoresByInstrument(ALL_VOICES_INS).map((f) => (
                <div key={f.id} className="file-row">
                  <span className="file-icon">{f.mime.startsWith("audio") ? "🎧" : "📄"}</span>
                  <div className="file-row-main">
                    <a href={`/api/file/${f.id}`} target="_blank" rel="noreferrer" className="file-name">{f.name}</a>
                    {f.mime.startsWith("audio") && <audio controls preload="none" src={`/api/file/${f.id}`} className="file-audio" />}
                  </div>
                  <span className="t-dim" style={{ fontSize: 11 }}>{fmtSize(f.size)}</span>
                  <button type="button" className="row-delete-btn" onClick={async () => { await deleteFileAction(bandId, f.id); router.refresh(); }}>✕</button>
                </div>
              ))}
            </div>

            {instruments.length === 0 ? (
              <div className="t-dim" style={{ fontSize: 12 }}>Marca també els instruments de la cançó: cada un tindrà el seu propi espai de partitura i àudio.</div>
            ) : (
              instruments.map((ins) => {
                const scores = scoresByInstrument(ins);
                const icon = instrumentIconFor(instrumentBaseName(ins));
                return (
                  <div key={ins} className="ss-score-block">
                    <div className="ss-score-head">
                      <span className="ss-score-ins">{icon && <img src={icon} alt="" />}{ins}</span>
                      <button type="button" className="btn-outline" disabled={uploading === ins}
                        onClick={() => openUpload(ins)}>
                        {uploading === ins ? "Pujant…" : "+ Partitura"}
                      </button>
                    </div>
                    {scores.map((f) => (
                      <div key={f.id} className="file-row">
                        <span className="file-icon">{f.mime.startsWith("audio") ? "🎧" : "📄"}</span>
                        <div className="file-row-main">
                          <a href={`/api/file/${f.id}`} target="_blank" rel="noreferrer" className="file-name">{f.name}</a>
                          {f.mime.startsWith("audio") && <audio controls preload="none" src={`/api/file/${f.id}`} className="file-audio" />}
                        </div>
                        <span className="t-dim" style={{ fontSize: 11 }}>{fmtSize(f.size)}</span>
                        <button type="button" className="row-delete-btn" onClick={async () => { await deleteFileAction(bandId, f.id); router.refresh(); }}>✕</button>
                      </div>
                    ))}
                  </div>
                );
              })
            )}

            <div className="ss-score-block ss-backing-block">
              <div className="ss-score-head">
                <button type="button" className="ss-audios-toggle" onClick={() => setAudiosOpen((o) => !o)}>
                  <span className={"ss-audios-arrow" + (audiosOpen ? " open" : "")}>▸</span>
                  🎚 {BACKING_TRACK_LABEL}{backingFiles.length > 0 ? ` (${backingFiles.length})` : ""}
                </button>
                <button type="button" className={"btn-outline" + (backingProgress ? " ss-upload-btn" : "")} disabled={uploading === BACKING_TRACK_INS}
                  onClick={() => backingFileInput.current?.click()}>
                  {backingProgress ? (
                    <>
                      <UploadRing percent={backingProgress.percent} />
                      {backingProgress.percent}% · {backingProgress.index}/{backingProgress.total}
                    </>
                  ) : "Penjar pistes"}
                </button>
              </div>

              {/* Sondes silencioses només per llegir la durada de cada pista. */}
              {backingFiles.map((f) => (
                <audio key={f.id} hidden preload="metadata" src={`/api/file/${f.id}`}
                  onLoadedMetadata={(e) => {
                    // Es llegeix e.currentTarget de seguida: si es referís dins
                    // de la funció d'actualització de l'estat, quan React
                    // l'executés ja podria ser null (l'esdeveniment ja hauria
                    // acabat, o la pista podria haver-se desmuntat).
                    const dur = fmtAudioDuration(e.currentTarget.duration);
                    setAudioDurations((prev) => ({ ...prev, [f.id]: dur }));
                  }} />
              ))}

              {audiosOpen && (
                backingFiles.length === 0 ? (
                  <div className="t-dim" style={{ fontSize: 12 }}>Encara no hi ha cap pista penjada.</div>
                ) : (
                  <div className="ss-audios-list">
                    {backingFiles.map((f) => (
                      <div key={f.id} className="ss-audio-row">
                        <a href={`/api/file/${f.id}`} target="_blank" rel="noreferrer" className="ss-audio-name">{f.name}</a>
                        <span className="ss-audio-duration">{audioDurations[f.id] || "…"}</span>
                        <button type="button" className="row-delete-btn" onClick={async () => { await deleteFileAction(bandId, f.id); router.refresh(); }}>✕</button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

        </div>
      </div>

      <input ref={fileInput} type="file" hidden accept={SCORE_ACCEPT + "," + AUDIO_ACCEPT}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f, uploadForRef.current); e.target.value = ""; }} />
      <input ref={backingFileInput} type="file" hidden multiple accept={AUDIO_ACCEPT}
        onChange={(e) => { const files = e.target.files; if (files && files.length) doUploadMany(files, BACKING_TRACK_INS); e.target.value = ""; }} />

      {storageManagerOpen && (
        <StorageManagerModal bandId={bandId} onClose={() => setStorageManagerOpen(false)} onChanged={() => router.refresh()} />
      )}
    </div>
  );
}
