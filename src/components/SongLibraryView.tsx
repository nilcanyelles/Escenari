"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Song } from "@/lib/songs";
import type { Setlist } from "@/lib/material-types";
import { normalize } from "@/lib/text";
import { bandPhotoDataUri, tagColors, uniqueTags } from "@/lib/tags";
import { saveSongAction, deleteSongAction } from "@/app/(app)/grup/songs-actions";
import { deleteSetlistAction } from "@/app/(app)/grup/material-actions";
import ConfirmDialog from "@/components/ConfirmDialog";
import PrintScoresModal from "@/components/PrintScoresModal";
import SetlistEditor from "@/components/SetlistEditor";

export type LibraryItem = { song: Song; bandId: string | null; bandName: string; bandColor: string; bandLogo: string; canEdit: boolean };
export type SetlistItem = { setlist: Setlist; bandId: string | null; bandName: string; bandColor: string; bandLogo: string; canEdit: boolean };
type BandOpt = { id: string; name: string; color1: string; logo: string; canEdit: boolean; canEditSetlists: boolean };

const MINE = "__mine__";

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

// Biblioteca de cançons del músic: repertori de tots els grups (filtrable per
// grup i per text) i cançons pròpies, cada una amb mode escenari — clicar-la
// hi entra directament. Mateixa estètica que el Repertori d'un grup, amb
// etiquetes i edició/eliminació només on hi ha permís. El botó "Setlists"
// canvia la mateixa llista a les setlists d'aquells grups, amb els mateixos
// filtres (grup i cercador).
export default function SongLibraryView({ items, setlistItems, bands }: { items: LibraryItem[]; setlistItems: SetlistItem[]; bands: BandOpt[] }) {
  const router = useRouter();
  const pathname = usePathname();
  // Perquè l'editor de la cançó (Surt) sempre torni exactament aquí.
  const songHref = (id: string) => `/canco/${id}?back=${encodeURIComponent(pathname)}&backLabel=${encodeURIComponent("Biblioteca de cançons")}`;
  const [view, setView] = useState<"songs" | "setlists">("songs");
  const [expandedSetlistId, setExpandedSetlistId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(""); // "" = totes, id de grup, o MINE (només per a cançons)
  const [pickingBand, setPickingBand] = useState(false);
  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LibraryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [pickingSetlistBand, setPickingSetlistBand] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<{ setlist: Setlist | null; band: { id: string; name: string; color1: string; logo: string } | null } | null>(null);
  const [deleteSetlistTarget, setDeleteSetlistTarget] = useState<SetlistItem | null>(null);
  const [deletingSetlist, setDeletingSetlist] = useState(false);

  const allTags = useMemo(() => uniqueTags(items.map((it) => it.song)), [items]);

  async function createSong(bandId: string | null) {
    setPickingBand(false);
    setCreating(true);
    const { id } = await saveSongAction({ id: null, bandId, title: "Nova cançó", artist: "", tempo: 0, songKey: "", duration: "", notes: "", lyrics: "" });
    router.push(songHref(id));
  }

  // Grups on té permís per penjar-hi cançons — si no en té cap, directament
  // a cançó pròpia, sense preguntar per a un sol grup inexistent.
  const creatableBands = bands.filter((b) => b.canEdit);
  const creatableSetlistBands = bands.filter((b) => b.canEditSetlists);

  function createSetlist(bandId: string | null) {
    setPickingSetlistBand(false);
    const band = bandId ? bands.find((b) => b.id === bandId) : null;
    setEditingSetlist({ setlist: null, band: band ? { id: band.id, name: band.name, color1: band.color1, logo: band.logo } : null });
  }
  function editSetlist(it: SetlistItem) {
    setEditingSetlist({
      setlist: it.setlist,
      band: it.bandId ? { id: it.bandId, name: it.bandName, color1: it.bandColor, logo: it.bandLogo } : null,
    });
  }

  async function commitTags(it: LibraryItem, nextTags: string[]) {
    const s = it.song;
    await saveSongAction({
      id: s.id, bandId: it.bandId, title: s.title, artist: s.artist, tempo: s.tempo, songKey: s.songKey,
      duration: s.duration, notes: s.notes, lyrics: s.lyrics, coverUrl: s.coverUrl, instruments: s.instruments, tags: nextTags,
    });
    router.refresh();
  }
  function addTagTo(it: LibraryItem) {
    const t = tagInput.trim();
    setTagInput("");
    if (!t || it.song.tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    commitTags(it, [...it.song.tags, t]);
  }
  function pickSuggestion(it: LibraryItem, t: string) {
    setTagInput("");
    commitTags(it, [...it.song.tags, t]);
  }
  // Etiquetes que encara no té aquesta cançó, filtrades pel que s'ha escrit
  // fins ara — la llista d'on triar en comptes de reescriure-les.
  function suggestionsFor(it: LibraryItem): string[] {
    const qq = normalize(tagInput.trim());
    return allTags
      .filter((t) => !it.song.tags.some((x) => x.toLowerCase() === t.toLowerCase()))
      .filter((t) => !qq || normalize(t).includes(qq))
      .slice(0, 6);
  }

  // Les cançons sel·leccionades, en l'ordre en què s'han anat clicant
  // (l'ordre d'inserció d'un Set es manté) — tractades com si fossin una
  // setlist quan s'obre el mode escenari o s'imprimeixen totes alhora.
  const selectedItems = Array.from(selected)
    .map((id) => items.find((it) => it.song.id === id))
    .filter((it): it is LibraryItem => !!it);

  function clearSelection() {
    setSelected(new Set());
  }

  async function bulkDelete() {
    setBulkDeleting(true);
    for (const it of selectedItems) {
      if (!it.canEdit) continue;
      await deleteSongAction(it.bandId, it.song.id);
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    clearSelection();
    router.refresh();
  }

  const q = normalize(search.trim());
  const list = items
    .filter((it) => (filter === "" ? true : filter === MINE ? it.bandId === null : it.bandId === filter))
    .filter((it) => !q || normalize(it.song.title).includes(q) || normalize(it.song.artist).includes(q) || normalize(it.bandName).includes(q) || it.song.tags.some((t) => normalize(t).includes(q)))
    .sort((a, b) => a.song.title.localeCompare(b.song.title, "ca"));
  const mineCount = items.filter((it) => it.bandId === null).length;

  const setlistList = setlistItems
    .filter((it) => (filter === "" ? true : filter === MINE ? it.bandId === null : it.bandId === filter))
    .filter((it) => !q || normalize(it.setlist.name).includes(q) || normalize(it.bandName).includes(q))
    .sort((a, b) => a.setlist.name.localeCompare(b.setlist.name, "ca"));
  const mineSetlistCount = setlistItems.filter((it) => it.bandId === null).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel-header-row" style={{ marginBottom: 0 }}>
        <div>
          <div className="artist-section-title" style={{ marginBottom: 2 }}>{view === "songs" ? "Biblioteca de cançons" : "Setlists"}</div>
          <div className="t-dim" style={{ fontSize: 12.5 }}>
            {view === "songs"
              ? <>{items.length} cançons de {bands.length} {bands.length === 1 ? "grup" : "grups"}{mineCount ? ` · ${mineCount} pròpies` : ""}</>
              : <>{setlistItems.length} setlists de {bands.length} {bands.length === 1 ? "grup" : "grups"}</>}
          </div>
        </div>
        {view === "songs" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button" className="lib-print-round" disabled={list.length === 0 && selectedItems.length === 0}
              title={selectedItems.length > 0 ? "Imprimeix les cançons sel·leccionades" : "Imprimeix les cançons que es veuen ara a la llista"}
              onClick={() => (selectedItems.length > 0 ? setBulkPrinting(true) : setPrinting(true))}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            </button>
            <button
              type="button" className="glow-cta" disabled={creating}
              onClick={() => (creatableBands.length > 0 ? setPickingBand(true) : createSong(null))}
            >{creating ? "Creant…" : "+ Nova cançó"}</button>
          </div>
        )}
        {view === "setlists" && (
          <button
            type="button" className="glow-cta"
            onClick={() => (creatableSetlistBands.length > 0 ? setPickingSetlistBand(true) : createSetlist(null))}
          >+ Nova setlist</button>
        )}
      </div>

      <div className="lib-filters">
        <input className="field-input compact-field" style={{ maxWidth: 280 }} placeholder={view === "songs" ? "Cerca per títol, artista, grup o etiqueta…" : "Cerca per nom o grup…"} value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="access-box-list">
          <button type="button" className={"access-chip" + (filter === "" ? " active" : "")} onClick={() => setFilter("")}>
            Totes ({view === "songs" ? items.length : setlistItems.length})
          </button>
          {bands.map((b) => (
            <button key={b.id} type="button" className={"access-chip lib-chip" + (filter === b.id ? " active" : "")} onClick={() => setFilter(b.id)}>
              <img src={b.logo || bandPhotoDataUri({ id: b.id, name: b.name })} alt="" />{b.name} ({(view === "songs" ? items : setlistItems).filter((it) => it.bandId === b.id).length})
            </button>
          ))}
          <button type="button" className={"access-chip" + (filter === MINE ? " active" : "")} onClick={() => setFilter(MINE)}>
            Les meves ({view === "songs" ? mineCount : mineSetlistCount})
          </button>
          <button
            type="button" className="access-chip" style={{ marginLeft: "auto" }}
            onClick={() => setView((v) => (v === "songs" ? "setlists" : "songs"))}
          >{view === "songs" ? "Setlists" : "Cançons"}</button>
        </div>
      </div>

      {view === "songs" && (list.length === 0 ? (
        <div className="artist-empty">
          {items.length === 0 ? "Encara no hi ha cap cançó: els teus grups no tenen repertori penjat i no en tens cap de pròpia." : "Cap cançó coincideix amb el filtre."}
        </div>
      ) : (
        <div className="sp-list">
          <div className="sp-row sp-head">
            <span className="sp-idx">
              {selectedItems.length > 0 && (
                <span className="lib-select-count-wrap">
                  <span className="lib-select-count">{selectedItems.length}</span>
                  <button type="button" className="lib-select-clear" title="Desfés la sel·lecció" onClick={clearSelection}>✕</button>
                </span>
              )}
            </span>
            <span></span>
            <span>Títol</span>
            <span className="lib-band-col">Grup</span>
            <span className="sp-actions lib-actions-wide"></span>
          </div>
          {list.map((it, i) => {
            const { song: s, bandId, bandName, bandColor, bandLogo, canEdit } = it;
            const audio = s.files.find((f) => f.mime.startsWith("audio"));
            const scoreCount = s.files.length - (audio ? s.files.filter((f) => f.mime.startsWith("audio")).length : 0);
            const audioCount = s.files.filter((f) => f.mime.startsWith("audio")).length;
            const isSelected = selected.has(s.id);
            return (
              <div
                key={s.id} className={"sp-row clickable" + (isSelected ? " lib-row-selected" : "")}
                onClick={() => setSelected((prev) => { const next = new Set(prev); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; })}
              >
                <span className="sp-idx">
                  <span className={"lib-select-check" + (isSelected ? " on" : "")}>{isSelected ? "✓" : i + 1}</span>
                </span>
                {s.coverUrl || bandLogo ? (
                  <img className="sp-cover sp-cover-img" src={s.coverUrl || bandLogo} alt="" loading="lazy" />
                ) : (
                  <span className="sp-cover" style={{ background: `linear-gradient(135deg, ${bandColor}, #17141f)` }}>♪</span>
                )}
                <span className="sp-title-wrap">
                  <span className="sp-title-row">
                    <span className="sp-title">{s.title}</span>
                    {s.tags.map((t) => {
                      const tc = tagColors(t);
                      return tagEditId === s.id ? (
                        <button key={t} type="button" className="badge sm" style={{ background: tc.bg, color: tc.color, border: "none", cursor: "pointer" }}
                          title="Elimina" onClick={(e) => { e.stopPropagation(); commitTags(it, s.tags.filter((x) => x !== t)); }}>
                          {t} ✕
                        </button>
                      ) : (
                        <span key={t} className="badge sm" style={{ background: tc.bg, color: tc.color }}>{t}</span>
                      );
                    })}
                    {canEdit && (
                      tagEditId === s.id ? (
                        <span className="sp-tag-suggest-wrap" onClick={(e) => e.stopPropagation()}>
                          <input
                            className="field-input compact-field sp-tag-inline-input" autoFocus
                            placeholder="Etiqueta…" value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); addTagTo(it); }
                              if (e.key === "Escape") { e.preventDefault(); setTagEditId(null); }
                            }}
                          />
                          {tagInput.trim().length > 0 && suggestionsFor(it).length > 0 && (
                            <div className="sp-tag-suggest-menu">
                              {suggestionsFor(it).map((t) => {
                                const tc = tagColors(t);
                                return (
                                  <button key={t} type="button" className="sp-tag-suggest-item" onClick={() => pickSuggestion(it, t)}>
                                    <span className="sp-tag-suggest-dot" style={{ background: tc.color }} />
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <button type="button" className="sp-tag-done-btn" title="Fet" onClick={() => setTagEditId(null)}>✓</button>
                        </span>
                      ) : (
                        <button type="button" className="sp-tag-add-btn" title="Afegeix una etiqueta"
                          onClick={(e) => { e.stopPropagation(); setTagEditId(s.id); setTagInput(""); }}>+</button>
                      )
                    )}
                  </span>
                  <span className="sp-artist">
                    {s.artist || bandName}
                    {scoreCount > 0 && <span className="sp-file-count" title="Partitures"><ScoreIcon />{scoreCount}</span>}
                    {audioCount > 0 && <span className="sp-file-count" title="Àudios"><WaveformIcon />{audioCount}</span>}
                  </span>
                </span>
                <span className="lib-band-col">
                  <span className="lib-band" style={{ background: `${bandColor}26`, color: bandColor }}>{bandName}</span>
                </span>
                <span className="sp-actions lib-actions-wide" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button" className="sp-play"
                    title={isSelected && selectedItems.length > 1 ? "Obre el mode escenari de la sel·lecció" : "Obre el mode escenari"}
                    onClick={() => {
                      if (isSelected && selectedItems.length > 1) {
                        router.push(`/escenari-mode/multi?ids=${selectedItems.map((x) => x.song.id).join(",")}`);
                      } else {
                        router.push(`/escenari-mode/song/${s.id}`);
                      }
                    }}
                  >
                    ▶
                  </button>
                  {canEdit && (
                    <>
                      <button type="button" className="row-edit-btn" title="Edita la cançó" onClick={() => router.push(songHref(s.id))}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                      </button>
                      <button
                        type="button" className="row-delete-btn"
                        title={isSelected && selectedItems.length > 1 ? "Elimina les cançons sel·leccionades" : "Elimina la cançó"}
                        onClick={() => (isSelected && selectedItems.length > 1 ? setBulkDeleteConfirm(true) : setDeleteTarget(it))}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {view === "setlists" && (setlistList.length === 0 ? (
        <div className="artist-empty">
          {setlistItems.length === 0 ? "Els teus grups encara no tenen cap setlist." : "Cap setlist coincideix amb el filtre."}
        </div>
      ) : (
        <div className="sp-list">
          <div className="sp-row sp-head">
            <span className="sp-idx"></span>
            <span></span>
            <span>Nom</span>
            <span className="lib-band-col">Grup</span>
            <span className="sp-actions lib-actions-wide"></span>
          </div>
          {setlistList.map((it, i) => {
            const { setlist: sl, bandName, bandColor, bandLogo, canEdit } = it;
            const songTitles = sl.songs.filter((s) => s.title.trim());
            const expanded = expandedSetlistId === sl.id;
            return (
              <Fragment key={sl.id}>
                <div className="sp-row clickable" onClick={() => router.push(`/escenari-mode/${sl.id}`)}>
                  <span className="sp-idx"><span className="sp-num">{i + 1}</span></span>
                  {sl.coverUrl || bandLogo ? (
                    <img className="sp-cover sp-cover-img" src={sl.coverUrl || bandLogo} alt="" loading="lazy" />
                  ) : (
                    <span className="sp-cover" style={{ background: `linear-gradient(135deg, ${bandColor}, #17141f)` }}>♪</span>
                  )}
                  <span className="sp-title-wrap">
                    <span className="sp-title-row">
                      <span className="sp-title">{sl.name}</span>
                      <button
                        type="button" className={"lib-expand-btn" + (expanded ? " open" : "")}
                        title={expanded ? "Amaga les cançons" : "Mostra les cançons"}
                        onClick={(e) => { e.stopPropagation(); setExpandedSetlistId(expanded ? null : sl.id); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                    </span>
                    <span className="sp-artist">{songTitles.length} {songTitles.length === 1 ? "cançó" : "cançons"}</span>
                  </span>
                  <span className="lib-band-col">
                    <span className="lib-band" style={{ background: `${bandColor}26`, color: bandColor }}>{bandName}</span>
                  </span>
                  <span className="sp-actions lib-actions-wide" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <>
                        <button type="button" className="row-edit-btn" title="Edita la setlist" onClick={() => editSetlist(it)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button type="button" className="row-delete-btn" title="Elimina la setlist" onClick={() => setDeleteSetlistTarget(it)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </>
                    )}
                  </span>
                </div>
                {expanded && (
                  <div className="lib-setlist-songs">
                    {songTitles.length === 0 ? (
                      <div className="t-dim" style={{ fontSize: 12.5 }}>Aquesta setlist encara no té cap cançó.</div>
                    ) : (
                      songTitles.map((s, si) => (
                        <div key={si} className="lib-setlist-song-row"><span className="t-dim">{si + 1}.</span> {s.title}</div>
                      ))
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      ))}

      {pickingBand && (
        <div className="modal-overlay" onClick={() => setPickingBand(false)}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Per quin grup vols crear la nova cançó?</div>
              <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={() => setPickingBand(false)}>✕</button>
            </div>
            <div className="access-box-list" style={{ flexDirection: "column", alignItems: "stretch" }}>
              {creatableBands.map((b) => (
                <button
                  key={b.id} type="button" className="access-chip lib-chip" style={{ justifyContent: "flex-start" }}
                  disabled={creating} onClick={() => createSong(b.id)}
                >
                  <img src={b.logo || bandPhotoDataUri({ id: b.id, name: b.name })} alt="" />{b.name}
                </button>
              ))}
              <button type="button" className="access-chip" style={{ justifyContent: "flex-start" }} disabled={creating} onClick={() => createSong(null)}>
                🎵 Cançó pròpia
              </button>
            </div>
          </div>
        </div>
      )}

      {pickingSetlistBand && (
        <div className="modal-overlay" onClick={() => setPickingSetlistBand(false)}>
          <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Per quin grup vols crear la nova setlist?</div>
              <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={() => setPickingSetlistBand(false)}>✕</button>
            </div>
            <div className="access-box-list" style={{ flexDirection: "column", alignItems: "stretch" }}>
              {creatableSetlistBands.map((b) => (
                <button
                  key={b.id} type="button" className="access-chip lib-chip" style={{ justifyContent: "flex-start" }}
                  onClick={() => createSetlist(b.id)}
                >
                  <img src={b.logo || bandPhotoDataUri({ id: b.id, name: b.name })} alt="" />{b.name}
                </button>
              ))}
              <button type="button" className="access-chip" style={{ justifyContent: "flex-start" }} onClick={() => createSetlist(null)}>
                🎵 Setlist pròpia
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSetlist && (
        <SetlistEditor
          band={editingSetlist.band}
          setlist={editingSetlist.setlist}
          librarySongs={editingSetlist.band ? items.filter((it) => it.bandId === editingSetlist.band!.id).map((it) => it.song) : items.filter((it) => it.bandId === null).map((it) => it.song)}
          onClose={() => { setEditingSetlist(null); router.refresh(); }}
        />
      )}

      {deleteSetlistTarget && (
        <ConfirmDialog
          title="Eliminar la setlist?"
          message={<>Segur que vols eliminar la setlist <strong>{deleteSetlistTarget.setlist.name}</strong>?</>}
          confirmLabel="Elimina" busy={deletingSetlist}
          onCancel={() => setDeleteSetlistTarget(null)}
          onConfirm={async () => {
            setDeletingSetlist(true);
            await deleteSetlistAction(deleteSetlistTarget.bandId, deleteSetlistTarget.setlist.id);
            setDeletingSetlist(false);
            setDeleteSetlistTarget(null);
            router.refresh();
          }}
        />
      )}

      {printing && (
        <PrintScoresModal
          title="Biblioteca de cançons"
          songs={list.map((it) => ({ title: it.song.title, songId: it.song.id }))}
          librarySongs={list.map((it) => it.song)}
          onClose={() => setPrinting(false)}
        />
      )}

      {bulkPrinting && (
        <PrintScoresModal
          title="Cançons sel·leccionades"
          songs={selectedItems.map((it) => ({ title: it.song.title, songId: it.song.id }))}
          librarySongs={selectedItems.map((it) => it.song)}
          onClose={() => setBulkPrinting(false)}
        />
      )}

      {bulkDeleteConfirm && (
        <ConfirmDialog
          title="Eliminar les cançons?"
          message={<>Segur que vols eliminar les <strong>{selectedItems.length}</strong> cançons sel·leccionades?</>}
          confirmLabel="Elimina" busy={bulkDeleting}
          onCancel={() => setBulkDeleteConfirm(false)}
          onConfirm={bulkDelete}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar la cançó?"
          message={<>Segur que vols eliminar la cançó <strong>{deleteTarget.song.title}</strong>?</>}
          confirmLabel="Elimina" busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setDeleting(true);
            await deleteSongAction(deleteTarget.bandId, deleteTarget.song.id);
            setDeleting(false);
            setDeleteTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
