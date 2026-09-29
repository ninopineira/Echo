import { detectMovementLabel } from '../input/layout';
import type { KeyboardInput } from '../input/keyboard';
import type { FrameStats } from '../render/debug';
import type { Renderer } from '../render/renderer';
import {
  isUnlocked,
  recordRun,
  starsOf,
  writeSave,
  type KeyValueStore,
  type Options,
  type SaveData,
} from '../save/save';
import type { GameEvent } from '../sim/events';
import { parseLevel } from '../sim/level/parse';
import { countStars, runResult, type RunResult } from '../sim/scoring';
import { respawn } from '../sim/systems/lifecycle';
import { cancelCharge } from '../sim/systems/pulse';
import { ambientModel, type AmbientModel } from '../sim/views';
import type { ScreenModel, Ui, UiCallbacks, UiSound } from '../ui/types';
import { gameData, onDataChanged } from './data';
import { attachDebugKeys, describeEvent, resolveLevelParam, type DebugParams } from './debug';
import { initialFlow, reduce, type FlowAction, type FlowState } from './flow';
import { GameSession } from './session';

/** Ce que l'app attend du système audio (implémenté dans src/audio/audio.ts). */
export interface GameAudio {
  unlock(): void;
  handle(events: readonly GameEvent[], listener: { x: number; y: number }): void;
  update(ambient: AmbientModel | null, dt: number): void;
  setVolume(volume: number): void;
  setPaused(paused: boolean): void;
  ui(kind: UiSound): void;
  stopGameSounds(): void;
}

/** Délai entre l'arrivée à la balise et l'écran de fin (le temps de l'éclat de la balise). */
const END_SCREEN_DELAY = 1.1;

/** Contrôleur de l'application : seule couche qui assemble les autres (ARCHITECTURE § 2). */
export class App {
  private ui!: Ui;
  private flow: FlowState = initialFlow();
  private session: GameSession | null = null;
  private levelIndex = 0;
  private lastResult: { result: RunResult; newRecords: { time: boolean; pulses: boolean } } | null =
    null;
  private recorded = false;
  private last = 0;
  private readonly stats: FrameStats = { fps: 60, frameMs: 16.7, simMs: 0, renderMs: 0 };
  private readonly eventLog: string[] = [];
  private overlay = false;
  private reveal: boolean;
  private god: boolean;
  private readonly seed: number;
  private movementKeys = 'ZQSD / WASD';

  constructor(
    private readonly renderer: Renderer,
    private readonly input: KeyboardInput,
    private readonly audio: GameAudio,
    private readonly store: KeyValueStore,
    private save: SaveData,
    private readonly params: DebugParams,
  ) {
    this.reveal = params.reveal;
    this.god = params.god;
    this.seed = params.seed ?? Math.floor(Math.random() * 0x7fffffff);
    audio.setVolume(save.options.volume);
    if (import.meta.env.DEV || params.debug) this.attachDebug();
    onDataChanged(() => {
      if (this.session) this.startLevel(this.levelIndex);
    });
    input.onFocusLost = () => {
      if (this.flow.screen === 'playing') this.pause();
    };
    void detectMovementLabel(navigator).then((label) => {
      this.movementKeys = label;
    });
  }

  /** L'UI est créée par main.ts avec les callbacks de l'app. */
  attachUi(create: (callbacks: UiCallbacks) => Ui): void {
    this.ui = create(this.callbacks());
  }

  start(): void {
    this.showScreen();
    requestAnimationFrame(this.frame);
  }

  // --- Flux d'écrans -------------------------------------------------------------------------

  private dispatch(action: FlowAction): void {
    this.flow = reduce(this.flow, action);
    this.showScreen();
  }

