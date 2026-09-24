import { ALPHA_BUCKETS, bucketAlpha } from './afterglow';
import { mix, withAlpha } from './color';

/**
 * Tracés lumineux regroupés (ARCHITECTURE § 5) : un Path2D par palier d'opacité, plus un palier
 * « éclat » ; chaque palier est tracé en 3 passes additives (halo large, moyen, cœur fin).
 */
export class GlowBatch {
  private paths: Path2D[] = [];
  private flash = new Path2D();
  private used = new Array<boolean>(ALPHA_BUCKETS).fill(false);
  private flashUsed = false;
  /** Dernier point tracé par palier, pour enchaîner les segments contigus en polyligne. */
  private lastX = new Float64Array(ALPHA_BUCKETS + 1);
  private lastY = new Float64Array(ALPHA_BUCKETS + 1);

  reset(): void {
    this.paths = Array.from({ length: ALPHA_BUCKETS }, () => new Path2D());
    this.flash = new Path2D();
    this.used.fill(false);
    this.flashUsed = false;
    this.lastX.fill(NaN);
    this.lastY.fill(NaN);
  }

  /** Ajoute un segment écran au palier `bucket` (ou au palier éclat si bucket < 0). */
  segment(bucket: number, x1: number, y1: number, x2: number, y2: number): void {
    const slot = bucket < 0 ? ALPHA_BUCKETS : bucket;
    const path = bucket < 0 ? this.flash : this.paths[bucket]!;
    if (this.lastX[slot] !== x1 || this.lastY[slot] !== y1) path.moveTo(x1, y1);
    path.lineTo(x2, y2);
    this.lastX[slot] = x2;
    this.lastY[slot] = y2;
    if (bucket < 0) this.flashUsed = true;
    else this.used[bucket] = true;
  }

  /** Dessine tous les paliers avec la couleur `color` ; `widthScale` adapte l'épaisseur au zoom. */
  draw(ctx: CanvasRenderingContext2D, color: string, widthScale: number, intensity = 1): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const passes: [number, number][] = [
      [7 * widthScale, 0.07],
      [3 * widthScale, 0.22],
      [1.4 * widthScale, 0.95],
    ];
    for (const [width, a] of passes) {
      ctx.lineWidth = width;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        if (!this.used[b]) continue;
        ctx.strokeStyle = withAlpha(color, a * bucketAlpha(b) * intensity);
        ctx.stroke(this.paths[b]!);
      }
      if (this.flashUsed) {
        ctx.strokeStyle = mix(color, '#FFFFFF', 0.75, Math.min(1, a * 1.4 * intensity));
        ctx.stroke(this.flash);
      }
    }
    ctx.restore();
  }
}
