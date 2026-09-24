import { volumeToGain } from './curves';
import { BUS, MASTER, MUD, REVERB } from './mix';
import { createImpulseResponse, createNoiseBank, type NoiseBank } from './sfx/buffers';
import { glide } from './sfx/voice';

/**
 * Graphe audio (ARCHITECTURE § 6) :
 *
 *   voix ─► porte sèche ─┐
 *   voix ─► porte humide ─► réverb (Convolver) ─► retour ─┤
 *   sons continus du jeu (charge) ───────────────────────┤
 *                                          somme game ─► étouffement (vase) ─► bus game ─┐
 *   ambiance ─► bus ambience ───────────────── (envoi vers la réverb) ────────────────────┤
 *   interface ─► bus ui ─────────────────────────────────────────────────────────────────┤
 *                                                   master (volume) ─► limiteur ─► sortie
 *
 * Les portes du bus game sont remplacées à chaque stopGameSounds : tout ce qui y était branché
 * (voix en cours et voix planifiées) est coupé en un seul fondu.
 */

export type BusKind = 'game' | 'ambience' | 'ui';

export interface BusInputs {
  dry: AudioNode;
  /** Entrée de la réverbération, null pour le bus ui. */
  wet: AudioNode | null;
}

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly noise: NoiseBank;
  /** Entrée des sons continus du bus game (non coupés par stopGameSounds). */
  readonly gameContinuous: GainNode;
  /** Entrée des sons continus d'ambiance. */
  readonly ambience: GainNode;
  private readonly ui: GainNode;
  private readonly master: GainNode;
  private readonly muffle: BiquadFilterNode;
  private readonly gameOut: GainNode;
  private readonly ambienceOut: GainNode;
  private readonly ambienceWet: GainNode;
  private readonly reverbIn: GainNode;
  private readonly reverbReturn: GainNode;
  private dryGate: GainNode;
  private wetGate: GainNode;
  private paused: boolean;
  private muffled = false;

  constructor(ctx: AudioContext, volume: number, paused: boolean) {
    this.ctx = ctx;
    this.paused = paused;
    this.noise = createNoiseBank(ctx);

    const l = MASTER.limiter;
    const limiter = new DynamicsCompressorNode(ctx, {
      threshold: l.threshold,
      knee: l.knee,
      ratio: l.ratio,
      attack: l.attack,
      release: l.release,
    });
    limiter.connect(ctx.destination);
    this.master = new GainNode(ctx, { gain: volumeToGain(volume, MASTER.volumeExponent) });
    this.master.connect(limiter);

    this.gameOut = new GainNode(ctx, { gain: this.gameLevel() });
    this.gameOut.connect(this.master);
    this.muffle = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: MUD.openCutoff, Q: 0 });
    this.muffle.connect(this.gameOut);
    this.gameContinuous = new GainNode(ctx, { gain: 1 });
    this.gameContinuous.connect(this.muffle);

    this.reverbIn = new GainNode(ctx, { gain: 1 });
    const convolver = new ConvolverNode(ctx, { buffer: createImpulseResponse(ctx) });
    this.reverbReturn = new GainNode(ctx, { gain: REVERB.return });
    this.reverbIn.connect(convolver).connect(this.reverbReturn).connect(this.muffle);

    this.ambienceOut = new GainNode(ctx, { gain: paused ? 0 : BUS.ambience });
    this.ambienceOut.connect(this.master);
    this.ambience = new GainNode(ctx, { gain: 1 });
    this.ambience.connect(this.ambienceOut);
    this.ambienceWet = new GainNode(ctx, { gain: 1 });
    this.ambienceWet.connect(this.reverbIn);

    this.ui = new GainNode(ctx, { gain: BUS.ui });
    this.ui.connect(this.master);

    this.dryGate = this.makeGate(this.muffle);
    this.wetGate = this.makeGate(this.reverbIn);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** Entrées sèche et humide d'un bus pour une voix ponctuelle. */
  inputs(bus: BusKind): BusInputs {
    switch (bus) {
      case 'game':
        return { dry: this.dryGate, wet: this.wetGate };
      case 'ambience':
        return { dry: this.ambience, wet: this.ambienceWet };
      case 'ui':
        return { dry: this.ui, wet: null };
    }
  }

  setVolume(volume: number): void {
    glide(
      this.master.gain,
      volumeToGain(volume, MASTER.volumeExponent),
      this.now,
      MASTER.volumeTau,
    );
  }

  /** Pause : bus game et ambience vers 0 en ~150 ms ; le bus ui reste actif. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    const now = this.now;
    glide(this.gameOut.gain, this.gameLevel(), now, BUS.pauseTau);
    glide(this.ambienceOut.gain, paused ? 0 : BUS.ambience, now, BUS.pauseTau);
  }

  /** Étouffement du bus game (sonde dans la vase). */
  setMuffled(muffled: boolean): void {
    if (muffled === this.muffled) return;
    this.muffled = muffled;
    const now = this.now;
    glide(this.muffle.frequency, muffled ? MUD.cutoff : MUD.openCutoff, now, MUD.tau);
    glide(this.gameOut.gain, this.gameLevel(), now, MUD.tau);
  }

  /**
   * Coupe tous les sons ponctuels du bus game, en cours et planifiés : les portes actuelles
   * descendent à 0 en ~30 ms puis sont débranchées, de nouvelles portes les remplacent.
   * La queue de réverbération est coupée puis le retour revient après REVERB.duckHold.
   */
  cutGame(): void {
    const now = this.now;
    const oldDry = this.dryGate;
    const oldWet = this.wetGate;
    for (const gate of [oldDry, oldWet]) {
      gate.gain.setValueAtTime(1, now);
      gate.gain.linearRampToValueAtTime(0, now + BUS.gateFade);
    }
    this.dryGate = this.makeGate(this.muffle);
    this.wetGate = this.makeGate(this.reverbIn);

    // Minuterie silencieuse sur l'horloge audio : débranche les anciennes portes après le fondu.
    const timer = new ConstantSourceNode(this.ctx, { offset: 0 });
    timer.connect(oldDry);
    timer.onended = () => {
      timer.disconnect();
      oldDry.disconnect();
      oldWet.disconnect();
    };
    timer.start(now);
    timer.stop(now + BUS.gateFade * 3);

    glide(this.reverbReturn.gain, 0, now, BUS.gateFade / 3);
    this.reverbReturn.gain.setTargetAtTime(REVERB.return, now + REVERB.duckHold, REVERB.duckTau);
  }

  private gameLevel(): number {
    if (this.paused) return 0;
    return BUS.game * (this.muffled ? MUD.gain : 1);
  }

  private makeGate(dest: AudioNode): GainNode {
    const gate = new GainNode(this.ctx, { gain: 1 });
    gate.connect(dest);
    return gate;
  }
}
