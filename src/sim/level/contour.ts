/**
 * Contour de la roche par marching squares sur les centres de cases (LEVEL_FORMAT § 4).
 * Échantillon 1 = roche (cases hors grille comprises), 0 = tout le reste.
 * Les cas ambigus (selle) relient la roche en diagonale : deux eaux qui ne se touchent
 * que par un coin ne communiquent pas.
 */

// Points milieux d'un carré (i, j) dont les coins sont les centres des cases (i..i+1, j..j+1).
const T = 0;
const R = 1;
const B = 2;
const L = 3;

// Cas = tl·8 + tr·4 + br·2 + bl·1 → paires de milieux reliés.
const CASES: readonly (readonly number[])[] = [
  [],
  [L, B],
  [B, R],
  [L, R],
  [T, R],
  [T, L, B, R],
  [T, B],
  [T, L],
  [T, L],
  [T, B],
  [T, R, L, B],
  [T, R],
  [L, R],
  [R, B],
  [L, B],
  [],
];

/**
 * Renvoie les segments à plat [ax, ay, bx, by, nx, ny, …], normale unitaire orientée vers l'eau.
 */
export function buildRockContour(width: number, height: number, rock: Uint8Array): number[] {
  const sample = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? 1 : rock[y * width + x]!;
  const out: number[] = [];
  const mx = [0, 0, 0, 0];
  const my = [0, 0, 0, 0];

  for (let j = -1; j < height; j++) {
    for (let i = -1; i < width; i++) {
      const tl = sample(i, j);
      const tr = sample(i + 1, j);
      const br = sample(i + 1, j + 1);
      const bl = sample(i, j + 1);
      const pairs = CASES[tl * 8 + tr * 4 + br * 2 + bl]!;
      if (pairs.length === 0) continue;
      mx[T] = i + 1;
      my[T] = j + 0.5;
      mx[R] = i + 1.5;
      my[R] = j + 1;
      mx[B] = i + 1;
      my[B] = j + 1.5;
      mx[L] = i + 0.5;
      my[L] = j + 1;
      for (let k = 0; k < pairs.length; k += 2) {
        const a = pairs[k]!;
        const b = pairs[k + 1]!;
        const ax = mx[a]!;
        const ay = my[a]!;
        const bx = mx[b]!;
        const by = my[b]!;
        const len = Math.hypot(bx - ax, by - ay);
        let nx = -(by - ay) / len;
        let ny = (bx - ax) / len;
        // Côté eau : valeur bilinéaire la plus faible autour du milieu.
        const px = (ax + bx) / 2 + nx * 0.2 - (i + 0.5);
        const py = (ay + by) / 2 + ny * 0.2 - (j + 0.5);
        const v = tl * (1 - px) * (1 - py) + tr * px * (1 - py) + bl * (1 - px) * py + br * px * py;
        if (v > 0.5) {
          nx = -nx;
          ny = -ny;
        }
        out.push(ax, ay, bx, by, nx, ny);
      }
    }
  }
  return out;
}
