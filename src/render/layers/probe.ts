import { PALETTE } from '../../data/palette';
import { TAU } from '../../sim/math/vec';
import type { HudModel } from '../../sim/views';
import type { World } from '../../sim/world';
import { withAlpha } from '../color';
import { lerpPos, sx, sy, type View } from '../view';

/**
 * Sonde : goutte blanc bleuté orientée, halo doux, clignotement d'invulnérabilité,
 * anneau de charge de l'impulsion longue et arc de recharge, directement dans la scène.
 */
export function drawProbe(v: View, world: World, hud: HudModel): void {
  const { ctx } = v;
  const p = world.state.probe;
  if (world.state.status === 'dying') return;
  const x = sx(v, lerpPos(p.prev.x, p.pos.x, v.alpha));
  const y = sy(v, lerpPos(p.prev.y, p.pos.y, v.alpha));
  const r = world.tuning.probe.radius * v.scale;
  const blink = p.invuln > 0 && Math.floor(v.time * 12) % 2 === 0;

  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
  halo.addColorStop(0, withAlpha(PALETTE.probe, blink ? 0.12 : 0.28));
  halo.addColorStop(1, withAlpha(PALETTE.probe, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(p.facing.y, p.facing.x));
  ctx.beginPath();
  ctx.moveTo(r * 1.5, 0);
  ctx.bezierCurveTo(r * 0.6, -r * 1.05, -r, -r, -r, 0);
  ctx.bezierCurveTo(-r, r, r * 0.6, r * 1.05, r * 1.5, 0);
  ctx.closePath();
  ctx.fillStyle = withAlpha(PALETTE.probe, blink ? 0.35 : 1);
  ctx.fill();
  ctx.restore();

  const ring = r * 2.4;
  ctx.lineCap = 'round';
  if (hud.cooldown01 > 0) {
    ctx.lineWidth = Math.max(1.5, v.scale / 34);
    ctx.strokeStyle = withAlpha(PALETTE.sonar, 0.28);
    ctx.beginPath();
    ctx.arc(x, y, ring, -Math.PI / 2, -Math.PI / 2 + TAU * hud.cooldown01);
    ctx.stroke();
  }
  if (hud.charge01 !== null) {
    ctx.lineWidth = Math.max(2, v.scale / 22);
    ctx.strokeStyle = withAlpha(PALETTE.sonar, 0.35 + 0.55 * hud.charge01);
    ctx.beginPath();
    ctx.arc(x, y, ring + 3, -Math.PI / 2, -Math.PI / 2 + TAU * hud.charge01);
    ctx.stroke();
  }
}
