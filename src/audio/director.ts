import type { Echo, GameEvent, PulseKind } from '../sim/events';
import type { Vec2 } from '../sim/math/vec';
import type { AmbientModel } from '../sim/views';
import { bumpLevel, crowdFactors } from './curves';
import type { AudioEngine, BusKind } from './engine';
import {
  AMBIENCE,
  BRIGHTNESS,
  ECHO,
  LEVEL,
  REFLECTIVITY,
  SCHEDULE,
  SEND,
  SPATIAL,
  VOICE_CAPS,
  BUS,
  type VoiceFamily,
} from './mix';
import { distanceSend, echoSpatial, panFromOffset, spatialAt, type PanRange } from './spatial';
import { crackleBurst } from './sfx/ambience';
import {
  BedLayer,
  ChargeLayer,
  CurrentLayer,
  HullLayer,
  HuntLayer,
  LeviathanLayer,
} from './sfx/continuous';
import {
  creatureAttack,
  creatureClick,
  guetteurGrowl,
  leviathanGrowl,
  leviathanWoke,
} from './sfx/creature';
import { doorOpened, doorOpening, leverPulled } from './sfx/doors';
import { echo } from './sfx/echo';
import { lureBounce, lureEmpty, lurePing, lureThrown } from './sfx/lure';
import { uiBack, uiConfirm, uiMove } from './sfx/menu';
import {
  beaconPing,
  capsulePicked,
  checkpointReached,
  levelComplete,
  pearlCollected,
} from './sfx/pickups';
import { damage, probeDestroyed, respawn, wallBump } from './sfx/probe';
import { deniedCooldown, deniedEnergy, pulseLong, pulseShort } from './sfx/pulse';
import { jitter, Voice } from './sfx/voice';
import { isOver, pickVictim, type VoiceSlot } from './voices';

export type UiSound = 'move' | 'confirm' | 'back';

/** Placement d'une voix : niveau final, stéréo, brillance, réverbération et bus. */
interface Placement {
  level: number;
  pan: number;
  /** Balayage du pan vers cette valeur pendant `panTime` (lancer de leurre). */
  panTo?: number;
  panTime?: number;
  /** Coupure passe-bas (Hz), null sans filtre. */
  cutoff: number | null;
  wet: number;
  bus: BusKind;
}

interface ActiveVoice extends VoiceSlot {
  voice: Voice;
  input: GainNode;
}

type Build = (v: Voice, out: AudioNode) => void;

const CENTER: Omit<Placement, 'level' | 'wet'> = { pan: 0, cutoff: null, bus: 'game' };

/**
 * Traduit les événements de la simulation en sons, et l'AmbientModel en sons continus
 * (ARCHITECTURE § 6). Une instance par AudioContext, créée au déblocage.
 */
export class Director {
  private readonly engine: AudioEngine;
  private readonly pools = new Map<VoiceFamily, ActiveVoice[]>();
  /** Positions des portes en cours d'ouverture, par lettre (doorOpened n'a pas de position). */
  private readonly doors = new Map<string, Vec2[]>();
  private readonly bed: BedLayer;
  private readonly current: CurrentLayer;
  private readonly hunt: HuntLayer;
  private readonly leviathan: LeviathanLayer;
  private readonly hull: HullLayer;
  private readonly charge: ChargeLayer;
  private nextCrackle: number | null = null;
  /** Voix planifiées au-delà de SCHEDULE.horizon, créées par update() à l'approche de leur heure. */
  private readonly deferred: {
    family: VoiceFamily;
    place: Placement;
    when: number;
    build: Build;
  }[] = [];

  constructor(engine: AudioEngine) {
    this.engine = engine;
    const { ctx, noise, ambience, gameContinuous } = engine;
    this.bed = new BedLayer(ctx, noise, ambience);
    this.current = new CurrentLayer(ctx, noise, ambience);
    this.hunt = new HuntLayer(ctx, noise, ambience);
    this.leviathan = new LeviathanLayer(ctx, noise, ambience);
    this.hull = new HullLayer(ctx, noise, ambience);
    this.charge = new ChargeLayer(ctx, noise, gameContinuous);
  }

  handle(events: readonly GameEvent[], listener: Vec2): void {
    if (events.length === 0) return;
    const when = this.engine.now + SCHEDULE.lead;
    for (const event of events) this.dispatch(event, listener, when);
  }

