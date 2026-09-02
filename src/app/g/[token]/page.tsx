import { db } from "@/lib/db";
import { getBandPublicData } from "@/lib/band-public";
import { getProfile } from "@/lib/current-user";
import BandPublicView from "./BandPublicView";

export const dynamic = "force-dynamic";

// Pàgina pública d'un grup: compartible amb qualsevol; amb sessió, el gestor
// hi pot editar el text de presentació i tothom hi té el camí de tornada.
export default async function BandPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getBandPublicData(token);

  if (!data) {
    return (
      <div className="pf-screen">
        <div className="pf-dead">
          <div className="pf-brand">ESCENARI</div>
          <div className="pf-dead-icon">🎸</div>
          <h1>Aquest grup no existeix</h1>
          <p>L&apos;enllaç no és vàlid o el grup s&apos;ha eliminat.</p>
        </div>
      </div>
    );
  }

  const me = await getProfile();
  const isManager = !!me && me.role === "manager" && me.workspaceId === data.workspaceId;
  let isMember = false;
  if (me && !isManager) {
    isMember = !!(await db().query(
      "select 1 from band_members where band_id=$1 and clerk_user_id=$2",
      [data.bandId, me.clerkUserId]
    )).rows[0];
  }

  return (
    <BandPublicView
      data={data}
      canEdit={isManager}
      backHref={isManager ? "/grup" : isMember ? "/artista/grup" : ""}
    />
  );
}
