"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RiderContent, StageItem } from "@/lib/material-types";
import type { Person } from "@/lib/types";
import { STAGE_LIBRARY, StageItemSvg, stageKindDef, isInstrumentKind } from "@/lib/stage-svg";
import { saveRiderAction } from "@/app/(app)/grup/material-actions";
import SpecularButton from "@/components/SpecularButton";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return "sp" + Date.now() + "_" + idCounter;
}

// Sota el nom, a la bombolla del picker de contactes: l'instrument si en
// té (músic), si no el càrrec (crew).
function personSubtitle(p: Person): string {
  if (p.instruments && p.instruments.length) return p.instruments.join(", ");
  return p.role || "";
}

// Text gris (placeholder) de les caselles de la pestanya "Detalls": sempre
// "Necessitats <títol de l'element>", amb l'elisió catalana ("d'") davant
// de so vocàlic (també amb h muda: "hospitalitat", "hora"…).
function needsPlaceholder(title: string): string {
  const t = (title || "").trim();
  if (!t) return "Necessitats…";
  const lower = t.charAt(0).toLowerCase() + t.slice(1);
  const elides = /^[aeiouàèéêíïòóôúü]/i.test(lower) || /^h[aeiouàèéêíïòóôúü]/i.test(lower);
  return "Necessitats " + (elides ? "d'" : "de ") + lower;
}

// Reordenació arrossegant, reutilitzada per totes les llistes del rider
// (entrades, monitors, backline, contactes, camps, annexos…). Mentre
// s'arrossega, la resta de files es desplacen (FLIP) per revelar on
// quedarà l'ordre abans de deixar-ho anar — no cal esperar al "drop".
function useDragReorder<T>(items: T[], onChange: (next: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Al deixar anar, l'ordre real i el "reset" de la transformació de
  // previsualització arriben al mateix cop de render: sense això, la
  // transició CSS interpretaria aquell salt com un moviment nou i el
  // reproduiria — ja s'havia vist mentre s'arrossegava.
  const [justDropped, setJustDropped] = useState(false);
  const rowRefs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    if (!justDropped) return;
    const raf = requestAnimationFrame(() => setJustDropped(false));
    return () => cancelAnimationFrame(raf);
  }, [justDropped]);

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function registerRow(i: number) {
    return (el: HTMLElement | null) => { if (el) rowRefs.current.set(i, el); else rowRefs.current.delete(i); };
  }

  // Distància (alt + espaiat) que ocupa una fila concreta — el "forat" que
  // deixa en moure's, per calcular quant s'han de desplaçar les altres.
  function stepOf(i: number): number {
    const el = rowRefs.current.get(i);
    if (!el) return 0;
    const cs = window.getComputedStyle(el);
    const parent = el.parentElement;
    const gap = parent ? parseFloat(window.getComputedStyle(parent).rowGap || "0") || 0 : 0;
    return el.offsetHeight + gap + (parseFloat(cs.marginBottom) || 0);
  }
  // Suma de les distàncies de les files entre from (inclòs) i to (exclòs) —
  // el trajecte real que ha de recórrer la fila arrossegada per encaixar a
  // l'espai lliure, tenint en compte que cada fila pot tenir una alçada
  // diferent (per exemple els camps de Detalls, amb textareas de mides
  // diverses).
  function spanBetween(from: number, to: number): number {
    let total = 0;
    for (let k = from; k < to; k++) total += stepOf(k);
    return total;
  }

  function rowClass(i: number, base: string) {
    return base + (dragIndex === i ? " setlist-row-dragging" : "");
  }
  function rowStyle(i: number): React.CSSProperties {
    const style: React.CSSProperties = { transition: justDropped ? "none" : "transform .16s ease" };
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) return style;
    if (i === dragIndex) {
      style.transform = `translateY(${dragIndex < overIndex ? spanBetween(dragIndex + 1, overIndex + 1) : -spanBetween(overIndex, dragIndex)}px)`;
      return style;
    }
    const step = stepOf(dragIndex);
    if (dragIndex < overIndex && i > dragIndex && i <= overIndex) style.transform = `translateY(-${step}px)`;
    else if (dragIndex > overIndex && i < dragIndex && i >= overIndex) style.transform = `translateY(${step}px)`;
    return style;
  }
  function finishDrop() {
    if (dragIndex !== null && overIndex !== null) move(dragIndex, overIndex);
    setJustDropped(true);
    setOverIndex(null);
    setDragIndex(null);
  }
  function rowHandlers(i: number) {
    return {
      // Ignora els events que arriben sobre la pròpia fila arrossegada — un
      // cop es desplaça cap al forat, pot acabar visualment sota el cursor
      // i "atrapar" el seu propi drop. L'"overIndex" (mai igual a
      // dragIndex) és sempre la destinació real, independentment de sobre
      // quin element del DOM caigui el "drop". Es para la propagació per no
      // duplicar l'acció amb el "fallback" del contenidor (containerHandlers).
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (dragIndex !== null && i !== dragIndex && overIndex !== i) setOverIndex(i);
      },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); finishDrop(); },
    };
  }
  // Fallback pel contenidor de la llista: si el cursor cau per sobre de la
  // primera fila o per sota de l'última (marge, capçalera, espai buit —
  // zones sense fila pròpia), fixa la posició al principi o al final en
  // comptes de no fer res (que feia tornar l'element al lloc original).
  function containerHandlers() {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        if (dragIndex === null || items.length === 0) return;
        const first = rowRefs.current.get(0);
        if (first && e.clientY < first.getBoundingClientRect().top) { if (overIndex !== 0) setOverIndex(0); return; }
        const lastIdx = items.length - 1;
        const last = rowRefs.current.get(lastIdx);
        if (last && e.clientY > last.getBoundingClientRect().bottom) { if (overIndex !== lastIdx) setOverIndex(lastIdx); }
      },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); finishDrop(); },
    };
  }
  function handleProps(i: number) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => { setDragIndex(i); setOverIndex(i); e.dataTransfer.effectAllowed = "move"; },
      onDragEnd: () => { setDragIndex(null); setOverIndex(null); },
    };
  }

  return { rowClass, rowStyle, rowHandlers, handleProps, registerRow, containerHandlers };
}

