import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { emptyRiderContent } from "@/lib/material-types";
import { getBands, getContacts } from "@/lib/data";
import RiderStudio from "@/components/RiderStudio";

export const dynamic = "force-dynamic";

// Rider nou encara sense desar: s'obre l'editor buit i NO es crea cap
// entrada a la base de dades fins que l'usuari clica "Fet". Si surt abans,
// no queda res. Necessita ?band=<id> per saber de quin grup és.
export default async function NewRiderPage({ searchParams }: { searchParams: Promise<{ band?: string }> }) {
  const { band: bandId } = await searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  if (!bandId) notFound();

  const band = (await db().query("select id, name, workspace_id from bands where id=$1", [bandId])).rows[0];
  if (!band) notFound();

  let allowed = false;
  let backHref = "/grup?tab=documents";
  if (profile.role === "manager" && profile.workspaceId === band.workspace_id) {
    allowed = true;
  } else if (profile.role === "artist") {
    const editor = (await db().query(
      "select 1 from band_editors where band_id=$1 and clerk_user_id=$2 and can_riders",
      [band.id, profile.clerkUserId]
    )).rows[0];
    if (editor) { allowed = true; backHref = `/material/${band.id}`; }
  }
  if (!allowed) notFound();

  const [bands, agencyContacts] = await Promise.all([getBands(band.workspace_id), getContacts(band.workspace_id)]);
  const bandFull = bands.find((b) => b.id === band.id);

  return (
    <RiderStudio
      bandId={band.id}
      bandName={band.name}
      riderId={null}
      initialName="Rider tècnic"
      initialContent={emptyRiderContent()}
      mode="new"
      backHref={backHref}
      bandMembers={bandFull?.members || []}
      bandCrew={bandFull?.crew || []}
      agencyContacts={agencyContacts}
    />
  );
}
