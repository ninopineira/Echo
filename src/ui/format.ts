import type { StarSet } from '../sim/scoring';

/** Formatage des nombres affichés par l'UI. Fonctions pures, sans texte (les mots sont dans strings.ts). */

/** Espace insécable, pour que « 14 / 30 » ne se coupe pas en fin de ligne. */
export const NBSP = ' ';
/** Espace fine insécable, avant « % » (typographie française). */
export const NNBSP = ' ';

/** Pas du volume au clavier et nombre de segments de la jauge (GDD § 4 : par pas de 5). */
export const VOLUME_STEP_PERCENT = 5;
export const VOLUME_SEGMENTS = 100 / VOLUME_STEP_PERCENT;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Durée en secondes → « m:ss », ou « h:mm:ss » à partir d'une heure. Secondes tronquées. */
export function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** « 14 / 30 », avec des espaces insécables. */
export function formatFraction(value: number, total: number): string {
  return `${value}${NBSP}/${NBSP}${total}`;
}

/** Volume 0..1 → pourcentage entier borné 0..100. */
export function volumePercent(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return Math.min(100, Math.max(0, Math.round(volume * 100)));
}

/** Volume 0..1 → « 80 % ». */
export function formatPercent(volume: number): string {
  return `${volumePercent(volume)}${NNBSP}%`;
}

/**
 * Volume suivant au clavier : le cran de 5 % voisin dans la direction demandée, borné à 0..1.
 * Un volume hors grille (0,83) se range sur la grille (0,85 vers le haut, 0,80 vers le bas).
 */
export function stepVolume(volume: number, direction: -1 | 1): number {
  const pct = volumePercent(volume);
  const next =
    direction > 0
      ? Math.floor(pct / VOLUME_STEP_PERCENT) * VOLUME_STEP_PERCENT + VOLUME_STEP_PERCENT
      : Math.ceil(pct / VOLUME_STEP_PERCENT) * VOLUME_STEP_PERCENT - VOLUME_STEP_PERCENT;
  return Math.min(100, Math.max(0, next)) / 100;
}

/** Position relative sur la jauge (0 = bord gauche, 1 = bord droit) → volume 0..1 par crans de 5 %. */
export function volumeFromRatio(ratio: number): number {
  const r = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return (Math.round(r * VOLUME_SEGMENTS) * VOLUME_STEP_PERCENT) / 100;
}

/** Nombre d'étoiles obtenues (0 à 3). L'UI n'importe de sim que des types (ARCHITECTURE § 3). */
export function earnedStars(stars: StarSet): number {
  return (stars.complete ? 1 : 0) + (stars.pearls ? 1 : 0) + (stars.par ? 1 : 0);
}

/** Nombre de segments allumés de la jauge pour un volume donné. */
export function litSegments(volume: number): number {
  return Math.floor(volumePercent(volume) / VOLUME_STEP_PERCENT);
}
