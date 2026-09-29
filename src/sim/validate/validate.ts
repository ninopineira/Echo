import type { LevelSource } from '../../data/levels/define';
import type { LevelTuning, Tuning } from '../../data/tuning';
import { gridLines, parseLevel } from '../level/parse';
import { compileLevel } from '../level/compile';
import type { ParsedLevel } from '../level/types';
import { distanceField } from '../nav';
import { mergeTuning } from '../tuning';
import { computeReach, pathTo } from './reach';

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
}

export interface LevelStats {
  width: number;
  height: number;
  /** Plus court chemin sûr de S à X (cases), null si inatteignable. */
  pathLength: number | null;
  parSuggestion: number | null;
  par: number | null;
  pearls: number;
  /** Cases du plus court chemin (pour l'affichage détaillé). */
  path: number[];
}

export interface LevelReport {
  id: string;
  name: string;
  diagnostics: Diagnostic[];
  stats: LevelStats | null;
  /** Lignes de la grille, pour l'affichage détaillé. */
  lines: string[];
}

export interface CatalogReport {
  reports: LevelReport[];
  /** Problèmes qui ne concernent pas un seul niveau (entrées LEVELS orphelines, doublons). */
  catalog: Diagnostic[];
}

/** Niveau d'introduction de chaque élément (GDD § 7.2), pour l'avertissement W06. */
const INTRODUCED_AT: readonly { what: string; level: number; has: (l: ParsedLevel) => boolean }[] =
  [
    { what: 'oursin', level: 3, has: (l) => l.hazards.length > 0 },
    { what: 'courant', level: 4, has: (l) => l.currents.length > 0 },
    { what: 'Guetteur', level: 5, has: (l) => l.guetteurs.length > 0 },
    { what: 'leurre', level: 6, has: (l) => l.capsules.length > 0 },
    {
      what: 'levier, porte ou point de contrôle',
      level: 7,
      has: (l) => l.levers.length + l.doors.length + l.checkpoints.length > 0,
    },
    { what: 'vase', level: 8, has: (l) => l.mud.includes(1) },
    { what: 'Léviathan', level: 10, has: (l) => l.leviathan !== null },
  ];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Valide un niveau (LEVEL_FORMAT § 6). `position` = rang 1-based dans le catalogue (W06), ou null.
 */
