"use client";

import { useRef, useState } from "react";
import type { Setlist } from "@/lib/material-types";
import type { Song as LibrarySong } from "@/lib/songs";
import { instrumentBaseName, instrumentIconFor, normalizeInstrumentAcrossGroup, sortInstrumentInstances, tagColors } from "@/lib/tags";

function ScoreIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  );
}
function PrinterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"></polyline>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
      <rect x="6" y="14" width="12" height="8"></rect>
    </svg>
  );
}

type Candidate = { songId: string; title: string; tags: string[]; instruments: string[] };

// Menú "Imprimeix partitures" d'una setlist: tria quines cançons (de les
// que en tenen al repertori) i quins instruments/veus, i baixa un sol PDF
// amb totes les partitures triades fusionades — generat a /api/print-scores
// (pdf-lib, no window.print()) perquè pot combinar PDFs i imatges de
// cançons diferents en un sol fitxer.
export default function PrintScoresModal({ bandId, setlistName, setlist, librarySongs, onClose }: {
  bandId: string;
  setlistName: string;
  setlist: Setlist;
  librarySongs: LibrarySong[];
  onClose: () => void;
}) {
  const byId = new Map(librarySongs.map((s) => [s.id, s]));
  const byTitle = new Map(librarySongs.map((s) => [s.title.toLowerCase(), s]));

  // Cançons de la setlist que tenen partitures al repertori (mateixa
  // resolució songId -> títol que el mode escenari), en el mateix ordre que
  // la setlist — les que no en tenen no surten a la llista (no hi ha res a
  // imprimir d'elles).
  type ScoreFile = LibrarySong["files"][number];
  const matchedSongs: { song: LibrarySong; scoreFiles: ScoreFile[] }[] = [];
  const seen = new Set<string>();
  setlist.songs.filter((s) => s.title.trim()).forEach((s) => {
    const match = (s.songId && byId.get(s.songId)) || byTitle.get(s.title.toLowerCase());
    if (!match || seen.has(match.id)) return;
    const scoreFiles = match.files.filter((f) => !f.mime.startsWith("audio"));
    if (!scoreFiles.length) return;
    seen.add(match.id);
    matchedSongs.push({ song: match, scoreFiles });
  });

  // Un instrument sense número ("Gralla dolça", en una cançó que només en
  // porta un) compta com la primera instància si en alguna altra cançó de
  // la selecció aquest mateix instrument sí que ve numerat — si no, és
  // l'únic nom possible i es queda tal qual.
  const allScoreFiles = matchedSongs.flatMap((m) => m.scoreFiles);
  const effectiveInstrument = normalizeInstrumentAcrossGroup(allScoreFiles, (f) => f.instrument || "Totes les veus");

  const candidates: Candidate[] = matchedSongs.map(({ song, scoreFiles }) => ({
    songId: song.id, title: song.title, tags: song.tags,
    instruments: scoreFiles.map((f) => effectiveInstrument.get(f) || "Totes les veus"),
  }));

  const instrumentOptions = sortInstrumentInstances(
    Array.from(new Set(candidates.flatMap((c) => c.instruments))),
    (n) => n
  );

  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set(candidates.map((c) => c.songId)));
  const [selectedInstruments, setSelectedInstruments] = useState<Set<string>>(new Set(instrumentOptions));
  // Ordre d'impressió: comença igual que la setlist, però es pot arrossegar
  // per canviar-lo sense tocar l'ordre real de la setlist.
  const [order, setOrder] = useState<string[]>(() => candidates.map((c) => c.songId));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function toggleSong(id: string) {
    setSelectedSongs((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleInstrument(name: string) {
    setSelectedInstruments((prev) => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  }
  function handleDrop(i: number) {
    setDragOverIndex(null);
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); return; }
    setOrder((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(dragIndex, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  const byCandidateId = new Map(candidates.map((c) => [c.songId, c]));
  const orderedCandidates = order.map((id) => byCandidateId.get(id)).filter((c): c is Candidate => !!c);

  // Quantes partitures acabaran al PDF amb la selecció actual.
  const matchCount = orderedCandidates
    .filter((c) => selectedSongs.has(c.songId))
    .reduce((acc, c) => acc + c.instruments.filter((i) => selectedInstruments.has(i)).length, 0);

  const songIdsInOrder = orderedCandidates.filter((c) => selectedSongs.has(c.songId)).map((c) => c.songId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal print-scores-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="rider-name-input" style={{ fontWeight: 700, fontSize: 16 }}>Imprimeix partitures — {setlistName}</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onClose}>✕</button>
        </div>
        {candidates.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13, textAlign: "center" }}>Cap cançó d&apos;aquesta setlist té partitures penjades al repertori.</div>
        ) : (
          <>
            <div className="access-box-title">Instruments / veus</div>
            <div className="access-box-list" style={{ marginBottom: 22, justifyContent: "center" }}>
              {instrumentOptions.map((name) => (
                <button
                  key={name} type="button"
                  className={"access-chip" + (selectedInstruments.has(name) ? " active" : "")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  onClick={() => toggleInstrument(name)}
                >
                  <img src={instrumentIconFor(instrumentBaseName(name))} alt="" style={{ width: 14, height: 14, flexShrink: 0, objectFit: "contain" }} />
                  {name}
                </button>
              ))}
            </div>
            <div className="access-box-title">Cançons</div>
            <div className="perform-intro-songs print-song-list">
              {orderedCandidates.map((c, i) => {
                const on = selectedSongs.has(c.songId);
                // Només compta les veus triades a "Instruments / veus" —
                // desseleccionar-ne una actualitza el número a l'acte.
                const selectedScoreCount = c.instruments.filter((inst) => selectedInstruments.has(inst)).length;
                return (
                  <div
                    key={c.songId}
                    className={"perform-list-row print-song-row" + (dragOverIndex === i ? " setlist-row-dragover" : "") + (dragIndex === i ? " setlist-row-dragging" : "")}
                    onDragOver={(e) => { e.preventDefault(); if (dragIndex !== null && dragOverIndex !== i) setDragOverIndex(i); }}
                    onDragLeave={() => setDragOverIndex((v) => (v === i ? null : v))}
                    onDrop={() => handleDrop(i)}
                  >
                    <span
                      className="perform-list-num print-song-drag"
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
                    <button
                      type="button" className={"perform-list-item" + (on ? "" : " perform-list-item-off")}
                      onClick={() => toggleSong(c.songId)}
                    >
                      <span className={"print-song-check" + (on ? " on" : "")}>{on ? "✓" : ""}</span>
                      <span className="perform-list-body">
                        <span className="perform-list-title-row">
                          <span className="perform-list-title">{c.title}</span>
                          {c.tags.map((t) => {
                            const tc = tagColors(t);
                            return <span key={t} className="badge sm" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
                          })}
                        </span>
                      </span>
                      {selectedScoreCount > 0 && <span className="sp-file-count print-song-filecount" title="Partitures"><ScoreIcon />{selectedScoreCount}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
            <form ref={formRef} method="POST" action="/api/print-scores" target="_blank" style={{ display: "none" }}>
              <input type="hidden" name="bandId" value={bandId} />
              <input type="hidden" name="name" value={setlistName} />
              <input type="hidden" name="songIds" value={JSON.stringify(songIdsInOrder)} />
              <input type="hidden" name="instruments" value={JSON.stringify(Array.from(selectedInstruments))} />
            </form>
            <div className="modal-actions print-scores-actions">
              <button type="button" className="btn-outline" onClick={onClose}>Cancel·la</button>
              <button
                type="button" className="print-scores-submit" disabled={matchCount === 0}
                title={`Genera el PDF (${matchCount} partitures)`}
                onClick={() => { formRef.current?.submit(); onClose(); }}
              >
                <PrinterIcon />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
