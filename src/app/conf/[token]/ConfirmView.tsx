"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { respondConfAction, searchSubstituteCandidatesAction, proposeSubstituteAction, createSubstituteLinkAction } from "@/app/conf/actions";
import { logoBox } from "@/lib/logo";
import { personPhotoDataUri } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { formatDateFull, capitalize, formatConcertTime, WEEKDAY_FULL, MONTH_ABBR } from "@/lib/format";
import type { Concert, Band } from "@/lib/types";
import DiaBody from "@/components/DiaBody";
import VerifiedTick from "@/components/VerifiedTick";

export type ConfMember = {
  name: string;
  instruments: string[];
  photoId: string;
  // Ja té el compte vinculat a aquest membre del grup (band_members).
  linked: boolean;
  // Té compte d'Escenari (vinculat, o un perfil amb el mateix correu) —
  // se li demana entrar; si no, crear-se'l.
  hasAccount: boolean;
  isMe: boolean;
};

export type ConfViewer = {
  loggedIn: boolean;
  role: "manager" | "artist" | "none";
  // Membre d'aquest grup a què ja està vinculat el compte que mira la
  // pàgina (buit si cap).
  linkedMemberName: string;
};

// Cerca de suplent oberta per a un membre i un concert: qui s'hi ha
// presentat (o ha estat proposat) i l'enllaç del suplent, si n'hi ha.
export type ConfSubInfo = {
  requestId: string;
  token: string;
  applications: { name: string; status: "pendent" | "acceptada" | "rebutjada" }[];
};

// Què cal per poder respondre, un cop triat qui ets.
type Gate = "signin" | "signup" | "wrong-account" | "manager" | "table";

// Data curta per a cada fila de la taula ("Dis 12 oct", amb l'any només si
// no és el d'enguany).
function rowDate(date: string): string {
  const p = date.split("-").map(Number);
  const dt = new Date(p[0], p[1] - 1, p[2]);
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return `${WEEKDAY_FULL[dt.getDay()].slice(0, 3)} ${p[2]} ${MONTH_ABBR[p[1] - 1]}${sameYear ? "" : " " + p[0]}`;
}

