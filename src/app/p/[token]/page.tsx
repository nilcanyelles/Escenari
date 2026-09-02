import { getPersonProfileData } from "@/lib/person-profile";
import { getProfile } from "@/lib/current-user";
import { today } from "@/lib/format";
import ProfileView from "./ProfileView";

export const dynamic = "force-dynamic";

// Perfil públic d'un músic: compartible amb qualsevol; amb sessió, el músic
// vinculat o el gestor hi veuen els controls d'edició.
export default async function PersonProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPersonProfileData(token);

  if (!data) {
    return (
      <div className="pf-screen">
        <div className="pf-dead">
          <div className="pf-brand">ESCENARI</div>
          <div className="pf-dead-icon">🎸</div>
          <h1>Aquest perfil no existeix</h1>
        </div>
      </div>
    );
  }

  const me = await getProfile();
  const isOwner = !!me && !!data.clerkUserId && me.clerkUserId === data.clerkUserId;
  const isManager = !!me && me.role === "manager" && me.workspaceId === data.workspaceId;

  // Qui no és el músic ni el seu gestor veu la disponibilitat (verd/vermell)
  // però no els bolos: ni la llista ni el motiu dels dies ocupats.
  const safe = isOwner || isManager
    ? data
    : { ...data, concerts: [], busyDays: Object.fromEntries(Object.keys(data.busyDays).map((d) => [d, ""])) };

  return <ProfileView data={safe} isOwner={isOwner} isManager={isManager} today={today()} />;
}
