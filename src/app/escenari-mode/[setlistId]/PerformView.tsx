"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { songDurationSecs } from "@/lib/material-types";
import { LyricsView } from "@/components/SongsPanel";

export type PerformSong = {
  title: string;
  duration: string;
  key: string;
  notes: string;
  tempo: number;
  lyrics: string;
};

const NOTE_FREQ: Record<string, number> = {
  C: 261.63, "C#": 277.18, Db: 277.18, D: 293.66, "D#": 311.13, Eb: 311.13,
  E: 329.63, F: 349.23, "F#": 369.99, Gb: 369.99, G: 392.0, "G#": 415.3,
  Ab: 415.3, A: 440.0, "A#": 466.16, Bb: 466.16, B: 493.88,
};

export default function PerformView({ name, bandName, songs, backHref }: { name: string; bandName: string; songs: PerformSong[]; backHref: string }) {
  const [idx, setIdx] = useState(0);
  const [semitones, setSemitones] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [fontSize, setFontSize] = useState(22);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const metroTimerRef = useRef<number | null>(null);
  const beatRef = useRef(0);

  const song = songs[idx] || null;

  function ctx(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }

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

  // ---- Auto-scroll segons la durada de la cançó ----
  useEffect(() => {
    cancelAnimationFrame(scrollRafRef.current);
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    const total = el.scrollHeight - el.clientHeight;
    if (total <= 0) return;
    const secs = songDurationSecs(song?.duration || "") || 180;
    const start = performance.now();
    const from = el.scrollTop;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / (secs * 1000));
      el.scrollTop = from + (total - from) * t;
      if (t < 1 && autoScroll) scrollRafRef.current = requestAnimationFrame(step);
    };
    scrollRafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(scrollRafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, idx]);

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

  return (
    <div className="perform">
      <div className="perform-topbar">
        <Link href={backHref} className="cd-back">← Surt</Link>
        <button type="button" className="perform-title" onClick={() => setListOpen((v) => !v)}>
          {name} · {idx + 1}/{songs.length} ▾
        </button>
        <div className="perform-controls">
          <button type="button" className={"perform-ctl" + (autoScroll ? " active" : "")} title="Auto-scroll (espai)" onClick={() => setAutoScroll((v) => !v)}>⇣ Auto</button>
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

      <div className="perform-nav">
        <button type="button" disabled={idx === 0} onClick={() => go(-1)}>‹ Anterior</button>
        <button type="button" disabled={idx === songs.length - 1} onClick={() => go(1)}>Següent ›</button>
      </div>
    </div>
  );
}
