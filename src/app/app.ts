import type { KeyboardInput } from '../input/keyboard';
import type { FrameStats } from '../render/debug';
import type { Renderer } from '../render/renderer';
import type { GameEvent } from '../sim/events';
import { gameData, onDataChanged } from './data';
import {
  attachDebugKeys,
  describeEvent,
  resolveLevelParam,
  type DebugParams,
} from './debug';
import { GameSession } from './session';

/** Contrôleur de l'application : seule couche qui assemble les autres (ARCHITECTURE § 2). */
export class App {
  private session: GameSession | null = null;
  private last = 0;
  private readonly stats: FrameStats = { fps: 60, frameMs: 16.7, simMs: 0, renderMs: 0 };
  private readonly eventLog: string[] = [];
  private overlay = false;
  private reveal: boolean;
  private god: boolean;
  private readonly seed: number;

  constructor(
    private readonly renderer: Renderer,
    private readonly input: KeyboardInput,
    private readonly params: DebugParams,
  ) {
    this.reveal = params.reveal;
    this.god = params.god;
    this.seed = params.seed ?? Math.floor(Math.random() * 0x7fffffff);
    if (import.meta.env.DEV || params.debug) this.attachDebug();
    onDataChanged(() => {
      if (this.session) this.startLevel(this.session.index);
    });
  }

  start(): void {
    this.startLevel(resolveLevelParam(this.params.level, gameData.catalog) ?? 0);
    requestAnimationFrame(this.frame);
  }

  private startLevel(index: number): void {
    const source = gameData.catalog[index];
    if (!source) return;
    this.session = new GameSession(source, index, { afterglowMultiplier: 1, god: this.god }, this.seed);
    this.input.setGameplay(true);
  }

  private readonly frame = (now: number): void => {
    const dt = this.last === 0 ? 0 : (now - this.last) / 1000;
    this.last = now;
    const session = this.session;
    let alpha = 1;
    if (session) {
      const f = session.advance(dt, this.input, true);
      alpha = f.alpha;
      this.stats.simMs = this.stats.simMs * 0.9 + f.simMs * 0.1;
      this.logEvents(f.events);
      this.renderer.onEvents(f.events, session.world);
    }
    const r0 = performance.now();
    this.renderer.frame(
      session?.world ?? null,
      alpha,
      dt,
      { debug: this.overlay, reveal: this.reveal, shake: true },
      this.stats,
      this.eventLog,
    );
    this.stats.renderMs = this.stats.renderMs * 0.9 + (performance.now() - r0) * 0.1;
    if (dt > 0) {
      this.stats.frameMs = this.stats.frameMs * 0.9 + dt * 1000 * 0.1;
      this.stats.fps = 1000 / this.stats.frameMs;
    }
    requestAnimationFrame(this.frame);
  };

  private logEvents(events: readonly GameEvent[]): void {
    const time = this.session?.world.time ?? 0;
    for (const e of events) {
      if (e.type === 'noise') continue;
      this.eventLog.push(`${time.toFixed(2)} ${describeEvent(e)}`);
    }
    if (this.eventLog.length > 12) this.eventLog.splice(0, this.eventLog.length - 12);
  }

  private attachDebug(): void {
    attachDebugKeys(window, {
      overlay: () => {
        this.overlay = !this.overlay;
      },
      reveal: () => {
        this.reveal = !this.reveal;
      },
      god: () => {
        this.god = !this.god;
        if (this.session) this.session.world.options.god = this.god;
      },
      restart: () => {
        this.session?.restart();
      },
    });
    window.__echo = {
      world: () => this.session?.world ?? null,
      loadLevel: (slugOrNumber) => {
        const i = resolveLevelParam(slugOrNumber, gameData.catalog);
        if (i !== null) this.startLevel(i);
      },
      teleport: (x, y) => {
        const p = this.session?.world.state.probe;
        if (!p) return;
        p.pos.x = p.prev.x = x;
        p.pos.y = p.prev.y = y;
        p.vel.x = p.vel.y = 0;
      },
      lastEvents: () => [...this.eventLog],
    };
  }
}
