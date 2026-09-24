import { describe, expect, it } from 'vitest';
import { TUNING, type DeepPartial, type Tuning } from '../../data/tuning';
import { source } from '../fixtures';
import { validateCatalog, validateLevel } from './validate';

/** Exemple complet de docs/LEVEL_FORMAT.md § 7. */
const EXAMPLE = `
  ##############################
  #S........#.......#..........#
  #.........#...o...#...~~~~...#
  #...*.....#.......A...~~~~...#
  #.........>>>>>>>>A...~~~~.X.#
  #....a....#....P..#..........#
  ####.#######...*..#..........#
  #o.....+......#...#..........#
  ##############################
`;

function check(
  grid: string,
  opts: { par?: number; overrides?: DeepPartial<Tuning>; position?: number } = {},
): { codes: string[]; errors: string[]; report: ReturnType<typeof validateLevel> } {
  const report = validateLevel(
    source(grid, 'fixture'),
    { par: opts.par ?? 5, beaconInterval: 3, ...(opts.overrides ? { overrides: opts.overrides } : {}) },
    TUNING,
    opts.position ?? null,
  );
  return {
    report,
    codes: report.diagnostics.map((d) => d.code),
    errors: report.diagnostics.filter((d) => d.severity === 'error').map((d) => d.code),
  };
}

describe('validateLevel', () => {
  it('accepte l’exemple de LEVEL_FORMAT avec le seul avertissement W03', () => {
    const { codes, report } = check(EXAMPLE);
    expect(codes).toEqual(['W03']);
    expect(report.stats?.pathLength).toBeGreaterThan(20);
    expect(report.stats?.parSuggestion).toBeGreaterThanOrEqual(1);
  });

  it('remonte les erreurs d’analyse (E02) avec leur position', () => {
    const { report } = check('#####\n#S?X#\n#####');
    expect(report.diagnostics[0]).toMatchObject({ code: 'E02', severity: 'error' });
    expect(report.diagnostics[0]!.message).toContain('rangée 2');
  });

  it('balise inatteignable (E07) et perle inatteignable (E08)', () => {
    const { errors } = check(`
      #########
      #S.#o..X#
      #########
    `);
    expect(errors).toContain('E07');
    expect(errors).toContain('E08');
  });

  it('les oursins bloquent un couloir d’une case', () => {
    const { errors } = check(`
      #########
      #So.*..X#
      #########
    `);
    expect(errors).toContain('E07');
  });

  it('porte sans levier (E09) et porte jamais ouvrable (E10)', () => {
    expect(
      check(`
        #########
        #So.A..X#
        #########
      `).errors,
    ).toContain('E09');
    expect(
      check(`
        ##########
        #So.A..aX#
        ##########
      `).errors,
    ).toEqual(expect.arrayContaining(['E07', 'E10']));
  });

  it('ouvre les portes au point fixe quand le levier est atteignable', () => {
    const { errors } = check(`
      ##########
      #Soa.A..X#
      ##########
    `);
    expect(errors).toEqual([]);
  });

  it('niveau sans perle (E11)', () => {
    expect(
      check(`
        #######
        #S...X#
        #######
      `).errors,
    ).toContain('E11');
  });

  it('Guetteur trop proche du départ (E12)', () => {
    expect(
      check(`
        ####################
        #So...G...........X#
        ####################
      `).errors,
    ).toContain('E12');
  });

  it('courant infranchissable à contre-sens si strength ≥ thrust', () => {
    const grid = `
      ##########
      #So<<<<.X#
      ##########
    `;
    expect(check(grid).errors).toEqual([]);
    expect(check(grid, { overrides: { current: { strength: 20 } } }).errors).toContain('E07');
  });

  it('élément avant son niveau d’introduction (W06) et par hors bornes (W04)', () => {
    const { codes } = check(
      `
        #########
        #So.*...#
        #......X#
        #########
      `,
      { position: 1, par: 40 },
    );
    expect(codes).toEqual(expect.arrayContaining(['W06', 'W04']));
  });
});

describe('validateCatalog', () => {
  it('signale les doublons (E05), les entrées manquantes et orphelines (E06)', () => {
    const lvl = source(EXAMPLE, 'exemple');
    const report = validateCatalog([lvl, lvl], { orpheline: { par: 3, beaconInterval: 2 } }, TUNING);
    const levelCodes = report.reports.flatMap((r) => r.diagnostics.map((d) => d.code));
    expect(levelCodes).toContain('E05');
    expect(levelCodes).toContain('E06');
    expect(report.catalog.map((d) => d.code)).toEqual(['E06']);
  });
});
