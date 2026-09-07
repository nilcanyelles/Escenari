"use client";

import { useMemo, useState } from "react";
import type { Vehicle, Contact } from "@/lib/types";
import type { RouteSheet } from "@/lib/route-sheet";
import { formatDateFull, capitalize, today } from "@/lib/format";
import {
  submitShareFormAction, searchVenuesGooglePublicAction, getPlaceDetailsPublicAction,
  searchVenuesPublicAction, reverseGeocodePublicAction, type ShareInfoPayload,
} from "@/app/f/actions";
import {
  type RsSection, useRouteSheetOps, SectionIcon, WarnIcon, XIcon, FieldRow, ContactRow, PhaseRow, HospRow, HotelBlock,
} from "@/components/RouteSheetFields";
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

// No suggeriments de contactes ja desats de l'agència — qui omple el
// formulari extern no els ha de veure ni triar (seria una fuita de dades
// cap a fora); vegeu ContactRow a RouteSheetFields.tsx.
const NO_CONTACTS: Contact[] = [];

type Section = "info" | RsSection;

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
  // Només el formulari públic de regidor demana confirmació abans
  // d'eliminar un camp — el normal es queda tal com estava (sense).
  function confirmedRemove(section: RsSection, i: number) {
    if (window.confirm("Segur que vols eliminar aquest camp?")) removeItem(section, i);
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

  const [openSections, setOpenSections] = useState<Record<Section, boolean>>(() => {
    const order: Section[] = ["info", "lloc", "contacts", "schedule", "hospitalitat", "tecnic"];
    const out: Record<Section, boolean> = { info: false, lloc: false, contacts: false, schedule: false, hospitalitat: false, tecnic: false };
    const firstIncomplete = order.find((s) => {
      if (s === "info" && !showInfo) return false;
      if (s !== "info" && !showRuta) return false;
      const st = s === "info" ? infoStats() : sectionStats(s);
      return st.total === 0 || st.filled < st.total;
    });
    out[firstIncomplete || (showInfo ? "info" : "lloc")] = true;
    return out;
  });
  function toggleSection(key: Section) {
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));
  }

  // Una secció que ja estava completa en obrir el formulari es "fixa" —
  // els seus camps deixen de poder-se editar, per protegir-la d'un canvi
  // per error un cop ja s'ha donat per bona — fins que es clica el llapis
  // que apareix al costat del títol, que la desbloqueja per a la resta de
  // la sessió (mai es torna a bloquejar sola mentre s'edita).
  const [locked, setLocked] = useState<Record<Section, boolean>>(() => {
    const out: Record<Section, boolean> = { info: false, lloc: false, contacts: false, schedule: false, hospitalitat: false, tecnic: false };
    (["info", "lloc", "contacts", "schedule", "hospitalitat", "tecnic"] as Section[]).forEach((s) => {
      const st = s === "info" ? infoStats() : sectionStats(s as RsSection);
      out[s] = st.total > 0 && st.filled >= st.total;
    });
    return out;
  });
  function unlockSection(key: Section) {
    setLocked((p) => ({ ...p, [key]: false }));
  }
  function lockSection(key: Section) {
    setLocked((p) => ({ ...p, [key]: true }));
  }

  // Progrés del formulari (què queda per omplir).
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

  async function handleSubmit() {
    setSending(true);
    setError(null);
    const res = await submitShareFormAction(token, {
      info: showInfo ? info : undefined,
      routeSheet: showRuta ? rs : undefined,
      // Camps compartits (Informació general ↔ Full de ruta) — sempre es
      // desen, independentment de l'àmbit de l'enllaç, perquè es poden
      // editar des de qualsevol secció que hi hagi al formulari.
      exactTime, address,
    });
    if (res.ok) setSent(true);
    else setError(res.error || "No s'ha pogut desar.");
    setSending(false);
  }

  function CardHead({ section, title, sub, stats }: { section: Section; title: string; sub: string; stats: { filled: number; total: number } }) {
    const open = !!openSections[section];
    const complete = stats.total > 0 && stats.filled >= stats.total;
    return (
      <div
        className={"pf-card-head clickable" + (open ? "" : " folded")} role="button" tabIndex={0} aria-expanded={open}
        onClick={() => toggleSection(section)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSection(section); } }}
      >
        <span className="pf-card-icon"><SectionIcon title={title} size={17} /></span>
        <div>
          <div className="pf-card-title">{title}</div>
          <div className="pf-card-sub">{sub}</div>
        </div>
        <span className={"pf-card-badge" + (complete ? " done" : "")}>{complete ? "✓ complet" : `${stats.filled}/${stats.total}`}</span>
        {locked[section] ? (
          <button type="button" className="pf-card-lock-btn" title="Aquesta secció està fixada — clica per editar-la"
            onClick={(e) => { e.stopPropagation(); unlockSection(section); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
        ) : (
          <button type="button" className="pf-card-lock-btn pf-card-confirm-btn" title="Confirma i fixa aquesta secció"
            onClick={(e) => { e.stopPropagation(); lockSection(section); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
        )}
        <span className={"pf-card-chevron" + (open ? " open" : "")} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>
        </span>
      </div>
    );
  }

  return (
    <div className="pf-screen">
      <div className="pf-container">
        <div className="pf-brand">ESCENARI</div>

        <div className="pf-hero">
          <div className="pf-hero-band">{concert.bandName}</div>
          <div className="pf-hero-date">{capitalize(formatDateFull(concert.date))}{concert.city ? ` · ${concert.city}` : ""}</div>
          <p className="pf-hero-text">
            Hola{recipientName ? ` ${recipientName}` : ""}! 👋 Ens ajudes a completar les dades d&apos;aquesta actuació?
            Pots desar i tornar-hi més tard — el formulari es queda obert mentre l&apos;enllaç sigui vàlid.
          </p>
          <div className="pf-progress">
            <div className="pf-progress-track"><div className="pf-progress-fill" style={{ width: progress + "%" }}></div></div>
            <span>{progress}% complet</span>
          </div>
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
            {showInfo && (
              <div className="pf-card">
                <CardHead section="info" title="Informació general" sub="Quan i on serà l'actuació" stats={infoStats()} />
                {openSections.info && (
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
                )}
              </div>
            )}

            {showRuta && (
              <>
                <div className="pf-card">
                  <CardHead section="lloc" title="El lloc" sub="Accés, descàrrega i aparcament" stats={sectionStats("lloc")} />
                  {openSections.lloc && (
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
                  )}
                </div>

                <div className="pf-card">
                  <CardHead section="contacts" title="Contactes" sub="Amb qui parlem el dia del bolo" stats={sectionStats("contacts")} />
                  {openSections.contacts && (
                    <fieldset disabled={locked.contacts} className={"pf-section-fieldset" + (locked.contacts ? " pf-locked-body" : "")}>
                    <div className="rs-repeater">
                      {rs.contacts.map((ct, i) => (
                        <ContactRow
                          key={i} item={ct} contacts={NO_CONTACTS}
                          onChange={(patch) => updateSection("contacts", (arr) => arr.map((x, xi) => xi === i ? { ...x, ...patch } : x))}
                          onRemove={() => confirmedRemove("contacts", i)}
                          dragProps={dragHandlers("contacts", i)}
                        />
                      ))}
                      <button type="button" className="rs-add-btn" onClick={() => addItem("contacts")}>+ Afegeix contacte</button>
                    </div>
                    </fieldset>
                  )}
                </div>

                <div className="pf-card">
                  <CardHead section="schedule" title="Horaris" sub="Arribada, muntatge, proves i concert" stats={sectionStats("schedule")} />
                  {openSections.schedule && (
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
                  )}
                </div>

                <div className="pf-card">
                  <CardHead section="hospitalitat" title="Hospitalitat" sub="Dietes, catering, camerino i allotjament" stats={sectionStats("hospitalitat")} />
                  {openSections.hospitalitat && (
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
                  )}
                </div>

                <div className="pf-card">
                  <CardHead section="tecnic" title="Detalls tècnics" sub="Escenari, so i necessitats tècniques" stats={sectionStats("tecnic")} />
                  {openSections.tecnic && (
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
                                  onClick={() => {
                                    if (!window.confirm("Segur que vols eliminar aquest document?")) return;
                                    updateSection("tecnic", (arr) => arr.map((x, xi) => xi === counterRiderIndex ? { ...x, counterFileUrl: undefined, counterFileMime: undefined, counterFileName: undefined } : x));
                                  }}
                                ><XIcon /></button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {counterError && <div className="pf-error" style={{ marginTop: 8 }}>{counterError}</div>}
                    </div>
                  )}
                </div>
              </>
            )}

            {error && <div className="pf-error">{error}</div>}
            <button type="button" className="pf-submit" disabled={sending} onClick={handleSubmit}>
              {sending ? "Enviant…" : alreadySubmitted ? "Actualitza les dades" : "Envia les dades"}
            </button>
            <div className="pf-footer">Formulari segur generat amb Escenari · les dades només arriben al gestor del grup</div>
          </>
        )}
      </div>
    </div>
  );
}
