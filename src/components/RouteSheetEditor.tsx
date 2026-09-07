"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Concert, Vehicle, Contact } from "@/lib/types";
import {
  type RouteSheet, type HospitalitatItem, type RouteSheetDefaults,
  normalizeRouteSheet, rsIsComplete, rsCompletionPercent, stripSectionForDefault,
} from "@/lib/route-sheet";
import { saveRouteSheetAction, searchVenuesAction, searchVenuesGoogleAction, getPlaceDetailsAction, reverseGeocodeAction } from "@/app/(app)/concerts/actions";
import { saveDefaultRouteSheetSectionAction } from "@/app/(app)/grup/actions";
import {
  type RsSection, useRouteSheetOps, SectionIcon, FieldRow, ContactRow, PhaseRow, HospRow, HotelBlock,
} from "@/components/RouteSheetFields";

type Section = RsSection;

export default function RouteSheetEditor({ concert, venue, city, onVenueCityChange, address, onAddressChange, exactTime, onExactTimeChange, vehicles = [], bandDefaultRouteSheet = null, contacts = [], onCompleteChange, onPercentChange, onRouteSheetChange, onSaved }: {
  concert: Concert;
  vehicles?: Vehicle[];
  // Contactes ja desats a l'agència (de qualsevol esdeveniment), per
  // suggerir-los en escriure el "Nom" d'un contacte del full de ruta.
  contacts?: Contact[];
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
  // L'"Adreça" d'aquí i la d'Informació general són, de la mateixa manera,
  // un únic camp compartit — mai un text lliure propi del full de ruta.
  address: string;
  onAddressChange: (v: string) => void;
  // L'hora d'inici de la fase "Concert" dels horaris és la mateixa "Hora
  // exacta" d'Informació general — mai un valor propi del full de ruta.
  exactTime: string;
  onExactTimeChange: (v: string) => void;
  onCompleteChange?: (complete: boolean) => void;
  onPercentChange?: (percent: number) => void;
  onRouteSheetChange?: (rs: RouteSheet) => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [rsf, setRsf] = useState<RouteSheet>(() => normalizeRouteSheet(concert.routeSheet as RouteSheet | null, concert, bandDefaultRouteSheet));
  const { updateSection, addItem, removeItem, dragHandlers } = useRouteSheetOps(setRsf);
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
    // "Adreça" i la fase "Concert" són camps compartits amb Informació
    // general (vegeu més avall) — es comprova sempre el valor en directe,
    // mai el que hi hagués desat abans de vincular-los.
    if (section === "lloc") rsf.lloc.forEach((it) => {
      const isAdreça = it.label && it.label.trim().toLowerCase() === "adreça";
      check(isAdreça ? address : it.value);
    });
    else if (section === "contacts") rsf.contacts.forEach((it) => {
      total++;
      if (it.role.trim() && it.name.trim() && it.phone.trim() && it.company.trim()) filled++;
    });
    else if (section === "schedule") rsf.schedule.forEach((it) => {
      const isConcertPhase = it.phase && it.phase.trim().toLowerCase() === "concert";
      const start = isConcertPhase ? exactTime : it.start;
      total++;
      if (start.trim() || it.end.trim()) filled++;
    });
    else if (section === "hospitalitat") rsf.hospitalitat.forEach((it) => {
      total++;
      if ((it.value && it.value.trim()) || it.included !== undefined) filled++;
    });
    else rsf.tecnic.forEach((it) => {
      const label = it.label && it.label.trim().toLowerCase();
      total++;
      if (label === "pantalla led") { if (it.included !== undefined) filled++; return; }
      if ((it.value && it.value.trim()) || (label === "contra rider" && it.status === "aprovat")) filled++;
    });
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

  function updateHosp(i: number, patch: Partial<HospitalitatItem>) {
    updateSection("hospitalitat", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x));
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
  // El pare en fa servir una còpia (per exemple per a la barra de progrés
  // del bànner) que, sense això, només s'actualitzava en refer la pàgina.
  useEffect(() => { onRouteSheetChange?.(rsf); }, [rsf, onRouteSheetChange]);

  const fieldRowCtx = {
    venue, onVenueCityChange, address, onAddressChange, vehicles,
    venueSearchAction: searchVenuesGoogleAction, venueDetailsAction: getPlaceDetailsAction, addressSearchAction: searchVenuesAction,
  };
  function fieldRows(section: "lloc" | "tecnic", items: RouteSheet["lloc"] | RouteSheet["tecnic"]) {
    return items.map((it, i) => (
      <FieldRow
        key={i} section={section} item={it} ctx={fieldRowCtx}
        onChange={(patch) => updateSection(section, (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x) as never)}
        onRemove={() => removeItem(section, i)}
        dragProps={dragHandlers(section, i)}
      />
    ));
  }

  // ---- Contacts ----
  const contactRows = rsf.contacts.map((ct, i) => (
    <ContactRow
      key={i} item={ct} contacts={contacts}
      onChange={(patch) => updateSection("contacts", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x))}
      onRemove={() => removeItem("contacts", i)}
      dragProps={dragHandlers("contacts", i)}
    />
  ));

  // ---- Schedule ----
  const phaseRows = rsf.schedule.map((ph, i) => (
    <PhaseRow
      key={i} item={ph} exactTime={exactTime} onExactTimeChange={onExactTimeChange}
      onChange={(patch) => updateSection("schedule", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x))}
      onRemove={() => removeItem("schedule", i)}
      dragProps={dragHandlers("schedule", i)}
    />
  ));

  // ---- Hospitalitat ----
  let hotelBlock: React.ReactNode = null;
  const regularHospRows: React.ReactNode[] = [];
  rsf.hospitalitat.forEach((it, i) => {
    const isHotel = it.label && it.label.trim().toLowerCase() === "allotjament";
    if (!isHotel) {
      regularHospRows.push(
        <HospRow
          key={i} item={it}
          onChange={(patch) => updateHosp(i, patch)}
          onRemove={() => removeItem("hospitalitat", i)}
          dragProps={dragHandlers("hospitalitat", i)}
        />
      );
      return;
    }
    hotelBlock = (
      <HotelBlock
        key={i} item={it} vehicles={vehicles} onUpdate={(patch) => updateHosp(i, patch)}
        searchAction={searchVenuesGoogleAction} detailsAction={getPlaceDetailsAction}
        reverseGeocodeAction={reverseGeocodeAction}
      />
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
  const sectionOrder: Section[] = ["lloc", "contacts", "schedule", "hospitalitat", "tecnic"];
  // "Desa" d'una secció: com que tot ja es desa sol en editar qualsevol
  // camp, aquest botó no fa cap desada extra — plega la secció actual i
  // desplega la següent, perquè avançar pel full de ruta no calgui fer-ho
  // manualment secció a secció.
  function goToNextSection(key: Section) {
    const next = sectionOrder[sectionOrder.indexOf(key) + 1];
    setOpenSections((p) => {
      const out = { ...p, [key]: false };
      if (next) out[next] = true;
      return out;
    });
  }

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
            <div
              className="rs-fold-head" role="button" tabIndex={0} aria-expanded={open}
              onClick={() => setOpenSections((p) => ({ ...p, [s.key]: !p[s.key] }))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenSections((p) => ({ ...p, [s.key]: !p[s.key] })); } }}
            >
              <span className="rs-fold-icon"><SectionIcon title={s.title} /></span>
              <span className="rs-fold-title">{s.title}</span>
              <span className={"rs-fold-badge" + (complete ? " done" : "")}>{complete ? "✓ complet" : `${s.stats.filled}/${s.stats.total}`}</span>
              <button type="button" className="rs-fold-save-btn" onClick={(e) => { e.stopPropagation(); goToNextSection(s.key); }}>Desa</button>
              <span className="rs-fold-chevron" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>
              </span>
            </div>
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
