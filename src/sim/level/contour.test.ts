import { describe, expect, it } from 'vitest';
import { source } from '../fixtures';
import { compileLevel } from './compile';
import { buildRockContour } from './contour';
import { parseLevel } from './parse';
import { SEG_STRIDE } from './types';

function segments(grid: string): number[][] {
  const r = parseLevel(source(grid));
  if (!r.ok) throw new Error('grille invalide');
  const flat = buildRockContour(r.level.width, r.level.height, r.level.rock);
  const out: number[][] = [];
  for (let i = 0; i < flat.length; i += SEG_STRIDE) out.push(flat.slice(i, i + SEG_STRIDE));
  return out;
}

describe('buildRockContour', () => {
  it('fait d’une roche isolée un pilier en losange de demi-diagonale 0,5', () => {
    const segs = segments(`
      #######
      #S....#
      #..#..#
      #....X#
      #######
    `);
    // Segments du pilier : tous leurs points à distance 0,5 (manhattan) du centre (3,5 ; 2,5).
    const pillar = segs.filter((s) =>
      [0, 2].every((k) => Math.abs(s[k]! - 3.5) + Math.abs(s[k + 1]! - 2.5) <= 0.5 + 1e-9),
    );
    expect(pillar).toHaveLength(4);
    for (const s of pillar) {
      // Normale orientée vers l'extérieur du pilier (vers l'eau).
      const mx = (s[0]! + s[2]!) / 2 - 3.5;
      const my = (s[1]! + s[3]!) / 2 - 2.5;
      expect(mx * s[4]! + my * s[5]!).toBeGreaterThan(0);
    }
  });

  it('aligne une paroi droite sur la frontière des cases, normale vers l’eau', () => {
    const segs = segments(`
      ########
      #S....X#
      ########
    `);
    const top = segs.filter((s) => s[1] === 1 && s[3] === 1);
    expect(top.length).toBeGreaterThan(0);
    for (const s of top) expect(s[5]).toBeCloseTo(1);
    const bottom = segs.filter((s) => s[1] === 2 && s[3] === 2);
    for (const s of bottom) expect(s[5]).toBeCloseTo(-1);
  });

  it('ferme les diagonales : deux eaux qui se touchent par un coin restent séparées', () => {
    const r = parseLevel(
      source(`
        #####
        #S###
        ##X##
        #####
      `),
    );
    if (!r.ok) throw new Error('grille invalide');
    const level = compileLevel(r.level);
    // Le point de contact des deux cases (2 ; 2) doit être séparé par un segment dans chaque case.
    const touching = [];
    for (let s = 0; s < level.segCount; s++) {
      const o = s * SEG_STRIDE;
      const cx = (level.segs[o]! + level.segs[o + 2]!) / 2;
      const cy = (level.segs[o + 1]! + level.segs[o + 3]!) / 2;
      if (Math.abs(cx - 2) < 0.3 && Math.abs(cy - 2) < 0.3) touching.push(s);
    }
    expect(touching).toHaveLength(2);
  });
});

describe('compileLevel', () => {
  it('ajoute les arêtes de porte et indexe les segments par case', () => {
    const r = parseLevel(
      source(`
        #######
        #S.A.X#
        #a....#
        #######
      `),
    );
    if (!r.ok) throw new Error('grille invalide');
    const level = compileLevel(r.level);
    const doorSegs = Array.from(level.segDoor).filter((d) => d === 0);
    expect(doorSegs).toHaveLength(4);
    const doorCell = 1 * level.width + 3;
    const inCell = Array.from(
      level.cellSegs.slice(level.cellStart[doorCell], level.cellStart[doorCell + 1]),
    );
    expect(inCell.some((s) => level.segDoor[s] === 0)).toBe(true);
  });
});
