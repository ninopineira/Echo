import type { ParsedLevel } from '../level/types';

export interface ReachResult {
  /** Distance en pas (4-connexité) depuis le départ, -1 si inatteignable, au point fixe des portes. */
  steps: Int32Array;
  /** Parent de chaque case sur l'arbre de parcours (-1 pour le départ ou inatteignable). */
  parent: Int32Array;
  /** Portes ouvertes au point fixe. */
  openDoors: Set<number>;
  /** Cases d'oursin (infranchissables pour ce calcul). */
  hazard: Uint8Array;
}

// Directions : 0 haut, 1 droite, 2 bas, 3 gauche.
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/**
 * Atteignabilité depuis le départ (LEVEL_FORMAT § 6) : 4-connexité, roche, oursins et portes fermées
 * bloquent, les leviers atteints ouvrent leurs portes jusqu'à stabilité. Avec `strongCurrents`,
 * on ne peut ni entrer dans une case de courant ni en sortir à contre-sens.
 */
export function computeReach(level: ParsedLevel, strongCurrents: boolean): ReachResult {
  const { width, height, rock, door, current } = level;
  const size = width * height;
  const hazard = new Uint8Array(size);
  for (const h of level.hazards) hazard[h.y * width + h.x] = 1;
  const openDoors = new Set<number>();
  const steps = new Int32Array(size);
  const parent = new Int32Array(size);
  const doorOfLetter = new Map(level.doors.map((d, i) => [d.letter, i]));
  const start = level.start.y * width + level.start.x;

  const passable = (i: number): boolean => {
    if (rock[i] === 1 || hazard[i] === 1) return false;
    const d = door[i]!;
    return d < 0 || openDoors.has(d);
  };

  for (;;) {
    steps.fill(-1);
    parent.fill(-1);
    steps[start] = 0;
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
      const a = queue[q]!;
      const ax = a % width;
      const ay = (a - ax) / width;
      for (let d = 0; d < 4; d++) {
        const bx = ax + DX[d]!;
        const by = ay + DY[d]!;
        if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
        const b = by * width + bx;
        if (steps[b] !== -1 || !passable(b)) continue;
        if (strongCurrents) {
          const against = (d + 2) % 4;
          if (current[b] === against || current[a] === against) continue;
        }
        steps[b] = steps[a]! + 1;
        parent[b] = a;
        queue.push(b);
      }
    }
    let changed = false;
    for (const lever of level.levers) {
      const d = doorOfLetter.get(lever.letter);
      if (d === undefined || openDoors.has(d)) continue;
      if (steps[lever.cell.y * width + lever.cell.x] !== -1) {
        openDoors.add(d);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { steps, parent, openDoors, hazard };
}

/** Chemin (liste de cases) du départ à `target` selon l'arbre de parcours, vide si inatteignable. */
export function pathTo(reach: ReachResult, target: number): number[] {
  if (reach.steps[target] === -1) return [];
  const path: number[] = [];
  for (let c = target; c !== -1; c = reach.parent[c]!) path.push(c);
  return path.reverse();
}
