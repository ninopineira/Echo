import { burst, type Voice } from './voice';

/** Craquements lointains du lit sonore (GDD § 6) : rares, réverbérés, sans information de jeu. */

export interface CrackleParams {
  /** Nombre de craquements dans la salve. */
  count: number;
  /** Étalement de la salve (s). */
  spread: number;
}

export function crackleBurst(v: Voice, out: AudioNode, when: number, p: CrackleParams): void {
  const n = Math.max(1, Math.round(p.count));
  for (let i = 0; i < n; i++) {
    const t = when + Math.random() * Math.max(0, p.spread);
    burst(v, out, t, {
      buffer: 'crackle',
      filter: 'bandpass',
      freq: 1500 + Math.random() * 2000,
      q: 3,
      peak: 0.4 + Math.random() * 0.6,
      tau: 0.004 + Math.random() * 0.008,
      rate: 0.7 + Math.random() * 0.6,
    });
  }
}
