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
