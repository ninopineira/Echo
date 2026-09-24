import { describe, expect, it } from 'vitest';
import { source } from '../fixtures';
import { gridLines, parseLevel } from './parse';

describe('gridLines', () => {
  it('retire l’indentation, les lignes vides de bord et accepte \\r\\n', () => {
    expect(gridLines('\r\n   ###\r\n   #S#\r\n   ###\r\n  ')).toEqual(['###', '#S#', '###']);
  });
});

describe('parseLevel', () => {
  it('analyse une grille valide avec objets, courants, portes et leviers', () => {
    const r = parseLevel(
      source(`
        ########
        #S.o*~>#
        #a.A.A.#
        #P+G.vX#
        ########
      `),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const l = r.level;
    expect([l.width, l.height]).toEqual([8, 5]);
    expect(l.start).toEqual({ x: 1, y: 1 });
    expect(l.exit).toEqual({ x: 6, y: 3 });
    expect(l.pearls).toEqual([{ x: 3, y: 1 }]);
    expect(l.hazards).toEqual([{ x: 4, y: 1 }]);
    expect(l.mud[1 * 8 + 5]).toBe(1);
    expect(l.currents).toEqual([
      { cell: { x: 6, y: 1 }, dir: 1 },
      { cell: { x: 5, y: 3 }, dir: 2 },
    ]);
    expect(l.levers).toEqual([{ letter: 'A', cell: { x: 1, y: 2 } }]);
    expect(l.doors).toEqual([{ letter: 'A', cells: [{ x: 3, y: 2 }, { x: 5, y: 2 }] }]);
    expect(l.door[2 * 8 + 3]).toBe(0);
    expect(l.checkpoints).toHaveLength(1);
    expect(l.capsules).toHaveLength(1);
    expect(l.guetteurs).toHaveLength(1);
    expect(l.leviathan).toBeNull();
  });

  it('signale une grille non rectangulaire (E01) avec la rangée', () => {
    const r = parseLevel(source('#####\n#S.X#\n####'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatchObject({ code: 'E01', row: 3 });
  });

  it('refuse une ligne vide au milieu (E01)', () => {
    const r = parseLevel(source('#####\n\n#S.X#\n#####'));
    expect(!r.ok && r.errors[0]!.code).toBe('E01');
  });

  it('positionne un caractère inconnu (E02)', () => {
    const r = parseLevel(source('#####\n#S?X#\n#####'));
    expect(!r.ok && r.errors[0]).toMatchObject({ code: 'E02', row: 2, col: 3 });
  });

  it('exige un pourtour de roche (E03)', () => {
    const r = parseLevel(source('#####\nS..X#\n#####'));
    expect(!r.ok && r.errors.some((e) => e.code === 'E03')).toBe(true);
  });

  it('exige exactement un départ et une balise (E04)', () => {
    const r = parseLevel(source('#####\n#S.S#\n#####'));
    expect(!r.ok && r.errors.filter((e) => e.code === 'E04')).toHaveLength(2);
  });
});
