import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { getSongs } from "@/lib/songs";
import PerformView, { type PerformSong } from "./PerformView";

export const dynamic = "force-dynamic";

// Mode escenari: la setlist a pantalla completa amb lletres, acords,
// auto-scroll, metrònom i to inicial. Per a gestors i membres del grup.
export default async function PerformPage({ params }: { params: Promise<{ setlistId: string }> }) {
  const { setlistId } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const sl = (await db().query(
    `select s.*, b.name as band_name, b.workspace_id as band_ws from setlists s
     join bands b on b.id = s.band_id where s.id=$1`,
    [setlistId]
  )).rows[0];
  if (!sl) notFound();

  let allowed = profile.role === "manager" && profile.workspaceId === sl.band_ws;
  if (!allowed) {
    const member = (await db().query(
      "select 1 from band_members where band_id=$1 and clerk_user_id=$2", [sl.band_id, profile.clerkUserId]
    )).rows[0];
    allowed = !!member;
  }
  if (!allowed) notFound();

  const lib = await getSongs(sl.band_id);
  const byId: Record<string, typeof lib[number]> = {};
  const byTitle: Record<string, typeof lib[number]> = {};
  lib.forEach((s) => { byId[s.id] = s; byTitle[s.title.toLowerCase()] = s; });

  const songs: PerformSong[] = (sl.songs || [])
    .filter((s: { title: string }) => (s.title || "").trim())
    .map((s: { title: string; duration: string; key: string; notes: string; songId?: string }) => {
      const match = (s.songId && byId[s.songId]) || byTitle[(s.title || "").toLowerCase()];
      const tracks = (match?.files || [])
        .filter((f) => f.mime.startsWith("audio"))
        .map((f) => ({ id: f.id, name: f.name || f.instrument }));
      // Partitures (PDF/imatge/document) penjades a la cançó, per veu.
      const scores = (match?.files || [])
        .filter((f) => !f.mime.startsWith("audio"))
        .map((f) => ({ id: f.id, name: f.name, mime: f.mime, instrument: f.instrument || "Totes les veus" }));
      return {
        title: s.title,
        duration: s.duration || match?.duration || "",
        key: s.key || match?.songKey || "",
        notes: s.notes || "",
        tempo: match?.tempo || 0,
        lyrics: match?.lyrics || "",
        tracks,
        scores,
        instruments: match?.instruments || [],
      };
    });

  const backHref = profile.role === "manager" ? "/grup" : `/material/${sl.band_id}`;
  return <PerformView name={sl.name} bandName={sl.band_name} songs={songs} backHref={backHref} />;
}
