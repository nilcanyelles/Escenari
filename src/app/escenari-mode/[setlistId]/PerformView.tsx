"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LyricsView } from "@/components/SongsPanel";

export type PerformTrack = { id: string; name: string };

export type PerformSong = {
  title: string;
  duration: string;
  key: string;
  notes: string;
  tempo: number;
  lyrics: string;
  tracks: PerformTrack[];
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

export default function PerformView({ name, bandName, songs, backHref }: { name: string; bandName: string; songs: PerformSong[]; backHref: string }) {
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

  const song = songs[idx] || null;
  const tracks = song?.tracks || [];
  const duration = tracks.reduce((max, t) => Math.max(max, trackDurations[t.id] || 0), 0);

  function ctx(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
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

  function stopAllSources() {
    Object.values(sourceNodesRef.current).forEach((src) => { try { src?.stop(); } catch { /* ja aturada */ } });
    sourceNodesRef.current = {};
  }

  // Arrenca (o reprèn) totes les pistes exactament al mateix instant, des
  // del segon indicat. Sempre síncrona: quan torna, playStartCtxTimeRef ja
  // està assignat — si no ho fos, l'efecte que engega el rellotge visual
  // (disparat pel setPlaying(true) que ve just després) podria arrencar
  // abans i llegir un valor vell, fent creure que la cançó ja s'ha acabat.
  function playFrom(offsetSec: number) {
    const ac = ctx();
    stopAllSources();
    const when = ac.currentTime + 0.08; // marge mínim perquè totes arrenquin juntes
    const anySolo = tracks.some((t) => trackMix[t.id]?.solo);
    tracks.forEach((t) => {
      const buf = buffersRef.current[t.id];
      if (!buf) return;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gain = gainNodesRef.current[t.id] || (gainNodesRef.current[t.id] = ac.createGain());
      const m = trackMix[t.id];
      if (m) gain.gain.value = (m.muted || (anySolo && !m.solo)) ? 0 : m.volume;
      src.connect(gain).connect(masterGain());
      src.start(when, Math.min(offsetSec, buf.duration));
      sourceNodesRef.current[t.id] = src;
    });
    playStartCtxTimeRef.current = when;
    playStartOffsetRef.current = offsetSec;
  }

  function pausePlayback() {
    const ac = ctx();
    const elapsed = Math.max(0, ac.currentTime - playStartCtxTimeRef.current) + playStartOffsetRef.current;
    stopAllSources();
    playStartOffsetRef.current = elapsed;
    setCurTime(elapsed);
  }

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
    const ac = ctx();
    const tick = () => {
      const elapsed = Math.max(0, ac.currentTime - playStartCtxTimeRef.current) + playStartOffsetRef.current;
      if (duration > 0 && elapsed >= duration) {
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

  // En sortir del mode escenari, atura del tot la reproducció.
  useEffect(() => {
    return () => {
      stopAllSources();
      audioCtxRef.current?.close().catch(() => { /* ja tancat */ });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Metrònom (Web Audio) ----
  useEffect(() => {
    if (metroTimerRef.current) { window.clearInterval(metroTimerRef.current); metroTimerRef.current = null; }
    if (!metronomeOn || !song?.tempo) return;
    const ac = ctx();
    beatRef.current = 0;
    const interval = 60000 / song.tempo;
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
  }, [metronomeOn, idx, song?.tempo]);

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
          <Link href={backHref} className="cd-back">← Torna</Link>
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

  return (
    <div className="perform">
      <div className="perform-topbar">
        <Link href={backHref} className="cd-back">← Surt</Link>
        <button type="button" className="perform-title" onClick={() => setListOpen((v) => !v)}>
          {name} · {idx + 1}/{songs.length} ▾
        </button>
        <div className="perform-controls">
          <div className={"perform-ctl perform-transpose perform-scroll-ctl" + (autoScroll ? " active" : "")}>
            <button type="button" title={speedIdx === 0 ? "Atura l'autoscroll" : "Redueix el ritme"}
              onClick={() => { if (speedIdx === 0) setAutoScroll(false); else setSpeedIdx((i) => Math.max(0, i - 1)); }}>−</button>
            <button type="button" title={`Autoscroll (espai) — ritme ${speedIdx + 1}`} onClick={() => setAutoScroll((v) => !v)}>⇣ Scroll</button>
            <button type="button" title={!autoScroll ? "Comença l'autoscroll" : "Augmenta el ritme"}
              disabled={autoScroll && speedIdx === SCROLL_SPEEDS.length - 1}
              onClick={() => { if (!autoScroll) setAutoScroll(true); else setSpeedIdx((i) => Math.min(SCROLL_SPEEDS.length - 1, i + 1)); }}>+</button>
          </div>
          {song && song.tempo > 0 && (
            <button type="button" className={"perform-ctl" + (metronomeOn ? " active" : "")} title={`Metrònom ${song.tempo} BPM`} onClick={() => setMetronomeOn((v) => !v)}>
              ♩ {song.tempo}
            </button>
          )}
          {song?.key && <button type="button" className="perform-ctl" title="Toca el to inicial" onClick={playPitch}>♪ {song.key}</button>}
          <div className="perform-ctl perform-transpose">
            <button type="button" onClick={() => setSemitones((s) => s - 1)}>−</button>
            <span>{semitones > 0 ? "+" + semitones : semitones}</span>
            <button type="button" onClick={() => setSemitones((s) => s + 1)}>+</button>
          </div>
          <div className="perform-ctl perform-transpose">
            <button type="button" onClick={() => setFontSize((f) => Math.max(14, f - 2))}>A−</button>
            <button type="button" onClick={() => setFontSize((f) => Math.min(40, f + 2))}>A+</button>
          </div>
        </div>
      </div>

      {listOpen && (
        <div className="perform-list">
          {songs.map((s, i) => (
            <button key={i} type="button" className={"perform-list-item" + (i === idx ? " active" : "")}
              onClick={() => { setIdx(i); setListOpen(false); setAutoScroll(false); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}>
              <span className="perform-list-num">{i + 1}</span> {s.title}
              <span className="t-dim" style={{ marginLeft: "auto", fontSize: 12 }}>{s.duration}</span>
            </button>
          ))}
        </div>
      )}

      <div className="perform-body" ref={scrollRef} style={{ fontSize }}>
        <div className="perform-song-head">
          <h1>{song!.title}</h1>
          <div className="perform-song-meta">
            {bandName}{song!.key ? ` · ${song!.key}` : ""}{song!.duration ? ` · ${song!.duration}` : ""}
            {song!.notes ? ` — ${song!.notes}` : ""}
          </div>
        </div>
        {song!.lyrics.trim() ? (
          <LyricsView lyrics={song!.lyrics} semitones={semitones} />
        ) : (
          <div className="perform-no-lyrics">Sense lletra al repertori — afegeix-la a la pestanya Cançons del grup.</div>
        )}
        <div style={{ height: "45vh" }}></div>
      </div>

      <div className="perform-bottom">
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
            <div />
          </div>
        </div>
      </div>

      {tracks.length > 0 && (
        <button type="button" className={"perform-mixer-tab" + (mixerOpen ? " open" : "")} title="Mescla" onClick={() => setMixerOpen((v) => !v)}>
          ‹
        </button>
      )}

      {mixerOpen && (
        <div className="perform-mixer-overlay" onClick={() => setMixerOpen(false)}>
          <div className="perform-mixer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="perform-mixer-head">
              <div className="perform-mixer-title">Mescla — {song?.title}</div>
              <button className="cf-head-close" title="Tancar" aria-label="Tancar" onClick={() => setMixerOpen(false)}>✕</button>
            </div>
            <div className="perform-mixer-master">
              <span className="perform-mixer-master-label">Master</span>
              <input type="range" min={0} max={1} step={0.01} value={masterVolume} onChange={(e) => setMasterVolume(parseFloat(e.target.value))} />
              <span className="perform-mixer-vol">{Math.round(masterVolume * 100)}%</span>
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
