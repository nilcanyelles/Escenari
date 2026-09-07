"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondConfAction } from "@/app/conf/actions";
import { personPhotoDataUri } from "@/lib/tags";
import { formatDateFull, capitalize, formatConcertTime } from "@/lib/format";
import type { Concert, Band } from "@/lib/types";
import DiaBody from "@/components/DiaBody";

type ConfMember = {
  name: string;
  instruments: string[];
  photoId: string;
  linked: boolean;
  isMe: boolean;
  answer: "yes" | "no" | "";
};

export default function ConfirmView({ token, event, members, viewerIsManager = false, preselect, diaConcert, diaBand }: {
  token: string;
  event: { date: string; time: string; exactTime: string; city: string; venue: string; address: string; festaEntitat: string; kind: string; bandName: string; logo: string; color1: string; color2: string };
  members: ConfMember[];
  viewerIsManager?: boolean;
  preselect: string;
  // Vista del dia de bolo (horaris, contactes, qui ve, allotjament) — es
  // mostra a sota del pòster, perquè en compartir l'enllaç per WhatsApp
  // qui el rep vegi tots els detalls del dia, no només el formulari
  // d'assistència.
  diaConcert: Concert;
  diaBand: Band | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(() =>
    members.some((m) => m.name === preselect) ? preselect : members.find((m) => m.isMe)?.name || ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"yes" | "no" | null>(null);

  const sel = members.find((m) => m.name === selected) || null;
  const c1 = event.color1 || "#8b7bff";
  const c2 = event.color2 || "#5f4bcc";

  async function respond(answer: "yes" | "no") {
    if (!sel) return;
    setBusy(true);
    setError(null);
    const res = await respondConfAction(token, sel.name, answer);
    setBusy(false);
    if (!res.ok) { setError(res.error || "No s'ha pogut desar"); return; }
    setDone(answer);
    router.refresh();
  }

  const place = [event.venue, event.address].filter(Boolean).join(" · ");
  const mapsQuery = encodeURIComponent([event.venue, event.address, event.city].filter(Boolean).join(", "));

  return (
    <div className="cfm-page" style={{ ["--c1" as string]: c1, ["--c2" as string]: c2, ["--band-accent" as string]: c1 }}>
      <div className="cfm-card">
        <div className="cd-poster">
          <div className="cd-poster-glow" aria-hidden="true"></div>
          {event.logo && <img className="cfm-poster-logo" src={event.logo} alt="" />}
          <div className="cd-poster-kicker">{event.bandName}</div>
          <div className="cd-poster-subtitle">
            {event.festaEntitat || (event.kind === "bolo" ? "concert" : event.kind === "reunio" ? "reunió" : event.kind)}
          </div>
          {event.city && <div className="cd-poster-title">{event.city.split(",")[0]}</div>}
          {place && (
            <a
              className="cd-poster-place" href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank" rel="noreferrer" title="Obre la ubicació a Google Maps"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              {place}
            </a>
          )}
          <div className="cd-poster-date">{capitalize(formatDateFull(event.date))}{event.time ? ` — ${formatConcertTime(event.time)}` : ""}</div>
        </div>

        <div className="dia" style={{ padding: 0, margin: 0, maxWidth: "none" }}>
          <DiaBody concert={diaConcert} band={diaBand} />
        </div>

        <div className="cfm-question">Qui ets? Marca&apos;t i confirma si hi seràs.</div>

        <div className="cfm-members">
          {members.map((m) => (
            <button
              key={m.name} type="button"
              className={"cfm-member" + (selected === m.name ? " selected" : "") + (m.isMe ? " me" : "")}
              onClick={() => { setSelected(m.name); setDone(null); setError(null); }}
            >
              <img src={m.photoId ? `/api/file/${m.photoId}` : personPhotoDataUri(m.name)} alt="" />
              <span className="cfm-member-main">
                <span className="cfm-member-name">{m.name}{m.isMe ? " (tu)" : ""}</span>
                {m.instruments.length > 0 && <span className="cfm-member-ins">{m.instruments.slice(0, 2).join(", ")}</span>}
              </span>
              {m.answer === "yes" && <span className="cfm-badge yes">Hi serà ✓</span>}
              {m.answer === "no" && <span className="cfm-badge no">No hi serà</span>}
              {m.answer === "" && <span className="cfm-badge pending">Pendent</span>}
            </button>
          ))}
        </div>

        {sel && (
          <div className="cfm-panel">
            {viewerIsManager ? (
              <div className="cfm-note">
                Estàs amb el compte de <strong>gestor</strong> — aquest enllaç és perquè cada músic respongui amb el seu compte.
                Marca l&apos;assistència des de la fitxa del concert a Escenari.
              </div>
            ) : done ? (
              <div className={"cfm-done " + done}>
                {done === "yes" ? `Gràcies, ${sel.name.split(" ")[0]}! Has confirmat que hi seràs. 🎉` : `Anotat: ${sel.name.split(" ")[0]} no hi serà.`}
              </div>
            ) : (
              <>
                {sel.answer && (
                  <div className="cfm-note">
                    {sel.answer === "yes" ? "Ja constes com a confirmat — pots canviar-ho." : "Ja constes com a no assistent — pots canviar-ho."}
                  </div>
                )}
                <div className="cfm-cta-row">
                  <button type="button" className="cfm-answer yes" disabled={busy} onClick={() => respond("yes")}>✓ Hi seré</button>
                  <button type="button" className="cfm-answer no" disabled={busy} onClick={() => respond("no")}>✗ No hi seré</button>
                </div>
              </>
            )}
            {error && <div className="cfm-error">{error}</div>}
          </div>
        )}

        <div className="cfm-footer">
          <img className="brand-mark" src="/logo-mark.png" alt="" />
          <span className="brand-name">ESCENARI</span>
        </div>
      </div>
    </div>
  );
}
