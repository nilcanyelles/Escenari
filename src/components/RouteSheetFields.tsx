"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Vehicle, Contact } from "@/lib/types";
import { RS_SECTION_ICONS, rsBlankItem, type RouteSheet, type LlocItem, type TecnicItem, type HospitalitatItem } from "@/lib/route-sheet";
import { resolvePlaceToVenueFields } from "@/components/VenueSearchField";
import ContactAutocomplete from "@/components/ContactAutocomplete";

export type RsSection = "lloc" | "contacts" | "schedule" | "hospitalitat" | "tecnic";
export type RsDragInfo = { section: RsSection; index: number };

// Estat compartit d'edició d'un full de ruta (afegir/eliminar/reordenar
// files, arrossegament) — el mateix per a RouteSheetEditor i
// PublicShareForm, perquè "afegeix una fila" o "arrossega per reordenar"
// es comporti exactament igual als dos llocs.
export function useRouteSheetOps(setRsf: (updater: (prev: RouteSheet) => RouteSheet) => void) {
  const [dragInfo, setDragInfo] = useState<RsDragInfo | null>(null);

  function updateSection<K extends RsSection>(section: K, updater: (items: RouteSheet[K]) => RouteSheet[K]) {
    setRsf((prev) => ({ ...prev, [section]: updater(prev[section]) }));
  }
  function addItem(section: RsSection) {
    setRsf((prev) => ({ ...prev, [section]: [...(prev[section] as unknown[]), rsBlankItem(section)] }));
  }
  function removeItem(section: RsSection, index: number) {
    setRsf((prev) => {
      const items = prev[section] as unknown[];
      // Camps com Allotjament/Pantalla LED/Número de vehicles/Backline es
      // tornarien a afegir sols en recarregar la pàgina si no es recorda que
      // s'han eliminat expressament — vegeu normalizeRouteSheet.
      const removedItem = items[index] as { label?: string; phase?: string };
      const label = (removedItem?.label || removedItem?.phase || "").trim();
      const removedDefaults = { ...(prev.removedDefaults || {}) };
      if (label) removedDefaults[section] = [...(removedDefaults[section] || []), label];
      return { ...prev, [section]: items.filter((_, i) => i !== index), removedDefaults };
    });
  }
  function reorder(section: RsSection, from: number, to: number) {
    setRsf((prev) => {
      const arr = (prev[section] as unknown[]).slice();
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return { ...prev, [section]: arr };
    });
  }
  function dragHandlers(section: RsSection, index: number) {
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
  return { updateSection, addItem, removeItem, reorder, dragHandlers };
}

// Peces compartides entre el full de ruta "normal" (RouteSheetEditor, dins
// la fitxa del concert) i el formulari públic de regidor (PublicShareForm)
// — perquè editar-ne una es reflecteixi automàticament a l'altra, tota la
// lògica de cada camp especial viu aquí, no duplicada als dos llocs.
// Cadascuna rep les seves pròpies accions de cerca/detall injectades
// (l'app fa servir les del gestor, requireManagerAction; el formulari
// públic, les seves pròpies, validades per l'enllaç compartit) — la resta
// de comportament és idèntic.

export type GeoResult = { description: string; placeId: string };
export type VenueResult = { description: string; name: string; city: string; street: string; housenumber: string; lat: number | null; lon: number | null; placeId: string };
export type PlaceDetails = { name: string; city: string; street: string; housenumber: string; lat: number | null; lon: number | null };
export type ReverseGeocodeFn = (lat: number, lon: number) => Promise<{ street: string; housenumber: string; city: string } | null>;

export function SectionIcon({ title, size = 15 }: { title: string; size?: number }) {
  const path = RS_SECTION_ICONS[title];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none" }} dangerouslySetInnerHTML={{ __html: path }} />
  );
}
export function XIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
}
export function WarnIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
}
export function ToggleIcon({ yes }: { yes: boolean }) {
  return yes ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  );
}
export function DragHandle({ onDragStart }: { onDragStart: () => void }) {
  return (
    <div className="rs-drag-handle" draggable title="Arrossega per reordenar" onDragStart={onDragStart}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>
    </div>
  );
}
export function TimePairInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="rs-time-pair">
      <input type="time" className="field-input rs-time-box" value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// Sí/No amb dos botonets separats (tick i creu) en comptes d'un sol
