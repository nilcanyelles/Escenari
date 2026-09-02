import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { getSong } from "@/lib/songs";
import PerformView, { type PerformSong } from "../../[setlistId]/PerformView";

export const dynamic = "force-dynamic";

// Mode escenari d'una sola cançó (des de la biblioteca o el repertori):
// mateixa pantalla que amb una setlist, però només amb aquesta cançó.
export default async function PerformSongPage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const song = await getSong(songId);
  if (!song) notFound();

  let bandName = "Les meves cançons";
  let allowed = false;
  if (song.bandId) {
    const band = (await db().query("select name, workspace_id from bands where id=$1", [song.bandId])).rows[0];
    if (!band) notFound();
    bandName = band.name;
    allowed = profile.role === "manager" && profile.workspaceId === band.workspace_id;
    if (!allowed) {
      allowed = !!(await db().query(
        "select 1 from band_members where band_id=$1 and clerk_user_id=$2", [song.bandId, profile.clerkUserId]
      )).rows[0];
    }
  } else {
    allowed = song.ownerClerkUserId === profile.clerkUserId;
  }
  if (!allowed) notFound();

  const performSong: PerformSong = {
    title: song.title,
    duration: song.duration || "",
    key: song.songKey || "",
    notes: song.notes || "",
    tempo: song.tempo || 0,
    lyrics: song.lyrics || "",
    tracks: song.files.filter((f) => f.mime.startsWith("audio")).map((f) => ({ id: f.id, name: f.name || f.instrument })),
    scores: song.files.filter((f) => !f.mime.startsWith("audio")).map((f) => ({ id: f.id, name: f.name, mime: f.mime, instrument: f.instrument || "Totes les veus" })),
    instruments: song.instruments || [],
  };

  const backHref = profile.role === "manager" ? "/grup?tab=cancons" : "/artista/biblioteca";
  return <PerformView name={song.title} bandName={bandName} songs={[performSong]} backHref={backHref} />;
}
