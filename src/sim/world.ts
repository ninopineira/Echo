import type { LevelTuning, Tuning } from '../data/tuning';
import type { GameEvent, NoiseSource, PulseKind } from './events';
import { cellCenter, type CompiledLevel } from './level/types';
import type { Vec2 } from './math/vec';
import { randomRange } from './rng';

export interface SimOptions {
  /** Multiplicateur de rémanence (option d'accessibilité). */
  afterglowMultiplier: number;
  /** Aucun dégât (debug). */
  god: boolean;
}

export const SURFACE_NONE = 0;
export const SURFACE_ROCK = 1;
export const SURFACE_DOOR = 2;
export const SURFACE_ABSORBED = 3;

export interface Pulse {
  id: number;
  kind: PulseKind;
  ox: number;
  oy: number;
  /** Temps monde de l'émission. */
  start: number;
  speed: number;
  maxRadius: number;
  /** Rémanence, option d'accessibilité déjà appliquée. */
  afterglow: number;
  hitDist: Float32Array;
  hitSurface: Uint8Array;
  /** Plus grande distance d'arrêt : au-delà, le front n'avance plus nulle part. */
  maxHit: number;
  /** Rayon du front au pas précédent (révélation des objets). */
  lastRadius: number;
}

export type RevealKind =
  | 'pearl'
  | 'hazard'
  | 'capsule'
  | 'lever'
  | 'door'
  | 'checkpoint'
  | 'current'
  | 'guetteur'
  | 'leviathan'
  | 'lure'
  | 'wallArc';

/** Image rémanente figée à l'endroit où le front (ou un choc) l'a touchée. */
export interface Reveal {
  kind: RevealKind;
  /** Indice de l'objet dans sa liste (ou direction de courant). */
  ref: number;
  x: number;
  y: number;
  angle: number;
  at: number;
  fade: number;
  radius: number;
}

export interface Noise {
  x: number;
  y: number;
  loudness: number;
  source: NoiseSource;
}

export interface ProbeState {
  pos: Vec2;
  prev: Vec2;
  vel: Vec2;
  facing: Vec2;
  hull: number;
  /** Invulnérabilité restante (s). */
  invuln: number;
  lures: number;
  energy: number;
  /** Durée de la charge en cours (s), -1 sans charge. */
  charge: number;
  /** Recharge restante (s) et durée totale de la dernière recharge. */
  cooldown: number;
  cooldownMax: number;
  bumpCooldown: number;
}

export interface LureBody {
  id: number;
  pos: Vec2;
  prev: Vec2;
  vel: Vec2;
  landed: boolean;
  pingsLeft: number;
  pingTimer: number;
}

export type GuetteurMode = 'wander' | 'alert' | 'hunt' | 'search' | 'retreat';

export interface GuetteurState {
  kind: 'guetteur';
  id: number;
  pos: Vec2;
  prev: Vec2;
  vel: Vec2;
  home: Vec2;
  mode: GuetteurMode;
  /** Minuterie de l'état courant (s). */
  timer: number;
  /** Cible de déplacement (point d'errance, origine du bruit…). */
  target: Vec2 | null;
  /** Origine du dernier bruit entendu (centre de la fouille). */
  noiseOrigin: Vec2 | null;
  heading: number;
  clickTimer: number;
}

export interface LeviathanState {
  kind: 'leviathan';
  id: number;
  pos: Vec2;
  prev: Vec2;
  heading: number;
  awake: boolean;
  wakeTimer: number;
  /** Élan courant (cases/s), décroît avec le temps. */
  surge: number;
  /** Temps écoulé depuis le réveil (s). */
  awakeTime: number;
}

export type Creature = GuetteurState | LeviathanState;

export interface WorldState {
  rng: number;
  status: 'playing' | 'dying' | 'complete';
  /** Temps écoulé dans l'état courant de `status`. */
  statusTimer: number;
  probe: ProbeState;
  pulses: Pulse[];
  reveals: Reveal[];
  pearls: { x: number; y: number; taken: boolean }[];
  capsules: { x: number; y: number; taken: boolean }[];
  lures: LureBody[];
  levers: { letter: string; x: number; y: number; pulled: boolean }[];
  doors: { letter: string; progress: number; opening: boolean }[];
  checkpoints: { x: number; y: number; active: boolean }[];
  creatures: Creature[];
  /** Temps restant avant le prochain signal de la balise. */
  beaconTimer: number;
  /** Incrémenté à chaque ouverture de porte (invalide les champs de distance). */
  doorsVersion: number;
  pendingNoises: Noise[];
}

