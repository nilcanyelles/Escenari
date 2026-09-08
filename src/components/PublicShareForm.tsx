"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Vehicle, Contact } from "@/lib/types";
import { rsItemHasContent, type RouteSheet } from "@/lib/route-sheet";
import { formatDateFull, capitalize, today } from "@/lib/format";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  submitShareFormAction, searchVenuesGooglePublicAction, getPlaceDetailsPublicAction,
  searchVenuesPublicAction, reverseGeocodePublicAction, type ShareInfoPayload,
} from "@/app/f/actions";
import {
  type RsSection, useRouteSheetOps, SectionIcon, WarnIcon, XIcon, FieldRow, ContactRow, PhaseRow, HospRow, HotelBlock,
} from "@/components/RouteSheetFields";
import { searchContactsPublicAction, createContactPublicAction } from "@/app/f/contact-actions";
import VenueSearchField from "@/components/VenueSearchField";
import InlineDatePicker from "@/components/InlineDatePicker";
import TimePeriodBubble from "@/components/TimePeriodBubble";

function RiderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>
  );
}
function PaperclipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
    </svg>
  );
}
function PencilIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>;
}
function CheckIcon({ size = 13 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
}
function LockIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
}
function ChevronLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>;
}
function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>;
}

type ConcertLite = {
  id: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  festaEntitat: string;
  bandName: string;
  kind: "bolo" | "assaig" | "reunio" | "altre";
  canAnnounce: "" | "yes" | "no";
  announceAfter: string;
  ticketType: "" | "gratuit" | "pagament";
  address: string;
  exactTime: string;
};

// Cap llista local de contactes: al formulari públic la cerca va per
// l'enllaç (searchContactsPublicAction), que només arriba als contactes del
// full de ruta i sense dades sensibles — vegeu f/contact-actions.ts.
const NO_CONTACTS: Contact[] = [];

type Section = "info" | RsSection;

// Una pàgina per secció, en aquest ordre. "icon" és la clau de
// RS_SECTION_ICONS (vegeu SectionIcon), que no sempre coincideix amb el
// títol que es mostra.
const ALL_SECTIONS: Section[] = ["info", "lloc", "contacts", "schedule", "hospitalitat", "tecnic"];
const PAGE_META: Record<Section, { title: string; sub: string; icon: string }> = {
  info: { title: "Informació general", sub: "Quan i on serà l'actuació", icon: "Informació general" },
  lloc: { title: "El lloc", sub: "Accés, descàrrega i aparcament", icon: "Lloc" },
  contacts: { title: "Contactes", sub: "Amb qui parlem el dia del bolo", icon: "Contactes" },
  schedule: { title: "Horaris", sub: "Arribada, muntatge, proves i concert", icon: "Horaris" },
  hospitalitat: { title: "Hospitalitat", sub: "Dietes, catering, camerino i allotjament", icon: "Hospitalitat" },
  tecnic: { title: "Detalls tècnics", sub: "Escenari, so i necessitats tècniques", icon: "Detalls tècnics" },
};

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
// Temps sense tocar res abans de desar sol (cada canvi el torna a comptar).
const SAVE_DELAY_MS = 800;

