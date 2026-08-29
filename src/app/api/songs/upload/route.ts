import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBandAccess } from "@/lib/band-access";
import { uploadFileBlob } from "@/lib/blob-storage";
import { checkTrackLimits } from "@/app/(app)/grup/songs-actions";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per fitxer

// Equivalent a uploadFileAction (songs-actions.ts) però com a ruta d'API en
// lloc de server action, perquè el client pugui fer-la servir amb XHR i
// llegir el progrés real de pujada (fetch/server actions no ho permeten).
// El binari va a Vercel Blob, no a Postgres.
export async function POST(req: Request) {
  const formData = await req.formData();
  const bandId = String(formData.get("bandId") || "");
  const songId = String(formData.get("songId") || "") || null;
  const instrument = String(formData.get("instrument") || "");
  const file = formData.get("file") as File | null;
  if (!bandId || !file) return NextResponse.json({ ok: false, error: "Falta el fitxer" }, { status: 400 });

  let access;
  try {
    access = await requireBandAccess(bandId, "songs");
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "No autoritzat" }, { status: 403 });
  }

  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "Màxim 100 MB per fitxer" }, { status: 400 });

  const mime = file.type || "application/octet-stream";
  if (mime.startsWith("audio")) {
    const limitError = await checkTrackLimits(bandId, songId);
    if (limitError) return NextResponse.json({ ok: false, error: limitError }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const id = "fl" + Date.now() + Math.floor(Math.random() * 1000);
  const blobUrl = await uploadFileBlob("files/" + id, buf, mime);
  await db().query(
    `insert into files (id, workspace_id, band_id, song_id, name, mime, size, data, uploaded_by, instrument, blob_url)
     values ($1,$2,$3,$4,$5,$6,$7,null,$8,$9,$10)`,
    [id, access.workspaceId, bandId, songId, file.name || "fitxer", mime, file.size, access.profile.name, instrument, blobUrl]
  );
  revalidatePath("/grup");
  revalidatePath("/material/" + bandId);
  return NextResponse.json({ ok: true, id });
}
