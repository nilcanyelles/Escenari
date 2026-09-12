"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BackLink from "@/components/BackLink";
import { LyricsView } from "@/components/SongsPanel";
import { instrumentIconFor } from "@/lib/tags";
import PdfViewer from "@/components/PdfViewer";
import { setSetlistHighlightsAction } from "@/app/(app)/concerts/actions";
// @ts-expect-error soundtouchjs no porta tipus TS
import { PitchShifter } from "soundtouchjs";

// Interfície mínima del PitchShifter de soundtouchjs (nou amb
// context+buffer): time-stretch (tempo) i pitch-shift (pitchSemitones)
// independents, sobre un AudioBuffer ja decodificat.
type PitchShifterInstance = {
  tempo: number;
  pitchSemitones: number;
  percentagePlayed: number;
  timePlayed: number;
  connect: (node: AudioNode) => void;
  disconnect: () => void;
  on: (event: "play", cb: (d: { timePlayed: number; percentagePlayed: number }) => void) => void;
};

// "Gralla dolça 1" -> "Gralla dolça" (per buscar la icona de l'instrument
// sense l'índex de la instància).
function scoreIconName(instrument: string): string {
  return instrument.replace(/\s+\d+$/, "").trim();
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  );
}

// Fila de la llista de cançons (menú inicial i barra lateral): igual a
// totes dues, amb l'estrella de destacar a mà dreta del títol quan hi ha
// un concert d'origen (Concert.setlistHighlights) i permís per tocar-la.
// L'animació de "puja a dalt" la porta el pare (perform-list ref + FLIP),
// per això registra la seva pròpia fila amb `rowRef`.
function SongListRow({ song, originalIndex, active, disabled, disabledTitle, highlighted, canHighlight, onToggleStar, onClick, rowRef }: {
  song: PerformSong; originalIndex: number; active?: boolean; disabled?: boolean; disabledTitle?: string; highlighted: boolean;
  canHighlight: boolean; onToggleStar: (title: string) => void; onClick: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={rowRef} className="perform-list-row">
      <button type="button" className={"perform-list-item" + (active ? " active" : "") + (disabled ? " perform-list-item-disabled" : "")} disabled={disabled} title={disabled ? disabledTitle : undefined} onClick={onClick}>
        <span className="perform-list-num">{originalIndex + 1}</span>
        <span className={highlighted ? "perform-list-title-on" : undefined}>{song.title}</span>
        <span className="t-dim" style={{ marginLeft: "auto", fontSize: 12 }}>{song.duration}</span>
      </button>
      {canHighlight && (
        <button
          type="button" className={"perform-star-btn" + (highlighted ? " on" : "")}
          title={highlighted ? "Treu-la de destacades" : "Destaca aquesta cançó"}
          onClick={(e) => { e.stopPropagation(); onToggleStar(song.title); }}
        >
          <StarIcon filled={highlighted} />
        </button>
      )}
    </div>
  );
}

export type PerformTrack = { id: string; name: string };
export type PerformScore = { id: string; name: string; mime: string; instrument: string };

export type PerformSong = {
  title: string;
  duration: string;
  key: string;
  notes: string;
  tempo: number;
  lyrics: string;
  tracks: PerformTrack[];
  scores: PerformScore[];
  instruments: string[];
};

type TrackMix = { name: string; volume: number; muted: boolean; solo: boolean };

// Nivells de velocitat de l'autoscroll, en píxels per segon.
const SCROLL_SPEEDS = [2, 3, 4, 5, 7, 9, 12, 16, 21, 27, 34, 42];

