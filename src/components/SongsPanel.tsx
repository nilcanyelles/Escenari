"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Band } from "@/lib/types";
import type { Song } from "@/lib/songs";
import { transposeChord, parseChordLine, hasChords } from "@/lib/songs";
import { normalize } from "@/lib/text";
import { tagColors, uniqueTags } from "@/lib/tags";
import { saveSongAction, deleteSongAction, reorderSongsAction } from "@/app/(app)/grup/songs-actions";
import SpecularButton from "@/components/SpecularButton";
import ConfirmDialog from "@/components/ConfirmDialog";

function fmtSize(bytes: number): string {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

function ScoreIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  );
}
function WaveformIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="10" x2="4" y2="14"></line>
      <line x1="9" y1="6" x2="9" y2="18"></line>
      <line x1="14" y1="3" x2="14" y2="21"></line>
      <line x1="19" y1="8" x2="19" y2="16"></line>
    </svg>
  );
}

// Lletra amb acords [Am] pintats damunt del text, amb transposició.
export function LyricsView({ lyrics, semitones }: { lyrics: string; semitones: number }) {
  return (
    <div className="lyrics-view">
      {lyrics.split("\n").map((line, i) => {
        const chunks = parseChordLine(line);
        const anyChord = chunks.some((c) => c.chord);
        if (!anyChord) return <div key={i} className="lyrics-line">{line || " "}</div>;
        return (
          <div key={i} className="lyrics-line lyrics-line-chords">
            {chunks.map((c, j) => (
              <span key={j} className="lyrics-chunk">
                <span className="lyrics-chord">{c.chord ? transposeChord(c.chord, semitones) : " "}</span>
                <span>{c.text || (c.chord ? " " : "")}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

const PAGE_SIZE = 5;

export default function SongsPanel({ band, songs, canEdit }: { band: Band; songs: Song[]; canEdit: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  // Perquè l'editor de la cançó (Surt) sempre torni exactament a aquesta
  // pestanya (Cançons), sigui la del gestor o la del músic.
  const songHref = (id: string) => `/canco/${id}?back=${encodeURIComponent(pathname + "?tab=cancons")}&backLabel=${encodeURIComponent("Cançons")}`;
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Còpia local per poder reordenar a l'instant (arrossega i deixa anar)
  // sense esperar el router.refresh() — es torna a sincronitzar si la prop
  // canvia (p. ex. algú altre ha editat el repertori).
  const [ordered, setOrdered] = useState(songs);
  useEffect(() => { setOrdered(songs); }, [songs]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  // Avís quan es clica una cançó sense cap partitura ni àudio: no té sentit
  // entrar al mode escenari amb la pantalla buida.
  const [emptyWarnId, setEmptyWarnId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState(false);
  function openSong(s: Song) {
    if (s.files.length === 0) {
      setEmptyWarnId(s.id);
      window.setTimeout(() => setEmptyWarnId((id) => (id === s.id ? null : id)), 2200);
      return;
    }
    router.push(`/escenari-mode/song/${s.id}`);
  }

  const q = normalize(search.trim());
  const list = q
    ? ordered.filter((s) => normalize(s.title).includes(q) || normalize(s.artist).includes(q) || s.tags.some((t) => normalize(t).includes(q)))
    : ordered;
  // L'ordre manual només té sentit sobre la llista sencera: mentre es
  // busca, es veuen els resultats normals però no es poden arrossegar.
  const reorderable = canEdit && !q;
  const visible = !q && !showAll ? list.slice(0, PAGE_SIZE) : list;
  // Etiquetes ja fetes servir en qualsevol cançó del repertori, per
  // recomanar-les en comptes d'haver-les de reescriure cada cop.
  const allTags = uniqueTags(ordered);

  // Arrossegar i deixar anar amb reflux en directe: cada cop que el
  // fantasma passa per sobre d'una altra fila, la resta ja es mou a la
  // posició que li tocaria si es deixés anar aquí mateix — el "drop" només
  // desa l'ordre que ja es veu.
  function dragOverRow(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setOrdered((prev) => {
      const from = prev.findIndex((s) => s.id === dragId);
      const to = prev.findIndex((s) => s.id === targetId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  function finalizeDrag() {
    if (dragId) reorderSongsAction(band.id, ordered.map((s) => s.id));
    setDragId(null);
  }

  async function commitTags(s: Song, nextTags: string[]) {
    setOrdered((prev) => prev.map((x) => (x.id === s.id ? { ...x, tags: nextTags } : x)));
    await saveSongAction({
      id: s.id, bandId: band.id, title: s.title, artist: s.artist, tempo: s.tempo, songKey: s.songKey,
      duration: s.duration, notes: s.notes, lyrics: s.lyrics, coverUrl: s.coverUrl, instruments: s.instruments, tags: nextTags,
    });
    router.refresh();
  }
  function addTagTo(s: Song) {
    const t = tagInput.trim();
    setTagInput("");
    if (!t || s.tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    commitTags(s, [...s.tags, t]);
  }
  function pickSuggestion(s: Song, t: string) {
    setTagInput("");
    commitTags(s, [...s.tags, t]);
  }
  // Etiquetes que encara no té aquesta cançó, filtrades pel que s'ha
  // escrit fins ara — la llista d'on triar en comptes de reescriure-les.
  function suggestionsFor(s: Song): string[] {
    const qq = normalize(tagInput.trim());
    return allTags
      .filter((t) => !s.tags.some((x) => x.toLowerCase() === t.toLowerCase()))
      .filter((t) => !qq || normalize(t).includes(qq))
      .slice(0, 6);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 12 }}>
          <div className="panel-title">Repertori <span className="t-dim" style={{ fontWeight: 400 }}>· {songs.length} {songs.length === 1 ? "cançó" : "cançons"}</span></div>
          {canEdit && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.3} baseColor="#8b7bff" lineColor="#ffffff" disabled={creating}
                onClick={async () => {
                  setCreating(true);
                  const { id } = await saveSongAction({
                    id: null, bandId: band.id, title: "Nova cançó", artist: "", tempo: 0,
                    songKey: "", duration: "", notes: "", lyrics: "", instruments: [],
                  });
                  router.push(songHref(id));
                }}>
                {creating ? "Creant…" : "+ Nova cançó"}
              </SpecularButton>
            </div>
          )}
        </div>

        <input className="input search" style={{ marginBottom: 12, maxWidth: 320 }} placeholder="Cerca per títol, artista o etiqueta…" value={search} onChange={(e) => setSearch(e.target.value)} />

        {list.length === 0 ? (
          <div className="empty-state">{songs.length ? "Cap cançó coincideix amb la cerca." : "Encara no hi ha cançons al repertori."}</div>
        ) : (
          <div className="sp-list">
            <div className="sp-row sp-head">
              <span className="sp-idx"></span>
              <span></span>
              <span>Títol</span>
              <span className="sp-actions"></span>
            </div>
            {visible.map((s) => {
              const coverColor = band.color1 || "#8b7bff";
              return (
              <Fragment key={s.id}>
                <div
                  className={"sp-row clickable" + (dragId === s.id ? " sp-row-dragging" : "")}
                  onClick={() => openSong(s)}
                  draggable={reorderable}
                  onDragStart={reorderable ? (e) => {
                    setDragId(s.id);
                    e.dataTransfer.effectAllowed = "move";
                    // Sense la imatge nativa que el navegador arrossega
                    // enganxada al cursor — l'únic fantasma ha de ser la
                    // fila mateixa, mig transparent, movent-se en directe.
                    const blank = new Image();
                    blank.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
                    e.dataTransfer.setDragImage(blank, 0, 0);
                  } : undefined}
                  onDragEnter={reorderable ? () => dragOverRow(s.id) : undefined}
                  onDragOver={reorderable ? (e) => e.preventDefault() : undefined}
                  onDrop={reorderable ? (e) => e.preventDefault() : undefined}
                  onDragEnd={reorderable ? () => finalizeDrag() : undefined}
                >
                  <span className={"sp-idx" + (reorderable ? " sp-drag-handle" : "")} onClick={(e) => e.stopPropagation()} title={reorderable ? "Arrossega per reordenar" : undefined}>
                    {reorderable && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ opacity: 0.5 }}>
                        <circle cx="8" cy="6" r="1.6"></circle><circle cx="16" cy="6" r="1.6"></circle>
                        <circle cx="8" cy="12" r="1.6"></circle><circle cx="16" cy="12" r="1.6"></circle>
                        <circle cx="8" cy="18" r="1.6"></circle><circle cx="16" cy="18" r="1.6"></circle>
                      </svg>
                    )}
                  </span>
                  {s.coverUrl || band.logo ? (
                    <img className="sp-cover sp-cover-img" src={s.coverUrl || band.logo} alt="" loading="lazy" draggable={false} />
                  ) : (
                    <span className="sp-cover" style={{ background: `linear-gradient(135deg, ${coverColor}, #17141f)` }}>♪</span>
                  )}
                  <span className="sp-title-wrap">
                    <span className="sp-title-row">
                      <span className="sp-title">{s.title}{hasChords(s.lyrics) && <span className="song-chord-badge" title="Té acords">♪</span>}</span>
                      {s.tags.map((t) => {
                        const tc = tagColors(t);
                        return tagEditId === s.id ? (
                          <button key={t} type="button" className="badge sm" style={{ background: tc.bg, color: tc.color, border: "none", cursor: "pointer" }}
                            title="Elimina" onClick={(e) => { e.stopPropagation(); commitTags(s, s.tags.filter((x) => x !== t)); }}>
                            {t} ✕
                          </button>
                        ) : (
                          <span key={t} className="badge sm" style={{ background: tc.bg, color: tc.color }}>{t}</span>
                        );
                      })}
                      {canEdit && (
                        tagEditId === s.id ? (
                          <>
                            <span className="sp-tag-suggest-wrap">
                              <input
                                className="field-input compact-field sp-tag-inline-input" autoFocus
                                placeholder="Etiqueta…" value={tagInput}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); addTagTo(s); }
                                  if (e.key === "Escape") { e.preventDefault(); setTagEditId(null); }
                                }}
                              />
                              {tagInput.trim().length > 0 && suggestionsFor(s).length > 0 && (
                                <div className="sp-tag-suggest-menu" onClick={(e) => e.stopPropagation()}>
                                  {suggestionsFor(s).map((t) => {
                                    const tc = tagColors(t);
                                    return (
                                      <button key={t} type="button" className="sp-tag-suggest-item" onClick={() => pickSuggestion(s, t)}>
                                        <span className="sp-tag-suggest-dot" style={{ background: tc.color }} />
                                        {t}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </span>
                            <button type="button" className="sp-tag-done-btn" title="Fet" onClick={(e) => { e.stopPropagation(); addTagTo(s); setTagEditId(null); }}>✓</button>
                          </>
                        ) : (
                          <button type="button" className="sp-tag-add-btn" title="Afegeix una etiqueta"
                            onClick={(e) => { e.stopPropagation(); setTagEditId(s.id); setTagInput(""); }}>+</button>
                        )
                      )}
                    </span>
                    <span className="sp-artist">
                      {s.artist || band.name}
                      {(() => {
                        const scoreCount = s.files.filter((f) => !f.mime.startsWith("audio")).length;
                        const audioCount = s.files.length - scoreCount;
                        return (
                          <>
                            {scoreCount > 0 && <span className="sp-file-count" title="Partitures"><ScoreIcon />{scoreCount}</span>}
                            {audioCount > 0 && <span className="sp-file-count" title="Àudios"><WaveformIcon />{audioCount}</span>}
                          </>
                        );
                      })()}
                    </span>
                  </span>
                  <span className="sp-actions" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <>
                        <button type="button" className="row-edit-btn" title="Edita la cançó" onClick={() => router.push(songHref(s.id))}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button type="button" className="row-delete-btn" title="Elimina"
                          onClick={() => setDeleteTarget(s)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </>
                    )}
                  </span>
                  {emptyWarnId === s.id && <div className="sp-empty-toast">Afegeix partitures per entrar al mode escenari</div>}
                </div>
              </Fragment>
              );
            })}
          </div>
        )}
        {!q && list.length > PAGE_SIZE && (
          <button type="button" className="btn-outline" style={{ width: "100%", marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Amaga" : `Mostra-les totes (${list.length})`}
          </button>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar la cançó?"
          message={<>Segur que vols eliminar la cançó <strong>{deleteTarget.title}</strong>?</>}
          confirmLabel="Elimina" busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setDeleting(true);
            await deleteSongAction(band.id, deleteTarget.id);
            setDeleting(false);
            setDeleteTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
