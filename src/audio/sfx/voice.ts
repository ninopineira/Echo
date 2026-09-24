import { softClipCurve } from '../curves';
import type { NoiseBank } from './buffers';

/**
 * Une voix = l'ensemble des nœuds d'un son ponctuel. Elle garde la liste de ses nœuds et de ses
 * sources, arrête chaque source à la fin de son enveloppe, et déconnecte tout quand la dernière
 * source a émis `ended`. Les recettes (`sfx/*.ts`) ont la forme `(voice, out, when, params)` :
 * `voice.ctx` est le contexte, `out` l'entrée de la chaîne de spatialisation.
 */

/** Attaque minimale depuis 0 : en dessous, le démarrage claque. */
export const MIN_ATTACK = 0.003;
/** Une décroissance exponentielle est arrêtée après 9 τ (e^−9 ≈ 0,0001). */
export const RELEASE_TAUS = 9;

export type Recipe<P> = (v: Voice, out: AudioNode, when: number, params: P) => void;

interface SourceEntry {
  node: AudioScheduledSourceNode;
  start: number;
  stop: number;
}

export class Voice {
  readonly ctx: BaseAudioContext;
  readonly noise: NoiseBank;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: SourceEntry[] = [];
  private remaining = 0;

  constructor(ctx: BaseAudioContext, noise: NoiseBank) {
    this.ctx = ctx;
    this.noise = noise;
  }

  /** Début planifié de la première source (Infinity sans source). */
  get start(): number {
    let t = Infinity;
    for (const s of this.sources) t = Math.min(t, s.start);
    return t;
  }

  /** Fin planifiée de la dernière source. */
  get end(): number {
    let t = 0;
    for (const s of this.sources) t = Math.max(t, s.stop);
    return t;
  }

  track<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  gain(value = 0): GainNode {
    return this.track(new GainNode(this.ctx, { gain: value }));
  }

  filter(type: BiquadFilterType, frequency: number, q = 1): BiquadFilterNode {
    return this.track(new BiquadFilterNode(this.ctx, { type, frequency, Q: q }));
  }

  panner(pan: number): StereoPannerNode {
    return this.track(new StereoPannerNode(this.ctx, { pan }));
  }

  shaper(curve: Float32Array<ArrayBuffer>): WaveShaperNode {
    return this.track(new WaveShaperNode(this.ctx, { curve, oversample: '2x' }));
  }

  osc(type: OscillatorType, frequency: number, start: number, stop: number): OscillatorNode {
    const node = new OscillatorNode(this.ctx, { type, frequency });
    this.addSource(node, start, stop);
    return node;
  }

  /** Lecture en boucle d'un tampon de bruit, à partir d'une position aléatoire. */
  noiseSource(buffer: AudioBuffer, start: number, stop: number, rate = 1): AudioBufferSourceNode {
    const node = new AudioBufferSourceNode(this.ctx, { buffer, loop: true, playbackRate: rate });
    this.track(node);
    node.start(start, Math.random() * buffer.duration * 0.9);
    node.stop(Math.max(stop, start + 0.001));
    this.sources.push({ node, start, stop: Math.max(stop, start + 0.001) });
    return node;
  }

  private addSource(node: AudioScheduledSourceNode, start: number, stop: number): void {
    const end = Math.max(stop, start + 0.001);
    this.track(node);
    node.start(start);
    node.stop(end);
    this.sources.push({ node, start, stop: end });
  }

  /** À appeler une fois la recette construite : branche le nettoyage sur `ended`. */
  finish(): void {
    if (this.sources.length === 0) {
      this.release();
      return;
    }
    this.remaining = this.sources.length;
    for (const s of this.sources) {
      s.node.onended = () => {
        this.remaining--;
        if (this.remaining === 0) this.release();
      };
    }
  }

  /**
   * Avance l'arrêt des sources (voix coupée). Le gain d'entrée de la voix doit déjà descendre
   * vers 0. Une source planifiée plus tard démarre quand même, puis s'arrête aussitôt, en silence :
   * ainsi `ended` est toujours émis et les nœuds sont libérés.
   */
  stopEarly(at: number): void {
    for (const s of this.sources) {
      const t = Math.max(at, s.start + 0.001);
      if (t >= s.stop) continue;
      try {
        s.node.stop(t);
        s.stop = t;
      } catch {
        // Ancien moteur qui refuse un second stop() : la source s'arrêtera à sa fin prévue.
      }
    }
  }

  private release(): void {
    for (const n of this.nodes) n.disconnect();
    this.nodes.length = 0;
  }
}