  update(ambient: AmbientModel | null): void {
    const now = this.engine.now;
    this.flushDeferred(now);
    this.engine.setMuffled(ambient?.inMud ?? false);
    this.bed.set(ambient !== null, now);
    this.current.set(ambient?.currentStrength01 ?? 0, now);
    this.hunt.set(ambient?.huntingCreatures ?? 0, now);
    const lev = ambient?.leviathanPos ?? null;
    this.leviathan.set(
      ambient?.leviathanPathDistance ?? null,
      now,
      lev && ambient ? panFromOffset(lev.x - ambient.listener.x, SPATIAL.leviathan.panRange) : 0,
    );
    this.hull.set(ambient?.hullCritical ?? false, now);
    this.charge.set(ambient?.charge01 ?? null, now);
    this.scheduleCrackles(ambient !== null, now);
  }

  ui(kind: UiSound): void {
    const when = this.engine.now + SCHEDULE.lead;
    const place = (level: number): Placement => ({ ...CENTER, level, wet: 0, bus: 'ui' });
    switch (kind) {
      case 'move':
        this.spawn('menu', place(LEVEL.uiMove), when, (v, o) => {
          uiMove(v, o, when);
        });
        return;
      case 'confirm':
        this.spawn('menu', place(LEVEL.uiConfirm), when, (v, o) => {
          uiConfirm(v, o, when);
        });
        return;
      case 'back':
        this.spawn('menu', place(LEVEL.uiBack), when, (v, o) => {
          uiBack(v, o, when);
        });
        return;
    }
  }

  /** Coupe les sons de jeu ponctuels (en cours et planifiés) et la charge. */
  stopGame(): void {
    const now = this.engine.now;
    this.engine.cutGame();
    for (const [family, pool] of this.pools) {
      if (family === 'menu' || family === 'ambience') continue;
      for (const a of pool) a.voice.stopEarly(now + BUS.gateFade * 1.5);
      pool.length = 0;
    }
    this.doors.clear();
    this.deferred.length = 0;
    this.charge.cut(now);
  }

