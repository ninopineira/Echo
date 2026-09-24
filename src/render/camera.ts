import { hash01 } from '../sim/rng';

/** Caméra de rendu : suivi amorti de la sonde, bornes du niveau, tremblement (ARCHITECTURE § 5). */
export class Camera {
  x = 0;
  y = 0;
  private placed = false;
  /** « Traumatisme » 0..1 : le décalage de tremblement vaut trauma² × maxOffset. */
  trauma = 0;
  private shakeSeed = 0;

  snap(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.placed = true;
    this.trauma = 0;
  }

  follow(tx: number, ty: number, dt: number, stiffness: number): void {
    if (!this.placed) {
      this.snap(tx, ty);
      return;
    }
    const k = 1 - Math.exp(-stiffness * dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
  }

  /** Garde la vue dans le niveau ; centre le niveau s'il est plus petit que la vue. */
  clampTo(levelW: number, levelH: number, viewW: number, viewH: number): void {
    const halfW = viewW / 2;
    const halfH = viewH / 2;
    this.x = levelW <= viewW ? levelW / 2 : Math.min(levelW - halfW, Math.max(halfW, this.x));
    this.y = levelH <= viewH ? levelH / 2 : Math.min(levelH - halfH, Math.max(halfH, this.y));
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Décalage de tremblement (en cases) pour cette frame, et atténuation du traumatisme. */
  shake(dt: number, maxOffset: number, enabled: boolean): { dx: number; dy: number } {
    this.shakeSeed++;
    const amount = enabled ? this.trauma * this.trauma * maxOffset : 0;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    if (amount === 0) return { dx: 0, dy: 0 };
    return {
      dx: (hash01(this.shakeSeed * 2) * 2 - 1) * amount,
      dy: (hash01(this.shakeSeed * 2 + 1) * 2 - 1) * amount,
    };
  }
}
