import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireArtist } from "@/lib/current-user";
import { getRiders, getSetlists, getArtistEditableBands } from "@/lib/material-data";
import ArtistMaterialView from "./ArtistMaterialView";
import type { Band } from "@/lib/types";

export const dynamic = "force-dynamic";

// Riders i setlists d'un grup, per a un artista membre. Només pot editar si el
// gestor li ha donat permís (band_editors).
export default async function ArtistMaterialPage({ params }: { params: Promise<{ bandId: string }> }) {
  const { bandId } = await params;
  const profile = await requireArtist();

  const isMember = (await db().query(
    "select 1 from band_members where band_id=$1 and clerk_user_id=$2",
    [bandId, profile.clerkUserId]
  )).rows.length > 0;
  if (!isMember) notFound();

  const bandRow = (await db().query("select * from bands where id=$1", [bandId])).rows[0];
  if (!bandRow) notFound();
  const band: Band = {
    id: bandRow.id, name: bandRow.name, city: bandRow.city, rate: bandRow.rate,
    contact: bandRow.contact, phone: bandRow.phone, tags: bandRow.tags || [],
    members: bandRow.members || [], crew: bandRow.crew || [],
    logo: bandRow.logo, color1: bandRow.color1, color2: bandRow.color2,
  };

  const [riders, setlists, editable] = await Promise.all([
    getRiders(bandId), getSetlists(bandId), getArtistEditableBands(profile.clerkUserId),
  ]);
  const perms = editable[bandId] || { canRiders: false, canSetlists: false };

  return (
    <ArtistMaterialView
      band={band}
      riders={riders}
      setlists={setlists}
      canRiders={perms.canRiders}
      canSetlists={perms.canSetlists}
    />
  );
}
