import {
  chargeLevel,
  chargePitch,
  HEARTBEAT,
  huntRate,
  leviathanProximity,
  pulseTrainCurve,
  SLOW_PULSE,
} from '../curves';
import { AMBIENCE, BUS } from '../mix';
import { geoLerp } from '../spatial';
import type { NoiseBank } from './buffers';
import { glide, softClip } from './voice';

/**
 * Sons continus pilotés par l'AmbientModel (GDD § 6) : lit sonore, courant, chasse, Léviathan,
 * coque critique, charge. Chaque couche est construite à la première sollicitation, suit son
 * niveau cible par des approches exponentielles, et libère ses nœuds après un long silence.
 */

/** Sous ce niveau, une couche est considérée silencieuse. */
const SILENT = 1e-4;

const HEARTBEAT_CURVE = pulseTrainCurve(HEARTBEAT);
const SLOW_PULSE_CURVE = pulseTrainCurve(SLOW_PULSE);

abstract class Layer {
  protected readonly ctx: BaseAudioContext;
  protected readonly noise: NoiseBank;
  private readonly dest: AudioNode;
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private out: GainNode | null = null;
  private idleSince: number | null = null;

  constructor(ctx: BaseAudioContext, noise: NoiseBank, dest: AudioNode) {
    this.ctx = ctx;
    this.noise = noise;
    this.dest = dest;
  }

  get running(): boolean {
    return this.out !== null;
  }

  /** Crée les nœuds de la couche et les branche sur `out` (dont le gain part de 0). */
  protected abstract build(out: GainNode, now: number): void;

  protected node<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  protected start<T extends AudioScheduledSourceNode>(n: T, now: number): T {
    this.node(n);
    this.sources.push(n);
    n.start(now);
    return n;
  }

  protected loop(buffer: AudioBuffer, now: number): AudioBufferSourceNode {
    const src = new AudioBufferSourceNode(this.ctx, { buffer, loop: true });
    this.node(src);
    this.sources.push(src);
    src.start(now, Math.random() * buffer.duration);
    return src;
  }

  /** Oscillateur basse fréquence → gain `depth` → paramètre. */
  protected modulate(
    target: AudioParam,
    rate: number,
    depth: number,
    now: number,
    type: OscillatorType = 'sine',
  ): { osc: OscillatorNode; depth: GainNode } {
    const osc = this.start(new OscillatorNode(this.ctx, { type, frequency: rate }), now);
    const amount = this.node(new GainNode(this.ctx, { gain: depth }));
    osc.connect(amount).connect(target);
    return { osc, depth: amount };
  }

  /**
   * Règle le niveau de sortie. Construit la couche au besoin ; après idleTaus × tauOut de
   * silence, arrête les sources et libère les nœuds.
   */
  protected drive(level: number, now: number, tauIn: number, tauOut: number): void {
    if (level > SILENT) {
      this.idleSince = null;
      if (!this.out) {
        const out = new GainNode(this.ctx, { gain: 0 });
        out.connect(this.dest);
        this.out = out;
        this.nodes.push(out);
        this.build(out, now);
      }
      glide(this.out.gain, level, now, tauIn);
      return;
    }
    if (!this.out) return;
    if (this.idleSince === null) {
      this.idleSince = now;
      glide(this.out.gain, 0, now, tauOut);
      return;
    }
    if (now - this.idleSince > tauOut * AMBIENCE.idleTaus) this.dispose(now);
  }

  /** Coupe la couche en quelques millisecondes (elle sera libérée au prochain drive silencieux). */
  cut(now: number): void {
    if (!this.out) return;
    glide(this.out.gain, 0, now, BUS.cutTau);
    this.idleSince = now;
  }

  private dispose(now: number): void {
    const nodes = this.nodes;
    const sources = this.sources;
    this.nodes = [];
    this.sources = [];
    this.out = null;
    this.idleSince = null;
    this.onDispose();
    let remaining = sources.length;
    if (remaining === 0) {
      for (const n of nodes) n.disconnect();
      return;
    }
    for (const s of sources) {
      s.onended = () => {
        remaining--;
        if (remaining === 0) for (const n of nodes) n.disconnect();
      };
      s.stop(now + 0.02);
    }
  }

  /** Oublie les références aux nœuds libérés. */
  protected abstract onDispose(): void;
}

/** Lit sonore sous-marin : bruit brun passe-bas qui ondule, bande « eau » discrète. */
export class BedLayer extends Layer {
  protected build(out: GainNode, now: number): void {
    const c = AMBIENCE.bed;
    const src = this.loop(this.noise.brown, now);
    const lp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: c.cutoff, Q: 0 }),
    );
    this.modulate(lp.frequency, c.swingRate, c.cutoffSwing, now);
    src.connect(lp).connect(out);
    const bp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: c.waterFreq, Q: 1.2 }),
    );
    const water = this.node(new GainNode(this.ctx, { gain: c.waterLevel }));
    this.modulate(water.gain, c.waterRate, c.waterLevel * 0.6, now);
    src.connect(bp).connect(water).connect(out);
  }

  protected onDispose(): void {
    // Aucune référence à oublier.
  }

  set(active: boolean, now: number): void {
    const c = AMBIENCE.bed;
    this.drive(active ? c.level : 0, now, c.tauIn, c.tauOut);
  }
}

