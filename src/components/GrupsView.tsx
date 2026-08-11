"use client";

import { useState } from "react";
import type { Band } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { uniqueTags, tagColors, bandPhotoDataUri } from "@/lib/tags";
import BandModal from "@/components/BandModal";

export default function GrupsView({ bands, historyByBand }: { bands: Band[]; historyByBand: Record<string, number> }) {
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [openBandId, setOpenBandId] = useState<string | null>(null);

  const tagFilterSet: Record<string, boolean> = {};
  tagFilter.forEach((t) => { tagFilterSet[t] = true; });
  const list = bands.filter((b) => !tagFilter.length || (b.tags || []).some((t) => tagFilterSet[t]));
  const allTags = uniqueTags(bands);
  const tagFilterLabel = tagFilter.length === 0 ? "Totes les etiquetes" : tagFilter.length === 1 ? tagFilter[0] : tagFilter.length + " etiquetes";

  const openBand = openBandId ? bands.find((b) => b.id === openBandId) || null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="filter-bar">
        <div className="year-select-wrap">
          <button className="pill active" onClick={() => setTagFilterOpen((v) => !v)}>{tagFilterLabel} ▾</button>
          {tagFilterOpen && (
            <>
              <div className="year-picker-overlay" onClick={() => setTagFilterOpen(false)}></div>
              <div className="year-dropdown band-dropdown" onClick={(e) => e.stopPropagation()}>
                <button className={"year-option" + (tagFilter.length === 0 ? " active" : "")} onClick={() => setTagFilter([])}>
                  <span className="band-check">{tagFilter.length === 0 ? "✓" : ""}</span>Totes les etiquetes
                </button>
                <div className="year-option-divider"></div>
                {allTags.map((t) => {
                  const checked = !!tagFilterSet[t];
                  return (
                    <button key={t} className={"year-option" + (checked ? " active" : "")}
                      onClick={() => setTagFilter((prev) => checked ? prev.filter((x) => x !== t) : prev.concat([t]))}>
                      <span className="band-check">{checked ? "✓" : ""}</span>{t}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {list.length ? (
        <div className="band-grid">
          {list.map((b) => (
            <div key={b.id} className="band-card" onClick={() => setOpenBandId(b.id)}>
              <img className="band-photo" src={bandPhotoDataUri(b)} alt={b.name} />
              <div className="band-card-top">
                <div className="band-name">{b.name}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {(b.tags || []).map((t) => {
                    const tc = tagColors(t);
                    return <span key={t} className="badge" style={{ background: tc.bg, color: tc.color }}>{t}</span>;
                  })}
                </div>
              </div>
              <div className="band-meta">{b.city} · {b.members.length} integrants</div>
              <div className="band-foot">
                <span className="band-foot-label">{historyByBand[b.id] || 0} actuacions</span>
                <span className="t-strong">{formatCurrency(b.rate)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">Cap grup coincideix amb els filtres.</div>
      )}

      {openBand && <BandModal key={openBand.id} band={openBand} onClose={() => setOpenBandId(null)} />}
    </div>
  );
}
