"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Band, Concert } from "@/lib/types";
import { formatCurrency, formatDate, formatDateShort, formatDateFull, capitalize, formatConcertTime } from "@/lib/format";
import { tagColors, bandPhotoDataUri, personPhotoDataUri, personPhotoDataUriColored, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import type { LinkedMember, BackupRequest } from "@/lib/group-data";
import type { Rider, Setlist, BandEditor } from "@/lib/material-types";
import type { Song, BandFile } from "@/lib/songs";
import { saveBandBackupsAction, saveBandVehiclesAction, setBackupRequestStatusAction, respondBackupApplicationAction, addBandPersonAction, removeBandPersonAction, moveMemberToBackupsAction, invitePersonAction, setMemberPermAction, type BackupPerson } from "@/app/(app)/grup/actions";
import { openBandPublicPageAction } from "@/app/g/actions";
import { generateJoinCodeAction } from "@/app/(app)/grups/actions";
import { setMyAttendanceAction, leaveBandAction } from "@/app/(artist)/actions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { memberPerms, PERM_LABELS, DEFAULT_PERMS, ALL_PERMS } from "@/lib/perms";
import { bandRoster } from "@/lib/roster";
import VerifiedTick from "@/components/VerifiedTick";
import { logoBox } from "@/lib/logo";
import type { MemberPerms, Vehicle, SocialStats, SocialPlatform, Formation, Contact } from "@/lib/types";
import type { ContactInteraction } from "@/lib/contacts-data";
import ContactesView from "@/components/ContactesView";
import { SOCIAL_PLATFORMS, PLATFORM_META, FOLLOWERS_KEY, isTracked, formatNumber, formatHeroNumber } from "@/lib/social-history";
import { normalizeRouteSheet, withLiveConcertStart, type RouteSheet } from "@/lib/route-sheet";
import GroupAppearanceModal from "@/components/GroupAppearanceModal";
import DiaTopActions from "@/components/DiaTopActions";
import ConcertPosterEditor from "@/components/ConcertPosterEditor";
import GigLocationMap from "@/components/GigLocationMaps";
import FormationEditor, { formationSummary } from "@/components/FormationEditor";
import { RidersPanel, SetlistsPanel } from "@/components/MaterialPanels";
import SetlistEditor from "@/components/SetlistEditor";
import { setConcertMaterialAction } from "@/app/(app)/grup/material-actions";
import SongsPanel from "@/components/SongsPanel";
import InstrumentPicker from "@/components/InstrumentPicker";
import { InstagramIcon, YoutubeIcon, TiktokIcon, SpotifyIcon } from "@/components/SocialIcons";
import { KIND_META, KIND_ORDER } from "@/components/CalendariView";

import BentoGrid, { type BentoCard } from "@/components/BentoGrid";
import { normalize } from "@/lib/text";
import { bandColor } from "@/lib/tags";
import type { Person } from "@/lib/types";
import { openPersonProfileAction } from "@/app/p/profile-actions";

// Icones per als botons rodons de capçalera de l'equip (edita, afegeix) —
// sols icona, sense text, amb el títol com a tooltip. ICON_MAIL i
// ICON_CHECK ja existeixen més avall per a altres usos.
const ICON_PENCIL = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </svg>
);
const ICON_PLUS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
// Paperera de la targeta en mode "Edita membres" — treu directament a la
// confirmació d'eliminar, sense passar per la tria "treu / passa a suplent".
function TrashIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  );
}
const ICON_MAIL = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 6-10 7L2 6"></path></svg>
);
const ICON_LINK = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
);
const ICON_CHECK = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const KIND_PLURAL: Record<string, string> = { bolo: "Bolos", assaig: "Assajos", reunio: "Reunions", altre: "Altres" };

const SOCIAL_ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: <InstagramIcon />, tiktok: <TiktokIcon />, spotify: <SpotifyIcon />, youtube: <YoutubeIcon />,
};

// Una xifra dins la secció d'una xarxa (Inici): la icona i el nom de la
// xarxa ja surten un sol cop a la capçalera de la secció (bento-social-
// platform-head) — aquí només el número, en el color de marca de la
// xarxa, i la diferència respecte al mes passat.
function SocialStatBox({ platform, label, value, prev }: {
  platform: SocialPlatform;
  label: string;
  value: number | undefined;
  prev: number | undefined;
}) {
  const d = value != null && prev != null ? value - prev : null;
  return (
    <div className="bento-social-box">
      <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
        <span className="bento-social-l">{label}</span>
        <span className="bento-social-n" style={{ color: PLATFORM_META[platform].color }} title={value != null ? formatNumber(value) : undefined}>
          {value != null ? formatHeroNumber(value) : "—"}
        </span>
        {d != null && d !== 0 && (
          <span className={"sx-delta " + (d > 0 ? "up" : "down")} style={{ fontSize: 10.5 }}>
            {d > 0 ? "+" : "−"}{formatNumber(Math.abs(d))} aquest mes
          </span>
        )}
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );
}
function SetlistIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
  );
}
// Botó de la setlist al bànner de "Proper concert": amb setlist assignada
// obre'n el PDF/públic (el mateix camí que "Obre / PDF" a la fitxa del
// concert); sense cap assignada, un avís explica que en falta una en
// comptes de no fer res — igual de desplegable que el menú de compartir.
export function SetlistButton({ c, band, setlists, songs, canEdit, iconBtnClass }: {
  c: Concert; band: Band; setlists: Setlist[]; songs: Song[]; canEdit: boolean; iconBtnClass: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const setlist = setlists.find((s) => s.id === c.setlistId);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setShowSwitch(false); }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Assigna sense sortir d'aquí (mai redirigint a la fitxa del concert) —
  // mateixa acció que ja fa servir la fitxa del concert per triar setlist.
  async function assign(id: string) {
    setAssigning(true);
    await setConcertMaterialAction(c.id, "setlist", id);
    setAssigning(false);
    setOpen(false);
    setShowSwitch(false);
    router.refresh();
  }

  return (
    <div className="dia-share-wrap setlist-menu-wrap" ref={wrapRef}>
      <button
        type="button" className={iconBtnClass}
        title={setlist ? `Setlist: ${setlist.name}` : "Sense setlist assignada"}
        onClick={() => { setOpen((v) => !v); setShowSwitch(false); }}
      >
        <SetlistIcon />
      </button>
      {open && (
        <div className="dia-share-menu" style={{ minWidth: 220, padding: 10 }}>
          {setlist ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px 7px" }}>
                <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-ghost)", fontWeight: 700 }}>Setlist</span>
                {canEdit && setlists.filter((s) => s.id !== setlist.id).length > 0 && (
                  <button type="button" className="pv-stat-edit" title="Tria una altra setlist" onClick={() => setShowSwitch((v) => !v)}><PencilIcon /></button>
                )}
              </div>
              <button type="button" className="dia-share-menu-item" onClick={() => { setOpen(false); router.push(`/escenari-mode/${setlist.id}?concert=${c.id}`); }}>▶ {setlist.name}</button>
              {showSwitch && setlists.filter((s) => s.id !== setlist.id).map((s) => (
                <button key={s.id} type="button" className="dia-share-menu-item" disabled={assigning} onClick={() => assign(s.id)}>{s.name}</button>
              ))}
              {canEdit && (
                <button type="button" className="dia-share-menu-item" onClick={() => { setEditorOpen(true); setOpen(false); }}>+ Crea una setlist nova</button>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "3px 6px 7px" }}>
                Sense setlist assignada{setlists.length > 0 ? ", tria-la:" : "."}
              </div>
              {setlists.map((s) => (
                <button key={s.id} type="button" className="dia-share-menu-item" disabled={assigning} onClick={() => assign(s.id)}>
                  {assigning ? "…" : s.name}
                </button>
              ))}
              {canEdit && (
                <button type="button" className="dia-share-menu-item" onClick={() => { setEditorOpen(true); setOpen(false); }}>+ Crea una setlist nova</button>
              )}
              {!canEdit && setlists.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "0 6px" }}>Encara no hi ha cap setlist al grup.</div>
              )}
            </>
          )}
        </div>
      )}
      {editorOpen && createPortal(
        // Amunt del tot amb un portal — .bento-next-poster té una
        // animació (transform) que converteix aquesta targeta en el marc
        // de referència de qualsevol position:fixed de dins seu, cosa que
        // trencava i retallava el modal (es veia superposat/tallat).
        <SetlistEditor
          band={band} setlist={null} librarySongs={songs}
          onClose={() => { setEditorOpen(false); router.refresh(); setOpen(true); }}
        />,
        document.body
      )}
    </div>
  );
}
// Targeta "Proper concert" de la pestanya Inici: sempre hi és (no només si
// avui hi ha bolo), amb el mateix estil de pòster que la capçalera de la
// fitxa del concert (.cd-poster) i uns horaris reduïts a només la primera
// convocatòria i l'hora del concert — cadascuna amb només l'inici, mai
// l'interval sencer.
function NextGigPoster({ c, base, band, setlists, songs, canEditSetlists }: {
  c: Concert; base: string; band: Band; setlists: Setlist[]; songs: Song[]; canEditSetlists: boolean;
}) {
  const rs = normalizeRouteSheet(c.routeSheet as RouteSheet | null, c);
  const phases = withLiveConcertStart(rs.schedule, c.exactTime).filter((p) => p.phase && p.start);
  const concertPhase = phases.find((p) => p.phase.trim().toLowerCase() === "concert");
  const callPhase = phases.find((p) => p !== concertPhase);
  // Dia concret aquí; l'etiqueta relativa (Avui/Demà...) surt al costat del
  // títol de la targeta.
  const dayFull = capitalize(formatDateFull(c.date));
  // Fons amb els dos colors del grup (principal i complementari) — vegeu
  // .bento-next-poster a l'estil.
  const accentVars = { ["--band-accent" as string]: band.color1 || "#8b7bff", ["--band-accent-2" as string]: band.color2 || band.color1 || "#8b7bff" };
  // Triant "Instagram" al menú de compartir, l'editor del pòster
  // s'incrusta aquí mateix (en comptes d'obrir-se com a finestra flotant)
  // — substitueix tot el contingut normal de la targeta fins que es tanca.
  const [posterEditorOpen, setPosterEditorOpen] = useState(false);
  if (posterEditorOpen) {
    return (
      <div className="cd-poster bento-next-poster bento-next-poster-editor" style={accentVars} onClick={(e) => e.stopPropagation()}>
        <ConcertPosterEditor concert={c} band={band} onClose={() => setPosterEditorOpen(false)} />
      </div>
    );
  }
  // Info, full de ruta i compartir només tenen sentit per a un bolo de
  // veritat — un assaig/reunió/altre només hi té la setlist, i en comptes
  // del recinte + hora del concert enganxats a la data, hi surt el recinte
  // en gran (com si fos el títol) i la data i l'hora cada una a la seva
  // línia.
  const isBolo = !c.kind || c.kind === "bolo";
  return (
    <div className="cd-poster bento-next-poster" style={accentVars} onClick={(e) => e.stopPropagation()}>
      <div className="cd-poster-glow" aria-hidden="true"></div>
      {(c.venue || c.city) && (
        <GigLocationMap venue={c.venue} city={c.city} accent={band.color1 || "#8b7bff"} />
      )}
      <div className="cd-poster-kicker">{c.bandName}</div>
      <div className="cd-poster-subtitle">{c.festaEntitat || (c.kind && c.kind !== "bolo" ? (c.kind === "reunio" ? "reunió" : c.kind) : "concert")}</div>
      {isBolo ? (
        <>
          {c.city && <div className="cd-poster-title">{c.city.split(",")[0]}</div>}
          {c.venue && (
            <a
              className="cd-poster-place" onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.venue, c.address, c.city].filter(Boolean).join(", "))}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              {c.venue}
            </a>
          )}
          <div className="cd-poster-date">{dayFull}{c.exactTime ? ` — ${c.exactTime}` : c.time ? ` — ${formatConcertTime(c.time)}` : ""}</div>
          {(callPhase || concertPhase) && (
            <div className="bento-next-sched">
              {callPhase && <div className="bento-next-sched-row"><span>{callPhase.phase}</span><b>{callPhase.start}</b></div>}
              {concertPhase && <div className="bento-next-sched-row"><span>{concertPhase.phase}</span><b>{concertPhase.start}</b></div>}
            </div>
          )}
        </>
      ) : (
        <>
          {(c.venue || c.city) && <div className="cd-poster-title">{c.venue || c.city!.split(",")[0]}</div>}
          <div className="cd-poster-date">{dayFull}</div>
          {(c.exactTime || c.time) && <div className="cd-poster-time">{c.exactTime || formatConcertTime(c.time)}</div>}
        </>
      )}
      <div className="bento-next-actions" onClick={(e) => e.stopPropagation()}>
        {isBolo && <Link className="btn-outline bento-next-icon-btn" href={`/concerts/${c.id}/dia`} title="Dia de bolo"><InfoIcon /></Link>}
        <SetlistButton c={c} band={band} setlists={setlists} songs={songs} canEdit={canEditSetlists} iconBtnClass="btn-outline bento-next-icon-btn" />
        {isBolo && <DiaTopActions concert={c} band={band} base={base} iconBtnClass="btn-outline bento-next-icon-btn" onInstagramClick={() => setPosterEditorOpen(true)} />}
      </div>
    </div>
  );
}

