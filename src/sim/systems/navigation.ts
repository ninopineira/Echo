import type { Vec2 } from '../math/vec';
import { distanceField, type NavProfile } from '../nav';
import { cellAt, isDoorOpen, type World } from '../world';

const MAX_CACHED_FIELDS = 96;

/**
 * Champ de distance mis en cache par (case source, profil, version des portes) (ARCHITECTURE § 4.6).
 * Profil « sound » : vase × soundCostMultiplier ; « swim » : vase × 2.
 */
export function cachedField(world: World, source: number, profile: NavProfile): Float32Array {
  const key = `${source}:${profile}:${world.state.doorsVersion}`;
  let field = world.navCache.get(key);
  if (!field) {
    if (world.navCache.size >= MAX_CACHED_FIELDS) world.navCache.clear();
    field = distanceField(
      world.level,
      (d) => isDoorOpen(world, d),
      source,
      { mud: profile === 'sound' ? world.tuning.mud.soundCostMultiplier : 2 },
    );
    world.navCache.set(key, field);
  }
  return field;
}

/** Distance de chemin (profil son) entre deux points, Infinity si séparés. */
export function soundDistance(world: World, from: Vec2, to: Vec2): number {
  const field = cachedField(world, cellAt(world.level, from.x, from.y), 'sound');
  return field[cellAt(world.level, to.x, to.y)]!;
}

/**
 * Prochain point de passage vers `target` en descendant le champ de nage de la cible :
 * centre de la case voisine la plus proche de la cible, ou la cible elle-même si on y est.
 */
export function nextWaypoint(world: World, pos: Vec2, target: Vec2): Vec2 | null {
  const level = world.level;
  const targetCell = cellAt(level, target.x, target.y);
  const here = cellAt(level, pos.x, pos.y);
  if (here === targetCell) return target;
  const field = cachedField(world, targetCell, 'swim');
  if (!Number.isFinite(field[here]!)) return null;
  const x = here % level.width;
  const y = (here - x) / level.width;
  let best = here;
  let bestValue = field[here]!;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) continue;
      const v = field[ny * level.width + nx]!;
      if (v < bestValue) {
        bestValue = v;
        best = ny * level.width + nx;
      }
    }
  }
  if (best === here) return target;
  const bx = best % level.width;
  return { x: bx + 0.5, y: (best - bx) / level.width + 0.5 };
}
