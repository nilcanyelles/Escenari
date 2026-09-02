import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBandAccess } from "@/lib/band-access";
import { uploadFileBlob } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 40 * 1024 * 1024; // 40 MB per document

// Puja un document (normalment un PDF) per adjuntar-lo tal qual, com a
// pàgines pròpies, al PDF final del rider — pestanya "Annexos".
export async function POST(req: Request) {
  const formData = await req.formData();
  const bandId = String(formData.get("bandId") || "");
  const file = formData.get("file") as File | null;
  if (!bandId || !file) return NextResponse.json({ ok: false, error: "Falta el fitxer" }, { status: 400 });

  let access;
  try {
    access = await requireBandAccess(bandId, "riders");
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "No autoritzat" }, { status: 403 });
  }

  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "Màxim 40 MB" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  const blobUrl = await uploadFileBlob("files/" + id, buf, mime);
  await db().query(
    `insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, blob_url)
     values ($1,$2,$3,null,$4,$5,$6,null,$7,$8)`,
    [id, access.workspaceId, bandId, file.name || "document", mime, file.size, access.profile.name, blobUrl]
  );
  return NextResponse.json({ ok: true, id, url: `/api/file/${id}`, name: file.name || "document", mime });
}
