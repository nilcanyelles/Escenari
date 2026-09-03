"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondConfAction } from "@/app/conf/actions";
import { personPhotoDataUri } from "@/lib/tags";
import { formatDateFull, capitalize, formatConcertTimePhrase } from "@/lib/format";

const KIND_LABELS: Record<string, string> = { bolo: "Bolo", assaig: "Assaig", reunio: "Reunió", altre: "Esdeveniment" };

type ConfMember = {
  name: string;
  instruments: string[];
  photoId: string;
  linked: boolean;
  isMe: boolean;
  answer: "yes" | "no" | "";
};

export default function ConfirmView({ token, event, members, signedIn, viewerIsManager = false, preselect }: {
  token: string;
  event: { date: string; time: string; exactTime: string; city: string; venue: string; address: string; festaEntitat: string; kind: string; bandName: string; logo: string; color1: string; color2: string };
  members: ConfMember[];
  signedIn: boolean;
  viewerIsManager?: boolean;
  preselect: string;
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
  const returnUrl = (name: string) => `/conf/${token}?sel=${encodeURIComponent(name)}`;

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

  const place = [event.venue, event.address, event.city ? event.city.split(",")[0] : ""].filter(Boolean).join(" · ");
  const timeLabel = event.exactTime ? `${event.exactTime}h` : formatConcertTimePhrase(event.time);

  return (
    <div className="cfm-page" style={{ ["--c1" as string]: c1, ["--c2" as string]: c2 }}>
      <div className="cfm-card">
        <div className="cfm-hero">
          {event.logo && <img className="cfm-logo" src={event.logo} alt="" />}
          <div className="cfm-kind">{KIND_LABELS[event.kind] || "Esdeveniment"}{event.festaEntitat ? ` · ${event.festaEntitat}` : ""}</div>
          <div className="cfm-band">{event.bandName}</div>
          <div className="cfm-when">{capitalize(formatDateFull(event.date))}{timeLabel ? ` — ${timeLabel}` : ""}</div>
          {place && <div className="cfm-place">📍 {place}</div>}
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
            ) : sel.linked && !sel.isMe && !signedIn ? (
              <>
                <div className="cfm-note">{sel.name} ja té compte d&apos;Escenari. Inicia-hi sessió per confirmar.</div>
                <a className="btn-save cfm-cta" href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl(sel.name))}`}>Inicia sessió</a>
              </>
            ) : sel.linked && !sel.isMe && signedIn ? (
              <div className="cfm-note">Aquest perfil està vinculat a un altre compte — només {sel.name} pot respondre-hi.</div>
            ) : !signedIn ? (
              <>
                <div className="cfm-note">
                  Per confirmar com a <strong>{sel.name}</strong>, crea el teu compte d&apos;Escenari (30 segons).
                  Quedarà vinculat a aquest grup i podràs confirmar tots els bolos des de la teva pàgina.
                </div>
                <div className="cfm-cta-row">
                  <a className="btn-save cfm-cta" href={`/sign-up?redirect_url=${encodeURIComponent(returnUrl(sel.name))}`}>Crea el compte</a>
                  <a className="btn-outline cfm-cta" href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl(sel.name))}`}>Ja en tinc un</a>
                </div>
              </>
            ) : (
              <>
                {!sel.linked && !sel.isMe && (
                  <div className="cfm-note">En respondre, el teu compte quedarà vinculat com a <strong>{sel.name}</strong> en aquest grup.</div>
                )}
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

        <div className="cfm-footer">escenari.app</div>
      </div>
    </div>
  );
}
