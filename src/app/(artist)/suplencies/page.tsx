import { requireArtist } from "@/lib/current-user";
import { getOpenBackupSearches } from "@/lib/artist-data";
import { MONTH_ABBR } from "@/lib/format";
import { bandPhotoDataUri } from "@/lib/tags";
import ApplyButton from "./ApplyButton";

export const dynamic = "force-dynamic";

// Borsa de suplències: cerques obertes de tots els grups d'Escenari, on
// qualsevol músic pot presentar-se.
export default async function SuplenciesPage() {
  const profile = await requireArtist();
  const searches = await getOpenBackupSearches(profile.clerkUserId);

  return (
    <div>
      <div className="artist-section-title">Borsa de suplències</div>
      {searches.length === 0 ? (
        <div className="artist-empty">
          Ara mateix cap grup busca suplent. Quan un músic no pugui anar a un bolo i el grup publiqui la cerca, la veuràs aquí.
        </div>
      ) : (
        <div className="artist-gig-list">
          {searches.map((s) => {
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
                    {s.instruments.length ? `Es busca: ${s.instruments.join(", ")}` : "Es busca suplent"}
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
