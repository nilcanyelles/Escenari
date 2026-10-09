"use client";

import { useRef, useState } from "react";
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
type PaperSize = "A4" | "A5" | "A6";
const PAPER_OPTIONS: { size: PaperSize; label: string; cols: number; rows: number }[] = [
  { size: "A4", label: "A4 (1 pàgina/full)", cols: 1, rows: 1 },
  { size: "A5", label: "A5 (2 pàgines/full)", cols: 1, rows: 2 },
  { size: "A6", label: "A6 (4 pàgines/full)", cols: 2, rows: 2 },
];

// Mini full (sempre vertical, com el paper a la impressora) amb els mateixos
// traços de tall curts que farà servir de veritat el PDF: només a la vora
// (dalt/baix els verticals, esquerra/dreta els horitzontals, perquè no es
// trepitgin mai) i, quan hi ha els dos alhora (A6), una creueta petita
// exactament on es creuen.
function PaperSizeIcon({ cols, rows }: { cols: number; rows: number }) {
  const w = 24, h = 34;
  const cellW = w / cols, cellH = h / rows;
  const mark = 4;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="0.75" y="0.75" width={w - 1.5} height={h - 1.5} rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      {Array.from({ length: cols - 1 }, (_, i) => (i + 1) * cellW).map((x) => (
        <g key={"v" + x} stroke="currentColor" strokeWidth="1" opacity="0.9">
          <line x1={x} y1="0.75" x2={x} y2={mark} />
          <line x1={x} y1={h - mark} x2={x} y2={h - 0.75} />
        </g>
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (i + 1) * cellH).map((y) => (
        <g key={"h" + y} stroke="currentColor" strokeWidth="1" opacity="0.9">
          <line x1="0.75" y1={y} x2={mark} y2={y} />
          <line x1={w - mark} y1={y} x2={w - 0.75} y2={y} />
        </g>
      ))}
      {cols > 1 && rows > 1 && Array.from({ length: cols - 1 }, (_, i) => (i + 1) * cellW).flatMap((x) =>
        Array.from({ length: rows - 1 }, (_, j) => (j + 1) * cellH).map((y) => (
          <g key={"x" + x + "-" + y} stroke="currentColor" strokeWidth="1" opacity="0.9">
            <line x1={x - 1.5} y1={y} x2={x + 1.5} y2={y} />
            <line x1={x} y1={y - 1.5} x2={x} y2={y + 1.5} />
          </g>
        ))
      )}
    </svg>
  );
}

// Menú "Imprimeix partitures": tria quines cançons (de les que en tenen al
// repertori) i quins instruments/veus, i baixa un sol PDF amb totes les
// partitures triades fusionades — generat a /api/print-scores (pdf-lib, no
// window.print()) perquè pot combinar PDFs i imatges de cançons diferents
// en un sol fitxer. Reutilitzat tant per una setlist (bandId fix, un sol
// grup) com per la biblioteca d'un músic (sense bandId, cançons de grups
// diferents — el servidor en comprova l'accés una per una).
export default function PrintScoresModal({ bandId, title, songs, librarySongs, onClose }: {
  bandId?: string;
  title: string;
  songs: { title: string; songId?: string }[];
  librarySongs: LibrarySong[];
  onClose: () => void;
}) {
  const byId = new Map(librarySongs.map((s) => [s.id, s]));
  const byTitle = new Map(librarySongs.map((s) => [s.title.toLowerCase(), s]));

  // Cançons que tenen partitures al repertori (mateixa resolució songId ->
  // títol que el mode escenari), en el mateix ordre que s'han donat — les
  // que no en tenen no surten a la llista (no hi ha res a imprimir d'elles).
  type ScoreFile = LibrarySong["files"][number];
  const matchedSongs: { song: LibrarySong; scoreFiles: ScoreFile[] }[] = [];
  const seen = new Set<string>();
  songs.filter((s) => s.title.trim()).forEach((s) => {
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
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
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
          <div className="rider-name-input" style={{ fontWeight: 700, fontSize: 16 }}>Imprimeix partitures — {title}</div>
          <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={onClose}>✕</button>
        </div>
        {candidates.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13, textAlign: "center" }}>Cap d&apos;aquestes cançons té partitures penjades.</div>
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
            <div className="access-box-title">Mida del paper</div>
            <div className="access-box-list" style={{ marginBottom: 22, justifyContent: "center" }}>
              {PAPER_OPTIONS.map((opt) => (
                <button
                  key={opt.size} type="button"
                  className={"access-chip" + (paperSize === opt.size ? " active" : "")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  onClick={() => setPaperSize(opt.size)}
                >
                  <PaperSizeIcon cols={opt.cols} rows={opt.rows} />
                  {opt.label}
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
              {bandId && <input type="hidden" name="bandId" value={bandId} />}
              <input type="hidden" name="name" value={title} />
              <input type="hidden" name="songIds" value={JSON.stringify(songIdsInOrder)} />
              <input type="hidden" name="instruments" value={JSON.stringify(Array.from(selectedInstruments))} />
              <input type="hidden" name="paperSize" value={paperSize} />
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
