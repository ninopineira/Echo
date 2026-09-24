export interface Vec2 {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Angle ramené dans [0, 2π[. */
export function wrapAngle(a: number): number {
  const t = a % TAU;
  return t < 0 ? t + TAU : t;
}

/** Vecteur unitaire d'une direction de courant : 0 haut, 1 droite, 2 bas, 3 gauche. */
export function dirVec(dir: number): Vec2 {
  switch (dir) {
    case 0:
      return { x: 0, y: -1 };
    case 1:
      return { x: 1, y: 0 };
    case 2:
      return { x: 0, y: 1 };
    default:
      return { x: -1, y: 0 };
  }
}
