import type { Vec2 } from './math/vec';

/** Entrées d'un pas de simulation, produites par input/ (ARCHITECTURE § 7). */
export interface InputFrame {
  /** Direction de nage, longueur ≤ 1. */
  move: Vec2;
  pulseHeld: boolean;
  /** Front montant depuis le dernier échantillon. */
  pulsePressed: boolean;
  /** Front descendant depuis le dernier échantillon. */
  pulseReleased: boolean;
  throwPressed: boolean;
}

export function emptyInput(): InputFrame {
  return {
    move: { x: 0, y: 0 },
    pulseHeld: false,
    pulsePressed: false,
    pulseReleased: false,
    throwPressed: false,
  };
}
