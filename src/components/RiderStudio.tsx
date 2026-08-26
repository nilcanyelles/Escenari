"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RiderContent, StageItem } from "@/lib/material-types";
import { STAGE_LIBRARY, StageItemSvg, stageKindDef } from "@/lib/stage-svg";
import { saveRiderAction } from "@/app/(app)/grup/material-actions";
import SpecularButton from "@/components/SpecularButton";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return "sp" + Date.now() + "_" + idCounter;
}

type Mode = "edit" | "counter";

const SECTIONS = [
  { id: "escenari", label: "Escenari" },
  { id: "entrades", label: "Entrades" },
  { id: "sortides", label: "Sortides" },
  { id: "monitors", label: "Monitors" },
  { id: "backline", label: "Backline" },
  { id: "contactes", label: "Contactes" },
  { id: "hospitalitat", label: "Hospitalitat" },
  { id: "llums", label: "Llums" },
  { id: "audio", label: "Àudio" },
  { id: "pagines", label: "Pàgines" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

// ---------------- Plànol d'escenari ----------------

function StageCanvas({ stage, onChange }: { stage: RiderContent["stage"]; onChange: (s: RiderContent["stage"]) => void }) {
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
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState<RiderContent>(initialContent);
  const [currentId, setCurrentId] = useState<string | null>(riderId);
  const [section, setSection] = useState<SectionId>("escenari");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [counterNote, setCounterNote] = useState(counterNoteInit || "");
  const [counterSending, setCounterSending] = useState(false);
  const [counterSent, setCounterSent] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const isFirst = useRef(true);

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

  function set<K extends keyof RiderContent>(k: K, v: RiderContent[K]) {
    setContent((p) => ({ ...p, [k]: v }));
  }

  async function copyPublicLink() {
    if (!publicToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/m/${publicToken}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const sectionBody: Record<SectionId, React.ReactNode> = {
    escenari: <StageCanvas stage={content.stage} onChange={(s) => set("stage", s)} />,

    entrades: (
      <div className="studio-section">
        <div className="rider-block-head">
          <div className="rider-block-title">Llista d&apos;entrades (input list)</div>
          <button type="button" className="btn-outline" onClick={() => set("inputs", content.inputs.concat([{ ch: String(content.inputs.length + 1), source: "", mic: "", stand: "", notes: "" }]))}>+ Canal</button>
        </div>
        <div className="rider-table">
          <div className="rider-table-head rider-input-cols"><div>Ch</div><div>Font</div><div>Micro / DI</div><div>Peu</div><div>Notes</div><div></div></div>
          {content.inputs.map((row, i) => (
            <div key={i} className="rider-table-row rider-input-cols">
              <input className="field-input compact-field" value={row.ch} onChange={(e) => set("inputs", content.inputs.map((x, j) => j === i ? { ...x, ch: e.target.value } : x))} />
              <input className="field-input compact-field" placeholder="Bombo, veu principal…" value={row.source} onChange={(e) => set("inputs", content.inputs.map((x, j) => j === i ? { ...x, source: e.target.value } : x))} />
              <input className="field-input compact-field" placeholder="SM58, DI…" value={row.mic} onChange={(e) => set("inputs", content.inputs.map((x, j) => j === i ? { ...x, mic: e.target.value } : x))} />
              <input className="field-input compact-field" placeholder="Alt, curt…" value={row.stand} onChange={(e) => set("inputs", content.inputs.map((x, j) => j === i ? { ...x, stand: e.target.value } : x))} />
              <input className="field-input compact-field" value={row.notes} onChange={(e) => set("inputs", content.inputs.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
              <button type="button" className="row-delete-btn" onClick={() => set("inputs", content.inputs.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      </div>
    ),

    sortides: (
      <div className="studio-section">
        <div className="rider-block-head">
          <div className="rider-block-title">Llista de sortides (output list)</div>
          <button type="button" className="btn-outline" onClick={() => set("outputs", content.outputs.concat([{ ch: String(content.outputs.length + 1), dest: "", kind: "Monitor", notes: "" }]))}>+ Sortida</button>
        </div>
        {content.outputs.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Cap sortida definida — afegeix les mescles de monitor, gravació o streaming que necessiteu.</div>
        ) : (
          <div className="rider-table">
            <div className="rider-table-head rider-output-cols"><div>Out</div><div>Destí</div><div>Tipus</div><div>Notes</div><div></div></div>
            {content.outputs.map((row, i) => (
              <div key={i} className="rider-table-row rider-output-cols">
                <input className="field-input compact-field" value={row.ch} onChange={(e) => set("outputs", content.outputs.map((x, j) => j === i ? { ...x, ch: e.target.value } : x))} />
                <input className="field-input compact-field" placeholder="Cunya veu, side esquerre…" value={row.dest} onChange={(e) => set("outputs", content.outputs.map((x, j) => j === i ? { ...x, dest: e.target.value } : x))} />
                <select className="field-input compact-field" value={row.kind} onChange={(e) => set("outputs", content.outputs.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))}>
                  <option>Monitor</option><option>In-ear</option><option>Gravació</option><option>Streaming</option><option>Altres</option>
                </select>
                <input className="field-input compact-field" value={row.notes} onChange={(e) => set("outputs", content.outputs.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
                <button type="button" className="row-delete-btn" onClick={() => set("outputs", content.outputs.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}
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
          <div className="rider-table">
            <div className="rider-table-head rider-monitor-cols"><div>Per a qui</div><div>Tipus</div><div>Mescla / notes</div><div></div></div>
            {content.monitors.map((row, i) => (
              <div key={i} className="rider-table-row rider-monitor-cols">
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
          <div className="rider-table">
            <div className="rider-table-head rider-backline-cols"><div>Element</div><div>Qui el porta</div><div>Notes</div><div></div></div>
            {content.backline.map((row, i) => (
              <div key={i} className="rider-table-row rider-backline-cols">
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
        <div className="rider-block-head">
          <div className="rider-block-title">Contactes del grup</div>
          <button type="button" className="btn-outline" onClick={() => set("contacts", content.contacts.concat([{ role: "", name: "", phone: "", email: "" }]))}>+ Contacte</button>
        </div>
        <div className="rider-table">
          <div className="rider-table-head rider-contact-cols"><div>Càrrec</div><div>Nom</div><div>Telèfon</div><div>Correu</div><div></div></div>
          {content.contacts.map((row, i) => (
            <div key={i} className="rider-table-row rider-contact-cols">
              <input className="field-input compact-field" placeholder="Mànager, tècnic de so…" value={row.role} onChange={(e) => set("contacts", content.contacts.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} />
              <input className="field-input compact-field" value={row.name} onChange={(e) => set("contacts", content.contacts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <input className="field-input compact-field" value={row.phone} onChange={(e) => set("contacts", content.contacts.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
              <input className="field-input compact-field" value={row.email} onChange={(e) => set("contacts", content.contacts.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
              <button type="button" className="row-delete-btn" onClick={() => set("contacts", content.contacts.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        <div className="rider-block" style={{ marginTop: 18 }}>
          <div className="rider-block-title">Presentació del grup</div>
          <textarea className="field-input rider-textarea" rows={2} placeholder="Qui sou i què necessita saber l'organització en dues frases…"
            value={content.intro} onChange={(e) => set("intro", e.target.value)} />
        </div>
      </div>
    ),

    hospitalitat: (
      <div className="studio-section">
        <div className="rider-block-title">Hospitalitat</div>
        <textarea className="field-input rider-textarea" rows={8} placeholder="Camerino, aigües, dietes, pàrquing, allotjament…"
          value={content.hospitality} onChange={(e) => set("hospitality", e.target.value)} />
      </div>
    ),

    llums: (
      <div className="studio-section">
        <div className="rider-block-title">Llums</div>
        <textarea className="field-input rider-textarea" rows={8} placeholder="Necessitats d'il·luminació, ambients per cançó, res estroboscòpic…"
          value={content.lighting} onChange={(e) => set("lighting", e.target.value)} />
      </div>
    ),

    audio: (
      <div className="studio-section">
        <div className="rider-block-title">Àudio (PA / control)</div>
        <textarea className="field-input rider-textarea" rows={6} placeholder="Potència de PA, taula mínima, efectes, tècnic propi o de la sala…"
          value={content.audio} onChange={(e) => set("audio", e.target.value)} />
        <div className="rider-block-title" style={{ marginTop: 16 }}>Corrent elèctric</div>
        <textarea className="field-input rider-textarea" rows={3} placeholder="Preses necessàries a l'escenari…"
          value={content.power} onChange={(e) => set("power", e.target.value)} />
        <div className="rider-block-title" style={{ marginTop: 16 }}>Altres notes</div>
        <textarea className="field-input rider-textarea" rows={3} value={content.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
    ),

    pagines: (
      <div className="studio-section">
        <div className="rider-block-head">
          <div className="rider-block-title">Pàgines extra (com annexos del PDF)</div>
          <button type="button" className="btn-outline" onClick={() => set("pages", content.pages.concat([{ title: "Nova pàgina", body: "" }]))}>+ Afegeix pàgina</button>
        </div>
        {content.pages.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>
            Afegeix pàgines lliures al final del rider: contracte tècnic, mapa d&apos;accés, plànol del recinte…
            Cada pàgina surt com una secció pròpia al PDF.
          </div>
        ) : (
          content.pages.map((pg, i) => (
            <div key={i} className="studio-page">
              <div className="studio-page-head">
                <input className="field-input compact-field" style={{ flex: 1, fontWeight: 600 }} value={pg.title}
                  onChange={(e) => set("pages", content.pages.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                <button type="button" className="row-delete-btn" onClick={() => set("pages", content.pages.filter((_, j) => j !== i))}>✕</button>
              </div>
              <textarea className="field-input rider-textarea" rows={6} placeholder="Contingut de la pàgina…" value={pg.body}
                onChange={(e) => set("pages", content.pages.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
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
                <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.16} baseColor="#6a5fd0" lineColor="#cfc5ff" onClick={copyPublicLink}>
                  {copied ? "Copiat ✓" : "Comparteix"}
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
