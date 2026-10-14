"use client";

import { useMemo, useRef, useState } from "react";
import type { Band, Formation, FormationSlot } from "@/lib/types";
import { instrumentsFor } from "@/lib/tags";
import { instrumentIconKey } from "@/lib/instruments";
import InstrumentPicker, { InstrumentIcon } from "@/components/InstrumentPicker";
import { saveFormationAction, deleteFormationAction } from "@/app/(app)/grup/formation-actions";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return "fs" + Date.now() + "_" + idCounter;
}

// Numera les posicions repetides del mateix instrument ("Gralla dolça 1",
// "Gralla dolça 2") i deixa sense número les úniques — en l'ordre en què
// s'han afegit al pla.
function slotLabel(slots: FormationSlot[], slot: FormationSlot): string {
  const sameKind = slots.filter((s) => s.instrument === slot.instrument);
  if (sameKind.length <= 1) return slot.instrument;
  const idx = sameKind.findIndex((s) => s.id === slot.id);
  return slot.instrument + " " + (idx + 1);
}

export function formationSummary(f: Formation): string {
  return f.slots.map((s) => slotLabel(f.slots, s)).join(", ");
}

// Editor d'una formació: pla d'escenari (mateix sistema de coordenades en %
// que l'StageCanvas del rider) amb una paleta d'instruments del grup a la
// dreta — arrossegar-ne un cap al pla hi afegeix una posició nova.
export default function FormationEditor({ band, formation, onClose }: { band: Band; formation: Formation | null; onClose: () => void }) {
  const [name, setName] = useState(formation?.name || "Formació");
  const [preferred, setPreferred] = useState(formation?.preferred || false);
  const [slots, setSlots] = useState<FormationSlot[]>(formation?.slots || []);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Paleta per defecte: els instruments que ja toca algú del grup (músics i
  // crew), sense repetits — es pot ampliar triant-ne més amb el picker.
  const bandInstruments = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    [...(band.members || []), ...(band.crew || [])].forEach((p) => {
      instrumentsFor(p).forEach((i) => { if (i && !seen.has(i.toLowerCase())) { seen.add(i.toLowerCase()); out.push(i); } });
    });
    return out;
  }, [band]);
  const [palette, setPalette] = useState<string[]>(bandInstruments);

  function dropCoords(e: React.DragEvent | React.PointerEvent): { x: number; y: number } {
    const area = areaRef.current!;
    const rect = area.getBoundingClientRect();
    return {
      x: Math.min(97, Math.max(3, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(92, Math.max(5, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function addSlot(instrument: string, x = 50, y = 45) {
    const slot: FormationSlot = { id: nextId(), instrument, x, y };
    setSlots((prev) => [...prev, slot]);
    setSelected(slot.id);
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    const area = areaRef.current;
    if (!area) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const slot = slots.find((s) => s.id === id);
    if (!slot) return;
    const rect = area.getBoundingClientRect();
    dragRef.current = {
      id,
      offsetX: e.clientX - (rect.left + (slot.x / 100) * rect.width),
      offsetY: e.clientY - (rect.top + (slot.y / 100) * rect.height),
    };
    setSelected(id);
  }
  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const area = areaRef.current;
    if (!drag || !area) return;
    const rect = area.getBoundingClientRect();
    const x = Math.min(97, Math.max(3, ((e.clientX - drag.offsetX - rect.left) / rect.width) * 100));
    const y = Math.min(92, Math.max(5, ((e.clientY - drag.offsetY - rect.top) / rect.height) * 100));
    setSlots((prev) => prev.map((s) => (s.id === drag.id ? { ...s, x, y } : s)));
  }

  async function save() {
    setSaving(true);
    await saveFormationAction({ id: formation?.id || null, bandId: band.id, name: name.trim() || "Formació", preferred, slots });
    setSaving(false);
    onClose();
  }
  async function remove() {
    if (!formation) return;
    if (!confirm("Segur que vols eliminar aquesta formació?")) return;
    setSaving(true);
    await deleteFormationAction(band.id, formation.id);
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal formation-editor-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <input
            className="field-input compact-field" style={{ fontWeight: 700, fontSize: 16, flex: 1 }}
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la formació"
          />
          <label className="formation-preferred-toggle" title="Formació de preferència">
            <input type="checkbox" checked={preferred} onChange={(e) => setPreferred(e.target.checked)} />
            <span>★ Preferida</span>
          </label>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="studio-stage">
          <div className="studio-palette">
            <div className="t-dim" style={{ fontSize: 12, marginBottom: 6 }}>Arrossega un instrument al pla</div>
            <div className="studio-items">
              {palette.map((inst) => (
                <button
                  key={inst} type="button" className="studio-item" title={`${inst} — arrossega o fes clic per afegir`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/formation-instrument", inst); e.dataTransfer.effectAllowed = "copy"; }}
                  onClick={() => addSlot(inst)}
                >
                  <InstrumentIcon name={inst} icon={instrumentIconKey(inst)} size={28} />
                  <span>{inst}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn-outline" style={{ marginTop: 10 }} onClick={() => setShowPicker((v) => !v)}>
              {showPicker ? "Fet" : "+ Afegeix instrument"}
            </button>
            {showPicker && (
              <div style={{ marginTop: 10 }}>
                <InstrumentPicker value={palette} onChange={setPalette} />
              </div>
            )}
          </div>

          <div className="studio-canvas-col">
            {selected && (
              <div className="studio-sel-tools">
                <span className="t-dim" style={{ fontSize: 12 }}>{slots.find((s) => s.id === selected)?.instrument}</span>
                <button type="button" className="studio-del" onClick={() => { setSlots((prev) => prev.filter((s) => s.id !== selected)); setSelected(null); }}>Elimina</button>
              </div>
            )}
            <div
              ref={areaRef}
              className="studio-area"
              style={{ aspectRatio: "1.5" }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={(e) => {
                e.preventDefault();
                const inst = e.dataTransfer.getData("text/formation-instrument");
                if (inst) { const { x, y } = dropCoords(e); addSlot(inst, x, y); }
              }}
              onPointerMove={onPointerMove}
              onPointerUp={() => { dragRef.current = null; }}
              onClick={(e) => { if (e.target === areaRef.current) setSelected(null); }}
            >
              <div className="sp-front">PÚBLIC</div>
              {slots.map((s) => (
                <div
                  key={s.id}
                  className={"studio-stage-item" + (selected === s.id ? " selected" : "")}
                  style={{ left: s.x + "%", top: s.y + "%" }}
                  onPointerDown={(e) => onPointerDown(e, s.id)}
                >
                  <div className="studio-stage-glyph" style={{ width: 48, height: 48 }}>
                    <InstrumentIcon name={s.instrument} icon={instrumentIconKey(s.instrument)} size={40} />
                  </div>
                  <span className="sp-item-label">{slotLabel(slots, s)}</span>
                </div>
              ))}
              {slots.length === 0 && (
                <div className="sp-empty">Arrossega instruments de la paleta fins al pla (o fes-hi clic)</div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {formation && <button type="button" className="btn-outline" style={{ color: "var(--red)", borderColor: "var(--red)" }} disabled={saving} onClick={remove}>Elimina la formació</button>}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-outline" disabled={saving} onClick={onClose}>Cancel·la</button>
          <button type="button" className="btn-save" disabled={saving} onClick={save}>{saving ? "Desant…" : "Desa"}</button>
        </div>
      </div>
    </div>
  );
}
