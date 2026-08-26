import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";

export const dynamic = "force-dynamic";

// Serveix un fitxer del magatzem: el gestor del workspace o un membre del
// grup. Excepció pública: les fotos de perfil de músic (les referencia un
// person_profiles, que és una pàgina compartible).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const row = (await db().query("select * from files where id=$1", [id])).rows[0];
  if (!row) return new NextResponse("No trobat", { status: 404 });

  // Imatges públiques per disseny: fotos de perfil de músic i logos/portades
  // de grup (surten a pàgines compartibles).
  const isPublicImage = (await db().query(
    `select 1 from person_profiles where photo_file_id=$1
     union all
     select 1 from bands where logo=$2 or cover_url=$2
     limit 1`,
    [id, `/api/file/${id}`]
  )).rows.length > 0;

  if (!isPublicImage) {
    const profile = await getProfile();
    if (!profile) return new NextResponse("No autoritzat", { status: 401 });
    let allowed = profile.role === "manager" && profile.workspaceId === row.workspace_id;
    if (!allowed && row.band_id) {
      const member = (await db().query(
        "select 1 from band_members where band_id=$1 and clerk_user_id=$2", [row.band_id, profile.clerkUserId]
      )).rows[0];
      allowed = !!member;
    }
    if (!allowed) return new NextResponse("No autoritzat", { status: 403 });
  }

  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
