import { requireArtist } from "@/lib/current-user";
import { getArtistBands, getPendingInvitations } from "@/lib/artist-data";
import { bandPhotoDataUri } from "@/lib/tags";
import InvitationCard from "./InvitationCard";
import JoinByCode from "./JoinByCode";

export const dynamic = "force-dynamic";

export default async function ArtistGroupsPage() {
  const profile = await requireArtist();
  const [bands, invitations] = await Promise.all([
    getArtistBands(profile.clerkUserId),
    getPendingInvitations(profile.email),
  ]);

  return (
    <div>
      {invitations.length > 0 && (
        <>
          <div className="artist-section-title">Invitacions pendents</div>
          <div className="artist-gig-list" style={{ marginBottom: 8 }}>
            {invitations.map((inv) => (
              <InvitationCard
                key={inv.id}
                id={inv.id}
                bandName={inv.bandName}
                managerName={inv.managerName}
                logo={inv.bandLogo || bandPhotoDataUri({ id: inv.bandId, name: inv.bandName })}
              />
            ))}
          </div>
        </>
      )}

      <div className="artist-section-title">Els meus grups</div>
      {bands.length === 0 ? (
        <div className="artist-empty">
          Encara no formes part de cap grup. Accepta una invitació o introdueix el codi que t&apos;hagi passat el gestor.
        </div>
      ) : (
        <div className="artist-band-grid">
          {bands.map((band) => {
            const c1 = band.color1 || "#8b7bff";
            const c2 = band.color2 || "#e86bd0";
            return (
              <div className="artist-band-card" key={band.id}>
                <div className="artist-band-banner" style={{ background: `linear-gradient(120deg, ${c1}, ${c2})` }}></div>
                <div className="artist-band-body">
                  <img className="artist-band-logo" src={band.logo || bandPhotoDataUri({ id: band.id, name: band.name })} alt="" />
                  <div className="artist-band-name">{band.name}</div>
                  <div className="artist-band-meta">
                    {band.city ? `${band.city} · ` : ""}
                    {band.memberCount} {band.memberCount === 1 ? "membre" : "membres"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="artist-section-title">Uneix-te amb un codi</div>
      <JoinByCode />
    </div>
  );
}
