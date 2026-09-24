import type { Vec2 } from '../math/vec';
import { randomRange } from '../rng';
import { STEP } from '../step-constants';
import { cellAt, type GuetteurState, type LeviathanState, type Noise, type World } from '../world';
import { collideCircle, type Impact } from './collision';
import { damageProbe, destroyProbe } from './lifecycle';
import { cachedField, nextWaypoint } from './navigation';

const impact: Impact = { speed: 0, x: 0, y: 0 };

/**
 * Écoute (GDD § 3.4) : un Guetteur entend un bruit si sa distance de chemin (profil son) à la
 * source est ≤ hearingRadius × loudness. Le Léviathan entend toutes les impulsions.
 */
export function processNoises(world: World): void {
  const s = world.state;
  if (s.pendingNoises.length === 0) return;
  const t = world.tuning;
  for (const noise of s.pendingNoises) {
    let field: Float32Array | null = null;
    for (const c of s.creatures) {
      if (c.kind === 'leviathan') {
        if (noise.source === 'pulse') c.surge += t.leviathan.surgeSpeed;
        else if (noise.source === 'bump') c.surge += t.leviathan.surgeSpeed * t.leviathan.bumpSurgeFactor;
        continue;
      }
      field ??= cachedField(world, cellAt(world.level, noise.x, noise.y), 'sound');
      const d = field[cellAt(world.level, c.pos.x, c.pos.y)]!;
      if (d <= t.guetteur.hearingRadius * noise.loudness) hear(world, c, noise);
    }
  }
}

function hear(world: World, g: GuetteurState, noise: Noise): void {
  if (g.mode === 'retreat') return;
  const origin = { x: noise.x, y: noise.y };
  g.noiseOrigin = origin;
  if (g.mode === 'hunt') {
    g.target = { ...origin };
    return;
  }
  g.mode = 'alert';
  g.timer = world.tuning.guetteur.alertDelay;
  g.target = { ...origin };
  g.vel.x *= 0.2;
  g.vel.y *= 0.2;
  world.events.push({
    type: 'creatureAlerted',
    id: g.id,
    kind: 'guetteur',
    pos: { x: g.pos.x, y: g.pos.y },
    target: { ...origin },
  });
}

export function updateCreatures(world: World): void {
  for (const c of world.state.creatures) {
    if (c.kind === 'guetteur') updateGuetteur(world, c);
    else updateLeviathan(world, c);
  }
}

/** Pilote une créature vers `target` le long du chemin, vitesse lissée, collisions. */
function swimTowards(world: World, g: GuetteurState, target: Vec2, speed: number): boolean {
  const t = world.tuning;
  const way = nextWaypoint(world, g.pos, target);
  let desiredX = 0;
  let desiredY = 0;
  if (way) {
    const dx = way.x - g.pos.x;
    const dy = way.y - g.pos.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) {
      const mud = world.level.mud[cellAt(world.level, g.pos.x, g.pos.y)] === 1 ? 0.5 : 1;
      const arrive = way === target ? Math.min(1, len / 0.6) : 1;
      desiredX = (dx / len) * speed * mud * arrive;
      desiredY = (dy / len) * speed * mud * arrive;
    }
  }
  const k = 1 - Math.exp(-6 * STEP);
  g.vel.x += (desiredX - g.vel.x) * k;
  g.vel.y += (desiredY - g.vel.y) * k;
  g.pos.x += g.vel.x * STEP;
  g.pos.y += g.vel.y * STEP;
  collideCircle(world, g.pos, g.vel, t.guetteur.radius, 0, impact);
  if (Math.hypot(g.vel.x, g.vel.y) > 0.05) g.heading = Math.atan2(g.vel.y, g.vel.x);
  return way === null || Math.hypot(target.x - g.pos.x, target.y - g.pos.y) < 0.35;
}

/** Point d'eau tiré au hasard, atteignable à moins de `radius` (chemin) du centre donné. */
function randomPointNear(world: World, center: Vec2, radius: number): Vec2 | null {
  const level = world.level;
  const field = cachedField(world, cellAt(level, center.x, center.y), 'swim');
  const candidates: number[] = [];
  const x0 = Math.max(0, Math.floor(center.x - radius));
  const x1 = Math.min(level.width - 1, Math.floor(center.x + radius));
  const y0 = Math.max(0, Math.floor(center.y - radius));
  const y1 = Math.min(level.height - 1, Math.floor(center.y + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * level.width + x;
      if (field[i]! <= radius && level.mud[i] !== 1) candidates.push(i);
    }
  }
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(randomRange(world.state, 0, candidates.length))]!;
  const px = pick % level.width;
  return { x: px + 0.5, y: (pick - px) / level.width + 0.5 };
}

