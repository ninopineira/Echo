import { raySegment } from '../math/geom';
import { TAU, wrapAngle } from '../math/vec';
import { SEG_STRIDE } from '../level/types';
import {
  cellAt,
  SURFACE_ABSORBED,
  SURFACE_DOOR,
  SURFACE_NONE,
  SURFACE_ROCK,
  type Pulse,
  type World,
} from '../world';

export interface RayCast {
  hitDist: Float32Array;
  hitSurface: Uint8Array;
  maxHit: number;
}

/**
 * Lance `count` rayons réguliers depuis (ox, oy) jusqu'à `radius` (ARCHITECTURE § 4.5) :
 * parcours DDA des cases, arrêt sur la roche ou une porte fermée, absorption à l'entrée de la vase.
 */
export function castRays(
  world: World,
  ox: number,
  oy: number,
  radius: number,
  count: number,
): RayCast {
  const { level } = world;
  const { width, height, segs, segDoor, cellStart, cellSegs, mud } = level;
  const doors = world.state.doors;
  const hitDist = new Float32Array(count);
  const hitSurface = new Uint8Array(count);
  if (mud[cellAt(level, ox, oy)] === 1) {
    hitSurface.fill(SURFACE_ABSORBED);
    return { hitDist, hitSurface, maxHit: 0 };
  }
  let maxHit = 0;
  const startX = Math.floor(ox);
  const startY = Math.floor(oy);
  for (let i = 0; i < count; i++) {
    const a = (i * TAU) / count;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let cx = startX;
    let cy = startY;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    let tMaxX = dx > 0 ? (cx + 1 - ox) / dx : dx < 0 ? (ox - cx) / -dx : Infinity;
    let tMaxY = dy > 0 ? (cy + 1 - oy) / dy : dy < 0 ? (oy - cy) / -dy : Infinity;
    let tEnter = 0;
    let best = Infinity;
    let surface = SURFACE_NONE;
    while (tEnter <= radius) {
      const c = cy * width + cx;
      if (tEnter > 0 && mud[c] === 1) {
        best = tEnter;
        surface = SURFACE_ABSORBED;
        break;
      }
      for (let k = cellStart[c]!; k < cellStart[c + 1]!; k++) {
        const s = cellSegs[k]!;
        const door = segDoor[s]!;
        if (door >= 0 && doors[door]!.progress >= 1) continue;
        const o = s * SEG_STRIDE;
        const t = raySegment(ox, oy, dx, dy, segs[o]!, segs[o + 1]!, segs[o + 2]!, segs[o + 3]!);
        if (t < best) {
          best = t;
          surface = door >= 0 ? SURFACE_DOOR : SURFACE_ROCK;
        }
      }
      const tExit = Math.min(tMaxX, tMaxY);
      if (best <= tExit + 1e-6) break;
      if (tMaxX < tMaxY) {
        cx += stepX;
        tEnter = tMaxX;
        tMaxX += tDeltaX;
      } else {
        cy += stepY;
        tEnter = tMaxY;
        tMaxY += tDeltaY;
      }
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) break;
    }
    if (best > radius) {
      best = radius;
      surface = SURFACE_NONE;
    }
    hitDist[i] = best;
    hitSurface[i] = surface;
    if (best > maxHit) maxHit = best;
  }
  return { hitDist, hitSurface, maxHit };
}

/**
 * Vrai si le point (x, y) est en ligne de vue depuis l'origine de l'impulsion : un des rayons voisins
 * de sa direction va au moins jusqu'à lui (moins `margin`, pour les objets collés à une paroi).
 */
export function inLineOfSight(pulse: Pulse, x: number, y: number, margin: number): boolean {
  const dx = x - pulse.ox;
  const dy = y - pulse.oy;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return pulse.hitSurface[0] !== SURFACE_ABSORBED;
  if (d > pulse.maxRadius + margin) return false;
  const n = pulse.hitDist.length;
  const k = Math.round((wrapAngle(Math.atan2(dy, dx)) / TAU) * n);
  for (let j = k - 1; j <= k + 1; j++) {
    if (pulse.hitDist[((j % n) + n) % n]! >= d - margin) return true;
  }
  return false;
}
