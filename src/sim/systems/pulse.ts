import type { PulseKind } from '../events';
import type { InputFrame } from '../inputFrame';
import { STEP } from '../step-constants';
import type { Pulse, World } from '../world';
import { computeEchoes } from './echoes';
import { addNoise } from './noise';
import { castRays, inLineOfSight } from './rays';
import { forEachRevealable } from './revealables';

/**
 * Machine de charge (GDD § 3.2) : appui → charge ; relâché avant longChargeTime → courte ;
 * longChargeTime atteint → longue, sans attendre le relâchement. Recharge commune.
 */
export function updateCharge(world: World, input: InputFrame): void {
  const p = world.state.probe;
  const t = world.tuning;
  p.cooldown = Math.max(0, p.cooldown - STEP);

  if (input.pulsePressed && p.charge < 0) {
    if (p.cooldown > 0) {
      world.events.push({ type: 'pulseDenied', reason: 'cooldown' });
    } else if (t.energy.enabled && p.energy < t.pulse.short.energyCost) {
      world.events.push({ type: 'pulseDenied', reason: 'energy' });
    } else {
      p.charge = 0;
      world.events.push({ type: 'chargeStarted', pos: { x: p.pos.x, y: p.pos.y } });
    }
  }
  if (p.charge < 0) return;
  if (input.pulseReleased || !input.pulseHeld) {
    p.charge = -1;
    emitPulse(world, 'short');
    return;
  }
  p.charge += STEP;
  if (p.charge >= t.pulse.longChargeTime) {
    p.charge = -1;
    if (t.energy.enabled && p.energy < t.pulse.long.energyCost) {
      world.events.push({ type: 'pulseDenied', reason: 'energy' });
    } else {
      emitPulse(world, 'long');
    }
  }
}

/** Annule une charge en cours (pause, perte de focus). */
export function cancelCharge(world: World): void {
  world.state.probe.charge = -1;
}

export function emitPulse(world: World, kind: PulseKind): Pulse {
  const s = world.state;
  const p = s.probe;
  const t = world.tuning;
  const cfg = t.pulse[kind];
  const ox = p.pos.x;
  const oy = p.pos.y;
  const rays = castRays(world, ox, oy, cfg.radius, t.pulse.rayCount);
  const pulse: Pulse = {
    id: world.nextId++,
    kind,
    ox,
    oy,
    start: world.time,
    speed: cfg.speed,
    maxRadius: cfg.radius,
    afterglow: cfg.afterglow * world.options.afterglowMultiplier,
    hitDist: rays.hitDist,
    hitSurface: rays.hitSurface,
    maxHit: rays.maxHit,
    lastRadius: 0,
  };
  s.pulses.push(pulse);
  world.stats.pulses++;
  p.cooldown = cfg.cooldown;
  p.cooldownMax = cfg.cooldown;
  if (t.energy.enabled) p.energy = Math.max(0, p.energy - cfg.energyCost);
  const pos = { x: ox, y: oy };
  world.events.push({ type: 'pulseEmitted', kind, pos });
  world.events.push({
    type: 'pulseEchoes',
    origin: pos,
    kind,
    echoes: computeEchoes(world, pulse),
  });
  addNoise(world, ox, oy, cfg.loudness, 'pulse');
  return pulse;
}

/**
 * Avance les fronts : révèle (image figée) les objets que le front franchit en ligne de vue,
 * puis purge impulsions et révélations éteintes.
 */
export function updatePulses(world: World): void {
  const s = world.state;
  const t = world.tuning;
  const halfBand = t.pulse.revealBand / 2;
  const flash = t.pulse.flashTime;
  for (const pulse of s.pulses) {
    const r = (world.time - pulse.start) * pulse.speed;
    const prev = pulse.lastRadius;
    if (prev > pulse.maxRadius + halfBand) continue;
    pulse.lastRadius = r;
    forEachRevealable(world, (o) => {
      const d = Math.hypot(o.x - pulse.ox, o.y - pulse.oy);
      if (d <= prev + halfBand || d > r + halfBand || d > pulse.maxRadius + o.margin) return;
      if (!inLineOfSight(pulse, o.x, o.y, o.margin)) return;
      s.reveals.push({
        kind: o.kind,
        ref: o.ref,
        x: o.x,
        y: o.y,
        angle: o.angle,
        at: world.time,
        fade: pulse.afterglow,
        radius: 0,
        state: o.state,
      });
    });
  }
  s.pulses = s.pulses.filter(
    (p) => world.time <= p.start + p.maxHit / p.speed + flash + p.afterglow,
  );
  s.reveals = s.reveals.filter((r) => world.time <= r.at + flash + r.fade);
}
