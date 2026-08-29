"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Concert, Vehicle } from "@/lib/types";
import {
  type RouteSheet, type LlocItem, type HospitalitatItem, type TecnicItem, type RouteSheetDefaults,
  normalizeRouteSheet, rsBlankItem, rsIsComplete, rsCompletionPercent, stripSectionForDefault, RS_SECTION_ICONS,
} from "@/lib/route-sheet";
import { saveRouteSheetAction, searchVenuesAction } from "@/app/(app)/concerts/actions";
import { saveDefaultRouteSheetSectionAction } from "@/app/(app)/grup/actions";

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
  return (
    <div className="rs-time-pair">
      <input type="time" className="field-input rs-time-box" value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function RouteSheetEditor({ concert, venue, city, onVenueCityChange, vehicles = [], bandDefaultRouteSheet = null, onCompleteChange, onPercentChange, onSaved }: {
  concert: Concert;
  vehicles?: Vehicle[];
  // Plantilla d'"opcions" del full de ruta del grup (etiquetes/fases/càrrecs
  // i interruptors) — s'aplica quan el concert encara no té cap secció
  // desada, en comptes de la plantilla genèrica de l'app.
  bandDefaultRouteSheet?: RouteSheetDefaults | null;
  // El "Recinte" d'aquí i la "Ubicació/sala" d'Informació són el mateix
  // camp — es passen des del pare (que és qui en té l'estat de veres) en
  // comptes de dependre del "concert" (que només s'actualitza en fer
  // refresh de la pàgina) perquè editar-lo aquí es reflecteixi també a
  // l'altra pestanya a l'instant, sense recarregar res.
  venue: string;
  city: string;
  onVenueCityChange: (v: { name: string; city?: string }) => void;
  onCompleteChange?: (complete: boolean) => void;
  onPercentChange?: (percent: number) => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [rsf, setRsf] = useState<RouteSheet>(() => normalizeRouteSheet(concert.routeSheet as RouteSheet | null, concert, bandDefaultRouteSheet));
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSection, setSavedSection] = useState<Section | null>(null);
  const isFirstRender = useRef(true);
  const saveTimer = useRef<number | null>(null);
  const refreshTimer = useRef<number | null>(null);

  // Punt de referència de les "opcions" (etiquetes/fases/càrrecs i
  // interruptors) de cada secció tal com estaven en obrir el full de ruta —
  // el botó de "desa com a predeterminat" només apareix quan l'usuari edita
  // o afegeix un camp que faci que l'estructura actual difereixi d'aquest
  // punt de referència (mai per canviar només un detall/valor).
  const sectionBaselineRef = useRef<Record<Section, string>>({
    lloc: JSON.stringify(stripSectionForDefault("lloc", rsf.lloc)),
    contacts: JSON.stringify(stripSectionForDefault("contacts", rsf.contacts)),
    schedule: JSON.stringify(stripSectionForDefault("schedule", rsf.schedule)),
    hospitalitat: JSON.stringify(stripSectionForDefault("hospitalitat", rsf.hospitalitat)),
    tecnic: JSON.stringify(stripSectionForDefault("tecnic", rsf.tecnic)),
  });
  function isSectionDirty(section: Section): boolean {
    return JSON.stringify(stripSectionForDefault(section, rsf[section])) !== sectionBaselineRef.current[section];
  }

  async function saveSectionAsDefault(section: Section) {
    const stripped = stripSectionForDefault(section, rsf[section]);
    await saveDefaultRouteSheetSectionAction(concert.bandId, section, stripped as unknown[]);
    sectionBaselineRef.current[section] = JSON.stringify(stripped);
    setSavedSection(section);
    window.setTimeout(() => setSavedSection((s) => (s === section ? null : s)), 1800);
  }
  function SectionDefaultBtn({ section }: { section: Section }) {
    if (!isSectionDirty(section) && savedSection !== section) return null;
    return (
      <button type="button" className="link-btn rs-save-default-btn" onClick={() => saveSectionAsDefault(section)}>
        {savedSection === section ? "Desat com a predeterminat ✓" : "Desa les opcions com a predeterminades"}
      </button>
    );
  }

  // Cerca de recintes per al camp "Recinte" — mateixa funció que "Ubicació
  // / sala" a Informació (mateixa API, mateix desplegable).
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
  const [venueSearch, setVenueSearch] = useState("");
  const [venueResults, setVenueResults] = useState<{ description: string; name: string; city: string; placeId: string }[]>([]);
  const [venueSearching, setVenueSearching] = useState(false);
  const venueSearchTimer = useRef<number | null>(null);
  useEffect(() => {
    if (venueSearchTimer.current) window.clearTimeout(venueSearchTimer.current);
    const q = venueSearch.trim();
    if (q.length < 2) { setVenueResults([]); setVenueSearching(false); return; }
    setVenueSearching(true);
    venueSearchTimer.current = window.setTimeout(async () => {
      const results = await searchVenuesAction(q);
      setVenueResults(results);
      setVenueSearching(false);
    }, 300);
    return () => { if (venueSearchTimer.current) window.clearTimeout(venueSearchTimer.current); };
  }, [venueSearch]);

  // Cerca d'adreces per al camp "Adreça" — mateixa API (Photon), que ja
  // retorna tant adreces com punts d'interès (comerços, escoles...), sense
  // obligar a triar-ne un: és una ajuda per validar, no substitueix el text
  // lliure.
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [addressSearch, setAddressSearch] = useState("");
  const [addressResults, setAddressResults] = useState<{ description: string; name: string; city: string; placeId: string }[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const addressSearchTimer = useRef<number | null>(null);
  useEffect(() => {
    if (addressSearchTimer.current) window.clearTimeout(addressSearchTimer.current);
    const q = addressSearch.trim();
    if (q.length < 2) { setAddressResults([]); setAddressSearching(false); return; }
    setAddressSearching(true);
    addressSearchTimer.current = window.setTimeout(async () => {
      const results = await searchVenuesAction(q);
      setAddressResults(results);
      setAddressSearching(false);
    }, 300);
    return () => { if (addressSearchTimer.current) window.clearTimeout(addressSearchTimer.current); };
  }, [addressSearch]);

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

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      await saveRouteSheetAction(concert.id, rsf);
      setSaving(false);
      onSaved?.();
    }, 600);
    // El refresc de tota la pàgina (per si el % de "Full de ruta" es mostra
    // en algun altre lloc fora d'aquest component) va a part i amb un
    // debounce més llarg que el desat: mentre s'omplen camps seguits no cal
    // refer-la a cada pausa de mig segon, només un cop l'usuari ja s'ha
    // aturat de veres — l'estat local (rsf) ja mostra el canvi a l'instant.
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => { router.refresh(); }, 2500);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rsf]);

  const complete = rsIsComplete({ ...concert, routeSheet: rsf });
  const percent = rsCompletionPercent({ ...concert, routeSheet: rsf });
  useEffect(() => { onCompleteChange?.(complete); }, [complete, onCompleteChange]);
  useEffect(() => { onPercentChange?.(percent); }, [percent, onPercentChange]);

  // ---- Lloc ----
  const RS_LINK_FIELDS: Record<string, boolean> = { "adreça": true, "descàrrega": true, "parking": true };
  function llocValuePlaceholder(label: string) {
    return RS_LINK_FIELDS[(label || "").trim().toLowerCase()] ? "Enllaç Google Maps" : "";
  }

  function renderFieldRow(section: "lloc" | "tecnic", it: LlocItem | TecnicItem, i: number) {
    const isPantallaLed = section === "tecnic" && it.label && it.label.trim().toLowerCase() === "pantalla led";
    // El camp "Recinte" és el mateix que "Ubicació / sala" a Informació —
    // no un camp de text lliure com la resta, sinó la mateixa cerca de
    // recintes, en aquesta mateixa fila (no se n'afegeix cap de nova).
    const isRecinte = section === "lloc" && it.label && it.label.trim().toLowerCase() === "recinte";
    const isAdreça = section === "lloc" && it.label && it.label.trim().toLowerCase() === "adreça";
    return (
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
        ) : isRecinte ? (
          <div style={{ position: "relative" }}>
            <input
              className="field-input" type="text" autoComplete="off" placeholder="Cerca un recinte…"
              value={venueDropdownOpen ? venueSearch : venue}
              onFocus={() => { setVenueSearch(venue); setVenueDropdownOpen(true); }}
              onChange={(e) => setVenueSearch(e.target.value)}
            />
            {venueDropdownOpen && (
              <>
                <div className="year-picker-overlay" onClick={() => { if (!venueSearch.trim() && venue) onVenueCityChange({ name: "" }); setVenueDropdownOpen(false); }}></div>
                <div className="year-dropdown cf-band-dropdown" onClick={(e) => e.stopPropagation()}>
                  {venueSearch.trim().length < 2 ? (
                    <div className="cf-band-noresults">Escriu almenys 2 lletres… (o deixa-ho buit i tanca per esborrar)</div>
                  ) : venueSearching ? (
                    <div className="cf-band-noresults">Cercant…</div>
                  ) : venueResults.length ? venueResults.map((v) => (
                    <button key={v.placeId} type="button" className={"year-option" + (v.name === venue ? " active" : "")}
                      onClick={() => { onVenueCityChange({ name: v.name, city: v.city }); setVenueDropdownOpen(false); }}>{v.description}</button>
                  )) : <div className="cf-band-noresults">Cap recinte coincideix</div>}
                </div>
              </>
            )}
          </div>
        ) : isAdreça ? (
          <div style={{ position: "relative" }}>
            <input
              className="field-input" type="text" autoComplete="off" placeholder="Adreça" value={it.value}
              onFocus={() => { setAddressSearch(it.value); setAddressDropdownOpen(true); }}
              onChange={(e) => {
                const val = e.target.value;
                setAddressSearch(val);
                updateSection("lloc", (arr) => arr.map((x, xi) => xi === i ? { ...x, value: val } : x) as never);
              }}
            />
            {addressDropdownOpen && addressSearch.trim().length >= 2 && (
              <>
                <div className="year-picker-overlay" onClick={() => setAddressDropdownOpen(false)}></div>
                <div className="year-dropdown cf-band-dropdown" onClick={(e) => e.stopPropagation()}>
                  {addressSearching ? (
                    <div className="cf-band-noresults">Cercant…</div>
                  ) : addressResults.length ? addressResults.map((v) => (
                    <button key={v.placeId} type="button" className="year-option"
                      onClick={() => {
                        updateSection("lloc", (arr) => arr.map((x, xi) => xi === i ? { ...x, value: v.description } : x) as never);
                        setAddressDropdownOpen(false);
                      }}>{v.description}</button>
                  )) : <div className="cf-band-noresults">Cap resultat</div>}
                </div>
              </>
            )}
          </div>
        ) : (
          <input className="field-input" type="text" placeholder={section === "lloc" ? llocValuePlaceholder(it.label) : ""} value={it.value}
            onChange={(e) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, value: e.target.value } : x) as never)} />
        )}
        <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={() => removeItem(section, i)}><XIcon /></button>
      </div>
    );
  }

  function fieldRows(section: "lloc" | "tecnic", items: (LlocItem | TecnicItem)[]) {
    return items.map((it, i) => <div key={i}>{renderFieldRow(section, it, i)}</div>);
  }

  // Línia de "Vehicles autoritzats" (comptador + xips de vehicles del grup),
  // sempre a l'alçada de la fila de "Parking", alineada amb la resta de
  // camps (mateixa columna de valor).
  function vehicleFieldsLine(parkingIdx: number) {
    const it = rsf.lloc[parkingIdx];
    const currentPlates = (it.plates || "").split(",").map((p) => p.trim()).filter(Boolean);
    return (
      <div className="rs-attached-row">
        <div className="rs-parking-fields">
          <input className="field-input rs-vehicle-count-input" type="text" inputMode="numeric" placeholder="Vehicles autoritzats" value={it.vehicleCount || ""}
            onChange={(e) => updateSection("lloc", (arr) => arr.map((x, xi) => xi === parkingIdx ? { ...x, vehicleCount: e.target.value.replace(/\D/g, "") } : x))} />
          {vehicles.length > 0 && (
            <div className="rs-vehicle-chips">
              {vehicles.filter((v) => v.plate).map((v) => {
                const selected = currentPlates.includes(v.plate);
                return (
                  <button
                    key={v.plate} type="button" className={"rs-vehicle-chip" + (selected ? " active" : "")}
                    onClick={() => {
                      const set = new Set(currentPlates);
                      if (selected) set.delete(v.plate); else set.add(v.plate);
                      updateSection("lloc", (arr) => arr.map((x, xi) => xi === parkingIdx ? { ...x, plates: Array.from(set).join(", ") } : x));
                    }}
                  >{[[v.type, v.brand, v.color].filter(Boolean).join(" "), v.owner, v.plate].filter(Boolean).join(" · ")}</button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Files de la secció Lloc: cadascun en la seva pròpia línia, un sota
  // l'altre, en ordre — "Parking" sempre l'últim (amb la línia de "Vehicles
  // autoritzats" enganxada just a sota) encara que a les dades hi sigui en
  // una altra posició.
  function llocRows() {
    const items = rsf.lloc;
    const order = items.map((_, i) => i).sort((a, b) => {
      const pa = items[a].label && items[a].label.trim().toLowerCase() === "parking" ? 1 : 0;
      const pb = items[b].label && items[b].label.trim().toLowerCase() === "parking" ? 1 : 0;
      return pa - pb;
    });
    return order.map((i) => {
      const it = items[i];
      const isParking = it.label && it.label.trim().toLowerCase() === "parking";
      return (
        <div key={i}>
          {renderFieldRow("lloc", it, i)}
          {isParking && vehicleFieldsLine(i)}
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
    <div style={{ position: "relative" }}>
      {saving && <div className="cf-saving-indicator rs-saving-float">Desant…</div>}

      <div className="rs-section-title">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><SectionIcon title="Lloc" /><span>Lloc</span></span>
        <SectionDefaultBtn section="lloc" />
      </div>
      <div className="rs-repeater" data-rs-section="lloc">{llocRows()}</div>
      <button type="button" className="rs-add-btn" onClick={() => addItem("lloc")}>+ Afegeix camp</button>

      <div className="rs-section-title">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><SectionIcon title="Contactes" /><span>Contactes</span></span>
        <SectionDefaultBtn section="contacts" />
      </div>
      <div className="rs-repeater" data-rs-section="contacts">{contactRows}</div>
      <button type="button" className="rs-add-btn" onClick={() => addItem("contacts")}>+ Afegeix contacte</button>

      <div className="rs-section-title rs-phase-header">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><SectionIcon title="Horaris" /><span>Horaris</span><SectionDefaultBtn section="schedule" /></span>
        <span className="rs-col-label">Inici</span>
        <span className="rs-col-label">Fi</span>
        <span></span>
      </div>
      <div className="rs-repeater" data-rs-section="schedule">{phaseRows}</div>
      <button type="button" className="rs-add-btn" onClick={() => addItem("schedule")}>+ Afegeix fase</button>

      <div className="rs-section-title">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><SectionIcon title="Hospitalitat" /><span>Hospitalitat</span></span>
        <SectionDefaultBtn section="hospitalitat" />
      </div>
      <div className="rs-repeater" data-rs-section="hospitalitat">{regularHospRows}{hotelBlock}</div>
      <button type="button" className="rs-add-btn" onClick={() => addItem("hospitalitat")}>+ Afegeix camp</button>

      <div className="rs-section-title">
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><SectionIcon title="Detalls tècnics" /><span>Detalls tècnics</span></span>
        <SectionDefaultBtn section="tecnic" />
      </div>
      <div className="rs-repeater" data-rs-section="tecnic">{fieldRows("tecnic", rsf.tecnic)}</div>
      <button type="button" className="rs-add-btn" onClick={() => addItem("tecnic")}>+ Afegeix camp</button>
    </div>
  );
}
