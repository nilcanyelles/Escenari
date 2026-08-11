"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Concert } from "@/lib/types";
import {
  type RouteSheet, type LlocItem, type ContactItem, type ScheduleItem, type HospitalitatItem, type TecnicItem,
  normalizeRouteSheet, rsBlankItem, rsIsComplete, RS_SECTION_ICONS,
} from "@/lib/route-sheet";
import { saveRouteSheetAction } from "@/app/(app)/concerts/actions";

type Section = "lloc" | "contacts" | "schedule" | "hospitalitat" | "tecnic";
type DragInfo = { section: Section; index: number };

function SectionIcon({ title }: { title: string }) {
  const path = RS_SECTION_ICONS[title];
  if (!path) return null;
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none" }} dangerouslySetInnerHTML={{ __html: path }} />
  );
}
function XIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
}
function DragHandle({ onDragStart }: { onDragStart: () => void }) {
  return (
    <div className="rs-drag-handle" draggable title="Arrossega per reordenar" onDragStart={onDragStart}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>
    </div>
  );
}
function ToggleIcon({ yes }: { yes: boolean }) {
  return yes ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  );
}

function TimePairInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = (value || "").split(":");
  const [h, setH] = useState(parts[0] || "");
  const [m, setM] = useState(parts[1] || "");

  function commit(hh: string, mm: string) {
    if (hh === "" && mm === "") { onChange(""); return; }
    const H = hh.length === 1 ? "0" + hh : hh || "00";
    const M = mm.length === 1 ? "0" + mm : mm || "00";
    onChange(H + ":" + M);
  }

  return (
    <div className="rs-time-pair">
      <input type="text" inputMode="numeric" maxLength={2} placeholder="00" className="field-input rs-time-box"
        value={h}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 2); setH(d); }}
        onBlur={() => commit(h, m)} />
      <span className="rs-time-sep">:</span>
      <input type="text" inputMode="numeric" maxLength={2} placeholder="00" className="field-input rs-time-box"
        value={m}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 2); setM(d); }}
        onBlur={() => commit(h, m)} />
    </div>
  );
}