  private dispatch(e: GameEvent, listener: Vec2, when: number): void {
    switch (e.type) {
      case 'pulseEmitted':
        this.pulse(e.kind, when);
        return;
      case 'pulseEchoes':
        this.echoes(e.echoes, e.kind, when);
        return;
      case 'pulseDenied': {
        const energy = e.reason === 'energy';
        const level = energy ? LEVEL.deniedEnergy : LEVEL.deniedCooldown;
        this.spawn('pulse', { ...CENTER, level, wet: SEND.denied }, when, (v, o) => {
          if (energy) deniedEnergy(v, o, when);
          else deniedCooldown(v, o, when);
        });
        return;
      }
      case 'chargeStarted':
        // Le bourdonnement de charge suit ambient.charge01 (update), muet pendant un appui bref.
        return;
      case 'wallBump': {
        const place = this.at(listener, e.pos, SPATIAL.near, LEVEL.bump * bumpLevel(e.intensity));
        this.spawn('probe', { ...place, wet: SEND.near }, when, (v, o) => {
          wallBump(v, o, when, { intensity: e.intensity });
        });
        return;
      }
      case 'pearlCollected': {
        const place = this.at(listener, e.pos, SPATIAL.near, LEVEL.pearl);
        this.spawn('pickup', { ...place, wet: SEND.pickup }, when, (v, o) => {
          pearlCollected(v, o, when, { complete: e.remaining === 0 ? 1 : 0 });
        });
        return;
      }
      case 'capsulePicked': {
        const place = this.at(listener, e.pos, SPATIAL.near, LEVEL.capsule);
        this.spawn('pickup', { ...place, wet: SEND.pickup }, when, (v, o) => {
          capsulePicked(v, o, when, { carried: e.carried });
        });
        return;
      }
      case 'lureThrown': {
        const place = this.at(listener, e.pos, SPATIAL.near, LEVEL.lureThrown);
        const len = Math.hypot(e.dir.x, e.dir.y);
        const panTo =
          len > 1e-6 ? Math.max(-1, Math.min(1, place.pan + (e.dir.x / len) * 0.6)) : place.pan;
        this.spawn('lure', { ...place, panTo, panTime: 0.3, wet: SEND.world }, when, (v, o) => {
          lureThrown(v, o, when);
        });
        return;
      }
      case 'lureEmpty':
        this.spawn('lure', { ...CENTER, level: LEVEL.lureEmpty, wet: 0 }, when, (v, o) => {
          lureEmpty(v, o, when);
        });
        return;
      case 'lureBounce': {
        const place = this.at(listener, e.pos, SPATIAL.world, LEVEL.lureBounce);
        this.spawn('lure', { ...place, wet: SEND.world }, when, (v, o) => {
          lureBounce(v, o, when, { pitch: jitter(0.05) });
        });
        return;
      }
      case 'lurePing': {
        const place = this.at(listener, e.pos, SPATIAL.world, LEVEL.lurePing);
        this.spawn('lure', { ...place, wet: this.farWet(listener, e.pos) }, when, (v, o) => {
          lurePing(v, o, when, { pitch: 1 });
        });
        return;
      }
      case 'leverPulled': {
        const place = this.at(listener, e.pos, SPATIAL.near, LEVEL.lever);
        this.spawn('door', { ...place, wet: SEND.near }, when, (v, o) => {
          leverPulled(v, o, when);
        });
        return;
      }
      case 'doorOpening': {
        const list = this.doors.get(e.letter) ?? [];
        list.push({ x: e.pos.x, y: e.pos.y });
        this.doors.set(e.letter, list);
        const place = this.at(listener, e.pos, SPATIAL.world, LEVEL.doorOpening);
        this.spawn('door', { ...place, wet: this.farWet(listener, e.pos) }, when, (v, o) => {
          doorOpening(v, o, when);
        });
        return;
      }
      case 'doorOpened': {
        const positions = this.doors.get(e.letter);
        this.doors.delete(e.letter);
        const targets = positions && positions.length > 0 ? positions : [null];
        for (const pos of targets) {
          const place = pos
            ? this.at(listener, pos, SPATIAL.world, LEVEL.doorOpened)
            : { ...CENTER, level: LEVEL.doorOpened * 0.5 };
          this.spawn('door', { ...place, wet: SEND.world }, when, (v, o) => {
            doorOpened(v, o, when);
          });
        }
        return;
      }
      case 'checkpointReached':
        this.spawn(
          'progress',
          { ...CENTER, level: LEVEL.checkpoint, wet: SEND.progress },
          when,
          (v, o) => {
            checkpointReached(v, o, when);
          },
        );
        return;
      case 'beaconPing': {
        const place = this.at(listener, e.pos, SPATIAL.beacon, LEVEL.beacon);
        const d = Math.hypot(e.pos.x - listener.x, e.pos.y - listener.y);
        const wet = distanceSend(d, SEND.beaconNear, SEND.beaconFar, SEND.farDistance);
        this.spawn('beacon', { ...place, wet }, when, (v, o) => {
          beaconPing(v, o, when);
        });
        return;
      }
      case 'noise':
        // Événement de debug : pas de son.
        return;
      case 'creatureClick': {
        const place = this.at(listener, e.pos, SPATIAL.click, LEVEL.creatureClick);
        this.spawn('creature', { ...place, wet: SEND.creature }, when, (v, o) => {
          creatureClick(v, o, when, { pitch: creaturePitch(e.id) * jitter(0.03) });
        });
        return;
      }
      case 'creatureAlerted': {
        const leviathan = e.kind === 'leviathan';
        const range = leviathan ? SPATIAL.leviathan : SPATIAL.world;
        const level = leviathan ? LEVEL.leviathanGrowl : LEVEL.growl;
        const place = this.at(listener, e.pos, range, level);
        this.spawn('creature', { ...place, wet: SEND.creature }, when, (v, o) => {
          const pitch = creaturePitch(e.id);
          if (leviathan) leviathanGrowl(v, o, when, { pitch });
          else guetteurGrowl(v, o, when, { pitch });
        });
        return;
      }
      case 'creatureAttack': {
        const place = this.at(listener, e.pos, SPATIAL.near, LEVEL.attack);
        this.spawn('creature', { ...place, wet: SEND.near }, when, (v, o) => {
          creatureAttack(v, o, when);
        });
        return;
      }
      case 'leviathanWoke': {
        const place = this.at(listener, e.pos, SPATIAL.leviathan, LEVEL.leviathanWoke);
        this.spawn('creature', { ...place, wet: SEND.creature }, when, (v, o) => {
          leviathanWoke(v, o, when, { pitch: 1 });
        });
        return;
      }
      case 'damage': {
        const place = this.at(listener, e.pos, SPATIAL.near, LEVEL.damage);
        const beeps = e.hull <= 0 ? 0 : e.hull === 1 ? 2 : 1;
        this.spawn('probe', { ...place, wet: SEND.near }, when, (v, o) => {
          damage(v, o, when, { hazard: e.source === 'hazard' ? 1 : 0, beeps });
        });
        return;
      }
      case 'probeDestroyed':
        this.spawn(
          'probe',
          { ...CENTER, level: LEVEL.destroyed, wet: SEND.progress },
          when,
          (v, o) => {
            probeDestroyed(v, o, when);
          },
        );
        return;
      case 'respawn':
        this.spawn(
          'probe',
          { ...CENTER, level: LEVEL.respawn, wet: SEND.progress },
          when,
          (v, o) => {
            respawn(v, o, when, { checkpoint: e.fromCheckpoint ? 1 : 0 });
          },
        );
        return;
      case 'levelComplete':
        this.spawn(
          'progress',
          { ...CENTER, level: LEVEL.levelComplete, wet: SEND.progress },
          when,
          (v, o) => {
            levelComplete(v, o, when);
          },
        );
        return;
      default: {
        const unhandled: never = e;
        return unhandled;
      }
    }
  }

