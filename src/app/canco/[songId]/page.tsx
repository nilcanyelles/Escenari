import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { getSong } from "@/lib/songs";
import SongStudio from "./SongStudio";

export const dynamic = "force-dynamic";

// Editor de cançó a pàgina completa: lletra i acords a l'esquerra, dades,
// instruments i partitures a la dreta. Serveix per a les cançons d'un grup
// (gestor o membres) i per a les cançons pròpies del músic (biblioteca).
export default async function SongStudioPage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const song = await getSong(songId);
  if (!song) notFound();

  let allowed = false;
  let backHref = "/grup?tab=cancons";
  let bandName = "Les meves cançons";
  let bandLogo = "";
  let bandColor = "#8b7bff";
  const bandInstruments: string[] = [];

  if (song.bandId) {
    const row = (await db().query(
      "select name, workspace_id, members, logo, color1 from bands where id=$1", [song.bandId]
    )).rows[0];
    if (!row) notFound();
    bandName = row.name;
    bandLogo = row.logo || "";
    bandColor = row.color1 || "#8b7bff";
    allowed = profile.role === "manager" && profile.workspaceId === row.workspace_id;
    if (!allowed) {
      const member = (await db().query(
        "select 1 from band_members where band_id=$1 and clerk_user_id=$2", [song.bandId, profile.clerkUserId]
      )).rows[0];
      if (member) { allowed = true; backHref = "/artista/grup?tab=cancons"; }
    }
    // Instruments del grup, per proposar-los com a xips.
    const seen: Record<string, boolean> = {};
    (row.members || []).forEach((m: { instruments?: string[]; role?: string }) => {
      const list = m.instruments?.length ? m.instruments : String(m.role || "").split(/[,/]| i /i).map((s: string) => s.trim()).filter(Boolean);
      list.forEach((i) => { const k = i.toLowerCase(); if (!seen[k]) { seen[k] = true; bandInstruments.push(i); } });
    });
  } else {
    // Cançó pròpia: només el seu propietari; els instruments proposats són
    // els seus.
    allowed = song.ownerClerkUserId === profile.clerkUserId;
    backHref = profile.role === "manager" ? "/grup" : "/artista/biblioteca";
    bandInstruments.push(...profile.instruments);
  }
  if (!allowed) notFound();

  return (
    <SongStudio
      song={song}
      bandId={song.bandId || ""}
      bandName={bandName}
      bandLogo={bandLogo}
      bandColor={bandColor}
      bandInstruments={bandInstruments}
      backHref={backHref}
    />
  );
}