export function validateLevel(
  src: LevelSource,
  levelTuning: LevelTuning | undefined,
  baseTuning: Tuning,
  position: number | null,
): LevelReport {
  const diagnostics: Diagnostic[] = [];
  const error = (code: string, message: string): void => {
    diagnostics.push({ code, severity: 'error', message });
  };
  const warn = (code: string, message: string): void => {
    diagnostics.push({ code, severity: 'warning', message });
  };
  const report: LevelReport = {
    id: src.id,
    name: src.name,
    diagnostics,
    stats: null,
    lines: gridLines(src.grid),
  };

  if (!SLUG.test(src.id)) error('E05', `identifiant « ${src.id} » invalide (slug attendu)`);
  if (!levelTuning) {
    error('E06', `entrée LEVELS['${src.id}'] manquante dans tuning.ts`);
  } else {
    if (!(levelTuning.par >= 1)) error('E06', `par ${levelTuning.par} < 1`);
    if (!(levelTuning.beaconInterval > 0)) {
      error('E06', `beaconInterval ${levelTuning.beaconInterval} ≤ 0`);
    }
  }

  const parsed = parseLevel(src);
  if (!parsed.ok) {
    for (const e of parsed.errors) {
      const where =
        e.row !== undefined
          ? ` (rangée ${e.row}${e.col !== undefined ? `, colonne ${e.col}` : ''})`
          : '';
      error(e.code, `${e.message}${where}`);
    }
    return report;
  }
  const level = parsed.level;
  const tuning = mergeTuning(baseTuning, levelTuning?.overrides);
  const { width, height } = level;
  const idx = (c: { x: number; y: number }): number => c.y * width + c.x;
  const fmt = (c: { x: number; y: number }): string => `(${c.x}, ${c.y})`;

  // Leviers et portes.
  const leverLetters = new Map<string, number>();
  for (const l of level.levers) leverLetters.set(l.letter, (leverLetters.get(l.letter) ?? 0) + 1);
  for (const [letter, n] of leverLetters) {
    if (n > 1) error('E09', `${n} leviers « ${letter.toLowerCase()} » (1 au plus)`);
    if (!level.doors.some((d) => d.letter === letter)) {
      error('E09', `levier « ${letter.toLowerCase()} » sans porte « ${letter} »`);
    }
  }
  for (const d of level.doors) {
    if (!leverLetters.has(d.letter)) error('E09', `porte « ${d.letter} » sans levier`);
  }

  // Atteignabilité.
  const strongCurrents = tuning.current.strength >= tuning.probe.thrust;
  const reach = computeReach(level, strongCurrents);
  const reached = (c: { x: number; y: number }): boolean => reach.steps[idx(c)] !== -1;
  const exitIndex = idx(level.exit);
  if (!reached(level.exit))
    error('E07', `balise ${fmt(level.exit)} inatteignable depuis le départ`);
  const checkReach = (what: string, cells: { x: number; y: number }[]): void => {
    for (const c of cells) if (!reached(c)) error('E08', `${what} ${fmt(c)} inatteignable`);
  };
  checkReach('perle', level.pearls);
  checkReach('capsule', level.capsules);
  checkReach(
    'levier',
    level.levers.map((l) => l.cell),
  );
  checkReach('point de contrôle', level.checkpoints);
  level.doors.forEach((d, i) => {
    if (leverLetters.has(d.letter) && !reach.openDoors.has(i)) {
      error('E10', `porte « ${d.letter} » jamais ouvrable (levier inatteignable)`);
    }
  });

  // Perles.
  if (level.pearls.length === 0) error('E11', 'aucune perle (au moins une par niveau)');
  for (const p of level.pearls) {
    let open = 0;
    let mud = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const i = (p.y + dy) * width + (p.x + dx);
        if (level.rock[i] === 1) continue;
        open++;
        if (level.mud[i] === 1) mud++;
      }
    }
    if (open > 0 && mud === open) error('E11', `perle ${fmt(p)} entourée de vase (jamais révélée)`);
  }

  // Distances de chemin des créatures (portes ouvrables ouvertes).
  const doorOpen = (d: number): boolean => reach.openDoors.has(d);
  const soundFrom = (c: { x: number; y: number }): Float32Array =>
    distanceField(level, doorOpen, idx(c), { mud: tuning.mud.soundCostMultiplier });
  const safeSpots = [level.start, ...level.checkpoints];
  const minHearing = tuning.guetteur.hearingRadius + 3;
  for (const g of level.guetteurs) {
    const field = soundFrom(g);
    for (const spot of safeSpots) {
      const d = field[idx(spot)]!;
      if (d < minHearing) {
        const what = spot === level.start ? 'du départ' : `du point de contrôle ${fmt(spot)}`;
        error('E12', `Guetteur ${fmt(g)} à ${d.toFixed(1)} cases ${what} (minimum ${minHearing})`);
      }
    }
    // W05 : couloir d'une case dans le territoire.
    const swim = distanceField(
      level,
      doorOpen,
      idx(g),
      { mud: tuning.mud.swimCostMultiplier },
      tuning.guetteur.wanderRadius,
    );
    const blocked = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= width || y >= height) return true;
      const i = y * width + x;
      return level.rock[i] === 1 || level.door[i]! >= 0;
    };
    let narrow = 0;
    for (let i = 0; i < width * height; i++) {
      if (!Number.isFinite(swim[i]!)) continue;
      const x = i % width;
      const y = (i - x) / width;
      if ((blocked(x - 1, y) && blocked(x + 1, y)) || (blocked(x, y - 1) && blocked(x, y + 1))) {
        narrow++;
      }
    }
    if (narrow > 0) {
      warn('W05', `${narrow} case(s) de couloir étroit dans le territoire du Guetteur ${fmt(g)}`);
    }
  }
  if (level.leviathan) {
    const field = distanceField(level, doorOpen, idx(level.leviathan), {
      mud: tuning.mud.swimCostMultiplier,
    });
    const d = field[idx(level.start)]!;
    if (d < 20) {
      error(
        'E13',
        `Léviathan à ${Number.isFinite(d) ? d.toFixed(1) : '∞'} cases du départ (minimum 20)`,
      );
    }
  }

  // Avertissements.
  if (width > 160 || height > 100) warn('W01', `grille ${width} × ${height} (> 160 × 100)`);
  const occupied = new Set<number>(
    [
      ...level.pearls,
      ...level.capsules,
      ...level.checkpoints,
      ...level.guetteurs,
      ...level.levers.map((l) => l.cell),
      level.exit,
      ...(level.leviathan ? [level.leviathan] : []),
    ].map(idx),
  );
  const seen = new Uint8Array(width * height);
  let emptyPockets = 0;
  for (let i = 0; i < width * height; i++) {
    const free = (j: number): boolean =>
      level.rock[j] !== 1 && reach.hazard[j] !== 1 && level.door[j]! < 0 && reach.steps[j] === -1;
    if (seen[i] === 1 || !free(i)) continue;
    let hasContent = false;
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const c = stack.pop()!;
      if (occupied.has(c)) hasContent = true;
      const x = c % width;
      const y = (c - x) / width;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (seen[n] === 1 || !free(n)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (!hasContent) emptyPockets++;
  }
  if (emptyPockets > 0) warn('W02', `${emptyPockets} poche(s) d'eau inaccessible(s) et vide(s)`);
  if (level.capsules.length > 0 && level.guetteurs.length === 0 && !level.leviathan) {
    warn('W03', 'capsules de leurre sans aucune créature');
  }
  if (position !== null) {
    for (const intro of INTRODUCED_AT) {
      if (intro.has(level) && position < intro.level) {
        warn(
          'W06',
          `${intro.what} utilisé au niveau ${position}, introduit au niveau ${intro.level}`,
        );
      }
    }
  }

  const path = pathTo(reach, exitIndex);
  const pathLength = path.length > 0 ? path.length - 1 : null;
  const parSuggestion =
    pathLength === null
      ? null
      : Math.max(1, Math.ceil(pathLength / (0.6 * tuning.pulse.short.radius)));
  const par = levelTuning?.par ?? null;
  if (
    par !== null &&
    parSuggestion !== null &&
    (par < parSuggestion * 0.5 || par > parSuggestion * 2)
  ) {
    warn('W04', `par ${par} hors de [0,5 ; 2] × suggestion (${parSuggestion})`);
  }
  report.stats = {
    width,
    height,
    pathLength,
    parSuggestion,
    par,
    pearls: level.pearls.length,
    path,
  };
  return report;
}

