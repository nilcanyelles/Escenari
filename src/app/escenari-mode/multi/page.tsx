import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { getSong, type Song } from "@/lib/songs";
import PerformView, { type PerformSong } from "../[setlistId]/PerformView";

export const dynamic = "force-dynamic";

function toPerformSong(song: Song): PerformSong {
  return {
    title: song.title,
    duration: song.duration || "",
    key: song.songKey || "",
    notes: song.notes || "",
    tempo: song.tempo || 0,
    lyrics: song.lyrics || "",
    tracks: song.files.filter((f) => f.mime.startsWith("audio")).map((f) => ({ id: f.id, name: f.name || f.instrument })),
    scores: song.files.filter((f) => !f.mime.startsWith("audio")).map((f) => ({ id: f.id, name: f.name, mime: f.mime, instrument: f.instrument || "Totes les veus" })),
    instruments: song.instruments || [],
    tags: song.tags || [],
  };
}

// Mode escenari obert des d'una sel·lecció múltiple a la biblioteca de
// cançons (poden ser de grups diferents): es tracta la sel·lecció com si
// fos una setlist, en l'ordre en què s'han triat.
export default async function PerformMultiPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const songIds = (ids || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (songIds.length === 0) redirect("/artista/biblioteca");

  const bandWorkspaceCache = new Map<string, { name: string; workspaceId: string } | null>();
  const allowedSongs: Song[] = [];
  for (const id of songIds) {
    const song = await getSong(id);
    if (!song) continue;
    let allowed = false;
    if (song.bandId) {
      let band = bandWorkspaceCache.get(song.bandId);
      if (band === undefined) {
        const row = (await db().query("select name, workspace_id from bands where id=$1", [song.bandId])).rows[0];
        band = row ? { name: row.name, workspaceId: row.workspace_id } : null;
        bandWorkspaceCache.set(song.bandId, band);
      }
      if (!band) continue;
      allowed = profile.role === "manager" && profile.workspaceId === band.workspaceId;
      if (!allowed) {
        allowed = !!(await db().query(
          "select 1 from band_members where band_id=$1 and clerk_user_id=$2", [song.bandId, profile.clerkUserId]
        )).rows[0];
      }
    } else {
      allowed = song.ownerClerkUserId === profile.clerkUserId;
    }
    if (allowed) allowedSongs.push(song);
  }
  if (allowedSongs.length === 0) redirect("/artista/biblioteca");

  const performSongs = allowedSongs.map(toPerformSong);
  const backHref = profile.role === "manager" ? "/grup?tab=cancons" : "/artista/biblioteca";
  return (
    <PerformView
      name="Sel·lecció" bandName="" songs={performSongs}
      backHref={backHref} initialIndex={0}
    />
  );
}