  private callbacks(): UiCallbacks {
    return {
      onAnyKey: () => {
        this.audio.unlock();
        const direct = resolveLevelParam(this.params.level, gameData.catalog);
        if (direct !== null) this.startLevel(direct);
        this.dispatch({ type: 'anyKey', directLevel: direct !== null });
      },
      onPlay: () => {
        this.dispatch({ type: 'play' });
      },
      onOpenOptions: () => {
        this.dispatch({ type: 'openOptions' });
      },
      onBack: () => {
        this.dispatch({ type: 'back' });
      },
      onSelectLevel: (slug) => {
        const i = gameData.catalog.findIndex((l) => l.id === slug);
        if (i < 0 || !this.unlocked(i)) return;
        this.startLevel(i);
        this.dispatch({ type: 'selectLevel' });
      },
      onResume: () => {
        this.dispatch({ type: 'resume' });
      },
      onRestoreCheckpoint: () => {
        if (this.session) {
          this.audio.stopGameSounds();
          respawn(this.session.world);
        }
        this.dispatch({ type: 'restoreCheckpoint' });
      },
      onRestartLevel: () => {
        this.startLevel(this.levelIndex);
        this.dispatch({ type: 'restart' });
      },
      onQuitToSelect: () => {
        this.leaveLevel();
        this.dispatch({ type: 'quitToSelect' });
      },
      onNextLevel: () => {
        const isLast = this.levelIndex >= gameData.catalog.length - 1;
        if (isLast) this.leaveLevel();
        else this.startLevel(this.levelIndex + 1);
        this.dispatch({ type: 'next', isLast });
      },
      onReplay: () => {
        this.startLevel(this.levelIndex);
        this.dispatch({ type: 'replay' });
      },
      onOptionsChange: (options) => {
        this.applyOptions(options);
      },
      onUiSound: (kind) => {
        this.audio.ui(kind);
      },
    };
  }

  private showScreen(): void {
    const screen = this.flow.screen;
    this.input.setGameplay(screen === 'playing');
    this.audio.setPaused(screen !== 'playing' && this.session !== null);
    this.ui.show(this.screenModel());
  }

  private screenModel(): ScreenModel {
    const catalog = gameData.catalog;
    const levelName = catalog[this.levelIndex]?.name ?? '';
    switch (this.flow.screen) {
      case 'title':
        return { kind: 'title', phase: this.flow.titlePhase };
      case 'levelSelect': {
        const levels = catalog.map((l, i) => ({
          slug: l.id,
          number: i + 1,
          name: l.name,
          locked: !this.unlocked(i),
          stars: starsOf(this.save, l.id),
        }));
        const focus =
          levels[this.levelIndex] && !levels[this.levelIndex]!.locked
            ? levels[this.levelIndex]!.slug
            : (levels.find((l) => !l.locked && !this.save.levels[l.slug]?.completed)?.slug ?? null);
        return {
          kind: 'levelSelect',
          levels,
          stars: this.totalStars(),
          maxStars: catalog.length * 3,
          focusSlug: focus,
        };
      }
      case 'playing':
        return { kind: 'playing' };
      case 'pause':
        return {
          kind: 'pause',
          levelName,
          canRestoreCheckpoint: this.session?.world.checkpointActive ?? false,
        };
      case 'levelEnd': {
        const last = this.lastResult;
        const fallback: RunResult = {
          slug: catalog[this.levelIndex]?.id ?? '',
          time: 0,
          pulses: 0,
          par: 0,
          pearls: 0,
          pearlsTotal: 0,
          deaths: 0,
          stars: { complete: true, pearls: false, par: false },
        };
        return {
          kind: 'levelEnd',
          levelName,
          levelNumber: this.levelIndex + 1,
          result: last?.result ?? fallback,
          newRecords: last?.newRecords ?? { time: false, pulses: false },
          hasNext: this.levelIndex < catalog.length - 1,
          isLast: this.levelIndex === catalog.length - 1,
        };
      }
      case 'victory': {
        let pearls = 0;
        let maxPearls = 0;
        let time = 0;
        for (const l of catalog) {
          const parsed = parseLevel(l);
          if (parsed.ok) maxPearls += parsed.level.pearls.length;
          const rec = this.save.levels[l.id];
          pearls += rec?.bestPearls ?? 0;
          time += rec?.bestTime ?? 0;
        }
        return {
          kind: 'victory',
          stars: this.totalStars(),
          maxStars: catalog.length * 3,
          pearls,
          maxPearls,
          time,
        };
      }
      case 'options':
        return {
          kind: 'options',
          options: { ...this.save.options },
          returnTo: this.flow.optionsReturn,
        };
    }
  }

