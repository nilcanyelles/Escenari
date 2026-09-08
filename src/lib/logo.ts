import type { CSSProperties } from "react";

// Proporcions possibles del logo d'un grup (triades a "Edita el grup" en
// retallar-lo). Es guarda la clau a bands.logo_aspect; allà on el logo es
// mostra gran (capçalera del grup, pàgina pública, targetes d'agència) es
// respecta la proporció; a les miniatures petites es continua retallant a
// quadrat amb object-fit: cover.
export const LOGO_ASPECTS: { key: string; label: string; ratio: number }[] = [
  { key: "1:1", label: "Quadrat", ratio: 1 },
  { key: "4:3", label: "4:3", ratio: 4 / 3 },
  { key: "16:9", label: "16:9", ratio: 16 / 9 },
  { key: "3:1", label: "Ample 3:1", ratio: 3 },
];

export function logoRatio(aspect?: string | null): number {
  return LOGO_ASPECTS.find((a) => a.key === aspect)?.ratio || 1;
}

// Estil inline per a un logo d'alçada fixa que respecti la proporció
// triada (l'amplada s'ajusta sola).
export function logoBox(aspect: string | undefined | null, height: number): CSSProperties {
  return { width: Math.round(height * logoRatio(aspect)), height };
}
