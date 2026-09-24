import { burst, tone, type Voice } from './voice';

/** Sons d'interface (bus ui, jamais réverbérés). */

/** Navigation : tic court et clair. */
export function uiMove(v: Voice, out: AudioNode, when: number): void {
  tone(v, out, when, { freq: 1500, peak: 0.5, tau: 0.012 });
  burst(v, out, when, { filter: 'highpass', freq: 4000, q: 0, peak: 0.3, tau: 0.003 });
}

/** Validation : deux notes montantes (880 → 1320 Hz). */
export function uiConfirm(v: Voice, out: AudioNode, when: number): void {
  tone(v, out, when, { freq: 880, peak: 0.45, tau: 0.04 });
  tone(v, out, when, { type: 'triangle', freq: 880, peak: 0.12, tau: 0.03 });
  tone(v, out, when + 0.055, { freq: 1320, peak: 0.45, tau: 0.06 });
  tone(v, out, when + 0.055, { type: 'triangle', freq: 1320, peak: 0.12, tau: 0.04 });
}

/** Retour : deux notes descendantes (1320 → 880 Hz), un peu plus douces. */
export function uiBack(v: Voice, out: AudioNode, when: number): void {
  tone(v, out, when, { freq: 1320, peak: 0.4, tau: 0.035 });
  tone(v, out, when + 0.05, { freq: 880, peak: 0.4, tau: 0.05 });
}
