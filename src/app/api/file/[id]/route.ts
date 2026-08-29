import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/current-user";
import { getFileBlob } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";

// Serveix un fitxer del magatzem: el gestor del workspace o un membre del
// grup. Excepció pública: les fotos de perfil de músic (les referencia un
// person_profiles, que és una pàgina compartible).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Primer només les metadades (sense "data"): decidir si l'accés és
  // permès no ha de costar arrossegar tot el fitxer (que pot pesar molts
  // MB) — abans es feia amb un "select *" i una petició no autoritzada
  // igualment baixava el blob sencer de la base de dades.
  const meta = (await db().query(
    "select workspace_id, band_id, name, mime, size, blob_url from files where id=$1", [id]
  )).rows[0];
  if (!meta) return new NextResponse("No trobat", { status: 404 });

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
    let allowed = profile.role === "manager" && profile.workspaceId === meta.workspace_id;
    if (!allowed && meta.band_id) {
      const member = (await db().query(
        "select 1 from band_members where band_id=$1 and clerk_user_id=$2", [meta.band_id, profile.clerkUserId]
      )).rows[0];
      allowed = !!member;
    }
    if (!allowed) return new NextResponse("No autoritzat", { status: 403 });
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": meta.mime || "application/octet-stream",
    "Content-Disposition": `inline; filename="${encodeURIComponent(meta.name)}"`,
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  };
  const range = req.headers.get("range");

  // Fitxers nous: viuen a Vercel Blob (privat), no a Postgres — es
  // proxegen des d'aquí (el client mai veu la URL del blob directament),
  // reenviant el "Range" si n'hi ha perquè el navegador pugui llegir només
  // un tros (durada d'un àudio, seeking...) sense baixar-ho tot.
  if (meta.blob_url) {
    const res = await getFileBlob(meta.blob_url, range);
    if (!res || !res.stream) return new NextResponse("No trobat", { status: 404 });
    const status = res.headers.get("content-range") ? 206 : 200;
    return new NextResponse(res.stream, {
      status,
      headers: {
        ...baseHeaders,
        ...(res.headers.get("content-range") ? { "Content-Range": res.headers.get("content-range")! } : {}),
        "Content-Length": res.headers.get("content-length") || String(meta.size),
      },
    });
  }

  // Fitxers antics, encara no migrats: bytea a Postgres (via substring()
  // per als "Range" per no arrossegar-ho tot a Node cada cop).
  const total: number = meta.size;
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m) {
    let start = m[1] ? parseInt(m[1], 10) : 0;
    let end = m[2] ? parseInt(m[2], 10) : total - 1;
    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end >= total) end = total - 1;
    if (start > end) start = 0;
    const len = end - start + 1;
    const r = await db().query(
      "select substring(data from $2::int for $3::int) as chunk from files where id=$1",
      [id, start + 1, len]
    );
    const chunk: Buffer = r.rows[0].chunk;
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: { ...baseHeaders, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(chunk.length) },
    });
  }

  const r = await db().query("select data from files where id=$1", [id]);
  const data: Buffer = r.rows[0].data;
  return new NextResponse(new Uint8Array(data), {
    headers: { ...baseHeaders, "Content-Length": String(total) },
  });
}