export interface RunStats {
  time: number;
  pulses: number;
  deaths: number;
}

/**
 * Monde d'une partie (ARCHITECTURE § 4.1). `time`, `tick`, `nextId` et `stats` sont monotones et
 * ne sont jamais restaurés au point de contrôle ; les minuteries de `state` sont des comptes à rebours.
 */
export interface World {
  readonly level: CompiledLevel;
  readonly tuning: Tuning;
  readonly levelTuning: LevelTuning;
  readonly options: SimOptions;
  state: WorldState;
  stats: RunStats;
  /** Instantané de reprise : départ, puis dernier point de contrôle activé. */
  checkpoint: WorldState;
  checkpointActive: boolean;
  events: GameEvent[];
  time: number;
  tick: number;
  nextId: number;
  navCache: Map<string, Float32Array>;
}

function cloneValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(cloneValue);
  if (typeof v === 'object' && v !== null) {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = cloneValue(x);
    return o;
  }
  return v;
}

/** Copie profonde de l'état, sans les éléments éphémères (impulsions, révélations, leurres en vol). */
export function snapshotState(s: WorldState): WorldState {
  return cloneValue({ ...s, pulses: [], reveals: [], pendingNoises: [], lures: [] }) as WorldState;
}

export function createWorld(
  level: CompiledLevel,
  tuning: Tuning,
  levelTuning: LevelTuning,
  options: SimOptions,
  seed: number,
): World {
  const start = cellCenter(level.start);
  const rngHolder = { rng: seed | 0 };
  let nextId = 1;
  const creatures: Creature[] = level.guetteurs.map((c) => {
    const pos = cellCenter(c);
    return {
      kind: 'guetteur',
      id: nextId++,
      pos,
      prev: { ...pos },
      vel: { x: 0, y: 0 },
      home: { ...pos },
      mode: 'wander',
      timer: randomRange(rngHolder, 0, tuning.guetteur.wanderPauseMax),
      target: null,
      noiseOrigin: null,
      heading: 0,
      clickTimer: randomRange(rngHolder, 0, tuning.guetteur.clickInterval),
    };
  });
  if (level.leviathan) {
    const pos = cellCenter(level.leviathan);
    creatures.push({
      kind: 'leviathan',
      id: nextId++,
      pos,
      prev: { ...pos },
      heading: 0,
      awake: false,
      wakeTimer: tuning.leviathan.wakeDelay,
      surge: 0,
      awakeTime: 0,
    });
  }
  const state: WorldState = {
    rng: rngHolder.rng,
    status: 'playing',
    statusTimer: 0,
    probe: {
      pos: { ...start },
      prev: { ...start },
      vel: { x: 0, y: 0 },
      facing: { x: 1, y: 0 },
      hull: tuning.probe.hullMax,
      invuln: 0,
      lures: 0,
      energy: tuning.energy.max,
      charge: -1,
      cooldown: 0,
      cooldownMax: 1,
      bumpCooldown: 0,
    },
    pulses: [],
    reveals: [],
    pearls: level.pearls.map((c) => ({ ...cellCenter(c), taken: false })),
    capsules: level.capsules.map((c) => ({ ...cellCenter(c), taken: false })),
    lures: [],
    levers: level.levers.map((l) => ({ letter: l.letter, ...cellCenter(l.cell), pulled: false })),
    doors: level.doors.map((d) => ({ letter: d.letter, progress: 0, opening: false })),
    checkpoints: level.checkpoints.map((c) => ({ ...cellCenter(c), active: false })),
    creatures,
    beaconTimer: 0.6,
    doorsVersion: 0,
    pendingNoises: [],
  };
  return {
    level,
    tuning,
    levelTuning,
    options,
    state,
    stats: { time: 0, pulses: 0, deaths: 0 },
    checkpoint: snapshotState(state),
    checkpointActive: false,
    events: [],
    time: 0,
    tick: 0,
    nextId,
    navCache: new Map(),
  };
}

/** Case (indice) contenant le point, bornée à la grille. */
export function cellAt(level: CompiledLevel, x: number, y: number): number {
  const cx = Math.min(level.width - 1, Math.max(0, Math.floor(x)));
  const cy = Math.min(level.height - 1, Math.max(0, Math.floor(y)));
  return cy * level.width + cx;
}

export function isDoorOpen(world: World, door: number): boolean {
  const d = world.state.doors[door];
  return d !== undefined && d.progress >= 1;
}