/** Souffle du courant : bruit passe-bande qui ondule et se déplace un peu dans l'espace. */
export class CurrentLayer extends Layer {
  protected build(out: GainNode, now: number): void {
    const c = AMBIENCE.current;
    const white = this.loop(this.noise.white, now);
    const hp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'highpass', frequency: 180, Q: 0 }),
    );
    const bp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: c.center, Q: 0.9 }),
    );
    this.modulate(bp.frequency, c.swingRate, c.swing, now);
    const pan = this.node(new StereoPannerNode(this.ctx, { pan: 0 }));
    this.modulate(pan.pan, c.panRate, c.panSwing, now);
    white.connect(hp).connect(bp).connect(pan).connect(out);
    const brown = this.loop(this.noise.brown, now);
    const lp = this.node(new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 300, Q: 0 }));
    const rumble = this.node(new GainNode(this.ctx, { gain: c.rumble }));
    brown.connect(lp).connect(rumble).connect(out);
  }

  protected onDispose(): void {
    // Aucune référence à oublier.
  }

  set(strength01: number, now: number): void {
    const c = AMBIENCE.current;
    this.drive(Math.max(0, Math.min(1, strength01)) * c.level, now, c.tau, c.tau);
  }
}

/** Tension de chasse : battement de cœur grave (« lub-dub ») et souffle rapide calé dessus. */
export class HuntLayer extends Layer {
  private rate: AudioParam | null = null;

  protected build(out: GainNode, now: number): void {
    const c = AMBIENCE.hunt;
    // LFO en dents de scie lu par une forme de battement : deux bosses par période.
    const osc = this.start(
      new OscillatorNode(this.ctx, { type: 'sawtooth', frequency: c.baseRate }),
      now,
    );
    this.rate = osc.frequency;
    const shape = this.node(new WaveShaperNode(this.ctx, { curve: HEARTBEAT_CURVE }));
    osc.connect(shape);

    const beat = this.node(new GainNode(this.ctx, { gain: 0 }));
    shape.connect(beat.gain);
    const toneOsc = this.start(
      new OscillatorNode(this.ctx, { type: 'sawtooth', frequency: c.tone }),
      now,
    );
    const lp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: c.cutoff, Q: 2 }),
    );
    toneOsc.connect(lp).connect(beat).connect(out);

    const breath = this.node(new GainNode(this.ctx, { gain: 0 }));
    const breathDepth = this.node(new GainNode(this.ctx, { gain: c.breath }));
    shape.connect(breathDepth).connect(breath.gain);
    const white = this.loop(this.noise.white, now);
    const bp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: c.breathFreq, Q: 1.4 }),
    );
    white.connect(bp).connect(breath).connect(out);
  }

  protected onDispose(): void {
    this.rate = null;
  }

  set(count: number, now: number): void {
    const c = AMBIENCE.hunt;
    this.drive(count > 0 ? c.level : 0, now, c.tauIn, c.tauOut);
    if (this.rate && count > 0) {
      glide(this.rate, huntRate(count, c.baseRate, c.ratePerCreature, c.maxRate), now, 0.5);
    }
  }
}

/** Drone du Léviathan : dents de scie graves saturées, s'ouvre et bat plus vite quand il approche. */
export class LeviathanLayer extends Layer {
  private cutoff: AudioParam | null = null;
  private beat: AudioParam | null = null;
  private pan: AudioParam | null = null;

