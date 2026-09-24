import { STEP } from '../sim/step';

/** Durée de frame maximale prise en compte (s) : au-delà (onglet en arrière-plan…), on l'ignore. */
export const MAX_FRAME_TIME = 0.25;
/** Nombre maximal de pas par frame : le reste est abandonné plutôt que de rattraper sans fin. */
export const MAX_STEPS = 8;

export interface Advance {
  steps: number;
  acc: number;
  /** Interpolation de rendu entre le pas précédent et le pas courant (0..1). */
  alpha: number;
}

/** Accumulateur à pas fixe (pur) : combien de pas exécuter pour une frame de `frameDt` secondes. */
export function advance(acc: number, frameDt: number): Advance {
  let total = acc + Math.min(Math.max(frameDt, 0), MAX_FRAME_TIME);
  let steps = Math.floor(total / STEP + 1e-9);
  if (steps > MAX_STEPS) {
    steps = MAX_STEPS;
    total = steps * STEP + (total % STEP);
  }
  const rest = Math.max(0, total - steps * STEP);
  return { steps, acc: rest, alpha: Math.min(1, rest / STEP) };
}