// interruptor — cap dels dos surt marcat fins que se'n cliqui un: mai
// activat o desactivat per defecte, sinó "encara per decidir".
export function TickCrossButtons({ value, onChange, locked }: { value: boolean | undefined; onChange: (v: boolean | undefined) => void; locked?: boolean }) {
  // Fixat i sense resposta (ni Sí ni No): un guionet en comptes de les
  // dues bombolles — quan n'hi ha una resposta, l'altra ja la fa
  // desaparèixer .pf-locked-body per CSS (només queda la triada).
  if (locked && value === undefined) return <span className="rs-locked-dash">—</span>;
  return (
    <div className="rs-tick-cross">
      <button type="button" className={"rs-tick-cross-btn yes" + (value === true ? " active" : "")} title="Sí" onClick={() => onChange(value === true ? undefined : true)}>
        <ToggleIcon yes={true} />
      </button>
      <button type="button" className={"rs-tick-cross-btn no" + (value === false ? " active" : "")} title="No" onClick={() => onChange(value === false ? undefined : false)}>
        <ToggleIcon yes={false} />
      </button>
    </div>
  );
}

// Estat d'aprovació del contrarider: un botó que fa cicle entre les 3
// opcions a cada clic — sense estat inicial (abans del primer clic, "Sense
// revisar"), mai ja aprovat o similar per defecte.
export const CONTRA_STATUS_CYCLE = ["aprovat", "no-rebut", "esperant-canvis"] as const;
export const CONTRA_STATUS_LABELS: Record<string, string> = { aprovat: "Aprovat", "no-rebut": "No rebut", "esperant-canvis": "Esperant canvis" };
export function nextContraStatus(cur?: string): typeof CONTRA_STATUS_CYCLE[number] {
  const idx = CONTRA_STATUS_CYCLE.indexOf(cur as typeof CONTRA_STATUS_CYCLE[number]);
  return CONTRA_STATUS_CYCLE[(idx + 1) % CONTRA_STATUS_CYCLE.length];
}

