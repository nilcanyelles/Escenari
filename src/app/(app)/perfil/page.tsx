import { db } from "@/lib/db";
import { requireManager, hasBandMembership } from "@/lib/current-user";
import { getOrCreatePersonProfile, getPersonProfileData } from "@/lib/person-profile";
import { getSelectedBandId } from "@/lib/band-scope";
import { today } from "@/lib/format";
import ProfileView from "@/app/p/[token]/ProfileView";
import StandaloneProfile from "@/app/(artist)/artista/perfil/StandaloneProfile";
import ProfileViewSwitch from "@/components/ProfileViewSwitch";

export const dynamic = "force-dynamic";

// Perfil personal del gestor, mirall del de l'artista (/artista/perfil):
// si també toca en algun grup de la seva agència, es veu igual que el
// perfil del músic (ProfileView); si no, el perfil "autònom" (StandaloneProfile).
// Substitueix el desplegable de l'avatar de dalt a la dreta — alternar de
// vista i tancar sessió ara surten al peu d'aquesta pestanya.
export default async function ManagerProfilePage() {
  const profile = await requireManager();
  const [memberships, selectedBandId, isMusicianAnywhere] = await Promise.all([
    db().query(
      `select b.id as band_id, b.workspace_id, bm.member_name from band_members bm
       join bands b on b.id = bm.band_id
       where bm.clerk_user_id=$1 and b.workspace_id=$2 order by bm.joined_at`,
      [profile.clerkUserId, profile.workspaceId]
    ).then((r) => r.rows),
    getSelectedBandId(),
    hasBandMembership(profile.clerkUserId),
  ]);
  const membership = memberships.find((m) => m.band_id === selectedBandId) || memberships[0];
  const switchView = isMusicianAnywhere ? { href: "/artista/perfil", label: "Vista de músic", mode: "artist" as const } : undefined;

  if (!membership) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <StandaloneProfile
          name={profile.name}
          username={profile.username}
          initial={{
            photoFileId: profile.photoFileId, bio: profile.bio, igHandle: profile.igHandle,
            phone: profile.phone, whatsapp: profile.whatsapp, instruments: profile.instruments, navApp: profile.navApp,
          }}
        />
        <ProfileViewSwitch switchView={switchView} />
      </div>
    );
  }

  const token = await getOrCreatePersonProfile(membership.workspace_id, membership.member_name || profile.name);
  await db().query("update person_profiles set clerk_user_id=$1 where id=$2 and clerk_user_id is null", [profile.clerkUserId, token]);
  const data = await getPersonProfileData(token);
  if (!data) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ProfileView data={data} isOwner={true} isManager={false} today={today()} navApp={profile.navApp} accountUsername={profile.username} />
      <ProfileViewSwitch switchView={switchView} />
    </div>
  );
}
