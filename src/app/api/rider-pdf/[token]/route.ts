import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/lib/db";
import { normalizeRiderContent, type RiderContent } from "@/lib/material-types";
import { getFileBlob } from "@/lib/blob-storage";

export const dynamic = "force-dynamic";

// Genera el PDF complet d'un rider (via el seu token públic) fent servir
// pdf-lib en comptes del print-to-PDF del navegador — l'única manera
// d'incorporar tal qual, com a pàgines pròpies, els documents penjats a la
// pestanya "Annexos" (que window.print() no pot fusionar amb la resta).
// pdf-lib només admet WinAnsi als tipus de lletra estàndard: fora d'aquest
// rang (emojis, etc.) es substitueix per "?" en comptes de rebentar.
function safe(s: string): string {
  return (s || "").replace(/[^\x00-\xFF]/g, "?");
}

const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;

class Writer {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc; this.font = font; this.bold = bold;
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }
  ensure(h: number) {
    if (this.y - h < MARGIN) { this.page = this.doc.addPage([PAGE_W, PAGE_H]); this.y = PAGE_H - MARGIN; }
  }
  text(s: string, opts: { size?: number; font?: PDFFont; color?: [number, number, number]; gap?: number } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? this.font;
    const color = opts.color ?? [0.1, 0.09, 0.14];
    const words = safe(s).split(/\s+/).filter(Boolean);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const trial = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(trial, size) > CONTENT_W && line) { lines.push(line); line = w; }
      else line = trial;
    }
    if (line) lines.push(line);
    if (!lines.length) lines.push("");
    for (const l of lines) {
      this.ensure(size + 4);
      this.y -= size;
      this.page.drawText(l, { x: MARGIN, y: this.y, size, font, color: rgb(...color) });
      this.y -= 4;
    }
    this.y -= opts.gap ?? 0;
  }
  heading(s: string) {
    this.ensure(26);
    this.y -= 4;
    this.text(safe(s).toUpperCase(), { size: 11.5, font: this.bold, color: [0.35, 0.3, 0.55], gap: 6 });
  }
  rule() {
    this.ensure(10);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + CONTENT_W, y: this.y }, thickness: 0.6, color: rgb(0.85, 0.84, 0.9) });
    this.y -= 12;
  }
  table(headers: string[], widths: number[], rows: string[][]) {
    this.ensure(20);
    let x = MARGIN;
    headers.forEach((h, i) => { this.page.drawText(safe(h).toUpperCase(), { x, y: this.y - 9, size: 8, font: this.bold, color: rgb(0.55, 0.52, 0.65) }); x += widths[i]; });
    this.y -= 16;
    this.rule();
    for (const row of rows) {
      const cellLines = row.map((cell, i) => wrapText(safe(cell), this.font, 9, widths[i] - 8));
      const rowLines = Math.max(1, ...cellLines.map((l) => l.length));
      this.ensure(rowLines * 12 + 6);
      let cx = MARGIN;
      row.forEach((_, i) => {
        cellLines[i].forEach((l, li) => {
          this.page.drawText(l, { x: cx, y: this.y - 9 - li * 12, size: 9, font: this.font, color: rgb(0.15, 0.14, 0.2) });
        });
        cx += widths[i];
      });
      this.y -= rowLines * 12 + 8;
    }
    this.y -= 6;
  }
}

