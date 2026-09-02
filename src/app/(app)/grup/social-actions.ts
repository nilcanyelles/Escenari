"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireManagerAction } from "@/lib/current-user";
import type { SocialLinks, SocialPlatform, SocialStats, SocialTracking } from "@/lib/types";
import { deleteSocialAccount, getSocialSnapshots, refreshBandSocialStats, saveSocialSnapshot, type RefreshResult } from "@/lib/social-sync";
import type { SocialSnapshot } from "@/lib/social-history";

// Accions de la pàgina de xarxes socials del grup (Grup → Inici → Xarxes).

async function ownBand(bandId: string): Promise<string> {
  const { workspaceId } = await requireManagerAction();
  const owns = (await db().query("select 1 from bands where id=$1 and workspace_id=$2", [bandId, workspaceId])).rows[0];
  if (!owns) throw new Error("Grup no trobat");
  return workspaceId;
}

// Enllaços de cada xarxa i de quines es fa seguiment.
export async function saveSocialSettingsAction(bandId: string, input: { socialLinks: SocialLinks; tracking: SocialTracking }) {
  await ownBand(bandId);
  const links: SocialLinks = {};
  (Object.keys(input.socialLinks || {}) as (keyof SocialLinks)[]).forEach((k) => {
    const v = (input.socialLinks[k] || "").trim();
    if (v) links[k] = v;
  });
  await db().query(
    "update bands set social_links=$1, social_tracking=$2 where id=$3",
    [JSON.stringify(links), JSON.stringify(input.tracking || {}), bandId]
  );
  revalidatePath("/grup");
  revalidatePath("/grup/xarxes");
}

// Xifres escrites a mà (les que cap API no dona): es fusionen amb les que
// ja hi ha i deixen instantània d'avui, com les automàtiques.
export async function saveManualSocialStatsAction(bandId: string, patch: Partial<SocialStats>): Promise<SocialStats> {
  await ownBand(bandId);
  const row = (await db().query("select social_stats from bands where id=$1", [bandId])).rows[0];
  const next: SocialStats = { ...(row?.social_stats || {}) };
  (Object.keys(patch) as (keyof SocialStats)[]).forEach((k) => {
    const v = patch[k];
    if (v == null || Number.isNaN(v)) delete next[k];
    else next[k] = Math.max(0, Math.round(v));
  });
  await db().query("update bands set social_stats=$1 where id=$2", [JSON.stringify(next), bandId]);
  await saveSocialSnapshot(bandId, next);
  revalidatePath("/grup");
  revalidatePath("/grup/xarxes");
  return next;
}

export async function refreshBandSocialsAction(bandId: string): Promise<RefreshResult & { snapshots: SocialSnapshot[] }> {
  await ownBand(bandId);
  const res = await refreshBandSocialStats(bandId);
  const snapshots = await getSocialSnapshots(bandId, 13);
  revalidatePath("/grup");
  return { ...res, snapshots };
}

export async function disconnectSocialAccountAction(bandId: string, platform: SocialPlatform) {
  await ownBand(bandId);
  if (platform !== "instagram" && platform !== "tiktok") return;
  await deleteSocialAccount(bandId, platform);
  revalidatePath("/grup");
  revalidatePath("/grup/xarxes");
}