  protected build(out: GainNode, now: number): void {
    const c = AMBIENCE.leviathan;
    const mix = this.node(new GainNode(this.ctx, { gain: 0.4 }));
    const voices: readonly [OscillatorType, number, number][] = [
      ['sawtooth', c.tone, 1],
      ['sawtooth', c.tone * 1.01, 1],
      ['sine', c.tone * 2, 0.3],
    ];
    for (const [type, frequency, level] of voices) {
      const o = this.start(new OscillatorNode(this.ctx, { type, frequency }), now);
      const g = this.node(new GainNode(this.ctx, { gain: level }));
      o.connect(g).connect(mix);
    }
    const sat = this.node(new WaveShaperNode(this.ctx, { curve: softClip(2), oversample: '2x' }));
    const lp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: c.cutoffFar, Q: 3 }),
    );
    this.cutoff = lp.frequency;
    const amp = this.node(new GainNode(this.ctx, { gain: 1 - c.beatDepth }));
    this.beat = this.modulate(amp.gain, c.beatFar, c.beatDepth, now).osc.frequency;
    const panner = this.node(new StereoPannerNode(this.ctx, { pan: 0 }));
    this.pan = panner.pan;
    mix.connect(sat).connect(lp).connect(amp).connect(panner).connect(out);

    const brown = this.loop(this.noise.brown, now);
    const rumbleLp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 140, Q: 0 }),
    );
    const rumble = this.node(new GainNode(this.ctx, { gain: 0.5 }));
    brown.connect(rumbleLp).connect(rumble).connect(amp);
  }

  protected onDispose(): void {
    this.cutoff = null;
    this.beat = null;
    this.pan = null;
  }

  /** `pan` : balance stéréo -1..1 selon la direction du Léviathan par rapport à la sonde. */
  set(pathDistance: number | null, now: number, pan = 0): void {
    const c = AMBIENCE.leviathan;
    if (this.pan) glide(this.pan, pan, now, c.tau);
    const prox = leviathanProximity(pathDistance, c.range, c.exponent);
    this.drive(prox * c.level, now, c.tau, c.tau);
    if (this.cutoff) glide(this.cutoff, geoLerp(c.cutoffFar, c.cutoffNear, prox), now, c.tau);
    if (this.beat) glide(this.beat, c.beatFar + (c.beatNear - c.beatFar) * prox, now, c.tau);
  }
}

/** Alarme de coque critique : pulsation grave et lente (quinte 123 / 185 Hz). */
export class HullLayer extends Layer {
  protected build(out: GainNode, now: number): void {
    const c = AMBIENCE.hull;
    const pulse = this.node(new GainNode(this.ctx, { gain: 0 }));
    const lfoOsc = this.start(
      new OscillatorNode(this.ctx, { type: 'sawtooth', frequency: c.rate }),
      now,
    );
    const shape = this.node(new WaveShaperNode(this.ctx, { curve: SLOW_PULSE_CURVE }));
    lfoOsc.connect(shape).connect(pulse.gain);
    const lp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: c.cutoff, Q: 0 }),
    );
    const tones: readonly [OscillatorType, number, number][] = [
      ['triangle', c.tone, 1],
      ['sine', c.tone * 1.5, 0.5],
    ];
    for (const [type, frequency, level] of tones) {
      const o = this.start(new OscillatorNode(this.ctx, { type, frequency }), now);
      const g = this.node(new GainNode(this.ctx, { gain: level }));
      o.connect(g).connect(lp);
    }
    lp.connect(pulse).connect(out);
  }

  protected onDispose(): void {
    // Aucune référence à oublier.
  }

  set(active: boolean, now: number): void {
    const c = AMBIENCE.hull;
    this.drive(active ? c.level : 0, now, c.tau, c.tau);
  }
}

/** Charge de l'impulsion longue : bourdonnement qui monte en hauteur et en présence. */
export class ChargeLayer extends Layer {
  private oscs: { param: AudioParam; ratio: number }[] = [];
  private cutoff: AudioParam | null = null;
  private vibrato: AudioParam | null = null;

  protected build(out: GainNode, now: number): void {
    const c = AMBIENCE.charge;
    const lp = this.node(
      new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: c.pitchStart * 4, Q: 2 }),
    );
    this.cutoff = lp.frequency;
    const vib = this.start(new OscillatorNode(this.ctx, { frequency: c.vibratoRate }), now);
    const vibDepth = this.node(new GainNode(this.ctx, { gain: 0 }));
    vib.connect(vibDepth);
    this.vibrato = vibDepth.gain;
    const voices: readonly [OscillatorType, number, number][] = [
      ['sawtooth', 1, 0.6],
      ['sine', 2, 0.25],
      ['sine', 0.5, 0.3],
    ];
    this.oscs = [];
    for (const [type, ratio, level] of voices) {
      const o = this.start(
        new OscillatorNode(this.ctx, { type, frequency: c.pitchStart * ratio }),
        now,
      );
      vibDepth.connect(o.detune);
      const g = this.node(new GainNode(this.ctx, { gain: level }));
      o.connect(g).connect(lp);
      this.oscs.push({ param: o.frequency, ratio });
    }
    lp.connect(out);
  }

  protected onDispose(): void {
    this.oscs = [];
    this.cutoff = null;
    this.vibrato = null;
  }

  set(charge01: number | null, now: number): void {
    const c = AMBIENCE.charge;
    const level = chargeLevel(charge01, c.fadeStart, c.fadeEnd) * c.level;
    this.drive(level, now, c.tauUp, c.tauDown);
    if (charge01 === null || !this.running) return;
    const f = chargePitch(charge01, c.pitchStart, c.octaves);
    for (const o of this.oscs) glide(o.param, f * o.ratio, now, c.tauUp);
    if (this.cutoff) glide(this.cutoff, f * 4, now, c.tauUp);
    if (this.vibrato) glide(this.vibrato, c.vibratoCents * charge01, now, c.tauUp);
  }
}
