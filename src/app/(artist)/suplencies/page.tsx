import { requireArtist } from "@/lib/current-user";
import { getOpenBackupSearches } from "@/lib/artist-data";
import { MONTH_ABBR } from "@/lib/format";
import { bandPhotoDataUri } from "@/lib/tags";
import { normalize } from "@/lib/text";
import { db } from "@/lib/db";
import { geocodeCitiesCached, haversineKm } from "@/lib/geocode";
import ApplyButton from "./ApplyButton";
import AvailabilityBox, { type SubsPrefs } from "./AvailabilityBox";

export const dynamic = "force-dynamic";

// Borsa de suplències: cerques obertes de tots els grups d'Escenari, on
// qualsevol músic pot presentar-se — filtrades per les seves preferències
// (distància des de casa i instruments). La disponibilitat dia a dia es
// marca al seu Calendari.
export default async function SuplenciesPage() {
  const profile = await requireArtist();
  const [searches, availRow, prefRow] = await Promise.all([
    getOpenBackupSearches(profile.clerkUserId),
    db().query(
      "select open_to_subs, profile_public from person_profiles where clerk_user_id=$1 limit 1",
      [profile.clerkUserId]
    ).then((r) => r.rows[0] || null),
    db().query(
      "select subs_max_km, subs_home_city, subs_any_instrument, subs_instruments from profiles where clerk_user_id=$1",
      [profile.clerkUserId]
    ).then((r) => r.rows[0] || null),
  ]);
  const prefs: SubsPrefs = {
    maxKm: Number(prefRow?.subs_max_km) || 0,
    homeCity: prefRow?.subs_home_city || "",
    anyInstrument: prefRow?.subs_any_instrument !== false,
    instruments: (prefRow?.subs_instruments as string[]) || [],
  };

  // Instruments: només les cerques d'algun dels que ha triat (les de crew,
  // per càrrec, i les que no en demanen cap, sempre).
  let visible = searches;
  if (!prefs.anyInstrument && prefs.instruments.length) {
    const mine = new Set(prefs.instruments.map(normalize));
    visible = visible.filter((s) => s.isMine || !!s.role || !s.instruments.length || s.instruments.some((i) => mine.has(normalize(i))));
  }
  // Distància: des de la seva població fins a la del bolo (cache de
  // geocodificació de l'app). Una població que no es troba no es filtra.
  let homeUnknown = false;
  const cityOf = (city: string) => (city || "").split(",")[0].trim();
  if (prefs.maxKm > 0 && prefs.homeCity.trim()) {
    const home = prefs.homeCity.trim();
    const coords = await geocodeCitiesCached([home, ...visible.map((s) => cityOf(s.city)).filter(Boolean)]);
    const homeCoord = coords[home];
    if (homeCoord) {
      visible = visible.filter((s) => {
        if (s.isMine) return true;
        const c = coords[cityOf(s.city)];
        return !c || haversineKm(homeCoord, c) <= prefs.maxKm;
      });
    } else {
      homeUnknown = true;
    }
  }
  const hidden = searches.length - visible.length;

  return (
    <div>
      <AvailabilityBox
        open={!!availRow?.open_to_subs}
        visible={availRow ? !!availRow.profile_public : true}
        prefs={prefs}
        profileInstruments={profile.instruments}
      />
      <div className="artist-section-title">Borsa de suplències</div>
      {(hidden > 0 || homeUnknown) && (
        <div className="t-dim" style={{ fontSize: 12.5, marginBottom: 10 }}>
          {homeUnknown
            ? `No s'ha trobat la població «${prefs.homeCity}» — revisa-la a les preferències per filtrar per distància.`
            : `${hidden} ${hidden === 1 ? "cerca amagada" : "cerques amagades"} per les teves preferències (distància o instruments).`}
        </div>
      )}
      {visible.length === 0 ? (
        <div className="artist-empty">
          {searches.length === 0
            ? "Ara mateix cap grup busca suplent. Quan un músic no pugui anar a un bolo i el grup publiqui la cerca, la veuràs aquí."
            : "Cap cerca encaixa amb les teves preferències de distància o instruments."}
        </div>
      ) : (
        <div className="artist-gig-list">
          {visible.map((s) => {
            const [, m, d] = s.date.split("-");
            const bandColorHex = s.color1 || "#8b7bff";
            const logo = s.bandLogo || bandPhotoDataUri({ id: s.bandId, name: s.bandName });
            return (
              <div key={s.id} className="artist-gig-card">
                <div className="artist-gig-date">
                  <div className="d">{parseInt(d, 10)}</div>
                  <div className="m">{MONTH_ABBR[parseInt(m, 10) - 1]}</div>
                </div>
                <div className="artist-gig-main">
                  <div className="artist-gig-title">{s.venue || "Ubicació per determinar"}{s.city ? ` · ${s.city}` : ""}</div>
                  <div className="artist-gig-meta">
                    {s.role ? `Es busca: ${s.role}` : s.instruments.length ? `Es busca: ${s.instruments.join(", ")}` : "Es busca suplent"}
                    {s.note ? ` · ${s.note}` : ""}
                  </div>
                </div>
                <span className="artist-gig-band" style={{ background: `${bandColorHex}26`, color: bandColorHex }}>
                  <img src={logo} alt="" />
                  {s.bandName}
                </span>
                {s.isMine ? (
                  <span className="t-dim" style={{ fontSize: 12 }}>el teu grup</span>
                ) : (
                  <ApplyButton requestId={s.id} status={s.myApplicationStatus} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
