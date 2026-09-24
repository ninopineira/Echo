import type { Vec2 } from '../sim/math/vec';

export type GameAction = 'up' | 'down' | 'left' | 'right' | 'pulse' | 'throw' | 'pause';

/** Codes physiques (KeyboardEvent.code) : ZQSD en AZERTY = WASD en QWERTY. */
const CODE_ACTIONS: Readonly<Record<string, GameAction>> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'pulse',
  KeyE: 'throw',
  Escape: 'pause',
};

export function actionForCode(code: string): GameAction | null {
  return CODE_ACTIONS[code] ?? null;
}

/** Direction de nage normalisée (la diagonale n'est pas plus rapide). */
export function moveFromActions(held: ReadonlySet<GameAction>): Vec2 {
  let x = 0;
  let y = 0;
  if (held.has('left')) x -= 1;
  if (held.has('right')) x += 1;
  if (held.has('up')) y -= 1;
  if (held.has('down')) y += 1;
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}
