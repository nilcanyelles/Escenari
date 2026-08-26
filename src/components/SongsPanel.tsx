"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Band } from "@/lib/types";
import type { Song } from "@/lib/songs";
import { transposeChord, parseChordLine, hasChords } from "@/lib/songs";
import { normalize } from "@/lib/text";
import { saveSongAction, deleteSongAction, importSongsAction, uploadFileAction, deleteFileAction, lookupSongAction } from "@/app/(app)/grup/songs-actions";
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

export default function SongsPanel({ band, songs, canEdit }: { band: Band; songs: Song[]; canEdit: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reproducció ràpida estil Spotify des de la llista.
  function togglePlay(songId: string, fileId: string) {
    if (playingId === songId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = `/api/file/${fileId}`;
    audioRef.current.play();
    audioRef.current.onended = () => setPlayingId(null);
    setPlayingId(songId);
  }

  const q = normalize(search.trim());
  const list = songs.filter((s) => !q || normalize(s.title).includes(q) || normalize(s.artist).includes(q));


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 12 }}>
          <div className="panel-title">Repertori</div>
          {canEdit && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button type="button" className="btn-outline" onClick={() => setImportOpen((v) => !v)}>Importa</button>
              <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.3} baseColor="#8b7bff" lineColor="#ffffff" disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  const { id } = await saveSongAction({
                    id: null, bandId: band.id, title: "Nova cançó", artist: "", tempo: 0,
                    songKey: "", duration: "", notes: "", lyrics: "", instruments: [],
                  });
                  router.push(`/canco/${id}`);
                }}>
                {creating ? "Creant…" : "+ Nova cançó"}
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
          <div className="sp-list">
            <div className="sp-row sp-head">
              <span className="sp-idx">#</span>
              <span></span>
              <span>Títol</span>
              <span className="sp-band-col">To · BPM</span>
              <span className="sp-dur">⏱</span>
              <span className="sp-actions"></span>
            </div>
            {list.map((s, i) => {
              const audio = s.files.find((f) => f.mime.startsWith("audio"));
              const coverColor = band.color1 || "#8b7bff";
              return (
                <div key={s.id} className={"sp-row clickable" + (playingId === s.id ? " playing" : "")} onClick={() => router.push(`/canco/${s.id}`)}>
                  <span className="sp-idx" onClick={(e) => e.stopPropagation()}>
                    {audio ? (
                      <button type="button" className="sp-play" title="Escolta la gravació" onClick={() => togglePlay(s.id, audio.id)}>
                        {playingId === s.id ? "❚❚" : "▶"}
                      </button>
                    ) : (
                      <span className="sp-num">{i + 1}</span>
                    )}
                  </span>
                  {s.coverUrl || band.logo ? (
                    <img className="sp-cover sp-cover-img" src={s.coverUrl || band.logo} alt="" loading="lazy" />
                  ) : (
                    <span className="sp-cover" style={{ background: `linear-gradient(135deg, ${coverColor}, #17141f)` }}>♪</span>
                  )}
                  <span className="sp-title-wrap">
                    <span className="sp-title">{s.title}{hasChords(s.lyrics) && <span className="song-chord-badge" title="Té acords">♪</span>}</span>
                    <span className="sp-artist">{s.artist || band.name}{s.files.length ? ` · ${s.files.length} 📎` : ""}</span>
                  </span>
                  <span className="sp-band-col">{[s.songKey, s.tempo ? `${s.tempo} bpm` : ""].filter(Boolean).join(" · ") || "—"}</span>
                  <span className="sp-dur">{s.duration || "—"}</span>
                  <span className="sp-actions" onClick={(e) => e.stopPropagation()}>
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
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
