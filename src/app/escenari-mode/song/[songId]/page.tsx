import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { getSong, getSongs, getPersonalSongs, type Song } from "@/lib/songs";
import PerformView, { type PerformSong } from "../../[setlistId]/PerformView";

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

// Mode escenari obert des d'una sola cançó (repertori o biblioteca), no
// d'una setlist: hi entra directament a aquesta cançó, però amb la resta
// del repertori del grup (o de la biblioteca personal, sense grup) al
// menú lateral, per poder continuar amb una altra sense sortir.
export default async function PerformSongPage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const song = await getSong(songId);
  if (!song) notFound();

  let bandName = "Les meves cançons";
  let allowed = false;
  let allSongs: Song[] = [song];
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
    if (allowed) allSongs = await getSongs(song.bandId);
  } else {
    allowed = song.ownerClerkUserId === profile.clerkUserId;
    if (allowed) allSongs = await getPersonalSongs(profile.clerkUserId);
  }
  if (!allowed) notFound();
  if (!allSongs.length) allSongs = [song];

  const performSongs = allSongs.map(toPerformSong);
  const initialIndex = Math.max(0, allSongs.findIndex((s) => s.id === songId));

  const backHref = profile.role === "manager" ? "/grup?tab=cancons" : "/artista/biblioteca";
  return (
    <PerformView
      name={allSongs.length > 1 ? "Repertori" : song.title} bandName={bandName} songs={performSongs}
      backHref={backHref} skipIntro initialIndex={initialIndex}
    />
  );
}
