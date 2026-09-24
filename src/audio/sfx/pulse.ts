import { burst, percussive, sweep, tone, type Voice } from './voice';

/**
 * Impulsion sonar et refus (GDD § 3.2, § 6).
 * Courte : ping net et clair. Longue : plus grave, plus longue, plus riche.
 * Les deux décroissent vite pour laisser entendre les échos qui suivent.
 */

export interface PulseParams {
  /** Facteur de hauteur (variation légère). */
  pitch: number;
}

/** Ping court : sinus 1400 → 900 Hz en 150 ms, décroissance ~0,35 s, transitoire d'attaque. */
export function pulseShort(v: Voice, out: AudioNode, when: number, p: PulseParams): void {
  const f = p.pitch;
  const env = v.gain(0);
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(1, when + 0.004);
  env.gain.setTargetAtTime(0.55, when + 0.004, 0.04);
  env.gain.setTargetAtTime(0, when + 0.15, 0.07);
  const end = when + 0.15 + 0.07 * 9;
  const main = v.osc('sine', 1400 * f, when, end);
  sweep(main.frequency, when, 1400 * f, 900 * f, 0.15);
  main.connect(env).connect(out);

  // Reflet inharmonique discret, qui fait « sonar » plutôt que « bip ».
  tone(v, out, when, {
    freq: 1400 * f * 2.72,
    to: 900 * f * 2.72,
    glide: 0.15,
    peak: 0.1,
    tau: 0.03,
  });
  // Corps grave à l'octave inférieure.
  tone(v, out, when, { freq: 700 * f, to: 450 * f, glide: 0.15, peak: 0.2, tau: 0.08 });
  // Transitoire : un souffle aigu très bref qui donne l'attaque nette.
  burst(v, out, when, { filter: 'highpass', freq: 4000, q: 0, peak: 0.25, tau: 0.006 });
}

/** Ping long : 900 → 520 Hz sur 350 ms, sinus désaccordés, sous-octave, « whomp » et lavis. */
export function pulseLong(v: Voice, out: AudioNode, when: number, p: PulseParams): void {
  const f = p.pitch;
  const env = v.gain(0);
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(1, when + 0.008);
  env.gain.setValueAtTime(1, when + 0.1);
  env.gain.setTargetAtTime(0, when + 0.1, 0.2);
  const end = when + 0.1 + 0.2 * 9;
  for (const detune of [0.9977, 1.0023]) {
    const o = v.osc('sine', 900 * f * detune, when, end);
    sweep(o.frequency, when, 900 * f * detune, 520 * f * detune, 0.35);
    const g = v.gain(0.5);
    o.connect(g).connect(env);
  }
  const sub = v.osc('sine', 450 * f, when, end);
  sweep(sub.frequency, when, 450 * f, 260 * f, 0.35);
  const subGain = v.gain(0.45);
  sub.connect(subGain).connect(env);
  // Harmoniques impaires adoucies : la richesse du ping long.
  const tri = v.osc('triangle', 900 * f, when, end);
  sweep(tri.frequency, when, 900 * f, 520 * f, 0.35);
  const triFilter = v.filter('lowpass', 3000, 0);
  const triGain = v.gain(0.2);
  tri.connect(triFilter).connect(triGain).connect(env);
  env.connect(out);

  // « Whomp » grave : la poussée de l'onde.
  tone(v, out, when, { freq: 140, to: 55, glide: 0.25, peak: 0.6, attack: 0.004, tau: 0.1 });
  // Lavis de bruit qui descend, pour la texture.
  burst(v, out, when, {
    filter: 'bandpass',
    freq: 2500,
    to: 800,
    glide: 0.5,
    q: 1.5,
    peak: 0.18,
    attack: 0.02,
    tau: 0.25,
  });
  burst(v, out, when, { filter: 'highpass', freq: 3500, q: 0, peak: 0.2, tau: 0.008 });
}

/** Refus pendant la recharge : clic sec et aigu. */
export function deniedCooldown(v: Voice, out: AudioNode, when: number): void {
  burst(v, out, when, { filter: 'highpass', freq: 3500, q: 0, peak: 0.8, tau: 0.005 });
  tone(v, out, when, { freq: 2400, peak: 0.3, tau: 0.01 });
}

/** Refus faute d'énergie : clic plus grave et étouffé, suivi d'un « bwip » qui retombe. */
export function deniedEnergy(v: Voice, out: AudioNode, when: number): void {
  burst(v, out, when, { filter: 'bandpass', freq: 900, q: 2, peak: 0.9, tau: 0.008 });
  const env = v.gain(0);
  const end = percussive(env.gain, when + 0.01, 0.5, 0.004, 0.03);
  const o = v.osc('triangle', 520, when + 0.01, end);
  sweep(o.frequency, when + 0.01, 520, 280, 0.07);
  const lp = v.filter('lowpass', 1200, 0);
  o.connect(lp).connect(env).connect(out);
}
