"use client";

import { useEffect, useState } from "react";
import { getBandAudioUsageAction, deleteSongAudioTracksAction, deleteFileAction, type BandAudioUsage } from "@/app/(app)/grup/songs-actions";

function fmtSize(bytes: number): string {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

// Panell per alliberar espai de pistes d'àudio quan s'arriba al límit per
// cançó (10) o per grup (150): elimina totes les pistes d'una cançó d'un
// cop, o una pista individual.
export default function StorageManagerModal({ bandId, onClose, onChanged }: {
  bandId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [usage, setUsage] = useState<BandAudioUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const u = await getBandAudioUsageAction(bandId);
    setUsage(u);
    setLoading(false);
  }
  useEffect(() => { load(); }, [bandId]);

  async function handleDeleteSong(songId: string) {
    if (!confirm("Segur que vols eliminar totes les pistes d'àudio d'aquesta cançó?")) return;
    setBusy(songId);
    await deleteSongAudioTracksAction(bandId, songId);
    await load();
    onChanged?.();
    setBusy(null);
  }

  async function handleDeleteTrack(fileId: string) {
    setBusy(fileId);
    await deleteFileAction(bandId, fileId);
    await load();
    onChanged?.();
    setBusy(null);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">Gestiona l&apos;espai</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onClose}>✕</button>
        </div>
        {loading || !usage ? (
          <div className="t-dim" style={{ padding: "20px 0" }}>Carregant…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="t-dim" style={{ fontSize: 13 }}>
              {usage.totalTracks} / {usage.maxTracks} pistes d&apos;àudio al grup (màxim {usage.maxPerSong} per cançó).
            </div>
            {usage.songs.length === 0 ? (
              <div className="t-dim" style={{ fontSize: 13 }}>Encara no hi ha cap pista d&apos;àudio pujada.</div>
            ) : (
              usage.songs.map((s) => (
                <div key={s.songId} className="ss-score-block">
                  <div className="ss-score-head">
                    <button type="button" className="ss-audios-toggle" onClick={() => setExpanded((e) => ({ ...e, [s.songId]: !e[s.songId] }))}>
                      <span className={"ss-audios-arrow" + (expanded[s.songId] ? " open" : "")}>▸</span>
                      {s.title} ({s.tracks.length}, {fmtSize(s.totalSize)})
                    </button>
                    <button type="button" className="btn-danger-outline" disabled={busy === s.songId}
                      onClick={() => handleDeleteSong(s.songId)}>
                      {busy === s.songId ? "Eliminant…" : "Elimina totes les pistes"}
                    </button>
                  </div>
                  {expanded[s.songId] && (
                    <div className="ss-audios-list">
                      {s.tracks.map((t) => (
                        <div key={t.id} className="ss-audio-row">
                          <span className="ss-audio-name">{t.name}</span>
                          <span className="ss-audio-duration">{fmtSize(t.size)}</span>
                          <button type="button" className="row-delete-btn" disabled={busy === t.id} onClick={() => handleDeleteTrack(t.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