const NOTE_FREQ: Record<string, number> = {
  C: 261.63, "C#": 277.18, Db: 277.18, D: 293.66, "D#": 311.13, Eb: 311.13,
  E: 329.63, F: 349.23, "F#": 369.99, Gb: 369.99, G: 392.0, "G#": 415.3,
  Ab: 415.3, A: 440.0, "A#": 466.16, Bb: 466.16, B: 493.88,
};

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function PerformView({
  name, bandName, songs, backHref, skipIntro = false, concertId = null, initialHighlights = {}, canHighlight = false,
}: {
  name: string; bandName: string; songs: PerformSong[]; backHref: string; skipIntro?: boolean;
  concertId?: string | null; initialHighlights?: Record<string, boolean>; canHighlight?: boolean;
}) {
  // Menú inicial: nom de la setlist, bombolles per triar la veu que
  // seguiràs, i la llista de cançons — clicar-ne una hi entra directament
  // amb aquella veu ja preseleccionada (si hi és disponible). Amb una sola
  // cançó (des de la biblioteca) s'entra directament a la cançó.
  const [showIntro, setShowIntro] = useState(!skipIntro);
  const [pickedInstrument, setPickedInstrument] = useState<string | null>(null);
  // Cada veu numerada (Clarinet 1, Clarinet 2…) surt com una opció separada
  // — només es fonen entrades amb el nom EXACTAMENT igual repetides a
  // diverses cançons.
  const introInstruments = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    songs.forEach((s) => s.scores.forEach((sc) => {
      if (!seen.has(sc.instrument)) { seen.add(sc.instrument); list.push(sc.instrument); }
    }));
    return list;
  }, [songs]);

  // Cançons destacades d'aquest assaig/concert (no toquen l'ordre real de
  // la setlist — go()/idx segueixen l'ordre original — només l'ordre en
  // què es MOSTREN al menú de tria, perquè les destacades quedin a dalt.
  const [highlights, setHighlights] = useState<Record<string, boolean>>(initialHighlights);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const rowElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  function registerRow(title: string) {
    return (el: HTMLDivElement | null) => { if (el) rowElsRef.current.set(title, el); else rowElsRef.current.delete(title); };
  }
  async function toggleHighlight(title: string) {
    // FLIP: es capturen les posicions ABANS de reordenar (canvi de
    // highlights), i a l'efecte de sota es comparen amb les d'un cop ja
    // reordenat — la diferència és l'animació de "puja a dalt".
    const rects = new Map<string, DOMRect>();
    rowElsRef.current.forEach((el, t) => rects.set(t, el.getBoundingClientRect()));
    prevRectsRef.current = rects;
    const next = { ...highlights };
    if (next[title]) delete next[title]; else next[title] = true;
    setHighlights(next);
    if (concertId) await setSetlistHighlightsAction(concertId, next);
  }
  const orderedSongs = useMemo(() => {
    return songs
      .map((s, i) => ({ s, i }))
      .sort((a, b) => {
        const ah = !!highlights[a.s.title], bh = !!highlights[b.s.title];
        if (ah !== bh) return ah ? -1 : 1;
        return a.i - b.i;
      });
  }, [songs, highlights]);
  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    if (prev.size === 0) return;
    rowElsRef.current.forEach((el, title) => {
      const before = prev.get(title);
      if (!before) return;
      const after = el.getBoundingClientRect();
      const delta = before.top - after.top;
      if (Math.abs(delta) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.32s cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "";
      });
    });
    prevRectsRef.current = new Map();
  }, [orderedSongs]);

  const [idx, setIdx] = useState(0);
  const [semitones, setSemitones] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [fontSize, setFontSize] = useState(22);
  const [playing, setPlaying] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [trackMix, setTrackMix] = useState<Record<string, TrackMix>>({});
  const [curTime, setCurTime] = useState(0);
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadDone, setLoadDone] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const metroTimerRef = useRef<number | null>(null);
  const beatRef = useRef(0);
  // Motor de reproducció multipista amb Web Audio: les pistes són gravacions
  // de la mateixa cançó, han de sonar SEMPRE exactament alhora — un
  // <audio> per pista no ho garanteix (cadascun bufa/arrenca pel seu
  // compte). Amb Web Audio totes comparteixen el mateix rellotge: es
  // decodeixen senceres abans de permetre reproduir, i s'arrenquen totes
  // amb el mateix .start(when) — així no hi ha manera que es desincronitzin.
  const buffersRef = useRef<Record<string, AudioBuffer>>({});
  const gainNodesRef = useRef<Record<string, GainNode>>({});
  const sourceNodesRef = useRef<Record<string, AudioBufferSourceNode | null>>({});
  const playStartCtxTimeRef = useRef(0);
  const playStartOffsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const masterGainRef = useRef<GainNode | null>(null);
  const [masterVolume, setMasterVolume] = useState(1);
  // Tempo (0,5×–1,5×) i to (±12 semitons), independents. Amb tempo=1 i
  // to=0 les pistes sonen pel camí ràpid de sempre (AudioBufferSourceNode,
  // sincronia mostra-a-mostra). Quan se'n toca algun, es passa a
  // soundtouchjs (PitchShifter per pista) que fa time-stretch i pitch-shift
  // per separat. Els refs els llegeix playFrom sense dependre de re-renders.
  const [playbackRate, setPlaybackRate] = useState(1);
  // To: semitons sencers (botons) + un ajust fi en centèssimes de semitò
  // (barra). El valor efectiu que rep soundtouchjs és pitchSemis + cents/100.
  const [pitchSemis, setPitchSemis] = useState(0);
  const [pitchCents, setPitchCents] = useState(0);
  const rateRef = useRef(1);
  const pitchRef = useRef(0);
  const pitchTotal = pitchSemis + pitchCents / 100;
  const shiftersRef = useRef<Record<string, PitchShifterInstance | null>>({});
  const engineRef = useRef<"buffer" | "shift">("buffer");
  const shiftPosRef = useRef(0);
  const [tracksOpen, setTracksOpen] = useState(false);

  const song = songs[idx] || null;
  const tracks = song?.tracks || [];
  const scores = song?.scores || [];
  const [scoreIdx, setScoreIdx] = useState(0);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreDark, setScoreDark] = useState(false);
  const curScore = scores[scoreIdx] || null;
  // Quan es canvia de cançó arrossegant al límit de la partitura (no pel
  // menú de cançons), es recorda l'instrument que s'estava veient perquè la
  // cançó següent obri directament la mateixa veu, sense passar pel menú.
  const pendingInstrumentRef = useRef<string | null>(null);

  // Troba la veu buscada dins les partitures d'una cançó: primer per nom
  // exacte (per no confondre "Clarinet 1" amb "Clarinet 2" quan una cançó
  // té les dues veus separades) i, si no hi és, per nom base sense número
  // (per si l'altra cançó només en té una instància, sense numerar).
  function findScoreMatch(sc: PerformScore[], wanted: string): number {
    const exact = sc.findIndex((x) => x.instrument === wanted);
    if (exact >= 0) return exact;
    return sc.findIndex((x) => scoreIconName(x.instrument) === scoreIconName(wanted));
  }

  // Tria quina partitura obrir per a una cançó donada: si es demana un
  // instrument concret i hi és, l'obre directament; si no, torna al menú
  // de tria de veu, preseleccionant "Totes les veus" si n'hi ha.
  function resolveScoreForSong(songIdx: number, wanted: string | null) {
    const sc = songs[songIdx]?.scores || [];
    if (wanted) {
      const matchIdx = findScoreMatch(sc, wanted);
      if (matchIdx >= 0) {
        setScoreIdx(matchIdx);
        setScoreOpen(true);
        return;
      }
    }
    const allIdx = sc.findIndex((x) => x.instrument === "Totes les veus");
    setScoreIdx(allIdx >= 0 ? allIdx : 0);
    setScoreOpen(false);
  }

  // En canviar de cançó, torna a mostrar el menú de tria de veu (mai obre
  // directament la partitura d'abans), tret que hi hagi un instrument
  // pendent de continuar (arrossegant al límit, o triat al menú inicial).
  useEffect(() => {
    const wanted = pendingInstrumentRef.current;
    pendingInstrumentRef.current = null;
    resolveScoreForSong(idx, wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Des del visor de partitura: si ja ets a la primera/última pàgina i
  // tornes a tirar cap a aquell costat, passa a la cançó anterior/següent
  // mantenint el mateix instrument (si hi és).
  function goSongFromScoreEdge(dir: -1 | 1) {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= songs.length) return;
    pendingInstrumentRef.current = curScore?.instrument || null;
    setIdx(nextIdx);
    setAutoScroll(false);
  }
  const duration = tracks.reduce((max, t) => Math.max(max, trackDurations[t.id] || 0), 0);

  function ctx(): AudioContext {
    const cur = audioCtxRef.current;
    if (cur && cur.state !== "closed") return cur;
    // Context nou: primer ús, o bé el d'abans s'ha tancat en
    // desmuntar/remuntar (p. ex. el doble muntatge de React en dev). El
    // guany mestre i els de pista penjaven d'aquell context i ja no
    // serveixen — es refan sols amb el context nou.
    const ac = new AudioContext();
    audioCtxRef.current = ac;
    masterGainRef.current = null;
    gainNodesRef.current = {};
    return ac;
  }

  // Guany mestre: totes les pistes hi passen abans de la sortida.
  function masterGain(): GainNode {
    if (!masterGainRef.current) {
      const ac = ctx();
      const g = ac.createGain();
      g.gain.value = masterVolume;
      g.connect(ac.destination);
      masterGainRef.current = g;
    }
    return masterGainRef.current;
  }

  useEffect(() => {
    if (masterGainRef.current) masterGainRef.current.gain.value = masterVolume;
  }, [masterVolume]);

  function dspActive() {
    return rateRef.current !== 1 || pitchRef.current !== 0;
  }

  // Guany d'una pista (crea'l si cal, connectat al master) amb el volum /
  // mute actuals ja aplicats.
  function gainFor(id: string): GainNode {
    const ac = ctx();
    const g = gainNodesRef.current[id] || (gainNodesRef.current[id] = ac.createGain());
    g.connect(masterGain());
    const anySolo = tracks.some((t) => trackMix[t.id]?.solo);
    const m = trackMix[id];
    if (m) g.gain.value = (m.muted || (anySolo && !m.solo)) ? 0 : m.volume;
    return g;
  }

  // Posició actual dins la cançó (segons d'origen), independentment del motor.
  function curPosition(): number {
    if (engineRef.current === "shift") return shiftPosRef.current;
    return Math.max(0, ctx().currentTime - playStartCtxTimeRef.current) + playStartOffsetRef.current;
  }

  function stopAllSources() {
    Object.values(sourceNodesRef.current).forEach((src) => { try { src?.stop(); } catch { /* ja aturada */ } });
    sourceNodesRef.current = {};
    Object.values(shiftersRef.current).forEach((sh) => { try { sh?.disconnect(); } catch { /* ja desconnectat */ } });
    shiftersRef.current = {};
  }

  // Arrenca (o reprèn) totes les pistes des del segon indicat. Amb tempo=1
  // i to=0: AudioBufferSourceNode, totes amb el mateix .start(when) —
  // sincronia exacta. Altrament: un PitchShifter (soundtouchjs) per pista,
  // amb tempo i to per separat; s'arrenquen totes de cop (petita variació
  // de sincronia possible, assumida).
  function playFrom(offsetSec: number) {
    const ac = ctx();
    stopAllSources();
    if (dspActive()) {
      engineRef.current = "shift";
      shiftPosRef.current = offsetSec;
      const dur = duration || Math.max(1, ...tracks.map((t) => buffersRef.current[t.id]?.duration || 0));
      tracks.forEach((t, i) => {
        const buf = buffersRef.current[t.id];
        if (!buf) return;
        const sh = new PitchShifter(ac, buf, 16384) as PitchShifterInstance;
        sh.tempo = rateRef.current;
        sh.pitchSemitones = pitchRef.current;
        sh.percentagePlayed = Math.min(0.999, offsetSec / dur);
        sh.connect(gainFor(t.id));
        shiftersRef.current[t.id] = sh;
        if (i === 0) sh.on("play", (d) => {
          shiftPosRef.current = d.timePlayed;
          if (d.percentagePlayed >= 100) { stopAllSources(); setPlaying(false); shiftPosRef.current = 0; setCurTime(0); }
        });
      });
      playStartOffsetRef.current = offsetSec;
      return;
    }
    engineRef.current = "buffer";
    const when = ac.currentTime + 0.08; // marge mínim perquè totes arrenquin juntes
    tracks.forEach((t) => {
      const buf = buffersRef.current[t.id];
      if (!buf) return;
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(gainFor(t.id));
      src.start(when, Math.min(offsetSec, buf.duration));
      sourceNodesRef.current[t.id] = src;
    });
    playStartCtxTimeRef.current = when;
    playStartOffsetRef.current = offsetSec;
  }

  function pausePlayback() {
    const elapsed = curPosition();
    stopAllSources();
    playStartOffsetRef.current = elapsed;
    shiftPosRef.current = elapsed;
    setCurTime(elapsed);
  }

  // Canvi de tempo / to: si es creua el llindar del motor (tempo=1 & to=0 ↔
  // qualsevol altre valor) es reinicia des de la posició actual; si no,
  // s'apliquen en viu als PitchShifters.
  useEffect(() => {
    const wasDsp = rateRef.current !== 1 || pitchRef.current !== 0;
    rateRef.current = playbackRate;
    pitchRef.current = pitchTotal;
    const nowDsp = dspActive();
    if (!playing) return;
    if (wasDsp !== nowDsp) {
      playFrom(curPosition());
      return;
    }
    if (nowDsp) {
      Object.values(shiftersRef.current).forEach((sh) => {
        if (sh) { sh.tempo = playbackRate; sh.pitchSemitones = pitchTotal; }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackRate, pitchTotal]);

  function togglePlay() {
    if (loadState !== "ready") return;
    if (playing) { pausePlayback(); setPlaying(false); return; }
    const ac = ctx();
    const start = () => { playFrom(playStartOffsetRef.current); setPlaying(true); };
    if (ac.state === "suspended") ac.resume().then(start);
    else start();
  }

  function seekAll(time: number) {
    playStartOffsetRef.current = time;
    shiftPosRef.current = time;
    setCurTime(time);
    if (playing) playFrom(time);
  }

  // En canviar de cançó: atura la reproducció anterior i descarrega +
  // decodeix totes les pistes de la nova abans de permetre prémer play.
  useEffect(() => {
    stopAllSources();
    setPlaying(false);
    setCurTime(0);
    playStartOffsetRef.current = 0;
    shiftPosRef.current = 0;
    engineRef.current = "buffer";
    rateRef.current = 1;
    pitchRef.current = 0;
    setPlaybackRate(1);
    setPitchSemis(0);
    setPitchCents(0);
    buffersRef.current = {};
    gainNodesRef.current = {};
    setTrackDurations({});
    setLoadDone(0);
    setTrackMix((prev) => {
      const next = { ...prev };
      let changed = false;
      tracks.forEach((t) => {
        if (!next[t.id]) { next[t.id] = { name: t.name, volume: 1, muted: false, solo: false }; changed = true; }
      });
      return changed ? next : prev;
    });

    if (tracks.length === 0) { setLoadState("idle"); return; }
    setLoadState("loading");
    let cancelled = false;
    const ac = ctx();
    Promise.all(tracks.map(async (t) => {
      const res = await fetch(`/api/file/${t.id}`);
      if (!res.ok) throw new Error("no s'ha pogut carregar " + t.name);
      const arr = await res.arrayBuffer();
      const buf = await ac.decodeAudioData(arr);
      if (cancelled) return;
      buffersRef.current[t.id] = buf;
      setTrackDurations((prev) => ({ ...prev, [t.id]: buf.duration }));
      setLoadDone((n) => n + 1);
    })).then(() => { if (!cancelled) setLoadState("ready"); })
      .catch(() => { if (!cancelled) setLoadState("error"); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Rellotge de la barra de progrés mentre sona (totes les pistes comparteixen
  // el mateix origen de temps, per això n'hi ha prou seguint-ne un de sol).
  useEffect(() => {
    if (!playing) { cancelAnimationFrame(rafRef.current); return; }
    const tick = () => {
      const elapsed = curPosition();
      // El final el detecta el propi PitchShifter (motor "shift"); aquí
      // només cal per al motor de buffers.
      if (engineRef.current === "buffer" && duration > 0 && elapsed >= duration) {
        stopAllSources();
        setPlaying(false);
        playStartOffsetRef.current = 0;
        setCurTime(0);
        return;
      }
      setCurTime(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Volum / mute de cada pista. El mute "manual" es guarda per pista i és
  // permanent; a sobre s'hi superposa el silenci que provoca tenir alguna
  // altra pista en solo — així, en treure el solo, només es desactiva
  // aquest silenci automàtic, mai els mutes que has marcat tu a mà.
  useEffect(() => {
    const anySolo = tracks.some((t) => trackMix[t.id]?.solo);
    tracks.forEach((t) => {
      const g = gainNodesRef.current[t.id];
      const m = trackMix[t.id];
      if (!g || !m) return;
      const effMuted = m.muted || (anySolo && !m.solo);
      g.gain.value = effMuted ? 0 : m.volume;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackMix]);

  function defaultMix(name: string): TrackMix {
    return { name, volume: 1, muted: false, solo: false };
  }

  function updateMix(id: string, patch: Partial<TrackMix>) {
    setTrackMix((prev) => ({ ...prev, [id]: { ...(prev[id] || defaultMix("")), ...patch } }));
  }

  // En sortir del mode escenari, atura del tot la reproducció. Es buida la
  // ref abans de tancar perquè un remuntatge (el doble muntatge de dev)
  // en creï un de nou en comptes de fer servir un context ja tancat (que
  // decodifica àudio però peta en crear la font i deixa el play sense so).
  useEffect(() => {
    return () => {
      stopAllSources();
      const ac = audioCtxRef.current;
      audioCtxRef.current = null;
      masterGainRef.current = null;
      gainNodesRef.current = {};
      ac?.close().catch(() => { /* ja tancat */ });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Metrònom (Web Audio) ----
  useEffect(() => {
    if (metroTimerRef.current) { window.clearInterval(metroTimerRef.current); metroTimerRef.current = null; }
    if (!metronomeOn || !song?.tempo) return;
    const ac = ctx();
    beatRef.current = 0;
    // Segueix el mateix tempo triat a la mescla per no anar a contratemps
    // amb les pistes.
    const interval = 60000 / (song.tempo * playbackRate);
    const tick = () => {
      const accent = beatRef.current % 4 === 0;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = accent ? 1400 : 900;
      gain.gain.setValueAtTime(accent ? 0.5 : 0.28, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.08);
      beatRef.current++;
    };
    tick();
    metroTimerRef.current = window.setInterval(tick, interval);
    return () => { if (metroTimerRef.current) window.clearInterval(metroTimerRef.current); };
  }, [metronomeOn, idx, song?.tempo, playbackRate]);

  // ---- To inicial ----
  function playPitch() {
    if (!song?.key) return;
    const root = song.key.match(/^[A-G][b#]?/)?.[0];
    const freq = root ? NOTE_FREQ[root] : null;
    if (!freq) return;
    const ac = ctx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.35, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 2);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 2);
  }

  // ---- Auto-scroll a ritme constant, ajustable amb els botons +/- ----
  useEffect(() => {
    cancelAnimationFrame(scrollRafRef.current);
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    let last = performance.now();
    // Acumulador en coma flotant propi: si es llegís el.scrollTop cada frame
    // (que el navegador arrodoneix a enter), els increments petits dels
    // ritmes lents es perdrien i mai s'arribaria a moure ni un píxel.
    let pos = el.scrollTop;
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const total = el.scrollHeight - el.clientHeight;
      if (total <= 0) return;
      pos += SCROLL_SPEEDS[speedIdx] * dt;
      el.scrollTop = pos;
      if (pos >= total - 1) { setAutoScroll(false); return; }
      scrollRafRef.current = requestAnimationFrame(step);
    };
    scrollRafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(scrollRafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, idx, speedIdx]);

  function go(delta: number) {
    if (scoreOpen && curScore) pendingInstrumentRef.current = curScore.instrument;
    setIdx((i) => Math.min(songs.length - 1, Math.max(0, i + delta)));
    setAutoScroll(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  // Fletxes del teclat / pedal bluetooth (emula fletxes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      if (e.key === " ") { e.preventDefault(); setAutoScroll((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs.length]);

  if (!songs.length) {
    return (
      <div className="perform">
        <div className="perform-empty">
          <p>Aquesta setlist no té cançons amb títol.</p>
          <BackLink href={backHref}>Torna</BackLink>
        </div>
      </div>
    );
  }

  if (showIntro) {
    return (
      <div className="perform perform-intro">
        <div className="perform-topbar">
          <BackLink href={backHref}>Surt</BackLink>
        </div>
        <div className="perform-intro-body">
          <h1 className="perform-intro-title">{name}</h1>
          <div className="t-dim" style={{ fontSize: 13 }}>{bandName}</div>
          {introInstruments.length > 0 && (
            <div className="perform-intro-section">
              <div className="perform-intro-label">El teu instrument</div>
              <div className="perform-score-chips">
                {introInstruments.map((instrument) => (
                  <button key={instrument} type="button"
                    className={"perform-score-chip" + (pickedInstrument === instrument ? " active" : "")}
                    onClick={() => setPickedInstrument((v) => (v === instrument ? null : instrument))}>
                    <img src={instrumentIconFor(scoreIconName(instrument))} alt="" />
                    {instrument}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="perform-intro-section">
            <div className="perform-intro-label">Cançons</div>
            <div className="perform-intro-songs">
              {orderedSongs.map(({ s, i }) => {
                const missing = !!pickedInstrument && findScoreMatch(s.scores, pickedInstrument) < 0;
                return (
                  <SongListRow
                    key={s.title} song={s} originalIndex={i} disabled={missing}
                    disabledTitle={missing ? `Aquesta cançó no té partitura de ${pickedInstrument}` : undefined}
                    highlighted={!!highlights[s.title]} canHighlight={canHighlight}
                    onToggleStar={toggleHighlight} rowRef={registerRow(s.title)}
                    onClick={() => {
                      // Si ja hi érem (la cançó per defecte, idx 0), canviar
                      // l'índex al mateix valor no torna a disparar l'efecte
                      // que aplica l'instrument triat — cal fer-ho ara mateix.
                      if (i === idx) resolveScoreForSong(i, pickedInstrument);
                      else pendingInstrumentRef.current = pickedInstrument;
                      setIdx(i);
                      setShowIntro(false);
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const prevBtn = (
    <button type="button" className="perform-nav-btn" title="Cançó anterior" aria-label="Cançó anterior" disabled={idx === 0} onClick={() => go(-1)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="2.5" height="16" rx="1"></rect><path d="M19 4.5v15a1 1 0 0 1-1.6.8L7 12.8a1 1 0 0 1 0-1.6L17.4 3.7A1 1 0 0 1 19 4.5z"></path></svg>
    </button>
  );
  const nextBtn = (
    <button type="button" className="perform-nav-btn" title="Cançó següent" aria-label="Cançó següent" disabled={idx === songs.length - 1} onClick={() => go(1)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="16.5" y="4" width="2.5" height="16" rx="1"></rect><path d="M5 4.5v15a1 1 0 0 0 1.6.8L17 12.8a1 1 0 0 0 0-1.6L6.6 3.7A1 1 0 0 0 5 4.5z"></path></svg>
    </button>
  );

  // Barra de reproducció (cerca + transport + volum general). Es fa servir
  // tant a sota de les lletres com dins del visor de partitura a pantalla
  // completa, perquè amb àudios penjats el reproductor hi sigui també.
  const audioBar = (
    <div className="perform-audiobar">
      {tracks.length > 0 && (
        <div className="perform-audio-seek">
          <span className="perform-audio-time">{fmtTime(curTime)}</span>
          <input type="range" min={0} max={duration || 0} step={0.1} value={Math.min(curTime, duration || 0)}
            disabled={loadState !== "ready"} onChange={(e) => seekAll(parseFloat(e.target.value))} />
          <span className="perform-audio-time">{fmtTime(duration)}</span>
        </div>
      )}
      <div className="perform-audio-controls">
        <div className="perform-audio-info">
          {loadState === "loading" && `Carregant pistes… ${loadDone}/${tracks.length}`}
          {loadState === "error" && "No s'han pogut carregar les pistes"}
        </div>
        <div className="perform-transport">
          {prevBtn}
          {tracks.length > 0 && (
            <button type="button" className="perform-audio-play" disabled={loadState !== "ready"}
              title={loadState !== "ready" ? "Carregant…" : playing ? "Pausa" : "Reprodueix"} onClick={togglePlay}>
              {loadState === "loading" ? <span className="perform-audio-spinner" /> : playing ? "⏸" : "▶"}
            </button>
          )}
          {nextBtn}
        </div>
        <div className="perform-audio-master">
          {tracks.length > 0 && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              <input type="range" min={0} max={1} step={0.01} value={masterVolume}
                title={`Volum general ${Math.round(masterVolume * 100)}%`}
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))} />
              <span className="perform-audio-master-val">{Math.round(masterVolume * 100)}%</span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Fletxeta lateral per obrir/tancar el mesclador — flota per sobre de tot
  // (també del visor de partitura).
  const mixerTab = tracks.length > 0 && (
    <button type="button" className={"perform-mixer-tab" + (mixerOpen ? " open" : "")} title="Mescla" onClick={() => setMixerOpen((v) => !v)}>
      ‹
    </button>
  );

  return (
    <div className="perform">
      <div className="perform-topbar">
        <BackLink href={backHref}>Surt</BackLink>
        <button type="button" className="perform-title" onClick={() => setListOpen((v) => !v)}>
          {name} · {idx + 1}/{songs.length} ▾
        </button>
        <div className="perform-controls">
          {!!song?.lyrics.trim() && (
            <div className={"perform-ctl perform-transpose perform-scroll-ctl" + (autoScroll ? " active" : "")}>
              <button type="button" title={speedIdx === 0 ? "Atura l'autoscroll" : "Redueix el ritme"}
                onClick={() => { if (speedIdx === 0) setAutoScroll(false); else setSpeedIdx((i) => Math.max(0, i - 1)); }}>−</button>
              <button type="button" title={`Autoscroll (espai) — ritme ${speedIdx + 1}`} onClick={() => setAutoScroll((v) => !v)}>⇣ Scroll</button>
              <button type="button" title={!autoScroll ? "Comença l'autoscroll" : "Augmenta el ritme"}
                disabled={autoScroll && speedIdx === SCROLL_SPEEDS.length - 1}
                onClick={() => { if (!autoScroll) setAutoScroll(true); else setSpeedIdx((i) => Math.min(SCROLL_SPEEDS.length - 1, i + 1)); }}>+</button>
            </div>
          )}
          {song && song.tempo > 0 && (
            <button type="button" className={"perform-ctl" + (metronomeOn ? " active" : "")} title={`Metrònom ${Math.round(song.tempo * playbackRate)} BPM`} onClick={() => setMetronomeOn((v) => !v)}>
              ♩ {Math.round(song.tempo * playbackRate)}
            </button>
          )}
          {song?.key && <button type="button" className="perform-ctl" title="Toca el to inicial" onClick={playPitch}>♪ {song.key}</button>}
          {!!song?.lyrics.trim() && (
            <>
              <div className="perform-ctl perform-transpose">
                <button type="button" onClick={() => setSemitones((s) => s - 1)}>−</button>
                <span>{semitones > 0 ? "+" + semitones : semitones}</span>
                <button type="button" onClick={() => setSemitones((s) => s + 1)}>+</button>
              </div>
              <div className="perform-ctl perform-transpose">
                <button type="button" onClick={() => setFontSize((f) => Math.max(14, f - 2))}>A−</button>
                <button type="button" onClick={() => setFontSize((f) => Math.min(40, f + 2))}>A+</button>
              </div>
            </>
          )}
        </div>
      </div>


      <div className="perform-body" ref={scrollRef} style={{ fontSize }}>
        <div className="perform-song-head">
          <h1>{song!.title}</h1>
          <div className="perform-song-meta">
            {bandName}{song!.key ? ` · ${song!.key}` : ""}{song!.duration ? ` · ${song!.duration}` : ""}
            {song!.notes ? ` — ${song!.notes}` : ""}
          </div>
        </div>
        {scores.length > 0 && !scoreOpen && (
          <div className="perform-score-menu">
            <div className="perform-score-menu-title">Partitura — tria la veu</div>
            <div className="perform-score-menu-list">
              {scores.map((sc, i) => (
                <button key={sc.id} type="button" className="perform-score-chip"
                  onClick={() => { setScoreIdx(i); setScoreOpen(true); }}>
                  <img src={instrumentIconFor(scoreIconName(sc.instrument))} alt="" />
                  {sc.instrument}{scores.filter((x) => x.instrument === sc.instrument).length > 1 ? ` — ${sc.name}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {song!.lyrics.trim() && <LyricsView lyrics={song!.lyrics} semitones={semitones} />}
        <div style={{ height: "45vh" }}></div>
      </div>

      <div className="perform-bottom">{audioBar}</div>

      {mixerTab}

      {listOpen && createPortal(
        <div className="perform-sidebar-overlay" onClick={() => setListOpen(false)}>
          <div className="perform-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="perform-sidebar-head">
              <div className="perform-sidebar-title">{name}</div>
              <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={() => setListOpen(false)}>✕</button>
            </div>
            <div className="perform-sidebar-list">
              {orderedSongs.map(({ s, i }) => (
                <SongListRow
                  key={s.title} song={s} originalIndex={i} active={i === idx}
                  highlighted={!!highlights[s.title]} canHighlight={canHighlight}
                  onToggleStar={toggleHighlight} rowRef={registerRow(s.title)}
                  onClick={() => { if (scoreOpen && curScore) pendingInstrumentRef.current = curScore.instrument; setIdx(i); setListOpen(false); setAutoScroll(false); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}
                />
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {mixerOpen && (
        <div className="perform-mixer-overlay" onClick={() => setMixerOpen(false)}>
          <div className="perform-mixer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="perform-mixer-head">
              <div className="perform-mixer-title">Mescla — {song?.title}</div>
              <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={() => setMixerOpen(false)}>✕</button>
            </div>
            <div className="perform-mixer-master perform-mixer-tempo">
              <div className="perform-mixer-tempo-top">
                <span className="perform-mixer-master-label">
                  <svg className="perform-mixer-label-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 3h6l3.4 15.3A2 2 0 0 1 16.4 21H7.6a2 2 0 0 1-2-2.7L9 3z" />
                    <line x1="7" y1="15" x2="17" y2="15" />
                    <line x1="12" y1="18" x2="16" y2="7" />
                  </svg>
                  Tempo
                </span>
                <button type="button" className="perform-mixer-btn" title={song && song.tempo > 0 ? "−1 BPM" : "−1%"}
                  disabled={playbackRate <= 0.5}
                  onClick={() => setPlaybackRate((r) => {
                    const step = song && song.tempo > 0 ? 1 / song.tempo : 0.01;
                    return Math.max(0.5, Math.round((r - step) * 1000) / 1000);
                  })}>−</button>
                <button type="button" className="perform-mixer-btn" title={song && song.tempo > 0 ? "+1 BPM" : "+1%"}
                  disabled={playbackRate >= 1.5}
                  onClick={() => setPlaybackRate((r) => {
                    const step = song && song.tempo > 0 ? 1 / song.tempo : 0.01;
                    return Math.min(1.5, Math.round((r + step) * 1000) / 1000);
                  })}>+</button>
                <span className="perform-mixer-tempo-val">
                  {song && song.tempo > 0 ? `${Math.round(song.tempo * playbackRate)} BPM` : `${Math.round(playbackRate * 100)}%`}
                </span>
                <button type="button" className={"perform-mixer-tempo-reset" + (playbackRate === 1 ? " is-hidden" : "")}
                  disabled={playbackRate === 1} title="Tempo original" onClick={() => setPlaybackRate(1)}>↺</button>
              </div>
              <input type="range" min={0.5} max={1.5} step={0.01} value={playbackRate}
                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} />
            </div>
            <div className="perform-mixer-master perform-mixer-tempo">
              <div className="perform-mixer-tempo-top">
                <span className="perform-mixer-master-label">
                  <svg className="perform-mixer-label-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 3v8a4 4 0 0 0 8 0V3" />
                    <line x1="12" y1="15" x2="12" y2="21" />
                    <line x1="9" y1="21" x2="15" y2="21" />
                  </svg>
                  Pitch
                </span>
                <button type="button" className="perform-mixer-btn" title="−1 semitò"
                  disabled={pitchSemis <= -12}
                  onClick={() => setPitchSemis((s) => Math.max(-12, s - 1))}>−</button>
                <button type="button" className="perform-mixer-btn" title="+1 semitò"
                  disabled={pitchSemis >= 12}
                  onClick={() => setPitchSemis((s) => Math.min(12, s + 1))}>+</button>
                <span className="perform-mixer-tempo-val">
                  {pitchSemis > 0 ? `+${pitchSemis}` : pitchSemis}
                  {pitchCents !== 0 ? ` ${pitchCents > 0 ? "+" : "−"}${Math.abs(pitchCents)}¢` : " st"}
                </span>
                <button type="button" className={"perform-mixer-tempo-reset" + (pitchSemis === 0 && pitchCents === 0 ? " is-hidden" : "")}
                  disabled={pitchSemis === 0 && pitchCents === 0} title="To original" onClick={() => { setPitchSemis(0); setPitchCents(0); }}>↺</button>
              </div>
              <input type="range" min={-50} max={50} step={1} value={pitchCents}
                title="Ajust fi (centèssimes de semitò)"
                onChange={(e) => setPitchCents(parseInt(e.target.value, 10))} />
            </div>
            <button type="button" className={"perform-mixer-tracks-toggle" + (tracksOpen ? " open" : "")}
              onClick={() => setTracksOpen((v) => !v)}>
              <span className="perform-mixer-tracks-toggle-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                Canals{tracks.length ? ` (${tracks.length})` : ""}
              </span>
              <span className="perform-mixer-caret">▾</span>
            </button>
            {tracksOpen && (
            <div className="perform-mixer-tracks">
              {tracks.map((t) => {
                const m = trackMix[t.id] || { name: t.name, volume: 1, muted: false, solo: false };
                const anySolo = tracks.some((tt) => trackMix[tt.id]?.solo);
                const effMuted = m.muted || (anySolo && !m.solo);
                return (
                  <div key={t.id} className="perform-mixer-track">
                    <input className="perform-mixer-name" value={m.name} onChange={(e) => updateMix(t.id, { name: e.target.value })} />
                    <div className="perform-mixer-row">
                      <button type="button" className={"perform-mixer-btn" + (effMuted ? " active" : "")} title="Mute"
                        onClick={() => updateMix(t.id, { muted: !m.muted })}>
                        <span className={effMuted ? "perform-mixer-strike" : undefined}>M</span>
                      </button>
                      <button type="button" className={"perform-mixer-btn perform-mixer-solo" + (m.solo ? " active" : "")} title="Solo"
                        onClick={() => updateMix(t.id, { solo: !m.solo })}>S</button>
                      <input type="range" min={0} max={1} step={0.01} value={m.volume} onChange={(e) => updateMix(t.id, { volume: parseFloat(e.target.value) })} />
                      <span className="perform-mixer-vol">{Math.round(m.volume * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      )}

      {scoreOpen && curScore && createPortal(
        <div className={"perform-score-fs" + (scoreDark ? " dark" : " light")}>
          <div className="perform-score-fs-bar">
            <button type="button" className={"row-rs-btn" + (listOpen ? " active" : "")} title="Cançons de la setlist" aria-label="Cançons de la setlist" onClick={() => setListOpen((v) => !v)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="14" y2="18"></line></svg>
            </button>
            <button type="button" className="row-rs-btn" title="Torna a triar la veu" aria-label="Torna a triar la veu" onClick={() => setScoreOpen(false)}>✕</button>
            <div className="perform-score-fs-spacer" />
            {scores.length > 1 && (
              <div className="perform-score-chips perform-score-chips-compact">
                {scores.map((sc, i) => (
                  <button key={sc.id} type="button" className={"perform-score-chip" + (i === scoreIdx ? " active" : "")}
                    onClick={() => setScoreIdx(i)}>
                    <img src={instrumentIconFor(scoreIconName(sc.instrument))} alt="" />
                    {sc.instrument}{scores.filter((x) => x.instrument === sc.instrument).length > 1 ? ` — ${sc.name}` : ""}
                  </button>
                ))}
              </div>
            )}
            <div className="perform-score-fs-spacer" />
            <button type="button" className={"perform-theme-switch" + (scoreDark ? " dark" : "")} title={scoreDark ? "Mode fosc — clica per mode clar" : "Mode clar — clica per mode fosc"} aria-label="Canvia entre mode clar i fosc" onClick={() => setScoreDark((v) => !v)}>
              <span className="perform-theme-switch-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              </span>
              <span className="perform-theme-switch-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              </span>
              <span className="perform-theme-switch-knob" />
            </button>
          </div>
          <div className="perform-score-fs-body">
            {curScore.mime.startsWith("image") ? (
              <img className={"perform-score-fs-frame" + (scoreDark ? " inverted" : "")} src={`/api/file/${curScore.id}`} alt={curScore.name} />
            ) : curScore.mime === "application/pdf" ? (
              <PdfViewer key={curScore.id} url={`/api/file/${curScore.id}`} dark={scoreDark} onEdge={goSongFromScoreEdge} />
            ) : (
              <a className="perform-score-fallback" href={`/api/file/${curScore.id}`} target="_blank" rel="noopener noreferrer">Obre &ldquo;{curScore.name}&rdquo;</a>
            )}
          </div>
          {tracks.length > 0 && (
            <div className="perform-score-fs-audio">{audioBar}</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
