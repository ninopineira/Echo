import { closestOnSegment } from '../math/geom';
import type { Vec2 } from '../math/vec';
import { SEG_STRIDE } from '../level/types';
import type { World } from '../world';

export interface Impact {
  /** Plus forte vitesse normale d'impact du pas (0 si aucun choc entrant). */
  speed: number;
  x: number;
  y: number;
}

const closest: Vec2 = { x: 0, y: 0 };

/**
 * Collision d'un disque contre la roche et les portes fermées : dépénétration en 3 passes,
 * composante normale entrante annulée (avec restitution), composante tangentielle conservée.
 * Renvoie vrai si un contact a eu lieu.
 */
export function collideCircle(
  world: World,
  pos: Vec2,
  vel: Vec2,
  radius: number,
  restitution: number,
  impact: Impact,
): boolean {
  const { level } = world;
  const { segs, segDoor, cellStart, cellSegs, width, height } = level;
  const doors = world.state.doors;
  impact.speed = 0;
  let touched = false;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    const x0 = Math.max(0, Math.floor(pos.x - radius));
    const x1 = Math.min(width - 1, Math.floor(pos.x + radius));
    const y0 = Math.max(0, Math.floor(pos.y - radius));
    const y1 = Math.min(height - 1, Math.floor(pos.y + radius));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * width + cx;
        for (let k = cellStart[c]!; k < cellStart[c + 1]!; k++) {
          const s = cellSegs[k]!;
          const door = segDoor[s]!;
          if (door >= 0 && doors[door]!.progress >= 1) continue;
          const o = s * SEG_STRIDE;
          const ax = segs[o]!;
          const ay = segs[o + 1]!;
          const bx = segs[o + 2]!;
          const by = segs[o + 3]!;
          const snx = segs[o + 4]!;
          const sny = segs[o + 5]!;
          const t = closestOnSegment(pos.x, pos.y, ax, ay, bx, by, closest);
          const dx = pos.x - closest.x;
          const dy = pos.y - closest.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= radius * radius) continue;
          const lineSide = (pos.x - ax) * snx + (pos.y - ay) * sny;
          // Centre passé côté roche (pénétration profonde) : on ressort selon la normale du segment.
          const behind = lineSide < 0 && t > 0 && t < 1;
          let nx: number;
          let ny: number;
          let depth: number;
          if (behind) {
            nx = snx;
            ny = sny;
            depth = radius - lineSide;
          } else {
            const d = Math.sqrt(d2);
            if (d < 1e-9) {
              nx = snx;
              ny = sny;
              depth = radius;
            } else {
              nx = dx / d;
              ny = dy / d;
              depth = radius - d;
            }
          }
          pos.x += nx * depth;
          pos.y += ny * depth;
          const vn = vel.x * nx + vel.y * ny;
          if (vn < 0) {
            vel.x -= (1 + restitution) * vn * nx;
            vel.y -= (1 + restitution) * vn * ny;
            if (-vn > impact.speed) {
              impact.speed = -vn;
              impact.x = closest.x;
              impact.y = closest.y;
            }
          }
          touched = true;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return touched;
}
