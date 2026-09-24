import { describe, expect, it } from 'vitest';
import { actionForCode, moveFromActions, type GameAction } from './bindings';

describe('bindings', () => {
  it('lit les touches par position physique (ZQSD = WASD) et les flèches', () => {
    expect(actionForCode('KeyW')).toBe('up');
    expect(actionForCode('KeyA')).toBe('left');
    expect(actionForCode('ArrowDown')).toBe('down');
    expect(actionForCode('Space')).toBe('pulse');
    expect(actionForCode('KeyE')).toBe('throw');
    expect(actionForCode('Escape')).toBe('pause');
    expect(actionForCode('KeyZ')).toBeNull();
  });

  it('normalise la diagonale et annule les directions opposées', () => {
    const diag = moveFromActions(new Set<GameAction>(['up', 'right']));
    expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1);
    expect(moveFromActions(new Set<GameAction>(['left', 'right']))).toEqual({ x: 0, y: 0 });
  });
});
