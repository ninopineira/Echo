import { REVERB } from '../mix';
import {
  fillBrown,
  fillCrackle,
  fillImpulseResponse,
  fillWhite,
  makeLoopable,
  normalizePeak,
  type Random,
} from '../noise';

/** Tampons partagés par toutes les recettes, générés une seule fois au déblocage. */
export interface NoiseBank {
  /** Bruit blanc mono bouclable (3 s). */
  white: AudioBuffer;
  /** Bruit brun stéréo décorrélé bouclable (6 s) : lit sonore, grondements. */
  brown: AudioBuffer;
  /** Crépitement mono (1 s) : écho d'oursin, craquements lointains. */
  crackle: AudioBuffer;
}

const LOOP_FADE = 0.05;
/** Densité du crépitement (micro-impulsions par seconde). */
const CRACKLE_RATE = 140;

function loopableChannel(
  sampleRate: number,
  seconds: number,
  fill: (out: Float32Array, rand: Random) => void,
  peak: number,
): Float32Array<ArrayBuffer> {
  const length = Math.floor(seconds * sampleRate);
  const fade = Math.floor(LOOP_FADE * sampleRate);
  const raw = new Float32Array(length + fade);
  fill(raw, Math.random);
  const out = makeLoopable(raw, length, fade);
  normalizePeak(out, peak);
  return out;
}

function bufferFrom(
  ctx: BaseAudioContext,
  channels: readonly Float32Array<ArrayBuffer>[],
): AudioBuffer {
  const length = channels[0]?.length ?? 1;
  const buffer = ctx.createBuffer(Math.max(1, channels.length), length, ctx.sampleRate);
  channels.forEach((data, i) => {
    buffer.copyToChannel(data, i);
  });
  return buffer;
}

export function createNoiseBank(ctx: BaseAudioContext): NoiseBank {
  const sr = ctx.sampleRate;
  const crackle = new Float32Array(Math.floor(sr));
  fillCrackle(crackle, sr, CRACKLE_RATE, Math.random);
  return {
    white: bufferFrom(ctx, [loopableChannel(sr, 3, fillWhite, 0.95)]),
    brown: bufferFrom(ctx, [
      loopableChannel(sr, 6, fillBrown, 0.9),
      loopableChannel(sr, 6, fillBrown, 0.9),
    ]),
    crackle: bufferFrom(ctx, [crackle]),
  };
}

/** Réponse impulsionnelle stéréo de la réverbération (~2,5 s, canaux décorrélés). */
export function createImpulseResponse(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(REVERB.seconds * ctx.sampleRate);
  const channels = [new Float32Array(length), new Float32Array(length)];
  for (const ch of channels) fillImpulseResponse(ch, ctx.sampleRate, REVERB, Math.random);
  return bufferFrom(ctx, channels);
}
