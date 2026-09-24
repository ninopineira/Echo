import type { Vec2 } from '../math/vec';

export interface Cell {
  x: number;
  y: number;
}

export interface LeverDef {
  letter: string;
  cell: Cell;
}

export interface DoorDef {
  letter: string;
  cells: Cell[];
}

export interface CurrentDef {
  cell: Cell;
  /** 0 haut, 1 droite, 2 bas, 3 gauche. */
  dir: number;
}

/** Résultat de l'analyse d'une grille (LEVEL_FORMAT § 2–3). */
export interface ParsedLevel {
  id: string;
  name: string;
  hint: string;
  width: number;
  height: number;
  /** 1 = roche. Indexé par y * width + x. */
  rock: Uint8Array;
  /** 1 = vase. */
  mud: Uint8Array;
  /** Direction du courant de la case, -1 sinon. */
  current: Int8Array;
  /** Indice de porte (dans `doors`) de la case, -1 sinon. */
  door: Int8Array;
  start: Cell;
  exit: Cell;
  pearls: Cell[];
  hazards: Cell[];
  capsules: Cell[];
  checkpoints: Cell[];
  guetteurs: Cell[];
  leviathan: Cell | null;
  levers: LeverDef[];
  doors: DoorDef[];
  currents: CurrentDef[];
}

/** Segments stockés à plat : ax, ay, bx, by, nx, ny (normale unitaire vers l'eau). */
export const SEG_STRIDE = 6;

export interface CompiledLevel extends ParsedLevel {
  segs: Float32Array;
  segCount: number;
  /** Porte du segment, -1 pour la roche. */
  segDoor: Int16Array;
  /** Index spatial CSR : segments de la case i dans cellSegs[cellStart[i] .. cellStart[i+1]). */
  cellStart: Int32Array;
  cellSegs: Int32Array;
}

export function cellIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

export function cellCenter(c: Cell): Vec2 {
  return { x: c.x + 0.5, y: c.y + 0.5 };
}

export function inGrid(level: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < level.width && y < level.height;
}
