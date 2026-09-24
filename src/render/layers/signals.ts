import { PALETTE } from '../../data/palette';
import { TAU } from '../../sim/math/vec';
import type { World } from '../../sim/world';
import { withAlpha } from '../color';
import { sx, sy, type View } from '../view';

export interface Ping {
  x: number;
  y: number;
  at: number;
}

const LURE_PING_LIFE = 1;

/**
 * Signaux visibles à travers les parois, sans rien révéler : pings de leurre (anneaux ivoire)
 * et halo discret des points de contrôle activés (GDD § 3.8).
 */
export function drawSignals(v: View, world: World, lurePings: readonly Ping[]): void {
  const { ctx } = v;
  for (const p of lurePings) {
    const u = (v.time - p.at) / LURE_PING_LIFE;
    if (u < 0 || u >= 1) continue;
    ctx.lineWidth = Math.max(1, v.scale / 40);
    ctx.strokeStyle = withAlpha(PALETTE.pearl, 0.75 * (1 - u));
    ctx.beginPath();
    ctx.arc(sx(v, p.x), sy(v, p.y), v.scale * (0.2 + 0.9 * u), 0, TAU);
    ctx.stroke();
  }
  for (const cp of world.state.checkpoints) {
    if (!cp.active) continue;
    const x = sx(v, cp.x);
    const y = sy(v, cp.y);
    const r = v.scale * 0.9;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, withAlpha(PALETTE.beacon, 0.22));
    glow.addColorStop(1, withAlpha(PALETTE.beacon, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = withAlpha(PALETTE.beacon, 0.6);
    ctx.beginPath();
    ctx.arc(x, y, v.scale * 0.07, 0, TAU);
    ctx.fill();
  }
}

/** Retire les pings éteints. */
export function prunePings(pings: Ping[], time: number): void {
  let w = 0;
  for (const p of pings) if (time - p.at < LURE_PING_LIFE) pings[w++] = p;
  pings.length = w;
}