/** Valide tout le catalogue, dans l'ordre de jeu. */
export function validateCatalog(
  catalog: readonly LevelSource[],
  levels: Readonly<Record<string, LevelTuning>>,
  tuning: Tuning,
): CatalogReport {
  const catalogDiagnostics: Diagnostic[] = [];
  const ids = new Set<string>();
  const reports = catalog.map((src, i) => {
    const report = validateLevel(src, levels[src.id], tuning, i + 1);
    if (ids.has(src.id)) {
      report.diagnostics.push({
        code: 'E05',
        severity: 'error',
        message: `identifiant « ${src.id} » dupliqué`,
      });
    }
    ids.add(src.id);
    return report;
  });
  for (const id of Object.keys(levels)) {
    if (!ids.has(id)) {
      catalogDiagnostics.push({
        code: 'E06',
        severity: 'error',
        message: `entrée LEVELS['${id}'] orpheline (aucun niveau de ce slug dans le catalogue)`,
      });
    }
  }
  return { reports, catalog: catalogDiagnostics };
}

/** Vrai si le rapport ne contient aucune erreur (les avertissements sont tolérés). */
export function isValid(report: CatalogReport): boolean {
  return (
    report.catalog.every((d) => d.severity !== 'error') &&
    report.reports.every((r) => r.diagnostics.every((d) => d.severity !== 'error'))
  );
}

/** Compile un niveau valide (lève une erreur lisible sinon). */
export function buildLevel(src: LevelSource): ReturnType<typeof compileLevel> {
  const parsed = parseLevel(src);
  if (!parsed.ok) {
    throw new Error(
      `Niveau « ${src.id} » invalide : ${parsed.errors.map((e) => `${e.code} ${e.message}`).join(' ; ')}`,
    );
  }
  return compileLevel(parsed.level);
}
