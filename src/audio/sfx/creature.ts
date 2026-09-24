import { burst, lfo, percussive, softClip, swell, tone, type Voice } from './voice';

/** Créatures : cliquetis, grognements, réveil du Léviathan, morsure (GDD § 3.9, § 6). */

export interface CreatureParams {
  /** Facteur de hauteur (variation légère, pour distinguer deux Guetteurs). */
  pitch: number;
}

/** Cliquetis de nage : deux micro-clics aigus résonants, à 28 ms d'écart. */
export function creatureClick(v: Voice, out: AudioNode, when: number, p: CreatureParams): void {
  burst(v, out, when, { filter: 'bandpass', freq: 3200 * p.pitch, q: 6, peak: 3, tau: 0.006 });
  burst(v, out, when + 0.028, {
    filter: 'bandpass',
    freq: 3000 * p.pitch,
    q: 6,
    peak: 1.8,
    tau: 0.006,
  });
}

interface GrowlShape {
  base: number;
  /** Contour de hauteur (facteurs de base) à 0, 0,15 s et 0,6 s. */
  rise: number;
  fall: number;
  cutoffs: readonly [number, number, number];
  tremolo: number;
  hold: number;
  tau: number;
}

/** Dents de scie désaccordées, saturées, passe-bas animé et trémolo. */
function growl(v: Voice, out: AudioNode, when: number, s: GrowlShape, peak: number): number {
  const env = v.gain(0);
  const end = swell(env.gain, when, peak, 0.04, s.hold, s.tau);
  const lp = v.filter('lowpass', s.cutoffs[0], 5);
  lp.frequency.setValueAtTime(s.cutoffs[0], when);
  lp.frequency.exponentialRampToValueAtTime(s.cutoffs[1], when + 0.12);
  lp.frequency.exponentialRampToValueAtTime(s.cutoffs[2], when + 0.6);
  const sat = v.shaper(softClip(3));
  const trem = v.gain(0.6);
  lfo(v, trem.gain, s.tremolo, 0.4, when, end);
  const mix = v.gain(0.5);
  for (const detune of [1, 1.022]) {
    const f = s.base * detune;
    const o = v.osc('sawtooth', f, when, end);
    o.frequency.setValueAtTime(f, when);
    o.frequency.linearRampToValueAtTime(f * s.rise, when + 0.15);
    o.frequency.linearRampToValueAtTime(f * s.fall, when + 0.6);
    o.connect(mix);
  }
  mix.connect(sat).connect(lp).connect(trem).connect(env).connect(out);
  return end;
}

/** Alerte d'un Guetteur : grognement ~0,6 s (dents de scie grave, passe-bas, trémolo 17 Hz). */
export function guetteurGrowl(v: Voice, out: AudioNode, when: number, p: CreatureParams): void {
  const shape: GrowlShape = {
    base: 62 * p.pitch,
    rise: 1.26,
    fall: 0.94,
    cutoffs: [350, 900, 320],
    tremolo: 17,
    hold: 0.45,
    tau: 0.12,
  };
  growl(v, out, when, shape, 1);
  burst(v, out, when, {
    filter: 'bandpass',
    freq: 500,
    q: 1.5,
    peak: 0.5,
    attack: 0.04,
    hold: 0.4,
    tau: 0.1,
  });
}

/** Le Léviathan a entendu : grognement plus grave et plus lent, grondement de fond. */
export function leviathanGrowl(v: Voice, out: AudioNode, when: number, p: CreatureParams): void {
  const shape: GrowlShape = {
    base: 36 * p.pitch,
    rise: 1.15,
    fall: 0.9,
    cutoffs: [200, 520, 220],
    tremolo: 9,
    hold: 0.6,
    tau: 0.2,
  };
  growl(v, out, when, shape, 1);
  burst(v, out, when, {
    buffer: 'brown',
    filter: 'lowpass',
    freq: 160,
    q: 0,
    peak: 1,
    attack: 0.08,
    hold: 0.5,
    tau: 0.25,
  });
}

/** Réveil du Léviathan : grondement très grave qui enfle ~1,6 s, voix formantique qui descend. */
export function leviathanWoke(v: Voice, out: AudioNode, when: number, p: CreatureParams): void {
  const env = v.gain(0);
  const end = swell(env.gain, when, 1, 0.8, 0.8, 0.6);
  const mix = v.gain(0.45);
  const voices: readonly [OscillatorType, number, number][] = [
    ['sawtooth', 34, 1],
    ['sawtooth', 34.7, 1],
    ['square', 17, 0.3],
  ];
  for (const [type, freq, level] of voices) {
    const o = v.osc(type, freq * p.pitch, when, end);
    o.frequency.setValueAtTime(freq * p.pitch * 1.12, when);
    o.frequency.exponentialRampToValueAtTime(freq * p.pitch * 0.88, when + 3);
    const g = v.gain(level);
    o.connect(g).connect(mix);
  }
  const sat = v.shaper(softClip(2.5));
  const lp = v.filter('lowpass', 160, 4);
  lp.frequency.setValueAtTime(160, when);
  lp.frequency.exponentialRampToValueAtTime(600, when + 1.2);
  lp.frequency.exponentialRampToValueAtTime(250, when + 3);
  const trem = v.gain(0.7);
  lfo(v, trem.gain, 5, 0.3, when, end);
  mix.connect(sat).connect(lp).connect(trem).connect(env).connect(out);

  // Voix : dents de scie filtrées par un formant qui descend.
  const formant = v.osc('sawtooth', 68 * p.pitch, when, end);
  const bp = v.filter('bandpass', 420, 7);
  bp.frequency.setValueAtTime(420, when);
  bp.frequency.exponentialRampToValueAtTime(280, when + 2);
  const fGain = v.gain(0.35);
  formant.connect(bp).connect(fGain).connect(env);

  burst(v, out, when, {
    buffer: 'brown',
    filter: 'lowpass',
    freq: 120,
    q: 0,
    peak: 1.2,
    attack: 0.8,
    hold: 0.8,
    tau: 0.6,
  });
}

/** Morsure : deux coups sourds rapprochés (mâchoires) et un craquement bref. */
export function creatureAttack(v: Voice, out: AudioNode, when: number): void {
  const bites: readonly [number, number][] = [
    [0, 0.85],
    [0.075, 0.7],
  ];
  for (const [dt, peak] of bites) {
    const t = when + dt;
    tone(v, out, t, { freq: 150, to: 55, glide: 0.07, peak, tau: 0.035 });
    burst(v, out, t, { buffer: 'brown', filter: 'lowpass', freq: 500, q: 0, peak: 1, tau: 0.03 });
  }
  const t = when + 0.075;
  const env = v.gain(0);
  const end = percussive(env.gain, t, 0.35, 0.003, 0.03);
  const src = v.noiseSource(v.noise.white, t, end);
  const drive = v.gain(4);
  const sat = v.shaper(softClip(8));
  const bp = v.filter('bandpass', 900, 1);
  src.connect(drive).connect(sat).connect(bp).connect(env).connect(out);
}
