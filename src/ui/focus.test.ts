import { describe, expect, it } from 'vitest';
import { cycleIndex, gridStep, isWakeKey, keyAction, listStep, type KeyLike } from './focus';
import { selectNavigate } from './screens/levelSelect';

function key(code: string, mods: Partial<KeyLike> = {}): KeyLike {
  return { code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods };
}

describe('keyAction', () => {
  it('accepte les flèches et ZQSD/WASD par position physique', () => {
    expect(keyAction(key('ArrowUp'))).toEqual({ kind: 'move', dir: 'up' });
    expect(keyAction(key('KeyW'))).toEqual({ kind: 'move', dir: 'up' });
    expect(keyAction(key('KeyA'))).toEqual({ kind: 'move', dir: 'left' });
    expect(keyAction(key('KeyS'))).toEqual({ kind: 'move', dir: 'down' });
    expect(keyAction(key('KeyD'))).toEqual({ kind: 'move', dir: 'right' });
    expect(keyAction(key('ArrowRight'))).toEqual({ kind: 'move', dir: 'right' });
  });

  it('valide avec Entrée ou Espace, revient avec Échap', () => {
    expect(keyAction(key('Enter'))).toEqual({ kind: 'activate' });
    expect(keyAction(key('NumpadEnter'))).toEqual({ kind: 'activate' });
    expect(keyAction(key('Space'))).toEqual({ kind: 'activate' });
    expect(keyAction(key('Escape'))).toEqual({ kind: 'back' });
  });

  it('garde Tab dans l’écran', () => {
    expect(keyAction(key('Tab'))).toEqual({ kind: 'cycle', step: 1 });
    expect(keyAction(key('Tab', { shiftKey: true }))).toEqual({ kind: 'cycle', step: -1 });
  });

  it('laisse passer les raccourcis et les autres touches', () => {
    expect(keyAction(key('ArrowLeft', { altKey: true }))).toBeNull();
    expect(keyAction(key('KeyW', { ctrlKey: true }))).toBeNull();
    expect(keyAction(key('KeyE'))).toBeNull();
    expect(keyAction(key('F5'))).toBeNull();
  });
});

describe('isWakeKey', () => {
  it('accepte les touches ordinaires', () => {
    expect(isWakeKey(key('Space'))).toBe(true);
    expect(isWakeKey(key('Enter'))).toBe(true);
    expect(isWakeKey(key('KeyQ'))).toBe(true);
    expect(isWakeKey(key('ArrowDown'))).toBe(true);
  });

  it('ignore Échap, les modificateurs, Tab et les touches de fonction', () => {
    expect(isWakeKey(key('Escape'))).toBe(false);
    expect(isWakeKey(key('ShiftLeft'))).toBe(false);
    expect(isWakeKey(key('AltRight'))).toBe(false);
    expect(isWakeKey(key('Tab'))).toBe(false);
    expect(isWakeKey(key('F1'))).toBe(false);
    expect(isWakeKey(key('F12'))).toBe(false);
    expect(isWakeKey(key('KeyR', { ctrlKey: true }))).toBe(false);
  });
});

describe('listStep', () => {
  it('liste verticale : haut/bas, gauche/droite ignorées', () => {
    expect(listStep(0, 3, 'down', 'vertical', false)).toBe(1);
    expect(listStep(1, 3, 'up', 'vertical', false)).toBe(0);
    expect(listStep(1, 3, 'left', 'vertical', false)).toBeNull();
  });

  it('boucle aux extrémités si demandé', () => {
    expect(listStep(2, 3, 'down', 'vertical', true)).toBe(0);
    expect(listStep(0, 3, 'up', 'vertical', true)).toBe(2);
    expect(listStep(2, 3, 'down', 'vertical', false)).toBeNull();
  });

  it('rangée de boutons : les quatre directions', () => {
    expect(listStep(0, 3, 'right', 'both', false)).toBe(1);
    expect(listStep(1, 3, 'down', 'both', false)).toBe(2);
    expect(listStep(1, 3, 'left', 'both', false)).toBe(0);
    expect(listStep(0, 3, 'up', 'horizontal', false)).toBeNull();
  });

  it('liste vide', () => {
    expect(listStep(0, 0, 'down', 'vertical', true)).toBeNull();
  });
});

describe('gridStep (5 colonnes)', () => {
  it('gauche/droite suivent l’ordre des niveaux, d’une rangée à l’autre', () => {
    expect(gridStep(4, 10, 5, 'right')).toBe(5);
    expect(gridStep(5, 10, 5, 'left')).toBe(4);
    expect(gridStep(0, 10, 5, 'left')).toBeNull();
    expect(gridStep(9, 10, 5, 'right')).toBeNull();
  });

  it('haut/bas changent de rangée', () => {
    expect(gridStep(2, 10, 5, 'down')).toBe(7);
    expect(gridStep(7, 10, 5, 'up')).toBe(2);
    expect(gridStep(2, 10, 5, 'up')).toBeNull();
    expect(gridStep(7, 10, 5, 'down')).toBeNull();
  });

  it('vers une rangée incomplète, s’arrête sur sa dernière case', () => {
    expect(gridStep(4, 7, 5, 'down')).toBe(6);
    expect(gridStep(1, 7, 5, 'down')).toBe(6);
    expect(gridStep(0, 7, 5, 'down')).toBe(5);
  });
});

describe('cycleIndex', () => {
  it('boucle dans les deux sens', () => {
    expect(cycleIndex(2, 3, 1)).toBe(0);
    expect(cycleIndex(0, 3, -1)).toBe(2);
  });
});

describe('selectNavigate', () => {
  it('descend de la dernière rangée vers Retour et remonte vers la dernière case visitée', () => {
    let last = 7;
    const nav = selectNavigate(10, 5, () => last);
    expect(nav(7, 'down')).toBe(10);
    expect(nav(2, 'down')).toBe(7);
    expect(nav(10, 'up')).toBe(7);
    last = 3;
    expect(nav(10, 'up')).toBe(3);
    expect(nav(10, 'left')).toBeNull();
    expect(nav(10, 'down')).toBeNull();
  });
});
