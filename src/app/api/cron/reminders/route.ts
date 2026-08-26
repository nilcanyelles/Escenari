import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// Recordatoris automàtics: correu als músics vinculats el dia abans de cada
// bolo confirmat. Pensat per executar-se un cop al dia (cron de Vercel).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("No autoritzat", { status: 401 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ ok: false, reason: "RESEND_API_KEY no configurada" });
  }

  const { rows } = await db().query(
    `select c.id, c.date, c.time, c.venue, c.city, c.band_name, p.email, p.name
     from concerts c
     join band_members bm on bm.band_id = c.band_id
     join profiles p on p.clerk_user_id = bm.clerk_user_id
     where c.status='confirmat' and c.date = current_date + 1 and p.email <> ''`
  );

  let sent = 0;
  for (const r of rows) {
    const res = await sendEmail({
      to: r.email,
      subject: `Demà: ${r.band_name}${r.city ? " a " + r.city : ""}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #12101f; color: #f5f4fa; padding: 28px; border-radius: 16px;">
          <div style="letter-spacing: 4px; font-size: 12px; color: #a99df5; margin-bottom: 18px;">ESCENARI</div>
          <h2 style="margin: 0 0 6px; font-size: 18px;">Demà tens bolo amb ${r.band_name}</h2>
          <p style="color: #b9b5cc; margin: 0;">${r.time ? r.time + "h · " : ""}${[r.venue, r.city].filter(Boolean).join(", ")}</p>
        </div>`,
    });
    if (res.ok) sent++;
  }
  return NextResponse.json({ ok: true, sent, candidates: rows.length });
}