// Fila de músics o de crew a la pestanya Equip: sempre en una sola línia
// (mai es trenca en diverses files) — si n'hi ha més dels que hi caben,
// unes fletxes hi passen d'un en un, amb la mateixa animació de
// desplaçament que la previsualització de la pestanya Inici.
// Controls/barra d'assistència d'una fila de la llista de bolos a Inici —
// component propi (no una funció imbricada dins GroupHomeView) amb el seu
// propi estat local de resposta i d'edició: en clicar Hi seré/No hi seré
// només es torna a renderitzar aquesta petita peça, no tota la pàgina
// (que amb els seus gràfics GSAP i graelles triga uns instants a
// refer-se) — això és el que feia que el canvi trigués a veure's.
function GigAttendance({
  concertId, isMgr, myName, myExcluded, serverAns, km, attTotal, attYes, attNo,
  attYesNames, attNoPlainNames, attNoSubNames, attPendingNames, attSubs,
  onShowTooltip, onHideTooltip,
}: {
  concertId: string;
  isMgr: boolean;
  myName: string;
  myExcluded: boolean;
  serverAns: string | undefined;
  km: { label: string; color: string; bg: string };
  attTotal: number;
  attYes: number;
  attNo: number;
  attYesNames: string[];
  attNoPlainNames: string[];
  attNoSubNames: string[];
  attPendingNames: string[];
  attSubs: Record<string, string>;
  onShowTooltip: (rect: DOMRect, content: React.ReactNode) => void;
  onHideTooltip: () => void;
}) {
  const [override, setOverride] = useState<"yes" | "no" | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [hovering, setHovering] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const myAns = override !== undefined ? override : serverAns;

  // Si aquesta peça desapareix (p. ex. la llista es torna a ordenar/filtrar
  // mentre el cursor hi era a sobre), evita que el tooltip es quedi "penjat"
  // visible sense que el cursor hi sigui realment a sobre.
  useEffect(() => onHideTooltip, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ajusta el recompte del servidor amb la teva pròpia resposta nova
  // (encara no reflectida al prop del servidor), per a que la barra es
  // vegi actualitzada a l'instant en comptes d'esperar el proper refresc.
  let adjYes = attYes;
  let adjNo = attNo;
  if (override !== undefined && override !== serverAns) {
    if (serverAns === "yes") adjYes--;
    if (serverAns === "no") adjNo--;
    if (override === "yes") adjYes++;
    if (override === "no") adjNo++;
  }
  const attYesPct = attTotal ? (adjYes / attTotal) * 100 : 0;
  const attNoPct = attTotal ? (adjNo / attTotal) * 100 : 0;

  // La llista de noms del tooltip, també ajustada amb la teva pròpia
  // resposta nova — així, si el tornes a obrir (o ja l'estaves passant per
  // sobre quan has triat), es veu a l'instant a on apareixes tu, sense
  // esperar el proper refresc del servidor.
  let tipYes = attYesNames, tipNoPlain = attNoPlainNames, tipNoSub = attNoSubNames, tipPending = attPendingNames;
  if (override !== undefined && override !== serverAns && myName) {
    tipYes = tipYes.filter((n) => n !== myName);
    tipNoPlain = tipNoPlain.filter((n) => n !== myName);
    tipNoSub = tipNoSub.filter((n) => n !== myName);
    tipPending = tipPending.filter((n) => n !== myName);
    if (override === "yes") tipYes = [...tipYes, myName];
    else if (override === "no") { if (attSubs[myName]) tipNoSub = [...tipNoSub, myName]; else tipNoPlain = [...tipNoPlain, myName]; }
    else tipPending = [...tipPending, myName];
  }
  function tooltipContent() {
    return (
      <>
        <div className="cc-att-tooltip-title">Assistència:</div>
        <div className="cc-att-tooltip-list">
          {tipYes.map((n) => <span key={n} className="cd-att-bubble yes">✓ {n}</span>)}
          {tipNoPlain.map((n) => <span key={n} className="cd-att-bubble no">✕ {n}</span>)}
          {tipNoSub.map((n) => (
            <span key={n} className="cd-att-bubble" style={{ background: "oklch(0.7 0.14 230 / 0.16)", color: "oklch(0.76 0.13 230)" }}>
              ✕ {n} → {attSubs[n]}
            </span>
          ))}
          {tipPending.map((n) => (
            <span key={n} className="cd-att-bubble pending">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", flex: "none" }}>
                <path d="M5 22h14"></path><path d="M5 2h14"></path>
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path>
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path>
              </svg>
              {n}
            </span>
          ))}
        </div>
      </>
    );
  }
  // Si el tooltip ja era obert (o acabes de confirmar amb el cursor
  // encara a sobre), el torna a mostrar amb el contingut ja actualitzat en
  // comptes d'esperar un nou "mouseenter" (que no sempre arriba si el
  // cursor no es mou, p. ex. en clicar Hi seré/No hi seré).
  useEffect(() => {
    if (hovering && barRef.current) onShowTooltip(barRef.current.getBoundingClientRect(), tooltipContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovering, override, serverAns]);

  if (isMgr || !myName) {
    return <span className="badge" style={{ marginLeft: "auto", background: km.bg, color: km.color }}>{km.label}</span>;
  }
  if (myExcluded) {
    return <span className="t-dim bento-gig-att" style={{ marginLeft: "auto" }}>No convocat</span>;
  }
  if (!myAns || editing) {
    return (
      <span className="bento-gig-att cd-att-controls" style={{ marginTop: 0 }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button" className={"cd-att-btn cd-att-icon-btn yes" + (myAns === "yes" ? " active" : "")}
          title={myAns === "yes" ? "Hi seré — toca per treure la resposta" : "Hi seré"}
          onClick={() => {
            const next = myAns === "yes" ? null : "yes";
            setOverride(next);
            setEditing(false);
            setHovering(true);
            setMyAttendanceAction(concertId, next);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <button
          type="button" className={"cd-att-btn cd-att-icon-btn no" + (myAns === "no" ? " active" : "")}
          title={myAns === "no" ? "No hi seré — toca per treure la resposta" : "No hi seré"}
          onClick={() => {
            const next = myAns === "no" ? null : "no";
            setOverride(next);
            setEditing(false);
            setHovering(true);
            setMyAttendanceAction(concertId, next);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </span>
    );
  }
  return (
    <div
      ref={barRef}
      className="cc-att bento-gig-att" style={{ cursor: "pointer" }} title="Toca per canviar la teva resposta"
      onClick={(e) => { e.stopPropagation(); setHovering(false); onHideTooltip(); setEditing(true); }}
      onMouseEnter={(e) => { setHovering(true); onShowTooltip(e.currentTarget.getBoundingClientRect(), tooltipContent()); }}
      onMouseLeave={() => { setHovering(false); onHideTooltip(); }}
    >
      <div className="cc-att-track">
        <div className="cc-att-fill" style={{ width: attYesPct + "%", background: "oklch(0.72 0.15 155)" }}></div>
        <div className="cc-att-fill" style={{ width: attNoPct + "%", background: "var(--red)" }}></div>
      </div>
      <div className="cc-att-count">{adjYes}/{attTotal}</div>
    </div>
  );
}

// Fila de permisos que el gestor commuta a la targeta de cada membre: què
// pot crear (cançons, riders, setlists), si pot afegir gent i esdeveniments.
function PermsRow({ bandId, member }: { bandId: string; member: Person }) {
  const router = useRouter();
  const [perms, setPerms] = useState<MemberPerms>(() => memberPerms(member));
  return (
    <div className="perm-row" title="Què pot fer aquest membre">
      {PERM_LABELS.map(({ key, label }) => (
        <button
          key={key} type="button"
          className={"perm-chip" + (perms[key] ? " on" : "")}
          title={`${label}: ${perms[key] ? "permès (clic per treure)" : "no permès (clic per donar)"}`}
          onClick={async () => {
            const v = !perms[key];
            setPerms((p) => ({ ...p, [key]: v }));
            await setMemberPermAction(bandId, member.name, key, v);
            router.refresh();
          }}
        >{label}</button>
      ))}
    </div>
  );
}

// Fila d'una persona de l'equip (músic o crew), mateix format que els
// suplents: foto, nom, instrument(s) o càrrec — el clic obre el perfil.
function TeamMemberRow({ person, kind, band, onOpen, photosByName, linked, onInvite, editing, onEditClick, onRemoveClick }: {
  person: Person;
  kind: "member" | "crew";
  band: Band;
  onOpen: (name: string) => void;
  photosByName: Record<string, string>;
  linked: boolean;
  onInvite?: (name: string) => void;
  editing: boolean;
  onEditClick: () => void;
  onRemoveClick: () => void;
}) {
  const inss = instrumentsFor(person);
  const c1 = band.color1 || bandColor(band.id).color;
  const c2 = band.color2 || bandColor(band.id + "x").color;
  const photoId = photosByName[normalize(person.name)];
  return (
    <div className="backup-row">
      <button type="button" className="backup-row-click" onClick={() => (editing ? onEditClick() : onOpen(person.name))}>
        <img
          className="member-photo backup-photo"
          src={photoId ? `/api/file/${photoId}` : personPhotoDataUriColored(person.name, c1, c2)}
          alt=""
        />
        <div className="backup-row-main">
          <div className="member-name">{person.name}{linked && <VerifiedTick size={12} />}</div>
          {kind === "member"
            ? (inss.length > 0 ? <InstrumentChips items={inss} /> : <span className="badge sm">Músic</span>)
            : <span className="badge sm">{person.role || "Crew"}</span>}
        </div>
      </button>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {person.phone && <span className="t-dim" style={{ fontSize: 12 }}>{person.phone}</span>}
        {!linked && onInvite && (
          <button type="button" className="row-delete-btn" title="Convida a reclamar aquest perfil" onClick={() => onInvite(person.name)}>{ICON_LINK}</button>
        )}
        {editing && (
          <button type="button" className="row-delete-btn" title="Elimina" onClick={onRemoveClick}>
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// Pestanya Permisos (gestor): taula amb tothom del grup a les files i cada
// permís de l'app a les columnes — cada casella és un interruptor que dona
// o treu aquell permís a l'instant.
function PermsMatrix({ band, photosByName, linkedNames, isManager, myName }: {
  band: Band;
  photosByName: Record<string, string>;
  linkedNames: Set<string>; // noms normalitzats amb compte vinculat
  isManager: boolean;
  myName: string;
}) {
  const router = useRouter();
  const people = useMemo(() => {
    const seen = new Set<string>();
    const out: { p: Person; kind: "member" | "crew" }[] = [];
    band.members.forEach((p) => { const k = normalize(p.name); if (!seen.has(k)) { seen.add(k); out.push({ p, kind: "member" }); } });
    band.crew.forEach((p) => { const k = normalize(p.name); if (!seen.has(k)) { seen.add(k); out.push({ p, kind: "crew" }); } });
    return out;
  }, [band]);
  const [perms, setPerms] = useState<Record<string, MemberPerms>>(() => Object.fromEntries(people.map(({ p }) => [p.name, memberPerms(p)])));
  const [busy, setBusy] = useState<string | null>(null);
  const c1 = band.color1 || bandColor(band.id).color;
  const c2 = band.color2 || bandColor(band.id + "x").color;

  // Un membre amb el permís "Permisos" (no gestor) pot canviar els dels
  // altres, mai els seus — si no, es donaria tots els permisos a si mateix.
  function canEdit(name: string): boolean {
    return isManager || normalize(name) !== normalize(myName);
  }
  async function toggle(name: string, key: keyof MemberPerms) {
    if (!canEdit(name)) return;
    const v = !perms[name]?.[key];
    setPerms((prev) => ({ ...prev, [name]: { ...(prev[name] || memberPerms(null)), [key]: v } }));
    setBusy(name + key);
    await setMemberPermAction(band.id, name, key, v);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="panel">
      <div className="panel-title" style={{ marginBottom: 4 }}>Permisos</div>
      <div className="t-dim" style={{ fontSize: 12.5, marginBottom: 14 }}>
        Què pot fer cada persona del grup dins l&apos;app. Toca un interruptor per donar o treure el permís — s&apos;aplica a l&apos;instant.
        <strong> Admin</strong> ho inclou tot; <strong>Permisos</strong> deixa veure aquesta pestanya i canviar els permisos dels altres;
        <strong> Treure gent</strong> mostra el botó &ldquo;Edita membres&rdquo; a l&apos;equip.
      </div>
      {people.length === 0 ? (
        <div className="t-dim" style={{ fontSize: 13 }}>Aquest grup encara no té ningú a l&apos;equip.</div>
      ) : (
        <div className="perm-table-wrap">
          <table className="perm-table">
            <thead>
              <tr>
                <th>Persona</th>
                {PERM_LABELS.map((l) => <th key={l.key}>{l.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {people.map(({ p, kind }) => {
                const photoId = photosByName[normalize(p.name)];
                const sub = kind === "member" ? (instrumentsFor(p).join(", ") || "Músic") : (p.role || "Crew");
                const rowIsAdmin = !!perms[p.name]?.admin;
                return (
                  <tr key={p.name}>
                    <td>
                      <div className="perm-person">
                        <img src={photoId ? `/api/file/${photoId}` : personPhotoDataUriColored(p.name, c1, c2)} alt="" />
                        <div style={{ minWidth: 0 }}>
                          <div className="member-name">
                            {p.name}
                            {rowIsAdmin && (
                              <svg className="perm-admin-star" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-label="Admin">
                                <title>Admin</title>
                                <polygon points="12 2 15.09 8.63 22 9.24 16.5 13.97 18.18 21 12 17.27 5.82 21 7.5 13.97 2 9.24 8.91 8.63 12 2" />
                              </svg>
                            )}
                            {linkedNames.has(normalize(p.name)) && <VerifiedTick size={12} />}
                          </div>
                          <div className="t-dim" style={{ fontSize: 11 }}>{sub}</div>
                        </div>
                      </div>
                    </td>
                    {PERM_LABELS.map((l) => {
                      // "Admin" ho inclou tot: la resta d'interruptors es veuen
                      // encesos però no es poden tocar mentre sigui admin.
                      const isAdmin = !!perms[p.name]?.admin;
                      const implied = isAdmin && l.key !== "admin";
                      const on = implied || !!perms[p.name]?.[l.key];
                      const locked = implied || !canEdit(p.name);
                      return (
                        <td key={l.key}>
                          <button
                            type="button" role="switch" aria-checked={on}
                            className={"perm-switch" + (on ? " on" : "") + (implied ? " implied" : "")}
                            disabled={locked || busy === p.name + l.key}
                            title={implied ? "Inclòs a Admin" : !canEdit(p.name) ? "No pots canviar els teus propis permisos" : `${l.label}: ${on ? "sí (toca per treure)" : "no (toca per donar)"}`}
                            onClick={() => toggle(p.name, l.key)}
                          >
                            <span className="perm-switch-knob"></span>
                            <span className="perm-switch-text">{on ? "Sí" : "No"}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InstrumentChips({ items }: { items: string[] }) {
  return (
    <div className="member-instruments">
      {items.slice(0, 3).map((ins) => {
        const icon = instrumentIconFor(ins);
        return (
          <span key={ins} className="member-instrument-chip" title={ins}>
            {icon && <img src={icon} alt="" />}
            {ins}
          </span>
        );
      })}
      {items.length > 3 && <span className="member-instrument-chip">+{items.length - 3}</span>}
    </div>
  );
}

export default function GroupHomeView({ band, allBands, concerts, linkedMembers, backupRequests, concertCountByPerson, riders, setlists, editors, songs, files, formations = [], contacts = [], contactInteractions = [], photosByName = {}, igByName = {}, viewer = "manager", caps, myName = "", socialPrev = {}, today, agencyOwner = false }: {
  band: Band;
  allBands: Band[];
  concerts: Concert[];
  linkedMembers: LinkedMember[];
  backupRequests: BackupRequest[];
  concertCountByPerson: Record<string, number>;
  riders: Rider[];
  setlists: Setlist[];
  editors: BandEditor[];
  songs: Song[];
  files: BandFile[];
  formations?: Formation[];
  // Contactes de l'agència — vegeu el permís "Contactes".
  contacts?: Contact[];
  contactInteractions?: ContactInteraction[];
  photosByName?: Record<string, string>;
  igByName?: Record<string, string>;
  viewer?: "manager" | "artist";
  caps?: MemberPerms;
  myName?: string;
  // Xifres de xarxes del mes passat (per als "+123 aquest mes" d'Inici).
  socialPrev?: Partial<SocialStats>;
  today: string;
  // Admin de l'agència: pot eliminar el grup sencer des d'"Edita el grup".
  agencyOwner?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMgr = viewer === "manager";
  const base = isMgr ? "" : "/artista"; // rutes de l'àrea d'artista
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [formationEditorOpen, setFormationEditorOpen] = useState(false);
  const [editingFormation, setEditingFormation] = useState<Formation | null>(null);
  const can: MemberPerms = isMgr ? { ...ALL_PERMS } : (caps || { ...DEFAULT_PERMS });
  // Un membre amb el permís "Admin" veu i pot editar exactament el mateix
  // que el gestor dins d'aquest grup (equip, aparença, codi d'unió,
  // suplents...) — mai fora d'ell (routing/"base" es queda lligat a
  // viewer, mai a isAdminLike). Les accions del servidor que desbloqueja
  // ja accepten un membre "admin" del grup, no només el gestor (vegeu
  // requireBandAccess(bandId, "admin") a grup/actions.ts i grups/actions.ts).
  const isAdminLike = isMgr || can.admin;
  // La pestanya inicial es pot indicar per URL (p. ex. ?tab=cancons), com
  // quan es torna de l'editor d'una cançó cap a l'apartat de cançons del grup.
  const initialTabParam = searchParams.get("tab");
  const initialTab = initialTabParam === "equip" || initialTabParam === "cancons" || initialTabParam === "documents" || initialTabParam === "permisos" || initialTabParam === "contactes" ? initialTabParam : "inici";
  const [tab, setTab] = useState<"inici" | "equip" | "cancons" | "documents" | "permisos" | "contactes">(initialTab);
  // Tooltip d'assistència d'una fila: via portal a <body> perquè el
  // "transform" que posa el hover de la targeta (.magic-bento-card) no el
  // deixi tapat per la targeta veïna (context d'apilament nou).
  const [attTooltip, setAttTooltip] = useState<{ rect: DOMRect; content: React.ReactNode } | null>(null);
  // Xarxes socials (Inici): només lectura — es connecten i s'editen des de
  // la pàgina de xarxes del grup (/grup/xarxes), i el cron diari les manté
  // al dia.
  const socialStats: SocialStats = band.socialStats || {};
  const trackedPlatforms = SOCIAL_PLATFORMS.filter((p) => isTracked(p, band.socialTracking, band.socialLinks));
  const totalFollowers = trackedPlatforms.reduce((sum, p) => {
    const key = FOLLOWERS_KEY[p];
    return sum + (key ? socialStats[key] || 0 : 0);
  }, 0);
  // Clicar un concert de la llista de "Proper concert" el fa gran (el
  // pòster), en comptes d'obrir la seva fitxa — per defecte, el més proper.
  const [selectedGigId, setSelectedGigId] = useState<string | null>(null);
  // Un cop respost (sí o no), la fila mostra el resum d'assistència del grup
  // en comptes dels botons — tocar-lo torna a mostrar els botons per si es
  // vol canviar la resposta.
  // Pàgina pública del grup (es crea l'enllaç el primer cop que s'obre).
  const [shareBusy, setShareBusy] = useState(false);
  async function sharePublicPage() {
    setShareBusy(true);
    const { token } = await openBandPublicPageAction(band.id);
    router.push(`/g/${token}`);
  }
  const [editOpen, setEditOpen] = useState(false);
  const [addKind, setAddKind] = useState<"member" | "crew" | null>(null);
  const [addForm, setAddForm] = useState<{ name: string; instruments: string[]; role: string; phone: string; email: string }>({ name: "", instruments: [], role: "", phone: "", email: "" });
  const [addSaving, setAddSaving] = useState(false);
  // "Edita membres" (pestanya Equip): en mode edició, clicar una targeta
  // obre el diàleg per treure la persona del grup o passar-la a suplents
  // (només els músics) — cal el permís "Treure gent".
  const [teamEdit, setTeamEdit] = useState(false);
  const [teamTarget, setTeamTarget] = useState<{ person: Person; kind: "member" | "crew" } | null>(null);
  const [teamStep, setTeamStep] = useState<"choose" | "remove">("choose");
  const [teamBusy, setTeamBusy] = useState(false);
  function openTeamTarget(person: Person, kind: "member" | "crew") {
    setTeamTarget({ person, kind });
    setTeamStep("choose");
  }
  // La paperera que surt en passar el cursor per una targeta en mode
  // edició va directa al missatge d'eliminar, sense passar per la tria
  // "treu / passa a suplent" (aquesta encara hi és clicant la targeta).
  function openTeamRemove(person: Person, kind: "member" | "crew") {
    setTeamTarget({ person, kind });
    setTeamStep("remove");
  }
  async function removeTeamPerson() {
    if (!teamTarget) return;
    setTeamBusy(true);
    try {
      await removeBandPersonAction(band.id, teamTarget.kind, teamTarget.person.name);
      setTeamTarget(null);
      router.refresh();
    } catch (err) {
      alert(String(err instanceof Error ? err.message : err));
    }
    setTeamBusy(false);
  }
  async function moveTeamPersonToBackups() {
    if (!teamTarget) return;
    setTeamBusy(true);
    try {
      const res = await moveMemberToBackupsAction(band.id, teamTarget.person.name);
      setBackups(res.backups);
      setTeamTarget(null);
      router.refresh();
    } catch (err) {
      alert(String(err instanceof Error ? err.message : err));
    }
    setTeamBusy(false);
  }
  const [joinCopied, setJoinCopied] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  // El codi acabat de generar es mostra a l'instant amb el que retorna
  // l'action, sense esperar un router.refresh() — així mai depèn d'un
  // recarregat de la pàgina i et quedes exactament on eres.
  const [localJoinCode, setLocalJoinCode] = useState<string | null>(null);
  const effectiveJoinCode = localJoinCode ?? band.joinCode;
  const effectiveJoinActive = localJoinCode ? true : band.joinCodeActive;
  // Genera el codi d'unió (i el regenera: el codi anterior deixa de valer).
  async function handleGenerateCode() {
    setCodeBusy(true);
    const code = await generateJoinCodeAction(band.id);
    if (code) setLocalJoinCode(code);
    setCodeBusy(false);
  }
  const [backups, setBackups] = useState<BackupPerson[]>(() =>
    ((band as unknown as { backups?: BackupPerson[] }).backups || []).map((b) => ({ name: b.name || "", instruments: b.instruments || [], phone: b.phone || "", email: b.email || "" }))
  );
  const [backupDraft, setBackupDraft] = useState<BackupPerson | null>(null);
  const [savingBackups, setSavingBackups] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => (band.vehicles || []).map((v) => ({ type: v.type || "", brand: v.brand || "", color: v.color || "", owner: v.owner || "", plate: v.plate || "" })));
  const [vehicleDraft, setVehicleDraft] = useState<Vehicle | null>(null);
  const [editingVehicleIndex, setEditingVehicleIndex] = useState<number | null>(null);
  const [savingVehicles, setSavingVehicles] = useState(false);
  async function persistVehicles(next: Vehicle[]) {
    setSavingVehicles(true);
    setVehicles(next);
    await saveBandVehiclesAction(band.id, next);
    router.refresh();
    setSavingVehicles(false);
  }

  const total = concerts.filter((c) => c.status !== "cancel·lat").length;
  const upcoming = concerts
    .filter((c) => c.date >= today && c.status !== "cancel·lat")
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  // Recompte per tipus (mateix estil de píndoles que "Propers esdeveniments"
  // a la pestanya Esdeveniments) i quants, dels propers, encara esperen la
  // teva resposta d'assistència — per al peu de la targeta.
  const upcomingKindCounts: Record<string, number> = { bolo: 0, assaig: 0, reunio: 0, altre: 0 };
  upcoming.forEach((c) => { const k = c.kind && KIND_META[c.kind] ? c.kind : "bolo"; upcomingKindCounts[k] = (upcomingKindCounts[k] || 0) + 1; });
  const pendingCount = !isMgr && myName ? upcoming.filter((c) => {
    const k = c.kind && KIND_META[c.kind] ? c.kind : "bolo";
    const excluded = !!(c.convocatoriaExcluded || {})[myName] ||
      (k !== "bolo" && !((c.invited || []).length === 0 || (c.invited || []).includes(myName)));
    if (excluded) return false;
    const ans = (c.attendance || {})[myName];
    return ans !== "yes" && ans !== "no";
  }).length : 0;
  // Finestra fixa (els 6 més propers): triar-ne un com a gran no en fa
  // entrar cap altre de nou a la llista, només li canvia el format al que
  // ja hi era — l'ordre i el conjunt es queden sempre igual.
  const shownGigs = upcoming.slice(0, 6);
  // Per defecte no hi ha cap bànner gran: la llista surt sencera i, en
  // clicar una fila, es desplega el pòster just a sota (tornar-la a clicar
  // el replega).
  const heroGig = shownGigs.find((c) => c.id === selectedGigId) || null;
  function renderGigRow(c: Concert) {
    const myAns = myName ? (c.attendance || {})[myName] : undefined;
    // Tipus (bolo/assaig/reunió/altres) i el seu color — substitueix
    // l'estat (confirmat/pendent...) a la insígnia, i tenyeix també la data.
    const k = c.kind && KIND_META[c.kind] ? c.kind : "bolo";
    const km = KIND_META[k];
    // Resum d'assistència del grup (mateix càlcul que la columna
    // "Assistència" de la taula de Concerts) — es mostra un cop has
    // respost, en comptes dels botons.
    const attExcluded = c.convocatoriaExcluded || {};
    const attPeople = bandRoster(band).filter((p) => !attExcluded[p.name]);
    const attTotal = attPeople.length;
    const attendanceMap = c.attendance || {};
    const attSubs = c.substitutes || {};
    const attYesNames = attPeople.filter((p) => attendanceMap[p.name] === "yes").map((p) => p.name);
    const attNoNames = attPeople.filter((p) => attendanceMap[p.name] === "no").map((p) => p.name);
    const attNoSubNames = attNoNames.filter((n) => attSubs[n]);
    const attNoPlainNames = attNoNames.filter((n) => !attSubs[n]);
    const attPendingNames = attPeople.filter((p) => attendanceMap[p.name] !== "yes" && attendanceMap[p.name] !== "no").map((p) => p.name);
    const attYes = attYesNames.length;
    // Exclòs d'aquest bolo en concret, o fora de la llista d'invitats d'un
    // assaig/reunió/altre — en qualsevol cas, no hi estàs convocat.
    const myExcluded = !isMgr && !!myName && (
      !!attExcluded[myName] || (k !== "bolo" && !((c.invited || []).length === 0 || (c.invited || []).includes(myName)))
    );
    return (
      <div
        key={c.id} className={"bento-gig" + (selectedGigId === c.id ? " selected" : "") + (myExcluded ? " t-row-not-convoked" : "")}
        onClick={(e) => { e.stopPropagation(); setSelectedGigId((v) => (v === c.id ? null : c.id)); }}
      >
        <span className="bento-gig-date" style={{ color: km.color }}>{formatDateShort(c.date)}</span>
        <span className="bento-gig-place">{c.city || c.venue || "—"}{c.venue && c.city ? ` · ${c.venue}` : ""}</span>
        <GigAttendance
          concertId={c.id} isMgr={isMgr} myName={myName} myExcluded={myExcluded} serverAns={myAns} km={km}
          attTotal={attTotal} attYes={attYes} attNo={attNoNames.length}
          attYesNames={attYesNames} attNoPlainNames={attNoPlainNames} attNoSubNames={attNoSubNames} attPendingNames={attPendingNames} attSubs={attSubs}
          onShowTooltip={(rect, content) => setAttTooltip({ rect, content })}
          onHideTooltip={() => setAttTooltip(null)}
        />
      </div>
    );
  }
  const linkedByName: Record<string, LinkedMember> = {};
  linkedMembers.forEach((m) => { linkedByName[m.memberName] = m; });
  const linkedNameSet = new Set(linkedMembers.map((m) => normalize(m.memberName)));

  const openRequests = backupRequests.filter((r) => r.status === "oberta");
  const concertsById: Record<string, Concert> = {};
  concerts.forEach((c) => { concertsById[c.id] = c; });

  // Obre la pàgina de perfil compartible de la persona.
  async function openProfile(name: string) {
    const { token } = await openPersonProfileAction(name);
    router.push(`/p/${token}`);
  }

  // Convida algú (per correu) a reclamar un perfil creat a mà.
  async function handleInvite(name: string) {
    const email = window.prompt(`Correu de ${name} perquè reclami aquest perfil quan es registri a Escenari:`);
    if (!email) return;
    const res = await invitePersonAction(band.id, name, email);
    alert(res.ok ? `Invitació creada: quan ${email} es registri i l'accepti, quedarà vinculat a "${name}".` : res.error);
    router.refresh();
  }

  async function handleAddPerson() {
    if (!addForm.name.trim() || !addKind) return;
    setAddSaving(true);
    try {
      await addBandPersonAction(band.id, addKind, {
        name: addForm.name,
        role: addForm.role,
        instruments: addForm.instruments,
        phone: addForm.phone,
        email: addForm.email,
      });
      setAddForm({ name: "", instruments: [], role: "", phone: "", email: "" });
      setAddKind(null);
      router.refresh();
    } catch (err) {
      alert(String(err instanceof Error ? err.message : err));
    }
    setAddSaving(false);
  }

  const memberEmails = band.members.map((m) => m.email).filter(Boolean) as string[];
  // Enllaç d'invitació (en comptes de fer escriure el codi a mà): si qui el
  // clica ja té compte, li mostra la pàgina com si hagués introduït el codi;
  // si no, li surt una pantalla per crear el perfil abans d'entrar-hi.
  const joinLink = () => (typeof window !== "undefined" ? window.location.origin : "") + `/u/${effectiveJoinCode}`;
  const joinMsg = (rol: "membre" | "tècnic") =>
    `Uneix-te a ${band.name} a Escenari com a ${rol}: ${joinLink()}`;

  async function persistBackups(next: BackupPerson[]) {
    setSavingBackups(true);
    setBackups(next);
    await saveBandBackupsAction(band.id, next);
    router.refresh();
    setSavingBackups(false);
  }

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      {/* Capçalera estil LinkedIn: portada ampla + logo superposat */}
      <div className="group-hero-li" style={{ ["--band-accent" as string]: band.color1 || "#8b7bff" }}>
        <div
          className="group-cover"
          style={{
            backgroundImage: band.coverUrl
              ? `url(${band.coverUrl})`
              : `linear-gradient(120deg, ${band.color1 || "#8b7bff"}, ${band.color2 || "#3b3358"})`,
            backgroundPosition: band.coverPos || "50% 50%",
          }}
        ></div>
        <div className="group-hero-li-row">
          <img className="group-hero-li-logo" style={logoBox(band.logoAspect, 96)} src={band.logo || bandPhotoDataUri(band)} alt={band.name} />
          <div className="group-hero-li-main">
            <div className="group-hero-name">{band.name}</div>
            <div className="group-hero-tags">
              {(band.tags || []).map((t) => {
                const tc = tagColors(t);
                return <span key={t} className="badge" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
              })}
            </div>
          </div>
          <div className="group-hero-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn-outline" disabled={shareBusy} onClick={sharePublicPage} title="Pàgina pública del grup, per compartir amb qui vulguis">
              {shareBusy ? "Obrint…" : "Comparteix"}
            </button>
            {isAdminLike && <button type="button" className="btn-outline" onClick={() => setEditOpen(true)}>Edita el grup</button>}
          </div>
        </div>
      </div>

      {/* Subtabs */}
      <div className="stats-tabs group-tabs">
        <button className={"stats-tab" + (tab === "inici" ? " active" : "")} onClick={() => setTab("inici")}>Inici</button>
        <button className={"stats-tab" + (tab === "equip" ? " active" : "")} onClick={() => setTab("equip")}>Equip</button>
        <button className={"stats-tab" + (tab === "cancons" ? " active" : "")} onClick={() => setTab("cancons")}>Cançons</button>
        <button className={"stats-tab" + (tab === "documents" ? " active" : "")} onClick={() => setTab("documents")}>Documents</button>
        {can.contacts && <button className={"stats-tab" + (tab === "contactes" ? " active" : "")} onClick={() => setTab("contactes")}>Contactes</button>}
        {(isMgr || can.perms) && <button className={"stats-tab" + (tab === "permisos" ? " active" : "")} onClick={() => setTab("permisos")}>Permisos</button>}
      </div>

      {attTooltip && typeof document !== "undefined" && createPortal(
        <div
          className="cc-att-tooltip cc-att-tooltip-portal"
          style={{
            top: attTooltip.rect.bottom + 8,
            left: attTooltip.rect.left + attTooltip.rect.width / 2,
          }}
        >
          {attTooltip.content}
        </div>,
        document.body
      )}

      {tab === "inici" && (
        <BentoGrid
          cards={([
            // Primera targeta (amplada completa), sempre hi és: el proper
            // concert amb l'estil de pòster, i sota, els 5 següents en la
            // mateixa llista compacta que abans hi havia a "Agenda".
            {
              key: "proper",
              label: (
                <span className="bento-next-label-pills">
                  <span>Propers esdeveniments</span>
                  {KIND_ORDER.filter((k) => upcomingKindCounts[k] > 0).map((k) => (
                    <span key={k} className="cc-kind concerts-kind-count" style={{ background: KIND_META[k].bg, color: KIND_META[k].color }}>
                      {KIND_PLURAL[k]}
                      <span className="concerts-section-divider-count">{upcomingKindCounts[k]}</span>
                    </span>
                  ))}
                </span>
              ),
              colSpan: 2,
              rowSpan: 2,
              className: "bento-next",
              onClick: () => router.push(base + "/agenda"),
              content: (
                <div className="bento-next-body">
                  {upcoming.length === 0 ? (
                    <span className="t-dim" style={{ fontSize: 12.5 }}>Cap bolo programat.</span>
                  ) : (
                    <div className="bento-gigs bento-next-list">
                      {shownGigs.map((c) => (
                        <div key={c.id} className="bento-gig-wrap">
                          {renderGigRow(c)}
                          {heroGig?.id === c.id && (
                            <NextGigPoster c={heroGig} base={base} band={band} setlists={setlists} songs={songs} canEditSetlists={can.setlists} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bento-next-footer" onClick={(e) => e.stopPropagation()}>
                    {pendingCount > 0 && (
                      <span className="t-dim" style={{ fontSize: 12.5 }}>{pendingCount} pendents de confirmar assistència</span>
                    )}
                    <Link href={base + "/concerts"} className="btn-outline bento-next-all-btn">Tots els esdeveniments</Link>
                  </div>
                </div>
              ),
            },
            {
              key: "xarxes",
              label: "Xarxes socials",
              title: trackedPlatforms.length && totalFollowers ? `${formatNumber(totalFollowers)} seguidors` : "Xarxes socials",
              description: isMgr ? "Connecta les xarxes i mira'n l'evolució mes a mes" : "Seguidors i oients del grup",
              colSpan: 2,
              // Alt només si hi ha prou xarxes per omplir-lo de veres —
              // amb 1 o 2 la targeta s'ajusta a la seva pròpia alçada
              // (vegeu .bento-xarxes, que li treu l'estirament vertical
              // que fan totes les altres targetes del mosaic).
              rowSpan: trackedPlatforms.length > 2 ? 2 : 1,
              className: "bento-xarxes",
              onClick: isMgr ? () => router.push("/grup/xarxes") : undefined,
              content: (
                <div className="bento-social">
                  {trackedPlatforms.length === 0 ? (
                    <span className="t-dim" style={{ fontSize: 12.5 }}>
                      {isMgr ? "Encara no hi ha cap xarxa connectada — toca aquí per afegir-les." : "El grup encara no té cap xarxa connectada."}
                    </span>
                  ) : trackedPlatforms.map((p) => (
                    <div key={p} className={"bento-social-platform" + (p === "spotify" || p === "youtube" ? " wide" : "")}>
                      <div className="bento-social-platform-head">
                        <span className="bento-social-icon" style={{ background: PLATFORM_META[p].gradient }}>{SOCIAL_ICONS[p]}</span>
                        <span className="bento-social-platform-name">{PLATFORM_META[p].label}</span>
                      </div>
                      <div className="bento-social-platform-stats">
                        {PLATFORM_META[p].metrics.map((m) => (
                          <SocialStatBox key={m.key} platform={p} label={m.label} value={socialStats[m.key]} prev={socialPrev[m.key]} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
          ] as BentoCard[])}
        />
      )}

      {tab === "cancons" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SongsPanel band={band} songs={songs} canEdit={can.songs} />
          <SetlistsPanel band={band} setlists={setlists} linkedMembers={linkedMembers} editors={editors} canEdit={can.setlists} isManager={isAdminLike} songs={songs} concerts={concerts} />
        </div>
      )}

      {tab === "documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <RidersPanel band={band} riders={riders} linkedMembers={linkedMembers} editors={editors} canEdit={can.riders} isManager={isAdminLike} />

          {/* Vehicles del grup: es trien a "Matrícules autoritzades" del full
              de ruta en comptes d'escriure-les a mà cada cop. */}
          <div className="panel">
            <div className="panel-header-row" style={{ marginBottom: 14 }}>
              <div className="panel-title">Vehicles del grup{savingVehicles ? " · desant…" : ""}</div>
              {can.members && !vehicleDraft && (
                <button type="button" className="btn-outline" onClick={() => { setVehicleDraft({ type: "", brand: "", color: "", owner: "", plate: "" }); setEditingVehicleIndex(null); }}>+ Afegeix vehicle</button>
              )}
            </div>
            {vehicles.length === 0 && !vehicleDraft ? (
              <div className="t-dim" style={{ fontSize: 13 }}>
                Sense vehicles registrats. Un cop n&apos;hi hagi, els podràs triar directament a &quot;Matrícules autoritzades&quot; del full de ruta de cada bolo.
              </div>
            ) : (
              <div className="backup-list">
                {vehicles.map((v, i) => (
                  <div key={i} className="backup-row">
                    <div className="backup-row-main">
                      <div className="member-name">{[v.type, v.brand, v.color].filter(Boolean).join(" · ") || "—"}</div>
                      <div className="t-dim" style={{ fontSize: 12 }}>{[v.owner, v.plate].filter(Boolean).join(" · ")}</div>
                    </div>
                    {can.members && <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button" className="row-rs-btn" title="Edita el vehicle"
                        onClick={() => { setVehicleDraft(v); setEditingVehicleIndex(i); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                        </svg>
                      </button>
                      <button
                        type="button" className="row-delete-btn" title="Treu el vehicle"
                        onClick={() => persistVehicles(vehicles.filter((_, j) => j !== i))}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>}
                  </div>
                ))}
              </div>
            )}
            {vehicleDraft && (
              <div className="backup-add-form">
                <input className="field-input form-field compact-field" placeholder="Tipus de vehicle (p.ex. Furgoneta)" value={vehicleDraft.type}
                  onChange={(e) => setVehicleDraft({ ...vehicleDraft, type: e.target.value })} />
                <input className="field-input form-field compact-field" placeholder="Marca/model" value={vehicleDraft.brand}
                  onChange={(e) => setVehicleDraft({ ...vehicleDraft, brand: e.target.value })} />
                <input className="field-input form-field compact-field" placeholder="Color" value={vehicleDraft.color}
                  onChange={(e) => setVehicleDraft({ ...vehicleDraft, color: e.target.value })} />
                <input className="field-input form-field compact-field" placeholder="De qui és" value={vehicleDraft.owner}
                  onChange={(e) => setVehicleDraft({ ...vehicleDraft, owner: e.target.value })} />
                <input className="field-input form-field compact-field" placeholder="Matrícula" value={vehicleDraft.plate}
                  onChange={(e) => setVehicleDraft({ ...vehicleDraft, plate: e.target.value })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn-outline" onClick={() => { setVehicleDraft(null); setEditingVehicleIndex(null); }}>Cancel·la</button>
                  <button
                    type="button" className="btn-save"
                    disabled={!vehicleDraft.type.trim() && !vehicleDraft.brand.trim() && !vehicleDraft.color.trim() && !vehicleDraft.owner.trim() && !vehicleDraft.plate.trim()}
                    onClick={async () => {
                      const next = editingVehicleIndex !== null
                        ? vehicles.map((v, j) => (j === editingVehicleIndex ? vehicleDraft : v))
                        : vehicles.concat([vehicleDraft]);
                      await persistVehicles(next);
                      setVehicleDraft(null);
                      setEditingVehicleIndex(null);
                    }}
                  >Desa</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "permisos" && (isMgr || can.perms) && (
        <PermsMatrix band={band} photosByName={photosByName} linkedNames={linkedNameSet} isManager={isAdminLike} myName={myName} />
      )}

      {tab === "contactes" && can.contacts && (
        <ContactesView contacts={contacts} allBands={allBands} concertCountByPerson={concertCountByPerson} interactions={contactInteractions} embedded />
      )}

      {tab === "equip" && (<>
      {/* Músics i crew: dues columnes a l'escriptori (músics a l'esquerra,
          crew a la dreta), apilades en una sola columna al mòbil. */}
      <div className="team-cols">
      {/* Membres */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">Músics <span className="panel-title-count">· {band.members.length} {band.members.length === 1 ? "membre" : "membres"}</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {memberEmails.length > 0 && (
              <a className="icon-round-btn" title={`Correu a tot el grup (${memberEmails.length} adreces)`} aria-label="Correu a tot el grup"
                href={`mailto:?bcc=${encodeURIComponent(memberEmails.join(","))}&subject=${encodeURIComponent(band.name)}`}>
                {ICON_MAIL}
              </a>
            )}
            {can.removeMembers && (band.members.length > 0 || band.crew.length > 0) && (
              <button
                type="button" className={"icon-round-btn" + (teamEdit ? " active" : "")}
                title={teamEdit ? "Fet" : "Edita membres"} aria-label={teamEdit ? "Fet" : "Edita membres"}
                onClick={() => { setTeamEdit((v) => !v); setTeamTarget(null); }}
              >{teamEdit ? ICON_CHECK : ICON_PENCIL}</button>
            )}
            {can.members && addKind !== "member" && (
              <button type="button" className="icon-round-btn" title="Afegeix membre" aria-label="Afegeix membre" onClick={() => setAddKind("member")}>{ICON_PLUS}</button>
            )}
          </div>
        </div>
        {band.members.length === 0 && addKind !== "member" ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Aquest grup encara no té membres — afegeix-ne amb el botó de dalt.</div>
        ) : (
          band.members.length > 0 && (
            <div className={teamEdit ? "team-editing" : undefined}>
              {teamEdit && <div className="team-edit-hint">Clica una persona per treure-la del grup o passar-la a suplents.</div>}
              <div className="backup-list">
                {band.members.map((m) => (
                  <TeamMemberRow
                    key={m.name} person={m} kind="member" band={band} onOpen={openProfile} photosByName={photosByName}
                    linked={!!linkedByName[m.name]} onInvite={isAdminLike ? handleInvite : undefined}
                    editing={teamEdit}
                    onEditClick={() => openTeamTarget(m, "member")}
                    onRemoveClick={() => openTeamRemove(m, "member")}
                  />
                ))}
              </div>
            </div>
          )
        )}
        {addKind === "member" && (
          <div className="fin-form" style={{ marginTop: 14 }}>
            <div className="fin-form-grid">
              <input className="field-input compact-field" placeholder="Nom *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              <input className="field-input compact-field" placeholder="Telèfon" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
              <input className="field-input compact-field" type="email" placeholder="Correu" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Instruments</label>
              <InstrumentPicker value={addForm.instruments} onChange={(next) => setAddForm({ ...addForm, instruments: next })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => setAddKind(null)}>Cancel·la</button>
              <button type="button" className="btn-save" disabled={addSaving || !addForm.name.trim()} onClick={handleAddPerson}>{addSaving ? "Desant…" : "Afegeix membre"}</button>
            </div>
          </div>
        )}
      </div>

      {/* Crew */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">Crew <span className="panel-title-count">· {band.crew.length} {band.crew.length === 1 ? "membre" : "membres"}</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {can.removeMembers && band.crew.length > 0 && (
              <button
                type="button" className={"icon-round-btn" + (teamEdit ? " active" : "")}
                title={teamEdit ? "Fet" : "Edita membres"} aria-label={teamEdit ? "Fet" : "Edita membres"}
                onClick={() => { setTeamEdit((v) => !v); setTeamTarget(null); }}
              >{teamEdit ? ICON_CHECK : ICON_PENCIL}</button>
            )}
            {can.members && addKind !== "crew" && (
              <button type="button" className="icon-round-btn" title="Afegeix tècnic" aria-label="Afegeix tècnic" onClick={() => setAddKind("crew")}>{ICON_PLUS}</button>
            )}
          </div>
        </div>
        {band.crew.length === 0 && addKind !== "crew" ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Sense equip tècnic encara.</div>
        ) : (
          band.crew.length > 0 && (
            <div className={teamEdit ? "team-editing" : undefined}>
              {teamEdit && <div className="team-edit-hint">Clica una persona per treure-la del grup o passar-la a suplents.</div>}
              <div className="backup-list">
                {band.crew.map((m) => (
                  <TeamMemberRow
                    key={m.name} person={m} kind="crew" band={band} onOpen={openProfile} photosByName={photosByName}
                    linked={!!linkedByName[m.name]} onInvite={isAdminLike ? handleInvite : undefined}
                    editing={teamEdit}
                    onEditClick={() => openTeamTarget(m, "crew")}
                    onRemoveClick={() => openTeamRemove(m, "crew")}
                  />
                ))}
              </div>
            </div>
          )
        )}
        {addKind === "crew" && (
          <div className="fin-form" style={{ marginTop: 14 }}>
            <div className="fin-form-grid">
              <input className="field-input compact-field" placeholder="Nom *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
              <input className="field-input compact-field" placeholder="Funció (so, llums, backliner…)" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} />
              <input className="field-input compact-field" placeholder="Telèfon" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
              <input className="field-input compact-field" type="email" placeholder="Correu" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => setAddKind(null)}>Cancel·la</button>
              <button type="button" className="btn-save" disabled={addSaving || !addForm.name.trim()} onClick={handleAddPerson}>{addSaving ? "Desant…" : "Afegeix tècnic"}</button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Suplents */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            Suplents/col·laboradors de confiança <span className="panel-title-count">· {backups.length} {backups.length === 1 ? "membre" : "membres"}</span>
            {savingBackups ? " · desant…" : ""}
          </div>
          {can.members && !backupDraft && (
            <button type="button" className="btn-outline" onClick={() => setBackupDraft({ name: "", instruments: [], phone: "", email: "", role: "" })}>+ Afegeix suplent</button>
          )}
        </div>
        {backups.length === 0 && !backupDraft ? (
          <div className="t-dim" style={{ fontSize: 13 }}>
            Sense suplents. Quan algú digui que no pot venir a un bolo, els suplents d&apos;aquesta llista són la primera opció.
          </div>
        ) : (
          <div className="backup-list">
            {backups.map((b, i) => (
              <div key={i} className="backup-row">
                <button type="button" className="backup-row-click" onClick={() => openProfile(b.name)}>
                  <img className="member-photo backup-photo" src={personPhotoDataUri(b.name)} alt="" />
                  <div className="backup-row-main">
                    <div className="member-name">{b.name}</div>
                    {b.instruments?.length > 0 && <InstrumentChips items={b.instruments} />}
                    {b.role && <span className="badge sm">{b.role}</span>}
                  </div>
                </button>
                <div className="t-dim" style={{ fontSize: 12 }}>{b.phone}</div>
                {can.members && <button
                  type="button" className="row-delete-btn" title="Treu el suplent"
                  onClick={() => persistBackups(backups.filter((_, j) => j !== i))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>}
              </div>
            ))}
          </div>
        )}
        {backupDraft && (
          <div className="backup-add-form">
            <input className="field-input form-field compact-field" placeholder="Nom" value={backupDraft.name}
              onChange={(e) => setBackupDraft({ ...backupDraft, name: e.target.value })} />
            <InstrumentPicker value={backupDraft.instruments}
              onChange={(next) => setBackupDraft({ ...backupDraft, instruments: next })} />
            <input
              className="field-input form-field compact-field" placeholder="Funció de crew (so, llums, backliner…)"
              value={backupDraft.role || ""} onChange={(e) => setBackupDraft({ ...backupDraft, role: e.target.value })}
            />
            <input className="field-input form-field compact-field" placeholder="Telèfon" value={backupDraft.phone}
              onChange={(e) => setBackupDraft({ ...backupDraft, phone: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-outline" onClick={() => setBackupDraft(null)}>Cancel·la</button>
              <button
                type="button" className="btn-save" disabled={!backupDraft.name.trim()}
                onClick={async () => { await persistBackups(backups.concat([backupDraft])); setBackupDraft(null); }}
              >Desa</button>
            </div>
          </div>
        )}
      </div>

      {/* Uneix-te al grup (el gestor, o un membre amb el permís "Admin") */}
      {isAdminLike && (
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 10 }}>Uneix-te al grup</div>
        <div className="t-dim" style={{ fontSize: 13, marginBottom: 12 }}>
          Comparteix el codi o l&apos;enllaç: qui el faci servir quedarà vinculat a aquest grup, com a músic o
          com a tècnic de so segons el que triï en unir-s&apos;hi. Si ja té compte a Escenari, l&apos;enllaç
          l&apos;hi porta directament; si no, primer l&apos;hi fa crear el perfil.
          Si la persona ja existeix aquí creada a mà, usa el botó 🔗 de la seva targeta per convidar-la a reclamar el perfil.
        </div>
        {effectiveJoinActive && effectiveJoinCode ? (
          <>
            <div className="join-box">
              <span className="join-code">{effectiveJoinCode}</span>
              <button type="button" className="btn-outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(joinMsg("membre"));
                  setJoinCopied(true);
                  window.setTimeout(() => setJoinCopied(false), 1600);
                }}>{joinCopied ? "Copiat ✓" : "Copia el missatge"}</button>
              <button type="button" className="btn-outline cd-wa-btn"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(joinMsg("membre"))}`, "_blank")}>WhatsApp</button>
              <button type="button" className="btn-outline" disabled={codeBusy} onClick={handleGenerateCode} title="El codi d'ara deixarà de funcionar">
                {codeBusy ? "Generant…" : "Genera un codi nou"}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn-primary" disabled={codeBusy} onClick={handleGenerateCode}>
            {codeBusy ? "Generant…" : "Genera codi"}
          </button>
        )}
      </div>
      )}

      {/* Cerques de suplent publicades (gestió del gestor) */}
      {isAdminLike && openRequests.length > 0 && (
        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 14 }}>Cerques de suplent obertes</div>
          <div className="backup-request-list">
            {openRequests.map((r) => {
              const c = concertsById[r.concertId];
              return (
                <div key={r.id} className="backup-request-card">
                  <div className="backup-request-head">
                    <div>
                      <div className="member-name">
                        {c ? `${formatDate(c.date)} · ${c.city || c.venue}` : r.concertId}
                      </div>
                      <div className="t-dim" style={{ fontSize: 12 }}>
                        Substitueix: {r.memberName || "—"}{r.instruments.length ? ` (${r.instruments.join(", ")})` : ""}
                      </div>
                    </div>
                    <button type="button" className="btn-outline" onClick={async () => { await setBackupRequestStatusAction(r.id, "cancel·lada"); router.refresh(); }}>
                      Retira la cerca
                    </button>
                  </div>
                  {r.applications.length === 0 ? (
                    <div className="t-dim" style={{ fontSize: 12 }}>Encara sense candidatures — els músics d&apos;Escenari la veuen a la seva borsa de suplències.</div>
                  ) : (
                    <div className="backup-apps">
                      {r.applications.map((a) => (
                        <div key={a.clerkUserId} className="backup-app-row">
                          <button type="button" className="backup-row-click" onClick={() => openProfile(a.name)}>
                            <img className="member-photo backup-photo" src={personPhotoDataUri(a.name)} alt="" />
                            <div className="backup-row-main">
                              <div className="member-name">{a.name}<VerifiedTick size={12} /></div>
                              <InstrumentChips items={a.instruments} />
                              {a.message && <div className="t-dim" style={{ fontSize: 12 }}>&ldquo;{a.message}&rdquo;</div>}
                            </div>
                          </button>
                          {a.status === "pendent" ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" className="btn-save" onClick={async () => { await respondBackupApplicationAction(r.id, a.clerkUserId, "acceptada"); router.refresh(); }}>Accepta</button>
                              <button type="button" className="btn-outline" onClick={async () => { await respondBackupApplicationAction(r.id, a.clerkUserId, "rebutjada"); router.refresh(); }}>Rebutja</button>
                            </div>
                          ) : (
                            <span className="badge">{a.status}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">Formacions <span className="panel-title-count">· {formations.length} {formations.length === 1 ? "formació" : "formacions"}</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(isMgr || can.members) && <button type="button" className="icon-round-btn" title="Nova formació" onClick={() => { setEditingFormation(null); setFormationEditorOpen(true); }}>{ICON_PLUS}</button>}
          </div>
        </div>
        {formations.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Encara no hi ha cap formació creada.</div>
        ) : (
          <div className="backup-list">
            {formations.map((f) => (
              <div
                key={f.id} className="backup-row" style={{ cursor: (isMgr || can.members) ? "pointer" : "default" }}
                onClick={() => { if (isMgr || can.members) { setEditingFormation(f); setFormationEditorOpen(true); } }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {f.preferred && <span title="Formació de preferència">★</span>}
                    <span className="t-strong">{f.name}</span>
                    <span className="t-dim">· {f.slots.length} {f.slots.length === 1 ? "músic" : "músics"}</span>
                  </div>
                  {f.slots.length > 0 && <span className="t-dim" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formationSummary(f)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {formationEditorOpen && (
        <FormationEditor band={band} formation={editingFormation} onClose={() => { setFormationEditorOpen(false); router.refresh(); }} />
      )}

        {!isMgr && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
            <button
              type="button" className="btn-danger-outline"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              onClick={() => setLeaveOpen(true)}
            >
              Abandona el grup
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        )}
      </>)}

      {leaveOpen && (
        <ConfirmDialog
          title="Abandonar el grup?"
          message={<>Deixaràs de ser membre de <strong>{band.name}</strong>. Només hi tornaràs a entrar si et conviden de nou.</>}
          confirmLabel="Abandona" busy={leaveBusy}
          onCancel={() => setLeaveOpen(false)}
          onConfirm={async () => {
            setLeaveBusy(true);
            await leaveBandAction(band.id);
            setLeaveBusy(false);
            setLeaveOpen(false);
            router.push("/els-meus-grups");
          }}
        />
      )}

      {editOpen && (
        <GroupAppearanceModal key={band.id} band={band} canDelete={isMgr && agencyOwner} onClose={() => setEditOpen(false)} />
      )}

      {/* "Edita membres": què fer amb la persona clicada */}
      {teamTarget && (
        <div className="modal-overlay cf-confirm-overlay" onClick={(e) => { e.stopPropagation(); if (!teamBusy) setTeamTarget(null); }}>
          <div className="modal cf-confirm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="cf-confirm-title">{teamTarget.person.name}</div>
            {teamStep === "choose" ? (
              <>
                <div className="cf-confirm-message">Què vols fer amb {teamTarget.person.name.split(" ")[0]}?</div>
                <div className="team-edit-actions">
                  <button type="button" className="btn-outline" disabled={teamBusy} onClick={moveTeamPersonToBackups}>
                    {teamBusy ? "Un moment…" : "Passa a suplent de confiança"}
                  </button>
                  <button type="button" className="btn-danger-outline" disabled={teamBusy} onClick={() => setTeamStep("remove")}>Treu del grup</button>
                  <button type="button" className="link-btn" disabled={teamBusy} onClick={() => setTeamTarget(null)}>Cancel·la</button>
                </div>
              </>
            ) : (
              <>
                <div className="cf-confirm-message">
                  Segur que vols treure <strong>{teamTarget.person.name}</strong> del grup? Deixarà de veure el grup.
                </div>
                <div className="modal-actions cf-confirm-actions">
                  <button type="button" className="btn-outline" disabled={teamBusy} onClick={() => setTeamStep("choose")}>Enrere</button>
                  <button type="button" className="btn-danger-outline" disabled={teamBusy} onClick={removeTeamPerson}>{teamBusy ? "Un moment…" : "Treu del grup"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
