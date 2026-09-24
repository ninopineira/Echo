import type { EchoSurface } from '../../sim/events';
import { burst, lfo, swell, tone, type Recipe, type Voice } from './voice';

/**
 * Timbres d'écho par surface (GDD § 3.3). Chaque écho est court : il doit se détacher du
 * suivant, puisque le délai porte la distance. La brillance (direction verticale, distance) est
 * appliquée par la chaîne de spatialisation ; ces recettes gardent donc un peu d'aigu à filtrer.
 */

export interface EchoParams {
  /** Facteur de hauteur (variation ±4 %). */
  pitch: number;
  /** 1 pour l'écho d'une impulsion longue (un peu plus grave et plus long), 0 sinon. */
  long: number;
}

function shape(p: EchoParams): { f: number; tl: number } {
  return { f: p.pitch * (p.long > 0 ? 0.94 : 1), tl: p.long > 0 ? 1.3 : 1 };
}

/** Roche : « toc » boisé, bruit passe-bande ~1 kHz, cœur tonal qui retombe, tic aigu. */
export const rockEcho: Recipe<EchoParams> = (v, out, when, p) => {
  const { f, tl } = shape(p);
  burst(v, out, when, { filter: 'bandpass', freq: 1050 * f, q: 2.5, peak: 2.5, tau: 0.018 * tl });
  tone(v, out, when, { freq: 720 * f, to: 600 * f, glide: 0.05, peak: 0.55, tau: 0.022 * tl });
  burst(v, out, when, { filter: 'highpass', freq: 2500, q: 0, peak: 0.45, tau: 0.004 });
};

/** Porte : tintement métallique, partiels inharmoniques, décroissance ~0,4 s. */
export const doorEcho: Recipe<EchoParams> = (v, out, when, p) => {
  const { f, tl } = shape(p);
  const partials: readonly [number, number, number][] = [
    [1, 0.45, 0.14],
    [2.32, 0.27, 0.1],
    [4.25, 0.16, 0.07],
    [6.63, 0.09, 0.05],
  ];
  for (const [ratio, peak, tau] of partials) {
    tone(v, out, when, { freq: 620 * f * ratio, peak, tau: tau * tl });
  }
  burst(v, out, when, { filter: 'bandpass', freq: 3000, q: 1, peak: 0.6, tau: 0.005 });
};

/** Oursin : crépitement, rafale de micro-impulsions passe-haut. */
export const hazardEcho: Recipe<EchoParams> = (v, out, when, p) => {
  const { tl } = shape(p);
  burst(v, out, when, {
    buffer: 'crackle',
    filter: 'highpass',
    freq: 2500,
    q: 0,
    peak: 1.2,
    hold: 0.05 * tl,
    tau: 0.03,
    rate: p.pitch,
  });
  burst(v, out, when, { filter: 'highpass', freq: 5000, q: 0, peak: 0.2, tau: 0.02 });
};

/** Perle : tintement cristallin, sinus aigu avec harmonique et léger battement, décroissance longue. */
export const pearlEcho: Recipe<EchoParams> = (v, out, when, p) => {
  const { f, tl } = shape(p);
  tone(v, out, when, { freq: 2600 * f, peak: 0.45, tau: 0.22 * tl });
  tone(v, out, when, { freq: 2600 * f + 7, peak: 0.3, tau: 0.25 * tl });
  tone(v, out, when, { freq: 2600 * f * 2.01, peak: 0.12, tau: 0.1 * tl });
};

/** Créature : grondement mat, bruit grave avec légère modulation, cœur tonal ~95 Hz. */
export const creatureEcho: Recipe<EchoParams> = (v, out, when, p) => {
  const { f, tl } = shape(p);
  const env = v.gain(0);
  const end = swell(env.gain, when, 1.1, 0.015, 0.05, 0.08 * tl);
  const src = v.noiseSource(v.noise.brown, when, end);
  const lp = v.filter('lowpass', 300, 0);
  const trem = v.gain(0.7);
  lfo(v, trem.gain, 11, 0.3, when, end);
  src.connect(lp).connect(trem).connect(env).connect(out);
  const hold = { attack: 0.015, hold: 0.05, tau: 0.08 * tl };
  tone(v, out, when, { freq: 95 * f, to: 80 * f, peak: 0.5, ...hold });
  tone(v, out, when, { type: 'triangle', freq: 190 * f, to: 160 * f, peak: 0.2, ...hold });
};

/** Levier : clic sec. */
export const leverEcho: Recipe<EchoParams> = (v, out, when, p) => {
  const { f } = shape(p);
  burst(v, out, when, { filter: 'highpass', freq: 2000, q: 0, peak: 0.9, tau: 0.006 });
  tone(v, out, when, { freq: 1400 * f, peak: 0.3, tau: 0.01 });
};

/** Capsule : petit cliquetis creux, trois tics résonants rapprochés. */
export const capsuleEcho: Recipe<EchoParams> = (v, out, when, p) => {
  const { f } = shape(p);
  const ticks: readonly [number, number][] = [
    [0, 1.4],
    [0.028, 1],
    [0.052, 0.7],
  ];
  for (const [dt, peak] of ticks) {
    burst(v, out, when + dt, { filter: 'bandpass', freq: 2200 * f, q: 8, peak, tau: 0.012 });
  }
  tone(v, out, when, { type: 'triangle', freq: 880 * f, peak: 0.15, tau: 0.04 });
};

/** Point de contrôle : accord doux et bref (do-mi-sol). */
export const checkpointEcho: Recipe<EchoParams> = (v, out, when, p) => {
  const { f, tl } = shape(p);
  for (const freq of [523.25, 659.25, 783.99]) {
    tone(v, out, when, { freq: freq * f, peak: 0.28, attack: 0.008, tau: 0.15 * tl });
  }
};

export const ECHO_RECIPES: Record<EchoSurface, Recipe<EchoParams>> = {
  rock: rockEcho,
  door: doorEcho,
  hazard: hazardEcho,
  pearl: pearlEcho,
  creature: creatureEcho,
  lever: leverEcho,
  capsule: capsuleEcho,
  checkpoint: checkpointEcho,
};

/** Joue l'écho d'une surface. */
export function echo(
  v: Voice,
  out: AudioNode,
  when: number,
  surface: EchoSurface,
  p: EchoParams,
): void {
  ECHO_RECIPES[surface](v, out, when, p);
}