// Botó "+ Vehicle": el desplegable es penja de <body> via portal, amb la
// posició calculada del propi botó — dins d'una secció plegable (que
// arrodoneix les cantonades amb overflow:hidden) quedava atrapat i sortia
// per sota de la fila següent.
export function VehiclePickerButton({ vehicles, selectedPlates, onToggle }: {
  vehicles: Vehicle[];
  selectedPlates: string[];
  onToggle: (plate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function openPicker() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
    setOpen(true);
  }

  const registered = vehicles.filter((v) => v.plate);

  return (
    <>
      <button ref={btnRef} type="button" className="rs-vehicle-add-btn" title="Afegeix un vehicle" onClick={openPicker}>
        + Vehicle
      </button>
      {open && mounted && pos && createPortal(
        <>
          <div className="year-picker-overlay" onClick={() => setOpen(false)}></div>
          <div className="year-dropdown cf-band-dropdown rs-vehicle-dropdown-panel" style={{ position: "fixed", top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}>
            {registered.length === 0 ? (
              <div className="cf-band-noresults">El grup no té cap vehicle registrat</div>
            ) : registered.map((v) => {
              const selected = selectedPlates.includes(v.plate);
              const label = [[v.type, v.brand, v.color].filter(Boolean).join(" "), v.owner, v.plate].filter(Boolean).join(" · ");
              return (
                <button key={v.plate} type="button" className={"rs-vehicle-chip" + (selected ? " active" : "")}
                  onClick={() => onToggle(v.plate)}
                >{label}</button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// Selecció de vehicles ja marcats (matrícules separades per comes) + botó
// per afegir-ne més — compartit entre "Número de vehicles" i el pàrquing
// de l'allotjament.
// readOnly (nomes el formulari públic de regidor): mostra les matrícules
// ja triades des del formulari normal, però sense poder-les treure ni
// afegir-ne — triar quins vehicles hi van és cosa de l'agència, no de qui
// omple el formulari des de fora.
export function VehicleChips({ vehicles, plates, onChange, readOnly }: { vehicles: Vehicle[]; plates: string; onChange: (plates: string) => void; readOnly?: boolean }) {
  const currentPlates = (plates || "").split(",").map((p) => p.trim()).filter(Boolean);
  const selectedVehicles = currentPlates.map((plate) => vehicles.find((v) => v.plate === plate)).filter((v): v is Vehicle => !!v);
  function toggle(plate: string) {
    const set = new Set(currentPlates);
    if (set.has(plate)) set.delete(plate); else set.add(plate);
    onChange(Array.from(set).join(", "));
  }
  return (
    <>
      {selectedVehicles.map((v) => (
        <span key={v.plate} className="rs-vehicle-chip active">
          {readOnly ? v.plate : [[v.type, v.brand, v.color].filter(Boolean).join(" "), v.plate].filter(Boolean).join(" · ")}
          {!readOnly && <button type="button" className="rs-vehicle-chip-remove" title="Treu aquest vehicle" onClick={() => toggle(v.plate)}><XIcon /></button>}
        </span>
      ))}
      {!readOnly && <VehiclePickerButton vehicles={vehicles} selectedPlates={currentPlates} onToggle={toggle} />}
    </>
  );
}

// Cerca de "Recinte" (Google Places) — mateixa cerca que "Ubicació / sala"
// d'Informació general, aquí incrustada a la fila de Lloc.
export function RecinteSearchField({ venue, onVenueCityChange, searchAction, detailsAction }: {
  venue: string;
  onVenueCityChange: (v: { name: string; city?: string; street?: string; housenumber?: string }) => void;
  searchAction: (query: string) => Promise<GeoResult[]>;
  detailsAction: (placeId: string) => Promise<PlaceDetails | null>;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const q = search.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timer.current = window.setTimeout(async () => {
      const r = await searchAction(q);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [search, searchAction]);

  async function selectVenue(placeId: string) {
    setResolving(placeId);
    const details = await detailsAction(placeId);
    setResolving(null);
    setDropdownOpen(false);
    if (!details) return;
    onVenueCityChange(details);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        className="field-input" type="text" autoComplete="off" placeholder="Cerca un recinte…"
        value={dropdownOpen ? search : venue}
        onFocus={() => { setSearch(venue); setDropdownOpen(true); }}
        onChange={(e) => setSearch(e.target.value)}
      />
      {dropdownOpen && (
        <>
          <div className="year-picker-overlay" onClick={() => { if (!search.trim() && venue) onVenueCityChange({ name: "" }); setDropdownOpen(false); }}></div>
          <div className="year-dropdown cf-band-dropdown" onClick={(e) => e.stopPropagation()}>
            {search.trim().length < 2 ? (
              <div className="cf-band-noresults">Escriu almenys 2 lletres… (o deixa-ho buit i tanca per esborrar)</div>
            ) : searching ? (
              <div className="cf-band-noresults">Cercant…</div>
            ) : results.length ? results.map((v) => (
              <button key={v.placeId} type="button" className="year-option" disabled={resolving === v.placeId}
                onClick={() => selectVenue(v.placeId)}>{resolving === v.placeId ? "Carregant…" : v.description}</button>
            )) : <div className="cf-band-noresults">Cap recinte coincideix</div>}
          </div>
        </>
      )}
    </div>
  );
}

// Cerca d'"Adreça" (Photon) — ajuda per validar, no substitueix el text
// lliure (mai obliga a triar-ne un resultat).
export function AdreçaSearchField({ address, onAddressChange, searchAction }: {
  address: string;
  onAddressChange: (v: string) => void;
  searchAction: (query: string) => Promise<VenueResult[]>;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<VenueResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const q = search.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timer.current = window.setTimeout(async () => {
      const r = await searchAction(q);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [search, searchAction]);

  return (
    <div style={{ position: "relative" }}>
      <input
        className="field-input" type="text" autoComplete="off" placeholder="Adreça" value={address}
        onFocus={() => { setSearch(address); setDropdownOpen(true); }}
        onChange={(e) => {
          const val = e.target.value;
          setSearch(val);
          onAddressChange(val);
        }}
      />
      {dropdownOpen && search.trim().length >= 2 && (
        <>
          <div className="year-picker-overlay" onClick={() => setDropdownOpen(false)}></div>
          <div className="year-dropdown cf-band-dropdown" onClick={(e) => e.stopPropagation()}>
            {searching ? (
              <div className="cf-band-noresults">Cercant…</div>
            ) : results.length ? results.map((v) => (
              <button key={v.placeId} type="button" className="year-option"
                onClick={() => {
                  onAddressChange(v.description);
                  setDropdownOpen(false);
                }}>{v.description}</button>
            )) : <div className="cf-band-noresults">Cap resultat</div>}
          </div>
        </>
      )}
    </div>
  );
}

// Bloc sencer de l'Allotjament dins Hospitalitat: cerca/autoemplenat
// d'hotel, telèfon, enllaç de Google Maps, check-in/out i pàrquing +
// esmorzar amb els seus propis tick/creu.
// "A càrrec de: Grup/Promotor" — qui gestiona l'allotjament. Compartit
// (formulari normal i de regidor); el que canvia és què es pot veure/tocar
// segons qui hi és a càrrec, no el propi interruptor.
function ArrangedByToggle({ value, onChange, locked }: { value: "grup" | "promotor" | undefined; onChange: (v: "grup" | "promotor") => void; locked?: boolean }) {
  if (locked && !value) return <span className="rs-locked-dash">—</span>;
  return (
    <div className="rs-arranged-toggle">
      <button type="button" className={"rs-arranged-btn" + (value === "grup" ? " active" : "")} onClick={() => onChange("grup")}>Grup</button>
      <button type="button" className={"rs-arranged-btn" + (value === "promotor" ? " active" : "")} onClick={() => onChange("promotor")}>Promotor</button>
    </div>
  );
}

export function HotelBlock({ item, vehicles, onUpdate, searchAction, detailsAction, reverseGeocodeAction, showParking = true, parkingVehiclesEditable = true, restrictToNameForGroup = false, phoneNextToAddress = false, locked = false }: {
  item: HospitalitatItem;
  vehicles: Vehicle[];
  onUpdate: (patch: Partial<HospitalitatItem>) => void;
  searchAction: (query: string) => Promise<GeoResult[]>;
  detailsAction: (placeId: string) => Promise<PlaceDetails | null>;
  reverseGeocodeAction: ReverseGeocodeFn;
  showParking?: boolean;
  // false només al formulari públic de regidor — es veu si hi ha
  // pàrquing (Sí/No), però no quins vehicles concrets hi van ni es pot
  // triar-los (mateix criteri que "Número de vehicles" a la secció Lloc).
  parkingVehiclesEditable?: boolean;
  // true només al formulari públic de regidor — quan és el grup qui té
  // l'allotjament a càrrec seu, el regidor només en veu el nom (sense
  // poder-lo editar ni veure telèfon/adreça/check-in-out/esmorzar).
  restrictToNameForGroup?: boolean;
  // true només al formulari públic de regidor — el telèfon es mou al
  // costat de l'adreça (en comptes d'al costat del nom), i l'adreça hi
  // guanya més amplada perquè es vegi sencera.
  phoneNextToAddress?: boolean;
  // true només al formulari públic de regidor, quan la secció s'ha
  // fixat — les opcions (Sí/No, Grup/Promotor) sense resposta mostren un
  // guionet.
  locked?: boolean;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  // Avís que l'adreça de "Enllaç Google Maps" s'ha omplert sola (no ve del
  // buscador de Google el número de pis/porta, així que val la pena que
  // l'usuari la revisi) — desapareix en el moment que s'edita a mà.
  const [addressAutofilled, setAddressAutofilled] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const q = search.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timer.current = window.setTimeout(async () => {
      const r = await searchAction(q);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [search, searchAction]);

  async function selectHotel(placeId: string, description: string) {
    setResolving(placeId);
    const details = await detailsAction(placeId);
    setResolving(null);
    setDropdownOpen(false);
    if (!details) { onUpdate({ value: description }); return; }
    const resolved = await resolvePlaceToVenueFields(details, reverseGeocodeAction);
    onUpdate({ value: resolved.venue || description, location: resolved.address || "" });
    if (resolved.address) setAddressAutofilled(true);
  }

  const included = item.included === true;
  const breakfastAvailable = item.breakfastAvailable === true;
  // Al formulari de regidor, quan el grup té l'allotjament a càrrec seu
  // (no el promotor), el regidor només en veu el nom — no telèfon, adreça,
  // check-in/out ni esmorzar, i tampoc el pot canviar.
  const restricted = restrictToNameForGroup && item.arrangedBy === "grup";

  return (
    <div className="rs-hotel-subgroup">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="rs-hosp-fixed-label" style={{ flex: "none" }}>{item.label}</span>
        <TickCrossButtons value={item.included} onChange={(v) => onUpdate({ included: v })} locked={locked} />
        {restricted ? (
          <div className="field-input" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>{item.value || "—"}</div>
        ) : (
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <input
              className="field-input" style={{ width: "100%" }} type="text" autoComplete="off" placeholder="Cerca un allotjament…"
              value={dropdownOpen ? search : item.value}
              onFocus={() => { setSearch(item.value); setDropdownOpen(true); }}
              onChange={(e) => setSearch(e.target.value)}
            />
            {dropdownOpen && (
              <>
                <div className="year-picker-overlay" onClick={() => { if (!search.trim() && item.value) onUpdate({ value: "" }); setDropdownOpen(false); }}></div>
                <div className="year-dropdown cf-band-dropdown" onClick={(e) => e.stopPropagation()}>
                  {search.trim().length < 2 ? (
                    <div className="cf-band-noresults">Escriu almenys 2 lletres… (o deixa-ho buit i tanca per esborrar)</div>
                  ) : searching ? (
                    <div className="cf-band-noresults">Cercant…</div>
                  ) : results.length ? results.map((v) => (
                    <button key={v.placeId} type="button" className="year-option" disabled={resolving === v.placeId}
                      onClick={() => selectHotel(v.placeId, v.description)}>{resolving === v.placeId ? "Carregant…" : v.description}</button>
                  )) : <div className="cf-band-noresults">Cap resultat</div>}
                </div>
              </>
            )}
          </div>
        )}
        {included && !restricted && !phoneNextToAddress && (
          <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Telèfon de l'allotjament" value={item.phone || ""}
            onChange={(e) => onUpdate({ phone: e.target.value })} />
        )}
      </div>
      {included && (
        <>
          <div className="rs-hotel-parking-row">
            <span className="rs-hosp-fixed-label" style={{ flex: "none" }}>A càrrec de</span>
            <ArrangedByToggle value={item.arrangedBy} onChange={(v) => onUpdate({ arrangedBy: v })} locked={locked} />
          </div>
          {!restricted && (
            <>
              <div className="rs-hotel-subgroup-row">
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: phoneNextToAddress ? 2 : 1 }}>
                  <input className="field-input" type="text" placeholder="Enllaç Google Maps" value={item.location || ""}
                    onChange={(e) => { onUpdate({ location: e.target.value }); setAddressAutofilled(false); }} />
                  {addressAutofilled && (
                    <div className="rs-autofill-note"><WarnIcon />Adreça generada automàticament, comprova que sigui correcta</div>
                  )}
                </div>
                {phoneNextToAddress ? (
                  <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Telèfon de l'allotjament" value={item.phone || ""}
                    onChange={(e) => onUpdate({ phone: e.target.value })} />
                ) : (
                  <div className="rs-hotel-specs-row" style={{ margin: 0 }}>
                    <div className="rs-hotel-checkinout-item">
                      <span className="rs-col-label" style={{ textAlign: "left" }}>Check-in</span>
                      <TimePairInput value={item.checkIn || ""} onChange={(v) => onUpdate({ checkIn: v })} />
                    </div>
                    <div className="rs-hotel-checkinout-item">
                      <span className="rs-col-label" style={{ textAlign: "left" }}>Check-out</span>
                      <TimePairInput value={item.checkOut || ""} onChange={(v) => onUpdate({ checkOut: v })} />
                    </div>
                  </div>
                )}
              </div>
              {phoneNextToAddress && (
                <div className="rs-hotel-specs-row">
                  <div className="rs-hotel-checkinout-item">
                    <span className="rs-col-label" style={{ textAlign: "left" }}>Check-in</span>
                    <TimePairInput value={item.checkIn || ""} onChange={(v) => onUpdate({ checkIn: v })} />
                  </div>
                  <div className="rs-hotel-checkinout-item">
                    <span className="rs-col-label" style={{ textAlign: "left" }}>Check-out</span>
                    <TimePairInput value={item.checkOut || ""} onChange={(v) => onUpdate({ checkOut: v })} />
                  </div>
                </div>
              )}
              {showParking && (
                <div className="rs-hotel-parking-row">
                  <span className="rs-hosp-fixed-label" style={{ flex: "none" }}>Pàrquing</span>
                  <TickCrossButtons value={item.parkingAvailable} onChange={(v) => onUpdate({ parkingAvailable: v })} locked={locked} />
                  <VehicleChips vehicles={vehicles} plates={item.parkingPlates || ""} onChange={(plates) => onUpdate({ parkingPlates: plates })} readOnly={!parkingVehiclesEditable} />
                </div>
              )}
              <div className="rs-hotel-parking-row">
                <span className="rs-hosp-fixed-label" style={{ flex: "none" }}>Esmorzar</span>
                <TickCrossButtons value={item.breakfastAvailable} onChange={(v) => onUpdate({ breakfastAvailable: v })} locked={locked} />
                {breakfastAvailable && <TimePairInput value={item.breakfastTime || ""} onChange={(v) => onUpdate({ breakfastTime: v })} />}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

type FieldRowContext = {
  venue: string;
  onVenueCityChange: (v: { name: string; city?: string; street?: string; housenumber?: string }) => void;
  address: string;
  onAddressChange: (v: string) => void;
  vehicles: Vehicle[];
  // false només al formulari públic de regidor — hi veu les matrícules ja
  // triades des del formulari normal, però no en pot triar ni treure cap.
  vehiclesEditable?: boolean;
  // false només al formulari públic de regidor — l'estat i les notes del
  // "Contra rider" només els pot canviar l'agència; el promotor només hi
  // penja el document (vegeu el botó "Contra rider" a PublicShareForm).
  contraRiderEditable?: boolean;
  // true només al formulari públic de regidor, quan la secció s'ha fixat
  // — les opcions (Sí/No) sense resposta mostren un guionet.
  locked?: boolean;
  venueSearchAction: (query: string) => Promise<GeoResult[]>;
  venueDetailsAction: (placeId: string) => Promise<PlaceDetails | null>;
  addressSearchAction: (query: string) => Promise<VenueResult[]>;
};

// Una fila de Lloc/Detalls tècnics — la mateixa lògica (Recinte i Adreça
// amb cerca en directe, Número de vehicles amb el picker, Descàrrega/
// Parking amb enllaç de Maps a part, Pantalla LED i Contra rider amb els
// seus controls propis) tant a RouteSheetEditor com a PublicShareForm.
export function FieldRow({ section, item, ctx, onChange, onRemove, dragProps }: {
  section: "lloc" | "tecnic";
  item: LlocItem | TecnicItem;
  ctx: FieldRowContext;
  onChange: (patch: Partial<LlocItem & TecnicItem>) => void;
  onRemove: () => void;
  dragProps: { onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragEnd: () => void };
}) {
  const isPantallaLed = section === "tecnic" && item.label && item.label.trim().toLowerCase() === "pantalla led";
  const isContrarider = section === "tecnic" && item.label && item.label.trim().toLowerCase() === "contra rider";
  // El camp "Recinte" és el mateix que "Ubicació / sala" a Informació — no
  // un camp de text lliure com la resta, sinó la mateixa cerca de
  // recintes, en aquesta mateixa fila (no se n'afegeix cap de nova).
  const isRecinte = section === "lloc" && item.label && item.label.trim().toLowerCase() === "recinte";
  const isAdreça = section === "lloc" && item.label && item.label.trim().toLowerCase() === "adreça";
  const isVehicleCount = section === "lloc" && item.label && item.label.trim().toLowerCase() === "número de vehicles";
  // Descàrrega/Parking: detalls de text lliure + enllaç de Google Maps, en
  // dues caselles separades (abans era un sol camp fent totes dues).
  const isLinkField = section === "lloc" && item.label && ["descàrrega", "parking"].includes(item.label.trim().toLowerCase());
  return (
    <div className="rs-field-row" {...dragProps}>
      <DragHandle onDragStart={dragProps.onDragStart} />
      {isPantallaLed ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Camp" value={item.label}
            onChange={(e) => onChange({ label: e.target.value })} />
          <TickCrossButtons value={(item as TecnicItem).included} onChange={(v) => onChange({ included: v })} locked={ctx.locked} />
        </div>
      ) : (
        <input className="field-input" type="text" placeholder="Camp (p.ex. Adreça)" value={item.label}
          onChange={(e) => onChange({ label: e.target.value })} />
      )}
      {isPantallaLed ? (
        <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Mida (p.ex. 3x2m)" value={item.value}
          onChange={(e) => onChange({ value: e.target.value })} />
      ) : isContrarider ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          {ctx.contraRiderEditable === false ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span className={"rs-status-btn" + ((item as TecnicItem).status ? " rs-status-" + (item as TecnicItem).status : "")} title="Només l'agència pot canviar l'estat">
                {(item as TecnicItem).status ? CONTRA_STATUS_LABELS[(item as TecnicItem).status as string] : "Sense revisar"}
              </span>
              <div className="field-input" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", color: "var(--text-faint)" }}>{item.value || "—"}</div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <button type="button"
                className={"rs-status-btn" + ((item as TecnicItem).status ? " rs-status-" + (item as TecnicItem).status : "")}
                title="Clica per canviar l'estat"
                onClick={() => onChange({ status: nextContraStatus((item as TecnicItem).status) })}>
                {(item as TecnicItem).status ? CONTRA_STATUS_LABELS[(item as TecnicItem).status as string] : "Sense revisar"}
              </button>
              <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Notes" value={item.value}
                onChange={(e) => onChange({ value: e.target.value })} />
            </div>
          )}
          {/* Document de contrarider penjat des del formulari públic de
              regidor — al normal es pot obrir (hi ha sessió), al de
              regidor és només informatiu (no hi tindria accés). */}
          {(item as TecnicItem).counterFileName && (
            ctx.contraRiderEditable === false ? (
              <span className="rs-counter-file-badge">📎 {(item as TecnicItem).counterFileName}</span>
            ) : (
              <a className="rs-counter-file-badge" href={(item as TecnicItem).counterFileUrl} target="_blank" rel="noreferrer">📎 {(item as TecnicItem).counterFileName}</a>
            )
          )}
        </div>
      ) : isVehicleCount ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
          <input
            className="field-input rs-vehicle-count-input" type="number" min={0} placeholder="N."
            title="Quants vehicles calen (normalment entre 1 i 5)"
            value={item.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
          <VehicleChips vehicles={ctx.vehicles} plates={(item as LlocItem).plates || ""} onChange={(plates) => onChange({ plates })} readOnly={ctx.vehiclesEditable === false} />
        </div>
      ) : isRecinte ? (
        <RecinteSearchField venue={ctx.venue} onVenueCityChange={ctx.onVenueCityChange} searchAction={ctx.venueSearchAction} detailsAction={ctx.venueDetailsAction} />
      ) : isAdreça ? (
        <AdreçaSearchField address={ctx.address} onAddressChange={ctx.onAddressChange} searchAction={ctx.addressSearchAction} />
      ) : isLinkField ? (
        <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
          <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Detalls" value={item.value}
            onChange={(e) => onChange({ value: e.target.value })} />
          <input className="field-input" style={{ flex: 1, minWidth: 0 }} type="text" placeholder="Enllaç Google Maps" value={(item as LlocItem).link || ""}
            onChange={(e) => onChange({ link: e.target.value })} />
        </div>
      ) : (
        <input className="field-input" type="text" value={item.value}
          onChange={(e) => onChange({ value: e.target.value })} />
      )}
      <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={onRemove}><XIcon /></button>
    </div>
  );
}

// Una fila de Contactes — càrrec, nom (amb suggeriments si es passen
// contactes ja desats — el formulari públic hi passa sempre una llista
// buida, perquè qui l'omple des de fora no en veu ni en tria cap: seria
// una fuita de dades), empresa i telèfon.
export function ContactRow({ item, contacts, onChange, onRemove, dragProps }: {
  item: { role: string; name: string; phone: string; company: string };
  contacts: Contact[];
  onChange: (patch: Partial<{ role: string; name: string; phone: string; company: string }>) => void;
  onRemove?: () => void;
  dragProps?: { onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragEnd: () => void };
}) {
  return (
    <div className="rs-contact-row" {...dragProps}>
      {dragProps && <DragHandle onDragStart={dragProps.onDragStart} />}
      <input className="field-input" type="text" placeholder="Càrrec" value={item.role} onChange={(e) => onChange({ role: e.target.value })} />
      <ContactAutocomplete className="field-input" placeholder="Nom" value={item.name} contacts={contacts}
        onNameChange={(v) => onChange({ name: v })}
        onPick={(c) => onChange({ name: c.name, role: c.role || item.role, phone: c.phone, company: c.company })} />
      <input className="field-input" type="text" placeholder="Empresa" value={item.company} onChange={(e) => onChange({ company: e.target.value })} />
      <input className="field-input" type="text" placeholder="Telèfon" value={item.phone} onChange={(e) => onChange({ phone: e.target.value })} />
      {onRemove && <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={onRemove}><XIcon /></button>}
    </div>
  );
}

// Una fila d'Horaris — la fase "Concert" es lliga a l'hora exacta
// d'Informació general (exactTime/onExactTimeChange), mai un valor propi.
export function PhaseRow({ item, exactTime, onExactTimeChange, onChange, onRemove, dragProps }: {
  item: { phase: string; start: string; end: string };
  exactTime: string;
  onExactTimeChange: (v: string) => void;
  onChange: (patch: Partial<{ phase: string; start: string; end: string }>) => void;
  onRemove?: () => void;
  dragProps?: { onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragEnd: () => void };
}) {
  const isConcertPhase = item.phase && item.phase.trim().toLowerCase() === "concert";
  return (
    <div className="rs-phase-row" {...dragProps}>
      {dragProps && <DragHandle onDragStart={dragProps.onDragStart} />}
      <input className="field-input" type="text" placeholder="Fase" value={item.phase} onChange={(e) => onChange({ phase: e.target.value })} />
      {isConcertPhase ? (
        <TimePairInput value={exactTime} onChange={onExactTimeChange} />
      ) : (
        <TimePairInput value={item.start} onChange={(v) => onChange({ start: v })} />
      )}
      <TimePairInput value={item.end} onChange={(v) => onChange({ end: v })} />
      {onRemove && <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={onRemove}><XIcon /></button>}
    </div>
  );
}

const FIXED_HOSP_TOGGLE_LABELS = ["dietes", "catering", "camerino"];

// Una fila d'Hospitalitat (que no sigui Allotjament, que té el seu propi
// HotelBlock) — Dietes/Catering/Camerino amb etiqueta fixa, la resta amb
// etiqueta editable, totes amb el mateix tick/creu + detalls opcionals.
export function HospRow({ item, onChange, onRemove, dragProps, locked }: {
  item: HospitalitatItem;
  onChange: (patch: Partial<HospitalitatItem>) => void;
  onRemove: () => void;
  dragProps: { onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void; onDragEnd: () => void };
  locked?: boolean;
}) {
  const isFixedToggle = item.label && FIXED_HOSP_TOGGLE_LABELS.indexOf(item.label.trim().toLowerCase()) !== -1;
  return (
    <div className="rs-field-row" {...dragProps}>
      <DragHandle onDragStart={dragProps.onDragStart} />
      <div className="rs-hosp-label-cell">
        {isFixedToggle ? (
          <span className="rs-hosp-fixed-label">{item.label}</span>
        ) : (
          <input className="field-input" type="text" placeholder="Camp (p.ex. Dietes)" value={item.label} onChange={(e) => onChange({ label: e.target.value })} />
        )}
        <TickCrossButtons value={item.included} onChange={(v) => onChange({ included: v })} locked={locked} />
      </div>
      <input className="field-input" type="text" placeholder="Detalls (opcional)" value={item.value} onChange={(e) => onChange({ value: e.target.value })} />
      <button type="button" className="rs-mini-btn danger" title="Elimina" onClick={onRemove}><XIcon /></button>
    </div>
  );
}