type Mode = "edit" | "counter";

const SECTIONS = [
  { id: "escenari", label: "Escenari" },
  { id: "entrades", label: "Entrades" },
  { id: "monitors", label: "Monitors" },
  { id: "backline", label: "Backline" },
  { id: "contactes", label: "Contactes" },
  { id: "detalls", label: "Detalls" },
  { id: "pagines", label: "Annexos" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

// ---------------- Plànol d'escenari ----------------

function StageCanvas({ stage, onChange, onItemAdded }: {
  stage: RiderContent["stage"];
  onChange: (s: RiderContent["stage"]) => void;
  // Avisa qui l'envolta que s'acaba d'afegir un instrument, perquè pugui
  // generar-hi el canal (o canals, per a la bateria) corresponent a la
  // llista d'entrades.
  onItemAdded?: (kind: string, label: string) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const [activeCat, setActiveCat] = useState(STAGE_LIBRARY[0].id);
  const [selected, setSelected] = useState<string | null>(null);

  const cat = STAGE_LIBRARY.find((c) => c.id === activeCat)!;
  const aspect = Math.max(0.8, Math.min(4, stage.widthM / stage.depthM || 1.33));

  function addItem(kind: string, x = 50, y = 45) {
    const def = stageKindDef(kind);
    const item: StageItem = { id: nextId(), kind, label: def.label, x, y, scale: def.defaultScale || 1 };
    onChange({ ...stage, items: stage.items.concat([item]) });
    onItemAdded?.(kind, def.label);
    setSelected(item.id);
  }

  function dropCoords(e: React.DragEvent | React.PointerEvent): { x: number; y: number } {
    const area = areaRef.current!;
    const rect = area.getBoundingClientRect();
    return {
      x: Math.min(97, Math.max(3, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(92, Math.max(5, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    const area = areaRef.current;
    if (!area) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const item = stage.items.find((it) => it.id === id);
    if (!item) return;
    const rect = area.getBoundingClientRect();
    dragRef.current = {
      id,
      offsetX: e.clientX - (rect.left + (item.x / 100) * rect.width),
      offsetY: e.clientY - (rect.top + (item.y / 100) * rect.height),
      moved: false,
    };
    setSelected(id);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const area = areaRef.current;
    if (!drag || !area) return;
    drag.moved = true;
    const rect = area.getBoundingClientRect();
    const x = Math.min(97, Math.max(3, ((e.clientX - drag.offsetX - rect.left) / rect.width) * 100));
    const y = Math.min(92, Math.max(5, ((e.clientY - drag.offsetY - rect.top) / rect.height) * 100));
    onChange({ ...stage, items: stage.items.map((it) => (it.id === drag.id ? { ...it, x, y } : it)) });
  }

  const selectedItem = selected ? stage.items.find((it) => it.id === selected) || null : null;

  function updateSelected(patch: Partial<StageItem>) {
    if (!selected) return;
    onChange({ ...stage, items: stage.items.map((it) => (it.id === selected ? { ...it, ...patch } : it)) });
  }

  return (
    <div className="studio-stage">
      {/* Paleta lateral */}
      <div className="studio-palette">
        <div className="studio-cats">
          {STAGE_LIBRARY.map((c) => (
            <button
              key={c.id}
              type="button"
              className={"studio-cat" + (activeCat === c.id ? " active" : "")}
              style={{ ["--cat-color" as string]: c.color }}
              onClick={() => setActiveCat(c.id)}
            >{c.label}</button>
          ))}
        </div>
        <div className="studio-items">
          {cat.items.map((it) => (
            <button
              key={it.kind}
              type="button"
              className="studio-item"
              title={`${it.label} — arrossega o fes clic per afegir`}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/stage-kind", it.kind); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => addItem(it.kind)}
            >
              <StageItemSvg kind={it.kind} size={46} />
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="studio-canvas-col">
        <div className="studio-stage-controls">
          <label>Amplada
            <input type="number" min={2} max={30} step={0.5} className="field-input compact-field studio-dim" value={stage.widthM}
              onChange={(e) => onChange({ ...stage, widthM: parseFloat(e.target.value) || 8 })} /> m
          </label>
          <label>Fons
            <input type="number" min={2} max={20} step={0.5} className="field-input compact-field studio-dim" value={stage.depthM}
              onChange={(e) => onChange({ ...stage, depthM: parseFloat(e.target.value) || 6 })} /> m
          </label>
          {selectedItem && (
            <div className="studio-sel-tools">
              <span className="t-dim" style={{ fontSize: 12 }}>{selectedItem.label}</span>
              <button type="button" onClick={() => updateSelected({ scale: Math.max(0.5, selectedItem.scale - 0.15) })}>−</button>
              <button type="button" onClick={() => updateSelected({ scale: Math.min(2.6, selectedItem.scale + 0.15) })}>+</button>
              <input
                className="field-input compact-field" style={{ width: 130 }}
                value={selectedItem.label}
                onChange={(e) => updateSelected({ label: e.target.value })}
              />
              <button type="button" className="studio-del" onClick={() => { onChange({ ...stage, items: stage.items.filter((it) => it.id !== selected) }); setSelected(null); }}>Elimina</button>
            </div>
          )}
        </div>

        <div
          ref={areaRef}
          className="studio-area"
          style={{ aspectRatio: String(aspect) }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDrop={(e) => {
            e.preventDefault();
            const kind = e.dataTransfer.getData("text/stage-kind");
            if (kind) { const { x, y } = dropCoords(e); addItem(kind, x, y); }
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => { dragRef.current = null; }}
          onClick={(e) => { if (e.target === areaRef.current) setSelected(null); }}
        >
          <div className="studio-dims-label">{stage.widthM} m × {stage.depthM} m</div>
          <div className="sp-front">PÚBLIC</div>
          {stage.items.map((it) => (
            <div
              key={it.id}
              className={"studio-stage-item" + (selected === it.id ? " selected" : "")}
              style={{ left: it.x + "%", top: it.y + "%" }}
              onPointerDown={(e) => onPointerDown(e, it.id)}
            >
              <div className="studio-stage-glyph" style={{ width: 52 * it.scale, height: 52 * it.scale }}>
                <svg width="100%" height="100%" viewBox="0 0 64 64">{stageKindDef(it.kind).svg}</svg>
              </div>
              <span className="sp-item-label">{it.label}</span>
            </div>
          ))}
          {stage.items.length === 0 && (
            <div className="sp-empty">Arrossega elements de la paleta fins a l&apos;escenari (o fes-hi clic)</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Editor principal ----------------

export default function RiderStudio({
  bandId, bandName, riderId, initialName, initialContent, mode, backHref, publicToken, counterNoteInit, onSubmitCounter,
  bandMembers = [], bandCrew = [],
}: {
  bandId: string;
  bandName: string;
  riderId: string | null;
  initialName: string;
  initialContent: RiderContent;
  mode: Mode;
  backHref: string;
  publicToken?: string;
  counterNoteInit?: string;
  onSubmitCounter?: (content: RiderContent, note: string) => Promise<void>;
  // Per triar contactes en comptes d'escriure'ls a mà: músics i crew del grup.
  bandMembers?: Person[];
  bandCrew?: Person[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState<RiderContent>(initialContent);
  const [currentId, setCurrentId] = useState<string | null>(riderId);
  const [section, setSection] = useState<SectionId>("escenari");
  const [saving, setSaving] = useState(false);
  const [counterNote, setCounterNote] = useState(counterNoteInit || "");
  const [counterSending, setCounterSending] = useState(false);
  const [counterSent, setCounterSent] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const isFirst = useRef(true);
  const [uploadingAnnex, setUploadingAnnex] = useState(false);
  const annexFileInput = useRef<HTMLInputElement>(null);
  // Contacte en preparació (encara no desat a la llista): null = tancat.
  const [contactDraft, setContactDraft] = useState<RiderContent["contacts"][number] | null>(null);
  const emptyContactDraft = { role: "", name: "", phone: "", email: "" };
  const detailsDrag = useDragReorder(content.detailsOrder, (next) => set("detailsOrder", next));
  const inputDrag = useDragReorder(content.inputs, (next) => setInputs(next));
  const monitorDrag = useDragReorder(content.monitors, (next) => set("monitors", next));
  const backlineDrag = useDragReorder(content.backline, (next) => set("backline", next));
  const contactDrag = useDragReorder(content.contacts, (next) => set("contacts", next));
  const pageDrag = useDragReorder(content.pages, (next) => set("pages", next));

  // Desat automàtic (només en mode edició normal).
  useEffect(() => {
    if (mode !== "edit") return;
    if (isFirst.current) { isFirst.current = false; return; }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      const { id } = await saveRiderAction({ id: currentId, bandId, name, content });
      setCurrentId(id);
      setSaving(false);
    }, 800);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, content]);

  // Autoscroll de la pàgina mentre s'arrossega un element de qualsevol
  // llista del rider a prop del marge superior o inferior de la finestra —
  // comú a totes les llistes, no cal repetir-ho per hook.
  useEffect(() => {
    const EDGE = 90;
    const MAX_SPEED = 14;
    let rafId: number | null = null;
    let pointerY: number | null = null;

    function tick() {
      if (pointerY !== null) {
        const h = window.innerHeight;
        let dy = 0;
        if (pointerY < EDGE) dy = -MAX_SPEED * (1 - pointerY / EDGE);
        else if (pointerY > h - EDGE) dy = MAX_SPEED * (1 - (h - pointerY) / EDGE);
        if (dy) window.scrollBy(0, dy);
      }
      rafId = requestAnimationFrame(tick);
    }
    function onDragOver(e: DragEvent) {
      pointerY = e.clientY;
      if (rafId === null) rafId = requestAnimationFrame(tick);
    }
    function stop() {
      pointerY = null;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", stop);
    window.addEventListener("dragend", stop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", stop);
      window.removeEventListener("dragend", stop);
      stop();
    };
  }, []);

  function set<K extends keyof RiderContent>(k: K, v: RiderContent[K]) {
    setContent((p) => ({ ...p, [k]: v }));
  }

  // El número de canal de la llista d'entrades sempre és la posició (1, 2,
  // 3…), mai un valor solt que es pugui desincronitzar en eliminar files.
  function setInputs(next: RiderContent["inputs"]) {
    set("inputs", next.map((x, i) => ({ ...x, ch: String(i + 1) })));
  }


  // Puja un document (contracte, plànol del recinte…) a la pestanya
  // Annexos: es guarda al magatzem privat i s'incorpora tal qual — les
  // seves pròpies pàgines — al PDF final del rider.
  async function uploadAnnexFile(file: File) {
    setUploadingAnnex(true);
    try {
      const fd = new FormData();
      fd.append("bandId", bandId);
      fd.append("file", file);
      const res = await fetch("/api/rider-annex/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) { alert(data.error || "No s'ha pogut pujar el document"); return; }
      set("pages", content.pages.concat([{
        id: nextId(),
        title: (file.name || "Document").replace(/\.[a-zA-Z0-9]+$/, ""),
        body: "",
        fileUrl: data.url, fileMime: data.mime, fileName: data.name,
      }]));
    } finally {
      setUploadingAnnex(false);
    }
  }

  // En afegir un instrument a l'escenari, genera de seguida el(s) seu(s)
  // canal(s) a la llista d'entrades — la bateria es desglossa en pistes
  // individuals, la resta d'instruments fan un sol canal amb el seu nom.
  // L'equipament d'àudio (micros, monitors...), les persones i l'estructura
  // no en generen cap.
  function channelsFor(kind: string, label: string): RiderContent["inputs"] {
    if (kind === "drumkit") {
      return ["Bombo", "Caixa", "Tom 1", "Tom 2", "Tom 3", "OHL", "OHR"]
        .map((name) => ({ ch: "", source: name, mic: "", stand: "", notes: "" }));
    }
    if (!isInstrumentKind(kind)) return [];
    return [{ ch: "", source: label, mic: "", stand: "", notes: "" }];
  }


  const sectionBody: Record<SectionId, React.ReactNode> = {
    escenari: <StageCanvas stage={content.stage} onChange={(s) => set("stage", s)}
      onItemAdded={(kind, label) => setInputs(content.inputs.concat(channelsFor(kind, label)))} />,

    entrades: (
      <div className="studio-section">
        <div className="rider-block-head">
          <div className="rider-block-title">Llista d&apos;entrades (input list)</div>
          <button type="button" className="btn-outline" onClick={() => setInputs(content.inputs.concat([{ ch: "", source: "", mic: "", stand: "", notes: "" }]))}>+ Canal</button>
        </div>
        <div className="rider-table" {...inputDrag.containerHandlers()}>
          <div className="rider-table-head rider-input-cols"><div>Ch</div><div>Font</div><div>Micro / DI</div><div>Peu</div><div>Notes</div><div></div></div>
          {content.inputs.map((row, i) => (
            <div
              key={i}
              ref={inputDrag.registerRow(i)}
              style={inputDrag.rowStyle(i)}
              className={inputDrag.rowClass(i, "rider-table-row rider-input-cols")}
              {...inputDrag.rowHandlers(i)}
            >
              <div className="setlist-order">
                <span className="setlist-drag-handle" title="Arrossega per canviar l'ordre" {...inputDrag.handleProps(i)}>⠿</span>
                <span className="setlist-num">{i + 1}</span>
              </div>
              <input className="field-input compact-field" placeholder="Bombo, veu principal…" value={row.source} onChange={(e) => set("inputs", content.inputs.map((x, j) => j === i ? { ...x, source: e.target.value } : x))} />
              <input className="field-input compact-field" placeholder="SM58, DI…" value={row.mic} onChange={(e) => set("inputs", content.inputs.map((x, j) => j === i ? { ...x, mic: e.target.value } : x))} />
              <input className="field-input compact-field" placeholder="Alt, curt…" value={row.stand} onChange={(e) => set("inputs", content.inputs.map((x, j) => j === i ? { ...x, stand: e.target.value } : x))} />
              <input className="field-input compact-field" value={row.notes} onChange={(e) => set("inputs", content.inputs.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
              <button type="button" className="row-delete-btn" onClick={() => setInputs(content.inputs.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      </div>
    ),

    monitors: (
      <div className="studio-section">
        <div className="rider-block-head">
          <div className="rider-block-title">Monitoratge</div>
          <button type="button" className="btn-outline" onClick={() => set("monitors", content.monitors.concat([{ who: "", kind: "Cunya", notes: "" }]))}>+ Monitor</button>
        </div>
        {content.monitors.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Defineix qui necessita monitor i quina mescla hi vol.</div>
        ) : (
          <div className="rider-table" {...monitorDrag.containerHandlers()}>
            <div className="rider-table-head rider-monitor-cols"><div></div><div>Per a qui</div><div>Tipus</div><div>Mescla / notes</div><div></div></div>
            {content.monitors.map((row, i) => (
              <div key={i} ref={monitorDrag.registerRow(i)} style={monitorDrag.rowStyle(i)}
                className={monitorDrag.rowClass(i, "rider-table-row rider-monitor-cols")} {...monitorDrag.rowHandlers(i)}>
                <div className="setlist-order">
                  <span className="setlist-drag-handle" title="Arrossega per canviar l'ordre" {...monitorDrag.handleProps(i)}>⠿</span>
                  <span className="setlist-num">{i + 1}</span>
                </div>
                <input className="field-input compact-field" placeholder="Veu, bateria, tots…" value={row.who} onChange={(e) => set("monitors", content.monitors.map((x, j) => j === i ? { ...x, who: e.target.value } : x))} />
                <select className="field-input compact-field" value={row.kind} onChange={(e) => set("monitors", content.monitors.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))}>
                  <option>Cunya</option><option>In-ear</option><option>Side-fill</option><option>Drum-fill</option>
                </select>
                <input className="field-input compact-field" placeholder="Més veu, poc bombo…" value={row.notes} onChange={(e) => set("monitors", content.monitors.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
                <button type="button" className="row-delete-btn" onClick={() => set("monitors", content.monitors.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    backline: (
      <div className="studio-section">
        <div className="rider-block-head">
          <div className="rider-block-title">Backline</div>
          <button type="button" className="btn-outline" onClick={() => set("backline", content.backline.concat([{ item: "", providedBy: "organitzacio", notes: "" }]))}>+ Element</button>
        </div>
        {content.backline.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Què ha de posar l&apos;organització i què porteu vosaltres.</div>
        ) : (
          <div className="rider-table" {...backlineDrag.containerHandlers()}>
            <div className="rider-table-head rider-backline-cols"><div></div><div>Element</div><div>Qui el porta</div><div>Notes</div><div></div></div>
            {content.backline.map((row, i) => (
              <div key={i} ref={backlineDrag.registerRow(i)} style={backlineDrag.rowStyle(i)}
                className={backlineDrag.rowClass(i, "rider-table-row rider-backline-cols")} {...backlineDrag.rowHandlers(i)}>
                <div className="setlist-order">
                  <span className="setlist-drag-handle" title="Arrossega per canviar l'ordre" {...backlineDrag.handleProps(i)}>⠿</span>
                  <span className="setlist-num">{i + 1}</span>
                </div>
                <input className="field-input compact-field" placeholder="Bateria completa, ampli de baix…" value={row.item} onChange={(e) => set("backline", content.backline.map((x, j) => j === i ? { ...x, item: e.target.value } : x))} />
                <select className="field-input compact-field" value={row.providedBy} onChange={(e) => set("backline", content.backline.map((x, j) => j === i ? { ...x, providedBy: e.target.value as "grup" | "organitzacio" } : x))}>
                  <option value="organitzacio">Organització</option>
                  <option value="grup">El grup</option>
                </select>
                <input className="field-input compact-field" value={row.notes} onChange={(e) => set("backline", content.backline.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
                <button type="button" className="row-delete-btn" onClick={() => set("backline", content.backline.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    contactes: (
      <div className="studio-section">
        <div className="rider-block-title">Contactes del rider</div>

        {content.contacts.length > 0 && (
          <div className="rider-table" style={{ marginTop: 10 }} {...contactDrag.containerHandlers()}>
            {content.contacts.map((row, i) => (
              <div key={i} ref={contactDrag.registerRow(i)} style={contactDrag.rowStyle(i)}
                className={contactDrag.rowClass(i, "rider-table-row rider-contact-cols")} {...contactDrag.rowHandlers(i)}>
                <span className="setlist-drag-handle" title="Arrossega per canviar l'ordre" {...contactDrag.handleProps(i)}>⠿</span>
                <input className="field-input compact-field" placeholder="Càrrec" value={row.role} onChange={(e) => set("contacts", content.contacts.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} />
                <input className="field-input compact-field" placeholder="Nom" value={row.name} onChange={(e) => set("contacts", content.contacts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <input className="field-input compact-field" placeholder="Telèfon" value={row.phone} onChange={(e) => set("contacts", content.contacts.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
                <input className="field-input compact-field" placeholder="Correu" value={row.email} onChange={(e) => set("contacts", content.contacts.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                <button type="button" className="row-delete-btn" onClick={() => set("contacts", content.contacts.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}

        {contactDraft && (
          <div className="instr-panel" style={{ marginTop: content.contacts.length > 0 ? 12 : 10 }}>
            <div className="rider-table-row rider-contact-draft-cols" style={{ marginTop: 0 }}>
              <input className="field-input compact-field" placeholder="Càrrec" value={contactDraft.role} onChange={(e) => setContactDraft({ ...contactDraft, role: e.target.value })} />
              <input className="field-input compact-field" placeholder="Nom" value={contactDraft.name} onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })} />
              <input className="field-input compact-field" placeholder="Telèfon" value={contactDraft.phone} onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })} />
              <input className="field-input compact-field" placeholder="Correu" value={contactDraft.email} onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })} />
              <button type="button" className="row-rs-btn" title="Desa el contacte" disabled={!contactDraft.name.trim()}
                onClick={() => { set("contacts", content.contacts.concat([contactDraft])); setContactDraft(null); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
              <button type="button" className="row-delete-btn" title="Cancel·la" onClick={() => setContactDraft(null)}>✕</button>
            </div>

            {bandMembers.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="instr-cat-title">Músics</div>
                <div className="access-box-list">
                  {bandMembers.map((p) => {
                    const sub = personSubtitle(p);
                    const active = contactDraft.name === p.name;
                    return (
                      <button key={p.name} type="button" className={"access-chip access-chip-2l" + (active ? " active" : "")}
                        onClick={() => setContactDraft({ role: sub, name: p.name, phone: p.phone || "", email: p.email || "" })}>
                        <span>{p.name}</span>
                        {sub && <span className="access-chip-sub">{sub}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {bandCrew.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="instr-cat-title">Crew</div>
                <div className="access-box-list">
                  {bandCrew.map((p) => {
                    const sub = personSubtitle(p);
                    const active = contactDraft.name === p.name;
                    return (
                      <button key={p.name} type="button" className={"access-chip access-chip-2l" + (active ? " active" : "")}
                        onClick={() => setContactDraft({ role: sub, name: p.name, phone: p.phone || "", email: p.email || "" })}>
                        <span>{p.name}</span>
                        {sub && <span className="access-chip-sub">{sub}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {bandMembers.length === 0 && bandCrew.length === 0 && (
              <div className="t-dim" style={{ fontSize: 12, marginTop: 10 }}>Encara no hi ha ningú al grup per triar — pots omplir les caselles a mà.</div>
            )}
          </div>
        )}

        {!contactDraft && (
          <button type="button" className="btn-outline" style={{ marginTop: 12 }} onClick={() => setContactDraft(emptyContactDraft)}>+ Afegeix contacte nou</button>
        )}
      </div>
    ),

    detalls: (
      <div className="studio-section" {...detailsDrag.containerHandlers()}>
        {content.detailsOrder.map((key, i) => {
          const isCf = key.startsWith("cf:");
          const cf = isCf ? content.customFields.find((f) => "cf:" + f.id === key) : undefined;
          if (isCf && !cf) return null;
          const fixed = (
            {
              audio: { title: "Àudio", rows: 6 },
              power: { title: "Corrent elèctric", rows: 3 },
              lighting: { title: "Llums", rows: 6 },
              hospitality: { title: "Hospitalitat", rows: 6 },
            } as Record<string, { title: string; rows: number }>
          )[key];
          return (
            <div key={key} ref={detailsDrag.registerRow(i)} style={detailsDrag.rowStyle(i)}
              className={detailsDrag.rowClass(i, "studio-page")} {...detailsDrag.rowHandlers(i)}>
              <div className="studio-page-head">
                <span className="setlist-drag-handle" title="Arrossega per canviar l'ordre" {...detailsDrag.handleProps(i)}>⠿</span>
                {cf ? (
                  <>
                    <input className="field-input compact-field" style={{ flex: 1, fontWeight: 600 }} value={cf.title}
                      onChange={(e) => set("customFields", content.customFields.map((x) => x.id === cf.id ? { ...x, title: e.target.value } : x))} />
                    <button type="button" className="row-delete-btn" onClick={() => {
                      set("customFields", content.customFields.filter((x) => x.id !== cf.id));
                      set("detailsOrder", content.detailsOrder.filter((k) => k !== key));
                    }}>✕</button>
                  </>
                ) : (
                  <div className="rider-block-title">{fixed.title}</div>
                )}
              </div>
              {cf ? (
                <textarea className="field-input rider-textarea" rows={3} placeholder={needsPlaceholder(cf.title)} value={cf.body}
                  onChange={(e) => set("customFields", content.customFields.map((x) => x.id === cf.id ? { ...x, body: e.target.value } : x))} />
              ) : (
                <textarea className="field-input rider-textarea" rows={fixed.rows} placeholder={needsPlaceholder(fixed.title)}
                  value={content[key as "audio" | "power" | "lighting" | "hospitality"]}
                  onChange={(e) => set(key as "audio" | "power" | "lighting" | "hospitality", e.target.value)} />
              )}
            </div>
          );
        })}
        <button type="button" className="btn-outline" style={{ marginTop: 6 }}
          onClick={() => {
            const id = nextId();
            set("customFields", content.customFields.concat([{ id, title: "Nou camp", body: "" }]));
            set("detailsOrder", content.detailsOrder.concat(["cf:" + id]));
          }}>+ Afegeix camp</button>
      </div>
    ),

    pagines: (
      <div className="studio-section" {...pageDrag.containerHandlers()}>
        <div className="rider-block-head">
          <div className="rider-block-title">Annexos (pàgines extra del PDF)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={annexFileInput} type="file" accept="application/pdf" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadAnnexFile(f); }} />
            <button type="button" className="btn-outline" disabled={uploadingAnnex} onClick={() => annexFileInput.current?.click()}>
              {uploadingAnnex ? "Pujant…" : "+ Puja un document"}
            </button>
            <button type="button" className="btn-outline" onClick={() => set("pages", content.pages.concat([{ id: nextId(), title: "Nova pàgina", body: "" }]))}>+ Afegeix pàgina</button>
          </div>
        </div>
        {content.pages.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>
            Afegeix pàgines lliures al final del rider: contracte tècnic, mapa d&apos;accés, plànol del recinte…
            Cada pàgina surt com una secció pròpia al PDF. També pots pujar un document (PDF) ja fet — les seves
            pàgines s&apos;incorporen tal qual, sense retocar.
          </div>
        ) : (
          content.pages.map((pg, i) => (
            <div key={pg.id ?? i} ref={pageDrag.registerRow(i)} style={pageDrag.rowStyle(i)}
              className={pageDrag.rowClass(i, "studio-page")} {...pageDrag.rowHandlers(i)}>
              <div className="studio-page-head">
                <span className="setlist-drag-handle" title="Arrossega per canviar l'ordre" {...pageDrag.handleProps(i)}>⠿</span>
                <input className="field-input compact-field" style={{ flex: 1, fontWeight: 600 }} value={pg.title}
                  onChange={(e) => set("pages", content.pages.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                {pg.fileUrl && (
                  <a href={pg.fileUrl} target="_blank" rel="noreferrer" className="annex-file-chip" title="Obre el document">
                    📄 {pg.fileName || "document"}
                  </a>
                )}
                <button type="button" className="row-delete-btn" onClick={() => set("pages", content.pages.filter((_, j) => j !== i))}>✕</button>
              </div>
              {!pg.fileUrl && (
                <textarea className="field-input rider-textarea" rows={6} placeholder="Contingut de la pàgina…" value={pg.body}
                  onChange={(e) => set("pages", content.pages.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
              )}
            </div>
          ))
        )}
      </div>
    ),
  };

  return (
    <div className="studio">
      <div className="studio-topbar">
        <Link href={backHref} className="cd-back">←{mode === "counter" ? " Torna al rider" : " Surt"}</Link>
        <div className="studio-band-name">{bandName}</div>
        <input className="rider-name-input studio-name" value={name} onChange={(e) => setName(e.target.value)} disabled={mode === "counter"} placeholder="Nom del rider" />
        <div className="studio-topbar-right">
          {mode === "edit" ? (
            <>
              <span className="t-dim" style={{ fontSize: 12 }}>{saving ? "Desant…" : "Desat ✓"}</span>
              {publicToken && (
                <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.16} baseColor="#6a5fd0" lineColor="#cfc5ff"
                  onClick={() => window.open(`/api/rider-pdf/${publicToken}`, "_blank")}>
                  Previsualitza
                </SpecularButton>
              )}
              <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.35} baseColor="#8b7bff" lineColor="#ffffff" onClick={() => router.push(backHref)}>
                Fet
              </SpecularButton>
            </>
          ) : counterSent ? (
            <span className="cd-link-status activa">Contraproposta enviada ✓</span>
          ) : (
            <>
              <input
                className="field-input compact-field" style={{ width: 220 }}
                placeholder="Nota per al grup (opcional)"
                value={counterNote}
                onChange={(e) => setCounterNote(e.target.value)}
              />
              <SpecularButton
                size="md" radius={12} tint="#e0913f" tintOpacity={0.3} baseColor="#c07a2e" lineColor="#ffe2bd"
                disabled={counterSending}
                onClick={async () => {
                  if (!onSubmitCounter) return;
                  setCounterSending(true);
                  await onSubmitCounter(content, counterNote);
                  setCounterSent(true);
                  setCounterSending(false);
                }}
              >
                {counterSending ? "Enviant…" : "Envia la contraproposta"}
              </SpecularButton>
            </>
          )}
        </div>
      </div>

      <div className="studio-tabs">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" className={"studio-tab" + (section === s.id ? " active" : "")} onClick={() => setSection(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="studio-body">{sectionBody[section]}</div>
    </div>
  );
}
