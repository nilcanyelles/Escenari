import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { normalizeRiderContent } from "@/lib/material-types";
import RiderStudio from "@/components/RiderStudio";

export const dynamic = "force-dynamic";

// Editor de rider a pàgina completa. Hi accedeix el gestor del workspace o un
// artista del grup amb permís d'edició de riders.
export default async function RiderStudioPage({ params }: { params: Promise<{ riderId: string }> }) {
  const { riderId } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const row = (await db().query(
    `select r.*, b.name as band_name, b.workspace_id as band_ws
     from riders r join bands b on b.id = r.band_id where r.id=$1`,
    [riderId]
  )).rows[0];
  if (!row) notFound();

  let allowed = false;
  let backHref = "/grup";
  if (profile.role === "manager" && profile.workspaceId === row.band_ws) {
    allowed = true;
  } else if (profile.role === "artist") {
    const editor = (await db().query(
      "select 1 from band_editors where band_id=$1 and clerk_user_id=$2 and can_riders",
      [row.band_id, profile.clerkUserId]
    )).rows[0];
    if (editor) { allowed = true; backHref = `/material/${row.band_id}`; }
  }
  if (!allowed) notFound();

  return (
    <RiderStudio
      bandId={row.band_id}
      bandName={row.band_name}
      riderId={row.id}
      initialName={row.name}
      initialContent={normalizeRiderContent(row.content)}
      mode="edit"
      backHref={backHref}
      publicToken={row.public_token}
    />
  );
}
