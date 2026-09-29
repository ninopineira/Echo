import { describe, expect, it } from 'vitest';
import { compileLevel } from './level/compile';
import { parseLevel } from './level/parse';
import { source } from './fixtures';
import { distanceField } from './nav';

function level(grid: string): ReturnType<typeof compileLevel> {
  const r = parseLevel(source(grid));
  if (!r.ok) throw new Error('grille invalide');
  return compileLevel(r.level);
}

describe('distanceField', () => {
  it('distance de chemin en 8-voisinage, diagonale √2', () => {
    const l = level(`
      #######
      #S....#
      #.....#
      #....X#
      #######
    `);
    const f = distanceField(l, () => false, 1 * 7 + 1, { mud: 1 });
    expect(f[1 * 7 + 5]).toBeCloseTo(4);
    expect(f[3 * 7 + 3]).toBeCloseTo(2 * Math.SQRT2);
    expect(f[3 * 7 + 5]).toBeCloseTo(2 * Math.SQRT2 + 2);
  });

  it('contourne la roche et refuse la diagonale entre deux roches', () => {
    const l = level(`
      ######
      #S#..#
      ##..X#
      ######
    `);
    const f = distanceField(l, () => false, 1 * 6 + 1, { mud: 1 });
    expect(f[2 * 6 + 2]).toBe(Infinity);
  });

  it('la vase coûte plus cher et les portes fermées bloquent', () => {
    const l = level(`
      #########
      #S~~~..X#
      #.......#
      #a..A...#
      #########
    `);
    const src = 1 * 9 + 1;
    const plain = distanceField(l, () => false, src, { mud: 1 });
    const muddy = distanceField(l, () => false, src, { mud: 3 });
    expect(muddy[1 * 9 + 5]!).toBeGreaterThan(plain[1 * 9 + 5]!);
    const closed = distanceField(l, () => false, src, { mud: 1 });
    const open = distanceField(l, () => true, src, { mud: 1 });
    expect(closed[3 * 9 + 4]).toBe(Infinity);
    expect(open[3 * 9 + 4]).toBeCloseTo(2 * Math.SQRT2 + 1);
  });

  it('part des voisines quand la source est une porte fermée (grondement de porte)', () => {
    const l = level(`
      #########
      #S..A..X#
      #a..A...#
      #########
    `);
    const f = distanceField(l, () => false, 1 * 9 + 4, { mud: 1 });
    expect(f[1 * 9 + 3]).toBeCloseTo(1);
    expect(f[1 * 9 + 5]).toBeCloseTo(1);
    expect(f[2 * 9 + 4]).toBe(Infinity);
  });

  it('borne la portée', () => {
    const l = level(`
      ############
      #S........X#
      ############
    `);
    const f = distanceField(l, () => false, 1 * 12 + 1, { mud: 1 }, 3);
    expect(f[1 * 12 + 4]).toBeCloseTo(3);
    expect(f[1 * 12 + 5]).toBe(Infinity);
  });
});
