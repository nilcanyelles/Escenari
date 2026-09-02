"use client";

import type { Person } from "@/lib/types";
import type { RiderContent, Song } from "@/lib/material-types";
import { songDurationSecs, formatTotalDuration } from "@/lib/material-types";
import { stageKindDef } from "@/lib/stage-svg";
import { instrumentsFor } from "@/lib/tags";

type BandLite = { name: string; logo: string; color1: string; city: string; contact: string; phone: string; members: Person[] };

// Document imprimible (rider o setlist) que veu qualsevol persona amb l'enllaç.
export default function MaterialDoc({ kind, name, band, rider, songs, token }: {
  kind: "rider" | "setlist";
  name: string;
  band: BandLite;
  rider: RiderContent | null;
  songs: Song[];
  // Token públic del rider — només cal quan hi ha annexos penjats (fileUrl),
  // per fusionar-los tal qual via /api/rider-pdf/[token] en comptes del
  // print-to-PDF del navegador (que no pot incorporar-hi un PDF ja fet).
  token?: string;
}) {
  const accent = band.color1 || "#8b7bff";
  const totalSecs = songs.reduce((s, x) => s + songDurationSecs(x.duration), 0);
  const stageAspect = rider ? Math.max(0.8, Math.min(4, rider.stage.widthM / rider.stage.depthM || 1.33)) : 1.33;
  const hasFileAnnexes = !!rider?.pages.some((p) => p.fileUrl);

  return (
    <div className="md-screen">
      <div className="md-toolbar no-print">
        <span className="pf-brand" style={{ margin: 0 }}>ESCENARI</span>
        {hasFileAnnexes && token ? (
          <a className="md-pdf-btn" href={`/api/rider-pdf/${token}?dl=1`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Descarrega en PDF (amb annexos)
          </a>
        ) : (
          <button type="button" className="md-pdf-btn" onClick={() => window.print()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            Descarrega en PDF
          </button>
        )}
      </div>

      <div className="md-doc" style={{ ["--md-accent" as string]: accent }}>
        <div className="md-head">
          {band.logo && <img className="md-logo" src={band.logo} alt="" />}
          <div>
            <div className="md-band">{band.name}</div>
            <h1 className="md-title">{name}</h1>
            <div className="md-meta">
              {band.city ? band.city.split(",")[0] : ""}
              {band.contact ? ` · ${band.contact}` : ""}
              {band.phone ? ` · ${band.phone}` : ""}
            </div>
          </div>
        </div>

        {kind === "rider" && rider && (
          <>
            {rider.intro && <p className="md-intro">{rider.intro}</p>}

            {rider.contacts.some((c) => c.name.trim()) && (
              <section className="md-section">
                <h2>Contactes</h2>
                <table className="md-table">
                  <thead><tr><th>Càrrec</th><th>Nom</th><th>Telèfon</th><th>Correu</th></tr></thead>
                  <tbody>
                    {rider.contacts.filter((c) => c.name.trim()).map((c, i) => (
                      <tr key={i}><td>{c.role}</td><td className="md-song">{c.name}</td><td>{c.phone}</td><td>{c.email}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {band.members.length > 0 && (
              <section className="md-section">
                <h2>Formació</h2>
                <div className="md-members">
                  {band.members.map((m) => (
                    <div key={m.name} className="md-member">
                      <strong>{m.name}</strong>
                      <span>{instrumentsFor(m).join(", ") || m.role}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {rider.stage.items.length > 0 && (
              <section className="md-section">
                <h2>Escenari — {rider.stage.widthM} m × {rider.stage.depthM} m</h2>
                <div className="md-stage" style={{ aspectRatio: String(stageAspect) }}>
                  {rider.stage.items.map((it) => (
                    <div key={it.id} className="md-stage-item" style={{ left: it.x + "%", top: it.y + "%" }}>
                      <span className="md-stage-glyph" style={{ width: 44 * it.scale, height: 44 * it.scale }}>
                        <svg width="100%" height="100%" viewBox="0 0 64 64">{stageKindDef(it.kind).svg}</svg>
                      </span>
                      <span>{it.label}</span>
                    </div>
                  ))}
                  <div className="md-stage-front">PÚBLIC</div>
                </div>
              </section>
            )}

            {rider.inputs.some((i) => i.source.trim()) && (
              <section className="md-section">
                <h2>Llista d&apos;entrades</h2>
                <table className="md-table">
                  <thead><tr><th>Ch</th><th>Font</th><th>Micro / DI</th><th>Peu</th><th>Notes</th></tr></thead>
                  <tbody>
                    {rider.inputs.filter((i) => i.source.trim()).map((i, idx) => (
                      <tr key={idx}><td>{i.ch}</td><td>{i.source}</td><td>{i.mic}</td><td>{i.stand}</td><td>{i.notes}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {rider.outputs.some((o) => o.dest.trim()) && (
              <section className="md-section">
                <h2>Llista de sortides</h2>
                <table className="md-table">
                  <thead><tr><th>Out</th><th>Destí</th><th>Tipus</th><th>Notes</th></tr></thead>
                  <tbody>
                    {rider.outputs.filter((o) => o.dest.trim()).map((o, idx) => (
                      <tr key={idx}><td>{o.ch}</td><td>{o.dest}</td><td>{o.kind}</td><td>{o.notes}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {rider.monitors.length > 0 && (
              <section className="md-section">
                <h2>Monitoratge</h2>
                <table className="md-table">
                  <thead><tr><th>Per a qui</th><th>Tipus</th><th>Mescla / notes</th></tr></thead>
                  <tbody>
                    {rider.monitors.map((m, idx) => (
                      <tr key={idx}><td>{m.who}</td><td>{m.kind}</td><td>{m.notes}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {rider.backline.length > 0 && (
              <section className="md-section">
                <h2>Backline</h2>
                <table className="md-table">
                  <thead><tr><th>Element</th><th>Qui el porta</th><th>Notes</th></tr></thead>
                  <tbody>
                    {rider.backline.map((b, idx) => (
                      <tr key={idx}><td>{b.item}</td><td>{b.providedBy === "grup" ? "El grup" : "Organització"}</td><td>{b.notes}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {(() => {
              const fixedTitles: Record<string, string> = {
                audio: "Àudio", lighting: "Llums", power: "Corrent elèctric", hospitality: "Hospitalitat",
              };
              const fixedValues: Record<string, string> = {
                audio: rider.audio, lighting: rider.lighting, power: rider.power, hospitality: rider.hospitality,
              };
              return rider.detailsOrder.map((key) => {
                if (key.startsWith("cf:")) {
                  const f = rider.customFields.find((x) => "cf:" + x.id === key);
                  if (!f || !f.body || !f.body.trim()) return null;
                  return (
                    <section key={key} className="md-section">
                      <h2>{f.title || "Camp"}</h2>
                      <p className="md-text">{f.body}</p>
                    </section>
                  );
                }
                const v = fixedValues[key];
                if (!v || !v.trim()) return null;
                return (
                  <section key={key} className="md-section">
                    <h2>{fixedTitles[key]}</h2>
                    <p className="md-text">{v}</p>
                  </section>
                );
              });
            })()}

            {rider.notes && rider.notes.trim() && (
              <section className="md-section">
                <h2>Altres notes</h2>
                <p className="md-text">{rider.notes}</p>
              </section>
            )}

            {rider.pages.map((pg, i) => (
              <section key={i} className="md-section md-extra-page">
                <h2>{pg.title}</h2>
                {pg.fileUrl ? (
                  <p className="md-text no-print">
                    📄 Document adjunt ({pg.fileName || "document"}) — surt tal qual, com a pàgines pròpies, al PDF
                    generat amb el botó de dalt.
                  </p>
                ) : (
                  <p className="md-text">{pg.body}</p>
                )}
              </section>
            ))}
          </>
        )}

        {kind === "setlist" && (
          <section className="md-section">
            <div className="md-setlist-summary">
              {songs.filter((s) => s.title.trim()).length} cançons · durada total {formatTotalDuration(totalSecs)}
            </div>
            <table className="md-table md-setlist-table">
              <thead><tr><th>#</th><th>Cançó</th><th>Durada</th><th>To</th><th>Notes</th></tr></thead>
              <tbody>
                {songs.filter((s) => s.title.trim()).map((s, i) => (
                  <tr key={i}><td>{i + 1}</td><td className="md-song">{s.title}</td><td>{s.duration}</td><td>{s.key}</td><td>{s.notes}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className="md-footer">Generat amb Escenari</div>
      </div>
    </div>
  );
}
