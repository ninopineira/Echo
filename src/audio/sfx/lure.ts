import { burst, percussive, sweep, tone, type Voice } from './voice';

/** Leurre : lancer, rebond, ping, réserve vide (GDD § 3.8, § 6). */

/** Lancer : glissement (bruit passe-bande qui monte, sinus qui glisse). Le pan est balayé par le directeur. */
export function lureThrown(v: Voice, out: AudioNode, when: number): void {
  burst(v, out, when, {
    filter: 'bandpass',
    freq: 500,
    to: 2200,
    glide: 0.28,
    q: 2.5,
    peak: 1.4,
    attack: 0.03,
    hold: 0.05,
    tau: 0.08,
  });
  tone(v, out, when, {
    freq: 420,
    to: 780,
    glide: 0.25,
    peak: 0.12,
    attack: 0.03,
    hold: 0.05,
    tau: 0.07,
  });
}

export interface LureParams {
  pitch: number;
}

/** Rebond : petit tic. */
export function lureBounce(v: Voice, out: AudioNode, when: number, p: LureParams): void {
  tone(v, out, when, { freq: 1900 * p.pitch, peak: 0.6, tau: 0.012 });
  burst(v, out, when, { filter: 'highpass', freq: 3000, q: 0, peak: 0.4, tau: 0.004 });
}

/** Ping du leurre : note creuse ~720 Hz (triangle adouci, légère chute), ~0,45 s. */
export function lurePing(v: Voice, out: AudioNode, when: number, p: LureParams): void {
  const f = 720 * p.pitch;
  const env = v.gain(0);
  const end = percussive(env.gain, when, 0.6, 0.003, 0.12);
  const tri = v.osc('triangle', f, when, end);
  sweep(tri.frequency, when, f, f * 0.96, 0.1);
  const lp = v.filter('lowpass', 1800, 0);
  tri.connect(lp).connect(env).connect(out);
  tone(v, out, when, { freq: f, to: f * 0.96, glide: 0.1, peak: 0.3, tau: 0.14 });
  burst(v, out, when, { filter: 'bandpass', freq: 1400, q: 4, peak: 1, tau: 0.004 });
}

/** Réserve vide : double clic sec, grave. */
export function lureEmpty(v: Voice, out: AudioNode, when: number): void {
  burst(v, out, when, { filter: 'bandpass', freq: 1100, q: 3, peak: 1.2, tau: 0.006 });
  burst(v, out, when + 0.045, { filter: 'bandpass', freq: 1000, q: 3, peak: 0.7, tau: 0.006 });
  tone(v, out, when, { freq: 600, peak: 0.25, tau: 0.01 });
}