  private pulse(kind: PulseKind, when: number): void {
    const long = kind === 'long';
    const place: Placement = {
      ...CENTER,
      level: long ? LEVEL.pulseLong : LEVEL.pulseShort,
      wet: long ? SEND.pulseLong : SEND.pulseShort,
    };
    this.spawn('pulse', place, when, (v, o) => {
      const p = { pitch: jitter(0.01) };
      if (long) pulseLong(v, o, when, p);
      else pulseShort(v, o, when, p);
    });
  }

  /** Chaque écho est planifié à when + delay, avec gain, pan et brillance selon (angle, distance). */
  private echoes(list: readonly Echo[], kind: PulseKind, when: number): void {
    const long = kind === 'long' ? 1 : 0;
    const crowd = crowdFactors(
      list.map((e) => e.delay),
      ECHO.crowdWindow,
      ECHO.crowdExponent,
    );
    list.forEach((e, i) => {
      const s = echoSpatial(e.angle, e.distance, SPATIAL.echo, BRIGHTNESS);
      const level =
        LEVEL.echo *
        REFLECTIVITY[e.surface] *
        s.gain *
        (crowd[i] ?? 1) *
        (long > 0 ? ECHO.longGain : 1);
      const at = when + Math.max(0, e.delay);
      const place: Placement = {
        level,
        pan: s.pan,
        cutoff: s.cutoff,
        wet: distanceSend(e.distance, SEND.echoNear, SEND.echoFar, SEND.farDistance),
        bus: 'game',
      };
      this.spawnLater('echo', place, at, (v, o) => {
        echo(v, o, at, e.surface, { pitch: jitter(ECHO.pitchJitter), long });
      });
    });
  }

  private scheduleCrackles(active: boolean, now: number): void {
    const c = AMBIENCE.crackle;
    if (!active) {
      this.nextCrackle = null;
      return;
    }
    if (this.nextCrackle === null) {
      this.nextCrackle = now + randomBetween(c.firstMin, c.firstMax);
      return;
    }
    if (now + SCHEDULE.lead < this.nextCrackle) return;
    const when = Math.max(this.nextCrackle, now + SCHEDULE.lead);
    this.nextCrackle = when + randomBetween(c.minGap, c.maxGap);
    const place: Placement = {
      level: LEVEL.crackle * randomBetween(0.5, 1),
      pan: randomBetween(-c.panSpread, c.panSpread),
      cutoff: c.cutoff,
      wet: SEND.crackle,
      bus: 'ambience',
    };
    const params = { count: Math.round(randomBetween(3, 8)), spread: randomBetween(0.2, 0.8) };
    this.spawn('ambience', place, when, (v, o) => {
      crackleBurst(v, o, when, params);
    });
  }

