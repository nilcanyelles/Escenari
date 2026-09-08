"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { respondConfAction } from "@/app/conf/actions";
import { personPhotoDataUri } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { formatDateFull, capitalize, formatConcertTime, WEEKDAY_FULL, MONTH_ABBR } from "@/lib/format";
import type { Concert, Band } from "@/lib/types";
import DiaBody from "@/components/DiaBody";

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

export default function ConfirmView({ token, single, allFuture, band, concerts, diaBand, members, viewer, preselect }: {
  token: string;
  // Enllaç d'un sol concert (els de sempre): es mostra el pòster i els
  // detalls del dia a dalt de tot, com fins ara.
  single: boolean;
  allFuture: boolean;
  band: { name: string; logo: string; color1: string; color2: string };
  concerts: Concert[];
  diaBand: Band | null;
  members: ConfMember[];
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

  const place = one ? [one.venue, one.address].filter(Boolean).join(" · ") : "";
  const mapsQuery = one ? encodeURIComponent([one.venue, one.address, one.city].filter(Boolean).join(", ")) : "";
  const firstName = sel ? sel.name.split(" ")[0] : "";

  return (
    <div className="cfm-page" style={{ ["--c1" as string]: c1, ["--c2" as string]: c2, ["--band-accent" as string]: c1 }}>
      <div className="cfm-card">
        {one ? (
          <div className="cd-poster">
            <div className="cd-poster-glow" aria-hidden="true"></div>
            {band.logo && <img className="cfm-poster-logo" src={band.logo} alt="" />}
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
            {band.logo && <img src={band.logo} alt="" />}
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
            <DiaBody concert={one} band={diaBand} />
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
                      <span className="cfm-member-name">{m.name}{m.isMe ? " (tu)" : ""}</span>
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
                <div className="cfm-identity-name">{sel.name}{sel.isMe ? " (tu)" : ""}</div>
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
                      {!single && (
                        <button type="button" className="cfm-row-expand" onClick={() => setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded[c.id] ? "rotate(180deg)" : "none" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                          {expanded[c.id] ? "Amaga els detalls" : "Detalls del dia"}
                        </button>
                      )}
                      {!single && expanded[c.id] && (
                        <div className="cfm-row-details dia">
                          <DiaBody concert={c} band={diaBand} />
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
