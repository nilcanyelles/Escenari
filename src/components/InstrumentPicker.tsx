"use client";

import { useMemo, useState } from "react";
import { INSTRUMENT_CATEGORIES, InstrumentSvg, instrumentIconKey } from "@/lib/instruments";

// Selector d'instruments: cerca en viu, agrupat per família, selecció múltiple
// amb un clic. Els que no són al catàleg es poden afegir com a text lliure.
export default function InstrumentPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const selectedLower = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const categories = useMemo(() => {
    if (!q) return INSTRUMENT_CATEGORIES;
    return INSTRUMENT_CATEGORIES.map((c) => ({
      name: c.name,
      items: c.items.filter((i) => i.name.toLowerCase().includes(q)),
    })).filter((c) => c.items.length > 0);
  }, [q]);

  const exactMatch = useMemo(
    () => INSTRUMENT_CATEGORIES.some((c) => c.items.some((i) => i.name.toLowerCase() === q)),
    [q]
  );

  function toggle(name: string) {
    if (selectedLower.has(name.toLowerCase())) {
      onChange(value.filter((v) => v.toLowerCase() !== name.toLowerCase()));
    } else {
      onChange([...value, name]);
    }
  }

  function addCustom() {
    const custom = query.trim();
    if (!custom || selectedLower.has(custom.toLowerCase())) return;
    onChange([...value, custom]);
    setQuery("");
  }

  return (
    <div className="instr-picker">
      {value.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 8 }}>
          {value.map((inst) => (
            <span className="instrument-chip" key={inst}>
              <InstrumentSvg icon={instrumentIconKey(inst)} />
              {inst}
              <button type="button" onClick={() => toggle(inst)} aria-label={`Treu ${inst}`}>✕</button>
            </span>
          ))}
        </div>
      )}
      <input
        className="field-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const first = categories[0]?.items[0];
            if (first && exactMatch) toggle(first.name);
            else if (first && categories.length === 1 && categories[0].items.length === 1) toggle(first.name);
            else if (!first) addCustom();
          }
        }}
        placeholder="Cerca un instrument…"
      />
      <div className="instr-panel">
        {categories.map((c) => (
          <div key={c.name}>
            <div className="instr-cat-title">{c.name}</div>
            <div className="instr-grid">
              {c.items.map((i) => {
                const active = selectedLower.has(i.name.toLowerCase());
                return (
                  <button
                    key={i.name}
                    type="button"
                    className={"instr-pill" + (active ? " active" : "")}
                    onClick={() => toggle(i.name)}
                  >
                    <InstrumentSvg icon={i.icon} />
                    {i.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <button type="button" className="btn-ghost-sm" onClick={addCustom}>
            + Afegeix «{query.trim()}»
          </button>
        )}
      </div>
    </div>
  );
}
