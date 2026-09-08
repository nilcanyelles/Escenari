import { db } from "@/lib/db";
import { requireArtist } from "@/lib/current-user";
import { getOrCreatePersonProfile, getPersonProfileData } from "@/lib/person-profile";
import { getSelectedBandId } from "@/lib/band-scope";
import { today } from "@/lib/format";
import ProfileView from "@/app/p/[token]/ProfileView";

export const dynamic = "force-dynamic";

// El perfil del músic, dins la seva àrea: foto, contacte (telèfon, WhatsApp,
// correu), instruments, grups i repertori — tot editable per ell. El
// calendari de bolos i la disponibilitat es gestionen des del Calendari.
// El perfil és per agència (workspace): es mostra el del grup seleccionat
// a la barra lateral, o el primer on es va unir.
export default async function ArtistProfilePage() {
  const profile = await requireArtist();
  const [memberships, selectedBandId] = await Promise.all([
    db().query(
      `select b.id as band_id, b.workspace_id, bm.member_name from band_members bm
       join bands b on b.id = bm.band_id
       where bm.clerk_user_id=$1 order by bm.joined_at`,
      [profile.clerkUserId]
    ).then((r) => r.rows),
    getSelectedBandId(),
  ]);
  const membership = memberships.find((m) => m.band_id === selectedBandId) || memberships[0];

  if (!membership) {
    return (
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-title" style={{ marginBottom: 8 }}>El teu perfil</div>
        <div className="t-dim" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          Quan t&apos;uneixis a un grup (amb el codi que et passi el gestor, des de
          &ldquo;Uneix-te a un grup&rdquo;) el teu perfil de músic apareixerà aquí:
          foto, instruments, contacte i els teus grups.
        </div>
      </div>
    );
  }

  const token = await getOrCreatePersonProfile(membership.workspace_id, membership.member_name || profile.name);
  await db().query("update person_profiles set clerk_user_id=$1 where id=$2 and clerk_user_id is null", [profile.clerkUserId, token]);
  const data = await getPersonProfileData(token);
  if (!data) return null;

  return <ProfileView data={data} isOwner={true} isManager={false} today={today()} />;
}
