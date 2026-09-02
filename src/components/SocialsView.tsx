"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Band, SocialLinks, SocialPlatform, SocialStats, SocialTracking } from "@/lib/types";
import {
  SOCIAL_PLATFORMS, PLATFORM_META, isTracked, formatNumber, formatCompact, lastMonths, monthlySeries, monthLabel,
  previousMonthValue, upsertTodaySnapshot, type SocialSnapshot,
} from "@/lib/social-history";
import { saveSocialSettingsAction, saveManualSocialStatsAction, refreshBandSocialsAction, disconnectSocialAccountAction } from "@/app/(app)/grup/social-actions";
import { InstagramIcon, YoutubeIcon, TiktokIcon, SpotifyIcon } from "@/components/SocialIcons";
import PlanLock from "@/components/PlanLock";
import type { BillingInfo } from "@/lib/plans";

// Pàgina de xarxes socials del grup: per a cada plataforma, l'enllaç, la
// connexió (automàtica o a mà), si se'n fa seguiment i les xifres; a sota,
// l'evolució mes a mes de cada xifra amb seguiment.

export type ConnectedAccount = { platform: string; username: string; connectedAt: string; expiresAt: string | null };
export type SocialConfigured = Record<SocialPlatform, boolean>;
export type SocialNotice = { connected: string; error: string; platform: string; detail: string };

const ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: <InstagramIcon />, tiktok: <TiktokIcon />, spotify: <SpotifyIcon />, youtube: <YoutubeIcon />,
};

const LINK_PLACEHOLDER: Record<SocialPlatform, string> = {
  instagram: "https://instagram.com/elgrup",
  tiktok: "https://tiktok.com/@elgrup",
  spotify: "https://open.spotify.com/artist/…",
  youtube: "https://youtube.com/@elgrup",
};

function labelOf(p: string): string {
  return (PLATFORM_META as Record<string, { label: string } | undefined>)[p]?.label || p;
}

// "+123 (+2,1 %) des del mes passat"
function Delta({ current, prev }: { current: number | undefined; prev: number | null }) {
  if (current == null || prev == null) return <span className="sx-delta">Sense referència del mes passat</span>;
  const d = current - prev;
  if (d === 0) return <span className="sx-delta">Igual que el mes passat</span>;
  const pct = prev ? Math.round((d / prev) * 1000) / 10 : null;
  const sign = d > 0 ? "+" : "−";
  return (
    <span className={"sx-delta " + (d > 0 ? "up" : "down")}>
      {sign}{formatNumber(Math.abs(d))}{pct != null ? ` (${sign}${String(Math.abs(pct)).replace(".", ",")} %)` : ""} des del mes passat
    </span>
  );
}

// Línia d'evolució mensual (SVG propi, com la resta de gràfics de l'app):
// un punt per mes, buit als mesos sense instantània.
function TrendChart({ months, values, color }: { months: string[]; values: (number | null)[]; color: string }) {
  const W = 340, H = 120, L = 6, R = 6, T = 12, B = 22;
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) {
    return <div className="sx-chart-empty">Encara no hi ha prou història: les xifres es guarden cada dia, i aquí es veurà com evolucionen mes a mes.</div>;
  }
  const realMin = Math.min(...valid), realMax = Math.max(...valid);
  let min = realMin, max = realMax;
  if (min === max) { min -= 1; max += 1; } else { const pad = (max - min) * 0.12; min -= pad; max += pad; }
  const n = values.length;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, n - 1);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    d += (pen ? " L" : " M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
    pen = true;
  });
  const lastIdx = values.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  return (
    <svg className="sx-chart-svg" viewBox={`0 0 ${W} ${H}`} role="img">
      <line x1={L} x2={W - R} y1={y(realMax)} y2={y(realMax)} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 4" />
      <line x1={L} x2={W - R} y1={y(realMin)} y2={y(realMin)} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="3 4" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => v == null ? null : (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === lastIdx ? 4 : 2.6} fill={i === lastIdx ? color : "var(--bg-card-2)"} stroke={color} strokeWidth="1.8">
          <title>{monthLabel(months[i])} {months[i].slice(0, 4)}: {formatNumber(v)}</title>
        </circle>
      ))}
      {months.map((m, i) => (
        <text key={m} x={x(i)} y={H - 6} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.6">{monthLabel(m)}</text>
      ))}
      <text x={W - R} y={y(realMax) - 3} fontSize="9" textAnchor="end" fill="currentColor" fillOpacity="0.55">{formatCompact(realMax)}</text>
      <text x={W - R} y={y(realMin) + 10} fontSize="9" textAnchor="end" fill="currentColor" fillOpacity="0.55">{formatCompact(realMin)}</text>
    </svg>
  );
}

