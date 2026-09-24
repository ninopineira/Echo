/** Contexte de dessin d'une frame : passage monde (cases) → écran (px CSS). */
export interface View {
  ctx: CanvasRenderingContext2D;
  /** Taille du canvas en pixels CSS. */
  w: number;
  h: number;
  /** Pixels CSS par case. */
  scale: number;
  /** Décalage écran : sx = x · scale + ox. */
  ox: number;
  oy: number;
  /** Temps monde interpolé de la frame (s). */
  time: number;
  /** Facteur d'interpolation entre deux pas. */
  alpha: number;
}

export function sx(v: View, x: number): number {
  return x * v.scale + v.ox;
}

export function sy(v: View, y: number): number {
  return y * v.scale + v.oy;
}

export function lerpPos(prev: number, cur: number, alpha: number): number {
  return prev + (cur - prev) * alpha;
}

/** Vrai si le point monde (avec une marge en cases) est à l'écran. */
export function onScreen(v: View, x: number, y: number, margin: number): boolean {
  const px = sx(v, x);
  const py = sy(v, y);
  const m = margin * v.scale;
  return px >= -m && py >= -m && px <= v.w + m && py <= v.h + m;
}
