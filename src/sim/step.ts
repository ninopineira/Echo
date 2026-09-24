import type { InputFrame } from './inputFrame';
import { STEP } from './step-constants';
import { updateProbe } from './systems/probe';
import type { World } from './world';

export { STEP };

/**
 * Fait avancer la simulation d'un pas fixe (ARCHITECTURE § 4.2). Déterministe : ne dépend que de
 * `world` et `input`, mute l'état en place et ajoute ses événements à `world.events`.
 */
export function stepWorld(world: World, input: InputFrame): void {
  world.tick++;
  world.time += STEP;
  const s = world.state;
  s.statusTimer += STEP;
  s.probe.prev.x = s.probe.pos.x;
  s.probe.prev.y = s.probe.pos.y;
  for (const c of s.creatures) {
    c.prev.x = c.pos.x;
    c.prev.y = c.pos.y;
  }
  for (const l of s.lures) {
    l.prev.x = l.pos.x;
    l.prev.y = l.pos.y;
  }
  if (s.status !== 'playing') return;

  world.stats.time += STEP;
  updateProbe(world, input);
  s.pendingNoises.length = 0;
}
