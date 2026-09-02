"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Band, Concert } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { tagColors, bandPhotoDataUri, personPhotoDataUri, personPhotoDataUriColored, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import type { LinkedMember, BackupRequest } from "@/lib/group-data";
import type { Rider, Setlist, BandEditor } from "@/lib/material-types";
import type { Song, BandFile } from "@/lib/songs";
import { saveBandBackupsAction, saveBandVehiclesAction, setBackupRequestStatusAction, respondBackupApplicationAction, addBandPersonAction, removeBandPersonAction, invitePersonAction, setMemberPermAction, type BackupPerson } from "@/app/(app)/grup/actions";
import { openBandPublicPageAction } from "@/app/g/actions";
import { generateJoinCodeAction } from "@/app/(app)/grups/actions";
import { setMyAttendanceAction } from "@/app/(artist)/actions";
import { memberPerms, PERM_LABELS } from "@/lib/perms";
import type { MemberPerms, Vehicle, SocialStats, SocialPlatform } from "@/lib/types";
import { SOCIAL_PLATFORMS, PLATFORM_META, FOLLOWERS_KEY, isTracked, formatNumber } from "@/lib/social-history";
import { normalizeRouteSheet, formatPhoneDisplay, rsFormatDuration, type RouteSheet } from "@/lib/route-sheet";
import RouteSheetPreview from "@/components/RouteSheetPreview";
import GroupAppearanceModal from "@/components/GroupAppearanceModal";
import { RidersPanel, SetlistsPanel } from "@/components/MaterialPanels";
import SongsPanel from "@/components/SongsPanel";
import InstrumentPicker from "@/components/InstrumentPicker";
import { InstagramIcon, YoutubeIcon, TiktokIcon, SpotifyIcon } from "@/components/SocialIcons";

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

// Targeta d'una xifra de xarxes socials (Inici): amb el color/gradient de
// marca de cada plataforma a la insígnia de la icona, la xifra actual i la
// diferència respecte al mes passat. Només lectura — es connecta i s'edita
// tot des de la pàgina de xarxes del grup.
function SocialStatBox({ platform, label, value, prev }: {
  platform: SocialPlatform;
  label: string;
  value: number | undefined;
  prev: number | undefined;
}) {
  const d = value != null && prev != null ? value - prev : null;
  return (
    <div className="bento-social-box">
      <span className="bento-social-icon" style={{ background: PLATFORM_META[platform].gradient }}>{SOCIAL_ICONS[platform]}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
        <span className="bento-social-l">{label}</span>
        <span className="bento-social-n">{value != null ? formatNumber(value) : "—"}</span>
        {d != null && d !== 0 && (
          <span className={"sx-delta " + (d > 0 ? "up" : "down")} style={{ fontSize: 10.5 }}>
            {d > 0 ? "+" : "−"}{formatNumber(Math.abs(d))} aquest mes
          </span>
        )}
      </div>
    </div>
  );
}

