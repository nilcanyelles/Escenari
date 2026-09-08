import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadFileBlob } from "@/lib/blob-storage";
import { validShareLink } from "@/lib/share-link";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 40 * 1024 * 1024; // 40 MB per document

// Puja un document des del formulari públic de regidor (sense sessió) —
// validat per l'enllaç compartit en comptes de requireBandAccess, com fa
// /api/rider-annex/upload per als gestors. Ara mateix només el fa servir
// el contrarider de "Detalls tècnics" (vegeu TecnicItem.counterFile*).
export async function POST(req: Request) {
  const formData = await req.formData();
  const token = String(formData.get("token") || "");
  const file = formData.get("file") as File | null;
  if (!token || !file) return NextResponse.json({ ok: false, error: "Falta el fitxer" }, { status: 400 });

  const link = await validShareLink(token);
  if (!link) return NextResponse.json({ ok: false, error: "Aquest enllaç ja no és vàlid." }, { status: 403 });

  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "Màxim 40 MB" }, { status: 400 });

  const concert = (await db().query("select band_id from concerts where id=$1 and workspace_id=$2", [link.concert_id, link.workspace_id])).rows[0];
  if (!concert) return NextResponse.json({ ok: false, error: "Concert no trobat" }, { status: 404 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  const blobUrl = await uploadFileBlob("files/" + id, buf, mime);
  await db().query(
    `insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, blob_url)
     values ($1,$2,$3,null,$4,$5,$6,null,$7,$8)`,
    [id, link.workspace_id, concert.band_id, file.name || "document", mime, file.size, "Regidor (formulari públic)", blobUrl]
  );
  return NextResponse.json({ ok: true, id, url: `/api/file/${id}`, name: file.name || "document", mime });
}
