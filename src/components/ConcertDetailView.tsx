"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Band, Concert, Invoice, CompanyInfo, ClientDetails } from "@/lib/types";
import { formatCurrency, formatDate, formatDateFull, capitalize, statusColors } from "@/lib/format";
import { bandColor, personPhotoDataUri, instrumentsFor, instrumentIconFor } from "@/lib/tags";
import { rsCompletionPercent } from "@/lib/route-sheet";
import { normalize } from "@/lib/text";
import type { LinkedMember, BackupRequest } from "@/lib/group-data";
import type { Rider, Setlist, RiderApproval } from "@/lib/material-types";
import type { ShareLink } from "@/lib/share-data";
import { setConcertMaterialAction, sendRiderApprovalAction, acceptCounterRiderAction, deleteRiderApprovalAction } from "@/app/(app)/grup/material-actions";
import { sendApprovalEmailAction } from "@/app/a/actions";
import SpecularButton from "@/components/SpecularButton";
import { shareLinkStatus } from "@/lib/share-data";
import { saveConcertAction, savePayoutsAction, setInvoiceStateAction, setConcertKindAction, repeatConcertAction, nudgeAttendanceAction } from "@/app/(app)/concerts/actions";
import { editInvoiceAction, sendInvoiceReminderAction } from "@/app/(app)/facturacio/actions";
import { computeInvoiceTotals } from "@/lib/invoice-utils";
import type { Checklist } from "@/lib/checklists";
import ChecklistSection from "@/components/ChecklistSection";
import { generateInvoiceAction } from "@/app/(app)/facturacio/actions";
import { upsertClientDetailsAction } from "@/app/(app)/base-de-dades/actions";
import { createShareLinkAction, revokeShareLinkAction, sendShareLinkEmailAction } from "@/app/(app)/concerts/share-actions";
import { createAttendanceLinkAction } from "@/app/conf/actions";
import { publishBackupRequestAction, setBackupRequestStatusAction } from "@/app/(app)/grup/actions";
import RouteSheetEditor from "@/components/RouteSheetEditor";
import RouteSheetPreview from "@/components/RouteSheetPreview";
import InvoicePreview from "@/components/InvoicePreview";
import ConcertPosterModal from "@/components/ConcertPosterModal";

const STATUS_CYCLE = ["pendent", "reservat", "confirmat", "cancel·lat"];

