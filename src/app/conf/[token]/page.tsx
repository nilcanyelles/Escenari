import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalize } from "@/lib/text";
import type { Person } from "@/lib/types";
import ConfirmView from "./ConfirmView";

export const dynamic = "force-dynamic";

// Pàgina pública de confirmació d'assistència: cada músic tria qui és i
// respon amb el seu compte (o se'n crea un i queda vinculat al grup).
export default async function ConfirmPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sel?: string }>;
}) {
  const { token } = await params;
  const { sel } = await searchParams;
  const pool = db();

  const concert = (await pool.query(
    `select c.id, c.date, c.time, c.city, c.venue, c.festa_entitat, c.kind, c.attendance, c.band_id, c.workspace_id,
            b.name as band_name, b.logo, b.color1, b.color2, b.members, b.crew
     from concerts c join bands b on b.id = c.band_id
     where c.att_token=$1 and c.status <> 'cancel·lat'`,
    [token]
  )).rows[0];
  if (!concert) notFound();

  const members: Person[] = [...(concert.members || []), ...(concert.crew || [])];
  const links = (await pool.query(
    "select member_name, clerk_user_id from band_members where band_id=$1",
    [concert.band_id]
  )).rows;
  const linkedByName: Record<string, string> = {};
  links.forEach((l) => { linkedByName[normalize(l.member_name)] = l.clerk_user_id; });

  const photos = (await pool.query(
    "select person_name, photo_file_id from person_profiles where workspace_id=$1 and photo_file_id is not null",
    [concert.workspace_id]
  )).rows;
  const photosByName: Record<string, string> = {};
  photos.forEach((p) => { photosByName[normalize(p.person_name)] = p.photo_file_id; });

  const { userId } = await auth();
  const myMemberName = userId
    ? links.find((l) => l.clerk_user_id === userId)?.member_name || ""
    : "";
  const viewerRole = userId
    ? (await pool.query("select role from profiles where clerk_user_id=$1", [userId])).rows[0]?.role || "none"
    : "none";

  const attendance: Record<string, string> = concert.attendance || {};

  return (
    <ConfirmView
      token={token}
      event={{
        date: typeof concert.date === "string" ? concert.date.slice(0, 10) : concert.date.toISOString().slice(0, 10),
        time: concert.time || "",
        city: concert.city || "",
        venue: concert.venue || "",
        festaEntitat: concert.festa_entitat || "",
        kind: concert.kind || "bolo",
        bandName: concert.band_name,
        logo: concert.logo || "",
        color1: concert.color1 || "",
        color2: concert.color2 || "",
      }}
      members={members.map((m) => ({
        name: m.name,
        instruments: m.instruments?.length ? m.instruments : String(m.role || "").split(/[,/]| i /i).map((s) => s.trim()).filter(Boolean),
        photoId: photosByName[normalize(m.name)] || "",
        linked: !!linkedByName[normalize(m.name)],
        isMe: !!myMemberName && normalize(m.name) === normalize(myMemberName),
        answer: attendance[m.name] === "yes" ? "yes" : attendance[m.name] === "no" ? "no" : "",
      }))}
      signedIn={!!userId}
      viewerIsManager={viewerRole === "manager"}
      preselect={sel || ""}
    />
  );
}
