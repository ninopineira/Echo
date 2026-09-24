import type { Echo, EchoSurface } from '../events';
import { TAU, wrapAngle } from '../math/vec';
import { SURFACE_DOOR, SURFACE_ROCK, type Pulse, type World } from '../world';
import { inLineOfSight } from './rays';
import { forEachRevealable } from './revealables';

/**
 * Échos d'une impulsion (GDD § 3.3) : la surface la plus proche de chaque secteur angulaire,
 * plus les objets en ligne de vue les plus proches. Délai = aller-retour à la vitesse du front.
 */
export function computeEchoes(world: World, pulse: Pulse): Echo[] {
  const sectors = world.tuning.echo.sectors;
  const n = pulse.hitDist.length;
  const bestDist = new Array<number>(sectors).fill(Infinity);
  const bestRay = new Array<number>(sectors).fill(-1);
  for (let i = 0; i < n; i++) {
    const surf = pulse.hitSurface[i];
    if (surf !== SURFACE_ROCK && surf !== SURFACE_DOOR) continue;
    const sector = Math.floor((i * sectors) / n);
    const d = pulse.hitDist[i]!;
    if (d < bestDist[sector]!) {
      bestDist[sector] = d;
      bestRay[sector] = i;
    }
  }
  const echoes: Echo[] = [];
  for (let k = 0; k < sectors; k++) {
    const i = bestRay[k]!;
    if (i < 0) continue;
    const distance = bestDist[k]!;
    echoes.push({
      delay: (2 * distance) / pulse.speed,
      angle: (i * TAU) / n,
      distance,
      surface: pulse.hitSurface[i] === SURFACE_DOOR ? 'door' : 'rock',
    });
  }

  const objects: { distance: number; angle: number; surface: EchoSurface }[] = [];
  forEachRevealable(world, (r) => {
    if (r.surface === null) return;
    const dx = r.x - pulse.ox;
    const dy = r.y - pulse.oy;
    const distance = Math.hypot(dx, dy);
    if (distance > pulse.maxRadius || !inLineOfSight(pulse, r.x, r.y, r.margin)) return;
    objects.push({ distance, angle: wrapAngle(Math.atan2(dy, dx)), surface: r.surface });
  });
  objects.sort((a, b) => a.distance - b.distance);
  for (const o of objects.slice(0, world.tuning.echo.maxEntityEchoes)) {
    echoes.push({ delay: (2 * o.distance) / pulse.speed, ...o });
  }
  return echoes;
}