/** Enveloppe percussive : 0 → peak en `attack`, puis décroissance exponentielle τ. Renvoie la fin. */
export function percussive(
  param: AudioParam,
  when: number,
  peak: number,
  attack: number,
  tau: number,
): number {
  const a = Math.max(MIN_ATTACK, attack);
  param.setValueAtTime(0, when);
  param.linearRampToValueAtTime(peak, when + a);
  param.setTargetAtTime(0, when + a, tau);
  return when + a + tau * RELEASE_TAUS;
}

/** Enveloppe attaque, maintien, décroissance τ. Renvoie la fin. */
export function swell(
  param: AudioParam,
  when: number,
  peak: number,
  attack: number,
  hold: number,
  tau: number,
): number {
  const a = Math.max(MIN_ATTACK, attack);
  param.setValueAtTime(0, when);
  param.linearRampToValueAtTime(peak, when + a);
  param.setValueAtTime(peak, when + a + hold);
  param.setTargetAtTime(0, when + a + hold, tau);
  return when + a + hold + tau * RELEASE_TAUS;
}

/** Glissement exponentiel d'un paramètre de fréquence. */
export function sweep(
  param: AudioParam,
  when: number,
  from: number,
  to: number,
  duration: number,
): void {
  param.setValueAtTime(Math.max(1e-3, from), when);
  param.exponentialRampToValueAtTime(Math.max(1e-3, to), when + Math.max(0.001, duration));
}

/**
 * Amène un paramètre vers `target` à partir de sa valeur courante (constante de temps τ), sans
 * saut : les événements futurs sont annulés, l'approche exponentielle part de la valeur en cours.
 */
export function glide(param: AudioParam, target: number, now: number, tau: number): void {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(target, now, Math.max(1e-4, tau));
}

/** Facteur aléatoire 1 ± amount (variation de hauteur). */
export function jitter(amount: number): number {
  return 1 + (Math.random() * 2 - 1) * amount;
}

export interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  /** Fréquence d'arrivée d'un glissement exponentiel. */
  to?: number;
  /** Durée du glissement (par défaut : toute la note). */
  glide?: number;
  peak: number;
  attack?: number;
  /** Maintien avant la décroissance (0 = percussif). */
  hold?: number;
  tau: number;
}

/** Oscillateur → enveloppe → out. */
export function tone(v: Voice, out: AudioNode, when: number, o: ToneOptions): OscillatorNode {
  const env = v.gain(0);
  const attack = o.attack ?? MIN_ATTACK;
  const end =
    o.hold !== undefined && o.hold > 0
      ? swell(env.gain, when, o.peak, attack, o.hold, o.tau)
      : percussive(env.gain, when, o.peak, attack, o.tau);
  const osc = v.osc(o.type ?? 'sine', o.freq, when, end);
  if (o.to !== undefined) sweep(osc.frequency, when, o.freq, o.to, o.glide ?? end - when);
  osc.connect(env).connect(out);
  return osc;
}

export interface BurstOptions {
  buffer?: keyof NoiseBank;
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  /** Fréquence d'arrivée d'un balayage du filtre. */
  to?: number;
  glide?: number;
  peak: number;
  attack?: number;
  hold?: number;
  tau: number;
  rate?: number;
}

/** Bruit → filtre → enveloppe → out. Renvoie le filtre (pour d'éventuelles modulations). */
export function burst(v: Voice, out: AudioNode, when: number, o: BurstOptions): BiquadFilterNode {
  const env = v.gain(0);
  const attack = o.attack ?? MIN_ATTACK;
  const end =
    o.hold !== undefined && o.hold > 0
      ? swell(env.gain, when, o.peak, attack, o.hold, o.tau)
      : percussive(env.gain, when, o.peak, attack, o.tau);
  const src = v.noiseSource(v.noise[o.buffer ?? 'white'], when, end, o.rate ?? 1);
  const f = v.filter(o.filter, o.freq, o.q ?? 1);
  if (o.to !== undefined) sweep(f.frequency, when, o.freq, o.to, o.glide ?? end - when);
  src.connect(f).connect(env).connect(out);
  return f;
}

/** Modulation d'un paramètre par un LFO sinusoïdal (profondeur en unités du paramètre). */
export function lfo(
  v: Voice,
  target: AudioParam,
  rate: number,
  depth: number,
  start: number,
  stop: number,
): OscillatorNode {
  const osc = v.osc('sine', rate, start, stop);
  const amount = v.gain(depth);
  osc.connect(amount).connect(target);
  return osc;
}

const curveCache = new Map<number, Float32Array<ArrayBuffer>>();

/** Courbe de saturation douce partagée (le WaveShaper copie la courbe). */
export function softClip(drive: number): Float32Array<ArrayBuffer> {
  let curve = curveCache.get(drive);
  if (!curve) {
    curve = softClipCurve(drive);
    curveCache.set(drive, curve);
  }
  return curve;
}