// Mateixa escala que el ConcertModal: vermell → groc → verd.
function progressColor(percent: number, alpha = 1): string {
  let l: number, c: number, h: number;
  if (percent < 15) { l = 0.62; c = 0.19; h = 25; }
  else if (percent < 80) { l = 0.8; c = 0.15; h = 90; }
  else {
    const t = (percent - 80) / 20;
    h = 90 + (145 - 90) * t;
    c = 0.15 + (0.19 - 0.15) * t;
    l = 0.8 + (0.7 - 0.8) * t;
  }
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)} / ${alpha})`;
}

// Percentatge d'informació bàsica del concert (per al mesurador "què falta").
export function infoCompletion(c: Concert): { percent: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ["Data", !!c.date],
    ["Hora", !!c.time],
    ["Població", !!c.city.trim()],
    ["Ubicació", !!c.venue.trim() && c.venue !== "Sala per determinar"],
    ["Festa/entitat", !!(c.festaEntitat || "").trim()],
    ["Import", c.amount > 0],
    ["Estat confirmat", c.status === "confirmat"],
  ];
  const filled = checks.filter(([, ok]) => ok).length;
  return { percent: Math.round((filled / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([label]) => label) };
}

function Meter({ label, percent, missing }: { label: string; percent: number; missing: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cd-meter" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="cd-meter-head">
        <span>{label}</span>
        <span style={{ color: progressColor(percent) }}>{percent}%</span>
      </div>
      <div className="cd-meter-track">
        <div className="cd-meter-fill" style={{ width: percent + "%", background: progressColor(percent) }}></div>
      </div>
      {open && missing.length > 0 && (
        <div className="cd-meter-tip">
          <div className="cd-meter-tip-title">Falta:</div>
          {missing.map((m) => <div key={m} className="cd-meter-tip-row">· {m}</div>)}
        </div>
      )}
    </div>
  );
}

function rsMissingList(c: Concert): string[] {
  const rs = c.routeSheet as { lloc?: { label: string; value: string }[]; contacts?: { name: string }[]; schedule?: { phase: string; start: string; end: string }[]; hospitalitat?: { label: string; value: string }[]; tecnic?: { label: string; value: string }[] } | null;
  if (!rs) return ["Tot el full de ruta"];
  const missing: string[] = [];
  (rs.lloc || []).forEach((it) => { if (it.label && !String(it.value || "").trim()) missing.push(it.label); });
  if (!(rs.contacts || []).some((ct) => ct.name && ct.name.trim())) missing.push("Contactes");
  (rs.schedule || []).forEach((it) => { if (it.phase && (!it.start || !it.end)) missing.push("Horari: " + it.phase); });
  (rs.hospitalitat || []).forEach((it) => { if (it.label && !String(it.value || "").trim()) missing.push(it.label); });
  (rs.tecnic || []).forEach((it) => { if (it.label && it.label.toLowerCase() !== "pantalla led" && !String(it.value || "").trim()) missing.push(it.label); });
  return missing;
}

export default function ConcertDetailView({
  concert, band, bands, invoice, companyInfo, clientDetails, linkedMembers, shareLinks, backupRequests, riders, setlists, riderApprovals, checklists, clashes, venueHistory, concertExpenses, emailReady, photosByName = {}, today,
}: {
  concert: Concert;
  band: Band | null;
  bands: Band[];
  invoice: Invoice | null;
  companyInfo: CompanyInfo;
  clientDetails: Record<string, ClientDetails>;
  linkedMembers: LinkedMember[];
  shareLinks: ShareLink[];
  backupRequests: BackupRequest[];
  riders: Rider[];
  setlists: Setlist[];
  riderApprovals: RiderApproval[];
  checklists: Checklist[];
  clashes: string[];
  venueHistory: { date: string; amount: number; invoiceState: string | null; daysToPay: number | null }[];
  concertExpenses: number;
  emailReady: boolean;
  photosByName?: Record<string, string>; // nom normalitzat → id de fitxer de foto
  today: string;
}) {
  const router = useRouter();
  const [cf, setCf] = useState({
    date: concert.date, time: concert.time, venue: concert.venue, city: concert.city,
    festaEntitat: concert.festaEntitat || "", amount: String(concert.amount), status: concert.status as string,
  });
  const [attendance, setAttendance] = useState<Record<string, string>>({ ...(concert.attendance || {}) });
  const [substitutes, setSubstitutes] = useState<Record<string, string>>({ ...(concert.substitutes || {}) });
  const [noSubstitute, setNoSubstitute] = useState<Record<string, boolean>>({ ...(concert.noSubstitute || {}) });
  const [saving, setSaving] = useState(false);
  const [nudging, setNudging] = useState(false);
  const [nudgeResult, setNudgeResult] = useState<string | null>(null);
  const [kind, setKind] = useState<string>(concert.kind || "bolo");
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [repeating, setRepeating] = useState(false);
  const [rsPreviewOpen, setRsPreviewOpen] = useState(false);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [tab, setTab] = useState<"info" | "assistencia" | "ruta" | "facturacio">("info");
  const [generating, setGenerating] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // ---- Compartir ----
  const [newLinkOpen, setNewLinkOpen] = useState(false);
  const [linkScope, setLinkScope] = useState<"info" | "ruta" | "both">("both");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkDays, setLinkDays] = useState(14);
  const [creatingLink, setCreatingLink] = useState(false);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<Record<string, string>>({});

  // ---- Pagaments ----
  const [payouts, setPayouts] = useState<Record<string, number>>({ ...(concert.payouts || {}) });
  const [payoutsSaving, setPayoutsSaving] = useState(false);

  // ---- Comparteix per confirmar (assistència) ----
  const [attToken, setAttToken] = useState(concert.attToken || "");
  const [attBusy, setAttBusy] = useState(false);
  const [attCopied, setAttCopied] = useState(false);

  async function ensureAttToken(): Promise<string> {
    if (attToken) return attToken;
    setAttBusy(true);
    const { token } = await createAttendanceLinkAction(concert.id);
    setAttToken(token);
    setAttBusy(false);
    return token;
  }

  async function copyAttLink() {
    const t = await ensureAttToken();
    await navigator.clipboard.writeText(`${window.location.origin}/conf/${t}`);
    setAttCopied(true);
    window.setTimeout(() => setAttCopied(false), 1600);
  }

  async function waAttLink() {
    const t = await ensureAttToken();
    const text = `Hola! Confirmeu si sereu al ${concert.kind === "assaig" ? "assaig" : concert.kind === "reunio" ? "la reunió" : "bolo"} de ${concert.bandName} el ${capitalize(formatDateFull(concert.date))}${concert.city ? " a " + concert.city.split(",")[0] : ""}: ${window.location.origin}/conf/${t}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  // ---- Rider i setlist ----
  const [riderId, setRiderId] = useState<string>(concert.riderId || "");
  const [setlistId, setSetlistId] = useState<string>(concert.setlistId || "");
  const [materialCopied, setMaterialCopied] = useState<string | null>(null);
  const [riderSearch, setRiderSearch] = useState("");
  const [riderPickerOpen, setRiderPickerOpen] = useState(false);
  const selectedRider = riders.find((r) => r.id === riderId) || null;
  const selectedSetlist = setlists.find((s) => s.id === setlistId) || null;
  const riderMatches = riders.filter((r) => !riderSearch.trim() || normalize(r.name).includes(normalize(riderSearch.trim())));

  // ---- Aprovació del rider ----
  const [apName, setApName] = useState("");
  const [apEmail, setApEmail] = useState("");
  const [apFormOpen, setApFormOpen] = useState(false);
  const [apBusy, setApBusy] = useState(false);
  const [apEmailStatus, setApEmailStatus] = useState<Record<string, string>>({});
  const currentApprovals = riderApprovals.filter((a) => a.riderId === riderId);
  const approvedNow = currentApprovals.some((a) => a.status === "aprovat");

  async function selectRider(id: string) {
    setRiderId(id);
    setRiderPickerOpen(false);
    setRiderSearch("");
    await setConcertMaterialAction(concert.id, "rider", id || null);
    router.refresh();
  }

  async function handleSendApproval() {
    if (!riderId) return;
    setApBusy(true);
    await sendRiderApprovalAction({ concertId: concert.id, riderId, recipientName: apName, recipientEmail: apEmail });
    setApFormOpen(false);
    setApName(""); setApEmail("");
    router.refresh();
    setApBusy(false);
  }

  function approvalUrl(id: string): string {
    return `${window.location.origin}/a/${id}`;
  }

  function waApproval(a: RiderApproval) {
    const text = `Hola${a.recipientName ? " " + a.recipientName : ""}! Us passem el rider tècnic de ${concert.bandName} pel ${capitalize(formatDateFull(concert.date))}${concert.city ? " a " + concert.city : ""}. Podeu aprovar-lo o proposar canvis aquí: ${approvalUrl(a.id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function copyMaterial(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/m/${token}`);
    setMaterialCopied(token);
    window.setTimeout(() => setMaterialCopied((v) => (v === token ? null : v)), 1600);
  }

  function waMaterial(token: string, what: string) {
    const text = `${what} de ${concert.bandName} pel bolo de ${capitalize(formatDateFull(concert.date))}${concert.city ? " a " + concert.city : ""}: ${window.location.origin}/m/${token}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const accent = band?.color1 || bandColor(concert.bandId).color;
  const cityColor = bandColor("city:" + (cf.city || "?"));
  const venueColor = bandColor("venue:" + (cf.venue || "?"));
  const sc = statusColors(cf.status);

  const liveConcert: Concert = { ...concert, ...cf, amount: parseInt(cf.amount, 10) || 0, status: cf.status as Concert["status"], attendance: attendance as Concert["attendance"], substitutes, noSubstitute };
  const info = infoCompletion(liveConcert);
  const rsPercent = rsCompletionPercent(concert);
  const rsMissing = rsMissingList(concert);

  const linkedByName: Record<string, LinkedMember> = {};
  linkedMembers.forEach((m) => { linkedByName[m.memberName] = m; });
  const requestByMember: Record<string, BackupRequest> = {};
  backupRequests.forEach((r) => { if (r.status === "oberta") requestByMember[r.memberName] = r; });

  const members = band?.members || [];
  const backups = band?.backups || [];

  function schedulePersist(next: typeof cf, att = attendance, subs = substitutes, noSubs = noSubstitute) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      await saveConcertAction({
        id: concert.id,
        bandName: concert.bandName,
        date: next.date, time: next.time, venue: next.venue, city: next.city,
        festaEntitat: next.festaEntitat, amount: parseInt(next.amount, 10) || 0, status: next.status,
        attendance: att, substitutes: subs, noSubstitute: noSubs,
        skipDefaults: true,
      });
      router.refresh();
      setSaving(false);
    }, 500);
  }

  function setField<K extends keyof typeof cf>(k: K, v: string) {
    const next = { ...cf, [k]: v };
    setCf(next);
    schedulePersist(next);
  }

  function setAttendanceFor(name: string, val: "yes" | "no" | null) {
    const att = { ...attendance };
    if (val === null) delete att[name]; else att[name] = val;
    setAttendance(att);
    schedulePersist(cf, att);
  }

  function setSubstituteFor(name: string, sub: string) {
    const subs = { ...substitutes };
    if (sub) subs[name] = sub; else delete subs[name];
    setSubstitutes(subs);
    const noSubs = { ...noSubstitute };
    if (sub) delete noSubs[name];
    setNoSubstitute(noSubs);
    schedulePersist(cf, attendance, subs, noSubs);
  }

  // ---- Repartiment ----
  const attendingNames = useMemo(() => {
    const names: string[] = [];
    members.forEach((m) => {
      if (attendance[m.name] === "no") {
        const sub = substitutes[m.name];
        if (sub) names.push(sub);
      } else {
        names.push(m.name);
      }
    });
    return names;
  }, [members, attendance, substitutes]);

  const amountNum = parseInt(cf.amount, 10) || 0;
  const payoutTotal = Object.values(payouts).reduce((s, v) => s + (v || 0), 0);

  function equalSplit() {
    if (!attendingNames.length || !amountNum) return;
    const per = Math.floor(amountNum / attendingNames.length);
    const next: Record<string, number> = {};
    attendingNames.forEach((n, i) => { next[n] = per + (i === 0 ? amountNum - per * attendingNames.length : 0); });
    setPayouts(next);
    persistPayouts(next);
  }

  async function persistPayouts(next: Record<string, number>) {
    setPayoutsSaving(true);
    await savePayoutsAction(concert.id, next);
    router.refresh();
    setPayoutsSaving(false);
  }

  const payoutNames = Object.keys(payouts).length ? Object.keys(payouts) : attendingNames;

  // ---- Facturació ----
  const [invEditOpen, setInvEditOpen] = useState(false);
  const [invEdit, setInvEdit] = useState({ base: "", iva: "21", irpf: "0", deposit: "0" });
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminding, setReminding] = useState(false);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const invTotals = invoice ? computeInvoiceTotals(invoice.baseAmount, invoice.ivaRate, invoice.irpfRate) : { iva: 0, irpf: 0, total: 0 };
  const daysOut = invoice ? Math.max(0, Math.round((new Date(today).getTime() - new Date(invoice.issueDate).getTime()) / 86400000)) : 0;
  const clientKey = concert.venue;
  const cd = clientDetails[clientKey] || { clientName: clientKey, cif: "", nom: "", address: "" };
  const [clientForm, setClientForm] = useState({ nom: cd.nom, cif: cd.cif, address: cd.address });

  async function handleGenerateInvoice() {
    setGenerating(true);
    await generateInvoiceAction(concert.id);
    router.refresh();
    setGenerating(false);
  }

  async function handleCreateLink() {
    setCreatingLink(true);
    const { url } = await createShareLinkAction({
      concertId: concert.id, scope: linkScope, recipientEmail: linkEmail, recipientName: linkName, days: linkDays,
    });
    setLastCreatedUrl(url);
    setNewLinkOpen(false);
    setLinkEmail(""); setLinkName("");
    router.refresh();
    setCreatingLink(false);
  }

  function linkUrl(id: string): string {
    return `${window.location.origin}/f/${id}`;
  }

  async function copyLink(id: string) {
    await navigator.clipboard.writeText(linkUrl(id));
    setCopied(id);
    window.setTimeout(() => setCopied((v) => (v === id ? null : v)), 1600);
  }

  function whatsappLink(l: ShareLink) {
    const text = `Hola${l.recipientName ? " " + l.recipientName : ""}! Ens falten dades del concert de ${concert.bandName} (${capitalize(formatDateFull(concert.date))}${concert.city ? ", " + concert.city : ""}). Les pots omplir aquí: ${linkUrl(l.id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleSendEmail(id: string) {
    setEmailStatus((p) => ({ ...p, [id]: "enviant…" }));
    const res = await sendShareLinkEmailAction(id);
    setEmailStatus((p) => ({ ...p, [id]: res.ok ? "enviat ✓" : res.error || "error" }));
    router.refresh();
  }

  const scopeLabels: Record<string, string> = { info: "Informació", ruta: "Full de ruta", both: "Info + full de ruta" };

  return (
    <div className="glow concert-detail" style={{ ["--band-accent" as string]: accent }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      {/* Capçalera */}
      <div className="cd-topbar">
        <Link href="/concerts" className="cd-back">← Concerts</Link>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {saving && <span className="t-dim" style={{ fontSize: 12 }}>Desant…</span>}
          <Link href={`/concerts/${concert.id}/dia`} className="cd-back" title="Tota la info del dia del bolo en una sola pantalla de mòbil">📱 Vista dia de bolo</Link>
        </div>
      </div>

      {clashes.length > 0 && (
        <div className="clash-banner">
          <strong>⚠ Possible conflicte de dates</strong>
          {clashes.map((c, i) => <div key={i}>{c}</div>)}
        </div>
      )}

      {/* Pòster: capçalera tipogràfica del concert */}
      <div className="cd-poster">
        <div className="cd-poster-glow" aria-hidden="true"></div>
        <div className="cd-poster-kicker">
          {cf.festaEntitat || (kind === "bolo" ? "concert" : kind === "reunio" ? "reunió" : kind)}
        </div>
        <div className="cd-poster-title">{concert.bandName}</div>
        <div className="cd-poster-date">{capitalize(formatDateFull(cf.date))}{cf.time ? ` — ${cf.time}h` : ""}</div>
        {(cf.venue || cf.city) && (
          <div className="cd-poster-place">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            {[cf.venue, cf.city.split(",")[0]].filter(Boolean).join(" · ")}
          </div>
        )}
        <div className="cd-poster-foot">
          <button
            type="button" className="badge-btn" style={{ background: sc.bg, color: sc.color }}
            onClick={() => setField("status", STATUS_CYCLE[(STATUS_CYCLE.indexOf(cf.status) + 1) % STATUS_CYCLE.length])}
          >{cf.status}</button>
          <div className="cd-hero-amount">{formatCurrency(amountNum)}</div>
          <div className="cd-meters">
            <Meter label="Informació" percent={info.percent} missing={info.missing} />
            <Meter label="Full de ruta" percent={rsPercent} missing={rsMissing} />
          </div>
          <button type="button" className="btn-outline cd-poster-share" onClick={() => setPosterOpen(true)}
            title="Genera un pòster transparent per a Instagram amb el mapa i les dades del concert">📸 Pòster IG</button>
        </div>
      </div>

      {/* Subpestanyes */}
      <div className="stats-tabs cd-tabs">
        {([["info", "Informació"], ["ruta", "Full de ruta"], ["assistencia", "Assistència"], ["facturacio", "Facturació"]] as const).map(([k, label]) => (
          <button key={k} type="button" className={"stats-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {/* Informació */}
      {tab === "info" && (<>
      <div className="panel cd-section" id="cd-info">
        <div className="panel-title cd-section-title">Informació</div>
        <div className="cd-info-grid">
          <div className="cd-field">
            <label className="form-label">Data</label>
            <input type="date" className="field-input form-field" value={cf.date} onChange={(e) => setField("date", e.target.value)} />
          </div>
          <div className="cd-field">
            <label className="form-label">Hora</label>
            <input type="time" className="field-input form-field" value={cf.time} onChange={(e) => setField("time", e.target.value)} />
          </div>
          <div className="cd-field">
            <label className="form-label">Població</label>
            <input className="field-input form-field" value={cf.city} onChange={(e) => setField("city", e.target.value)} placeholder="On toqueu?" />
          </div>
          <div className="cd-field">
            <label className="form-label">Ubicació / sala</label>
            <input className="field-input form-field" value={cf.venue} onChange={(e) => setField("venue", e.target.value)} placeholder="Recinte, plaça, sala…" />
          </div>
          <div className="cd-field">
            <label className="form-label">Festa / entitat</label>
            <input className="field-input form-field" value={cf.festaEntitat} onChange={(e) => setField("festaEntitat", e.target.value)} placeholder="Festa major, ajuntament…" />
          </div>
          <div className="cd-field">
            <label className="form-label">Import (sense IVA)</label>
            <input type="number" className="field-input form-field" value={cf.amount} onChange={(e) => setField("amount", e.target.value)} />
          </div>
          <div className="cd-field">
            <label className="form-label">Tipus d&apos;esdeveniment</label>
            <select
              className="field-input form-field" value={kind}
              onChange={async (e) => {
                const v = e.target.value as "bolo" | "assaig" | "reunio" | "altre";
                setKind(v);
                await setConcertKindAction(concert.id, v);
                router.refresh();
              }}
            >
              <option value="bolo">Bolo</option>
              <option value="assaig">Assaig</option>
              <option value="reunio">Reunió</option>
              <option value="altre">Altre</option>
            </select>
          </div>
          <div className="cd-field">
            <label className="form-label">Repeteix setmanalment</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="field-input form-field" style={{ width: 110 }} value={repeatWeeks} onChange={(e) => setRepeatWeeks(parseInt(e.target.value, 10))}>
                {[1, 2, 3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>×{n}</option>)}
              </select>
              <button
                type="button" className="btn-outline" disabled={repeating}
                title="Crea còpies d'aquest esdeveniment les setmanes següents"
                onClick={async () => {
                  setRepeating(true);
                  const { created } = await repeatConcertAction(concert.id, repeatWeeks);
                  router.refresh();
                  setRepeating(false);
                  alert(`${created} esdeveniments creats.`);
                }}
              >{repeating ? "Creant…" : "Crea còpies"}</button>
            </div>
          </div>
        </div>
      </div>

      <ChecklistSection
        concertId={concert.id}
        checklists={checklists}
        memberNames={members.map((m) => m.name)}
      />
      </>)}

      {/* Assistència */}
      {tab === "assistencia" && (
      <div className="panel cd-section" id="cd-assistencia">
        <div className="panel-header-row cd-section-title">
          <div className="panel-title">Assistència</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {linkedMembers.some((lm) => attendance[lm.memberName] !== "yes" && attendance[lm.memberName] !== "no") && (
              <button
                type="button" className="btn-outline" disabled={!emailReady || nudging}
                title={emailReady ? "Correu als membres amb compte que encara no han respost" : "Configura RESEND_API_KEY per enviar correus"}
                onClick={async () => {
                  setNudging(true);
                  const res = await nudgeAttendanceAction(concert.id);
                  setNudgeResult(res.ok ? `${res.sent} recordatoris enviats ✓` : res.error || "error");
                  setNudging(false);
                }}
              >{nudgeResult || (nudging ? "Enviant…" : "Recorda-ho als pendents")}</button>
            )}
            <div className="t-dim" style={{ fontSize: 12 }}>
              {members.filter((m) => attendance[m.name] === "yes").length}/{members.length} confirmats
            </div>
          </div>
        </div>
        {members.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Aquest concert no té grup amb membres assignat.</div>
        ) : (
          <div className="cd-attendance-list">
            {members.map((m) => {
              const linked = linkedByName[m.name];
              const att = attendance[m.name];
              const req = requestByMember[m.name];
              const inss = instrumentsFor(m);
              return (
                <div key={m.name} className={"cd-att-row" + (att === "no" ? " att-no" : att === "yes" ? " att-yes" : "")}>
                  <img className="member-photo backup-photo" src={photosByName[normalize(m.name)] ? `/api/file/${photosByName[normalize(m.name)]}` : personPhotoDataUri(m.name)} alt="" />
                  <div className="cd-att-main">
                    <div className="member-name">
                      {m.name}
                      {linked && <span className="member-linked" title={`Usuari d'Escenari: ${linked.email} — pot confirmar des de la seva app`}><img src="/logo-mark.png" alt="Escenari" /></span>}
                    </div>
                    <div className="member-instruments">
                      {inss.slice(0, 3).map((ins) => {
                        const icon = instrumentIconFor(ins);
                        return <span key={ins} className="member-instrument-chip">{icon && <img src={icon} alt="" />}{ins}</span>;
                      })}
                    </div>
                  </div>
                  <div className="cd-att-controls">
                    <button type="button" className={"cd-att-btn yes" + (att === "yes" ? " active" : "")} onClick={() => setAttendanceFor(m.name, att === "yes" ? null : "yes")}>Sí</button>
                    <button type="button" className={"cd-att-btn no" + (att === "no" ? " active" : "")} onClick={() => setAttendanceFor(m.name, att === "no" ? null : "no")}>No</button>
                  </div>
                  {att === "no" && (
                    <div className="cd-att-sub">
                      <select
                        className="field-input compact-field"
                        value={substitutes[m.name] || ""}
                        onChange={(e) => setSubstituteFor(m.name, e.target.value)}
                      >
                        <option value="">Tria suplent…</option>
                        {backups.map((b) => <option key={b.name} value={b.name}>{b.name}{b.instruments.length ? ` (${b.instruments.join(", ")})` : ""}</option>)}
                      </select>
                      {!substitutes[m.name] && !req && (
                        <button
                          type="button" className="btn-outline cd-publish-btn"
                          onClick={async () => {
                            await publishBackupRequestAction({
                              bandId: concert.bandId, concertId: concert.id, memberName: m.name,
                              instruments: inss, note: "",
                            });
                            router.refresh();
                          }}
                        >Publica cerca de suplent</button>
                      )}
                      {req && (
                        <span className="cd-search-open">
                          Cerca publicada · {req.applications.length} candidatures
                          <button type="button" className="link-btn" onClick={async () => { await setBackupRequestStatusAction(req.id, "cancel·lada"); router.refresh(); }}>retira</button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Comparteix per confirmar */}
        {members.length > 0 && (
          <div className="cfm-share-box">
            <div>
              <div className="cd-subtitle" style={{ marginBottom: 4 }}>Comparteix per confirmar</div>
              <div className="t-dim" style={{ fontSize: 12.5 }}>
                Un enllaç per al grup: cada músic es marca i confirma si hi serà.
                Qui no tingui compte se&apos;l crea en un moment i queda vinculat al grup.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn-outline" disabled={attBusy} onClick={copyAttLink}>
                {attCopied ? "Copiat ✓" : attBusy ? "Creant…" : "Copia l'enllaç"}
              </button>
              <button type="button" className="btn-outline cd-wa-btn" disabled={attBusy} onClick={waAttLink}>WhatsApp</button>
              {attToken && (
                <button type="button" className="btn-outline" onClick={() => window.open(`/conf/${attToken}`, "_blank")}>Obre</button>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Full de ruta */}
      {tab === "ruta" && (
      <div className="panel cd-section" id="cd-ruta">
        <div className="panel-header-row cd-section-title">
          <div className="panel-title">Full de ruta</div>
          <button type="button" className="btn-outline" onClick={() => setRsPreviewOpen(true)}>Previsualitza</button>
        </div>
        <RouteSheetEditor concert={concert} />
      </div>
      )}

      {/* Rider i setlist */}
      {tab === "info" && (
      <div className="panel cd-section" id="cd-material">
        <div className="panel-title cd-section-title">Rider i setlist</div>
        <div className="cd-material-grid">
          <div className="cd-material-col">
            <div className="cd-subtitle">
              Rider tècnic del bolo
              {approvedNow && <span className="cd-link-status activa" style={{ marginLeft: 10 }}>aprovat ✓</span>}
            </div>

            {/* Cercador de riders per nom */}
            <div className="rider-picker">
              <input
                className="field-input form-field"
                placeholder={selectedRider ? selectedRider.name : "Cerca un rider pel nom…"}
                value={riderSearch}
                onFocus={() => setRiderPickerOpen(true)}
                onChange={(e) => { setRiderSearch(e.target.value); setRiderPickerOpen(true); }}
              />
              {riderPickerOpen && (
                <>
                  <div className="year-picker-overlay" onClick={() => setRiderPickerOpen(false)}></div>
                  <div className="rider-picker-dropdown">
                    <button type="button" className="year-option" onClick={() => selectRider("")}>— Cap rider —</button>
                    {riderMatches.map((r) => (
                      <button key={r.id} type="button" className={"year-option" + (riderId === r.id ? " active" : "")} onClick={() => selectRider(r.id)}>
                        {r.name}
                        <span className="t-dim" style={{ fontSize: 11, marginLeft: 8 }}>{r.content.stage.items.length} elements</span>
                      </button>
                    ))}
                    {riderMatches.length === 0 && <div className="t-dim" style={{ padding: "8px 12px", fontSize: 12 }}>Cap rider amb aquest nom.</div>}
                  </div>
                </>
              )}
            </div>

            {selectedRider ? (
              <>
                <div className="cd-material-actions">
                  <button type="button" className="btn-outline" onClick={() => window.open(`/m/${selectedRider.publicToken}`, "_blank")}>Obre / PDF</button>
                  <button type="button" className="btn-outline" onClick={() => router.push(`/rider/${selectedRider.id}`)}>Edita</button>
                  <button type="button" className="btn-outline" onClick={() => copyMaterial(selectedRider.publicToken)}>{materialCopied === selectedRider.publicToken ? "Copiat ✓" : "Copia enllaç"}</button>
                  <button type="button" className="btn-outline cd-wa-btn" onClick={() => waMaterial(selectedRider.publicToken, "Rider tècnic")}>WhatsApp</button>
                </div>

                {/* Aprovació */}
                <div className="approval-block">
                  {currentApprovals.map((a) => (
                    <div key={a.id} className="approval-row">
                      <div className="approval-row-main">
                        <span className={"cd-link-status " + (a.status === "aprovat" ? "activa" : a.status === "contrarider" ? "counter" : "pending")}>
                          {a.status === "aprovat" ? "aprovat ✓" : a.status === "contrarider" ? "contrarider rebut" : "pendent d'aprovar"}
                        </span>
                        <span className="t-dim" style={{ fontSize: 12 }}>
                          {a.recipientName || a.recipientEmail || "Sense destinatari"}
                          {a.emailSentAt ? " · correu enviat" : ""}
                        </span>
                        {a.status === "contrarider" && a.counterNote && (
                          <span className="t-dim" style={{ fontSize: 12, fontStyle: "italic" }}>&ldquo;{a.counterNote}&rdquo;</span>
                        )}
                      </div>
                      <div className="approval-row-actions">
                        {a.status !== "aprovat" && (
                          <>
                            <button type="button" className="btn-outline" onClick={async () => { await navigator.clipboard.writeText(approvalUrl(a.id)); setApEmailStatus((p) => ({ ...p, [a.id]: "enllaç copiat ✓" })); }}>Copia</button>
                            <button type="button" className="btn-outline cd-wa-btn" onClick={() => waApproval(a)}>WhatsApp</button>
                            {a.recipientEmail && (
                              <button
                                type="button" className="btn-outline" disabled={!emailReady}
                                title={emailReady ? `Envia a ${a.recipientEmail}` : "Configura RESEND_API_KEY per enviar correus"}
                                onClick={async () => {
                                  setApEmailStatus((p) => ({ ...p, [a.id]: "enviant…" }));
                                  const res = await sendApprovalEmailAction(a.id);
                                  setApEmailStatus((p) => ({ ...p, [a.id]: res.ok ? "enviat ✓" : res.error || "error" }));
                                  router.refresh();
                                }}
                              >{apEmailStatus[a.id] || "Correu"}</button>
                            )}
                          </>
                        )}
                        {a.status === "contrarider" && a.hasCounter && (
                          <>
                            <button type="button" className="btn-outline" onClick={() => window.open(`/a/${a.id}`, "_blank")}>Veu els canvis</button>
                            <button type="button" className="btn-save" onClick={async () => { await acceptCounterRiderAction(a.id); router.refresh(); }}>Accepta el contrarider</button>
                          </>
                        )}
                        <button type="button" className="row-delete-btn" title="Retira aquesta sol·licitud" onClick={async () => { await deleteRiderApprovalAction(a.id); router.refresh(); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {apFormOpen ? (
                    <div className="approval-form">
                      <input className="field-input compact-field" placeholder="Nom (tècnic de la sala…)" value={apName} onChange={(e) => setApName(e.target.value)} />
                      <input className="field-input compact-field" type="email" placeholder="Correu (opcional)" value={apEmail} onChange={(e) => setApEmail(e.target.value)} />
                      <button type="button" className="btn-outline" onClick={() => setApFormOpen(false)}>Cancel·la</button>
                      <button type="button" className="btn-save" disabled={apBusy} onClick={handleSendApproval}>{apBusy ? "Creant…" : "Crea l'enllaç"}</button>
                    </div>
                  ) : !approvedNow && (
                    <SpecularButton size="md" radius={12} tint="#8b7bff" tintOpacity={0.3} baseColor="#8b7bff" lineColor="#ffffff" onClick={() => setApFormOpen(true)}>
                      Envia per aprovar
                    </SpecularButton>
                  )}
                </div>
              </>
            ) : (
              <div className="t-dim" style={{ fontSize: 12 }}>
                {riders.length ? "Cerca i tria quin rider necessita aquest concert." : "Aquest grup encara no té riders — crea'ls a la pestanya Riders del grup."}
              </div>
            )}
          </div>
          <div className="cd-material-col">
            <div className="cd-subtitle">Setlist del bolo</div>
            <select
              className="field-input form-field"
              value={setlistId}
              onChange={async (e) => {
                const v = e.target.value;
                setSetlistId(v);
                await setConcertMaterialAction(concert.id, "setlist", v || null);
                router.refresh();
              }}
            >
              <option value="">— Cap setlist assignada —</option>
              {setlists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {selectedSetlist ? (
              <div className="cd-material-actions">
                <button type="button" className="btn-outline" onClick={() => window.open(`/m/${selectedSetlist.publicToken}`, "_blank")}>Obre / PDF</button>
                <button type="button" className="btn-outline" onClick={() => copyMaterial(selectedSetlist.publicToken)}>{materialCopied === selectedSetlist.publicToken ? "Copiat ✓" : "Copia enllaç"}</button>
                <button type="button" className="btn-outline cd-wa-btn" onClick={() => waMaterial(selectedSetlist.publicToken, "Setlist")}>WhatsApp</button>
              </div>
            ) : (
              <div className="t-dim" style={{ fontSize: 12 }}>
                {setlists.length ? "Tria la setlist d'aquest concert per poder-la enviar." : "Aquest grup encara no té setlists — crea-les a la pestanya Setlists del grup."}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Facturació */}
      {tab === "facturacio" && (
      <div className="panel cd-section" id="cd-facturacio">
        <div className="panel-title cd-section-title">Facturació</div>

        <div className="cd-fact-grid">
          <div className="cd-fact-col">
            <div className="cd-subtitle">Dades del client</div>
            <div className="cd-field">
              <label className="form-label">Client (sala / entitat)</label>
              <input className="field-input form-field" value={clientKey} disabled title="El client és la ubicació del concert" />
            </div>
            <div className="cd-field">
              <label className="form-label">Raó social</label>
              <input className="field-input form-field" value={clientForm.nom}
                onChange={(e) => setClientForm((p) => ({ ...p, nom: e.target.value }))}
                onBlur={async () => { await upsertClientDetailsAction(clientKey, "nom", clientForm.nom); router.refresh(); }} />
            </div>
            <div className="cd-field">
              <label className="form-label">CIF</label>
              <input className="field-input form-field" value={clientForm.cif}
                onChange={(e) => setClientForm((p) => ({ ...p, cif: e.target.value }))}
                onBlur={async () => { await upsertClientDetailsAction(clientKey, "cif", clientForm.cif); router.refresh(); }} />
            </div>
            <div className="cd-field">
              <label className="form-label">Adreça</label>
              <input className="field-input form-field" value={clientForm.address}
                onChange={(e) => setClientForm((p) => ({ ...p, address: e.target.value }))}
                onBlur={async () => { await upsertClientDetailsAction(clientKey, "address", clientForm.address); router.refresh(); }} />
            </div>
          </div>

          <div className="cd-fact-col">
            <div className="cd-subtitle">Factura</div>
            {invoice ? (
              <div className="cd-invoice-card">
                <div className="cd-invoice-head">
                  <button type="button" className="link-btn t-strong" onClick={() => setInvoicePreviewOpen(true)}>{invoice.id}</button>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {invoice.state !== "pagada" && (
                      <span className={"t-dim" + (daysOut > 30 ? " fin-neg" : "")} style={{ fontSize: 11.5 }} title="Dies des de l'emissió">
                        {daysOut} dies
                      </span>
                    )}
                    <select
                      className="field-input compact-field"
                      value={invoice.state}
                      onChange={async (e) => { await setInvoiceStateAction(invoice.id, e.target.value as "pagada" | "pendent" | "vençuda"); router.refresh(); }}
                    >
                      <option value="pendent">pendent</option>
                      <option value="pagada">pagada</option>
                      <option value="vençuda">vençuda</option>
                    </select>
                  </div>
                </div>

                {invEditOpen ? (
                  <div className="cd-invoice-edit">
                    <label>Base<input type="number" className="field-input compact-field" value={invEdit.base} onChange={(e) => setInvEdit({ ...invEdit, base: e.target.value })} /></label>
                    <label>IVA %<select className="field-input compact-field" value={invEdit.iva} onChange={(e) => setInvEdit({ ...invEdit, iva: e.target.value })}><option>21</option><option>10</option><option>0</option></select></label>
                    <label>IRPF %<select className="field-input compact-field" value={invEdit.irpf} onChange={(e) => setInvEdit({ ...invEdit, irpf: e.target.value })}><option>0</option><option>7</option><option>15</option></select></label>
                    <label>Bestreta<input type="number" className="field-input compact-field" value={invEdit.deposit} onChange={(e) => setInvEdit({ ...invEdit, deposit: e.target.value })} /></label>
                    <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
                      <button type="button" className="btn-outline" onClick={() => setInvEditOpen(false)}>Cancel·la</button>
                      <button type="button" className="btn-save" onClick={async () => {
                        await editInvoiceAction({
                          id: invoice.id, client: invoice.client, issueDate: invoice.issueDate, dueDate: invoice.dueDate,
                          baseAmount: parseInt(invEdit.base, 10) || 0, ivaRate: parseFloat(invEdit.iva) || 0,
                          irpfRate: parseFloat(invEdit.irpf) || 0, depositAmount: parseInt(invEdit.deposit, 10) || 0,
                          depositPaid: invoice.depositPaid,
                        });
                        setInvEditOpen(false);
                        router.refresh();
                      }}>Desa</button>
                    </div>
                  </div>
                ) : (
                  <div className="cd-invoice-rows">
                    <div><span className="t-dim">Base imposable</span><span>{formatCurrency(invoice.baseAmount)}</span></div>
                    <div><span className="t-dim">IVA {invoice.ivaRate}%</span><span>{formatCurrency(invTotals.iva)}</span></div>
                    {invoice.irpfRate > 0 && <div><span className="t-dim">Retenció IRPF {invoice.irpfRate}%</span><span className="fin-neg">−{formatCurrency(invTotals.irpf)}</span></div>}
                    <div className="t-strong"><span>Total</span><span>{formatCurrency(invoice.amount)}</span></div>
                    {invoice.depositAmount > 0 && (
                      <>
                        <div>
                          <span className="t-dim">Bestreta</span>
                          <span>
                            {formatCurrency(invoice.depositAmount)}{" "}
                            <button type="button" className="link-btn" style={{ fontSize: 11 }}
                              onClick={async () => {
                                await editInvoiceAction({
                                  id: invoice.id, client: invoice.client, issueDate: invoice.issueDate, dueDate: invoice.dueDate,
                                  baseAmount: invoice.baseAmount, ivaRate: invoice.ivaRate, irpfRate: invoice.irpfRate,
                                  depositAmount: invoice.depositAmount, depositPaid: !invoice.depositPaid,
                                });
                                router.refresh();
                              }}
                            >{invoice.depositPaid ? "cobrada ✓" : "marca cobrada"}</button>
                          </span>
                        </div>
                        <div><span className="t-dim">Resta pendent</span><span>{formatCurrency(invoice.amount - (invoice.depositPaid ? invoice.depositAmount : 0))}</span></div>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn-outline" onClick={() => setInvoicePreviewOpen(true)}>Visualitza / PDF</button>
                  {!invEditOpen && <button type="button" className="btn-outline" onClick={() => {
                    setInvEdit({ base: String(invoice.baseAmount), iva: String(invoice.ivaRate), irpf: String(invoice.irpfRate), deposit: String(invoice.depositAmount) });
                    setInvEditOpen(true);
                  }}>Edita</button>}
                </div>

                {invoice.state !== "pagada" && (
                  <div className="cd-reminder-row">
                    <input className="field-input compact-field" type="email" placeholder="correu del client…" value={reminderEmail} onChange={(e) => setReminderEmail(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
                    <button
                      type="button" className="btn-outline" disabled={!emailReady || !reminderEmail || reminding}
                      title={emailReady ? "Envia un recordatori amb el detall de la factura" : "Configura RESEND_API_KEY per enviar correus"}
                      onClick={async () => {
                        setReminding(true);
                        const res = await sendInvoiceReminderAction(invoice.id, reminderEmail);
                        setReminderStatus(res.ok ? "enviat ✓" : res.error || "error");
                        setReminding(false);
                      }}
                    >{reminderStatus || (reminding ? "Enviant…" : "Recordatori de cobrament")}</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="cd-invoice-card">
                <div className="cd-invoice-rows">
                  <div><span className="t-dim">Base imposable</span><span>{formatCurrency(amountNum)}</span></div>
                  <div><span className="t-dim">IVA {companyInfo.ivaRate}%</span><span>{formatCurrency(Math.round((amountNum * companyInfo.ivaRate) / 100))}</span></div>
                  {companyInfo.irpfRate > 0 && <div><span className="t-dim">Retenció IRPF {companyInfo.irpfRate}%</span><span className="fin-neg">−{formatCurrency(Math.round((amountNum * companyInfo.irpfRate) / 100))}</span></div>}
                  <div className="t-strong"><span>Total factura</span><span>{formatCurrency(computeInvoiceTotals(amountNum, companyInfo.ivaRate, companyInfo.irpfRate).total)}</span></div>
                </div>
                {cf.status === "confirmat" ? (
                  <button type="button" className="btn-save" disabled={generating} onClick={handleGenerateInvoice}>
                    {generating ? "Generant…" : "Genera la factura automàtica"}
                  </button>
                ) : (
                  <div className="t-dim" style={{ fontSize: 12 }}>Confirma el concert per generar la factura.</div>
                )}
              </div>
            )}

            {concertExpenses > 0 && (
              <div className="cd-margin-row">
                <span className="t-dim">Marge net del bolo</span>
                <span>
                  {formatCurrency(amountNum)} − {formatCurrency(concertExpenses)} despeses ={" "}
                  <strong className={amountNum - concertExpenses >= 0 ? "fin-pos" : "fin-neg"}>{formatCurrency(amountNum - concertExpenses)}</strong>
                </span>
              </div>
            )}

            {venueHistory.length > 0 && (
              <div className="cd-history">
                <div className="cd-subtitle" style={{ marginTop: 14 }}>Historial amb {clientKey}</div>
                {venueHistory.map((h, i) => (
                  <div key={i} className="cd-history-row">
                    <span className="t-dim">{formatDate(h.date)}</span>
                    <span>{formatCurrency(h.amount)}</span>
                    <span className={"badge"} style={h.invoiceState ? { background: statusColors(h.invoiceState).bg, color: statusColors(h.invoiceState).color } : {}}>
                      {h.invoiceState || "sense factura"}
                    </span>
                    {h.daysToPay !== null && <span className="t-dim" style={{ fontSize: 11 }}>{h.daysToPay}d termini</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Repartiment */}
        <div className="cd-subtitle" style={{ marginTop: 22 }}>
          Repartiment del caixet{payoutsSaving ? " · desant…" : ""}
          <button type="button" className="link-btn" style={{ marginLeft: 10 }} onClick={equalSplit}>reparteix a parts iguals</button>
        </div>
        {payoutNames.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Sense participants: marca l&apos;assistència per repartir.</div>
        ) : (
          <>
            <div className="cd-payout-bar">
              {payoutNames.map((n, i) => {
                const v = payouts[n] || 0;
                const pct = payoutTotal ? (v / payoutTotal) * 100 : 0;
                return pct > 0 ? <div key={n} className="cd-payout-seg" style={{ width: pct + "%", background: `oklch(0.68 0.16 ${(i * 47 + 250) % 360})` }} title={`${n}: ${formatCurrency(v)}`}></div> : null;
              })}
            </div>
            <div className="cd-payout-list">
              {payoutNames.map((n, i) => (
                <div key={n} className="cd-payout-row">
                  <span className="cd-payout-dot" style={{ background: `oklch(0.68 0.16 ${(i * 47 + 250) % 360})` }}></span>
                  <img className="member-photo" style={{ width: 28, height: 28, borderRadius: 8 }} src={photosByName[normalize(n)] ? `/api/file/${photosByName[normalize(n)]}` : personPhotoDataUri(n)} alt="" />
                  <span className="cd-payout-name">{n}</span>
                  <input
                    type="number" className="field-input compact-field cd-payout-input"
                    value={payouts[n] ?? ""}
                    placeholder="0"
                    onChange={(e) => setPayouts((p) => ({ ...p, [n]: parseInt(e.target.value, 10) || 0 }))}
                    onBlur={() => persistPayouts(payouts)}
                  />
                  <span className="t-dim" style={{ fontSize: 12, width: 40, textAlign: "right" }}>
                    {payoutTotal ? Math.round(((payouts[n] || 0) / payoutTotal) * 100) + "%" : "—"}
                  </span>
                </div>
              ))}
              <div className="cd-payout-total">
                <span>Total repartit</span>
                <span className={payoutTotal > amountNum ? "cd-payout-over" : ""}>{formatCurrency(payoutTotal)} / {formatCurrency(amountNum)}</span>
              </div>
            </div>
            <div className="t-dim" style={{ fontSize: 12, marginTop: 8 }}>
              Els pagaments dins de l&apos;app arribaran més endavant — de moment aquest repartiment és el full de càlcul de referència.
            </div>
          </>
        )}
      </div>
      )}

      {/* Comparteix: a Informació i també al final del Full de ruta */}
      {(tab === "info" || tab === "ruta") && (
      <div className="panel cd-section" id="cd-comparteix">
        <div className="panel-header-row cd-section-title">
          <div className="panel-title">Comparteix — formularis per omplir dades</div>
          {!newLinkOpen && <button type="button" className="glow-cta" onClick={() => setNewLinkOpen(true)}>+ Nou enllaç</button>}
        </div>
        <div className="t-dim" style={{ fontSize: 13, marginBottom: 14 }}>
          Genera un enllaç caducable perquè l&apos;ajuntament, el promotor o la sala omplin la informació que falta.
          El formulari es pot editar mentre l&apos;enllaç sigui vàlid, encara que ja s&apos;hagi enviat.
        </div>

        {newLinkOpen && (
          <div className="cd-newlink">
            <div className="cd-newlink-scopes">
              {(["info", "ruta", "both"] as const).map((s) => (
                <button key={s} type="button" className={"cd-scope-card" + (linkScope === s ? " active" : "")} onClick={() => setLinkScope(s)}>
                  <div className="cd-scope-title">{scopeLabels[s]}</div>
                  <div className="cd-scope-desc">
                    {s === "info" ? "Data, lloc, festa i import" : s === "ruta" ? "Horaris, contactes, hospitalitat, tècnica" : "Tot el formulari complet"}
                  </div>
                </button>
              ))}
            </div>
            <div className="cd-newlink-fields">
              <div className="cd-field">
                <label className="form-label">Nom del destinatari</label>
                <input className="field-input form-field" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Maria (Aj. de Reus)" />
              </div>
              <div className="cd-field">
                <label className="form-label">Correu electrònic</label>
                <input className="field-input form-field" type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="cultura@ajuntament.cat" />
              </div>
              <div className="cd-field">
                <label className="form-label">Validesa</label>
                <select className="field-input form-field" value={linkDays} onChange={(e) => setLinkDays(parseInt(e.target.value, 10))}>
                  <option value={7}>7 dies</option>
                  <option value={14}>14 dies</option>
                  <option value={30}>30 dies</option>
                  <option value={60}>60 dies</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn-outline" onClick={() => setNewLinkOpen(false)}>Cancel·la</button>
              <button type="button" className="btn-save" disabled={creatingLink} onClick={handleCreateLink}>
                {creatingLink ? "Creant…" : "Crea l'enllaç"}
              </button>
            </div>
          </div>
        )}

        {lastCreatedUrl && (
          <div className="cd-created-banner">
            Enllaç creat: <code>{lastCreatedUrl}</code>
          </div>
        )}

        {shareLinks.length === 0 && !newLinkOpen ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Encara no hi ha cap enllaç per aquest concert.</div>
        ) : (
          <div className="cd-links-list">
            {shareLinks.map((l) => {
              const st = shareLinkStatus(l);
              return (
                <div key={l.id} className={"cd-link-card" + (st !== "activa" ? " inactive" : "")}>
                  <div className="cd-link-main">
                    <div className="cd-link-title">
                      <span className="badge" style={{ background: "oklch(0.68 0.19 290 / 0.16)", color: "var(--accent-text)" }}>{scopeLabels[l.scope]}</span>
                      <span className={"cd-link-status " + st}>{st}</span>
                      {l.submittedAt && <span className="cd-link-status activa">respost ✓</span>}
                      {l.lastOpenedAt && !l.submittedAt && <span className="t-dim" style={{ fontSize: 11 }}>obert</span>}
                    </div>
                    <div className="t-dim" style={{ fontSize: 12 }}>
                      {l.recipientName || l.recipientEmail || "Sense destinatari"} · caduca {new Date(l.expiresAt).toLocaleDateString("ca-ES")}
                      {l.emailSentAt ? " · correu enviat" : ""}
                    </div>
                  </div>
                  {st === "activa" && (
                    <div className="cd-link-actions">
                      <button type="button" className="btn-outline" onClick={() => copyLink(l.id)}>{copied === l.id ? "Copiat ✓" : "Copia"}</button>
                      <button type="button" className="btn-outline cd-wa-btn" onClick={() => whatsappLink(l)}>WhatsApp</button>
                      {l.recipientEmail && (
                        <button
                          type="button" className="btn-outline" disabled={!emailReady}
                          title={emailReady ? `Envia a ${l.recipientEmail}` : "Configura RESEND_API_KEY per enviar correus des d'Escenari"}
                          onClick={() => handleSendEmail(l.id)}
                        >{emailStatus[l.id] || "Envia per correu"}</button>
                      )}
                      <button type="button" className="row-delete-btn" title="Revoca l'enllaç" onClick={async () => { await revokeShareLinkAction(l.id); router.refresh(); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {rsPreviewOpen && (
        <RouteSheetPreview concert={concert} onClose={() => setRsPreviewOpen(false)} onEdit={() => setRsPreviewOpen(false)} />
      )}
      {invoicePreviewOpen && invoice && (
        <InvoicePreview invoice={invoice} concert={concert} companyInfo={companyInfo} onClose={() => setInvoicePreviewOpen(false)} />
      )}
      {posterOpen && (
        <ConcertPosterModal concert={liveConcert} band={band} onClose={() => setPosterOpen(false)} />
      )}
    </div>
  );
}
