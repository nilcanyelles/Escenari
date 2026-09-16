import { db } from "@/lib/db";
import { requireArtist } from "@/lib/current-user";
import { getOrCreatePersonProfile, getPersonProfileData } from "@/lib/person-profile";
import { getSelectedBandId } from "@/lib/band-scope";
import { today } from "@/lib/format";
import ProfileView from "@/app/p/[token]/ProfileView";
import StandaloneProfile from "./StandaloneProfile";

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
      <StandaloneProfile
        name={profile.name}
        initial={{
          photoFileId: profile.photoFileId, bio: profile.bio, igHandle: profile.igHandle,
          phone: profile.phone, whatsapp: profile.whatsapp, instruments: profile.instruments, navApp: profile.navApp,
        }}
      />
    );
  }

  const token = await getOrCreatePersonProfile(membership.workspace_id, membership.member_name || profile.name);
  await db().query("update person_profiles set clerk_user_id=$1 where id=$2 and clerk_user_id is null", [profile.clerkUserId, token]);
  const data = await getPersonProfileData(token);
  if (!data) return null;

  return <ProfileView data={data} isOwner={true} isManager={false} today={today()} navApp={profile.navApp} />;
}