export default function ConfirmView({ token, single, allFuture, band, concerts, diaBand, members, linkedNames = [], subs = {}, viewer, preselect }: {
  token: string;
  // Enllaç d'un sol concert (els de sempre): es mostra el pòster i els
  // detalls del dia a dalt de tot, com fins ara.
  single: boolean;
  allFuture: boolean;
  band: { name: string; logo: string; logoAspect?: string; color1: string; color2: string };
  // Cerques de suplent obertes: concert → membre (normalitzat) → info.
  subs?: Record<string, Record<string, ConfSubInfo>>;
  concerts: Concert[];
  diaBand: Band | null;
  members: ConfMember[];
  // Noms amb compte vinculat, per al tick lila de "Qui ve" (DiaBody).
  linkedNames?: string[];
  viewer: ConfViewer;
  preselect: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(() =>
    members.some((m) => m.name === preselect) ? preselect : members.find((m) => m.isMe)?.name || ""
  );
  // Respostes per concert i membre — còpia local per pintar-les a l'instant.
  const [answers, setAnswers] = useState<Record<string, Record<string, "yes" | "no">>>(() => {
    const out: Record<string, Record<string, "yes" | "no">> = {};
    concerts.forEach((c) => { out[c.id] = { ...(c.attendance || {}) }; });
    return out;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // ---- Proposar un suplent (quan es diu que no) ----
  const [subsLocal, setSubsLocal] = useState(subs);
  const [subPanel, setSubPanel] = useState<{ concertId: string; mode: "menu" | "search" | "link" } | null>(null);
  const [subQ, setSubQ] = useState("");
  const [subResults, setSubResults] = useState<{ clerkUserId: string; name: string; instruments: string[] }[]>([]);
  const [subSearching, setSubSearching] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subLink, setSubLink] = useState<string | null>(null);
  const [subCopied, setSubCopied] = useState(false);
  useEffect(() => {
    if (!subPanel || subPanel.mode !== "search") return;
    const q = subQ.trim();
    if (q.length < 2) { setSubResults([]); return; }
    setSubSearching(true);
    const t = window.setTimeout(async () => {
      const r = await searchSubstituteCandidatesAction(token, q);
      setSubResults(r);
      setSubSearching(false);
    }, 250);
    return () => window.clearTimeout(t);
  }, [subQ, subPanel, token]);

  function openSubPanel(concertId: string, mode: "menu" | "search" | "link") {
    setSubPanel({ concertId, mode });
    setSubQ("");
    setSubResults([]);
    setSubError(null);
    setSubCopied(false);
  }
  function addLocalApplication(concertId: string, memberName: string, name: string, tokenValue?: string) {
    setSubsLocal((prev) => {
      const byMember = { ...(prev[concertId] || {}) };
      const key = normalize(memberName);
      const cur = byMember[key] || { requestId: "", token: "", applications: [] };
      byMember[key] = {
        ...cur,
        token: tokenValue ?? cur.token,
        applications: name && !cur.applications.some((a) => a.name === name) ? [...cur.applications, { name, status: "pendent" as const }] : cur.applications,
      };
      return { ...prev, [concertId]: byMember };
    });
  }
  async function proposeCandidate(concertId: string, memberName: string, cand: { clerkUserId: string; name: string }) {
    setSubBusy(true);
    setSubError(null);
    const res = await proposeSubstituteAction(token, concertId, memberName, cand.clerkUserId);
    setSubBusy(false);
    if (!res.ok) { setSubError(res.error || "No s'ha pogut proposar."); return; }
    addLocalApplication(concertId, memberName, res.name || cand.name);
    setSubPanel(null);
    router.refresh();
  }
  async function makeSubLink(concertId: string, memberName: string) {
    setSubBusy(true);
    setSubError(null);
    const res = await createSubstituteLinkAction(token, concertId, memberName);
    setSubBusy(false);
    if (!res.ok || !res.path) { setSubError(res.error || "No s'ha pogut crear l'enllaç."); return; }
    const url = `${window.location.origin}${res.path}`;
    setSubLink(url);
    addLocalApplication(concertId, memberName, "", res.path.replace("/s/", ""));
    setSubPanel({ concertId, mode: "link" });
  }
  function subWaText(url: string, c: Concert, memberName: string) {
    return `Hola! ${memberName} no pot venir al bolo de ${band.name} el ${capitalize(formatDateFull(c.date))}${c.city ? " a " + c.city.split(",")[0] : ""} i t'ha proposat com a suplent. Presenta-t'hi aquí: ${url}`;
  }

  const sel = members.find((m) => m.name === selected) || null;
  const c1 = band.color1 || "#8b7bff";
  const c2 = band.color2 || "#5f4bcc";
  const one = single ? concerts[0] || null : null;
  // On tornar després d'entrar o crear el compte: aquí mateix, amb la
  // persona ja triada.
  const backHere = `/conf/${token}${selected ? `?sel=${encodeURIComponent(selected)}` : ""}`;

  function gateFor(m: ConfMember): Gate {
    if (!viewer.loggedIn) return m.hasAccount ? "signin" : "signup";
    if (viewer.linkedMemberName && normalize(viewer.linkedMemberName) !== normalize(m.name)) return "wrong-account";
    if (m.linked && !m.isMe) return "wrong-account";
    if (viewer.role === "manager" && !m.isMe) return "manager";
    return "table";
  }
  const gate = sel ? gateFor(sel) : null;

  async function respond(concertId: string, answer: "yes" | "no") {
    if (!sel || busy) return;
    const name = sel.name;
    const prev = answers[concertId]?.[name];
    setBusy(concertId);
    setError(null);
    setAnswers((a) => ({ ...a, [concertId]: { ...(a[concertId] || {}), [name]: answer } }));
    const res = await respondConfAction(token, concertId, name, answer);
    setBusy(null);
    if (!res.ok) {
      setError(res.error || "No s'ha pogut desar");
      setAnswers((a) => {
        const row = { ...(a[concertId] || {}) };
        if (prev) row[name] = prev; else delete row[name];
        return { ...a, [concertId]: row };
      });
      return;
    }
    router.refresh();
  }

  // Insígnia de cada membre a la llista "Qui ets?": la resposta (un sol
  // concert) o quants concerts ha respost (més d'un).
  function memberBadge(m: ConfMember): { label: string; cls: string } {
    let yes = 0, no = 0;
    concerts.forEach((c) => { const a = answers[c.id]?.[m.name]; if (a === "yes") yes++; else if (a === "no") no++; });
    if (concerts.length <= 1) {
      return yes ? { label: "Hi serà ✓", cls: "yes" } : no ? { label: "No hi serà", cls: "no" } : { label: "Pendent", cls: "pending" };
    }
    const answered = yes + no;
    if (!answered) return { label: "Pendent", cls: "pending" };
    if (answered >= concerts.length) return { label: "Tot respost ✓", cls: "yes" };
    return { label: `${answered}/${concerts.length} respostos`, cls: "pending" };
  }

  // Bloc de suplent d'una fila on s'ha dit que no: què hi ha (suplent
  // confirmat pel gestor, proposats pendents, enllaç) i el botó per
  // proposar-ne un — buscant-lo per compte o generant-li un enllaç.
  function renderSubBlock(c: Concert, memberName: string) {
    const confirmedSub = (c.substitutes || {})[memberName];
    const info = subsLocal[c.id]?.[normalize(memberName)];
    const apps = info?.applications || [];
    const panelHere = subPanel?.concertId === c.id ? subPanel : null;
    const linkUrl = info?.token ? `${window.location.origin}/s/${info.token}` : null;
    return (
      <div className="cfm-sub">
        {confirmedSub && <div className="cfm-sub-line yes">✓ Suplent confirmat pel gestor: <strong>{confirmedSub}</strong></div>}
        {apps.map((ap, i) => (
          <div key={i} className="cfm-sub-line">
            Proposat: <strong>{ap.name}</strong>
            <span className={"cfm-badge " + (ap.status === "acceptada" ? "yes" : ap.status === "rebutjada" ? "no" : "pending")}>
              {ap.status === "pendent" ? "pendent del gestor" : ap.status}
            </span>
          </div>
        ))}
        {linkUrl && !panelHere && (
          <div className="cfm-sub-line">
            Enllaç per al suplent:
            <button type="button" className="link-btn" onClick={() => { navigator.clipboard.writeText(linkUrl); setSubCopied(true); window.setTimeout(() => setSubCopied(false), 1500); }}>{subCopied ? "copiat ✓" : "copia"}</button>
            ·
            <button type="button" className="link-btn" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(subWaText(linkUrl, c, memberName))}`, "_blank")}>WhatsApp</button>
          </div>
        )}
        {!confirmedSub && !panelHere && (
          <button type="button" className="cfm-sub-btn" onClick={() => openSubPanel(c.id, "menu")}>Proposa un suplent</button>
        )}
        {panelHere && (
          <div className="cfm-sub-panel">
            {panelHere.mode === "menu" && (
              <>
                <div className="cfm-note">El suplent té compte a Escenari?</div>
                <div className="cfm-gate-btns">
                  <button type="button" className="btn-outline" onClick={() => openSubPanel(c.id, "search")}>Sí — busca&apos;l</button>
                  <button type="button" className="btn-outline" disabled={subBusy} onClick={() => makeSubLink(c.id, memberName)}>{subBusy ? "Un moment…" : "No — genera-li un enllaç"}</button>
                  <button type="button" className="link-btn" onClick={() => setSubPanel(null)}>Cancel·la</button>
                </div>
              </>
            )}
            {panelHere.mode === "search" && (
              <>
                <input className="field-input" type="text" placeholder="Nom del suplent…" value={subQ} onChange={(e) => setSubQ(e.target.value)} autoFocus />
                <div className="cfm-sub-results">
                  {subResults.map((r) => (
                    <button key={r.clerkUserId} type="button" className="cfm-sub-result" disabled={subBusy} onClick={() => proposeCandidate(c.id, memberName, r)}>
                      <span>{r.name}</span>
                      <span className="t-dim">{r.instruments.slice(0, 2).join(", ")}</span>
                    </button>
                  ))}
                  {subQ.trim().length >= 2 && !subSearching && subResults.length === 0 && (
                    <div className="t-dim" style={{ fontSize: 12.5 }}>
                      Cap compte amb aquest nom — <button type="button" className="link-btn" disabled={subBusy} onClick={() => makeSubLink(c.id, memberName)}>genera-li un enllaç</button>
                    </div>
                  )}
                  {subSearching && <div className="t-dim" style={{ fontSize: 12.5 }}>Cercant…</div>}
                </div>
                <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setSubPanel(null)}>Cancel·la</button>
              </>
            )}
            {panelHere.mode === "link" && subLink && (
              <>
                <div className="cfm-note">Envia-li aquest enllaç: s&apos;hi crearà el compte i es presentarà com a suplent; el gestor ho confirmarà.</div>
                <div className="cfm-sub-linkbox">{subLink}</div>
                <div className="cfm-gate-btns">
                  <button type="button" className="btn-outline" onClick={() => { navigator.clipboard.writeText(subLink); setSubCopied(true); window.setTimeout(() => setSubCopied(false), 1500); }}>{subCopied ? "Copiat ✓" : "Copia l'enllaç"}</button>
                  <button type="button" className="btn-outline" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(subWaText(subLink, c, memberName))}`, "_blank")}>WhatsApp</button>
                  <button type="button" className="link-btn" onClick={() => setSubPanel(null)}>Fet</button>
                </div>
              </>
            )}
            {subError && <div className="cfm-error">{subError}</div>}
          </div>
        )}
      </div>
    );
  }

  const place = one ? [one.venue, one.address].filter(Boolean).join(" · ") : "";
  const mapsQuery = one ? encodeURIComponent([one.venue, one.address, one.city].filter(Boolean).join(", ")) : "";
  const firstName = sel ? sel.name.split(" ")[0] : "";

  return (
    <div className="cfm-page" style={{ ["--c1" as string]: c1, ["--c2" as string]: c2, ["--band-accent" as string]: c1 }}>
      <div className="cfm-card">
        {one ? (
          <div className="cd-poster">
            <div className="cd-poster-glow" aria-hidden="true"></div>
            {band.logo && <img className="cfm-poster-logo" style={logoBox(band.logoAspect, 44)} src={band.logo} alt="" />}
            <div className="cd-poster-kicker">{band.name}</div>
            <div className="cd-poster-subtitle">
              {one.festaEntitat || (one.kind === "bolo" ? "concert" : one.kind === "reunio" ? "reunió" : one.kind)}
            </div>
            {one.city && <div className="cd-poster-title">{one.city.split(",")[0]}</div>}
            {place && (
              <a
                className="cd-poster-place" href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                target="_blank" rel="noreferrer" title="Obre la ubicació a Google Maps"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                {place}
              </a>
            )}
            <div className="cd-poster-date">{capitalize(formatDateFull(one.date))}{one.time ? ` — ${formatConcertTime(one.time)}` : ""}</div>
          </div>
        ) : (
          <div className="cfm-band-head">
            {band.logo && <img style={logoBox(band.logoAspect, 64)} src={band.logo} alt="" />}
            <div className="cfm-band-kicker">{band.name}</div>
            <div className="cfm-band-title">Propers concerts</div>
            <div className="cfm-band-sub">
              {concerts.length === 0 ? "Cap concert proper" : `${concerts.length} ${concerts.length === 1 ? "concert" : "concerts"}`}
              {allFuture ? " · tots els propers del grup" : ""}
            </div>
          </div>
        )}

        {one && (
          <div className="dia" style={{ padding: 0, margin: 0, maxWidth: "none" }}>
            <DiaBody concert={one} band={diaBand} linkedNames={linkedNames} />
          </div>
        )}

        {!sel ? (
          <>
            <div className="cfm-question">Qui ets? Marca&apos;t per confirmar la teva assistència.</div>
            <div className="cfm-members">
              {members.map((m) => {
                const badge = memberBadge(m);
                return (
                  <button
                    key={m.name} type="button"
                    className={"cfm-member" + (m.isMe ? " me" : "")}
                    onClick={() => { setSelected(m.name); setError(null); }}
                  >
                    <img src={m.photoId ? `/api/file/${m.photoId}` : personPhotoDataUri(m.name)} alt="" />
                    <span className="cfm-member-main">
                      <span className="cfm-member-name">{m.name}{m.isMe ? " (tu)" : ""}{m.linked && <VerifiedTick size={12} />}</span>
                      {m.instruments.length > 0 && <span className="cfm-member-ins">{m.instruments.slice(0, 2).join(", ")}</span>}
                    </span>
                    <span className={"cfm-badge " + badge.cls}>{badge.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="cfm-identity">
              <img src={sel.photoId ? `/api/file/${sel.photoId}` : personPhotoDataUri(sel.name)} alt="" />
              <div className="cfm-identity-main">
                <div className="cfm-identity-name">{sel.name}{sel.isMe ? " (tu)" : ""}{sel.linked && <VerifiedTick size={12} />}</div>
                {sel.instruments.length > 0 && <div className="cfm-identity-sub">{sel.instruments.slice(0, 2).join(", ")}</div>}
              </div>
              {!sel.isMe && (
                <button type="button" className="link-btn" onClick={() => { setSelected(""); setError(null); }}>No ets tu? Canvia</button>
              )}
            </div>

            {gate === "signin" && (
              <div className="cfm-panel">
                <div className="cfm-note">
                  <strong>{firstName}</strong>, ja tens un compte d&apos;Escenari. Entra-hi per confirmar la teva assistència —
                  així la resposta queda lligada a tu i la veuràs també a la teva agenda.
                </div>
                <div className="cfm-gate-btns">
                  <Link className="btn-primary" href={`/sign-in?redirect_url=${encodeURIComponent(backHere)}`}>Inicia sessió</Link>
                </div>
              </div>
            )}

            {gate === "signup" && (
              <div className="cfm-panel">
                <div className="cfm-note">
                  Per confirmar cal un compte d&apos;Escenari — te&apos;l crees en un moment (només correu i contrasenya) i
                  quedaràs vinculat/da a <strong>{band.name}</strong> com a <strong>{sel.name}</strong>. A partir d&apos;aquí
                  podràs confirmar cada bolo des de la teva agenda.
                </div>
                <div className="cfm-gate-btns">
                  <Link className="btn-primary" href={`/sign-up?redirect_url=${encodeURIComponent(backHere)}`}>Crea un compte</Link>
                  <Link className="btn-outline" href={`/sign-in?redirect_url=${encodeURIComponent(backHere)}`}>Ja tinc compte</Link>
                </div>
              </div>
            )}

            {gate === "wrong-account" && (
              <div className="cfm-panel">
                <div className="cfm-note">
                  {viewer.linkedMemberName
                    ? <>El compte amb què has entrat està vinculat a <strong>{viewer.linkedMemberName}</strong> en aquest grup — no pot respondre per {sel.name}.</>
                    : <><strong>{sel.name}</strong> ja té el compte vinculat — només pot confirmar la mateixa persona, amb el seu compte.</>}
                </div>
                <div className="cfm-gate-btns">
                  <SignOutButton redirectUrl={backHere}>
                    <button type="button" className="btn-outline">Tanca sessió i entra amb un altre compte</button>
                  </SignOutButton>
                  <button type="button" className="link-btn" onClick={() => { setSelected(""); setError(null); }}>Tria una altra persona</button>
                </div>
              </div>
            )}

            {gate === "manager" && (
              <div className="cfm-panel">
                <div className="cfm-note">
                  Estàs amb el compte de <strong>gestor</strong> — aquest enllaç és perquè cada músic respongui amb el seu compte.
                  Marca l&apos;assistència des de la fitxa del concert a Escenari.
                </div>
              </div>
            )}

            {gate === "table" && (
              <div className="cfm-table">
                <div className="cfm-table-head">
                  <span>{concerts.length === 1 ? "Hi seràs?" : `${concerts.length} concerts — marca si hi seràs a cadascun`}</span>
                  {allFuture && <span>tots els propers del grup</span>}
                </div>
                {concerts.length === 0 && <div className="cfm-note">Ara mateix no hi ha cap concert proper per confirmar.</div>}
                {concerts.map((c) => {
                  const a = answers[c.id]?.[sel.name] || "";
                  const sub = [c.festaEntitat, c.venue, c.city ? c.city.split(",")[0] : ""].filter(Boolean).join(" · ");
                  return (
                    <div key={c.id} className={"cfm-row" + (a ? " " + a : "")}>
                      <div className="cfm-row-main">
                        <div className="cfm-row-date">
                          {single ? capitalize(formatDateFull(c.date)) : capitalize(rowDate(c.date))}
                          {c.time ? ` · ${formatConcertTime(c.time)}` : ""}
                        </div>
                        {sub && <div className="cfm-row-sub">{sub}</div>}
                      </div>
                      <div className="cfm-row-btns">
                        <button type="button" className={"cfm-row-btn yes" + (a === "yes" ? " active" : "")} disabled={busy === c.id} onClick={() => respond(c.id, "yes")}>✓ Hi seré</button>
                        <button type="button" className={"cfm-row-btn no" + (a === "no" ? " active" : "")} disabled={busy === c.id} onClick={() => respond(c.id, "no")}>✗ No hi seré</button>
                      </div>
                      {a === "no" && renderSubBlock(c, sel.name)}
                      {!single && (
                        <button type="button" className="cfm-row-expand" onClick={() => setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded[c.id] ? "rotate(180deg)" : "none" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                          {expanded[c.id] ? "Amaga els detalls" : "Detalls del dia"}
                        </button>
                      )}
                      {!single && expanded[c.id] && (
                        <div className="cfm-row-details dia">
                          <DiaBody concert={c} band={diaBand} linkedNames={linkedNames} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {error && <div className="cfm-error">{error}</div>}
              </div>
            )}
          </>
        )}

        <div className="cfm-footer">
          <img className="brand-mark" src="/logo-mark.png" alt="" />
          <span className="brand-name">ESCENARI</span>
        </div>
      </div>
    </div>
  );
}
