import type { SocialLinks, SocialPlatform, SocialStats, SocialTracking } from "./types";
import { MONTH_ABBR, pad2 } from "./format";

// Helpers de xarxes socials que es poden fer servir tant al servidor com al
// client (sense base de dades ni claus): metadades de cada plataforma i el
// càlcul de l'evolució mensual a partir de les instantànies diàries.

// Instantània diària de les xifres d'un grup (una fila per dia).
export type SocialSnapshot = { takenOn: string; stats: SocialStats };

export const SOCIAL_PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "spotify", "youtube"];

export type SocialMetric = { key: keyof SocialStats; label: string; short: string };

// Per a cada xarxa: nom, colors de marca i quines xifres se'n guarden.
export const PLATFORM_META: Record<SocialPlatform, { label: string; color: string; gradient: string; metrics: SocialMetric[] }> = {
  instagram: {
    label: "Instagram", color: "#e1306c",
    gradient: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
    metrics: [{ key: "instagramFollowers", label: "Seguidors", short: "seguidors" }],
  },
  tiktok: {
    label: "TikTok", color: "#25f4ee",
    gradient: "linear-gradient(135deg,#25F4EE,#00111a 55%,#FE2C55)",
    metrics: [{ key: "tiktokFollowers", label: "Seguidors", short: "seguidors" }],
  },
  spotify: {
    label: "Spotify", color: "#1DB954", gradient: "#1DB954",
    metrics: [
      { key: "spotifyFollowers", label: "Seguidors", short: "seguidors" },
      { key: "spotifyMonthlyListeners", label: "Oients mensuals", short: "oients/mes" },
    ],
  },
  youtube: {
    label: "YouTube", color: "#FF0000", gradient: "#FF0000",
    metrics: [
      { key: "youtubeSubscribers", label: "Subscriptors", short: "subscriptors" },
      { key: "youtubeViews", label: "Visites totals", short: "visites" },
    ],
  },
};

export const SOCIAL_STAT_KEYS: (keyof SocialStats)[] = SOCIAL_PLATFORMS.flatMap((p) => PLATFORM_META[p].metrics.map((m) => m.key));

// Xifra "de seguidors" de cada xarxa (la que se suma al total d'Inici).
export const FOLLOWERS_KEY: Record<SocialPlatform, keyof SocialStats> = {
  instagram: "instagramFollowers",
  tiktok: "tiktokFollowers",
  spotify: "spotifyFollowers",
  youtube: "youtubeSubscribers",
};

// Es fa seguiment d'una xarxa si el gestor ho ha marcat explícitament; si
// no ha dit res, de les que tinguin enllaç (o compte connectat).
export function isTracked(platform: SocialPlatform, tracking?: SocialTracking | null, links?: SocialLinks | null, connected = false): boolean {
  const explicit = tracking?.[platform];
  if (explicit !== undefined) return explicit;
  return !!links?.[platform] || connected;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ca-ES").format(n);
}

// 1234 → "1,2 k", 1 250 000 → "1,3 M" (per a etiquetes curtes de gràfic).
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(abs % 1e6 === 0 ? 0 : 1).replace(".", ",") + " M";
  if (abs >= 1e4) return Math.round(n / 1e3) + " k";
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(".", ",").replace(",0", "") + " k";
  return String(n);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1);
}

export function monthLabel(ym: string): string {
  return MONTH_ABBR[Number(ym.slice(5, 7)) - 1] || ym;
}

// Els últims `count` mesos (acabant en el mes d'avui), com a "aaaa-mm".
export function lastMonths(today: string, count: number): string[] {
  const cur = today.slice(0, 7);
  return Array.from({ length: count }, (_, i) => shiftMonth(cur, i - (count - 1)));
}

// Valor d'una xifra al final de cada mes (l'última instantània del mes);
// null als mesos sense cap instantània amb aquella xifra.
export function monthlySeries(snapshots: SocialSnapshot[], key: keyof SocialStats, months: string[]): (number | null)[] {
  const byMonth: Record<string, number> = {};
  snapshots
    .slice()
    .sort((a, b) => a.takenOn.localeCompare(b.takenOn))
    .forEach((s) => {
      const v = s.stats[key];
      if (v != null) byMonth[s.takenOn.slice(0, 7)] = v;
    });
  return months.map((m) => (byMonth[m] != null ? byMonth[m] : null));
}

// Valor de referència del mes passat (l'última instantània anterior al mes
// d'avui), per al "+123 des del mes passat".
export function previousMonthValue(snapshots: SocialSnapshot[], key: keyof SocialStats, today: string): number | null {
  const firstOfMonth = today.slice(0, 7) + "-01";
  let best: SocialSnapshot | null = null;
  snapshots.forEach((s) => {
    if (s.takenOn >= firstOfMonth || s.stats[key] == null) return;
    if (!best || s.takenOn > best.takenOn) best = s;
  });
  if (!best) return null;
  const v = (best as SocialSnapshot).stats[key];
  return v == null ? null : v;
}

// Actualitza (o crea) la instantània d'avui en una llista local — perquè els
// gràfics reflecteixin a l'instant una xifra que s'acaba de canviar a mà.
export function upsertTodaySnapshot(snapshots: SocialSnapshot[], today: string, stats: SocialStats): SocialSnapshot[] {
  const rest = snapshots.filter((s) => s.takenOn !== today);
  return rest.concat([{ takenOn: today, stats }]).sort((a, b) => a.takenOn.localeCompare(b.takenOn));
}
