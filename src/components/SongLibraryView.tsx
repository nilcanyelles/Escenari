"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Song } from "@/lib/songs";
import { normalize } from "@/lib/text";
import { bandPhotoDataUri, instrumentIconFor } from "@/lib/tags";
import { saveSongAction, deleteSongAction } from "@/app/(app)/grup/songs-actions";

export type LibraryItem = { song: Song; bandId: string | null; bandName: string; bandColor: string; bandLogo: string };
type BandOpt = { id: string; name: string; color1: string; logo: string };

const MINE = "__mine__";

// Biblioteca de cançons del músic: repertori de tots els grups (filtrable per
// grup i per text) i cançons pròpies, cada una amb el mode escenari.
export default function SongLibraryView({ items, bands }: { items: LibraryItem[]; bands: BandOpt[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(""); // "" = totes, id de grup, o MINE
  const [creating, setCreating] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function togglePlay(songId: string, fileId: string) {
    if (playingId === songId) { audioRef.current?.pause(); setPlayingId(null); return; }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = `/api/file/${fileId}`;
    audioRef.current.play();
    audioRef.current.onended = () => setPlayingId(null);
    setPlayingId(songId);
  }

  async function createPersonal() {
    setCreating(true);
    const { id } = await saveSongAction({ id: null, bandId: null, title: "Nova cançó", artist: "", tempo: 0, songKey: "", duration: "", notes: "", lyrics: "" });
    router.push(`/canco/${id}`);
  }

  const q = normalize(search.trim());
  const list = items
    .filter((it) => (filter === "" ? true : filter === MINE ? it.bandId === null : it.bandId === filter))
    .filter((it) => !q || normalize(it.song.title).includes(q) || normalize(it.song.artist).includes(q) || normalize(it.bandName).includes(q))
    .sort((a, b) => a.song.title.localeCompare(b.song.title, "ca"));
  const mineCount = items.filter((it) => it.bandId === null).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel-header-row" style={{ marginBottom: 0 }}>
        <div>
          <div className="artist-section-title" style={{ marginBottom: 2 }}>Biblioteca de cançons</div>
          <div className="t-dim" style={{ fontSize: 12.5 }}>{items.length} cançons de {bands.length} {bands.length === 1 ? "grup" : "grups"}{mineCount ? ` · ${mineCount} pròpies` : ""}</div>
        </div>
        <button type="button" className="glow-cta" disabled={creating} onClick={createPersonal}>{creating ? "Creant…" : "+ Nova cançó pròpia"}</button>
      </div>

      <div className="lib-filters">
        <input className="field-input compact-field" style={{ maxWidth: 280 }} placeholder="Cerca per títol, artista o grup…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="access-box-list">
          <button type="button" className={"access-chip" + (filter === "" ? " active" : "")} onClick={() => setFilter("")}>Totes</button>
          {bands.map((b) => (
            <button key={b.id} type="button" className={"access-chip lib-chip" + (filter === b.id ? " active" : "")} onClick={() => setFilter(b.id)}>
              <img src={b.logo || bandPhotoDataUri({ id: b.id, name: b.name })} alt="" />{b.name}
            </button>
          ))}
          <button type="button" className={"access-chip" + (filter === MINE ? " active" : "")} onClick={() => setFilter(MINE)}>Les meves</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="artist-empty">
          {items.length === 0 ? "Encara no hi ha cap cançó: els teus grups no tenen repertori penjat i no en tens cap de pròpia." : "Cap cançó coincideix amb el filtre."}
        </div>
      ) : (
        <div className="lib-list">
          {list.map(({ song: s, bandId, bandName, bandColor, bandLogo }) => {
            const audio = s.files.find((f) => f.mime.startsWith("audio"));
            const meta = [s.songKey, s.tempo ? `${s.tempo} bpm` : "", s.duration].filter(Boolean).join(" · ");
            return (
              <div key={s.id} className={"lib-row" + (playingId === s.id ? " playing" : "")}>
                {s.coverUrl || bandLogo ? (
                  <img className="sp-cover sp-cover-img" src={s.coverUrl || bandLogo} alt="" loading="lazy" />
                ) : (
                  <span className="sp-cover" style={{ background: `linear-gradient(135deg, ${bandColor}, #17141f)` }}>♪</span>
                )}
                <div className="lib-main">
                  <div className="sp-title">{s.title}</div>
                  <div className="sp-artist">{s.artist || "—"}{meta ? ` · ${meta}` : ""}</div>
                  <div className="lib-tags">
                    <span className="lib-band" style={{ background: `${bandColor}26`, color: bandColor }}>{bandName}</span>
                    {s.instruments.slice(0, 3).map((ins) => {
                      const icon = instrumentIconFor(ins);
                      return <span key={ins} className="member-instrument-chip">{icon && <img src={icon} alt="" />}{ins}</span>;
                    })}
                  </div>
                </div>
                <div className="lib-actions">
                  {audio && (
                    <button type="button" className="sp-play" style={{ background: playingId === s.id ? undefined : "oklch(1 0 0 / 0.08)", color: "white" }} title="Escolta" onClick={() => togglePlay(s.id, audio.id)}>
                      {playingId === s.id ? "❚❚" : "▶"}
                    </button>
                  )}
                  <button type="button" className="btn-outline stage-mode-btn" title="Mode escenari només amb aquesta cançó" onClick={() => router.push(`/escenari-mode/song/${s.id}`)}>▶ Escenari</button>
                  <button type="button" className="btn-outline" onClick={() => router.push(`/canco/${s.id}`)}>Obre</button>
                  {bandId === null && (
                    <button type="button" className="row-delete-btn" title="Elimina la cançó"
                      onClick={async () => {
                        if (!confirm(`Eliminar "${s.title}"?`)) return;
                        await deleteSongAction(null, s.id);
                        router.refresh();
                      }}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
