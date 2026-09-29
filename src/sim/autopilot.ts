import { emptyInput } from './inputFrame';
import { cellCenter } from './level/types';
import type { Vec2 } from './math/vec';
import { stepWorld } from './step';
import { nextWaypoint } from './systems/navigation';
import { computeReach } from './validate/reach';
import type { World } from './world';

/**
 * Pilote automatique de test : nage vers chaque levier nécessaire (dans l'ordre du point fixe),
 * puis vers la balise, avec la vraie physique. Sert à vérifier qu'un niveau est physiquement
 * franchissable (couloirs, coins, courants, portes). Renvoie le temps simulé, ou null si échec.
 */
export function autopilot(world: World, maxSeconds: number): number | null {
  const level = world.level;
  const reach = computeReach(level, world.tuning.current.strength >= world.tuning.probe.thrust);
  // Leviers utiles triés par distance au départ (approximation de l'ordre du point fixe).
  const levers = level.levers
    .filter((l) => reach.steps[l.cell.y * level.width + l.cell.x] !== -1)
    .sort(
      (a, b) =>
        reach.steps[a.cell.y * level.width + a.cell.x]! -
        reach.steps[b.cell.y * level.width + b.cell.x]!,
    );
  const goals: Vec2[] = [...levers.map((l) => cellCenter(l.cell)), cellCenter(level.exit)];
  const maxSteps = Math.round(maxSeconds * 120);
  let goal = 0;
  for (let i = 0; i < maxSteps; i++) {
    const s = world.state;
    if (s.status === 'complete') return world.stats.time;
    const target = goals[goal]!;
    const p = s.probe;
    if (goal < goals.length - 1 && Math.hypot(target.x - p.pos.x, target.y - p.pos.y) < 0.6) {
      goal++;
      continue;
    }
    const way = nextWaypoint(world, p.pos, target) ?? target;
    let dx = way.x - p.pos.x - p.vel.x * 0.12;
    let dy = way.y - p.pos.y - p.vel.y * 0.12;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      dx /= len;
      dy /= len;
    }
    stepWorld(world, { ...emptyInput(), move: { x: dx, y: dy } });
    world.events = [];
  }
  return null;
}
