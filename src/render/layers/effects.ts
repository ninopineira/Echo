import { PALETTE } from '../../data/palette';
import type { World } from '../../sim/world';
import { withAlpha } from '../color';

/** Temps (monde) des derniers événements marquants, tenus par le rendu. */
export interface EffectTimes {
  damage: number;
  respawn: number;
  complete: number;
}

export function freshEffectTimes(): EffectTimes {
  return { damage: -Infinity, respawn: -Infinity, complete: -Infinity };
}

/** Effets plein écran : vignette corail de dégât, fondu de destruction et de reprise, fin de niveau. */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  world: World,
  times: EffectTimes,
  time: number,
): void {
  const sinceDamage = time - times.damage;
  if (sinceDamage >= 0 && sinceDamage < 0.45) {
    const a = 1 - sinceDamage / 0.45;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, withAlpha(PALETTE.hazard, 0));
    g.addColorStop(1, withAlpha(PALETTE.hazard, 0.45 * a));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const s = world.state;
  let dark = 0;
  if (s.status === 'dying') {
    dark = Math.min(1, s.statusTimer / Math.max(0.01, world.tuning.probe.destroyedDuration * 0.8));
  }
  const sinceRespawn = time - times.respawn;
  if (sinceRespawn >= 0 && sinceRespawn < 0.6) dark = Math.max(dark, 1 - sinceRespawn / 0.6);
  const sinceComplete = time - times.complete;
  if (s.status === 'complete' && sinceComplete > 0.4) dark = Math.max(dark, Math.min(0.55, (sinceComplete - 0.4) * 0.8));
  if (dark > 0) {
    ctx.fillStyle = withAlpha(PALETTE.background, dark);
    ctx.fillRect(0, 0, w, h);
  }
}
