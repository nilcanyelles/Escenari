// Elimina automàticament el fons d'una imatge si té un color de fons
// senzill i pla (com sol passar amb logos exportats sobre un color sòlid):
// mostreja les quatre cantonades i, si totes hi coincideixen (i són
// opaques), fa transparent tot el que s'hi assembli — amb una vora suau
// entre "transparent del tot" i "opac del tot" perquè no quedi un tall en
// sec a les vores del logo. Si les cantonades no s'assemblen prou (fons
// amb degradat, foto, ja transparent...), retorna el fitxer original sense
// tocar-hi.
export async function removeSimpleBackground(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const w = bitmap.width, h = bitmap.height;
    if (!w || !h) return file;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    const idxAt = (x: number, y: number) => (y * w + x) * 4;
    const corners = [idxAt(0, 0), idxAt(w - 1, 0), idxAt(0, h - 1), idxAt(w - 1, h - 1)];
    const [r0, g0, b0, a0] = [d[corners[0]], d[corners[0] + 1], d[corners[0] + 2], d[corners[0] + 3]];
    if (a0 < 250) return file; // ja és transparent per aquella cantonada
    const dist = (i: number) => Math.hypot(d[i] - r0, d[i + 1] - g0, d[i + 2] - b0);
    const consistent = corners.every((i) => d[i + 3] >= 250 && dist(i) < 18);
    if (!consistent) return file; // no sembla un fons pla senzill

    const TOL_IN = 26; // per sota, transparent del tot
    const TOL_OUT = 60; // per sobre, opac del tot (vora suau enmig)
    for (let i = 0; i < d.length; i += 4) {
      const dd = Math.hypot(d[i] - r0, d[i + 1] - g0, d[i + 2] - b0);
      if (dd <= TOL_IN) d[i + 3] = 0;
      else if (dd < TOL_OUT) d[i + 3] = Math.round(d[i + 3] * ((dd - TOL_IN) / (TOL_OUT - TOL_IN)));
    }
    ctx.putImageData(img, 0, 0);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return file;
    const outName = file.name.replace(/\.[a-zA-Z0-9]+$/, "") + ".png";
    return new File([blob], outName, { type: "image/png" });
  } catch {
    return file;
  }
}
