import type { InputFrame } from './inputFrame';
import { STEP } from './step-constants';
import { updateBeacon } from './systems/beacon';
import { processNoises, updateCreatures } from './systems/creatures';
import { updateDoors } from './systems/doors';
import { updateEnergy } from './systems/energy';
import { updateHazards } from './systems/hazards';
import { updateDying, updateExit } from './systems/lifecycle';
import { updateLures, updateThrow } from './systems/lures';
import { updateCapsules, updateCheckpoints, updateLevers, updatePearls } from './systems/pickups';
import { updateProbe } from './systems/probe';
import { updateCharge, updatePulses } from './systems/pulse';
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
  if (s.status !== 'playing') {
    // Les fronts et rémanences continuent de s'effacer pendant les animations de fin.
    updatePulses(world);
    if (s.status === 'dying') updateDying(world);
    return;
  }

  world.stats.time += STEP;
  updateCharge(world, input);
  updateThrow(world, input);
  updateEnergy(world);
  updateProbe(world, input);
  updateLures(world);
  updatePearls(world);
  updateCapsules(world);
  updateLevers(world);
  updateCheckpoints(world);
  updateDoors(world);
  updatePulses(world);
  processNoises(world);
  s.pendingNoises.length = 0;
  updateCreatures(world);
  updateHazards(world);
  updateBeacon(world);
  if (world.state.status === 'playing') updateExit(world);
}
