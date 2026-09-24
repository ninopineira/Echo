import type { NoiseSource } from '../events';
import type { World } from '../world';

/** Enregistre un bruit du pas en cours ; les créatures l'évaluent à l'étape « bruit » du pas. */
export function addNoise(
  world: World,
  x: number,
  y: number,
  loudness: number,
  source: NoiseSource,
): void {
  if (loudness <= 0) return;
  world.state.pendingNoises.push({ x, y, loudness, source });
  world.events.push({ type: 'noise', pos: { x, y }, loudness, source });
}
