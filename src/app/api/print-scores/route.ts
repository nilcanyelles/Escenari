import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { db } from "@/lib/db";
import { requireBandAccess } from "@/lib/band-access";
import { getFileBlob } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";

async function fetchBlobBytes(blobUrl: string): Promise<Uint8Array | null> {
  const res = await getFileBlob(blobUrl);
  if (!res || !res.stream) return null;
  const buf = await new Response(res.stream as unknown as ReadableStream).arrayBuffer();
  return new Uint8Array(buf);
}

// Mida màxima d'una pàgina (punts, 72/polzada) per a una partitura
// escanejada com a imatge — es redueix a aquesta mida sense perdre
// proporció, mai s'amplia (si ja és petita es queda tal qual).
const MAX_W = 595, MAX_H = 842;

// Fusiona, en un sol PDF per imprimir, les partitures (PDF o imatge) de les
// cançons i instruments triats al menú "Imprimeix partitures" d'una
// setlist — en POST perquè la llista d'ids pot ser llarga i perquè cal
// baixar-lo com a fitxer (formulari normal, no fetch), igual que el PDF
// d'un rider.
export async function POST(req: Request) {
  const form = await req.formData();
  const bandId = String(form.get("bandId") || "");
  const name = String(form.get("name") || "Partitures").trim() || "Partitures";
  let songIds: string[] = [];
  let instruments: string[] = [];
  try { songIds = JSON.parse(String(form.get("songIds") || "[]")); } catch { /* ignore */ }
  try { instruments = JSON.parse(String(form.get("instruments") || "[]")); } catch { /* ignore */ }
  if (!bandId || !Array.isArray(songIds) || !songIds.length || !Array.isArray(instruments) || !instruments.length) {
    return new NextResponse("Falten dades", { status: 400 });
  }

  try {
    await requireBandAccess(bandId);
  } catch {
    return new NextResponse("Sense accés a aquest grup", { status: 403 });
  }

  const instrumentSet = new Set(instruments);
  const { rows } = await db().query(
    `select f.id, f.song_id, f.mime, f.instrument, f.blob_url
     from files f join songs s on s.id = f.song_id
     where s.band_id = $1 and f.song_id = any($2) and f.mime not like 'audio/%'
     order by f.created_at`,
    [bandId, songIds]
  );
  const bySong: Record<string, typeof rows> = {};
  rows.forEach((r) => { (bySong[r.song_id] = bySong[r.song_id] || []).push(r); });

  const doc = await PDFDocument.create();
  let pageCount = 0;
  // En l'ordre de la setlist (songIds ja arriba ordenat des del client).
  for (const songId of songIds) {
    const files = (bySong[songId] || []).filter((f) => instrumentSet.has(f.instrument || "Totes les veus"));
    for (const f of files) {
      if (!f.blob_url) continue;
      const bytes = await fetchBlobBytes(f.blob_url);
      if (!bytes) continue;
      try {
        if (f.mime === "application/pdf") {
          const src = await PDFDocument.load(bytes);
          const copied = await doc.copyPages(src, src.getPageIndices());
          copied.forEach((p) => { doc.addPage(p); pageCount++; });
        } else if (f.mime === "image/jpeg" || f.mime === "image/jpg" || f.mime === "image/png") {
          const img = f.mime === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
          const w = img.width * scale, h = img.height * scale;
          const page = doc.addPage([w, h]);
          page.drawImage(img, { x: 0, y: 0, width: w, height: h });
          pageCount++;
        }
        // Altres tipus (p. ex. documents de text): no es poden incorporar a
        // un PDF — se salten en comptes de trencar la resta de la baixada.
      } catch {
        // Fitxer il·legible (corrupte, format inesperat): se salta.
      }
    }
  }

  if (pageCount === 0) {
    return new NextResponse("Cap de les partitures triades s'ha pogut incorporar al PDF.", { status: 404 });
  }

  // Inline (no "attachment"): s'obre com a previsualització a la pestanya
  // nova, igual que "Obre / PDF" a les setlists i riders — la baixada de
  // veritat la fa l'usuari des del propi visor de PDF del navegador.
  const bytes = await doc.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
