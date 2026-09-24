/**
 * Limitation de voix par famille (ARCHITECTURE § 6), en logique pure testée.
 * Une voix occupe l'intervalle [start, end] de l'horloge audio. Deux voix se concurrencent si
 * leurs intervalles se chevauchent : des échos planifiés à des instants différents ne se gênent pas.
 */

export interface VoiceSlot {
  /** Début planifié (s, horloge audio). */
  start: number;
  /** Fin planifiée (s). */
  end: number;
  /** Gain effectif (niveau × spatialisation) : la voix la plus faible est coupée en premier. */
  level: number;
}

/** La voix n'est plus active à l'instant `now`. */
export function isOver(slot: VoiceSlot, now: number): boolean {
  return slot.end <= now;
}

function overlaps(a: VoiceSlot, b: VoiceSlot): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Choisit la voix à couper quand `candidate` arrive :
 * - `null` : il reste de la place (moins de `cap` voix actives chevauchent le candidat) ;
 * - `'candidate'` : le candidat est plus faible que toutes les voix concurrentes, on ne le joue pas ;
 * - un indice dans `active` : la voix concurrente la plus faible (la plus ancienne à égalité).
 */
export function pickVictim(
  active: readonly VoiceSlot[],
  candidate: VoiceSlot,
  cap: number,
): number | 'candidate' | null {
  if (cap <= 0) return 'candidate';
  let count = 0;
  let weakest = -1;
  for (let i = 0; i < active.length; i++) {
    const v = active[i]!;
    if (!overlaps(v, candidate)) continue;
    count++;
    const w = weakest >= 0 ? active[weakest]! : null;
    if (w === null || v.level < w.level || (v.level === w.level && v.start < w.start)) weakest = i;
  }
  if (count < cap || weakest < 0) return null;
  const w = active[weakest]!;
  return candidate.level < w.level ? 'candidate' : weakest;
}
