import { STEP } from '../step-constants';
import type { World } from '../world';

/** Recharge lente de la batterie (niveaux 9 et 10, GDD § 3.8). */
export function updateEnergy(world: World): void {
  const t = world.tuning.energy;
  if (!t.enabled) return;
  const p = world.state.probe;
  p.energy = Math.min(t.max, p.energy + t.regen * STEP);
}
