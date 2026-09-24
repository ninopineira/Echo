import { PALETTE } from '../data/palette';
import type { GameEvent } from '../sim/events';
import { STEP } from '../sim/step';
import { hudModel } from '../sim/views';
import type { World } from '../sim/world';
import { Camera } from './camera';
import { withAlpha } from './color';
import { drawDebugText, drawGeometry, type FrameStats } from './debug';
import { GlowBatch } from './glow';
import { drawHud } from './hud';
import { drawBeacon } from './layers/beacon';
import { drawEffects, drawImplosion, freshEffectTimes, type EffectTimes } from './layers/effects';
import { drawReveals } from './layers/entities';
import { drawProbe } from './layers/probe';
import { drawSignals, prunePings, type Ping } from './layers/signals';
import { drawRings, drawWalls } from './layers/walls';
import { TitleBackdrop } from './title';
import { lerpPos, type View } from './view';

export interface RenderFlags {
  /** Overlay F1. */
  debug: boolean;
  /** Révélation permanente F2. */
  reveal: boolean;
  /** Option « Tremblement de l'écran ». */
  shake: boolean;
  /** Afficher le HUD (masqué sous les écrans de menu). */
  hud: boolean;
}

/** Ce que le canvas doit montrer : une partie, ou le fond animé de l'écran titre. */
export interface Scene {
  world: World | null;
  title: boolean;
}

/** Canvas 2D : ne lit le monde qu'en lecture (ARCHITECTURE § 5). */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  readonly camera = new Camera();
  private lastWorld: World | null = null;
  private readonly wallBatch = new GlowBatch();
  private readonly ringBatch = new GlowBatch();
  private readonly title = new TitleBackdrop();
  private titleTime = 0;
  private lastPing = -Infinity;
  private energyDenied = -Infinity;
  private effects: EffectTimes = freshEffectTimes();
  private readonly lurePings: Ping[] = [];
  /** Touches de nage rappelées dans l'introduction du niveau (premier niveau), ou null. */
  controlsKeys: string | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.resize();
    new ResizeObserver(() => {
      this.resize();
    }).observe(canvas);
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  /** Effets pilotés par les événements de la frame (tremblement, flashs, signal de balise). */
  onEvents(events: readonly GameEvent[], world: World): void {
    for (const e of events) {
      switch (e.type) {
        case 'damage':
          this.effects.damage = world.time;
          this.camera.addTrauma(world.tuning.shake.damage);
          break;
        case 'pulseEmitted':
          if (e.kind === 'long') this.camera.addTrauma(world.tuning.shake.longPulse);
          break;
        case 'beaconPing':
          this.lastPing = world.time;
          break;
        case 'respawn':
          this.effects.respawn = world.time;
          this.camera.snap(e.pos.x, e.pos.y);
          break;
        case 'levelComplete':
          this.effects.complete = world.time;
          break;
        case 'probeDestroyed':
          this.effects.destroyed = world.time;
          this.effects.destroyedX = e.pos.x;
          this.effects.destroyedY = e.pos.y;
          this.camera.addTrauma(world.tuning.shake.damage);
          break;
        case 'pulseDenied':
          if (e.reason === 'energy') this.energyDenied = world.time;
          break;
        case 'lurePing':
          this.lurePings.push({ x: e.pos.x, y: e.pos.y, at: world.time });
          break;
        default:
          break;
      }
    }
  }

  frame(
    scene: Scene,
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
    if (scene.world) {
      this.drawWorld(scene.world, alpha, dt, flags);
    } else if (scene.title) {
      this.titleTime += dt;
      this.title.draw(ctx, this.w, this.h, this.titleTime, this.wallBatch);
    }
    if (flags.debug) drawDebugText(ctx, scene.world, stats, eventLog);
  }

  private drawWorld(world: World, alpha: number, dt: number, flags: RenderFlags): void {
    const { ctx } = this;
    const t = world.tuning;
    const p = world.state.probe;
    const px = lerpPos(p.prev.x, p.pos.x, alpha);
    const py = lerpPos(p.prev.y, p.pos.y, alpha);
    if (world !== this.lastWorld) {
      this.lastWorld = world;
      this.camera.snap(px, py);
      this.lastPing = -Infinity;
      this.energyDenied = -Infinity;
      this.effects = freshEffectTimes();
      this.lurePings.length = 0;
    }
    const scale = this.h / t.camera.visibleTilesY;
    this.camera.follow(px, py, dt, t.camera.followStiffness);
    this.camera.clampTo(world.level.width, world.level.height, this.w / scale, this.h / scale);
    const shake = this.camera.shake(dt, t.shake.maxOffset, flags.shake);
    const view: View = {
      ctx,
      w: this.w,
      h: this.h,
      scale,
      ox: this.w / 2 - (this.camera.x + shake.dx) * scale,
      oy: this.h / 2 - (this.camera.y + shake.dy) * scale,
      time: world.time - STEP * (1 - alpha),
      alpha,
    };
    const hud = hudModel(world);

    if (flags.reveal || flags.debug) drawGeometry(view, world, flags.reveal);
    drawWalls(view, world, this.wallBatch);
    drawRings(view, world, this.ringBatch);
    drawReveals(view, world);
    prunePings(this.lurePings, view.time);
    drawSignals(view, world, this.lurePings);
    drawBeacon(view, world, this.lastPing);
    drawProbe(view, world, hud);
    drawImplosion(view, this.effects);
    drawEffects(ctx, this.w, this.h, world, this.effects, view.time);
    if (flags.hud) drawHud(ctx, this.w, this.h, hud, world, view.time - this.energyDenied, this.controlsKeys);
  }

  /** Voile opaque sous un écran de menu (pause) : masque le terrain. */
  veil(opacity: number): void {
    this.ctx.fillStyle = withAlpha(PALETTE.background, opacity);
    this.ctx.fillRect(0, 0, this.w, this.h);
  }
}
