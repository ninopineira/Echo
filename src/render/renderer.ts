import { PALETTE } from '../data/palette';
import type { GameEvent } from '../sim/events';
import { STEP } from '../sim/step';
import type { World } from '../sim/world';
import { Camera } from './camera';
import { drawDebugText, drawGeometry, type FrameStats } from './debug';
import { drawProbe } from './layers/probe';
import { lerpPos, type View } from './view';

export interface RenderFlags {
  /** Overlay F1. */
  debug: boolean;
  /** Révélation permanente F2. */
  reveal: boolean;
  /** Option « Tremblement de l'écran ». */
  shake: boolean;
}

/** Canvas 2D : ne lit le monde qu'en lecture (ARCHITECTURE § 5). */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  readonly camera = new Camera();
  private lastWorld: World | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.resize();
    new ResizeObserver(() => {
      this.resize();
    }).observe(canvas);
  }

  get size(): { w: number; h: number } {
    return { w: this.w, h: this.h };
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  /** Effets pilotés par les événements de la frame (tremblement…). */
  onEvents(events: readonly GameEvent[], world: World): void {
    for (const e of events) {
      if (e.type === 'damage') this.camera.addTrauma(world.tuning.shake.damage);
      else if (e.type === 'pulseEmitted' && e.kind === 'long') {
        this.camera.addTrauma(world.tuning.shake.longPulse);
      }
    }
  }

  frame(
    world: World | null,
    alpha: number,
    dt: number,
    flags: RenderFlags,
    stats: FrameStats,
    eventLog: readonly string[],
  ): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PALETTE.background;
    ctx.fillRect(0, 0, this.w, this.h);
    if (world) this.drawWorld(world, alpha, dt, flags);
    if (flags.debug) drawDebugText(ctx, world, stats, eventLog);
  }

  private drawWorld(world: World, alpha: number, dt: number, flags: RenderFlags): void {
    const t = world.tuning;
    const p = world.state.probe;
    const px = lerpPos(p.prev.x, p.pos.x, alpha);
    const py = lerpPos(p.prev.y, p.pos.y, alpha);
    if (world !== this.lastWorld) {
      this.lastWorld = world;
      this.camera.snap(px, py);
    }
    const scale = this.h / t.camera.visibleTilesY;
    this.camera.follow(px, py, dt, t.camera.followStiffness);
    this.camera.clampTo(world.level.width, world.level.height, this.w / scale, this.h / scale);
    const shake = this.camera.shake(dt, t.shake.maxOffset, flags.shake);
    const view: View = {
      ctx: this.ctx,
      w: this.w,
      h: this.h,
      scale,
      ox: this.w / 2 - (this.camera.x + shake.dx) * scale,
      oy: this.h / 2 - (this.camera.y + shake.dy) * scale,
      time: world.time - STEP * (1 - alpha),
      alpha,
    };

    if (flags.reveal || flags.debug) drawGeometry(view, world, flags.reveal);
    drawProbe(view, world);
  }
}
