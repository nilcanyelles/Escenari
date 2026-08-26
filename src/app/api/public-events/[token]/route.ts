import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Feed JSON públic de bolos confirmats (per incrustar al web del grup).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ws = (await db().query("select id from workspaces where ics_token=$1", [token])).rows[0];
  if (!ws) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { rows } = await db().query(
    `select date, time, venue, city, festa_entitat, band_name
     from concerts
     where workspace_id=$1 and status='confirmat' and kind='bolo' and date >= current_date
     order by date limit 100`,
    [ws.id]
  );
  return NextResponse.json({
    events: rows.map((c) => ({
      date: (typeof c.date === "string" ? c.date : c.date.toISOString()).slice(0, 10),
      time: c.time,
      venue: c.venue,
      city: c.city,
      event: c.festa_entitat,
      band: c.band_name,
    })),
  }, { headers: { "Access-Control-Allow-Origin": "*" } });
}
