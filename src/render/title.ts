import { PALETTE } from '../data/palette';
import { TAU } from '../sim/math/vec';
import { alphaBucket, isFlashing, revealAlpha } from './afterglow';
import { withAlpha } from './color';
import type { GlowBatch } from './glow';

const PERIOD = 2.8;
const SPEED = 520; // px/s
const POINTS = 420;

/**
 * Fond de l'écran titre : une grotte décorative que des anneaux sonar périodiques révèlent
 * puis laissent s'effacer (GDD § 4). Formes calculées, aucune image.
 */
export class TitleBackdrop {
  private outline: Float32Array = new Float32Array(0);
  private pillars: { x: number; y: number; r: number }[] = [];
  private w = 0;
  private h = 0;

  private build(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const cx = w * 0.5;
    const cy = h * 0.52;
    const base = Math.min(w * 0.46, h * 0.62);
    this.outline = new Float32Array(POINTS * 2);
    for (let i = 0; i < POINTS; i++) {
      const a = (i / POINTS) * TAU;
      const r =
        base *
        (1 + 0.16 * Math.sin(3 * a + 1.3) + 0.09 * Math.sin(7 * a + 0.4) + 0.04 * Math.sin(17 * a + 2));
      this.outline[i * 2] = cx + Math.cos(a) * r * (w > h ? 1.25 : 1);
      this.outline[i * 2 + 1] = cy + Math.sin(a) * r * 0.78;
    }
    this.pillars = [
      { x: cx - base * 0.62, y: cy + base * 0.12, r: base * 0.07 },
      { x: cx + base * 0.7, y: cy - base * 0.2, r: base * 0.05 },
      { x: cx + base * 0.25, y: cy + base * 0.42, r: base * 0.04 },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, batch: GlowBatch): void {
    if (w !== this.w || h !== this.h) this.build(w, h);
    const ox = w * 0.5;
    const oy = h * 0.78;
    batch.reset();
    const pings = [Math.floor(time / PERIOD) * PERIOD, (Math.floor(time / PERIOD) - 1) * PERIOD];
    const add = (x1: number, y1: number, x2: number, y2: number): void => {
      const d = Math.hypot((x1 + x2) / 2 - ox, (y1 + y2) / 2 - oy);
      let best = 0;
      let flash = false;
      for (const start of pings) {
        const elapsed = time - (start + d / SPEED);
        const a = revealAlpha(elapsed, 0.08, 2.4);
        if (a > best) {
          best = a;
          flash = isFlashing(elapsed, 0.08);
        }
      }
      if (best > 0.01) batch.segment(flash ? -1 : alphaBucket(best * 0.8), x1, y1, x2, y2);
    };
    const o = this.outline;
    for (let i = 0; i < POINTS; i++) {
      const j = (i + 1) % POINTS;
      add(o[i * 2]!, o[i * 2 + 1]!, o[j * 2]!, o[j * 2 + 1]!);
    }
    for (const p of this.pillars) {
      for (let k = 0; k < 24; k++) {
        const a1 = (k / 24) * TAU;
        const a2 = ((k + 1) / 24) * TAU;
        add(p.x + Math.cos(a1) * p.r, p.y + Math.sin(a1) * p.r, p.x + Math.cos(a2) * p.r, p.y + Math.sin(a2) * p.r);
      }
    }
    batch.draw(ctx, PALETTE.sonar, 1, 0.7);

    // Front de l'anneau courant.
    const r = (time - pings[0]!) * SPEED;
    const maxR = Math.hypot(w, h);
    if (r < maxR) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = withAlpha(PALETTE.sonar, 0.35 * (1 - r / maxR));
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}
