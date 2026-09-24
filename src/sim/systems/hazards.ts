import { cellCenter } from '../level/types';
import type { World } from '../world';
import { damageProbe } from './lifecycle';

/** Oursins : −1 coque au contact (GDD § 3.8). */
export function updateHazards(world: World): void {
  const p = world.state.probe;
  if (p.invuln > 0) return;
  const reach = world.tuning.hazard.radius + world.tuning.probe.radius;
  for (const h of world.level.hazards) {
    const c = cellCenter(h);
    if (Math.abs(c.x - p.pos.x) > reach || Math.abs(c.y - p.pos.y) > reach) continue;
    if (Math.hypot(c.x - p.pos.x, c.y - p.pos.y) < reach) {
      damageProbe(world, 'hazard', c.x, c.y, world.tuning.hazard.damage);
      return;
    }
  }
}
