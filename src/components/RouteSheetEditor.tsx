"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Concert, Vehicle } from "@/lib/types";
import {
  type RouteSheet, type LlocItem, type HospitalitatItem, type TecnicItem, type RouteSheetDefaults,
  normalizeRouteSheet, rsBlankItem, rsIsComplete, rsCompletionPercent, stripSectionForDefault, RS_SECTION_ICONS,
} from "@/lib/route-sheet";
import { saveRouteSheetAction, searchVenuesAction, searchVenuesGoogleAction, getPlaceDetailsAction } from "@/app/(app)/concerts/actions";
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

// Sí/No amb dos botonets separats (tick i creu) en comptes d'un sol
// interruptor — cap dels dos surt marcat fins que se'n cliqui un: mai
// activat o desactivat per defecte, sinó "encara per decidir".
function TickCrossButtons({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="rs-tick-cross">
      <button type="button" className={"rs-tick-cross-btn yes" + (value === true ? " active" : "")} title="Sí" onClick={() => onChange(true)}>
        <ToggleIcon yes={true} />
      </button>
      <button type="button" className={"rs-tick-cross-btn no" + (value === false ? " active" : "")} title="No" onClick={() => onChange(false)}>
        <ToggleIcon yes={false} />
      </button>
    </div>
  );
}

