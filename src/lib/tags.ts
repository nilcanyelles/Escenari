export function uniqueTags(items: { tags?: string[] }[]): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  items.forEach((it) => {
    (it.tags || []).forEach((t) => {
      if (t && !seen[t]) { seen[t] = true; out.push(t); }
    });
  });
  return out.sort();
}

export const TAG_PRESETS = ["Rock", "Pop", "Indie", "Electrònica", "Jazz", "Flamenc/Rumba", "Hip-hop", "Folk/Tradicional"];

export const TAG_HUE: Record<string, number> = {
  "Rock": 290, "Pop": 340, "Indie": 250, "Electrònica": 200, "Jazz": 170, "Flamenc/Rumba": 25, "Hip-hop": 60, "Folk/Tradicional": 110,
};

export function tagColors(tag: string): { color: string; bg: string } {
  const h = TAG_HUE.hasOwnProperty(tag) ? TAG_HUE[tag] : 290;
  return { color: `oklch(0.72 0.14 ${h})`, bg: `oklch(0.72 0.14 ${h} / 0.16)` };
}

const TAG_ICON_PATHS: Record<string, string> = {
  "Rock": '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
  "Pop": '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="18" x2="12" y2="22"></line><line x1="8" y1="22" x2="16" y2="22"></line>',
  "Indie": '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
  "Electrònica": '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>',
  "Jazz": '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle>',
  "Flamenc/Rumba": '<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>',
  "Hip-hop": '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>',
  "Folk/Tradicional": '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle>',
};

function bandInitials(name: string): string {
  const words = String(name || "").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function xmlEscape(str: string): string {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch] as string));
}

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  // Mesclador d'avalanxa (estil Murmur3) perquè cadenes similars com "b1"/"b2" acabin ben repartides.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return Math.abs(h);
}

// Cada grup té un color propi (derivat del seu id), independent del gènere/etiqueta.
export function bandColorHue(id: string): number {
  return hashStr(id) % 360;
}

export function bandColor(id: string): { color: string; bg: string } {
  const h = bandColorHue(id);
  return { color: `oklch(0.72 0.14 ${h})`, bg: `oklch(0.72 0.14 ${h} / 0.16)` };
}

export function bandPhotoDataUri(b: { id: string; name: string; tags?: string[] }): string {
  const primaryTag = (b.tags && b.tags[0]) || "";
  const h = bandColorHue(b.id);
  const icon = TAG_ICON_PATHS.hasOwnProperty(primaryTag) ? TAG_ICON_PATHS[primaryTag] : TAG_ICON_PATHS["Rock"];
  const h2 = (h + 35 + (hashStr(b.id + "x") % 25)) % 360;
  const svg = (
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${h},55%,38%)"/>` +
    `<stop offset="1" stop-color="hsl(${h2},50%,20%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="300" height="300" fill="url(#g)"/>` +
    `<g transform="translate(150,150)" opacity="0.18">` +
    `<g transform="translate(-70,-70) scale(5.8)" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">${icon}</g>` +
    `</g>` +
    `<text x="150" y="168" font-family="Space Grotesk,Arial,sans-serif" font-size="72" font-weight="700" fill="white" fill-opacity="0.92" text-anchor="middle">${xmlEscape(bandInitials(b.name))}</text>` +
    `</svg>`
  );
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
