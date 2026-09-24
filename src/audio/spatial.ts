import { clamp, type Vec2 } from '../sim/math/vec';

/**
 * Spatialisation pure (ARCHITECTURE § 6) : pan, gain et coupure passe-bas d'un son selon sa
 * position par rapport à la sonde. Aucune dépendance Web Audio : testé en environnement node.
 *
 * Repère : cases, +x vers la droite, +y vers le bas de l'écran.
 */

/** Paramètres d'une voix positionnée. */
export interface Spatial {
  /** −1 (gauche) .. 1 (droite). */
  pan: number;
  /** Gain de distance, 0..1. */
  gain: number;
  /** Coupure passe-bas (Hz) : haut de l'écran plus clair, bas plus sourd, loin plus sombre. */
  cutoff: number;
  /** Distance à la sonde (cases). */
  distance: number;
}

export interface DistanceRange {
  /** Distance (cases) où le gain vaut 1/2. */
  falloff: number;
  /** Plancher de gain : la source reste audible de partout. */
  minGain?: number;
  /** Au-delà, silence ; le gain s'éteint sur les derniers MAX_DISTANCE_FADE × maxDistance. */
  maxDistance?: number;
}

export interface PanRange extends DistanceRange {
  /** Décalage horizontal (cases) qui donne un pan complet. */
  panRange: number;
}

export interface EchoRange {
  /** Largeur stéréo des échos : pan = cos(angle) × panWidth. */
  panWidth: number;
  falloff: number;
}

export interface BrightnessRange {
  cutoffUp: number;
  cutoffSide: number;
  cutoffDown: number;
  cutoffOpen: number;
  nearDistance: number;
  darkenDistance: number;
  minCutoff: number;
}

/** Fraction de maxDistance sur laquelle le gain s'éteint. */
export const MAX_DISTANCE_FADE = 0.3;

/** Interpolation géométrique (fréquences) : a quand t = 0, b quand t = 1. */
export function geoLerp(a: number, b: number, t: number): number {
  return a * Math.pow(b / a, t);
}

/** pan = clamp(dx / panRange, −1, 1). */
export function panFromOffset(dx: number, panRange: number): number {
  if (panRange <= 0) return Math.sign(dx);
  return clamp(dx / panRange, -1, 1);
}

/** gain = 1 / (1 + d / falloff), avec plancher et extinction optionnels. */
export function distanceGain(distance: number, range: DistanceRange): number {
  const d = Math.max(0, distance);
  let gain = 1 / (1 + d / Math.max(1e-6, range.falloff));
  if (range.minGain !== undefined) gain = Math.max(gain, range.minGain);
  if (range.maxDistance !== undefined) {
    const fade = Math.max(1e-6, range.maxDistance * MAX_DISTANCE_FADE);
    gain *= clamp((range.maxDistance - d) / fade, 0, 1);
  }
  return gain;
}

/**
 * Coupure selon la direction verticale seule : dirY = −1 (haut) → cutoffUp,
 * 0 (horizontal) → cutoffSide, 1 (bas) → cutoffDown.
 */
export function verticalCutoff(dirY: number, b: BrightnessRange): number {
  const t = clamp(dirY, -1, 1);
  return t < 0 ? geoLerp(b.cutoffSide, b.cutoffUp, -t) : geoLerp(b.cutoffSide, b.cutoffDown, t);
}

/** Coupure d'une source décalée de (dx, dy) : direction, ouverture de près, assombrissement de loin. */
export function brightnessCutoff(dx: number, dy: number, b: BrightnessRange): number {
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return b.cutoffOpen;
  const directional = verticalCutoff(dy / d, b);
  const opened = geoLerp(b.cutoffOpen, directional, clamp(d / b.nearDistance, 0, 1));
  return Math.max(b.minCutoff, opened / (1 + d / b.darkenDistance));
}

/** Source décalée de (dx, dy) par rapport à la sonde. */
export function spatialFromOffset(
  dx: number,
  dy: number,
  range: PanRange,
  b: BrightnessRange,
): Spatial {
  const distance = Math.hypot(dx, dy);
  return {
    pan: panFromOffset(dx, range.panRange),
    gain: distanceGain(distance, range),
    cutoff: brightnessCutoff(dx, dy, b),
    distance,
  };
}

/** Source en `pos`, sonde en `listener`. */
export function spatialAt(listener: Vec2, pos: Vec2, range: PanRange, b: BrightnessRange): Spatial {
  return spatialFromOffset(pos.x - listener.x, pos.y - listener.y, range, b);
}

/**
 * Écho renvoyé par une surface à `distance` cases dans la direction `angle`
 * (radians, 0 = +x, sens horaire à l'écran puisque +y est vers le bas).
 *
 * Le pan suit la direction et non le décalage horizontal : un écho revient de la paroi qui l'a
 * renvoyé, et une paroi proche à droite doit s'entendre à droite autant qu'une paroi lointaine.
 * La distance est portée par le délai, le gain, la brillance et l'envoi de réverbération.
 */
export function echoSpatial(
  angle: number,
  distance: number,
  range: EchoRange,
  b: BrightnessRange,
): Spatial {
  const d = Math.max(0, distance);
  const cos = Math.cos(angle);
  return {
    pan: clamp(cos * range.panWidth, -1, 1),
    gain: distanceGain(d, range),
    cutoff: brightnessCutoff(cos * d, Math.sin(angle) * d, b),
    distance: d,
  };
}

/** Envoi de réverbération selon la distance : `near` au contact, `far` à `farDistance` et au-delà. */
export function distanceSend(
  distance: number,
  near: number,
  far: number,
  farDistance: number,
): number {
  const t = clamp(distance / Math.max(1e-6, farDistance), 0, 1);
  return near + (far - near) * t;
}
