import { PALETTE } from '../../data/palette';
import type { World } from '../../sim/world';
import { TAU } from '../../sim/math/vec';
import { withAlpha } from '../color';
import { sx, sy, type View } from '../view';

/** Temps (monde) des derniers événements marquants, tenus par le rendu. */
export interface EffectTimes {
  damage: number;
  respawn: number;
  complete: number;
  /** Destruction de la sonde : instant et position (implosion). */
  destroyed: number;
  destroyedX: number;
  destroyedY: number;
}

export function freshEffectTimes(): EffectTimes {
  return {
    damage: -Infinity,
    respawn: -Infinity,
    complete: -Infinity,
    destroyed: -Infinity,
    destroyedX: 0,
    destroyedY: 0,
  };
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
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.3,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75,
    );
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
  if (s.status === 'complete' && sinceComplete > 0.4)
    dark = Math.max(dark, Math.min(0.55, (sinceComplete - 0.4) * 0.8));
  if (dark > 0) {
    ctx.fillStyle = withAlpha(PALETTE.background, dark);
    ctx.fillRect(0, 0, w, h);
  }
}

/** Implosion de la sonde : anneau qui se referme et éclat (GDD § 5). */
export function drawImplosion(v: View, times: EffectTimes): void {
  const since = v.time - times.destroyed;
  if (since < 0 || since > 0.6) return;
  const { ctx } = v;
  const x = sx(v, times.destroyedX);
  const y = sy(v, times.destroyedY);
  const u = since / 0.6;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const flash = Math.max(0, 1 - since / 0.15);
  if (flash > 0) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, v.scale * 1.6);
    g.addColorStop(0, withAlpha(PALETTE.probe, 0.8 * flash));
    g.addColorStop(1, withAlpha(PALETTE.probe, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - v.scale * 1.6, y - v.scale * 1.6, v.scale * 3.2, v.scale * 3.2);
  }
  ctx.lineWidth = Math.max(1.5, v.scale / 25);
  ctx.strokeStyle = withAlpha(PALETTE.probe, 1 - u);
  ctx.beginPath();
  ctx.arc(x, y, v.scale * 1.4 * (1 - u) + 1, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
