import { burst, tone, type Voice } from './voice';

/** Balise, ramassages et progression (GDD § 3.6, § 3.7, § 3.8, § 6). */

/** Note douce : sinus et triangle adouci. */
function soft(
  v: Voice,
  out: AudioNode,
  when: number,
  freq: number,
  peak: number,
  attack: number,
  hold: number,
  tau: number,
): void {
  tone(v, out, when, { freq, peak, attack, hold, tau });
  const lp = v.filter('lowpass', 2500, 0);
  lp.connect(out);
  tone(v, lp, when, { type: 'triangle', freq, peak: peak * 0.35, attack, hold, tau: tau * 0.8 });
}

/** Signal de la balise : double note douce 880 puis 1320 Hz, espacées de 130 ms. */
export function beaconPing(v: Voice, out: AudioNode, when: number): void {
  [880, 1320].forEach((freq, i) => {
    const t = when + i * 0.13;
    tone(v, out, t, { freq, peak: 0.6, attack: 0.006, tau: 0.16 });
    tone(v, out, t, { type: 'triangle', freq, peak: 0.15, attack: 0.006, tau: 0.1 });
    tone(v, out, t, { freq: freq * 2, peak: 0.06, attack: 0.006, tau: 0.06 });
  });
}

export interface PearlParams {
  /** 1 si c'était la dernière perle du niveau (une note de plus, plus haute). */
  complete: number;
}

/** Perle : scintillement ascendant (arpège pentatonique aigu). */
export function pearlCollected(v: Voice, out: AudioNode, when: number, p: PearlParams): void {
  const notes = [1318.5, 1568, 1975.5, 2349.3, 2637];
  if (p.complete > 0) notes.push(3136);
  notes.forEach((freq, i) => {
    const t = when + i * 0.05;
    const last = i === notes.length - 1;
    tone(v, out, t, { freq, peak: 0.5, tau: last ? 0.3 : 0.12 });
    tone(v, out, t, { freq: freq * 2, peak: 0.1, tau: 0.05 });
  });
}

export interface CapsuleParams {
  /** Leurres portés après le ramassage (1..3) : la note monte avec la réserve. */
  carried: number;
}

/** Capsule : petit clic, puis carillon creux à deux notes. */
export function capsulePicked(v: Voice, out: AudioNode, when: number, p: CapsuleParams): void {
  const notes = [1046.5, 1174.7, 1318.5];
  const base = notes[Math.max(0, Math.min(notes.length - 1, Math.round(p.carried) - 1))] ?? 1046.5;
  burst(v, out, when, { filter: 'bandpass', freq: 3000, q: 1.5, peak: 0.7, tau: 0.004 });
  tone(v, out, when, { type: 'triangle', freq: base, peak: 0.35, tau: 0.09 });
  tone(v, out, when + 0.04, { freq: base * 1.5, peak: 0.2, tau: 0.09 });
}

/** Point de contrôle : accord doux (do majeur, octave en plus), notes légèrement égrenées. */
export function checkpointReached(v: Voice, out: AudioNode, when: number): void {
  const chord: readonly [number, number][] = [
    [523.25, 0.3],
    [659.25, 0.28],
    [783.99, 0.26],
    [1046.5, 0.15],
  ];
  chord.forEach(([freq, peak], i) => {
    soft(v, out, when + i * 0.025, freq, peak, 0.025, 0.15, 0.5);
  });
}

/** Fin de niveau : arpège montant, puis accord de résolution tenu. */
export function levelComplete(v: Voice, out: AudioNode, when: number): void {
  [392, 523.25, 659.25, 783.99].forEach((freq, i) => {
    soft(v, out, when + i * 0.1, freq, 0.3, 0.004, 0, 0.25);
  });
  const t = when + 0.45;
  for (const freq of [523.25, 659.25, 783.99, 1046.5, 1568]) {
    soft(v, out, t, freq, 0.2, 0.04, 0.3, 0.8);
  }
}