function wrapText(s: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const trial = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(trial, size) > maxW && line) { lines.push(line); line = w; }
    else line = trial;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function fetchBlobBytes(blobUrl: string): Promise<Uint8Array | null> {
  const res = await getFileBlob(blobUrl);
  if (!res || !res.stream) return null;
  const buf = await new Response(res.stream as unknown as ReadableStream).arrayBuffer();
  return new Uint8Array(buf);
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Per defecte s'obre inline (previsualització a la mateixa pestanya);
  // amb ?dl=1 força la baixada com a fitxer (botó "Descarrega en PDF").
  const forceDownload = new URL(req.url).searchParams.get("dl") === "1";
  const row = (await db().query(
    `select r.*, b.name as band_name, b.city, b.contact, b.phone
     from riders r join bands b on b.id = r.band_id where r.public_token=$1`,
    [token]
  )).rows[0];
  if (!row) return new NextResponse("No trobat", { status: 404 });

  const rider: RiderContent = normalizeRiderContent(row.content);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);

  // Capçalera
  w.text(safe(row.band_name || ""), { size: 10, font: bold, color: [0.55, 0.5, 0.85], gap: 2 });
  w.text(safe(row.name || "Rider"), { size: 19, font: bold, gap: 2 });
  const meta = [row.city, row.contact, row.phone].filter(Boolean).join("  ·  ");
  if (meta) w.text(meta, { size: 9.5, color: [0.5, 0.48, 0.55], gap: 10 });
  w.rule();

  if (rider.intro && rider.intro.trim()) w.text(rider.intro, { gap: 12 });

  if (rider.contacts.some((c) => c.name.trim())) {
    w.heading("Contactes");
    w.table(["Càrrec", "Nom", "Telèfon", "Correu"], [110, 150, 100, 145],
      rider.contacts.filter((c) => c.name.trim()).map((c) => [c.role, c.name, c.phone, c.email]));
  }

  if (rider.stage.items.length > 0) {
    w.heading(`Escenari — ${rider.stage.widthM} m × ${rider.stage.depthM} m`);
    w.text(rider.stage.items.map((it) => it.label).filter(Boolean).join("  ·  "), { gap: 12 });
  }

  if (rider.inputs.some((i) => i.source.trim())) {
    w.heading("Llista d'entrades");
    w.table(["Ch", "Font", "Micro / DI", "Peu", "Notes"], [30, 130, 110, 90, 145],
      rider.inputs.filter((i) => i.source.trim()).map((i) => [i.ch, i.source, i.mic, i.stand, i.notes]));
  }

  if (rider.monitors.length > 0) {
    w.heading("Monitoratge");
    w.table(["Per a qui", "Tipus", "Mescla / notes"], [150, 110, 245],
      rider.monitors.map((m) => [m.who, m.kind, m.notes]));
  }

  if (rider.backline.length > 0) {
    w.heading("Backline");
    w.table(["Element", "Qui el porta", "Notes"], [180, 120, 205],
      rider.backline.map((b) => [b.item, b.providedBy === "grup" ? "El grup" : "Organització", b.notes]));
  }

  const fixedTitles: Record<string, string> = { audio: "Àudio", lighting: "Llums", power: "Corrent elèctric", hospitality: "Hospitalitat" };
  const fixedValues: Record<string, string> = { audio: rider.audio, lighting: rider.lighting, power: rider.power, hospitality: rider.hospitality };
  for (const key of rider.detailsOrder) {
    if (key.startsWith("cf:")) {
      const f = rider.customFields.find((x) => "cf:" + x.id === key);
      if (!f || !f.body || !f.body.trim()) continue;
      w.heading(f.title || "Camp");
      w.text(f.body, { gap: 12 });
    } else {
      const v = fixedValues[key];
      if (!v || !v.trim()) continue;
      w.heading(fixedTitles[key]);
      w.text(v, { gap: 12 });
    }
  }
  if (rider.notes && rider.notes.trim()) { w.heading("Altres notes"); w.text(rider.notes, { gap: 12 }); }

  // Annexos: pàgines de text pròpies, o documents penjats fusionats tal
  // qual (les seves pàgines originals s'incorporen sense retocar).
  for (let pi = 0; pi < rider.pages.length; pi++) {
    const pg = rider.pages[pi];
    const isLast = pi === rider.pages.length - 1;
    if (pg.fileUrl) {
      const m = /\/api\/file\/([^/?#]+)/.exec(pg.fileUrl);
      const fileId = m ? m[1] : null;
      if (!fileId) continue;
      const meta = (await db().query("select blob_url, mime from files where id=$1", [fileId])).rows[0];
      if (!meta || !meta.blob_url) continue;
      try {
        const bytes = await fetchBlobBytes(meta.blob_url);
        if (!bytes) continue;
        const srcDoc = await PDFDocument.load(bytes);
        const copied = await doc.copyPages(srcDoc, srcDoc.getPageIndices());
        copied.forEach((p) => doc.addPage(p));
        // Qualsevol text que vingui després ha d'anar en una pàgina nova,
        // no reprendre l'anterior (que ja no és l'última del document).
        if (!isLast) { w.page = doc.addPage([PAGE_W, PAGE_H]); w.y = PAGE_H - MARGIN; }
      } catch {
        // Document il·legible com a PDF: se salta en comptes de trencar
        // la resta de la descàrrega.
        w.heading(pg.title || "Document adjunt");
        w.text("(No s'ha pogut incorporar aquest document.)", { color: [0.6, 0.3, 0.3], gap: 12 });
      }
    } else if (pg.title.trim() || pg.body.trim()) {
      w.heading(pg.title || "Pàgina");
      w.text(pg.body, { gap: 12 });
    }
  }

  const bytes = await doc.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${forceDownload ? "attachment" : "inline"}; filename="${encodeURIComponent((row.name || "rider") + ".pdf")}"`,
      "Cache-Control": "no-store",
    },
  });
}
