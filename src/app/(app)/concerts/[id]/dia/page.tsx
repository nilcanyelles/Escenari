import Link from "next/link";
import { notFound } from "next/navigation";
import { getBands, getConcerts } from "@/lib/data";
import { requireManager } from "@/lib/current-user";
import { normalizeRouteSheet, type RouteSheet, formatPhoneDisplay, rsFormatDuration } from "@/lib/route-sheet";
import { formatCurrency, formatDateFull, capitalize } from "@/lib/format";

export const dynamic = "force-dynamic";

// Vista "dia de bolo": tot el que cal a la furgoneta, en una sola pantalla de
// mòbil — horaris, adreça amb mapa, telèfons per trucar, caixet i formació.
export default async function DiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await requireManager();
  const [bands, concerts] = await Promise.all([getBands(workspaceId), getConcerts(workspaceId)]);
  const c = concerts.find((x) => x.id === id);
  if (!c) notFound();
  const band = bands.find((b) => b.id === c.bandId);
  const rs = normalizeRouteSheet(c.routeSheet as RouteSheet | null, c);

  const address = rs.lloc.find((l) => l.label.toLowerCase() === "adreça")?.value || "";
  const mapsQuery = encodeURIComponent([c.venue, address, c.city].filter(Boolean).join(", "));
  const going = (band?.members || []).map((m) => {
    const att = (c.attendance || {})[m.name];
    const sub = (c.substitutes || {})[m.name];
    return { name: m.name, att, sub };
  });

  return (
    <div className="dia">
      <div className="dia-top">
        <Link href={`/concerts/${id}`} className="cd-back">← Concert</Link>
        <span className="t-dim" style={{ fontSize: 12 }}>{c.bandName}</span>
      </div>

      <div className="dia-hero">
        <div className="dia-date">{capitalize(formatDateFull(c.date))}</div>
        <div className="dia-place">{c.venue || "Ubicació per determinar"}{c.city ? ` · ${c.city.split(",")[0]}` : ""}</div>
        {c.festaEntitat && <div className="t-dim" style={{ fontSize: 13 }}>{c.festaEntitat}</div>}
        <div className="dia-fee">{formatCurrency(c.amount)}</div>
      </div>

      <a className="dia-maps" href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer">
        🗺 Obre al mapa{address ? ` — ${address}` : ""}
      </a>

      {/* Horaris */}
      <div className="dia-card">
        <div className="dia-card-title">Horaris</div>
        {rs.schedule.filter((p) => p.start).length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Sense horaris al full de ruta{c.time ? ` — concert a les ${c.time}h` : ""}.</div>
        ) : (
          rs.schedule.filter((p) => p.start).map((p, i) => (
            <div key={i} className="dia-sched-row">
              <span className="dia-sched-time">{p.start}{p.end ? `–${p.end}` : ""}</span>
              <span>{p.phase}</span>
              <span className="t-dim" style={{ marginLeft: "auto", fontSize: 11.5 }}>{rsFormatDuration(p.start, p.end)}</span>
            </div>
          ))
        )}
      </div>

      {/* Contactes */}
      <div className="dia-card">
        <div className="dia-card-title">Contactes</div>
        {rs.contacts.filter((ct) => ct.name.trim()).length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Cap contacte al full de ruta.</div>
        ) : (
          rs.contacts.filter((ct) => ct.name.trim()).map((ct, i) => (
            <div key={i} className="dia-contact-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{ct.name}</div>
                <div className="t-dim" style={{ fontSize: 12 }}>{[ct.role, ct.company].filter(Boolean).join(" · ")}</div>
              </div>
              {ct.phone && <a className="dia-call" href={`tel:${ct.phone.replace(/\s/g, "")}`}>📞 {formatPhoneDisplay(ct.phone)}</a>}
            </div>
          ))
        )}
      </div>

      {/* Formació */}
      <div className="dia-card">
        <div className="dia-card-title">Qui ve</div>
        <div className="dia-members">
          {going.map((g) => (
            <span key={g.name} className={"dia-member" + (g.att === "yes" ? " yes" : g.att === "no" ? " no" : "")}>
              {g.att === "yes" ? "✓ " : g.att === "no" ? "✕ " : "? "}
              {g.att === "no" && g.sub ? `${g.sub} (per ${g.name})` : g.name}
            </span>
          ))}
          {going.length === 0 && <span className="t-dim" style={{ fontSize: 13 }}>Sense formació assignada.</span>}
        </div>
      </div>

      {/* Hospitalitat ràpida */}
      {rs.hospitalitat.some((h) => h.value.trim()) && (
        <div className="dia-card">
          <div className="dia-card-title">Hospitalitat</div>
          {rs.hospitalitat.filter((h) => h.value.trim()).map((h, i) => (
            <div key={i} className="dia-sched-row"><span style={{ fontWeight: 600 }}>{h.label}</span><span className="t-dim">{h.value}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
