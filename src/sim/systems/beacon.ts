import { cellCenter } from '../level/types';
import { STEP } from '../step-constants';
import type { World } from '../world';

/** Signal périodique de la balise de sortie (GDD § 3.6). */
export function updateBeacon(world: World): void {
  const s = world.state;
  s.beaconTimer -= STEP;
  if (s.beaconTimer > 0) return;
  s.beaconTimer += Math.max(0.2, world.levelTuning.beaconInterval);
  world.events.push({ type: 'beaconPing', pos: cellCenter(world.level.exit) });
}
