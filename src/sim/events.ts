import type { Vec2 } from './math/vec';

export type PulseKind = 'short' | 'long';
export type CreatureKind = 'guetteur' | 'leviathan';
export type NoiseSource = 'pulse' | 'bump' | 'lure' | 'door';
export type EchoSurface =
  'rock' | 'door' | 'hazard' | 'pearl' | 'creature' | 'lever' | 'capsule' | 'checkpoint';

export interface Echo {
  /** Secondes après l'émission : 2 × distance / speed. */
  delay: number;
  /** Radians, 0 = +x, sens horaire à l'écran (+y vers le bas). */
  angle: number;
  /** Cases. */
  distance: number;
  surface: EchoSurface;
}

/** Contrat avec l'audio, le rendu et l'app (ARCHITECTURE § 4.3). */
export type GameEvent =
  | { type: 'pulseEmitted'; kind: PulseKind; pos: Vec2 }
  | { type: 'pulseEchoes'; origin: Vec2; kind: PulseKind; echoes: Echo[] }
  | { type: 'pulseDenied'; reason: 'cooldown' | 'energy' }
  | { type: 'chargeStarted'; pos: Vec2 }
  | { type: 'wallBump'; pos: Vec2; intensity: number }
  | { type: 'pearlCollected'; pos: Vec2; remaining: number }
  | { type: 'capsulePicked'; pos: Vec2; carried: number }
  | { type: 'lureThrown'; pos: Vec2; dir: Vec2 }
  | { type: 'lureEmpty' }
  | { type: 'lureBounce'; pos: Vec2 }
  | { type: 'lurePing'; pos: Vec2 }
  | { type: 'leverPulled'; pos: Vec2; letter: string }
  | { type: 'doorOpening'; pos: Vec2; letter: string }
  | { type: 'doorOpened'; letter: string }
  | { type: 'checkpointReached'; pos: Vec2 }
  | { type: 'beaconPing'; pos: Vec2 }
  | { type: 'noise'; pos: Vec2; loudness: number; source: NoiseSource }
  | { type: 'creatureClick'; id: number; pos: Vec2 }
  | { type: 'creatureAlerted'; id: number; kind: CreatureKind; pos: Vec2; target: Vec2 }
  | { type: 'creatureAttack'; id: number; pos: Vec2 }
  | { type: 'leviathanWoke'; pos: Vec2 }
  | { type: 'damage'; source: 'hazard' | 'creature'; pos: Vec2; hull: number }
  | { type: 'probeDestroyed'; pos: Vec2 }
  | { type: 'respawn'; pos: Vec2; fromCheckpoint: boolean }
  | { type: 'levelComplete'; pos: Vec2 };

export type GameEventType = GameEvent['type'];
