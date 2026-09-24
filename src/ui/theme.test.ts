import { describe, expect, it } from 'vitest';
import { PALETTE } from '../data/palette';
import { starPath, sonarArc } from './icons';
import { starRevealDelays, STAR_REVEAL_FIRST_MS, STAR_REVEAL_STEP_MS } from './screens/levelEnd';
import { themeVariables } from './theme';

describe('themeVariables', () => {
  it('pose une variable --c-<clé> par couleur de la palette', () => {
    const vars = new Map(themeVariables());
    expect(vars.size).toBe(Object.keys(PALETTE).length);
    expect(vars.get('--c-background')).toBe('#04070C');
    expect(vars.get('--c-sonar')).toBe('#5CE1E6');
    expect(vars.get('--c-textMuted')).toBe(PALETTE.textMuted);
  });
});

describe('pictogrammes', () => {
  it('trace une étoile fermée à dix sommets, pointe en haut', () => {
    const d = starPath(12, 12, 10, 4);
    expect(d.startsWith('M12 2')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/[ML]/g)).toHaveLength(10);
  });

  it('trace un arc sonar symétrique ouvert vers la droite', () => {
    expect(sonarArc(0, 0, 10, 90)).toBe('M0 -10A10 10 0 0 1 0 10');
  });
});

describe('starRevealDelays', () => {
  it('allume les étoiles une à une', () => {
    expect(starRevealDelays(false)).toEqual([
      STAR_REVEAL_FIRST_MS,
      STAR_REVEAL_FIRST_MS + STAR_REVEAL_STEP_MS,
      STAR_REVEAL_FIRST_MS + 2 * STAR_REVEAL_STEP_MS,
    ]);
  });

  it('sans délai quand les animations sont réduites', () => {
    expect(starRevealDelays(true)).toEqual([0, 0, 0]);
  });
});