// Formulari públic (sense sessió) per pàgines: una secció per pàgina, amb
// Enrere/Següent a dalt i a baix, i tot desat automàticament a mesura que
// s'omple — no cal cap botó d'enviar fins al "Finalitza" de l'última
// pàgina (que només tanca amb el missatge de gràcies; les dades ja hi són).
export default function PublicShareForm({ token, scope, recipientName, alreadySubmitted, concert, routeSheet, vehicles = [], assignedRider = null }: {
  token: string;
  scope: "info" | "ruta" | "both";
  recipientName: string;
  alreadySubmitted: boolean;
  concert: ConcertLite;
  routeSheet: RouteSheet;
  vehicles?: Vehicle[];
  assignedRider?: { name: string; publicToken: string } | null;
}) {
  const [info, setInfo] = useState<ShareInfoPayload>({
    date: concert.date, time: concert.time, city: concert.city,
    venue: concert.venue, festaEntitat: concert.festaEntitat,
    canAnnounce: concert.canAnnounce, announceAfter: concert.announceAfter, ticketType: concert.ticketType,
  });
  function setInfoField<K extends keyof ShareInfoPayload>(key: K, value: ShareInfoPayload[K]) {
    setInfo((prev) => ({ ...prev, [key]: value }));
  }
  // "Adreça" (Lloc) i l'hora d'inici de la fase "Concert" (Horaris) són el
  // mateix camp que concerts.address/concerts.exact_time — igual que a
  // RouteSheetEditor, es desen també a la columna en directe (vegeu
  // submitShareFormAction), no només dins el JSON del full de ruta.
  const [address, setAddress] = useState(concert.address);
  const [addressAutofilled, setAddressAutofilled] = useState(false);
  const [exactTime, setExactTime] = useState(concert.exactTime);
  const [rs, setRs] = useState<RouteSheet>(routeSheet);
  const { updateSection, addItem, removeItem, dragHandlers } = useRouteSheetOps(setRs);
  // Eliminar una fila que ja té alguna cosa escrita demana confirmació
  // (diàleg propi, mai el del navegador); una de buida s'esborra
  // directament. El mateix per al document de contrarider ja penjat.
  const [pendingRemove, setPendingRemove] = useState<{ kind: "item"; section: RsSection; index: number } | { kind: "file" } | null>(null);
  function confirmedRemove(section: RsSection, i: number) {
    const item = (rs[section] as unknown[])[i];
    if (rsItemHasContent(section, item, { address, exactTime })) setPendingRemove({ kind: "item", section, index: i });
    else removeItem(section, i);
  }
  function removeCounterFile() {
    updateSection("tecnic", (arr) => arr.map((x, xi) => xi === counterRiderIndex ? { ...x, counterFileUrl: undefined, counterFileMime: undefined, counterFileName: undefined } : x));
  }

  // Contrarider: el promotor hi penja el document (mai l'estat/notes, que
  // és cosa de l'agència — vegeu FieldRow). Es desa al mateix TecnicItem
  // "Contra rider" de la secció Detalls tècnics.
  const [uploadingCounter, setUploadingCounter] = useState(false);
  const [counterDragOver, setCounterDragOver] = useState(false);
  const [counterError, setCounterError] = useState<string | null>(null);
  const counterRiderIndex = rs.tecnic.findIndex((it) => it.label && it.label.trim().toLowerCase() === "contra rider");
  const counterRiderItem = counterRiderIndex >= 0 ? rs.tecnic[counterRiderIndex] : null;
  async function uploadCounterFile(file: File) {
    if (counterRiderIndex < 0) return;
    setCounterError(null);
    setUploadingCounter(true);
    try {
      const fd = new FormData();
      fd.append("token", token);
      fd.append("file", file);
      const res = await fetch("/api/share-file-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) { setCounterError(data.error || "No s'ha pogut pujar el document."); return; }
      updateSection("tecnic", (arr) => arr.map((x, xi) => xi === counterRiderIndex ? { ...x, counterFileUrl: data.url, counterFileMime: data.mime, counterFileName: data.name } : x));
    } finally {
      setUploadingCounter(false);
    }
  }
  function isFileDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer?.types || []).includes("Files");
  }

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showInfo = scope === "info" || scope === "both";
  const showRuta = scope === "ruta" || scope === "both";
  // Les pàgines del formulari, segons l'àmbit de l'enllaç.
  const pages = useMemo<Section[]>(() => ALL_SECTIONS.filter((s) => (s === "info" ? showInfo : showRuta)), [showInfo, showRuta]);

  // Recinte dins el full de ruta (Lloc) — cas rar/heretat, sense resoldre
  // adreça (vegeu RecinteSearchField); el de més amunt, a "Informació
  // general", és el de veritat (VenueSearchField, amb resolvePlaceToVenueFields).
  function handleVenueCityChange(v: { name: string; city?: string; street?: string; housenumber?: string }) {
    setInfo((prev) => ({ ...prev, venue: v.name, ...(v.city ? { city: v.city } : {}) }));
    if (v.street || v.housenumber) setAddress([v.street, v.housenumber].filter(Boolean).join(" "));
  }
  function handleInfoVenueCommit(v: { venue: string; city?: string; address?: string }) {
    setInfo((prev) => ({ ...prev, venue: v.venue, ...(v.city ? { city: v.city } : {}) }));
    if (v.address) { setAddress(v.address); setAddressAutofilled(true); }
  }

  const searchAction = useMemo(() => (q: string) => searchVenuesGooglePublicAction(token, q), [token]);
  const detailsAction = useMemo(() => (id: string) => getPlaceDetailsPublicAction(token, id), [token]);
  const addressSearchAction = useMemo(() => (q: string) => searchVenuesPublicAction(token, q), [token]);
  const reverseGeocodeAction = useMemo(() => (lat: number, lon: number) => reverseGeocodePublicAction(token, lat, lon), [token]);
  const contactSearchAction = useMemo(() => (q: string) => searchContactsPublicAction(token, q), [token]);
  const fieldRowCtx = {
    venue: info.venue, onVenueCityChange: handleVenueCityChange, address, onAddressChange: setAddress, vehicles,
    vehiclesEditable: false, contraRiderEditable: false,
    venueSearchAction: searchAction, venueDetailsAction: detailsAction, addressSearchAction,
  };

  // Camps omplerts / a omplir de cada secció — mateix criteri que
  // RouteSheetEditor (vegeu sectionStats allà): compten files senceres
  // (contactes, horaris), no camps solts.
  function sectionStats(section: RsSection): { filled: number; total: number } {
    let total = 0, filled = 0;
    const check = (v: unknown) => { total++; if (v && String(v).trim()) filled++; };
    if (section === "lloc") rs.lloc.forEach((it) => {
      const isAdreça = it.label && it.label.trim().toLowerCase() === "adreça";
      check(isAdreça ? address : it.value);
    });
    else if (section === "contacts") rs.contacts.forEach((it) => {
      total++;
      if (it.role.trim() && it.name.trim() && it.phone.trim() && it.company.trim()) filled++;
    });
    else if (section === "schedule") rs.schedule.forEach((it) => {
      const isConcertPhase = it.phase && it.phase.trim().toLowerCase() === "concert";
      const start = isConcertPhase ? exactTime : it.start;
      total++;
      if (start.trim() || it.end.trim()) filled++;
    });
    else if (section === "hospitalitat") rs.hospitalitat.forEach((it) => {
      total++;
      if ((it.value && it.value.trim()) || it.included !== undefined) filled++;
    });
    else rs.tecnic.forEach((it) => {
      const label = it.label && it.label.trim().toLowerCase();
      total++;
      if (label === "pantalla led") { if (it.included !== undefined) filled++; return; }
      if ((it.value && it.value.trim()) || (label === "contra rider" && it.status === "aprovat")) filled++;
    });
    return { filled, total };
  }
  function infoStats(): { filled: number; total: number } {
    let total = 0, filled = 0;
    const check = (v: unknown) => { total++; if (v && String(v).trim()) filled++; };
    // "Adreça" i l'hora exacta ja compten dins de sectionStats("lloc")/
    // ("schedule") — no es tornen a comptar aquí perquè el progrés no
    // s'infli (són el mateix camp compartit, editable des de tots dos
    // llocs, com al formulari normal amb els seus dos indicadors separats).
    check(info.date); check(info.time); check(info.city); check(info.venue); check(info.festaEntitat);
    if (concert.kind === "bolo") {
      check(info.canAnnounce);
      // "Fins al dia" només compta si de veres cal (canAnnounce === "no") —
      // mateix criteri que la seva visibilitat al formulari normal.
      if (info.canAnnounce === "no") check(info.announceAfter);
      check(info.ticketType);
    }
    return { filled, total };
  }
  function statsFor(section: Section): { filled: number; total: number } {
    return section === "info" ? infoStats() : sectionStats(section);
  }
  function isComplete(section: Section): boolean {
    const st = statsFor(section);
    return st.total > 0 && st.filled >= st.total;
  }

  // Pàgina actual — es comença per la primera que encara no estigui completa.
  const [page, setPage] = useState(() => {
    const idx = pages.findIndex((s) => !isComplete(s));
    return idx < 0 ? 0 : idx;
  });
  const current: Section = pages[Math.min(page, pages.length - 1)];

  // Una pàgina completa es "fixa" en entrar-hi — els seus camps deixen de
  // poder-se editar, per protegir-la d'un canvi per error un cop ja s'ha
  // donat per bona — fins que es clica el llapis de dalt a la dreta, que la
  // desbloqueja mentre s'hi és (en tornar-hi més tard, si segueix
  // completa, es torna a fixar sola).
  const [locked, setLocked] = useState<Record<Section, boolean>>(() => {
    const out = {} as Record<Section, boolean>;
    ALL_SECTIONS.forEach((s) => { out[s] = isComplete(s); });
    return out;
  });

  // Progrés global del formulari (què queda per omplir).
  const progress = useMemo(() => {
    let total = 0, filled = 0;
    if (showInfo) { const s = infoStats(); total += s.total; filled += s.filled; }
    if (showRuta) {
      (["lloc", "contacts", "schedule", "hospitalitat", "tecnic"] as RsSection[]).forEach((s) => {
        const st = sectionStats(s);
        total += st.total; filled += st.filled;
      });
    }
    return total ? Math.round((filled / total) * 100) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, rs, address, exactTime, showInfo, showRuta]);

  // ---- Desat automàtic ----
  // Cada canvi programa un desat al cap de SAVE_DELAY_MS sense tocar res;
  // canviar de pàgina o "Finalitza" el força a l'instant. Mai dos desats
  // alhora: si n'arriba un mentre un altre és en curs, s'espera i només
  // torna a desar si de veres hi ha hagut canvis des de l'últim que ha
  // anat bé (es compara amb una foto del que es va enviar).
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const latest = useRef({ info, rs, address, exactTime });
  latest.current = { info, rs, address, exactTime };
  const lastSaved = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);

  const persist = useCallback(async (): Promise<boolean> => {
    while (inFlight.current) await inFlight.current;
    const snap = JSON.stringify(latest.current);
    if (snap === lastSaved.current) return true;
    setSaveState("saving");
    const run = (async () => {
      const cur = latest.current;
      const res = await submitShareFormAction(token, {
        info: showInfo ? cur.info : undefined,
        routeSheet: showRuta ? cur.rs : undefined,
        // Camps compartits (Informació general ↔ Full de ruta) — sempre es
        // desen, independentment de l'àmbit de l'enllaç, perquè es poden
        // editar des de qualsevol pàgina que hi hagi al formulari.
        exactTime: cur.exactTime, address: cur.address,
      });
      if (res.ok) { lastSaved.current = snap; setSaveState("saved"); setError(null); }
      else { setSaveState("error"); setError(res.error || "No s'ha pogut desar."); }
      return res.ok;
    })();
    inFlight.current = run;
    try { return await run; } finally { if (inFlight.current === run) inFlight.current = null; }
  }, [token, showInfo, showRuta]);

  useEffect(() => {
    const snap = JSON.stringify({ info, rs, address, exactTime });
    // Primera passada: el que ve del servidor ja és "desat".
    if (lastSaved.current === null) { lastSaved.current = snap; return; }
    if (snap === lastSaved.current) return;
    setSaveState("pending");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { saveTimer.current = null; void persist(); }, SAVE_DELAY_MS);
    return () => { if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null; } };
  }, [info, rs, address, exactTime, persist]);

  function flushSave(): Promise<boolean> {
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null; }
    return persist();
  }

  function goTo(next: number) {
    if (next < 0 || next >= pages.length || next === page) return;
    void flushSave();
    const target = pages[next];
    setLocked((prev) => ({ ...prev, [target]: isComplete(target) }));
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleFinish() {
    setSending(true);
    const ok = await flushSave();
    setSending(false);
    if (ok) { setSent(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  const saveLabel =
    saveState === "pending" ? "Canvis pendents…"
    : saveState === "saving" ? "Desant…"
    : saveState === "saved" ? "Desat automàticament ✓"
    : saveState === "error" ? "No s'ha pogut desar — es tornarà a provar"
    : "Tot es desa sol a mesura que ho omples";

  function renderNav(position: "top" | "bottom") {
    const isFirst = page === 0, isLast = page === pages.length - 1;
    return (
      <div className={"pf-nav " + position}>
        <button
          type="button" className="pf-nav-btn" onClick={() => goTo(page - 1)} disabled={isFirst}
          style={{ visibility: isFirst ? "hidden" : "visible" }}
        >
          <ChevronLeft /> Enrere
        </button>
        {position === "top" && (
          <div className="pf-nav-center">
            <div className="pf-stepper">
              {pages.map((s, i) => {
                const done = isComplete(s);
                return (
                  <button
                    key={s} type="button"
                    className={"pf-step" + (i === page ? " current" : "") + (done ? " done" : "")}
                    title={PAGE_META[s].title} aria-current={i === page ? "step" : undefined}
                    onClick={() => goTo(i)}
                  >
                    {done && i !== page ? <CheckIcon size={12} /> : <SectionIcon title={PAGE_META[s].icon} size={13} />}
                  </button>
                );
              })}
            </div>
            <div className="pf-page-label">Pàgina {page + 1} de {pages.length}</div>
          </div>
        )}
        {isLast ? (
          <button type="button" className="pf-nav-btn primary finish" disabled={sending} onClick={handleFinish}>
            {sending ? "Enviant…" : "Finalitza"} <CheckIcon />
          </button>
        ) : (
          <button type="button" className="pf-nav-btn primary" onClick={() => goTo(page + 1)}>
            Següent <ChevronRight />
          </button>
        )}
      </div>
    );
  }

  function renderHead(section: Section) {
    const meta = PAGE_META[section];
    const st = statsFor(section);
    const complete = st.total > 0 && st.filled >= st.total;
    return (
      <>
        <div className="pf-card-head">
          <span className="pf-card-icon"><SectionIcon title={meta.icon} size={17} /></span>
          <div>
            <div className="pf-card-title">{meta.title}</div>
            <div className="pf-card-sub">{meta.sub}</div>
          </div>
          <span className={"pf-card-badge" + (complete ? " done" : "")}>{complete ? "✓ complet" : `${st.filled}/${st.total}`}</span>
          {locked[section] ? (
            <button type="button" className="pf-card-lock-btn" title="Aquesta pàgina està fixada — clica per editar-la"
              onClick={() => setLocked((p) => ({ ...p, [section]: false }))}>
              <PencilIcon />
            </button>
          ) : (
            <button type="button" className="pf-card-lock-btn pf-card-confirm-btn" title="Confirma i fixa aquesta pàgina"
              onClick={() => setLocked((p) => ({ ...p, [section]: true }))}>
              <CheckIcon />
            </button>
          )}
        </div>
        {locked[section] && (
          <div className="pf-locked-hint"><LockIcon /> Aquesta pàgina ja està completa i s&apos;ha fixat — clica el llapis de dalt a la dreta per editar-la.</div>
        )}
      </>
    );
  }

  function renderBody(section: Section) {
    if (section === "info") {
      return (
        <fieldset disabled={locked.info} className={"pf-section-fieldset" + (locked.info ? " pf-locked-body" : "")}>
          <div className="cd-info-grid pf-info-grid">
            <div className="cd-field">
              <label className="form-label">Títol</label>
              <input className="field-input form-field" value={info.festaEntitat} onChange={(e) => setInfoField("festaEntitat", e.target.value)} placeholder="Festa major, ajuntament…" />
            </div>
            <div className="cd-field">
              <label className="form-label">Data</label>
              <InlineDatePicker value={info.date} onChange={(v) => setInfoField("date", v)} today={today()} />
            </div>
            <div className="cd-field cd-time-pair-field">
              <div className="cd-time-pair-row">
                <div className="cd-time-pair-col" style={{ flex: 1 }}>
                  <label className="form-label">Hora aproximada</label>
                  <div className="cd-time-pair-col-body">
                    <TimePeriodBubble time={info.time} onChange={(v) => setInfoField("time", v)} />
                  </div>
                </div>
                <div className="cd-time-pair-col grow">
                  <label className="form-label">Hora exacta</label>
                  <div className="cd-time-pair-col-body">
                    <input type="time" className="field-input form-field" value={exactTime} onChange={(e) => setExactTime(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            <div className="cd-field">
              <label className="form-label">Recinte</label>
              <VenueSearchField
                venue={info.venue} onCommit={handleInfoVenueCommit}
                searchAction={searchAction} detailsAction={detailsAction} reverseGeocodeAction={reverseGeocodeAction}
              />
            </div>
            <div className="cd-field pf-field-wide-cd">
              <label className="form-label">Adreça</label>
              <input
                className="field-input form-field" type="text" placeholder="S'empleix en triar un recinte…"
                value={address} onChange={(e) => { setAddress(e.target.value); setAddressAutofilled(false); }}
              />
              {addressAutofilled && (
                <div className="rs-autofill-note" style={{ marginTop: 4 }}><WarnIcon />Adreça generada automàticament, comprova que sigui correcta</div>
              )}
            </div>
            {concert.kind === "bolo" && (
              <>
                {locked.info ? (
                  <>
                    {/* Fixat: sense l'estructura sempre muntada per
                        a "Fins al dia" (només fa falta de veres si
                        la resposta és "No") — així pot compartir
                        fila amb la resta de camps curts. */}
                    <div className="cd-field">
                      <label className="form-label">Es pot anunciar?</label>
                      {info.canAnnounce ? <span>{info.canAnnounce === "yes" ? "Sí" : "No"}</span> : <span className="rs-locked-dash">—</span>}
                    </div>
                    {info.canAnnounce === "no" && (
                      <div className="cd-field">
                        <label className="form-label">Fins al dia</label>
                        <span>{info.announceAfter || "—"}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="cd-field cd-time-pair-field">
                    <div className="cd-time-pair-row">
                      <div className="cd-time-pair-col">
                        <label className="form-label">Es pot anunciar?</label>
                        <div className="cd-time-pair-col-body">
                          <div className="cd-att-controls">
                            <button type="button" className={"cd-att-btn yes" + (info.canAnnounce === "yes" ? " active" : "")} onClick={() => setInfoField("canAnnounce", info.canAnnounce === "yes" ? "" : "yes")}>Sí</button>
                            <button type="button" className={"cd-att-btn no" + (info.canAnnounce === "no" ? " active" : "")} onClick={() => setInfoField("canAnnounce", info.canAnnounce === "no" ? "" : "no")}>No</button>
                          </div>
                        </div>
                      </div>
                      {/* Sempre muntada (només s'amaga) perquè revelar-la no faci
                          créixer la fila i desplaci el títol/pestanyes de sí/no. */}
                      <div className="cd-time-pair-col grow" style={{ visibility: info.canAnnounce === "no" ? "visible" : "hidden" }} aria-hidden={info.canAnnounce !== "no"}>
                        <label className="form-label">Fins al dia</label>
                        <div className="cd-time-pair-col-body">
                          <InlineDatePicker value={info.announceAfter || ""} onChange={(v) => setInfoField("announceAfter", v)} today={today()} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="cd-field">
                  <label className="form-label">Tipus d&apos;entrada</label>
                  {locked.info && !info.ticketType ? (
                    <span className="rs-locked-dash">—</span>
                  ) : locked.info ? (
                    <span>{info.ticketType === "gratuit" ? "Gratuïta" : "De pagament"}</span>
                  ) : (
                    <div className="cd-att-controls">
                      <button type="button" className={"cd-att-btn neutral" + (info.ticketType === "gratuit" ? " active" : "")} onClick={() => setInfoField("ticketType", info.ticketType === "gratuit" ? "" : "gratuit")}>Gratuïta</button>
                      <button type="button" className={"cd-att-btn neutral" + (info.ticketType === "pagament" ? " active" : "")} onClick={() => setInfoField("ticketType", info.ticketType === "pagament" ? "" : "pagament")}>De pagament</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </fieldset>
      );
    }

    if (section === "lloc") {
      return (
        <fieldset disabled={locked.lloc} className={"pf-section-fieldset" + (locked.lloc ? " pf-locked-body" : "")}>
          <div className="rs-repeater" data-rs-section="lloc">
            {rs.lloc.map((it, i) => (
              <FieldRow
                key={i} section="lloc" item={it} ctx={{ ...fieldRowCtx, locked: locked.lloc }}
                onChange={(patch) => updateSection("lloc", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x) as never)}
                onRemove={() => confirmedRemove("lloc", i)}
                dragProps={dragHandlers("lloc", i)}
              />
            ))}
            <button type="button" className="rs-add-btn" onClick={() => addItem("lloc")}>+ Afegeix camp</button>
          </div>
        </fieldset>
      );
    }

    if (section === "contacts") {
      return (
        <fieldset disabled={locked.contacts} className={"pf-section-fieldset" + (locked.contacts ? " pf-locked-body" : "")}>
          <div className="rs-repeater">
            {rs.contacts.map((ct, i) => (
              <ContactRow
                key={i} item={ct} contacts={NO_CONTACTS}
                searchAction={contactSearchAction}
                onCreateContact={(it) => createContactPublicAction(token, it)}
                onChange={(patch) => updateSection("contacts", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x))}
                onRemove={() => confirmedRemove("contacts", i)}
                dragProps={dragHandlers("contacts", i)}
              />
            ))}
            <button type="button" className="rs-add-btn" onClick={() => addItem("contacts")}>+ Afegeix contacte</button>
          </div>
        </fieldset>
      );
    }

    if (section === "schedule") {
      return (
        <fieldset disabled={locked.schedule} className={"pf-section-fieldset" + (locked.schedule ? " pf-locked-body" : "")}>
          <div>
            <div className="rs-phase-header rs-phase-header-inner">
              <span></span>
              <span className="rs-col-label">Fase</span>
              <span className="rs-col-label">Inici</span>
              <span className="rs-col-label">Fi</span>
              <span></span>
            </div>
            <div className="rs-repeater">
              {rs.schedule.map((ph, i) => (
                <PhaseRow
                  key={i} item={ph} exactTime={exactTime} onExactTimeChange={setExactTime}
                  onChange={(patch) => updateSection("schedule", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x))}
                  onRemove={() => confirmedRemove("schedule", i)}
                  dragProps={dragHandlers("schedule", i)}
                />
              ))}
            </div>
            <button type="button" className="rs-add-btn" onClick={() => addItem("schedule")}>+ Afegeix fase</button>
          </div>
        </fieldset>
      );
    }

    if (section === "hospitalitat") {
      return (
        <fieldset disabled={locked.hospitalitat} className={"pf-section-fieldset" + (locked.hospitalitat ? " pf-locked-body" : "")}>
          <div className="rs-repeater" data-rs-section="hospitalitat">
            {rs.hospitalitat.map((it, i) => {
              const isHotel = it.label && it.label.trim().toLowerCase() === "allotjament";
              if (isHotel) {
                return (
                  <div key={i} className="pf-hotel-compact">
                    <HotelBlock
                      item={it} vehicles={vehicles} parkingVehiclesEditable={false} restrictToNameForGroup phoneNextToAddress locked={locked.hospitalitat}
                      onUpdate={(patch) => updateSection("hospitalitat", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x))}
                      searchAction={searchAction} detailsAction={detailsAction} reverseGeocodeAction={reverseGeocodeAction}
                    />
                  </div>
                );
              }
              return (
                <HospRow
                  key={i} item={it} locked={locked.hospitalitat}
                  onChange={(patch) => updateSection("hospitalitat", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x))}
                  onRemove={() => confirmedRemove("hospitalitat", i)}
                  dragProps={dragHandlers("hospitalitat", i)}
                />
              );
            })}
            <button type="button" className="rs-add-btn" onClick={() => addItem("hospitalitat")}>+ Afegeix camp</button>
          </div>
        </fieldset>
      );
    }

    // tecnic
    return (
      <div>
        <fieldset disabled={locked.tecnic} className={"pf-section-fieldset" + (locked.tecnic ? " pf-locked-body" : "")}>
          <div className="rs-repeater">
            {rs.tecnic.map((it, i) => (
              <FieldRow
                key={i} section="tecnic" item={it} ctx={{ ...fieldRowCtx, locked: locked.tecnic }}
                onChange={(patch) => updateSection("tecnic", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x) as never)}
                onRemove={() => confirmedRemove("tecnic", i)}
                dragProps={dragHandlers("tecnic", i)}
              />
            ))}
            <button type="button" className="rs-add-btn" onClick={() => addItem("tecnic")}>+ Afegeix camp</button>
          </div>
        </fieldset>
        {/* Sempre disponibles: veure el rider i penjar el
            contrarider no formen part del que es "fixa". */}
        <div className="pf-tecnic-bubbles">
          <button
            type="button" className="pf-bubble-btn" disabled={!assignedRider}
            title={assignedRider ? "Obre el rider del grup" : "El grup encara no ha assignat cap rider"}
            onClick={() => assignedRider && window.open(`/m/${assignedRider.publicToken}`, "_blank")}
          >
            <RiderIcon /> Rider del grup{!assignedRider && " (cap assignat)"}
          </button>
          {counterRiderItem && (
            <div className="pf-bubble-col">
              <label
                className={"pf-bubble-btn pf-bubble-upload" + (counterDragOver ? " dragover" : "")}
                onDragEnter={(e) => { if (isFileDrag(e)) { e.preventDefault(); setCounterDragOver(true); } }}
                onDragOver={(e) => { if (isFileDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCounterDragOver(false); }}
                onDrop={(e) => {
                  if (!isFileDrag(e)) return;
                  e.preventDefault();
                  setCounterDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) uploadCounterFile(f);
                }}
              >
                <input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCounterFile(f); e.target.value = ""; }} />
                {uploadingCounter ? "Pujant…" : <><PaperclipIcon /> Contra rider — arrossega o tria un document</>}
              </label>
              {counterRiderItem.counterFileName && (
                <div className="pf-counter-file-chip">
                  <PaperclipIcon />
                  <span>{counterRiderItem.counterFileName}</span>
                  <button type="button" className="pf-counter-file-remove" title="Elimina el document"
                    onClick={() => setPendingRemove({ kind: "file" })}
                  ><XIcon /></button>
                </div>
              )}
            </div>
          )}
        </div>
        {counterError && <div className="pf-error" style={{ marginTop: 8 }}>{counterError}</div>}
      </div>
    );
  }

  return (
    <div className="pf-screen">
      <div className="pf-container">
        <div className="pf-brand"><img className="pf-logo" src="/logo-escenari.png" alt="Escenari" /></div>

        <div className="pf-hero">
          <div className="pf-hero-band">{concert.bandName}</div>
          <div className="pf-hero-date">{capitalize(formatDateFull(concert.date))}{concert.city ? ` · ${concert.city}` : ""}</div>
          <p className="pf-hero-text">
            Hola{recipientName ? ` ${recipientName}` : ""}! 👋 Ens ajudes a completar les dades d&apos;aquesta actuació?
            Tot es desa sol a mesura que ho omples — pots tancar i tornar-hi més tard mentre l&apos;enllaç sigui vàlid.
          </p>
          <div className="pf-progress">
            <div className="pf-progress-track"><div className="pf-progress-fill" style={{ width: progress + "%" }}></div></div>
            <span>{progress}% complet</span>
          </div>
          <div className={"pf-save-state " + saveState} aria-live="polite">{saveLabel}</div>
          {alreadySubmitted && !sent && <div className="pf-note">Ja s&apos;havia enviat una resposta — pots seguir editant-la.</div>}
        </div>

        {sent ? (
          <div className="pf-done">
            <div className="pf-done-icon">✓</div>
            <h2>Dades enviades!</h2>
            <p>Moltes gràcies. Si has de canviar res, torna a obrir aquest mateix enllaç.</p>
            <button type="button" className="pf-btn-secondary" onClick={() => setSent(false)}>Torna a editar</button>
          </div>
        ) : (
          <>
            {renderNav("top")}
            <div className="pf-card" key={current}>
              {renderHead(current)}
              {renderBody(current)}
            </div>
            {error && <div className="pf-error">{error}</div>}
            {renderNav("bottom")}
            <div className="pf-footer">Formulari segur generat amb Escenari · les dades només arriben al gestor del grup</div>
          </>
        )}
      </div>
      {pendingRemove && (
        <ConfirmDialog
          title={pendingRemove.kind === "file" ? "Eliminar el document?" : "Eliminar aquest camp?"}
          message={pendingRemove.kind === "file" ? "El document de contrarider es traurà del full de ruta." : "Aquest camp ja té informació escrita. Segur que el vols eliminar?"}
          confirmLabel="Elimina"
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            if (pendingRemove.kind === "file") removeCounterFile();
            else removeItem(pendingRemove.section, pendingRemove.index);
            setPendingRemove(null);
          }}
        />
      )}
    </div>
  );
}
