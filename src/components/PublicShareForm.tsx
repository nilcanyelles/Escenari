"use client";

import { useMemo, useState } from "react";
import type { RouteSheet } from "@/lib/route-sheet";
import { RS_SECTION_ICONS } from "@/lib/route-sheet";
import { formatDateFull, capitalize } from "@/lib/format";
import { submitShareFormAction, type ShareInfoPayload } from "@/app/f/actions";

type ConcertLite = {
  id: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  festaEntitat: string;
  bandName: string;
};

function SectionIcon({ title }: { title: string }) {
  const path = RS_SECTION_ICONS[title];
  if (!path) return null;
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: path }} />
  );
}

export default function PublicShareForm({ token, scope, recipientName, alreadySubmitted, concert, routeSheet }: {
  token: string;
  scope: "info" | "ruta" | "both";
  recipientName: string;
  alreadySubmitted: boolean;
  concert: ConcertLite;
  routeSheet: RouteSheet;
}) {
  const [info, setInfo] = useState<ShareInfoPayload>({
    date: concert.date, time: concert.time, city: concert.city,
    venue: concert.venue, festaEntitat: concert.festaEntitat,
  });
  const [rs, setRs] = useState<RouteSheet>(routeSheet);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showInfo = scope === "info" || scope === "both";
  const showRuta = scope === "ruta" || scope === "both";

  // Progrés del formulari (què queda per omplir).
  const progress = useMemo(() => {
    let total = 0, filled = 0;
    const check = (v: unknown) => { total++; if (v && String(v).trim()) filled++; };
    if (showInfo) { check(info.date); check(info.time); check(info.city); check(info.venue); check(info.festaEntitat); }
    if (showRuta) {
      rs.lloc.forEach((it) => check(it.value));
      rs.contacts.forEach((it) => { check(it.name); check(it.phone); });
      rs.schedule.forEach((it) => { check(it.start); check(it.end); });
      rs.hospitalitat.forEach((it) => check(it.value));
      rs.tecnic.forEach((it) => { if (it.label.toLowerCase() !== "pantalla led") check(it.value); });
    }
    return total ? Math.round((filled / total) * 100) : 0;
  }, [info, rs, showInfo, showRuta]);

  function updateRsValue(section: "lloc" | "hospitalitat" | "tecnic", index: number, value: string) {
    setRs((prev) => {
      const items = prev[section].map((it, i) => (i === index ? { ...it, value } : it));
      return { ...prev, [section]: items };
    });
  }

  async function handleSubmit() {
    setSending(true);
    setError(null);
    const res = await submitShareFormAction(token, {
      info: showInfo ? info : undefined,
      routeSheet: showRuta ? rs : undefined,
    });
    if (res.ok) setSent(true);
    else setError(res.error || "No s'ha pogut desar.");
    setSending(false);
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
                <div className="pf-card-head">
                  <span className="pf-card-icon"><SectionIcon title="Lloc" /></span>
                  <div>
                    <div className="pf-card-title">Informació del concert</div>
                    <div className="pf-card-sub">Quan i on serà l&apos;actuació</div>
                  </div>
                </div>
                <div className="pf-grid">
                  <label className="pf-field">
                    <span>Data</span>
                    <input type="date" value={info.date} onChange={(e) => setInfo({ ...info, date: e.target.value })} />
                  </label>
                  <label className="pf-field">
                    <span>Hora del concert</span>
                    <input type="time" value={info.time} onChange={(e) => setInfo({ ...info, time: e.target.value })} />
                  </label>
                  <label className="pf-field">
                    <span>Població</span>
                    <input value={info.city} placeholder="Reus" onChange={(e) => setInfo({ ...info, city: e.target.value })} />
                  </label>
                  <label className="pf-field">
                    <span>Ubicació / recinte</span>
                    <input value={info.venue} placeholder="Plaça Major" onChange={(e) => setInfo({ ...info, venue: e.target.value })} />
                  </label>
                  <label className="pf-field pf-field-wide">
                    <span>Festa / entitat organitzadora</span>
                    <input value={info.festaEntitat} placeholder="Festa Major de Sant Pere" onChange={(e) => setInfo({ ...info, festaEntitat: e.target.value })} />
                  </label>
                </div>
              </div>
            )}

            {showRuta && (
              <>
                <div className="pf-card">
                  <div className="pf-card-head">
                    <span className="pf-card-icon"><SectionIcon title="Lloc" /></span>
                    <div>
                      <div className="pf-card-title">El lloc</div>
                      <div className="pf-card-sub">Accés, descàrrega i aparcament</div>
                    </div>
                  </div>
                  <div className="pf-grid">
                    {rs.lloc.map((it, i) => (
                      <label key={i} className="pf-field">
                        <span>{it.label}</span>
                        <input value={it.value} onChange={(e) => updateRsValue("lloc", i, e.target.value)} />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pf-card">
                  <div className="pf-card-head">
                    <span className="pf-card-icon"><SectionIcon title="Contactes" /></span>
                    <div>
                      <div className="pf-card-title">Contactes</div>
                      <div className="pf-card-sub">Amb qui parlem el dia del bolo</div>
                    </div>
                  </div>
                  {rs.contacts.map((ct, i) => (
                    <div key={i} className="pf-grid pf-contact-row">
                      <label className="pf-field"><span>Nom</span>
                        <input value={ct.name} onChange={(e) => setRs((p) => ({ ...p, contacts: p.contacts.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))} />
                      </label>
                      <label className="pf-field"><span>Càrrec</span>
                        <input value={ct.role} placeholder="Tècnic de so, regidor…" onChange={(e) => setRs((p) => ({ ...p, contacts: p.contacts.map((x, j) => j === i ? { ...x, role: e.target.value } : x) }))} />
                      </label>
                      <label className="pf-field"><span>Telèfon</span>
                        <input value={ct.phone} onChange={(e) => setRs((p) => ({ ...p, contacts: p.contacts.map((x, j) => j === i ? { ...x, phone: e.target.value } : x) }))} />
                      </label>
                      <label className="pf-field"><span>Entitat</span>
                        <input value={ct.company} onChange={(e) => setRs((p) => ({ ...p, contacts: p.contacts.map((x, j) => j === i ? { ...x, company: e.target.value } : x) }))} />
                      </label>
                    </div>
                  ))}
                  <button type="button" className="pf-btn-secondary" onClick={() => setRs((p) => ({ ...p, contacts: p.contacts.concat([{ role: "", name: "", phone: "", company: "" }]) }))}>
                    + Afegeix un contacte
                  </button>
                </div>

                <div className="pf-card">
                  <div className="pf-card-head">
                    <span className="pf-card-icon"><SectionIcon title="Horaris" /></span>
                    <div>
                      <div className="pf-card-title">Horaris</div>
                      <div className="pf-card-sub">Arribada, muntatge, proves i concert</div>
                    </div>
                  </div>
                  <div className="pf-schedule">
                    {rs.schedule.map((ph, i) => (
                      <div key={i} className="pf-schedule-row">
                        <span className="pf-schedule-phase">{ph.phase}</span>
                        <input type="time" value={ph.start} onChange={(e) => setRs((p) => ({ ...p, schedule: p.schedule.map((x, j) => j === i ? { ...x, start: e.target.value } : x) }))} />
                        <span className="pf-schedule-sep">→</span>
                        <input type="time" value={ph.end} onChange={(e) => setRs((p) => ({ ...p, schedule: p.schedule.map((x, j) => j === i ? { ...x, end: e.target.value } : x) }))} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pf-card">
                  <div className="pf-card-head">
                    <span className="pf-card-icon"><SectionIcon title="Hospitalitat" /></span>
                    <div>
                      <div className="pf-card-title">Hospitalitat</div>
                      <div className="pf-card-sub">Dietes, catering, camerino i allotjament</div>
                    </div>
                  </div>
                  <div className="pf-grid">
                    {rs.hospitalitat.map((it, i) => (
                      <label key={i} className="pf-field">
                        <span>{it.label}</span>
                        <input value={it.value} onChange={(e) => updateRsValue("hospitalitat", i, e.target.value)} />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pf-card">
                  <div className="pf-card-head">
                    <span className="pf-card-icon"><SectionIcon title="Detalls tècnics" /></span>
                    <div>
                      <div className="pf-card-title">Detalls tècnics</div>
                      <div className="pf-card-sub">Escenari, so i necessitats tècniques</div>
                    </div>
                  </div>
                  <div className="pf-grid">
                    {rs.tecnic.map((it, i) => (
                      <label key={i} className="pf-field">
                        <span>{it.label}</span>
                        <input value={it.value} onChange={(e) => updateRsValue("tecnic", i, e.target.value)} />
                      </label>
                    ))}
                  </div>
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
