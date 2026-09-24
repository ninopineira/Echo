import type { LevelSource } from '../data/levels/define';
import { TUNING, type DeepPartial, type Tuning } from '../data/tuning';
import { emptyInput, type InputFrame } from './inputFrame';
import { compileLevel } from './level/compile';
import { parseLevel } from './level/parse';
import { stepWorld } from './step';
import { mergeTuning } from './tuning';
import { createWorld, type World } from './world';

/** Source de niveau minimale pour les tests. */
export function source(grid: string, id = 'test'): LevelSource {
  return { id, name: id, hint: '', grid };
}

export interface FixtureOptions {
  tuning?: DeepPartial<Tuning>;
  par?: number;
  beaconInterval?: number;
  seed?: number;
  afterglowMultiplier?: number;
  god?: boolean;
}

/** Monde de test construit depuis une grille ASCII (lève une erreur si la grille est invalide). */
export function worldFromGrid(grid: string, options: FixtureOptions = {}): World {
  const parsed = parseLevel(source(grid));
  if (!parsed.ok) throw new Error(parsed.errors.map((e) => `${e.code} ${e.message}`).join('; '));
  const tuning = mergeTuning(TUNING, options.tuning);
  return createWorld(
    compileLevel(parsed.level),
    tuning,
    { par: options.par ?? 10, beaconInterval: options.beaconInterval ?? 3 },
    { afterglowMultiplier: options.afterglowMultiplier ?? 1, god: options.god ?? false },
    options.seed ?? 1,
  );
}

export function input(partial: Partial<InputFrame> = {}): InputFrame {
  return { ...emptyInput(), ...partial };
}

/** Exécute `steps` pas avec la même entrée ; renvoie tous les événements produits. */
export function run(world: World, steps: number, frame: InputFrame = input()): World['events'] {
  const all: World['events'] = [];
  for (let i = 0; i < steps; i++) {
    stepWorld(world, i === 0 ? frame : { ...frame, pulsePressed: false, pulseReleased: false, throwPressed: false });
    all.push(...world.events);
    world.events = [];
  }
  return all;
}

/** Secondes → nombre de pas. */
export function seconds(s: number): number {
  return Math.round(s * 120);
}
