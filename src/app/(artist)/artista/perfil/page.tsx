import { db } from "@/lib/db";
import { requireArtist } from "@/lib/current-user";
import { getOrCreatePersonProfile, getPersonProfileData } from "@/lib/person-profile";
import { today } from "@/lib/format";
import ProfileView from "@/app/p/[token]/ProfileView";

export const dynamic = "force-dynamic";

// El perfil del músic, dins la seva àrea: foto, contacte (telèfon, WhatsApp,
// correu), instruments, grups, calendari i repertori — tot editable per ell.
export default async function ArtistProfilePage() {
  const profile = await requireArtist();
  const membership = (await db().query(
    `select b.workspace_id, bm.member_name from band_members bm
     join bands b on b.id = bm.band_id
     where bm.clerk_user_id=$1 order by bm.joined_at limit 1`,
    [profile.clerkUserId]
  )).rows[0];

  if (!membership) {
    return (
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-title" style={{ marginBottom: 8 }}>El teu perfil</div>
        <div className="t-dim" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          Quan t&apos;uneixis a un grup (amb el codi que et passi el gestor, des de
          &ldquo;Uneix-te a un grup&rdquo;) el teu perfil de músic apareixerà aquí:
          foto, instruments, contacte i el calendari de bolos.
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
