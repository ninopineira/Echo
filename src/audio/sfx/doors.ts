import { burst, lfo, swell, tone, type Voice } from './voice';

/** Leviers et portes (GDD § 3.8, § 6). */

/** Levier : « clac » (clic et coup sourd), puis cliquet de verrouillage 60 ms plus tard. */
export function leverPulled(v: Voice, out: AudioNode, when: number): void {
  burst(v, out, when, { filter: 'bandpass', freq: 2200, q: 1.2, peak: 1, tau: 0.01 });
  tone(v, out, when, { freq: 260, to: 140, glide: 0.05, peak: 0.6, tau: 0.03 });
  burst(v, out, when + 0.06, { filter: 'bandpass', freq: 3200, q: 1.5, peak: 0.6, tau: 0.006 });
}

/** Porte qui s'ouvre : grondement métallique ~0,8 s (frottement, grave, partiels inharmoniques). */
export function doorOpening(v: Voice, out: AudioNode, when: number): void {
  const env = v.gain(0);
  const end = swell(env.gain, when, 1, 0.06, 0.7, 0.08);
  env.connect(out);

  // Frottement : bruit passe-bande avec un battement rapide.
  const grind = v.noiseSource(v.noise.white, when, end);
  const bp = v.filter('bandpass', 700, 2);
  const flutter = v.gain(0.6);
  lfo(v, flutter.gain, 21, 0.4, when, end);
  const grindGain = v.gain(1.2);
  grind.connect(bp).connect(flutter).connect(grindGain).connect(env);

  // Grondement grave.
  const lp = v.filter('lowpass', 380, 0);
  const rumble = v.gain(0.35);
  lp.connect(rumble).connect(env);
  for (const freq of [48, 72]) v.osc('sawtooth', freq, when, end).connect(lp);

  // Partiels métalliques, légèrement vibrés.
  const partials: readonly [number, number][] = [
    [311, 0.12],
    [467, 0.1],
    [733, 0.07],
    [1097, 0.05],
  ];
  for (const [freq, level] of partials) {
    const o = v.osc('sine', freq, when, end);
    lfo(v, o.frequency, 5, 3, when, end);
    const g = v.gain(level);
    o.connect(g).connect(env);
  }
}

/** Porte ouverte : léger choc de butée, avec un reste de tintement. */
export function doorOpened(v: Voice, out: AudioNode, when: number): void {
  tone(v, out, when, { freq: 90, to: 50, glide: 0.1, peak: 0.8, tau: 0.06 });
  burst(v, out, when, { buffer: 'brown', filter: 'lowpass', freq: 600, q: 0, peak: 1, tau: 0.04 });
  tone(v, out, when, { freq: 467, peak: 0.08, tau: 0.1 });
}
