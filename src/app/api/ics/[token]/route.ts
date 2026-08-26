import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function icsEscape(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Subscripció iCalendar del workspace (Google Calendar, Apple Calendar...).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ws = (await db().query("select id from workspaces where ics_token=$1", [token])).rows[0];
  if (!ws) return new NextResponse("Not found", { status: 404 });

  const { rows } = await db().query(
    `select id, date, time, venue, city, festa_entitat, band_name, status, kind
     from concerts where workspace_id=$1 and status <> 'cancel·lat' order by date`,
    [ws.id]
  );

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Escenari//CA",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Escenari",
  ];
  const kindLabel: Record<string, string> = { bolo: "", assaig: "Assaig — ", reunio: "Reunió — ", altre: "" };
  for (const c of rows) {
    const dateStr = (typeof c.date === "string" ? c.date : c.date.toISOString()).slice(0, 10).replace(/-/g, "");
    const timeStr = /^\d{2}:\d{2}/.test(c.time || "") ? c.time.slice(0, 5).replace(":", "") + "00" : "210000";
    const title = `${kindLabel[c.kind] ?? ""}${c.band_name || "Escenari"}${c.city ? " · " + c.city : ""}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${c.id}@escenari`,
      `DTSTART:${dateStr}T${timeStr}`,
      `SUMMARY:${icsEscape(title)}${c.status === "pendent" ? " (pendent)" : ""}`,
      `LOCATION:${icsEscape([c.venue, c.city].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${icsEscape(c.festa_entitat || "")}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="escenari.ics"',
    },
  });
}
