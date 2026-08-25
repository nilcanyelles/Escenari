"use client";

import { useMemo, useState } from "react";
import { CREW_ROLES, CrewRoleSvg, crewRoleIconKey } from "@/lib/crewRoles";
import { normalize } from "@/lib/text";

// Selector de funcions de crew: selecció múltiple amb bombolletes, com el
// d'instruments, amb un camp de cerca que també permet afegir una funció
// personalitzada quan no coincideix amb cap de les predefinides.
export default function CrewRolePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());

  const selectedLower = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const roles = useMemo(() => (q ? CREW_ROLES.filter((r) => normalize(r.name).includes(q)) : CREW_ROLES), [q]);
  const exactMatch = useMemo(() => CREW_ROLES.some((r) => normalize(r.name) === q), [q]);

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
          {value.map((fn) => (
            <span className="instrument-chip" key={fn}>
              <CrewRoleSvg icon={crewRoleIconKey(fn)} />
              {fn}
              <button type="button" onClick={() => toggle(fn)} aria-label={`Treu ${fn}`}>✕</button>
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
            if (roles.length === 1) toggle(roles[0].name);
            else if (!exactMatch) addCustom();
          }
        }}
        placeholder="Cerca o escriu una funció…"
      />
      <div className="instr-panel">
        <div className="instr-grid">
          {roles.map((r) => {
            const active = selectedLower.has(r.name.toLowerCase());
            return (
              <button
                key={r.name}
                type="button"
                className={"instr-pill" + (active ? " active" : "")}
                onClick={() => toggle(r.name)}
              >
                <CrewRoleSvg icon={r.icon} />
                {r.name}
              </button>
            );
          })}
        </div>
        {roles.length === 0 && (
          <button type="button" className="btn-ghost-sm" onClick={addCustom}>
            + Afegeix «{query.trim()}»
          </button>
        )}
      </div>
    </div>
  );
}
