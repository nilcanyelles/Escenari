import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalize } from "@/lib/text";
import type { Person, Concert, Band } from "@/lib/types";
import { resolveAttendanceLink } from "@/lib/attendance-link";
import { getBackupRequests } from "@/lib/group-data";
import ConfirmView, { type ConfMember, type ConfViewer, type ConfSubInfo } from "./ConfirmView";

export const dynamic = "force-dynamic";

function toDateStr(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Pàgina pública de confirmació d'assistència: primer cada músic tria qui
// és; després entra amb el seu compte (o se'l crea, si encara no en té) i
// veu la taula dels concerts de l'enllaç — un de sol (concerts.att_token)
// o uns quants de propers del grup (attendance_links) — on confirma o
// rebutja cadascun.
export default async function ConfirmPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sel?: string }>;
}) {
  const { token } = await params;
  const { sel } = await searchParams;
  const link = await resolveAttendanceLink(token);
  if (!link) notFound();
  const pool = db();

  const band = (await pool.query(
    "select id, name, logo, logo_aspect, color1, color2, members, crew from bands where id=$1",
    [link.bandId]
  )).rows[0];
  if (!band) notFound();

  const rows = link.concertIds.length
    ? (await pool.query(
        `select id, date, time, exact_time, city, venue, address, festa_entitat, kind, status, attendance, substitutes, route_sheet, band_id, band_name
         from concerts where id = any($1::text[]) order by date, time`,
        [link.concertIds]
      )).rows
    : [];

  const members: Person[] = [...(band.members || []), ...(band.crew || [])];
  const [links, photos] = await Promise.all([
    pool.query("select member_name, clerk_user_id from band_members where band_id=$1", [band.id]).then((r) => r.rows),
    pool.query(
      "select person_name, photo_file_id from person_profiles where workspace_id=$1 and photo_file_id is not null",
      [link.workspaceId]
    ).then((r) => r.rows),
  ]);
  const linkedByName: Record<string, string> = {};
  links.forEach((l) => { linkedByName[normalize(l.member_name)] = l.clerk_user_id; });
  const photosByName: Record<string, string> = {};
  photos.forEach((p) => { photosByName[normalize(p.person_name)] = p.photo_file_id; });

  // Membres encara sense vincle però amb un compte d'Escenari al mateix
  // correu: també se'ls demana entrar (en respondre, quedaran vinculats).
  const emails = members.map((m) => (m.email || "").trim().toLowerCase()).filter(Boolean);
  const accountEmails = new Set<string>(
    emails.length
      ? (await pool.query("select lower(email) as email from profiles where lower(email) = any($1::text[])", [emails])).rows.map((r) => r.email as string)
      : []
  );

  const { userId } = await auth();
  const myLink = userId ? links.find((l) => l.clerk_user_id === userId) : undefined;
  const viewerProfile = userId
    ? (await pool.query("select role from profiles where clerk_user_id=$1", [userId])).rows[0]
    : null;
  const viewer: ConfViewer = {
    loggedIn: !!userId,
    role: viewerProfile?.role === "manager" ? "manager" : viewerProfile?.role === "artist" ? "artist" : "none",
    linkedMemberName: myLink?.member_name || "",
  };

  // Objectes "de veres" (Concert/Band), només amb el que la vista fa servir
  // — la taula de concerts i, a sota, la mateixa vista del dia de bolo
  // (horaris, contactes, qui ve, allotjament) que la de gestor (DiaBody).
  const concerts: Concert[] = rows.map((c) => ({
    id: c.id, date: toDateStr(c.date), time: c.time || "", exactTime: c.exact_time || "",
    venue: c.venue || "", city: c.city || "", address: c.address || "",
    festaEntitat: c.festa_entitat || "", bandId: c.band_id, bandName: c.band_name || band.name,
    tags: [], status: c.status as Concert["status"], amount: 0,
    attendance: (c.attendance || {}) as Record<string, "yes" | "no">, substitutes: c.substitutes || {},
    noSubstitute: {}, convocatoriaExcluded: {}, contact: { email: "", name: "", phone: "", company: "" },
    routeSheet: c.route_sheet, kind: c.kind || "bolo", canAnnounce: "", announceAfter: "", ticketType: "",
  }));
  const diaBand: Band = {
    id: band.id, name: band.name, city: "", rate: 0, contact: "", phone: "", tags: [],
    members: band.members || [], crew: band.crew || [],
  };

  // Cerques de suplent obertes d'aquests concerts (proposades des d'aquí
  // mateix o publicades pel gestor), per membre: qui s'hi ha presentat i
  // l'enllaç del suplent, si n'hi ha.
  const reqs = (await getBackupRequests(link.workspaceId, { bandId: link.bandId }))
    .filter((r) => r.status === "oberta" && link.concertIds.includes(r.concertId));
  const subs: Record<string, Record<string, ConfSubInfo>> = {};
  reqs.forEach((r) => {
    (subs[r.concertId] ||= {})[normalize(r.memberName)] = {
      requestId: r.id,
      token: r.token,
      applications: r.applications.map((a) => ({ name: a.name, status: a.status })),
    };
  });

  const confMembers: ConfMember[] = members.map((m) => {
    const email = (m.email || "").trim().toLowerCase();
    const linked = !!linkedByName[normalize(m.name)];
    return {
      name: m.name,
      instruments: m.instruments?.length ? m.instruments : String(m.role || "").split(/[,/]| i /i).map((s) => s.trim()).filter(Boolean),
      photoId: photosByName[normalize(m.name)] || "",
      linked,
      hasAccount: linked || (!!email && accountEmails.has(email)),
      isMe: !!myLink && normalize(m.name) === normalize(myLink.member_name),
    };
  });

  return (
    <ConfirmView
      token={token}
      single={link.single}
      allFuture={link.allFuture}
      band={{ name: band.name, logo: band.logo || "", logoAspect: band.logo_aspect || "1:1", color1: band.color1 || "", color2: band.color2 || "" }}
      concerts={concerts}
      diaBand={diaBand}
      members={confMembers}
      subs={subs}
      linkedNames={links.map((l) => l.member_name as string)}
      viewer={viewer}
      preselect={sel || ""}
    />
  );
}
