import { NextResponse } from "next/server";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import { db } from "@/lib/db";
import { requireBandAccess } from "@/lib/band-access";
import { getProfile } from "@/lib/current-user";
import { getFileBlob } from "@/lib/blob-storage";
import { normalizeInstrumentAcrossGroup } from "@/lib/tags";

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

// A4 = 595.28 x 841.89pt. L'A5 i l'A6 no s'imprimeixen en paper propi —
// s'imposen N per full de paper A4 (el que la impressora té), amb l'
// orientació del full triada perquè cada cel·la surti amb la mateixa
// orientació vertical que les partitures originals (sense haver-les de
// girar): A5 -> full A4 apaisat, 2 columnes; A6 -> full A4 vertical, 2x2.
const A4 = { w: 595.28, h: 841.89 };
const PAPER_LAYOUTS: Record<string, { sheetW: number; sheetH: number; cols: number; rows: number }> = {
  A4: { sheetW: A4.w, sheetH: A4.h, cols: 1, rows: 1 },
  A5: { sheetW: A4.h, sheetH: A4.w, cols: 2, rows: 1 },
  A6: { sheetW: A4.w, sheetH: A4.h, cols: 2, rows: 2 },
};
const GAP = 12; // marge entre cel·les i vora del full (pt) — aquí viuen les línies de tall.
const MARK_LEN = 9; // llargada de cada traç de tall, sempre més curt que GAP.

// Dibuixa una pàgina incrustada dins d'una cel·la, girant-la 90° si és
// apaisada perquè ocupi el màxim possible de la cel·la (que sempre és
// vertical) — tot en una sola crida de drawPage, en comptes d'incrustar-la
// dues vegades (un cop per redreçar-la i un altre per encaixar-la): fer-ho
// en dos passos creava un PDF amb un XObject dins d'un altre XObject que
// alguns lectors de PDF no sabien representar (sortien les pàgines en
// blanc, encara que el fitxer no estigués corromput).
function drawStraightened(
  cell: { x: number; y: number; w: number; h: number },
  ep: { width: number; height: number },
  draw: (opts: { x: number; y: number; xScale: number; yScale: number; rotate?: ReturnType<typeof degrees> }) => void
) {
  const landscape = ep.width > ep.height;
  const [effW, effH] = landscape ? [ep.height, ep.width] : [ep.width, ep.height];
  const scale = Math.min(cell.w / effW, cell.h / effH);
  const visualW = effW * scale, visualH = effH * scale;
  const boxX = cell.x + (cell.w - visualW) / 2, boxY = cell.y + (cell.h - visualH) / 2;
  if (landscape) {
    // Girada 90° CCW: l'àncora (x,y) cau a la cantonada inferior-dreta del
    // requadre visual (el contingut s'estén cap a l'esquerra i cap amunt).
    draw({ x: boxX + visualW, y: boxY, xScale: scale, yScale: scale, rotate: degrees(90) });
  } else {
    draw({ x: boxX, y: boxY, xScale: scale, yScale: scale });
  }
}

