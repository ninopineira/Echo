import { buildRockContour } from './contour';
import { SEG_STRIDE, type CompiledLevel, type ParsedLevel } from './types';

/** Arêtes d'une case : [dx voisin, dy voisin, ax, ay, bx, by, nx, ny] relatifs à la case. */
const EDGES: readonly (readonly number[])[] = [
  [0, -1, 0, 0, 1, 0, 0, -1],
  [1, 0, 1, 0, 1, 1, 1, 0],
  [0, 1, 0, 1, 1, 1, 0, 1],
  [-1, 0, 0, 0, 0, 1, -1, 0],
];

/** Géométrie de collision, de rayons et de rendu (ARCHITECTURE § 4.4). */
export function compileLevel(parsed: ParsedLevel): CompiledLevel {
  const { width, height } = parsed;
  const flat = buildRockContour(width, height, parsed.rock);
  const doorOf: number[] = new Array<number>(flat.length / SEG_STRIDE).fill(-1);

  parsed.doors.forEach((door, d) => {
    for (const cell of door.cells) {
      for (const e of EDGES) {
        const nx = cell.x + e[0]!;
        const ny = cell.y + e[1]!;
        const inside = nx >= 0 && ny >= 0 && nx < width && ny < height;
        if (inside && parsed.door[ny * width + nx] === d) continue;
        flat.push(cell.x + e[2]!, cell.y + e[3]!, cell.x + e[4]!, cell.y + e[5]!, e[6]!, e[7]!);
        doorOf.push(d);
      }
    }
  });

  const segCount = flat.length / SEG_STRIDE;
  const segs = new Float32Array(flat);
  const segDoor = new Int16Array(doorOf);

  // Index spatial : chaque segment est rangé dans toutes les cases que sa boîte touche.
  const cells = width * height;
  const counts = new Int32Array(cells + 1);
  const forEachCell = (s: number, fn: (c: number) => void): void => {
    const o = s * SEG_STRIDE;
    const ax = segs[o]!;
    const ay = segs[o + 1]!;
    const bx = segs[o + 2]!;
    const by = segs[o + 3]!;
    const eps = 1e-4;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - eps));
    const x1 = Math.min(width - 1, Math.floor(Math.max(ax, bx) + eps));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - eps));
    const y1 = Math.min(height - 1, Math.floor(Math.max(ay, by) + eps));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) fn(y * width + x);
    }
  };
  for (let s = 0; s < segCount; s++) {
    forEachCell(s, (c) => {
      counts[c + 1]!++;
    });
  }
  const cellStart = new Int32Array(cells + 1);
  for (let c = 0; c < cells; c++) cellStart[c + 1] = cellStart[c]! + counts[c + 1]!;
  const cursor = cellStart.slice(0, cells);
  const cellSegs = new Int32Array(cellStart[cells]!);
  for (let s = 0; s < segCount; s++) {
    forEachCell(s, (c) => {
      cellSegs[cursor[c]!++] = s;
    });
  }

  return { ...parsed, segs, segCount, segDoor, cellStart, cellSegs };
}
