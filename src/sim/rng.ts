/** RNG à graine (mulberry32). L'état est un entier stocké dans WorldState.rng. */
export function nextRandom(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomRange(s: { rng: number }, min: number, max: number): number {
  return min + (max - min) * nextRandom(s);
}

/** Hachage entier → [0,1[ sans état, pour des variations stables par instance. */
export function hash01(n: number): number {
  let t = (n | 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
