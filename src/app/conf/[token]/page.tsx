import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalize } from "@/lib/text";
import type { Person, Concert, Band } from "@/lib/types";
import ConfirmView from "./ConfirmView";

export const dynamic = "force-dynamic";

// Pàgina pública de confirmació d'assistència: cada músic tria qui és i
// respon, sense necessitat de compte ni registre. Si hi ha algú identificat
// (compte d'Escenari ja existent), es fa servir només per preseleccionar-lo
// i, en respondre, per vincular-lo automàticament — mai és obligatori.
export default async function ConfirmPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sel?: string }>;
}) {
  const { token } = await params;
  const { sel } = await searchParams;
  const pool = db();

  const concert = (await pool.query(
    `select c.id, c.date, c.time, c.exact_time, c.city, c.venue, c.address, c.festa_entitat, c.kind,
            c.attendance, c.substitutes, c.route_sheet, c.band_id, c.workspace_id,
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
  const dateStr = typeof concert.date === "string" ? concert.date.slice(0, 10) : concert.date.toISOString().slice(0, 10);

  // Objectes "de veres" (Concert/Band), només amb el que DiaBody fa servir
  // de veres — perquè la pàgina pública pugui mostrar la mateixa vista del
  // dia de bolo (horaris, contactes, qui ve, allotjament) que la de gestor,
  // en comptes de només el formulari d'assistència.
  const diaConcert: Concert = {
    id: concert.id, date: dateStr, time: concert.time || "", exactTime: concert.exact_time || "",
    venue: concert.venue || "", city: concert.city || "", address: concert.address || "",
    festaEntitat: concert.festa_entitat || "", bandId: concert.band_id, bandName: concert.band_name,
    tags: [], status: "confirmat", amount: 0, attendance: attendance as Record<string, "yes" | "no">, substitutes: concert.substitutes || {},
    noSubstitute: {}, convocatoriaExcluded: {}, contact: { email: "", name: "", phone: "", company: "" },
    routeSheet: concert.route_sheet, kind: concert.kind || "bolo", canAnnounce: "", announceAfter: "", ticketType: "",
  };
  const diaBand: Band = {
    id: concert.band_id, name: concert.band_name, city: "", rate: 0, contact: "", phone: "", tags: [],
    members: concert.members || [], crew: concert.crew || [],
  };

  return (
    <ConfirmView
      token={token}
      event={{
        date: dateStr,
        time: concert.time || "",
        exactTime: concert.exact_time || "",
        city: concert.city || "",
        venue: concert.venue || "",
        address: concert.address || "",
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
      viewerIsManager={viewerRole === "manager"}
      preselect={sel || ""}
      diaConcert={diaConcert}
      diaBand={diaBand}
    />
  );
}