  private unlocked(index: number): boolean {
    return this.params.unlock || isUnlocked(this.save, gameData.catalog, index);
  }

  private totalStars(): number {
    return gameData.catalog.reduce((n, l) => n + countStars(starsOf(this.save, l.id)), 0);
  }

  // --- Partie --------------------------------------------------------------------------------

  private startLevel(index: number): void {
    const source = gameData.catalog[index];
    if (!source) return;
    this.audio.stopGameSounds();
    this.levelIndex = index;
    this.recorded = false;
    this.lastResult = null;
    this.session = new GameSession(
      source,
      index,
      {
        afterglowMultiplier: this.save.options.longAfterglow
          ? gameData.tuning.accessibility.longAfterglowMultiplier
          : 1,
        god: this.god,
      },
      this.seed + index,
    );
    this.renderer.controlsKeys = index === 0 ? this.movementKeys : null;
  }

  private leaveLevel(): void {
    this.audio.stopGameSounds();
    this.session = null;
  }

  private pause(): void {
    if (this.session) cancelCharge(this.session.world);
    this.dispatch({ type: 'pause' });
  }

  private applyOptions(options: Options): void {
    this.save = { ...this.save, options: { ...options } };
    this.persist();
    this.audio.setVolume(options.volume);
    if (this.session) {
      this.session.world.options.afterglowMultiplier = options.longAfterglow
        ? gameData.tuning.accessibility.longAfterglowMultiplier
        : 1;
    }
  }

  private persist(): void {
    if (!writeSave(this.store, this.save)) {
      console.warn('ÉCHO : la sauvegarde locale a été refusée par le navigateur.');
    }
  }

  /** Arrivée à la balise : enregistre la tentative, puis ouvre l'écran de fin après l'éclat. */
  private checkLevelEnd(): void {
    const world = this.session?.world;
    if (world?.state.status !== 'complete') return;
    if (!this.recorded) {
      this.recorded = true;
      const result = runResult(world);
      const recorded = recordRun(this.save, result);
      this.save = recorded.save;
      this.lastResult = { result, newRecords: recorded.newRecords };
      this.persist();
    }
    if (this.flow.screen === 'playing' && world.state.statusTimer >= END_SCREEN_DELAY) {
      this.dispatch({ type: 'levelComplete' });
    }
  }

  // --- Boucle --------------------------------------------------------------------------------

  private readonly frame = (now: number): void => {
    const dt = this.last === 0 ? 0 : Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    const screen = this.flow.screen;
    const session = this.session;
    let alpha = 1;
    if (session && screen === 'playing') {
      if (this.input.consumePause()) {
        this.pause();
      } else {
        const f = session.advance(dt, this.input, true);
        alpha = f.alpha;
        this.stats.simMs = this.stats.simMs * 0.9 + f.simMs * 0.1;
        this.logEvents(f.events);
        this.renderer.onEvents(f.events, session.world);
        this.audio.handle(f.events, session.world.state.probe.pos);
        this.checkLevelEnd();
      }
    }
    const showWorld =
      session !== null &&
      (screen === 'playing' ||
        screen === 'pause' ||
        screen === 'levelEnd' ||
        (screen === 'options' && this.flow.optionsReturn === 'pause'));
    this.audio.update(showWorld ? ambientModel(session.world) : null, dt);
    const r0 = performance.now();
    this.renderer.frame(
      { world: showWorld ? session.world : null, title: !showWorld },
      alpha,
      screen === 'playing' ? dt : 0,
      {
        debug: this.overlay,
        reveal: this.reveal,
        shake: this.save.options.screenShake,
        hud: screen === 'playing',
      },
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
        if (this.session) this.startLevel(this.levelIndex);
      },
    });
    window.__echo = {
      world: () => this.session?.world ?? null,
      loadLevel: (slugOrNumber) => {
        const i = resolveLevelParam(slugOrNumber, gameData.catalog);
        if (i === null) return;
        this.audio.unlock();
        this.startLevel(i);
        this.flow = { ...this.flow, screen: 'playing', titlePhase: 'menu' };
        this.showScreen();
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
