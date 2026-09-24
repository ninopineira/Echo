import type { LevelSource } from '../data/levels/define';
import type { KeyboardInput } from '../input/keyboard';
import type { GameEvent } from '../sim/events';
import { stepWorld } from '../sim/step';
import { mergeTuning } from '../sim/tuning';
import { buildLevel } from '../sim/validate/validate';
import { createWorld, type SimOptions, type World } from '../sim/world';
import { gameData } from './data';
import { advance } from './loop';

export function buildWorld(source: LevelSource, options: SimOptions, seed: number): World {
  const level = buildLevel(source);
  const levelTuning = gameData.levels[source.id] ?? { par: 99, beaconInterval: 3 };
  const tuning = mergeTuning(gameData.tuning, levelTuning.overrides);
  return createWorld(level, tuning, levelTuning, options, seed);
}

export interface SessionFrame {
  alpha: number;
  events: GameEvent[];
  simMs: number;
}

/** Une partie d'un niveau : le monde et son accumulateur à pas fixe. */
export class GameSession {
  world: World;
  private acc = 0;

  constructor(
    readonly source: LevelSource,
    readonly index: number,
    readonly options: SimOptions,
    readonly seed: number,
  ) {
    this.world = buildWorld(source, options, seed);
  }

  restart(): void {
    this.world = buildWorld(this.source, this.options, this.seed);
    this.acc = 0;
  }

  /** Exécute les pas de la frame et renvoie les événements produits. */
  advance(dt: number, input: KeyboardInput, running: boolean): SessionFrame {
    if (!running) return { alpha: 1, events: [], simMs: 0 };
    const a = advance(this.acc, dt);
    this.acc = a.acc;
    const t0 = performance.now();
    for (let i = 0; i < a.steps; i++) stepWorld(this.world, input.sample());
    const simMs = performance.now() - t0;
    const events = this.world.events;
    this.world.events = [];
    return { alpha: a.alpha, events, simMs };
  }
}