/** Guetteur (GDD § 3.9) : errance, alerte, chasse vers l'origine du bruit, fouille, retrait. */
function updateGuetteur(world: World, g: GuetteurState): void {
  const t = world.tuning.guetteur;
  const probe = world.state.probe;

  g.clickTimer -= STEP;
  if (g.clickTimer <= 0) {
    g.clickTimer += t.clickInterval;
    if (Math.hypot(probe.pos.x - g.pos.x, probe.pos.y - g.pos.y) <= t.clickRange) {
      world.events.push({ type: 'creatureClick', id: g.id, pos: { x: g.pos.x, y: g.pos.y } });
    }
  }

  switch (g.mode) {
    case 'wander': {
      if (g.target === null) {
        g.timer -= STEP;
        g.vel.x *= 0.96;
        g.vel.y *= 0.96;
        g.pos.x += g.vel.x * STEP;
        g.pos.y += g.vel.y * STEP;
        if (g.timer <= 0) g.target = randomPointNear(world, g.home, t.wanderRadius);
      } else if (swimTowards(world, g, g.target, t.wanderSpeed)) {
        g.target = null;
        g.timer = randomRange(world.state, t.wanderPauseMin, t.wanderPauseMax);
      }
      break;
    }
    case 'alert':
      g.timer -= STEP;
      if (g.target) g.heading = Math.atan2(g.target.y - g.pos.y, g.target.x - g.pos.x);
      if (g.timer <= 0) g.mode = 'hunt';
      break;
    case 'hunt':
      if (!g.target || swimTowards(world, g, g.target, t.huntSpeed)) {
        g.mode = 'search';
        g.timer = t.searchDuration;
        g.target = null;
      }
      break;
    case 'search': {
      g.timer -= STEP;
      const center = g.noiseOrigin ?? g.home;
      if (g.target === null || swimTowards(world, g, g.target, t.wanderSpeed * 1.3)) {
        g.target = randomPointNear(world, center, t.searchRadius);
      }
      if (g.timer <= 0) {
        g.mode = 'wander';
        g.target = null;
        g.timer = randomRange(world.state, t.wanderPauseMin, t.wanderPauseMax);
      }
      break;
    }
    case 'retreat': {
      g.timer -= STEP;
      const dx = g.pos.x - probe.pos.x;
      const dy = g.pos.y - probe.pos.y;
      const len = Math.max(1e-6, Math.hypot(dx, dy));
      const away = { x: g.pos.x + (dx / len) * 2, y: g.pos.y + (dy / len) * 2 };
      swimTowards(world, g, away, t.wanderSpeed * 1.5);
      if (g.timer <= 0) {
        g.mode = 'wander';
        g.target = null;
        g.timer = randomRange(world.state, t.wanderPauseMin, t.wanderPauseMax);
      }
      break;
    }
  }

  if (world.state.status !== 'playing' || g.mode === 'retreat') return;
  const reach = t.radius + world.tuning.probe.radius;
  if (Math.hypot(probe.pos.x - g.pos.x, probe.pos.y - g.pos.y) < reach && probe.invuln <= 0) {
    world.events.push({ type: 'creatureAttack', id: g.id, pos: { x: g.pos.x, y: g.pos.y } });
    damageProbe(world, 'creature', g.pos.x, g.pos.y, t.damage);
    g.mode = 'retreat';
    g.timer = t.retreatDuration;
    g.target = null;
  }
}

/** Léviathan (GDD § 3.9) : poursuite permanente, élan à chaque impulsion, contact fatal. */
function updateLeviathan(world: World, l: LeviathanState): void {
  const t = world.tuning.leviathan;
  const s = world.state;
  const probe = s.probe;
  if (!l.awake) {
    l.wakeTimer -= STEP;
    if (l.wakeTimer <= 0 || world.stats.pulses > 0) {
      l.awake = true;
      world.events.push({ type: 'leviathanWoke', pos: { x: l.pos.x, y: l.pos.y } });
    }
    return;
  }
  l.awakeTime += STEP;
  l.surge = Math.max(0, l.surge - (t.surgeSpeed * STEP) / Math.max(0.01, t.surgeDecay));
  l.repathTimer -= STEP;
  const level = world.level;
  const probeCell = cellAt(level, probe.pos.x, probe.pos.y);
  if (l.repathTimer <= 0) {
    l.repathTimer = t.repathInterval;
    const field = cachedField(world, probeCell, 'swim');
    l.pathDistance = field[cellAt(level, l.pos.x, l.pos.y)]!;
  }
  const way = nextWaypoint(world, l.pos, probe.pos);
  if (way) {
    const dx = way.x - l.pos.x;
    const dy = way.y - l.pos.y;
    const len = Math.hypot(dx, dy);
    const speed = t.baseSpeed + (t.speedGainPerMinute * l.awakeTime) / 60 + l.surge;
    if (len > 1e-6) {
      const step = Math.min(len, speed * STEP);
      l.pos.x += (dx / len) * step;
      l.pos.y += (dy / len) * step;
      l.heading = Math.atan2(dy, dx);
    }
  }
  if (s.status !== 'playing') return;
  if (Math.hypot(probe.pos.x - l.pos.x, probe.pos.y - l.pos.y) < t.radius + world.tuning.probe.radius) {
    world.events.push({ type: 'creatureAttack', id: l.id, pos: { x: l.pos.x, y: l.pos.y } });
    destroyProbe(world);
  }
}
