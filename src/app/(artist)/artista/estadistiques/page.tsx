import { requireArtist } from "@/lib/current-user";
import { getArtistBandsFull, getArtistConcertsFull } from "@/lib/artist-data";
import { getSelectedBandId } from "@/lib/band-scope";
import { formatCurrency, formatDate, MONTH_ABBR, today } from "@/lib/format";
import { normalize } from "@/lib/text";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Estadístiques del músic: només els diners que li toquen a ell (repartiments
// amb el seu nom) i el seu ritme de bolos.
export default async function ArtistStatsPage() {
  const profile = await requireArtist();
  const [bands, concerts, selectedRaw] = await Promise.all([
    getArtistBandsFull(profile.clerkUserId),
    getArtistConcertsFull(profile.clerkUserId),
    getSelectedBandId(),
  ]);
  const bandId = bands.length === 1 ? bands[0].id : bands.some((b) => b.id === selectedRaw) ? selectedRaw : "";
  const scoped = (bandId ? concerts.filter((c) => c.bandId === bandId) : concerts).filter((c) => c.status !== "cancel·lat");

  const links = (await db().query(
    "select band_id, member_name from band_members where clerk_user_id=$1", [profile.clerkUserId]
  )).rows;
  const nameByBand: Record<string, string> = {};
  links.forEach((l) => { nameByBand[l.band_id] = l.member_name; });

  function myPayout(c: (typeof scoped)[number]): number {
    const myName = nameByBand[c.bandId] || profile.name;
    const key = Object.keys(c.payouts || {}).find((k) => normalize(k) === normalize(myName));
    return key !== undefined ? (c.payouts || {})[key] || 0 : 0;
  }

  const todayStr = today();
  const year = todayStr.slice(0, 4);
  const withMoney = scoped.map((c) => ({ c, mine: myPayout(c) }));
  const yearRows = withMoney.filter(({ c }) => c.date.slice(0, 4) === year);
  const yearTotal = yearRows.reduce((s, r) => s + r.mine, 0);
  const allTotal = withMoney.reduce((s, r) => s + r.mine, 0);
  const pendingUpcoming = withMoney.filter(({ c }) => c.date >= todayStr).reduce((s, r) => s + r.mine, 0);
  const gigsThisYear = yearRows.length;

  // Per mes d'enguany.
  const byMonth: number[] = Array.from({ length: 12 }, () => 0);
  yearRows.forEach(({ c, mine }) => { byMonth[parseInt(c.date.slice(5, 7), 10) - 1] += mine; });
  const maxMonth = Math.max(1, ...byMonth);

  // Per grup.
  const byBand: Record<string, number> = {};
  withMoney.forEach(({ c, mine }) => { byBand[c.bandName] = (byBand[c.bandName] || 0) + mine; });

  const recent = withMoney.filter(({ mine }) => mine > 0).sort((a, b) => b.c.date.localeCompare(a.c.date)).slice(0, 10);

  return (
    <div className="glow" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glow-blooms" aria-hidden="true"></div>

      <div className="kpi-grid kpi-grid-4">
        <div className="card card-centered"><div className="card-title">El meu {year}</div><div className="card-value">{formatCurrency(yearTotal)}</div></div>
        <div className="card card-centered"><div className="card-title">Total acumulat</div><div className="card-value">{formatCurrency(allTotal)}</div></div>
        <div className="card card-centered"><div className="card-title">Pròxims bolos (previst)</div><div className="card-value">{formatCurrency(pendingUpcoming)}</div></div>
        <div className="card card-centered"><div className="card-title">Bolos {year}</div><div className="card-value">{gigsThisYear}</div></div>
      </div>

      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 14 }}>El que et toca per mes ({year})</div>
        <div className="acd-month-bars">
          {byMonth.map((v, i) => (
            <div key={i} className="acd-month-col" title={`${MONTH_ABBR[i]}: ${formatCurrency(v)}`}>
              <div className="acd-month-bar" style={{ height: Math.round((v / maxMonth) * 100) + "%" }}></div>
              <span className="acd-month-label">{MONTH_ABBR[i]}</span>
            </div>
          ))}
        </div>
        <div className="t-dim" style={{ fontSize: 12, marginTop: 10 }}>
          Es compta el repartiment que el gestor assigna al teu nom a cada bolo.
        </div>
      </div>

      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 14 }}>Per grup</div>
        {Object.keys(byBand).length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Encara cap repartiment assignat al teu nom.</div>
        ) : (
          <div className="acd-band-rows">
            {Object.entries(byBand).sort((a, b) => b[1] - a[1]).map(([name, v]) => (
              <div key={name} className="acd-info-row">
                <span className="t-strong">{name}</span>
                <span>{formatCurrency(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title" style={{ marginBottom: 14 }}>Últims bolos cobrats o assignats</div>
        {recent.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Res per mostrar encara.</div>
        ) : (
          <div className="acd-band-rows">
            {recent.map(({ c, mine }) => (
              <div key={c.id} className="acd-info-row">
                <span className="t-dim">{formatDate(c.date)} · {c.bandName}{c.city ? ` · ${c.city.split(",")[0]}` : ""}</span>
                <span className="t-strong">{formatCurrency(mine)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
