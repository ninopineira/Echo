import {
  DOOR_CHARS,
  LEGEND,
  LEVER_CHARS,
  type CellKind,
  type LegendChar,
  type LevelSource,
} from '../../data/levels/define';
import type { Cell, DoorDef, ParsedLevel } from './types';

export type ParseCode = 'E01' | 'E02' | 'E03' | 'E04';

export interface ParseError {
  code: ParseCode;
  message: string;
  /** Rangée (1 = première ligne de la grille). */
  row?: number;
  /** Colonne (1 = premier caractère). */
  col?: number;
}

export type ParseResult = { ok: true; level: ParsedLevel } | { ok: false; errors: ParseError[] };

/** Lignes utiles de la grille : espaces de bord retirés, lignes vides de début et de fin ignorées. */
export function gridLines(grid: string): string[] {
  const lines = grid.split(/\r?\n/).map((line) => line.trim());
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start] === '') start++;
  while (end > start && lines[end - 1] === '') end--;
  return lines.slice(start, end);
}

function legendKind(ch: string): CellKind | null {
  return Object.hasOwn(LEGEND, ch) ? LEGEND[ch as LegendChar] : null;
}

const CURRENT_DIRS: Partial<Record<CellKind, number>> = {
  currentUp: 0,
  currentRight: 1,
  currentDown: 2,
  currentLeft: 3,
};

export function parseLevel(src: LevelSource): ParseResult {
  const errors: ParseError[] = [];
  const lines = gridLines(src.grid);
  if (lines.length === 0) {
    return { ok: false, errors: [{ code: 'E01', message: 'grille vide' }] };
  }
  const height = lines.length;
  const width = lines[0]!.length;
  lines.forEach((line, y) => {
    if (line === '') {
      errors.push({ code: 'E01', message: 'ligne vide au milieu de la grille', row: y + 1 });
    } else if (line.length !== width) {
      errors.push({
        code: 'E01',
        message: `largeur ${line.length} au lieu de ${width}`,
        row: y + 1,
      });
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  const size = width * height;
  const rock = new Uint8Array(size);
  const mud = new Uint8Array(size);
  const current = new Int8Array(size).fill(-1);
  const door = new Int8Array(size).fill(-1);
  const starts: Cell[] = [];
  const exits: Cell[] = [];
  const leviathans: Cell[] = [];
  const level: Omit<ParsedLevel, 'start' | 'exit' | 'leviathan'> = {
    id: src.id,
    name: src.name,
    hint: src.hint,
    width,
    height,
    rock,
    mud,
    current,
    door,
    pearls: [],
    hazards: [],
    capsules: [],
    checkpoints: [],
    guetteurs: [],
    levers: [],
    doors: [],
    currents: [],
  };
  const doorByLetter = new Map<string, number>();

  for (let y = 0; y < height; y++) {
    const line = lines[y]!;
    for (let x = 0; x < width; x++) {
      const ch = line[x]!;
      const i = y * width + x;
      const cell = { x, y };
      if (LEVER_CHARS.includes(ch)) {
        level.levers.push({ letter: ch.toUpperCase(), cell });
        continue;
      }
      if (DOOR_CHARS.includes(ch)) {
        let d = doorByLetter.get(ch);
        if (d === undefined) {
          d = level.doors.length;
          doorByLetter.set(ch, d);
          level.doors.push({ letter: ch, cells: [] } satisfies DoorDef);
        }
        level.doors[d]!.cells.push(cell);
        door[i] = d;
        continue;
      }
      const kind = legendKind(ch);
      if (kind === null) {
        errors.push({
          code: 'E02',
          message: `caractère inconnu « ${ch} »`,
          row: y + 1,
          col: x + 1,
        });
        continue;
      }
      switch (kind) {
        case 'rock':
          rock[i] = 1;
          break;
        case 'water':
          break;
        case 'start':
          starts.push(cell);
          break;
        case 'exit':
          exits.push(cell);
          break;
        case 'pearl':
          level.pearls.push(cell);
          break;
        case 'hazard':
          level.hazards.push(cell);
          break;
        case 'mud':
          mud[i] = 1;
          break;
        case 'lure':
          level.capsules.push(cell);
          break;
        case 'checkpoint':
          level.checkpoints.push(cell);
          break;
        case 'guetteur':
          level.guetteurs.push(cell);
          break;
        case 'leviathan':
          leviathans.push(cell);
          break;
        case 'currentUp':
        case 'currentRight':
        case 'currentDown':
        case 'currentLeft': {
          const dir = CURRENT_DIRS[kind]!;
          current[i] = dir;
          level.currents.push({ cell, dir });
          break;
        }
      }
    }
  }

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      if (rock[y * width + x] !== 1) {
        errors.push({ code: 'E03', message: 'pourtour non fermé', row: y + 1, col: x + 1 });
      }
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      if (rock[y * width + x] !== 1) {
        errors.push({ code: 'E03', message: 'pourtour non fermé', row: y + 1, col: x + 1 });
      }
    }
  }
  if (starts.length !== 1) {
    errors.push({ code: 'E04', message: `${starts.length} départ(s) « S » au lieu de 1` });
  }
  if (exits.length !== 1) {
    errors.push({ code: 'E04', message: `${exits.length} balise(s) « X » au lieu de 1` });
  }
  if (leviathans.length > 1) {
    errors.push({ code: 'E04', message: `${leviathans.length} Léviathans « L » (1 au plus)` });
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    level: { ...level, start: starts[0]!, exit: exits[0]!, leviathan: leviathans[0] ?? null },
  };
}
