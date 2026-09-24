/**
 * Courbe de révélation (GDD § 5) : rien avant le contact, éclat blanc-cyan pendant `flash`,
 * puis effacement doux sur `fade` secondes (lisible longtemps, disparition franche à la fin).
 * Renvoie l'opacité 0..1 ; `elapsed` = temps écoulé depuis le contact du front.
 */
export function revealAlpha(elapsed: number, flash: number, fade: number): number {
  if (elapsed < 0) return 0;
  if (elapsed < flash) return 1;
  const u = (elapsed - flash) / Math.max(1e-6, fade);
  if (u >= 1) return 0;
  return 1 - u * u;
}

/** Vrai pendant l'éclat qui suit le contact. */
export function isFlashing(elapsed: number, flash: number): boolean {
  return elapsed >= 0 && elapsed < flash;
}

/** Nombre de paliers d'opacité utilisés pour regrouper les tracés. */
export const ALPHA_BUCKETS = 8;

/** Palier d'une opacité (0..1) : 0..ALPHA_BUCKETS-1. */
export function alphaBucket(alpha: number): number {
  return Math.min(ALPHA_BUCKETS - 1, Math.max(0, Math.floor(alpha * ALPHA_BUCKETS)));
}

/** Opacité représentative d'un palier. */
export function bucketAlpha(bucket: number): number {
  return (bucket + 0.5) / ALPHA_BUCKETS;
}