// Fusiona totes les pàgines (una per partitura) en l'aparença final triada:
// A4 és 1 pàgina per full, de la mateixa mida que la partitura un cop
// redreçada (sense requadre fix ni marges — ocupa tota la pàgina); A5/A6
// imposen N còpies reduïdes per full A4 fix, amb línies de tall curtes
// només al marge entre cel·les — mai travessant el full pel mig. Un sol
// pas d'incrustació (embedPdf) sobre el document ja fusionat, cap
// document intermedi — incrustar-lo dues vegades (un cop per redreçar-lo i
// un altre per imposar-lo) encadenava un XObject dins d'un altre que
// alguns lectors de PDF no sabien representar (pàgines en blanc).
async function renderFinalPdf(srcDoc: PDFDocument, srcPageCount: number, paperSize: "A4" | "A5" | "A6"): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  // embedPdf() només incorpora la pàgina 0 si no se li donen índexs
  // explícits — cal passar-los tots o es perden totes les partitures
  // menys la primera.
  const embedded = await out.embedPdf(srcDoc, Array.from({ length: srcPageCount }, (_, i) => i));

  if (paperSize === "A4") {
    for (const ep of embedded) {
      const landscape = ep.width > ep.height;
      const [w, h] = landscape ? [ep.height, ep.width] : [ep.width, ep.height];
      const page = out.addPage([w, h]);
      drawStraightened({ x: 0, y: 0, w, h }, ep, (opts) => page.drawPage(ep, opts));
    }
    return out.save();
  }

  const layout = PAPER_LAYOUTS[paperSize];
  const perSheet = layout.cols * layout.rows;
  const cellW = (layout.sheetW - GAP * (layout.cols + 1)) / layout.cols;
  const cellH = (layout.sheetH - GAP * (layout.rows + 1)) / layout.rows;

  for (let s = 0; s < embedded.length; s += perSheet) {
    const sheet = out.addPage([layout.sheetW, layout.sheetH]);
    for (let i = 0; i < perSheet && s + i < embedded.length; i++) {
      const col = i % layout.cols, row = Math.floor(i / layout.cols);
      const cellX = GAP + col * (cellW + GAP);
      const cellY = layout.sheetH - GAP - (row + 1) * cellH - row * GAP;
      const ep = embedded[s + i];
      drawStraightened({ x: cellX, y: cellY, w: cellW, h: cellH }, ep, (opts) => sheet.drawPage(ep, opts));
    }
    // Línies de tall verticals (entre columnes): un traç curt a dalt i un a
    // baix del full, mai pel mig — just al gruix del marge entre cel·les.
    for (let col = 1; col < layout.cols; col++) {
      const xCut = GAP + col * cellW + (col - 0.5) * GAP;
      sheet.drawLine({ start: { x: xCut, y: layout.sheetH }, end: { x: xCut, y: layout.sheetH - MARK_LEN }, thickness: 0.75, color: rgb(0, 0, 0) });
      sheet.drawLine({ start: { x: xCut, y: 0 }, end: { x: xCut, y: MARK_LEN }, thickness: 0.75, color: rgb(0, 0, 0) });
    }
    // Línies de tall horitzontals (entre files): un traç curt a cada vora
    // lateral, alineat amb el tall — igual, mai creuant el full sencer.
    for (let row = 1; row < layout.rows; row++) {
      const yCut = layout.sheetH - (GAP + row * cellH + (row - 0.5) * GAP);
      sheet.drawLine({ start: { x: 0, y: yCut }, end: { x: MARK_LEN, y: yCut }, thickness: 0.75, color: rgb(0, 0, 0) });
      sheet.drawLine({ start: { x: layout.sheetW, y: yCut }, end: { x: layout.sheetW - MARK_LEN, y: yCut }, thickness: 0.75, color: rgb(0, 0, 0) });
    }
    // Creueta al mig de cada cruïlla (p. ex. DIN A6, on les 4 cel·les es
    // toquen): just al forat del marge entre cel·les, mai sobre cap
    // partitura — ajuda a encertar el punt exacte on s'han de trobar els
    // dos talls.
    const CROSS_LEN = 3.5;
    for (let col = 1; col < layout.cols; col++) {
      const xCut = GAP + col * cellW + (col - 0.5) * GAP;
      for (let row = 1; row < layout.rows; row++) {
        const yCut = layout.sheetH - (GAP + row * cellH + (row - 0.5) * GAP);
        sheet.drawLine({ start: { x: xCut - CROSS_LEN, y: yCut }, end: { x: xCut + CROSS_LEN, y: yCut }, thickness: 0.75, color: rgb(0, 0, 0) });
        sheet.drawLine({ start: { x: xCut, y: yCut - CROSS_LEN }, end: { x: xCut, y: yCut + CROSS_LEN }, thickness: 0.75, color: rgb(0, 0, 0) });
      }
    }
  }
  return out.save();
}