// Estat de la connexió de cada xarxa: què es llegeix sol, què cal fer perquè
// es llegeixi sol, o per què s'ha d'escriure a mà.
function ConnectionStatus({ p, link, account, configured, bandId, onDisconnect, disconnecting }: {
  p: SocialPlatform;
  link: string;
  account: ConnectedAccount | undefined;
  configured: boolean;
  bandId: string;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  if (p === "youtube") {
    if (!link) return <div className="sx-status dim">Enganxa l&apos;enllaç del canal per llegir-ne subscriptors i visites sols.</div>;
    if (!configured) return <div className="sx-status warn">Falta YOUTUBE_API_KEY al servidor: les xifres s&apos;escriuen a mà.</div>;
    return <div className="sx-status ok">Lectura automàtica amb l&apos;API de YouTube — sense iniciar sessió enlloc.</div>;
  }
  if (p === "spotify") {
    if (!link) return <div className="sx-status dim">Enganxa l&apos;enllaç de l&apos;artista per llegir-ne seguidors i oients mensuals sols.</div>;
    return (
      <div className={"sx-status " + (configured ? "ok" : "warn")}>
        {configured
          ? "Seguidors via l'API de Spotify; oients mensuals llegits de la pàgina pública de l'artista."
          : "Oients mensuals llegits de la pàgina pública de l'artista; per als seguidors falten SPOTIFY_CLIENT_ID/SECRET al servidor."}
      </div>
    );
  }
  const label = PLATFORM_META[p].label;
  if (account) {
    return (
      <div className="sx-status ok">
        <span>Connectat{account.username ? ` com @${account.username}` : ""} · els seguidors es refresquen cada dia.</span>
        <button type="button" className="link-btn" disabled={disconnecting} onClick={onDisconnect}>{disconnecting ? "Desconnectant…" : "Desconnecta"}</button>
      </div>
    );
  }
  if (configured) {
    return (
      <div className="sx-status dim">
        <a className="btn-save sx-connect" href={`/api/social/${p}/connect?bandId=${encodeURIComponent(bandId)}`}>{ICONS[p]} Connecta amb {label}</a>
        <span>{p === "instagram" ? "Cal un compte professional (Business o Creator) — inicia-hi sessió amb el compte del grup." : "Inicia sessió amb el compte de TikTok del grup."}</span>
      </div>
    );
  }
  return (
    <div className="sx-status warn">
      {label} només dona els seguidors amb el compte connectat, i per això cal una app a{" "}
      {p === "instagram" ? "Meta for Developers (INSTAGRAM_APP_ID i INSTAGRAM_APP_SECRET al servidor)" : "TikTok for Developers (TIKTOK_CLIENT_KEY i TIKTOK_CLIENT_SECRET al servidor)"}.
      Mentrestant, escriu-los a mà.
    </div>
  );
}

export default function SocialsView({ band, accounts, snapshots: initialSnapshots, configured, notice, today, billing, canUpgrade = true }: {
  band: Band;
  accounts: ConnectedAccount[];
  snapshots: SocialSnapshot[];
  configured: SocialConfigured;
  notice: SocialNotice;
  today: string;
  billing?: BillingInfo;
  canUpgrade?: boolean;
}) {
  const historyLocked = !!billing && !billing.caps.socialHistory;
  const router = useRouter();
  const [links, setLinks] = useState<SocialLinks>(band.socialLinks || {});
  const [tracking, setTracking] = useState<SocialTracking>(band.socialTracking || {});
  const [stats, setStats] = useState<SocialStats>(band.socialStats || {});
  const statsRef = useRef<SocialStats>(band.socialStats || {});
  const [snapshots, setSnapshots] = useState<SocialSnapshot[]>(initialSnapshots);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{ updated: SocialPlatform[]; errors: Partial<Record<SocialPlatform, string>>; general?: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Enllaços i seguiment: es desen sols amb un petit marge després de
  // l'últim canvi.
  const settingsFirst = useRef(true);
  const settingsTimer = useRef<number | null>(null);
  useEffect(() => {
    if (settingsFirst.current) { settingsFirst.current = false; return; }
    if (settingsTimer.current) window.clearTimeout(settingsTimer.current);
    settingsTimer.current = window.setTimeout(async () => {
      setSavingSettings(true);
      await saveSocialSettingsAction(band.id, { socialLinks: links, tracking });
      setSavingSettings(false);
      router.refresh();
    }, 700);
    return () => { if (settingsTimer.current) window.clearTimeout(settingsTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, tracking]);

  // Xifres escrites a mà: igual, agrupant els canvis pendents; la
  // instantània d'avui s'actualitza en local perquè el gràfic ho reflecteixi
  // de seguida.
  const manualQueue = useRef<Partial<SocialStats>>({});
  const manualTimer = useRef<number | null>(null);
  function setManual(key: keyof SocialStats, value: number | undefined) {
    const next: SocialStats = { ...statsRef.current, [key]: value };
    if (value == null) delete next[key];
    statsRef.current = next;
    setStats(next);
    setSnapshots((prev) => upsertTodaySnapshot(prev, today, next));
    manualQueue.current[key] = value;
    if (manualTimer.current) window.clearTimeout(manualTimer.current);
    manualTimer.current = window.setTimeout(async () => {
      const patch = manualQueue.current;
      manualQueue.current = {};
      await saveManualSocialStatsAction(band.id, patch);
      router.refresh();
    }, 700);
  }

  async function refresh(silent: boolean) {
    setRefreshing(true);
    try {
      const res = await refreshBandSocialsAction(band.id);
      statsRef.current = res.stats;
      setStats(res.stats);
      setSnapshots(res.snapshots);
      if (!silent) setResult({ updated: res.updated, errors: res.errors });
    } catch (e) {
      if (!silent) setResult({ updated: [], errors: {}, general: e instanceof Error ? e.message : String(e) });
    }
    setRefreshing(false);
  }
  // Es refresca sola en obrir la pàgina (una vegada per grup, en silenci).
  const autoRefreshed = useRef<string | null>(null);
  useEffect(() => {
    if (autoRefreshed.current === band.id) return;
    autoRefreshed.current = band.id;
    refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band.id]);

  async function disconnect(p: SocialPlatform) {
    if (!confirm(`Desconnectar ${PLATFORM_META[p].label}? Les xifres es quedaran com estan, però ja no s'actualitzaran soles.`)) return;
    setDisconnecting(p);
    await disconnectSocialAccountAction(band.id, p);
    router.refresh();
    setDisconnecting(null);
  }

  const months = lastMonths(today, 12);
  const accountFor = (p: SocialPlatform) => accounts.find((a) => a.platform === p);
  const tracked = SOCIAL_PLATFORMS.filter((p) => isTracked(p, tracking, links, !!accountFor(p)));

  // Quines xifres es llegeixen soles (les altres s'escriuen a mà; totes es
  // poden retocar, però les automàtiques es sobreescriuen al refresc).
  function isAuto(p: SocialPlatform, key: keyof SocialStats): boolean {
    if (p === "youtube") return !!links.youtube && configured.youtube;
    if (p === "spotify") return !!links.spotify && (key === "spotifyMonthlyListeners" || configured.spotify);
    return !!accountFor(p);
  }

  const noticeText = (() => {
    if (notice.connected) return { kind: "ok", text: `${labelOf(notice.connected)} connectat: els seguidors ja es llegiran sols cada dia.` };
    if (!notice.error) return null;
    const label = labelOf(notice.platform);
    switch (notice.error) {
      case "config": return { kind: "err", text: `Falten les claus de ${label} al servidor (.env.local) — mentrestant, escriu les xifres a mà.` };
      case "denegat": return { kind: "err", text: `S'ha cancel·lat la connexió amb ${label}.` };
      case "estat": return { kind: "err", text: "La connexió ha caducat abans d'acabar — torna-ho a provar." };
      case "intercanvi": return { kind: "err", text: `No s'ha pogut completar la connexió amb ${label}${notice.detail ? `: ${notice.detail}` : "."}` };
      default: return { kind: "err", text: "No s'ha pogut fer la connexió." };
    }
  })();
  const resultErrors = result ? (Object.entries(result.errors) as [SocialPlatform, string][]) : [];

  return (
    <div className="sx">
      <div className="sx-top">
        <Link href="/grup" className="cd-back">← {band.name}</Link>
        <h1 className="sx-title">Xarxes socials</h1>
        <div className="spacer"></div>
        <span className="t-dim" style={{ fontSize: 12 }}>
          {savingSettings ? "Desant…" : refreshing ? "Actualitzant…" : "Les xifres es refresquen soles cada dia"}
        </span>
        <button type="button" className="btn-outline" disabled={refreshing} onClick={() => refresh(false)}>Actualitza ara</button>
      </div>

      {noticeText && <div className={"sx-notice " + noticeText.kind}>{noticeText.text}</div>}
      {result && (result.general || resultErrors.length > 0 || result.updated.length > 0) && (
        <div className={"sx-notice " + (resultErrors.length || result.general ? "err" : "ok")}>
          {result.updated.length > 0 && <div>Actualitzat: {result.updated.map((p) => PLATFORM_META[p].label).join(", ")}.</div>}
          {result.general && <div>{result.general}</div>}
          {resultErrors.map(([p, msg]) => <div key={p}>{PLATFORM_META[p].label}: {msg}</div>)}
        </div>
      )}

      <div className="sx-platforms">
        {SOCIAL_PLATFORMS.map((p) => {
          const meta = PLATFORM_META[p];
          const acc = accountFor(p);
          const on = tracked.includes(p);
          return (
            <div key={p} className={"sx-card" + (on ? "" : " off")}>
              <div className="sx-card-head">
                <span className="sx-badge" style={{ background: meta.gradient }}>{ICONS[p]}</span>
                <span className="sx-name">{meta.label}</span>
                <button
                  type="button" className={"sx-track" + (on ? " on" : "")}
                  title="Amb seguiment, surt a Inici, a la pàgina pública i als gràfics"
                  onClick={() => setTracking((t) => ({ ...t, [p]: !on }))}
                >{on ? "✓ Seguiment actiu" : "Sense seguiment"}</button>
              </div>
              <input
                className="field-input compact-field" type="url" placeholder={LINK_PLACEHOLDER[p]}
                value={links[p] || ""} onChange={(e) => setLinks((l) => ({ ...l, [p]: e.target.value }))}
              />
              <ConnectionStatus
                p={p} link={links[p] || ""} account={acc} configured={configured[p]} bandId={band.id}
                onDisconnect={() => disconnect(p)} disconnecting={disconnecting === p}
              />
              <div className="sx-metrics">
                {meta.metrics.map((m) => (
                  <div key={m.key} className="sx-metric">
                    <span className="sx-metric-l">{m.label}{isAuto(p, m.key) && <span className="sx-auto">auto</span>}</span>
                    <input
                      className="field-input compact-field" type="number" min={0} placeholder="—"
                      value={stats[m.key] ?? ""}
                      onChange={(e) => setManual(m.key, e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                    <Delta current={stats[m.key]} prev={previousMonthValue(snapshots, m.key, today)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div className="panel-header-row">
          <div>
            <div className="panel-title">Evolució mes a mes</div>
            <div className="t-dim" style={{ fontSize: 12.5 }}>
              Últims 12 mesos, amb l&apos;última xifra guardada de cada mes. Només de les xarxes amb seguiment actiu.
            </div>
          </div>
        </div>
        {historyLocked && billing ? (
          <PlanLock billing={billing} feature="socialHistory" canUpgrade={canUpgrade} title="Evolució mes a mes de seguidors i oients" description="Les xifres es guarden cada dia igualment; els gràfics i el “+123 des del mes passat” són del pla Grup." />
        ) : tracked.length === 0 ? (
          <div className="t-dim" style={{ fontSize: 13 }}>Activa el seguiment d&apos;alguna xarxa per veure&apos;n l&apos;evolució.</div>
        ) : (
          <div className="sx-charts">
            {tracked.flatMap((p) => PLATFORM_META[p].metrics.map((m) => (
              <div key={m.key} className="sx-chart">
                <div className="sx-chart-head">
                  <span className="sx-chart-title">
                    <i className="sx-dot" style={{ background: PLATFORM_META[p].gradient }}></i>
                    {PLATFORM_META[p].label} · {m.label.toLowerCase()}
                  </span>
                  <span className="sx-chart-n">{stats[m.key] != null ? formatNumber(stats[m.key] as number) : "—"}</span>
                </div>
                <TrendChart months={months} values={monthlySeries(snapshots, m.key, months)} color={PLATFORM_META[p].color} />
              </div>
            )))}
          </div>
        )}
      </div>
    </div>
  );
}
