const cache = new Map<string, [number, number, number]>();

function rgb(hex: string): [number, number, number] {
  let c = cache.get(hex);
  if (!c) {
    const n = Number.parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cache.set(hex, c);
  }
  return c;
}

/** Couleur `#RRGGBB` avec opacité, au format CSS. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/** Mélange linéaire de deux couleurs `#RRGGBB` (t = 0 → a, 1 → b), avec opacité. */
export function mix(a: string, b: string, t: number, alpha = 1): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgba(${r},${g},${bl},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}
