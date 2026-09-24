import { STEP } from '../step-constants';
import type { World } from '../world';

/** Ouverture progressive des portes ; une porte ne cesse de bloquer qu'une fois ouverte. */
export function updateDoors(world: World): void {
  const s = world.state;
  const duration = Math.max(0.01, world.tuning.lever.doorOpenTime);
  s.doors.forEach((door) => {
    if (!door.opening || door.progress >= 1) return;
    door.progress = Math.min(1, door.progress + STEP / duration);
    if (door.progress >= 1) {
      door.opening = false;
      s.doorsVersion++;
      world.navCache.clear();
      world.events.push({ type: 'doorOpened', letter: door.letter });
    }
  });
}
