import { clamp } from '../sim/math/vec';

/**
 * Courbes pures : réglages des sons continus en fonction de l'état du jeu, et formes de
 * WaveShaper. Aucune dépendance Web Audio : testé en environnement node.
 */

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Curseur de volume (0..1) → gain du bus maître. */
export function volumeToGain(volume: number, exponent: number): number {
  return Math.pow(clamp(volume, 0, 1), exponent);
}

/** Choc contre une paroi : intensité (0..1) → facteur de gain ; un frôlement reste audible. */
export function bumpLevel(intensity: number): number {
  return 0.3 + 0.7 * clamp(intensity, 0, 1);
}

/** Proximité du Léviathan (0 loin ou endormi, 1 au contact) d'après sa distance de chemin. */
export function leviathanProximity(
  pathDistance: number | null,
  range: number,
  exponent: number,
): number {
  if (pathDistance === null || range <= 0) return 0;
  return Math.pow(clamp(1 - pathDistance / range, 0, 1), exponent);
}

/** Hauteur du bourdonnement de charge : monte de `octaves` quand la charge va de 0 à 1. */
export function chargePitch(charge01: number, start: number, octaves: number): number {
  return start * Math.pow(2, clamp(charge01, 0, 1) * octaves);
}

/**
 * Niveau relatif du bourdonnement de charge (0..1) : muet au tout début (un appui bref ne doit
 * pas bourdonner), puis présent et un peu plus fort vers la fin.
 */
export function chargeLevel(charge01: number | null, fadeStart: number, fadeEnd: number): number {
  if (charge01 === null) return 0;
  const c = clamp(charge01, 0, 1);
  return smoothstep(fadeStart, fadeEnd, c) * (0.7 + 0.3 * c);
}

/** Cadence de la pulsation de chasse (Hz) selon le nombre de Guetteurs en alerte ou en chasse. */
export function huntRate(count: number, base: number, perCreature: number, max: number): number {
  if (count <= 0) return base;
  return Math.min(max, base + perCreature * (count - 1));
}

/**
 * Compensation de foule des échos : pour chaque écho, 1 / n^exposant, où n est le nombre
 * d'échos (lui compris) qui arrivent à moins de `window` secondes de lui.
 */
export function crowdFactors(
  delays: readonly number[],
  window: number,
  exponent: number,
): number[] {
  const out: number[] = [];
  for (const a of delays) {
    let n = 0;
    for (const b of delays) if (Math.abs(a - b) <= window) n++;
    out.push(1 / Math.pow(Math.max(1, n), exponent));
  }
  return out;
}

/** Saturation douce : y = tanh(drive · x) / tanh(drive), sur [−1, 1]. */
export function softClipCurve(drive: number, size = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  const k = Math.max(1e-3, drive);
  const norm = Math.tanh(k);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

export interface Bump {
  /** Position dans la période (0..1). */
  center: number;
  /** Demi-largeur gaussienne (fraction de période). */
  width: number;
  height: number;
}

/**
 * Forme d'impulsions périodiques pour un WaveShaper piloté par un LFO en dents de scie :
 * l'entrée x ∈ [−1, 1] est lue comme la phase (x + 1) / 2, la sortie est une somme de bosses
 * gaussiennes (0..1). Les extrémités valent ~0, donc le saut de la dent de scie ne claque pas.
 */
export function pulseTrainCurve(bumps: readonly Bump[], size = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const phase = i / (size - 1);
    let y = 0;
    for (const b of bumps) {
      const u = (phase - b.center) / b.width;
      y += b.height * Math.exp(-u * u);
    }
    curve[i] = Math.min(1, y);
  }
  return curve;
}

/** Battement de cœur « lub-dub » (pulsation de chasse). */
export const HEARTBEAT: readonly Bump[] = [
  { center: 0.14, width: 0.045, height: 1 },
  { center: 0.34, width: 0.05, height: 0.6 },
];

/** Pulsation unique et ronde (alarme de coque critique). */
export const SLOW_PULSE: readonly Bump[] = [{ center: 0.5, width: 0.13, height: 1 }];
