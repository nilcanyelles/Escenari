"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Band, SocialLinks, SocialPlatform, SocialStats, SocialTracking } from "@/lib/types";
import {
  SOCIAL_PLATFORMS, PLATFORM_META, isTracked, formatNumber, formatCompact, lastMonths, monthlySeries, monthLabel,
  previousMonthValue, upsertTodaySnapshot, type SocialSnapshot,
} from "@/lib/social-history";
import { saveSocialSettingsAction, saveManualSocialStatsAction, refreshBandSocialsAction } from "@/app/(app)/grup/social-actions";
import { InstagramIcon, YoutubeIcon, TiktokIcon, SpotifyIcon } from "@/components/SocialIcons";

// Pàgina de xarxes socials del grup: per a cada plataforma, l'enllaç, si
// se'n fa seguiment i les xifres (llegides soles de la pàgina pública de
// l'enllaç, mai amb cap clau d'API ni compte connectat); a sota, l'evolució
// mes a mes de cada xifra amb seguiment.

const ICONS: Record<SocialPlatform, React.ReactNode> = {
  instagram: <InstagramIcon />, tiktok: <TiktokIcon />, spotify: <SpotifyIcon />, youtube: <YoutubeIcon />,
};

const LINK_PLACEHOLDER: Record<SocialPlatform, string> = {
  instagram: "https://instagram.com/elgrup",
  tiktok: "https://tiktok.com/@elgrup",
  spotify: "https://open.spotify.com/artist/…",
  youtube: "https://youtube.com/@elgrup",
};

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

// Estat de la connexió de cada xarxa: totes funcionen igual (es visita
// l'enllaç desat i es llegeix la xifra directament de la pàgina pública,
// sense cap clau d'API ni compte connectat) — només canvia el missatge
// segons quines xifres en dona cadascuna.
function ConnectionStatus({ p, link }: { p: SocialPlatform; link: string }) {
  // Instagram bloqueja massa sovint la lectura automàtica (vegeu
  // fetchInstagramFollowers) — mentre no hi hagi una solució fiable, es
  // deixa clar que aquesta xarxa és manual de moment, en comptes de dir
  // "lectura automàtica" i que després no es refresqui mai de veres.
  if (p === "instagram") {
    return (
      <div className="sx-status warn">
        Estem treballant per automatitzar el comptador de seguidors. De moment, afegeix-los manualment.
      </div>
    );
  }
  if (!link) {
    const what = p === "youtube" ? "subscriptors i visites" : p === "spotify" ? "oients mensuals" : "seguidors";
    return <div className="sx-status dim">Enganxa l&apos;enllaç per llegir-ne {what} sols.</div>;
  }
  return <div className="sx-status ok">Lectura automàtica des de la pàgina pública de l&apos;enllaç — sense iniciar sessió enlloc.</div>;
}

export default function SocialsView({ band, snapshots: initialSnapshots, today }: {
  band: Band;
  snapshots: SocialSnapshot[];
  today: string;
}) {
  const router = useRouter();
  const [links, setLinks] = useState<SocialLinks>(band.socialLinks || {});
  const [tracking, setTracking] = useState<SocialTracking>(band.socialTracking || {});
  const [stats, setStats] = useState<SocialStats>(band.socialStats || {});
  const statsRef = useRef<SocialStats>(band.socialStats || {});
  const [snapshots, setSnapshots] = useState<SocialSnapshot[]>(initialSnapshots);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{ updated: SocialPlatform[]; errors: Partial<Record<SocialPlatform, string>>; general?: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

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

  const months = lastMonths(today, 12);
  const tracked = SOCIAL_PLATFORMS.filter((p) => isTracked(p, tracking, links));

  // Totes les xifres d'una xarxa amb enllaç es llegeixen soles de la seva
  // pàgina pública; sense enllaç, s'escriuen a mà.
  function isAuto(p: SocialPlatform): boolean {
    return !!links[p];
  }

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
              <ConnectionStatus p={p} link={links[p] || ""} />
              <div className="sx-metrics">
                {meta.metrics.map((m) => (
                  <div key={m.key} className="sx-metric">
                    <span className="sx-metric-l">
                      {m.label}
                      {p === "instagram" ? <span className="sx-manual-badge">manual</span> : isAuto(p) && <span className="sx-auto">auto</span>}
                    </span>
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
        {tracked.length === 0 ? (
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
