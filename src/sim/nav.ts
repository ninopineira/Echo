import type { ParsedLevel } from './level/types';

export type NavProfile = 'sound' | 'swim';

/** Coûts de propagation : le son est étouffé par la vase, la nage y est ralentie. */
export interface NavCosts {
  /** Multiplicateur de coût d'une case de vase. */
  mud: number;
}

/**
 * Champ de distance de chemin (Dijkstra, 8-voisinage, diagonale seulement si les deux cases
 * orthogonales sont libres) depuis la case `source`. Cases bloquées : roche et portes fermées.
 * Les cases hors portée valent Infinity.
 */
export function distanceField(
  level: Pick<ParsedLevel, 'width' | 'height' | 'rock' | 'door' | 'mud'>,
  isDoorOpen: (door: number) => boolean,
  source: number,
  costs: NavCosts,
  maxDist = Infinity,
): Float32Array {
  const { width, height, rock, door, mud } = level;
  const size = width * height;
  // Calcul en double précision : un arrondi float32 ferait passer des entrées du tas pour périmées.
  const dist = new Float64Array(size).fill(Infinity);
  const blocked = (i: number): boolean => {
    if (rock[i] === 1) return true;
    const d = door[i]!;
    return d >= 0 && !isDoorOpen(d);
  };
  if (source < 0 || source >= size || blocked(source)) return Float32Array.from(dist);

  // Tas binaire minimal sur (distance, case).
  const heapCell: number[] = [];
  const heapDist: number[] = [];
  const push = (cell: number, d: number): void => {
    let i = heapCell.length;
    heapCell.push(cell);
    heapDist.push(d);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapDist[p]! <= d) break;
      heapCell[i] = heapCell[p]!;
      heapDist[i] = heapDist[p]!;
      i = p;
    }
    heapCell[i] = cell;
    heapDist[i] = d;
  };
  const pop = (): number => {
    const top = heapCell[0]!;
    const lastCell = heapCell.pop()!;
    const lastDist = heapDist.pop()!;
    const n = heapCell.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && heapDist[r]! < heapDist[l]! ? r : l;
        if (heapDist[c]! >= lastDist) break;
        heapCell[i] = heapCell[c]!;
        heapDist[i] = heapDist[c]!;
        i = c;
      }
      heapCell[i] = lastCell;
      heapDist[i] = lastDist;
    }
    return top;
  };

  dist[source] = 0;
  push(source, 0);
  while (heapCell.length > 0) {
    const d0 = heapDist[0]!;
    const cell = pop();
    if (d0 > dist[cell]!) continue;
    const x = cell % width;
    const y = (cell - x) / width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (blocked(n)) continue;
        const diagonal = dx !== 0 && dy !== 0;
        if (diagonal && (blocked(y * width + nx) || blocked(ny * width + x))) continue;
        const step = (diagonal ? Math.SQRT2 : 1) * (mud[n] === 1 ? costs.mud : 1);
        const nd = d0 + step;
        if (nd < dist[n]! && nd <= maxDist) {
          dist[n] = nd;
          push(n, nd);
        }
      }
    }
  }
  return Float32Array.from(dist);
}
