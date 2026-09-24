import { burst, percussive, softClip, swell, sweep, tone, type Voice } from './voice';

/** Sons de la sonde : choc, dégât, implosion, reprise (GDD § 3.1, § 3.5, § 6). */

export interface BumpParams {
  /** Intensité du choc, 0..1 : brillance et poids (le gain est réglé par le directeur). */
  intensity: number;
}

/** Choc contre une paroi : bruit sourd, plus clair quand le choc est fort. */
export function wallBump(v: Voice, out: AudioNode, when: number, p: BumpParams): void {
  const i = Math.max(0, Math.min(1, p.intensity));
  tone(v, out, when, { freq: 95, to: 48, glide: 0.12, peak: 0.9, tau: 0.05 });
  burst(v, out, when, {
    buffer: 'brown',
    filter: 'lowpass',
    freq: 300 + 600 * i,
    q: 0,
    peak: 1.2,
    tau: 0.035,
  });
  burst(v, out, when, { filter: 'bandpass', freq: 240, q: 5, peak: 1.5, tau: 0.04 });
}

export interface DamageParams {
  /** 1 si la source est un oursin (craquement plus aigu), 0 pour une créature. */
  hazard: number;
  /** Bips d'alarme : 0 (la sonde est détruite), 1 (dégât), 2 (coque critique). */
  beeps: number;
}

/** Bruit saturé → passe-bande : craquement de coque. */
function crack(
  v: Voice,
  out: AudioNode,
  when: number,
  freq: number,
  peak: number,
  tau: number,
): void {
  const env = v.gain(0);
  const end = percussive(env.gain, when, peak, 0.003, tau);
  const src = v.noiseSource(v.noise.white, when, end);
  const drive = v.gain(4);
  const sat = v.shaper(softClip(8));
  const bp = v.filter('bandpass', freq, 0.9);
  src.connect(drive).connect(sat).connect(bp).connect(env).connect(out);
}

/** Dégât : craquement, grincement de coque, puis bip d'alarme bref (double si critique). */
export function damage(v: Voice, out: AudioNode, when: number, p: DamageParams): void {
  crack(v, out, when, p.hazard > 0 ? 2600 : 1800, 0.9, 0.04);

  const creakEnv = v.gain(0);
  const creakEnd = percussive(creakEnv.gain, when, 0.4, 0.004, 0.08);
  const creak = v.osc('sawtooth', 160, when, creakEnd);
  sweep(creak.frequency, when, 160, 110, 0.2);
  const creakSat = v.shaper(softClip(3));
  const creakLp = v.filter('lowpass', 900, 0);
  creak.connect(creakSat).connect(creakLp).connect(creakEnv).connect(out);

  const beeps: readonly [number, number][] = [
    [0.1, 988],
    [0.26, 1318.5],
  ];
  beeps.slice(0, Math.max(0, Math.min(2, p.beeps))).forEach(([dt, freq], i) => {
    const t = when + dt;
    const env = v.gain(0);
    const end = swell(env.gain, t, 0.25, 0.005, 0.08, 0.01);
    const o = v.osc('square', p.beeps >= 2 && i === 0 ? 1174.7 : freq, t, end);
    const lp = v.filter('lowpass', 3000, 0);
    o.connect(lp).connect(env).connect(out);
  });
}

/** Implosion : balayage résonant qui descend, craquement initial, coup sourd final. */
export function probeDestroyed(v: Voice, out: AudioNode, when: number): void {
  crack(v, out, when, 1200, 0.6, 0.05);
  burst(v, out, when, {
    filter: 'lowpass',
    freq: 5000,
    to: 90,
    glide: 0.9,
    q: 8,
    peak: 0.7,
    attack: 0.01,
    hold: 0.6,
    tau: 0.25,
  });
  tone(v, out, when, {
    freq: 700,
    to: 35,
    glide: 0.9,
    peak: 0.5,
    attack: 0.01,
    hold: 0.25,
    tau: 0.3,
  });
  const hit = when + 0.85;
  tone(v, out, hit, { freq: 70, to: 35, glide: 0.3, peak: 0.8, attack: 0.005, tau: 0.2 });
  burst(v, out, hit, { buffer: 'brown', filter: 'lowpass', freq: 200, q: 0, peak: 1, tau: 0.15 });
}

export interface RespawnParams {
  /** 1 si la reprise se fait à un point de contrôle (note claire en plus), 0 sinon. */
  checkpoint: number;
}

/** Reprise : remontée douce (glissement ascendant en quintes), souffle qui s'éclaircit. */
export function respawn(v: Voice, out: AudioNode, when: number, p: RespawnParams): void {
  const env = { attack: 0.35, hold: 0.45, tau: 0.25 };
  const voices: readonly [number, number][] = [
    [220, 0.5],
    [330, 0.2],
    [110, 0.15],
  ];
  for (const [freq, peak] of voices) {
    tone(v, out, when, { freq, to: freq * 2, glide: 0.9, peak, ...env });
  }
  burst(v, out, when, {
    filter: 'highpass',
    freq: 500,
    to: 4000,
    glide: 0.9,
    q: 0,
    peak: 0.12,
    ...env,
  });
  if (p.checkpoint > 0) {
    tone(v, out, when + 0.55, { freq: 880, peak: 0.15, attack: 0.05, tau: 0.3 });
  }
}
