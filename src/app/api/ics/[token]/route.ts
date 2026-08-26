import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function icsEscape(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

type IcsRow = { id: string; date: Date | string; time: string; venue: string; city: string; festa_entitat: string; band_name: string; status: string; kind: string };

function buildIcs(rows: IcsRow[], calName: string): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Escenari//CA",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ];
  const kindLabel: Record<string, string> = { bolo: "", assaig: "Assaig — ", reunio: "Reunió — ", altre: "" };
  for (const c of rows) {
    const dateStr = (typeof c.date === "string" ? c.date : c.date.toISOString()).slice(0, 10).replace(/-/g, "");
    const timeStr = /^\d{2}:\d{2}/.test(c.time || "") ? c.time.slice(0, 5).replace(":", "") + "00" : "210000";
    const title = `${kindLabel[c.kind] ?? ""}${c.band_name || "Escenari"}${c.city ? " · " + c.city : ""}`;
    const suffix = c.status === "pendent" ? " (pendent)" : c.status === "reservat" ? " (reservat)" : "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${c.id}@escenari`,
      `DTSTART:${dateStr}T${timeStr}`,
      `SUMMARY:${icsEscape(title)}${suffix}`,
      `LOCATION:${icsEscape([c.venue, c.city].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${icsEscape(c.festa_entitat || "")}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// Subscripció iCalendar. Dos tipus de token:
//  - ics_… (workspace): tots els esdeveniments del gestor, amb ?band=<id> opcional
//  - u_…   (personal): els bolos dels grups on toca aquesta persona
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(req.url);

  if (token.startsWith("u_")) {
    const profile = (await db().query("select clerk_user_id, name from profiles where feed_token=$1", [token])).rows[0];
    if (!profile) return new NextResponse("Not found", { status: 404 });
    const { rows } = await db().query(
      `select c.id, c.date, c.time, c.venue, c.city, c.festa_entitat, c.band_name, c.status, c.kind
       from concerts c
       join band_members bm on bm.band_id = c.band_id and bm.clerk_user_id = $1
       where c.status <> 'cancel·lat' order by c.date`,
      [profile.clerk_user_id]
    );
    return icsResponse(buildIcs(rows, `Bolos de ${profile.name || "Escenari"}`));
  }

  const ws = (await db().query("select id from workspaces where ics_token=$1", [token])).rows[0];
  if (!ws) return new NextResponse("Not found", { status: 404 });
  const bandId = url.searchParams.get("band");
  const params2: unknown[] = [ws.id];
  let cond = "workspace_id=$1 and status <> 'cancel·lat'";
  if (bandId) { params2.push(bandId); cond += " and band_id=$2"; }
  const { rows } = await db().query(
    `select id, date, time, venue, city, festa_entitat, band_name, status, kind
     from concerts where ${cond} order by date`,
    params2
  );
  return icsResponse(buildIcs(rows, "Escenari"));
}

function icsResponse(body: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="escenari.ics"',
    },
  });
}
