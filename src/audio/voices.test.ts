import { describe, expect, it } from 'vitest';
import { isOver, pickVictim, type VoiceSlot } from './voices';

const slot = (start: number, end: number, level: number): VoiceSlot => ({ start, end, level });

describe('pickVictim', () => {
  it('laisse passer tant que le plafond n’est pas atteint', () => {
    expect(pickVictim([], slot(0, 1, 0.5), 2)).toBeNull();
    expect(pickVictim([slot(0, 1, 0.5)], slot(0, 1, 0.5), 2)).toBeNull();
  });

  it('coupe la voix concurrente la plus faible', () => {
    const active = [slot(0, 1, 0.8), slot(0, 1, 0.2), slot(0, 1, 0.5)];
    expect(pickVictim(active, slot(0.5, 1.5, 0.6), 3)).toBe(1);
  });

  it('ne joue pas un candidat plus faible que toutes les voix concurrentes', () => {
    const active = [slot(0, 1, 0.8), slot(0, 1, 0.5)];
    expect(pickVictim(active, slot(0, 1, 0.1), 2)).toBe('candidate');
  });

  it('à égalité, coupe la plus ancienne plutôt que le candidat', () => {
    const active = [slot(0.2, 1, 0.5), slot(0.1, 1, 0.5)];
    expect(pickVictim(active, slot(0.3, 1, 0.5), 2)).toBe(1);
  });

  it('ignore les voix dont l’intervalle ne chevauche pas le candidat (échos planifiés)', () => {
    const active = [slot(0, 0.2, 0.9), slot(0.25, 0.4, 0.9)];
    expect(pickVictim(active, slot(1, 1.2, 0.1), 1)).toBeNull();
    expect(pickVictim(active, slot(0.1, 0.3, 0.1), 1)).toBe('candidate');
  });

  it('plafond nul : rien ne joue', () => {
    expect(pickVictim([], slot(0, 1, 1), 0)).toBe('candidate');
  });
});

describe('isOver', () => {
  it('une voix est terminée une fois sa fin passée', () => {
    expect(isOver(slot(0, 1, 1), 0.5)).toBe(false);
    expect(isOver(slot(0, 1, 1), 1)).toBe(true);
  });
});