// Bolo d'avui a Inici: el que diu el full de ruta (horaris, contactes, lloc
// i hospitalitat), amb accés directe al concert, al mapa i al document.
function TodayGig({ c, base, isMgr, onRouteSheet }: { c: Concert; base: string; isMgr: boolean; onRouteSheet: () => void }) {
  const rs = normalizeRouteSheet(c.routeSheet as RouteSheet | null, c);
  const address = rs.lloc.find((l) => l.label.trim().toLowerCase() === "adreça")?.value || "";
  const parking = rs.lloc.find((l) => l.label.trim().toLowerCase() === "parking");
  const mapsQuery = encodeURIComponent([c.venue, address, c.city].filter(Boolean).join(", "));
  const phases = rs.schedule.filter((p) => p.phase && (p.start || p.end));
  const contacts = rs.contacts.filter((ct) => (ct.name || "").trim() || (ct.phone || "").trim());
  const hosp = rs.hospitalitat.filter((h) => h.included !== false && (h.value || "").trim());
  const placeLines = [
    address ? { label: "Adreça", value: address } : null,
    parking && (parking.value || parking.plates) ? { label: "Parking", value: [parking.value, parking.plates].filter(Boolean).join(" · ") } : null,
    ...hosp.map((h) => ({ label: h.label, value: h.value })),
  ].filter((x): x is { label: string; value: string } => !!x);
  return (
    <div className="bento-today-gig" onClick={(e) => e.stopPropagation()}>
      <div className="bento-today-head">
        <div>
          <div className="bento-today-place">{c.venue || "Lloc per determinar"}{c.city ? ` · ${c.city.split(",")[0]}` : ""}</div>
          <div className="t-dim" style={{ fontSize: 12.5, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span>{c.time ? `Concert a les ${c.time}h` : "Hora per confirmar"}{c.festaEntitat ? ` · ${c.festaEntitat}` : ""}</span>
            <span className="badge">{c.status}</span>
          </div>
        </div>
        <div className="bento-today-actions">
          <a className="btn-outline" href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer">Mapa</a>
          <button type="button" className="btn-outline" onClick={onRouteSheet}>Full de ruta</button>
          {isMgr && <Link className="btn-outline" href={`/concerts/${c.id}/dia`}>Dia de bolo</Link>}
          <Link className="btn-save" href={`${base}/concerts/${c.id}`}>Obre el concert</Link>
        </div>
      </div>
      <div className="bento-today-cols">
        <div className="bento-today-col">
          <div className="dia-card-title">Horaris</div>
          {phases.length === 0 ? (
            <span className="t-dim" style={{ fontSize: 12.5 }}>Sense horaris al full de ruta{c.time ? ` — concert a les ${c.time}h` : ""}.</span>
          ) : phases.map((p, i) => (
            <div key={i} className="dia-sched-row">
              <span className="dia-sched-time">{p.start || "—"}{p.end ? `–${p.end}` : ""}</span>
              <span>{p.phase}</span>
              <span className="t-dim" style={{ marginLeft: "auto", fontSize: 11 }}>{rsFormatDuration(p.start, p.end)}</span>
            </div>
          ))}
        </div>
        <div className="bento-today-col">
          <div className="dia-card-title">Contactes</div>
          {contacts.length === 0 ? (
            <span className="t-dim" style={{ fontSize: 12.5 }}>Cap contacte al full de ruta.</span>
          ) : contacts.map((ct, i) => (
            <div key={i} className="bento-today-contact">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{ct.name || ct.role || "Contacte"}</div>
                <div className="t-dim" style={{ fontSize: 11.5 }}>{[ct.name ? ct.role : "", ct.company].filter(Boolean).join(" · ")}</div>
              </div>
              {ct.phone && <a className="bento-today-call" href={`tel:${ct.phone.replace(/\s/g, "")}`}>{ICON_PHONE}{formatPhoneDisplay(ct.phone)}</a>}
            </div>
          ))}
        </div>
        <div className="bento-today-col">
          <div className="dia-card-title">Lloc i hospitalitat</div>
          {placeLines.length === 0 ? (
            <span className="t-dim" style={{ fontSize: 12.5 }}>Res al full de ruta encara.</span>
          ) : placeLines.map((l, i) => (
            <div key={i} className="bento-today-line"><b>{l.label}</b><span>{l.value}</span></div>
          ))}
        </div>
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
  const can: MemberPerms = isMgr
    ? { songs: true, riders: true, setlists: true, members: true, events: true }
    : (caps || { songs: true, riders: true, setlists: true, members: false, events: false });
  // La pestanya inicial es pot indicar per URL (p. ex. ?tab=cancons), com
  // quan es torna de l'editor d'una cançó cap a l'apartat de cançons del grup.
  const initialTabParam = searchParams.get("tab");
  const initialTab = initialTabParam === "equip" || initialTabParam === "cancons" || initialTabParam === "documents" ? initialTabParam : "inici";
  const [tab, setTab] = useState<"inici" | "equip" | "cancons" | "documents">(initialTab);
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
  const totalFollowers = trackedPlatforms.reduce((sum, p) => sum + (socialStats[FOLLOWERS_KEY[p]] || 0), 0);
  // Bolos d'avui: la targeta gran d'Inici amb el full de ruta.
  const todayGigs = concerts.filter((c) => c.date === today && c.status !== "cancel·lat" && (c.kind || "bolo") === "bolo");
  const [rsPreview, setRsPreview] = useState<Concert | null>(null);
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
  const upcoming = concerts.filter((c) => c.date >= today && c.status !== "cancel·lat");
  // KPI de ritme: mitjana de concerts per mes d'enguany.
  const yearStr = today.slice(0, 4);
  const yearCount = concerts.filter((c) => c.date.slice(0, 4) === yearStr && c.status !== "cancel·lat").length;
  const monthsElapsed = parseInt(today.slice(5, 7), 10);
  const concertsPerMonth = (yearCount / Math.max(1, monthsElapsed)).toFixed(1).replace(".", ",");
  const monthCount = concerts.filter((c) => c.date.slice(0, 7) === today.slice(0, 7) && c.status !== "cancel·lat").length;
  const linkedByName: Record<string, LinkedMember> = {};
  linkedMembers.forEach((m) => { linkedByName[m.memberName] = m; });

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
          }}
        ></div>
        <div className="group-hero-li-row">
          <img className="group-hero-li-logo" src={band.logo || bandPhotoDataUri(band)} alt={band.name} />
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
            // Si avui hi ha bolo, la primera targeta (d'amplada completa) és
            // el seu full de ruta, a mà.
            ...(todayGigs.length ? [{
              key: "avui",
              label: "Avui",
              title: todayGigs.length === 1
                ? `Avui toqueu a ${todayGigs[0].venue || todayGigs[0].city || "un bolo"}`
                : `Avui teniu ${todayGigs.length} bolos`,
              description: "Tot el que diu el full de ruta, a mà",
              colSpan: 4,
              className: "bento-today",
              content: (
                <div className="bento-today-body">
                  {todayGigs.map((c) => (
                    <TodayGig key={c.id} c={c} base={base} isMgr={isMgr} onRouteSheet={() => setRsPreview(c)} />
                  ))}
                </div>
              ),
            }] : []),
            {
              key: "xarxes",
              label: "Xarxes socials",
              title: trackedPlatforms.length && totalFollowers ? `${formatNumber(totalFollowers)} seguidors` : "Xarxes socials",
              description: isMgr ? "Connecta les xarxes i mira'n l'evolució mes a mes" : "Seguidors i oients del grup",
              colSpan: 2,
              rowSpan: 2,
              onClick: isMgr ? () => router.push("/grup/xarxes") : undefined,
              content: (
                <div className="bento-social">
                  {trackedPlatforms.length === 0 ? (
                    <span className="t-dim" style={{ fontSize: 12.5, gridColumn: "1 / -1" }}>
                      {isMgr ? "Encara no hi ha cap xarxa connectada — toca aquí per afegir-les." : "El grup encara no té cap xarxa connectada."}
                    </span>
                  ) : trackedPlatforms.flatMap((p) => PLATFORM_META[p].metrics.map((m) => (
                    <SocialStatBox key={m.key} platform={p} label={`${m.label} ${PLATFORM_META[p].label}`} value={socialStats[m.key]} prev={socialPrev[m.key]} />
                  )))}
                </div>
              ),
            },
            {
              key: "bolos",
              label: "Agenda",
              title: `${upcoming.length} bolos a la vista`,
              description: `${total} concerts en total`,
              colSpan: 2,
              rowSpan: 2,
              onClick: () => router.push(base + "/agenda"),
              content: (
                <div className="bento-gigs">
                  {upcoming.slice(0, 5).map((c) => {
                    const myAns = myName ? (c.attendance || {})[myName] : undefined;
                    return (
                      <div key={c.id} className="bento-gig" onClick={(e) => { e.stopPropagation(); router.push(`${base}/concerts/${c.id}`); }}>
                        <span className="bento-gig-date">{formatDate(c.date)}</span>
                        <span className="bento-gig-place">{c.city || c.venue || "—"}{c.venue && c.city ? ` · ${c.venue}` : ""}</span>
                        {!isMgr && myName ? (
                          <span className="bento-gig-att" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button" className={"bento-att-btn yes" + (myAns === "yes" ? " active" : "")}
                              title="Hi seré"
                              onClick={async () => { await setMyAttendanceAction(c.id, "yes"); router.refresh(); }}
                            >✓</button>
                            <button
                              type="button" className={"bento-att-btn no" + (myAns === "no" ? " active" : "")}
                              title="No hi seré"
                              onClick={async () => { await setMyAttendanceAction(c.id, "no"); router.refresh(); }}
                            >✗</button>
                          </span>
                        ) : (
                          <span className="badge" style={{ marginLeft: "auto" }}>{c.status}</span>
                        )}
                      </div>
                    );
                  })}
                  {upcoming.length === 0 && <span className="t-dim" style={{ fontSize: 12.5 }}>Cap bolo programat.</span>}
                </div>
              ),
            },
            {
              key: "cancons",
              label: "Repertori",
              title: `${songs.length} cançons`,
              description: "Lletres, acords i gravacions",
              onClick: () => setTab("cancons"),
            },
            {
              key: "riders",
              label: "Tècnica",
              title: `${riders.length} riders`,
              description: "Plànol d'escenari i aprovacions",
              onClick: () => setTab("documents"),
            },
            {
              key: "setlists",
              label: "Directe",
              title: `${setlists.length} setlists`,
              description: "Amb mode escenari",
              onClick: () => setTab("cancons"),
            },
            {
              key: "ritme",
              label: "Ritme",
              title: `${concertsPerMonth} concerts/mes`,
              description: `${monthCount} aquest mes · mitjana d'enguany`,
              onClick: () => router.push(base + "/estadistiques"),
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
            {can.members && addKind !== "member" && <button type="button" className="btn-outline" onClick={() => setAddKind("member")}>+ Afegeix membre</button>}
          </div>
        </div>
        {band.members.length === 0 && addKind !== "member" ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Aquest grup encara no té membres — afegeix-ne amb el botó de dalt.</div>
        ) : (
          band.members.length > 0 && (
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
                return {
                  ...item,
                  onMouseEnter: (rect: DOMRect) => { cancelHoverClose(); scheduleHoverOpen(m, rect); },
                  onMouseLeave: () => { cancelHoverOpen(); scheduleHoverClose(m.name); },
                };
              }}
            />
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
            {can.members && addKind !== "crew" && <button type="button" className="btn-outline" onClick={() => setAddKind("crew")}>+ Afegeix tècnic</button>}
          </div>
        </div>
        {band.crew.length === 0 && addKind !== "crew" ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Sense equip tècnic encara.</div>
        ) : (
          band.crew.length > 0 && (
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
                return {
                  ...item,
                  onMouseEnter: (rect: DOMRect) => { cancelHoverClose(); scheduleHoverOpen(m, rect); },
                  onMouseLeave: () => { cancelHoverOpen(); scheduleHoverClose(m.name); },
                };
              }}
            />
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
                            <div className="member-name">{a.name}</div>
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

      {/* Full de ruta del bolo d'avui, tal com s'imprimeix */}
      {rsPreview && (
        <RouteSheetPreview
          concert={rsPreview}
          onClose={() => setRsPreview(null)}
          onEdit={() => router.push(`${base}/concerts/${rsPreview.id}`)}
        />
      )}
    </div>
  );
}
