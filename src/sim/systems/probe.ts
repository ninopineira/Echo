import type { InputFrame } from '../inputFrame';
import { STEP } from '../step-constants';
import { cellAt, type World } from '../world';
import { collideCircle, type Impact } from './collision';
import { addNoise } from './noise';

const impact: Impact = { speed: 0, x: 0, y: 0 };

/** Nage inertielle, collisions et chocs de la sonde (GDD § 3.1). */
export function updateProbe(world: World, input: InputFrame): void {
  const t = world.tuning;
  const p = world.state.probe;
  const level = world.level;

  p.invuln = Math.max(0, p.invuln - STEP);
  p.bumpCooldown = Math.max(0, p.bumpCooldown - STEP);

  const mx = input.move.x;
  const my = input.move.y;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    p.facing.x = mx / len;
    p.facing.y = my / len;
  }

  let ax = mx * t.probe.thrust;
  let ay = my * t.probe.thrust;
  const cell = cellAt(level, p.pos.x, p.pos.y);
  const current = level.current[cell]!;
  if (current >= 0) {
    ax += current === 1 ? t.current.strength : current === 3 ? -t.current.strength : 0;
    ay += current === 2 ? t.current.strength : current === 0 ? -t.current.strength : 0;
  }
  p.vel.x += ax * STEP;
  p.vel.y += ay * STEP;
  const drag = t.probe.drag * (level.mud[cell] === 1 ? t.mud.dragMultiplier : 1);
  const damp = Math.exp(-drag * STEP);
  p.vel.x *= damp;
  p.vel.y *= damp;
  p.pos.x += p.vel.x * STEP;
  p.pos.y += p.vel.y * STEP;

  collideCircle(world, p.pos, p.vel, t.probe.radius, t.probe.wallRestitution, impact);
  if (impact.speed > t.probe.bumpMinSpeed && p.bumpCooldown <= 0) {
    p.bumpCooldown = t.probe.bumpCooldown;
    const cruise = t.probe.thrust / t.probe.drag;
    const intensity = Math.min(
      1,
      (impact.speed - t.probe.bumpMinSpeed) / Math.max(0.01, cruise - t.probe.bumpMinSpeed),
    );
    const pos = { x: impact.x, y: impact.y };
    world.events.push({ type: 'wallBump', pos, intensity });
    addNoise(world, pos.x, pos.y, intensity * t.probe.bumpLoudnessMax, 'bump');
    if (t.probe.bumpRevealRadius > 0) {
      world.state.reveals.push({
        kind: 'wallArc',
        ref: 0,
        x: pos.x,
        y: pos.y,
        angle: 0,
        at: world.time,
        fade: t.probe.bumpRevealAfterglow * world.options.afterglowMultiplier,
        radius: t.probe.bumpRevealRadius,
      });
    }
  }
}
