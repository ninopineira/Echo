import { cellCenter } from '../level/types';
import { distanceField } from '../nav';
import { cellAt, isDoorOpen, snapshotState, type World } from '../world';

/** Balise atteinte → niveau terminé (GDD § 3.6). */
export function updateExit(world: World): void {
  const s = world.state;
  const exit = cellCenter(world.level.exit);
  const p = s.probe.pos;
  if (
    Math.hypot(exit.x - p.x, exit.y - p.y) >
    world.tuning.exit.radius + world.tuning.probe.radius
  ) {
    return;
  }
  s.status = 'complete';
  s.statusTimer = 0;
  s.probe.charge = -1;
  world.events.push({ type: 'levelComplete', pos: exit });
}

/** Retire des points de coque (GDD § 3.5) : recul, invulnérabilité, destruction à zéro. */
export function damageProbe(
  world: World,
  source: 'hazard' | 'creature',
  fromX: number,
  fromY: number,
  amount: number,
): void {
  const s = world.state;
  const p = s.probe;
  const t = world.tuning;
  if (world.options.god || s.status !== 'playing' || p.invuln > 0) return;
  p.hull = Math.max(0, p.hull - amount);
  p.invuln = t.probe.invulnerability;
  let dx = p.pos.x - fromX;
  let dy = p.pos.y - fromY;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    dx = -p.facing.x;
    dy = -p.facing.y;
  } else {
    dx /= len;
    dy /= len;
  }
  p.vel.x = dx * t.probe.knockback;
  p.vel.y = dy * t.probe.knockback;
  world.events.push({ type: 'damage', source, pos: { x: p.pos.x, y: p.pos.y }, hull: p.hull });
  if (p.hull === 0) destroyProbe(world);
}

/** Destruction immédiate (coque à zéro, contact du Léviathan). */
export function destroyProbe(world: World): void {
  const s = world.state;
  if (world.options.god || s.status !== 'playing') return;
  s.probe.hull = 0;
  s.probe.charge = -1;
  s.status = 'dying';
  s.statusTimer = 0;
  world.stats.deaths++;
  world.events.push({ type: 'probeDestroyed', pos: { x: s.probe.pos.x, y: s.probe.pos.y } });
}

/** Pendant l'implosion : reprise au point de contrôle une fois la durée écoulée. */
export function updateDying(world: World): void {
  if (
    world.state.status === 'dying' &&
    world.state.statusTimer >= world.tuning.probe.destroyedDuration
  ) {
    respawn(world);
  }
}

/**
 * Restaure l'instantané de reprise (départ ou dernier point de contrôle). Les statistiques de la
 * tentative ne sont pas restaurées. Utilisé aussi par « Revenir au point de contrôle ».
 */
export function respawn(world: World): void {
  const t = world.tuning;
  const s = snapshotState(world.checkpoint);
  s.status = 'playing';
  s.statusTimer = 0;
  s.probe.hull = t.probe.hullMax;
  s.probe.invuln = t.probe.invulnerability;
  s.probe.vel.x = 0;
  s.probe.vel.y = 0;
  s.probe.prev.x = s.probe.pos.x;
  s.probe.prev.y = s.probe.pos.y;
  s.probe.charge = -1;
  s.probe.cooldown = 0;
  world.state = s;
  world.navCache.clear();
  keepLeviathanAway(world);
  world.events.push({
    type: 'respawn',
    pos: { x: s.probe.pos.x, y: s.probe.pos.y },
    fromCheckpoint: world.checkpointActive,
  });
}

/** À la reprise, replace le Léviathan à au moins `respawnDistance` de la sonde, en arrière sur son chemin. */
function keepLeviathanAway(world: World): void {
  const s = world.state;
  const level = world.level;
  const min = world.tuning.leviathan.respawnDistance;
  for (const c of s.creatures) {
    if (c.kind !== 'leviathan') continue;
    const field = distanceField(
      level,
      (d) => isDoorOpen(world, d),
      cellAt(level, s.probe.pos.x, s.probe.pos.y),
      { mud: 2 },
    );
    let cell = cellAt(level, c.pos.x, c.pos.y);
    for (let guard = 0; guard < 400 && (field[cell] ?? Infinity) < min; guard++) {
      const x = cell % level.width;
      const y = (cell - x) / level.width;
      let best = cell;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) continue;
          const n = ny * level.width + nx;
          const v = field[n]!;
          if (Number.isFinite(v) && v > field[best]!) best = n;
        }
      }
      if (best === cell) break;
      cell = best;
    }
    const x = cell % level.width;
    c.pos.x = c.prev.x = x + 0.5;
    c.pos.y = c.prev.y = (cell - x) / level.width + 0.5;
    c.surge = 0;
    c.repathTimer = 0;
  }
}