// Estat d'aprovació del contrarider: un botó que fa cicle entre les 3
// opcions a cada clic — sense estat inicial (abans del primer clic, "Sense
// revisar"), mai ja aprovat o similar per defecte.
const CONTRA_STATUS_CYCLE = ["aprovat", "no-rebut", "esperant-canvis"] as const;
const CONTRA_STATUS_LABELS: Record<string, string> = { aprovat: "Aprovat", "no-rebut": "No rebut", "esperant-canvis": "Esperant canvis" };
function nextContraStatus(cur?: string): typeof CONTRA_STATUS_CYCLE[number] {
  const idx = CONTRA_STATUS_CYCLE.indexOf(cur as typeof CONTRA_STATUS_CYCLE[number]);
  return CONTRA_STATUS_CYCLE[(idx + 1) % CONTRA_STATUS_CYCLE.length];
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
  onVenueCityChange: (v: { name: string; city?: string; street?: string; housenumber?: string }) => void;
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

  // Camps omplerts / camps a omplir de cada secció. Contactes i horaris
  // compten 1 unitat per fila (no una per subcamp): un contacte compta com
  // a fet quan hi ha totes les seves dades, una fase quan hi ha alguna
  // hora — així el comptador reflecteix "quantes files", no "quants
  // camps solts".
  function sectionStats(section: Section): { filled: number; total: number } {
    let total = 0, filled = 0;
    const check = (v: unknown) => { total++; if (v && String(v).trim()) filled++; };
    if (section === "lloc") rsf.lloc.forEach((it) => check(it.value));
    else if (section === "contacts") rsf.contacts.forEach((it) => {
      total++;
      if (it.role.trim() && it.name.trim() && it.phone.trim() && it.company.trim()) filled++;
    });
    else if (section === "schedule") rsf.schedule.forEach((it) => {
      total++;
      if (it.start.trim() || it.end.trim()) filled++;
    });
    else if (section === "hospitalitat") rsf.hospitalitat.forEach((it) => check(it.value));
    else rsf.tecnic.forEach((it) => { if (!(it.label && it.label.trim().toLowerCase() === "pantalla led")) check(it.value); });
    return { filled, total };
  }
  const [openSections, setOpenSections] = useState<Record<Section, boolean>>(() => {
    // La primera secció incompleta, oberta; la resta, plegades.
    const order: Section[] = ["lloc", "contacts", "schedule", "hospitalitat", "tecnic"];
    const out: Record<Section, boolean> = { lloc: false, contacts: false, schedule: false, hospitalitat: false, tecnic: false };
    const firstIncomplete = order.find((s) => { const st = sectionStats(s); return st.total === 0 || st.filled < st.total; });
    out[firstIncomplete || "lloc"] = true;
    return out;
  });

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
  const [venueResults, setVenueResults] = useState<{ description: string; placeId: string }[]>([]);
  const [venueSearching, setVenueSearching] = useState(false);
  const [venueResolving, setVenueResolving] = useState<string | null>(null);
  const venueSearchTimer = useRef<number | null>(null);
  useEffect(() => {
    if (venueSearchTimer.current) window.clearTimeout(venueSearchTimer.current);
    const q = venueSearch.trim();
    if (q.length < 2) { setVenueResults([]); setVenueSearching(false); return; }
    setVenueSearching(true);
    venueSearchTimer.current = window.setTimeout(async () => {
      const results = await searchVenuesGoogleAction(q);
      setVenueResults(results);
      setVenueSearching(false);
    }, 300);
    return () => { if (venueSearchTimer.current) window.clearTimeout(venueSearchTimer.current); };
  }, [venueSearch]);

  // Triar una predicció de l'autocompletat de Google en demana els detalls
  // (nom, població, carrer i número) abans d'omplir el Recinte.
  async function selectVenue(placeId: string) {
    setVenueResolving(placeId);
    const details = await getPlaceDetailsAction(placeId);
    setVenueResolving(null);
    setVenueDropdownOpen(false);
    if (!details) return;
    onVenueCityChange(details);
  }

  // Cerca d'adreces per al camp "Adreça" — mateixa API (Photon), que ja
  // retorna tant adreces com punts d'interès (comerços, escoles...), sense
  // obligar a triar-ne un: és una ajuda per validar, no substitueix el text
  // lliure.
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [addressSearch, setAddressSearch] = useState("");
  const [addressResults, setAddressResults] = useState<{ description: string; name: string; city: string; street: string; housenumber: string; placeId: string }[]>([]);
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

  // Desplegable de xips de vehicles per al camp "Número de vehicles".
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);

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
    const isContrarider = section === "tecnic" && it.label && it.label.trim().toLowerCase() === "contra rider";
    // El camp "Recinte" és el mateix que "Ubicació / sala" a Informació —
    // no un camp de text lliure com la resta, sinó la mateixa cerca de
    // recintes, en aquesta mateixa fila (no se n'afegeix cap de nova).
    const isRecinte = section === "lloc" && it.label && it.label.trim().toLowerCase() === "recinte";
    const isAdreça = section === "lloc" && it.label && it.label.trim().toLowerCase() === "adreça";
    const isVehicleCount = section === "lloc" && it.label && it.label.trim().toLowerCase() === "número de vehicles";
    return (
      <div className="rs-field-row" {...dragHandlers(section, i)}>
        <DragHandle onDragStart={() => setDragInfo({ section, index: i })} />
        {isPantallaLed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Camp" value={it.label}
              onChange={(e) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x) as never)} />
            <TickCrossButtons value={(it as TecnicItem).included}
              onChange={(v) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, included: v } : x) as never)} />
          </div>
        ) : (
          <input className="field-input" type="text" placeholder="Camp (p.ex. Adreça)" value={it.label}
            onChange={(e) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x) as never)} />
        )}
        {isPantallaLed ? (
          <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Mida (p.ex. 3x2m)" value={it.value}
            onChange={(e) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, value: e.target.value } : x) as never)} />
        ) : isContrarider ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <button type="button"
              className={"rs-status-btn" + ((it as TecnicItem).status ? " rs-status-" + (it as TecnicItem).status : "")}
              title="Clica per canviar l'estat"
              onClick={() => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, status: nextContraStatus((x as TecnicItem).status) } : x) as never)}>
              {(it as TecnicItem).status ? CONTRA_STATUS_LABELS[(it as TecnicItem).status as string] : "Sense revisar"}
            </button>
            <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Notes" value={it.value}
              onChange={(e) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, value: e.target.value } : x) as never)} />
          </div>
        ) : isVehicleCount ? (
          <div style={{ position: "relative" }}>
            <button type="button" className={"rs-vehicle-dropdown-btn" + ((it as LlocItem).plates ? "" : " placeholder")}
              onClick={() => setVehicleDropdownOpen((v) => !v)}>
              {(() => {
                const plates = ((it as LlocItem).plates || "").split(",").map((p) => p.trim()).filter(Boolean);
                return plates.length ? `${plates.length} vehicle${plates.length > 1 ? "s" : ""} seleccionat${plates.length > 1 ? "s" : ""}` : "Selecciona vehicles…";
              })()}
            </button>
            {vehicleDropdownOpen && (
              <>
                <div className="year-picker-overlay" onClick={() => setVehicleDropdownOpen(false)}></div>
                <div className="year-dropdown cf-band-dropdown rs-vehicle-dropdown-panel" onClick={(e) => e.stopPropagation()}>
                  {vehicles.filter((v) => v.plate).length === 0 ? (
                    <div className="cf-band-noresults">El grup no té cap vehicle registrat</div>
                  ) : vehicles.filter((v) => v.plate).map((v) => {
                    const currentPlates = ((it as LlocItem).plates || "").split(",").map((p) => p.trim()).filter(Boolean);
                    const selected = currentPlates.includes(v.plate);
                    const label = [[v.type, v.brand, v.color].filter(Boolean).join(" "), v.owner, v.plate].filter(Boolean).join(" · ");
                    return (
                      <button key={v.plate} type="button" className={"rs-vehicle-chip" + (selected ? " active" : "")}
                        onClick={() => {
                          const set = new Set(currentPlates);
                          if (selected) set.delete(v.plate); else set.add(v.plate);
                          const next = Array.from(set);
                          updateSection("lloc", (arr) => arr.map((x, xi) => xi === i ? { ...x, plates: next.join(", "), value: next.length ? `${next.length} vehicle${next.length > 1 ? "s" : ""}` : "" } : x) as never);
                        }}
                      >{label}</button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
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
                    <button key={v.placeId} type="button" className="year-option" disabled={venueResolving === v.placeId}
                      onClick={() => selectVenue(v.placeId)}>{venueResolving === v.placeId ? "Carregant…" : v.description}</button>
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
      // Mateixa estructura per als camps fixos (Dietes, Catering, Camerino)
      // i els que s'afegeixen a mà — només canvia si l'etiqueta és text
      // fix o editable, perquè les caselles quedin alineades entre elles.
      regularHospRows.push(
        <div key={i} className="rs-field-row" {...dragHandlers("hospitalitat", i)}>
          <DragHandle onDragStart={() => setDragInfo({ section: "hospitalitat", index: i })} />
          <div className="rs-hosp-label-cell">
            {isFixedToggle ? (
              <span className="rs-hosp-fixed-label">{it.label}</span>
            ) : (
              <input className="field-input" type="text" placeholder="Camp (p.ex. Dietes)" value={it.label}
                onChange={(e) => updateHosp(i, { label: e.target.value })} />
            )}
            <TickCrossButtons value={it.included} onChange={(v) => updateHosp(i, { included: v })} />
          </div>
          <input className="field-input" type="text" placeholder="Detalls (opcional)" value={it.value}
            onChange={(e) => updateHosp(i, { value: e.target.value })} />
          <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={() => removeItem("hospitalitat", i)}><XIcon /></button>
        </div>
      );
      return;
    }
    const included = it.included === true;
    const parkingAvailable = it.parkingAvailable === true;
    const breakfastAvailable = it.breakfastAvailable === true;
    hotelBlock = (
      <div key={i} className="rs-hotel-subgroup">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="rs-hosp-fixed-label" style={{ flex: "none" }}>{it.label}</span>
          <TickCrossButtons value={it.included} onChange={(v) => updateHosp(i, { included: v })} />
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
              <span className="rs-hosp-fixed-label" style={{ flex: "none" }}>Pàrquing</span>
              <TickCrossButtons value={it.parkingAvailable} onChange={(v) => updateHosp(i, { parkingAvailable: v })} />
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
              <span className="rs-hosp-fixed-label" style={{ flex: "none" }}>Esmorzar</span>
              <TickCrossButtons value={it.breakfastAvailable} onChange={(v) => updateHosp(i, { breakfastAvailable: v })} />
              {breakfastAvailable && <TimePairInput value={it.breakfastTime || ""} onChange={(v) => updateHosp(i, { breakfastTime: v })} />}
            </div>
          </>
        )}
      </div>
    );
  });

  // Cada secció és un desplegable amb la seva icona, el títol i quants camps
  // hi ha omplerts: es veu d'un cop d'ull què falta sense haver-ho d'obrir.
  // Per defecte s'obre la primera secció incompleta; la resta, plegades.
  const sections: { key: Section; title: string; stats: { filled: number; total: number }; body: React.ReactNode; addLabel: string }[] = [
    { key: "lloc", title: "Lloc", stats: sectionStats("lloc"), addLabel: "+ Afegeix camp",
      body: <div className="rs-repeater" data-rs-section="lloc">{fieldRows("lloc", rsf.lloc)}</div> },
    { key: "contacts", title: "Contactes", stats: sectionStats("contacts"), addLabel: "+ Afegeix contacte",
      body: <div className="rs-repeater" data-rs-section="contacts">{contactRows}</div> },
    { key: "schedule", title: "Horaris", stats: sectionStats("schedule"), addLabel: "+ Afegeix fase",
      body: (
        <>
          <div className="rs-phase-header rs-phase-header-inner">
            <span></span>
            <span className="rs-col-label">Fase</span>
            <span className="rs-col-label">Inici</span>
            <span className="rs-col-label">Fi</span>
            <span></span>
          </div>
          <div className="rs-repeater" data-rs-section="schedule">{phaseRows}</div>
        </>
      ) },
    { key: "hospitalitat", title: "Hospitalitat", stats: sectionStats("hospitalitat"), addLabel: "+ Afegeix camp",
      body: <div className="rs-repeater" data-rs-section="hospitalitat">{regularHospRows}{hotelBlock}</div> },
    { key: "tecnic", title: "Detalls tècnics", stats: sectionStats("tecnic"), addLabel: "+ Afegeix camp",
      body: <div className="rs-repeater" data-rs-section="tecnic">{fieldRows("tecnic", rsf.tecnic)}</div> },
  ];
  const allOpen = sections.every((s) => openSections[s.key]);

  return (
    <div style={{ position: "relative" }} className="rs-folds">
      {saving && <div className="cf-saving-indicator rs-saving-float">Desant…</div>}
      <div className="rs-folds-tools">
        <button type="button" className="link-btn" onClick={() => setOpenSections({ lloc: !allOpen, contacts: !allOpen, schedule: !allOpen, hospitalitat: !allOpen, tecnic: !allOpen })}>
          {allOpen ? "Plega-ho tot" : "Desplega-ho tot"}
        </button>
      </div>
      {sections.map((s) => {
        const open = !!openSections[s.key];
        const complete = s.stats.total > 0 && s.stats.filled >= s.stats.total;
        return (
          <div key={s.key} className={"rs-fold" + (open ? " open" : "") + (complete ? " done" : "")}>
            <button type="button" className="rs-fold-head" aria-expanded={open} onClick={() => setOpenSections((p) => ({ ...p, [s.key]: !p[s.key] }))}>
              <span className="rs-fold-icon"><SectionIcon title={s.title} /></span>
              <span className="rs-fold-title">{s.title}</span>
              <span className={"rs-fold-badge" + (complete ? " done" : "")}>{complete ? "✓ complet" : `${s.stats.filled}/${s.stats.total}`}</span>
              <span className="rs-fold-chevron" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>
              </span>
            </button>
            {open && (
              <div className="rs-fold-body">
                <div className="rs-fold-toolbar"><SectionDefaultBtn section={s.key} /></div>
                {s.body}
                <button type="button" className="rs-add-btn" onClick={() => addItem(s.key)}>{s.addLabel}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
