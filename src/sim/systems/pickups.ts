import { cellCenter } from '../level/types';
import { snapshotState, type World } from '../world';
import { addNoise } from './noise';

/** Perles ramassées au contact (GDD § 3.7). */
export function updatePearls(world: World): void {
  const s = world.state;
  const p = s.probe.pos;
  const reach = world.tuning.pearl.radius + world.tuning.probe.radius;
  for (const pearl of s.pearls) {
    if (pearl.taken || Math.hypot(pearl.x - p.x, pearl.y - p.y) > reach) continue;
    pearl.taken = true;
    world.events.push({
      type: 'pearlCollected',
      pos: { x: pearl.x, y: pearl.y },
      remaining: s.pearls.filter((x) => !x.taken).length,
    });
  }
}

/** Capsules de leurre ramassées au contact, dans la limite de la réserve (GDD § 3.8). */
export function updateCapsules(world: World): void {
  const s = world.state;
  const p = s.probe;
  const t = world.tuning;
  const reach = t.lure.pickupRadius + t.probe.radius;
  for (const c of s.capsules) {
    if (c.taken || p.lures >= t.lure.maxCarried) continue;
    if (Math.hypot(c.x - p.pos.x, c.y - p.pos.y) > reach) continue;
    c.taken = true;
    p.lures++;
    world.events.push({ type: 'capsulePicked', pos: { x: c.x, y: c.y }, carried: p.lures });
  }
}

/** Leviers au contact : ouverture définitive et bruyante des portes de même lettre (GDD § 3.8). */
export function updateLevers(world: World): void {
  const s = world.state;
  const p = s.probe.pos;
  const t = world.tuning;
  const reach = t.lever.radius + t.probe.radius;
  for (const lever of s.levers) {
    if (lever.pulled || Math.hypot(lever.x - p.x, lever.y - p.y) > reach) continue;
    lever.pulled = true;
    world.events.push({
      type: 'leverPulled',
      pos: { x: lever.x, y: lever.y },
      letter: lever.letter,
    });
    world.level.doors.forEach((def, i) => {
      const door = s.doors[i]!;
      if (def.letter !== lever.letter || door.opening || door.progress >= 1) return;
      door.opening = true;
      let cx = 0;
      let cy = 0;
      for (const cell of def.cells) {
        const c = cellCenter(cell);
        cx += c.x / def.cells.length;
        cy += c.y / def.cells.length;
      }
      world.events.push({ type: 'doorOpening', pos: { x: cx, y: cy }, letter: def.letter });
      addNoise(world, cx, cy, t.lever.doorLoudness, 'door');
    });
  }
}

/** Points de contrôle : activation au contact et instantané de reprise (GDD § 3.8). */
export function updateCheckpoints(world: World): void {
  const s = world.state;
  const p = s.probe.pos;
  const reach = world.tuning.checkpoint.radius + world.tuning.probe.radius;
  for (const cp of s.checkpoints) {
    if (cp.active || Math.hypot(cp.x - p.x, cp.y - p.y) > reach) continue;
    cp.active = true;
    const snap = snapshotState(s);
    snap.probe.pos = { x: cp.x, y: cp.y };
    snap.probe.prev = { x: cp.x, y: cp.y };
    snap.probe.vel = { x: 0, y: 0 };
    world.checkpoint = snap;
    world.checkpointActive = true;
    world.events.push({ type: 'checkpointReached', pos: { x: cp.x, y: cp.y } });
  }
}
