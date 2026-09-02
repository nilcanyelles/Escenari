import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refreshBandSocialStats } from "@/lib/social-sync";

export const dynamic = "force-dynamic";

// Cada dia: refresca les xifres de xarxes de tots els grups que en tinguin
// (enllaços, comptes connectats o xifres manuals) i en guarda la instantània
// diària — d'aquí surt l'evolució mes a mes. Pensat per al cron de Vercel.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("No autoritzat", { status: 401 });
  }
  const { rows } = await db().query(
    `select b.id from bands b
     where coalesce(b.social_links, '{}'::jsonb) <> '{}'::jsonb
        or coalesce(b.social_stats, '{}'::jsonb) <> '{}'::jsonb
        or exists (select 1 from band_social_accounts a where a.band_id = b.id)`
  );
  let refreshed = 0, failed = 0;
  for (const r of rows) {
    try {
      await refreshBandSocialStats(r.id);
      refreshed++;
    } catch {
      failed++;
    }
  }
  return NextResponse.json({ ok: true, refreshed, failed, candidates: rows.length });
}
