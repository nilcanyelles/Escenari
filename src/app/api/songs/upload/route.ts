import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBandAccess } from "@/lib/band-access";
import { getProfile } from "@/lib/current-user";
import { uploadFileBlob } from "@/lib/blob-storage";
import { checkTrackLimits } from "@/app/(app)/grup/songs-actions";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per fitxer

// Equivalent a uploadFileAction (songs-actions.ts) però com a ruta d'API en
// lloc de server action, perquè el client pugui fer-la servir amb XHR i
// llegir el progrés real de pujada (fetch/server actions no ho permeten).
// El binari va a Vercel Blob, no a Postgres. Serveix per a cançons d'un grup
// i per a les cançons pròpies d'un músic (sense grup: només el propietari).
export async function POST(req: Request) {
  const formData = await req.formData();
  const bandId = String(formData.get("bandId") || "") || null;
  const songId = String(formData.get("songId") || "") || null;
  const instrument = String(formData.get("instrument") || "");
  const file = formData.get("file") as File | null;
  if ((!bandId && !songId) || !file) return NextResponse.json({ ok: false, error: "Falta el fitxer" }, { status: 400 });

  let access: { workspaceId: string | null; who: string };
  try {
    if (bandId) {
      const a = await requireBandAccess(bandId, "songs");
      access = { workspaceId: a.workspaceId, who: a.profile.name };
    } else {
      const profile = await getProfile();
      if (!profile) throw new Error("Sessió no vàlida");
      const row = (await db().query("select band_id, owner_clerk_user_id from songs where id=$1", [songId])).rows[0];
      if (!row || row.band_id || row.owner_clerk_user_id !== profile.clerkUserId) throw new Error("Sense accés a aquesta cançó");
      access = { workspaceId: null, who: profile.name };
    }
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
    [id, access.workspaceId, bandId, songId, file.name || "fitxer", mime, file.size, access.who, instrument, blobUrl]
  );
  revalidatePath("/grup");
  if (bandId) revalidatePath("/material/" + bandId);
  revalidatePath("/artista/biblioteca");
  return NextResponse.json({ ok: true, id });
}