  /** Placement d'une source en `pos` par rapport à la sonde. */
  private at(listener: Vec2, pos: Vec2, range: PanRange, level: number): Omit<Placement, 'wet'> {
    const s = spatialAt(listener, pos, range, BRIGHTNESS);
    return { level: level * s.gain, pan: s.pan, cutoff: s.cutoff, bus: 'game' };
  }

  /** Envoi de réverbération d'un son du monde : plus sec de près, plus réverbéré de loin. */
  private farWet(listener: Vec2, pos: Vec2): number {
    const d = Math.hypot(pos.x - listener.x, pos.y - listener.y);
    return distanceSend(d, SEND.world, SEND.echoFar * 2, SEND.farDistance);
  }

  /**
   * Crée une voix : recette → gain (niveau, mono) → passe-bas de brillance → pan → bus
   * (sec et humide), puis applique le plafond de la famille.
   */
  /** Comme spawn, mais diffère la création si la voix sonne au-delà de SCHEDULE.horizon. */
  private spawnLater(family: VoiceFamily, place: Placement, when: number, build: Build): void {
    if (when - this.engine.now <= SCHEDULE.horizon) this.spawn(family, place, when, build);
    else this.deferred.push({ family, place, when, build });
  }

  private flushDeferred(now: number): void {
    let kept = 0;
    for (const d of this.deferred) {
      if (d.when - now <= SCHEDULE.horizon) this.spawn(d.family, d.place, d.when, d.build);
      else this.deferred[kept++] = d;
    }
    this.deferred.length = kept;
  }

  private spawn(family: VoiceFamily, place: Placement, when: number, build: Build): void {
    if (place.level < SCHEDULE.minLevel) return;
    const { ctx, noise } = this.engine;
    const v = new Voice(ctx, noise);
    const input = v.track(
      new GainNode(ctx, { gain: place.level, channelCount: 1, channelCountMode: 'explicit' }),
    );
    let tail: AudioNode = input;
    if (place.cutoff !== null && place.cutoff < SCHEDULE.bypassCutoff) {
      tail = tail.connect(v.filter('lowpass', place.cutoff, 0));
    }
    if (place.pan !== 0 || place.panTo !== undefined) {
      const panner = v.panner(place.pan);
      if (place.panTo !== undefined) {
        panner.pan.setValueAtTime(place.pan, when);
        panner.pan.linearRampToValueAtTime(place.panTo, when + (place.panTime ?? 0.3));
      }
      tail = tail.connect(panner);
    }
    const dest = this.engine.inputs(place.bus);
    tail.connect(dest.dry);
    if (dest.wet && place.wet > 0) tail.connect(v.gain(place.wet)).connect(dest.wet);
    build(v, input);
    v.finish();
    this.admit(family, v, input, place.level);
  }

  private admit(family: VoiceFamily, voice: Voice, input: GainNode, level: number): void {
    const now = this.engine.now;
    let pool = this.pools.get(family);
    if (!pool) {
      pool = [];
      this.pools.set(family, pool);
    }
    for (let i = pool.length - 1; i >= 0; i--) {
      const a = pool[i];
      if (a && isOver(a, now)) pool.splice(i, 1);
    }
    const entry: ActiveVoice = { start: voice.start, end: voice.end, level, voice, input };
    const victim = pickVictim(pool, entry, VOICE_CAPS[family]);
    if (victim === 'candidate') {
      this.cut(entry, now);
      return;
    }
    if (victim !== null) {
      const weakest = pool[victim];
      if (weakest) this.cut(weakest, now);
      pool.splice(victim, 1);
    }
    pool.push(entry);
  }

  private cut(a: ActiveVoice, now: number): void {
    a.input.gain.cancelScheduledValues(now);
    a.input.gain.setTargetAtTime(0, now, BUS.cutTau);
    a.voice.stopEarly(now + BUS.cutTau * 6);
  }
}

/** Hauteur propre à une créature (±6 %), stable d'un son à l'autre pour la reconnaître. */
function creaturePitch(id: number): number {
  const h = Math.sin(id * 12.9898 + 78.233) * 43758.5453;
  return 0.94 + (h - Math.floor(h)) * 0.12;
}

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
