"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Band, Concert } from "@/lib/types";
import { formatCurrency, formatDate, formatDateShort, formatDateFull, capitalize, relativeDayLabel, formatConcertTime } from "@/lib/format";
import { tagColors, bandPhotoDataUri, personPhotoDataUri, personPhotoDataUriColored, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import type { LinkedMember, BackupRequest } from "@/lib/group-data";
import type { Rider, Setlist, BandEditor } from "@/lib/material-types";
import type { Song, BandFile } from "@/lib/songs";
import { saveBandBackupsAction, saveBandVehiclesAction, setBackupRequestStatusAction, respondBackupApplicationAction, addBandPersonAction, removeBandPersonAction, moveMemberToBackupsAction, invitePersonAction, setMemberPermAction, type BackupPerson } from "@/app/(app)/grup/actions";
import { openBandPublicPageAction } from "@/app/g/actions";
import { generateJoinCodeAction } from "@/app/(app)/grups/actions";
import { setMyAttendanceAction } from "@/app/(artist)/actions";
import { memberPerms, PERM_LABELS, DEFAULT_PERMS, ALL_PERMS } from "@/lib/perms";
import VerifiedTick from "@/components/VerifiedTick";
import { logoBox } from "@/lib/logo";
import type { MemberPerms, Vehicle, SocialStats, SocialPlatform } from "@/lib/types";
import { SOCIAL_PLATFORMS, PLATFORM_META, FOLLOWERS_KEY, isTracked, formatNumber, formatHeroNumber } from "@/lib/social-history";
import { normalizeRouteSheet, withLiveConcertStart, type RouteSheet } from "@/lib/route-sheet";
import GroupAppearanceModal from "@/components/GroupAppearanceModal";
import DiaTopActions from "@/components/DiaTopActions";
import ConcertPosterEditor from "@/components/ConcertPosterEditor";
import { RidersPanel, SetlistsPanel } from "@/components/MaterialPanels";
import SetlistEditor from "@/components/SetlistEditor";
import { setConcertMaterialAction } from "@/app/(app)/grup/material-actions";
import SongsPanel from "@/components/SongsPanel";
import InstrumentPicker from "@/components/InstrumentPicker";
import { InstagramIcon, YoutubeIcon, TiktokIcon, SpotifyIcon } from "@/components/SocialIcons";
import { KIND_META } from "@/components/CalendariView";

import BentoGrid, { type BentoCard } from "@/components/BentoGrid";
import ChromaGrid, { type ChromaItem } from "@/components/ChromaGrid";
import { normalize } from "@/lib/text";
import { bandColor } from "@/lib/tags";
import type { Person } from "@/lib/types";
import { openPersonProfileAction } from "@/app/p/profile-actions";

// Icones de línia (mateix estil que la fitxa de perfil pública) per als
// botons de contacte ràpid de les targetes "chroma" — abans eren emojis.
const ICON_PHONE = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
);
const ICON_WHATSAPP = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
);
const ICON_MAIL = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 6-10 7L2 6"></path></svg>
);
const ICON_INSTAGRAM = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);
const ICON_LINK = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
);
const ICON_CHECK = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

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
function SetlistButton({ c, band, setlists, songs, canEdit, iconBtnClass }: {
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
function TeamRow({ people, renderItem, cardWidth, radius, visibleCount = 4 }: {
  people: Person[];
  renderItem: (p: Person) => ChromaItem;
  cardWidth: number;
  radius: number;
  visibleCount?: number;
}) {
  const [start, setStart] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const maxStart = Math.max(0, people.length - visibleCount);
  const s = Math.min(start, maxStart);
  const pageItems = people.slice(s, s + visibleCount);
  const canNav = people.length > visibleCount;
  return (
    <div className="bento-chroma-row">
      {canNav && (
        <button
          type="button"
          className="bento-chroma-nav-btn"
          disabled={s === 0}
          onClick={() => { setDir("prev"); setStart((p) => Math.max(0, p - 1)); }}
        >‹</button>
      )}
      <div className={"bento-chroma bento-chroma-slide-" + dir} key={s}>
        <ChromaGrid className="chroma-compact" items={pageItems.map(renderItem)} columns={visibleCount} cardWidth={cardWidth} radius={radius} />
      </div>
      {canNav && (
        <button
          type="button"
          className="bento-chroma-nav-btn"
          disabled={s >= maxStart}
          onClick={() => { setDir("next"); setStart((p) => Math.min(maxStart, p + 1)); }}
        >›</button>
      )}
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

// Targetes "chroma" per a l'equip: colors del grup, nom, instrument (o
// càrrec, si és de l'equip tècnic) i @ estil Instagram; el clic obre la
// pàgina de perfil del músic.
function personChromaItem(
  p: Person,
  band: Band,
  onOpen: (name: string) => void,
  photosByName: Record<string, string>,
  igByName: Record<string, string>,
  linked: boolean,
  onInvite?: (name: string) => void,
  footer?: React.ReactNode,
  copiedEmailKey?: string | null,
  onCopyEmail?: (key: string, email: string) => void,
): ChromaItem {
  const realIg = igByName[normalize(p.name)] || "";
  const handle = "@" + (realIg || normalize(p.name).replace(/\s+/g, ""));
  const inss = instrumentsFor(p);
  const c1 = band.color1 || bandColor(band.id).color;
  const c2 = band.color2 || bandColor(band.id + "x").color;
  const photoId = photosByName[normalize(p.name)];

  // Trucar, WhatsApp i correu sempre visibles; sense dades, porten al perfil
  // (on el gestor o el músic poden afegir-les).
  const missing = (what: string) => () => {
    alert(`${p.name} encara no té ${what} desat — afegeix-lo des del seu perfil (Edita el perfil).`);
    onOpen(p.name);
  };
  const actions: ChromaItem["actions"] = [
    p.phone
      ? { icon: ICON_PHONE, title: `Truca ${p.name}`, href: `tel:${p.phone.replace(/\s/g, "")}` }
      : { icon: ICON_PHONE, title: "Sense telèfon — afegeix-lo al perfil", onClick: missing("el telèfon") },
    (p.whatsapp || p.phone)
      ? { icon: ICON_WHATSAPP, title: "WhatsApp", href: `https://wa.me/${(p.whatsapp || p.phone || "").replace(/[^\d]/g, "")}` }
      : { icon: ICON_WHATSAPP, title: "Sense telèfon — afegeix-lo al perfil", onClick: missing("el telèfon") },
    p.email
      ? {
          icon: copiedEmailKey === p.name ? ICON_CHECK : ICON_MAIL,
          title: copiedEmailKey === p.name ? "Correu copiat" : `Copia el correu — ${p.email}`,
          onClick: () => onCopyEmail?.(p.name, p.email!),
        }
      : { icon: ICON_MAIL, title: "Sense correu — afegeix-lo al perfil", onClick: missing("el correu") },
    { icon: ICON_INSTAGRAM, title: `Instagram ${handle}`, href: `https://instagram.com/${handle.slice(1)}` },
  ];
  if (!linked && onInvite) actions.push({ icon: ICON_LINK, title: "Convida a reclamar aquest perfil", onClick: () => onInvite(p.name) });

  return {
    image: photoId ? `/api/file/${photoId}` : personPhotoDataUriColored(p.name, c1, c2),
    title: p.name,
    verified: linked,
    subtitle: inss.length ? inss.slice(0, 2).join(", ") : p.role || "—",
    subtitleIcon: inss.length ? instrumentIconFor(inss[0]) : null,
    handle,
    borderColor: c1,
    gradient: `linear-gradient(150deg, ${c1}, ${c2})`,
    onClick: () => onOpen(p.name),
    actions,
    footer,
  };
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
                return (
                  <tr key={p.name}>
                    <td>
                      <div className="perm-person">
                        <img src={photoId ? `/api/file/${photoId}` : personPhotoDataUriColored(p.name, c1, c2)} alt="" />
                        <div style={{ minWidth: 0 }}>
                          <div className="member-name">{p.name}{linkedNames.has(normalize(p.name)) && <VerifiedTick size={12} />}</div>
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

export default function GroupHomeView({ band, allBands, concerts, linkedMembers, backupRequests, concertCountByPerson, riders, setlists, editors, songs, files, photosByName = {}, igByName = {}, viewer = "manager", caps, myName = "", socialPrev = {}, today }: {
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
  photosByName?: Record<string, string>;
  igByName?: Record<string, string>;
  viewer?: "manager" | "artist";
  caps?: MemberPerms;
  myName?: string;
  // Xifres de xarxes del mes passat (per als "+123 aquest mes" d'Inici).
  socialPrev?: Partial<SocialStats>;
  today: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMgr = viewer === "manager";
  const base = isMgr ? "" : "/artista"; // rutes de l'àrea d'artista
  const can: MemberPerms = isMgr ? { ...ALL_PERMS } : (caps || { ...DEFAULT_PERMS });
  // La pestanya inicial es pot indicar per URL (p. ex. ?tab=cancons), com
  // quan es torna de l'editor d'una cançó cap a l'apartat de cançons del grup.
  const initialTabParam = searchParams.get("tab");
  const initialTab = initialTabParam === "equip" || initialTabParam === "cancons" || initialTabParam === "documents" || initialTabParam === "permisos" ? initialTabParam : "inici";
  const [tab, setTab] = useState<"inici" | "equip" | "cancons" | "documents" | "permisos">(initialTab);
  // En passar el ratolí per una targeta petita de la previsualització, es
  // mostra literalment la targeta grossa (la mateixa que a la pestanya
  // Equip) flotant per sobre — a través d'un portal a <body>, perquè cap
  // altre element de la pàgina la pugui tapar mai.
  const [hoveredTeam, setHoveredTeam] = useState<{ person: Person; rect: DOMRect } | null>(null);
  // Petit marge abans de tancar-la de veres: com que la targeta flotant no
  // ocupa exactament el mateix espai que la petita, en moure el ratolí de
  // l'una a l'altra hi hauria un instant sense cap de les dues sota el
  // punter que la tancaria de seguida — s'espera un moment per si l'altra
  // banda ja l'ha reobert abans de fer-ho.
  const hoverCloseTimer = useRef<number | null>(null);
  function scheduleHoverClose(name: string) {
    if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = window.setTimeout(() => {
      setHoveredTeam((h) => (h?.person.name === name ? null : h));
    }, 150);
  }
  function cancelHoverClose() {
    if (hoverCloseTimer.current) { window.clearTimeout(hoverCloseTimer.current); hoverCloseTimer.current = null; }
  }
  // La targeta grossa només s'obre si el ratolí s'hi queda mig segon a
  // sobre — evita que aparegui sense voler en passar-hi per damunt.
  const hoverOpenTimer = useRef<number | null>(null);
  function scheduleHoverOpen(person: Person, rect: DOMRect) {
    if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current);
    hoverOpenTimer.current = window.setTimeout(() => { setHoveredTeam({ person, rect }); }, 500);
  }
  function cancelHoverOpen() {
    if (hoverOpenTimer.current) { window.clearTimeout(hoverOpenTimer.current); hoverOpenTimer.current = null; }
  }
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
    cancelHoverOpen();
    setHoveredTeam(null);
    setTeamTarget({ person, kind });
    setTeamStep("choose");
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
  // Genera el codi d'unió (i el regenera: el codi anterior deixa de valer).
  async function handleGenerateCode() {
    setCodeBusy(true);
    await generateJoinCodeAction(band.id);
    router.refresh();
    setCodeBusy(false);
  }
  const [copiedEmailKey, setCopiedEmailKey] = useState<string | null>(null);
  function copyEmail(key: string, email: string) {
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmailKey(key);
      window.setTimeout(() => setCopiedEmailKey((k) => (k === key ? null : k)), 1500);
    });
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
  // Finestra fixa (els 6 més propers): triar-ne un com a gran no en fa
  // entrar cap altre de nou a la llista, només li canvia el format al que
  // ja hi era — l'ordre i el conjunt es queden sempre igual.
  const shownGigs = upcoming.slice(0, 6);
  const heroGig = shownGigs.find((c) => c.id === selectedGigId) || shownGigs[0];
  const heroIdx = Math.max(0, shownGigs.findIndex((c) => c.id === heroGig?.id));
  // Els anteriors al que es veu gran (cronològicament) surten a sobre seu;
  // els posteriors, a sota — mai es barregen en una sola llista.
  const beforeGigs = shownGigs.slice(0, heroIdx);
  const afterGigs = shownGigs.slice(heroIdx + 1);
  function renderGigRow(c: Concert) {
    const myAns = myName ? (c.attendance || {})[myName] : undefined;
    // Tipus (bolo/assaig/reunió/altres) i el seu color — substitueix
    // l'estat (confirmat/pendent...) a la insígnia, i tenyeix també la data.
    const k = c.kind && KIND_META[c.kind] ? c.kind : "bolo";
    const km = KIND_META[k];
    return (
      <div key={c.id} className="bento-gig" onClick={(e) => { e.stopPropagation(); setSelectedGigId(c.id); }}>
        <span className="bento-gig-date" style={{ color: km.color }}>{formatDateShort(c.date)}</span>
        <span className="bento-gig-place">{c.city || c.venue || "—"}{c.venue && c.city ? ` · ${c.venue}` : ""}</span>
        {!isMgr && myName ? (
          <span className="bento-gig-att cd-att-controls" style={{ marginTop: 0 }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button" className={"cd-att-btn yes" + (myAns === "yes" ? " active" : "")}
              title="Hi seré"
              onClick={async () => { await setMyAttendanceAction(c.id, "yes"); router.refresh(); }}
            >Sí</button>
            <button
              type="button" className={"cd-att-btn no" + (myAns === "no" ? " active" : "")}
              title="No hi seré"
              onClick={async () => { await setMyAttendanceAction(c.id, "no"); router.refresh(); }}
            >No</button>
          </span>
        ) : (
          <span className="badge" style={{ marginLeft: "auto", background: km.bg, color: km.color }}>{km.label}</span>
        )}
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
  const joinMsg = (rol: "membre" | "tècnic") =>
    `Uneix-te a ${band.name} a Escenari com a ${rol}: registra't a escenari i introdueix el codi ${band.joinCode} a "Els meus grups".`;

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
            {isMgr && <button type="button" className="btn-outline" onClick={() => setEditOpen(true)}>Edita el grup</button>}
          </div>
        </div>
      </div>

      {/* Subtabs */}
      <div className="stats-tabs group-tabs">
        <button className={"stats-tab" + (tab === "inici" ? " active" : "")} onClick={() => setTab("inici")}>Inici</button>
        <button className={"stats-tab" + (tab === "equip" ? " active" : "")} onClick={() => setTab("equip")}>Equip</button>
        <button className={"stats-tab" + (tab === "cancons" ? " active" : "")} onClick={() => setTab("cancons")}>Cançons</button>
        <button className={"stats-tab" + (tab === "documents" ? " active" : "")} onClick={() => setTab("documents")}>Documents</button>
        {(isMgr || can.perms) && <button className={"stats-tab" + (tab === "permisos" ? " active" : "")} onClick={() => setTab("permisos")}>Permisos</button>}
      </div>

      {/* Targeta grossa flotant en passar el ratolí per una targeta petita
          de l'equip (a Inici o a Equip): sempre muntada, a través d'un
          portal a <body>, perquè cap altre element de la pàgina la pugui
          tapar mai, sigui quina sigui la pestanya activa. */}
      {hoveredTeam && typeof document !== "undefined" && createPortal(
        <div
          className="bento-chroma-flyout"
          style={{
            top: hoveredTeam.rect.top + hoveredTeam.rect.height / 2,
            left: hoveredTeam.rect.left + hoveredTeam.rect.width / 2,
          }}
          onMouseEnter={cancelHoverClose}
          onMouseLeave={() => setHoveredTeam(null)}
        >
          <ChromaGrid
            items={[personChromaItem(
              hoveredTeam.person, band, openProfile, photosByName, igByName,
              !!linkedByName[hoveredTeam.person.name], undefined, undefined, copiedEmailKey, copyEmail,
            )]}
            columns={1}
            cardWidth={190}
            radius={240}
          />
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
              label: upcoming.length
                ? `Proper concert - ${relativeDayLabel(heroGig.date, today)}`
                : "Proper concert",
              title: `${upcoming.length} bolos a la vista`,
              description: `${total} concerts en total`,
              colSpan: 2,
              rowSpan: 2,
              className: "bento-next",
              onClick: () => router.push(base + "/agenda"),
              content: (
                <div className="bento-next-body">
                  {upcoming.length === 0 ? (
                    <span className="t-dim" style={{ fontSize: 12.5 }}>Cap bolo programat.</span>
                  ) : (
                    <>
                      {beforeGigs.length > 0 && (
                        <div className="bento-gigs bento-next-list">
                          {beforeGigs.map((c) => renderGigRow(c))}
                        </div>
                      )}
                      <NextGigPoster key={heroGig.id} c={heroGig} base={base} band={band} setlists={setlists} songs={songs} canEditSetlists={can.setlists} />
                      {afterGigs.length > 0 && (
                        <div className="bento-gigs bento-next-list">
                          {afterGigs.map((c) => renderGigRow(c))}
                        </div>
                      )}
                    </>
                  )}
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
          <SetlistsPanel band={band} setlists={setlists} linkedMembers={linkedMembers} editors={editors} canEdit={can.setlists} isManager={isMgr} songs={songs} concerts={concerts} />
        </div>
      )}

      {tab === "documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <RidersPanel band={band} riders={riders} linkedMembers={linkedMembers} editors={editors} canEdit={can.riders} isManager={isMgr} />

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
        <PermsMatrix band={band} photosByName={photosByName} linkedNames={linkedNameSet} isManager={isMgr} myName={myName} />
      )}

      {tab === "equip" && (<>
      {/* KPIs */}
      <div className="kpi-grid kpi-grid-4">
        <div className="card card-centered"><div className="card-title">Integrants</div><div className="card-value">{band.members.length + band.crew.length}</div></div>
        <div className="card card-centered"><div className="card-title">Concerts totals</div><div className="card-value">{total}</div></div>
        <div className="card card-centered"><div className="card-title">Pròxims bolos</div><div className="card-value">{upcoming.length}</div></div>
        <div className="card card-centered"><div className="card-title">Suplents</div><div className="card-value">{backups.length}</div></div>
      </div>

      {/* Membres */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">Músics</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {memberEmails.length > 0 && (
              <a className="btn-outline" style={{ textDecoration: "none" }} title={`Correu a tot el grup (${memberEmails.length} adreces)`}
                href={`mailto:?bcc=${encodeURIComponent(memberEmails.join(","))}&subject=${encodeURIComponent(band.name)}`}>
                ✉️ Correu a tot el grup
              </a>
            )}
            {can.removeMembers && (band.members.length > 0 || band.crew.length > 0) && (
              <button type="button" className="btn-outline" onClick={() => { setTeamEdit((v) => !v); setTeamTarget(null); }}>{teamEdit ? "Fet" : "Edita membres"}</button>
            )}
            {can.members && addKind !== "member" && <button type="button" className="btn-outline" onClick={() => setAddKind("member")}>+ Afegeix membre</button>}
          </div>
        </div>
        {band.members.length === 0 && addKind !== "member" ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Aquest grup encara no té membres — afegeix-ne amb el botó de dalt.</div>
        ) : (
          band.members.length > 0 && (
            <div className={teamEdit ? "team-editing" : undefined}>
              {teamEdit && <div className="team-edit-hint">Clica una persona per treure-la del grup o passar-la a suplents.</div>}
              <TeamRow
                people={band.members}
                cardWidth={76}
                radius={12}
                visibleCount={8}
                renderItem={(m) => {
                  const item = personChromaItem(
                    m, band, openProfile, photosByName, igByName,
                    !!linkedByName[m.name], isMgr ? handleInvite : undefined,
                    undefined,
                    copiedEmailKey, copyEmail,
                  );
                  if (teamEdit) return { ...item, actions: [], onClick: () => openTeamTarget(m, "member") };
                  return {
                    ...item,
                    onMouseEnter: (rect: DOMRect) => { cancelHoverClose(); scheduleHoverOpen(m, rect); },
                    onMouseLeave: () => { cancelHoverOpen(); scheduleHoverClose(m.name); },
                  };
                }}
              />
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
          <div className="panel-title">Crew</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {can.removeMembers && band.crew.length > 0 && (
              <button type="button" className="btn-outline" onClick={() => { setTeamEdit((v) => !v); setTeamTarget(null); }}>{teamEdit ? "Fet" : "Edita membres"}</button>
            )}
            {can.members && addKind !== "crew" && <button type="button" className="btn-outline" onClick={() => setAddKind("crew")}>+ Afegeix tècnic</button>}
          </div>
        </div>
        {band.crew.length === 0 && addKind !== "crew" ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Sense equip tècnic encara.</div>
        ) : (
          band.crew.length > 0 && (
            <div className={teamEdit ? "team-editing" : undefined}>
              {teamEdit && <div className="team-edit-hint">Clica una persona per treure-la del grup.</div>}
              <TeamRow
                people={band.crew}
                cardWidth={76}
                radius={12}
                visibleCount={8}
                renderItem={(m) => {
                  const item = personChromaItem(
                    m, band, openProfile, photosByName, igByName,
                    !!linkedByName[m.name], isMgr ? handleInvite : undefined,
                    undefined,
                    copiedEmailKey, copyEmail,
                  );
                  if (teamEdit) return { ...item, actions: [], onClick: () => openTeamTarget(m, "crew") };
                  return {
                    ...item,
                    onMouseEnter: (rect: DOMRect) => { cancelHoverClose(); scheduleHoverOpen(m, rect); },
                    onMouseLeave: () => { cancelHoverOpen(); scheduleHoverClose(m.name); },
                  };
                }}
              />
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

      {/* Uneix-te al grup (només el gestor comparteix el codi) */}
      {isMgr && (
      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 10 }}>Uneix-te al grup</div>
        <div className="t-dim" style={{ fontSize: 13, marginBottom: 12 }}>
          Comparteix el codi: qui es registri a Escenari i l&apos;introdueixi a &ldquo;Els meus grups&rdquo; quedarà
          vinculat a aquest grup, com a músic o com a tècnic de so segons el que triï en unir-s&apos;hi.
          Si la persona ja existeix aquí creada a mà, usa el botó 🔗 de la seva targeta per convidar-la a reclamar el perfil.
        </div>
        {band.joinCodeActive && band.joinCode ? (
          <>
            <div className="join-box">
              <span className="join-code">{band.joinCode}</span>
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

      {/* Suplents */}
      <div className="panel">
        <div className="panel-header-row" style={{ marginBottom: 14 }}>
          <div className="panel-title">Suplents de confiança{savingBackups ? " · desant…" : ""}</div>
          {can.members && !backupDraft && (
            <button type="button" className="btn-outline" onClick={() => setBackupDraft({ name: "", instruments: [], phone: "", email: "" })}>+ Afegeix suplent</button>
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
                <img className="member-photo backup-photo" src={personPhotoDataUri(b.name)} alt="" />
                <div className="backup-row-main">
                  <div className="member-name">{b.name}</div>
                  <InstrumentChips items={b.instruments} />
                </div>
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

      {/* Cerques de suplent publicades (gestió del gestor) */}
      {isMgr && openRequests.length > 0 && (
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
                          <img className="member-photo backup-photo" src={personPhotoDataUri(a.name)} alt="" />
                          <div className="backup-row-main">
                            <div className="member-name">{a.name}<VerifiedTick size={12} /></div>
                            <InstrumentChips items={a.instruments} />
                            {a.message && <div className="t-dim" style={{ fontSize: 12 }}>&ldquo;{a.message}&rdquo;</div>}
                          </div>
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

      </>)}

      {editOpen && (
        <GroupAppearanceModal key={band.id} band={band} onClose={() => setEditOpen(false)} />
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
                  {teamTarget.kind === "member" && (
                    <button type="button" className="btn-outline" disabled={teamBusy} onClick={moveTeamPersonToBackups}>
                      {teamBusy ? "Un moment…" : "Passa a suplent de confiança"}
                    </button>
                  )}
                  <button type="button" className="btn-danger-outline" disabled={teamBusy} onClick={() => setTeamStep("remove")}>Treu del grup</button>
                  <button type="button" className="link-btn" disabled={teamBusy} onClick={() => setTeamTarget(null)}>Cancel·la</button>
                </div>
              </>
            ) : (
              <>
                <div className="cf-confirm-message">
                  Segur que vols treure <strong>{teamTarget.person.name}</strong> del grup? Si té compte d&apos;Escenari, deixarà de veure-hi el grup.
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