// Fusiona, en un sol PDF per imprimir, les partitures (PDF o imatge) de les
// cançons i instruments triats al menú "Imprimeix partitures" d'una
// setlist — en POST perquè la llista d'ids pot ser llarga i perquè cal
// baixar-lo com a fitxer (formulari normal, no fetch), igual que el PDF
// d'un rider.
export async function POST(req: Request) {
  const form = await req.formData();
  const bandId = String(form.get("bandId") || "") || null;
  const name = String(form.get("name") || "Partitures").trim() || "Partitures";
  const paperSizeRaw = String(form.get("paperSize") || "A4");
  const paperSize: "A4" | "A5" | "A6" = paperSizeRaw === "A5" || paperSizeRaw === "A6" ? paperSizeRaw : "A4";
  let songIds: string[] = [];
  let instruments: string[] = [];
  try { songIds = JSON.parse(String(form.get("songIds") || "[]")); } catch { /* ignore */ }
  try { instruments = JSON.parse(String(form.get("instruments") || "[]")); } catch { /* ignore */ }
  if (!Array.isArray(songIds) || !songIds.length || !Array.isArray(instruments) || !instruments.length) {
    return new NextResponse("Falten dades", { status: 400 });
  }

  // Amb bandId: una setlist d'UN grup (com abans). Sense bandId: la
  // biblioteca d'un músic, que pot incloure cançons de grups diferents (i
  // de les seves pròpies, sense grup) — es comprova l'accés cançó per
  // cançó en comptes d'un sol grup.
  let callerClerkUserId: string | null = null;
  if (bandId) {
    try {
      await requireBandAccess(bandId);
    } catch {
      return new NextResponse("Sense accés a aquest grup", { status: 403 });
    }
  } else {
    const profile = await getProfile();
    if (!profile) return new NextResponse("Sessió no vàlida", { status: 403 });
    callerClerkUserId = profile.clerkUserId;
  }

  const instrumentSet = new Set(instruments);
  const { rows } = bandId
    ? await db().query(
        `select f.id, f.song_id, f.mime, f.instrument, f.blob_url
         from files f join songs s on s.id = f.song_id
         where s.band_id = $1 and f.song_id = any($2) and f.mime not like 'audio/%'
         order by f.created_at`,
        [bandId, songIds]
      )
    : await db().query(
        `select f.id, f.song_id, f.mime, f.instrument, f.blob_url
         from files f join songs s on s.id = f.song_id
         where f.song_id = any($1) and f.mime not like 'audio/%'
           and (
             s.band_id in (select band_id from band_members where clerk_user_id = $2)
             or (s.band_id is null and s.owner_clerk_user_id = $2)
           )
         order by f.created_at`,
        [songIds, callerClerkUserId]
      );
  // Mateixa normalització que al menú: un instrument sense número en una
  // cançó compta com la primera instància si en alguna altra cançó de la
  // selecció sí que ve numerat — si no ho fem aquí també, el servidor
  // rebutjaria fitxers que el client ha comptat com a seleccionats.
  const effectiveInstrument = normalizeInstrumentAcrossGroup(rows, (r) => r.instrument || "Totes les veus");
  const bySong: Record<string, typeof rows> = {};
  rows.forEach((r) => { (bySong[r.song_id] = bySong[r.song_id] || []).push(r); });

  const doc = await PDFDocument.create();
  let pageCount = 0;
  // En l'ordre de la setlist (songIds ja arriba ordenat des del client).
  for (const songId of songIds) {
    const files = (bySong[songId] || []).filter((f) => instrumentSet.has(effectiveInstrument.get(f) || "Totes les veus"));
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
  const bytes = await renderFinalPdf(doc, pageCount, paperSize);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
