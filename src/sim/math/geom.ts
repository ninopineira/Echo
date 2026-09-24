import { clamp, type Vec2 } from './vec';

/**
 * Distance le long du rayon (ox,oy)+t·(dx,dy) jusqu'au segment [a,b], ou Infinity.
 * (dx,dy) doit être unitaire pour que t soit une distance.
 */
export function raySegment(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const ex = bx - ax;
  const ey = by - ay;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-12) return Infinity;
  const fx = ax - ox;
  const fy = ay - oy;
  const t = (fx * ey - fy * ex) / denom;
  const u = (fx * dy - fy * dx) / denom;
  if (t < 0 || u < -1e-6 || u > 1 + 1e-6) return Infinity;
  return t;
}

/** Écrit dans `out` le point du segment [a,b] le plus proche de p et renvoie son paramètre t ∈ [0,1]. */
export function closestOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  out: Vec2,
): number {
  const ex = bx - ax;
  const ey = by - ay;
  const len2 = ex * ex + ey * ey;
  const t = len2 > 0 ? clamp(((px - ax) * ex + (py - ay) * ey) / len2, 0, 1) : 0;
  out.x = ax + ex * t;
  out.y = ay + ey * t;
  return t;
}
