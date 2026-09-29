import type { InputFrame } from '../inputFrame';
import { STEP } from '../step-constants';
import { cellAt, type World } from '../world';
import { collideCircle, type Impact } from './collision';
import { addNoise } from './noise';

const impact: Impact = { speed: 0, x: 0, y: 0 };

/** E : lance un leurre dans la direction de la sonde, ou clic sec sans réserve (GDD § 3.8). */
export function updateThrow(world: World, input: InputFrame): void {
  if (!input.throwPressed) return;
  const s = world.state;
  const p = s.probe;
  const t = world.tuning.lure;
  if (p.lures <= 0) {
    world.events.push({ type: 'lureEmpty' });
    return;
  }
  p.lures--;
  const pos = { x: p.pos.x + p.facing.x * 0.35, y: p.pos.y + p.facing.y * 0.35 };
  s.lures.push({
    id: world.nextId++,
    pos,
    prev: { ...pos },
    vel: {
      x: p.facing.x * t.throwSpeed + p.vel.x * t.inheritVelocity,
      y: p.facing.y * t.throwSpeed + p.vel.y * t.inheritVelocity,
    },
    landed: false,
    pingsLeft: t.pings,
    pingTimer: t.firstPingDelay,
  });
  world.events.push({ type: 'lureThrown', pos: { ...pos }, dir: { x: p.facing.x, y: p.facing.y } });
}

/** Leurres en vol : rebonds, dérive dans les courants, arrêt puis pings bruyants. */
export function updateLures(world: World): void {
  const s = world.state;
  const t = world.tuning;
  const level = world.level;
  for (const lure of s.lures) {
    if (!lure.landed) {
      const cell = cellAt(level, lure.pos.x, lure.pos.y);
      const dir = level.current[cell]!;
      if (dir >= 0) {
        lure.vel.x += (dir === 1 ? 1 : dir === 3 ? -1 : 0) * t.current.strength * STEP;
        lure.vel.y += (dir === 2 ? 1 : dir === 0 ? -1 : 0) * t.current.strength * STEP;
      }
      const damp = Math.exp(
        -t.lure.drag * (level.mud[cell] === 1 ? t.mud.dragMultiplier : 1) * STEP,
      );
      lure.vel.x *= damp;
      lure.vel.y *= damp;
      lure.pos.x += lure.vel.x * STEP;
      lure.pos.y += lure.vel.y * STEP;
      collideCircle(world, lure.pos, lure.vel, t.lure.radius, t.lure.restitution, impact);
      if (impact.speed > 1) {
        world.events.push({ type: 'lureBounce', pos: { x: impact.x, y: impact.y } });
      }
      // Dans un courant, le leurre ne se pose pas : il dérive.
      if (Math.hypot(lure.vel.x, lure.vel.y) < t.lure.stopSpeed && dir < 0) {
        lure.landed = true;
        lure.vel.x = 0;
        lure.vel.y = 0;
      }
      continue;
    }
    lure.pingTimer -= STEP;
    if (lure.pingTimer > 0 || lure.pingsLeft <= 0) continue;
    lure.pingsLeft--;
    lure.pingTimer = t.lure.pingInterval;
    const pos = { x: lure.pos.x, y: lure.pos.y };
    world.events.push({ type: 'lurePing', pos });
    addNoise(world, pos.x, pos.y, t.lure.loudness, 'lure');
  }
  // Retire les leurres éteints en compactant le tableau sur place (pas d'allocation par pas).
  let kept = 0;
  for (const l of s.lures) {
    if (l.landed && l.pingsLeft <= 0 && l.pingTimer <= 0) continue;
    s.lures[kept++] = l;
  }
  s.lures.length = kept;
}
