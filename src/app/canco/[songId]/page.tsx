import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { getSongs } from "@/lib/songs";
import SongStudio from "./SongStudio";

export const dynamic = "force-dynamic";

// Editor de cançó a pàgina completa: lletra i acords a l'esquerra, dades,
// instruments i partitures a la dreta.
export default async function SongStudioPage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const row = (await db().query(
    `select s.band_id, b.name as band_name, b.workspace_id, b.members, b.logo, b.color1
     from songs s join bands b on b.id = s.band_id where s.id=$1`,
    [songId]
  )).rows[0];
  if (!row) notFound();

  let allowed = profile.role === "manager" && profile.workspaceId === row.workspace_id;
  let backHref = "/grup?tab=cancons";
  if (!allowed) {
    const member = (await db().query(
      "select 1 from band_members where band_id=$1 and clerk_user_id=$2", [row.band_id, profile.clerkUserId]
    )).rows[0];
    if (member) { allowed = true; backHref = "/artista/grup?tab=cancons"; }
  }
  if (!allowed) notFound();

  const songs = await getSongs(row.band_id);
  const song = songs.find((s) => s.id === songId);
  if (!song) notFound();

  // Instruments del grup, per proposar-los com a xips.
  const bandInstruments: string[] = [];
  const seen: Record<string, boolean> = {};
  (row.members || []).forEach((m: { instruments?: string[]; role?: string }) => {
    const list = m.instruments?.length ? m.instruments : String(m.role || "").split(/[,/]| i /i).map((s: string) => s.trim()).filter(Boolean);
    list.forEach((i) => { const k = i.toLowerCase(); if (!seen[k]) { seen[k] = true; bandInstruments.push(i); } });
  });

  return (
    <SongStudio
      song={song}
      bandId={row.band_id}
      bandName={row.band_name}
      bandLogo={row.logo || ""}
      bandColor={row.color1 || "#8b7bff"}
      bandInstruments={bandInstruments}
      backHref={backHref}
    />
  );
}