export default function RouteSheetModal({ concert, onClose, onOpenPreview }: { concert: Concert; onClose: () => void; onOpenPreview: () => void }) {
  const router = useRouter();
  const [rsf, setRsf] = useState<RouteSheet>(() => normalizeRouteSheet(concert.routeSheet as RouteSheet | null, concert));
  const [saving, setSaving] = useState(false);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);

  function updateSection<K extends Section>(section: K, updater: (items: RouteSheet[K]) => RouteSheet[K]) {
    setRsf((prev) => ({ ...prev, [section]: updater(prev[section]) }));
  }

  function addItem(section: Section) {
    setRsf((prev) => ({ ...prev, [section]: [...(prev[section] as unknown[]), rsBlankItem(section)] }));
  }
  function removeItem(section: Section, index: number) {
    setRsf((prev) => ({ ...prev, [section]: (prev[section] as unknown[]).filter((_, i) => i !== index) }));
  }
  function reorder(section: Section, from: number, to: number) {
    setRsf((prev) => {
      const arr = (prev[section] as unknown[]).slice();
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return { ...prev, [section]: arr };
    });
  }

  function dragHandlers(section: Section, index: number) {
    return {
      onDragStart: () => setDragInfo({ section, index }),
      onDragOver: (e: React.DragEvent) => {
        if (!dragInfo || dragInfo.section !== section) return;
        e.preventDefault();
        if (dragInfo.index === index) return;
        reorder(section, dragInfo.index, index);
        setDragInfo({ section, index });
      },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragInfo(null); },
      onDragEnd: () => setDragInfo(null),
    };
  }

  async function handleSave() {
    setSaving(true);
    await saveRouteSheetAction(concert.id, rsf);
    router.refresh();
    setSaving(false);
  }

  const complete = rsIsComplete({ ...concert, routeSheet: rsf });

  // ---- Lloc ----
  const RS_LINK_FIELDS: Record<string, boolean> = { "adreça": true, "descàrrega": true, "parking": true };
  function llocValuePlaceholder(label: string) {
    return RS_LINK_FIELDS[(label || "").trim().toLowerCase()] ? "Enllaç Google Maps" : "";
  }

  function fieldRows(section: "lloc" | "tecnic", items: (LlocItem | TecnicItem)[]) {
    return items.map((it, i) => {
      const isParking = section === "lloc" && it.label && it.label.trim().toLowerCase() === "parking";
      const isPantallaLed = section === "tecnic" && it.label && it.label.trim().toLowerCase() === "pantalla led";
      return (
        <div key={i}>
          <div className="rs-field-row" {...dragHandlers(section, i)}>
            <DragHandle onDragStart={() => setDragInfo({ section, index: i })} />
            {isPantallaLed ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Camp" value={it.label}
                  onChange={(e) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x) as never)} />
                <button type="button" className={"rs-toggle-pill " + ((it as TecnicItem).included !== false ? "yes" : "no")} title="Clica per canviar"
                  onClick={() => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, included: (x as TecnicItem).included === false } : x) as never)}>
                  <ToggleIcon yes={(it as TecnicItem).included !== false} />
                </button>
              </div>
            ) : (
              <input className="field-input" type="text" placeholder="Camp (p.ex. Adreça)" value={it.label}
                onChange={(e) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x) as never)} />
            )}
            {isPantallaLed ? (
              <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Mida (p.ex. 3x2m)" value={it.value}
                onChange={(e) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, value: e.target.value } : x) as never)} />
            ) : (
              <input className="field-input" type="text" placeholder={section === "lloc" ? llocValuePlaceholder(it.label) : ""} value={it.value}
                onChange={(e) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, value: e.target.value } : x) as never)} />
            )}
            <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={() => removeItem(section, i)}><XIcon /></button>
          </div>
          {isParking && (
            <div className="rs-attached-row">
              <input className="field-input" type="text" placeholder="Matrícules autoritzades, separades per comes" value={(it as LlocItem).plates || ""}
                onChange={(e) => updateSection("lloc", (arr) => arr.map((x, xi) => xi === i ? { ...x, plates: e.target.value } : x))} />
            </div>
          )}
        </div>
      );
    });
  }

  // ---- Contacts ----
  const contactRows = rsf.contacts.map((ct, i) => (
    <div key={i} className="rs-contact-row" {...dragHandlers("contacts", i)}>
      <DragHandle onDragStart={() => setDragInfo({ section: "contacts", index: i })} />
      <input className="field-input" type="text" placeholder="Càrrec" value={ct.role}
        onChange={(e) => updateSection("contacts", (arr) => arr.map((x, xi) => xi === i ? { ...x, role: e.target.value } : x))} />
      <input className="field-input" type="text" placeholder="Nom" value={ct.name}
        onChange={(e) => updateSection("contacts", (arr) => arr.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} />
      <input className="field-input" type="text" placeholder="Empresa" value={ct.company}
        onChange={(e) => updateSection("contacts", (arr) => arr.map((x, xi) => xi === i ? { ...x, company: e.target.value } : x))} />
      <input className="field-input" type="text" placeholder="Telèfon" value={ct.phone}
        onChange={(e) => updateSection("contacts", (arr) => arr.map((x, xi) => xi === i ? { ...x, phone: e.target.value } : x))} />
      <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={() => removeItem("contacts", i)}><XIcon /></button>
    </div>
  ));

  // ---- Schedule ----
  const phaseRows = rsf.schedule.map((ph, i) => (
    <div key={i} className="rs-phase-row" {...dragHandlers("schedule", i)}>
      <DragHandle onDragStart={() => setDragInfo({ section: "schedule", index: i })} />
      <input className="field-input" type="text" placeholder="Fase" value={ph.phase}
        onChange={(e) => updateSection("schedule", (arr) => arr.map((x, xi) => xi === i ? { ...x, phase: e.target.value } : x))} />
      <TimePairInput value={ph.start} onChange={(v) => updateSection("schedule", (arr) => arr.map((x, xi) => xi === i ? { ...x, start: v } : x))} />
      <TimePairInput value={ph.end} onChange={(v) => updateSection("schedule", (arr) => arr.map((x, xi) => xi === i ? { ...x, end: v } : x))} />
      <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={() => removeItem("schedule", i)}><XIcon /></button>
    </div>
  ));

  // ---- Hospitalitat ----
  const FIXED_TOGGLE_LABELS = ["dietes", "catering", "camerino"];
  function updateHosp(i: number, patch: Partial<HospitalitatItem>) {
    updateSection("hospitalitat", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x));
  }
  let hotelBlock: React.ReactNode = null;
  const regularHospRows: React.ReactNode[] = [];
  rsf.hospitalitat.forEach((it, i) => {
    const isHotel = it.label && it.label.trim().toLowerCase() === "allotjament";
    if (!isHotel) {
      const isFixedToggle = it.label && FIXED_TOGGLE_LABELS.indexOf(it.label.trim().toLowerCase()) !== -1;
      regularHospRows.push(
        <div key={i} className="rs-field-row" {...dragHandlers("hospitalitat", i)}>
          <DragHandle onDragStart={() => setDragInfo({ section: "hospitalitat", index: i })} />
          {isFixedToggle ? (
            <div style={{ gridColumn: "2 / span 2", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <button type="button" className={"rs-toggle-pill rs-toggle-pill-fixed " + (it.included !== false ? "yes" : "no")}
                title="Clica per canviar" onClick={() => updateHosp(i, { included: it.included === false })}>
                <span>{it.label}</span>
                <ToggleIcon yes={it.included !== false} />
              </button>
              <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Detalls (opcional)" value={it.value}
                onChange={(e) => updateHosp(i, { value: e.target.value })} />
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Camp (p.ex. Dietes)" value={it.label}
                  onChange={(e) => updateHosp(i, { label: e.target.value })} />
                <button type="button" className={"rs-toggle-pill " + (it.included !== false ? "yes" : "no")} title="Clica per canviar"
                  onClick={() => updateHosp(i, { included: it.included === false })}>
                  <ToggleIcon yes={it.included !== false} />
                </button>
              </div>
              <input className="field-input" type="text" placeholder="Detalls (opcional)" value={it.value}
                onChange={(e) => updateHosp(i, { value: e.target.value })} />
            </>
          )}
          <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={() => removeItem("hospitalitat", i)}><XIcon /></button>
        </div>
      );
      return;
    }
    const included = it.included !== false;
    const parkingAvailable = it.parkingAvailable !== false;
    const breakfastAvailable = it.breakfastAvailable !== false;
    hotelBlock = (
      <div key={i} className="rs-hotel-subgroup">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className={"rs-toggle-pill rs-toggle-pill-fixed " + (included ? "yes" : "no")} title="Clica per canviar"
            onClick={() => updateHosp(i, { included: it.included === false })}>
            <span>{it.label}</span>
            <ToggleIcon yes={included} />
          </button>
          <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Nom de l'allotjament" value={it.value}
            onChange={(e) => updateHosp(i, { value: e.target.value })} />
        </div>
        {included && (
          <>
            <div className="rs-hotel-subgroup-row">
              <input className="field-input" type="text" placeholder="Telèfon de l'allotjament" value={it.phone || ""}
                onChange={(e) => updateHosp(i, { phone: e.target.value })} />
              <input className="field-input" type="text" placeholder="Enllaç Google Maps" value={it.location || ""}
                onChange={(e) => updateHosp(i, { location: e.target.value })} />
            </div>
            <div className="rs-hotel-parking-row">
              <button type="button" className={"rs-toggle-pill " + (parkingAvailable ? "yes" : "no")} title="Clica per canviar"
                onClick={() => updateHosp(i, { parkingAvailable: it.parkingAvailable === false })}>
                <span>Pàrquing</span>
                <ToggleIcon yes={parkingAvailable} />
              </button>
              <input className="field-input rs-parking-count" type="text" placeholder="Matrícules" value={it.parkingPlates || ""}
                onChange={(e) => updateHosp(i, { parkingPlates: e.target.value })} />
            </div>
            <div className="rs-hotel-specs-row">
              <div className="rs-hotel-checkinout-item">
                <span className="rs-col-label" style={{ textAlign: "left" }}>Check-in</span>
                <TimePairInput value={it.checkIn || ""} onChange={(v) => updateHosp(i, { checkIn: v })} />
              </div>
              <div className="rs-hotel-checkinout-item">
                <span className="rs-col-label" style={{ textAlign: "left" }}>Check-out</span>
                <TimePairInput value={it.checkOut || ""} onChange={(v) => updateHosp(i, { checkOut: v })} />
              </div>
            </div>
            <div className="rs-hotel-parking-row">
              <button type="button" className={"rs-toggle-pill " + (breakfastAvailable ? "yes" : "no")} title="Clica per canviar"
                onClick={() => updateHosp(i, { breakfastAvailable: it.breakfastAvailable === false })}>
                <span>Esmorzar</span>
                <ToggleIcon yes={breakfastAvailable} />
              </button>
              {breakfastAvailable && <TimePairInput value={it.breakfastTime || ""} onChange={(v) => updateHosp(i, { breakfastTime: v })} />}
            </div>
          </>
        )}
      </div>
    );
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide rs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{concert.bandName} - {concert.city} - {concert.date.slice(8, 10)}/{concert.date.slice(5, 7)}/{concert.date.slice(2, 4)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" className={"row-rs-btn" + (complete ? " rs-complete" : "")} title="Visualitza el PDF" aria-label="Visualitza el PDF" onClick={onOpenPreview}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button type="button" className="row-rs-btn" title="Desar full de ruta" aria-label="Desar full de ruta" disabled={saving} onClick={handleSave}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            </button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-form">
          <div className="rs-section-title"><SectionIcon title="Lloc" /><span>Lloc</span></div>
          <div className="rs-repeater" data-rs-section="lloc">{fieldRows("lloc", rsf.lloc)}</div>
          <button type="button" className="rs-add-btn" onClick={() => addItem("lloc")}>+ Afegeix camp</button>

          <div className="rs-section-title"><SectionIcon title="Contactes" /><span>Contactes</span></div>
          <div className="rs-repeater" data-rs-section="contacts">{contactRows}</div>
          <button type="button" className="rs-add-btn" onClick={() => addItem("contacts")}>+ Afegeix contacte</button>

          <div className="rs-section-title rs-phase-header">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><SectionIcon title="Horaris" /><span>Horaris</span></span>
            <span className="rs-col-label">Inici</span>
            <span className="rs-col-label">Fi</span>
            <span></span>
          </div>
          <div className="rs-repeater" data-rs-section="schedule">{phaseRows}</div>
          <button type="button" className="rs-add-btn" onClick={() => addItem("schedule")}>+ Afegeix fase</button>

          <div className="rs-section-title"><SectionIcon title="Hospitalitat" /><span>Hospitalitat</span></div>
          <div className="rs-repeater" data-rs-section="hospitalitat">{regularHospRows}{hotelBlock}</div>
          <button type="button" className="rs-add-btn" onClick={() => addItem("hospitalitat")}>+ Afegeix camp</button>

          <div className="rs-section-title"><SectionIcon title="Detalls tècnics" /><span>Detalls tècnics</span></div>
          <div className="rs-repeater" data-rs-section="tecnic">{fieldRows("tecnic", rsf.tecnic)}</div>
          <button type="button" className="rs-add-btn" onClick={() => addItem("tecnic")}>+ Afegeix camp</button>

          <div className="modal-actions">
            <div className="spacer"></div>
            <button type="button" className={"row-rs-btn" + (complete ? " rs-complete" : "")} title="Visualitza el PDF" aria-label="Visualitza el PDF" onClick={onOpenPreview}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button type="button" className="row-rs-btn" title="Desar full de ruta" aria-label="Desar full de ruta" disabled={saving} onClick={handleSave}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            </button>
            <button type="button" className="row-rs-btn" title="Cancel·lar" aria-label="Cancel·lar" onClick={onClose}>✕</button>
          </div>
        </div>
      </div>
    </div>
  );
}
