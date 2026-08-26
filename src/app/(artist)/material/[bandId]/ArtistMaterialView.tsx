"use client";

import { useState } from "react";
import Link from "next/link";
import type { Band } from "@/lib/types";
import type { Rider, Setlist } from "@/lib/material-types";
import { RidersPanel, SetlistsPanel } from "@/components/MaterialPanels";

export default function ArtistMaterialView({ band, riders, setlists, canRiders, canSetlists }: {
  band: Band;
  riders: Rider[];
  setlists: Setlist[];
  canRiders: boolean;
  canSetlists: boolean;
}) {
  const [tab, setTab] = useState<"riders" | "setlists">("riders");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="artist-section-title" style={{ margin: 0 }}>{band.name} — material</div>
        <Link href="/els-meus-grups" className="cd-back">← Els meus grups</Link>
      </div>
      <div className="stats-tabs" style={{ alignSelf: "flex-start" }}>
        <button className={"stats-tab" + (tab === "riders" ? " active" : "")} onClick={() => setTab("riders")}>Riders</button>
        <button className={"stats-tab" + (tab === "setlists" ? " active" : "")} onClick={() => setTab("setlists")}>Setlists</button>
      </div>
      {!canRiders && !canSetlists && (
        <div className="t-dim" style={{ fontSize: 13 }}>
          Pots consultar i compartir el material del grup. Per editar-lo, demana accés al gestor.
        </div>
      )}
      {tab === "riders" && (
        <RidersPanel band={band} riders={riders} linkedMembers={[]} editors={[]} canEdit={canRiders} isManager={false} />
      )}
      {tab === "setlists" && (
        <SetlistsPanel band={band} setlists={setlists} linkedMembers={[]} editors={[]} canEdit={canSetlists} isManager={false} />
      )}
    </div>
  );
}
