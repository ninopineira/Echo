import { describe, expect, it } from 'vitest';
import { movementLabel } from './layout';

describe('movementLabel', () => {
  it('affiche les lettres réelles de la disposition', () => {
    expect(movementLabel(['z', 'q', 's', 'd'])).toBe('ZQSD');
    expect(movementLabel(['w', 'a', 's', 'd'])).toBe('WASD');
  });

  it('se rabat sur « ZQSD / WASD » sans information', () => {
    expect(movementLabel([])).toBe('ZQSD / WASD');
    expect(movementLabel(['z', undefined, 's', 'd'])).toBe('ZQSD / WASD');
  });
});
