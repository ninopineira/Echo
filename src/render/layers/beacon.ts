import { PALETTE } from '../../data/palette';
import { cellCenter } from '../../sim/level/types';
import { TAU } from '../../sim/math/vec';
import type { World } from '../../sim/world';
import { withAlpha } from '../color';
import { onScreen, sx, sy, type View } from '../view';

const PING_VISIBLE = 1.2;

/**
 * Balise de sortie : seul repère visible sans impulsion, à travers les parois (GDD § 3.6).
 * Losange permanent, anneau à chaque signal, repère en bord d'écran si elle est hors champ.
 */
export function drawBeacon(v: View, world: World, lastPing: number): void {
  const { ctx } = v;
  const exit = cellCenter(world.level.exit);
  const x = sx(v, exit.x);
  const y = sy(v, exit.y);
  const since = v.time - lastPing;
  const boost = since >= 0 ? Math.max(0, 1 - since / 0.6) : 0;
  const complete = world.state.status === 'complete';
  const base = complete ? 1 : 0.35 + 0.65 * boost;
  const s = v.scale;

  const halo = ctx.createRadialGradient(x, y, 0, x, y, s * (complete ? 3 : 1.2));
  halo.addColorStop(0, withAlpha(PALETTE.beacon, 0.35 * base));
  halo.addColorStop(1, withAlpha(PALETTE.beacon, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);

  const d = 0.22 * s;
  ctx.beginPath();
  ctx.moveTo(x, y - d);
  ctx.lineTo(x + d, y);
  ctx.lineTo(x, y + d);
  ctx.lineTo(x - d, y);
  ctx.closePath();
  ctx.fillStyle = withAlpha(PALETTE.beacon, base);
  ctx.fill();

  if (since >= 0 && since < PING_VISIBLE) {
    const u = since / PING_VISIBLE;
    ctx.lineWidth = Math.max(1, s / 40);
    ctx.strokeStyle = withAlpha(PALETTE.beacon, 0.8 * (1 - u));
    ctx.beginPath();
    ctx.arc(x, y, world.tuning.beacon.pingRadius * s * (0.25 + 0.75 * u), 0, TAU);
    ctx.stroke();
    if (world.tuning.beacon.offscreenIndicator && !onScreen(v, exit.x, exit.y, 0)) {
      drawEdgeMarker(v, x, y, 1 - u);
    }
  }
}

function drawEdgeMarker(v: View, tx: number, ty: number, a: number): void {
  const { ctx } = v;
  const cx = v.w / 2;
  const cy = v.h / 2;
  const ang = Math.atan2(ty - cy, tx - cx);
  const margin = 26;
  const kx =
    Math.abs(Math.cos(ang)) > 1e-6 ? (v.w / 2 - margin) / Math.abs(Math.cos(ang)) : Infinity;
  const ky =
    Math.abs(Math.sin(ang)) > 1e-6 ? (v.h / 2 - margin) / Math.abs(Math.sin(ang)) : Infinity;
  const k = Math.min(kx, ky);
  const x = cx + Math.cos(ang) * k;
  const y = cy + Math.sin(ang) * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-6, -9);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-6, 9);
  ctx.closePath();
  ctx.fillStyle = withAlpha(PALETTE.beacon, 0.9 * a);
  ctx.fill();
  ctx.restore();
}
