import { describe, expect, it } from 'vitest';
import {
  fillBrown,
  fillCrackle,
  fillImpulseResponse,
  fillWhite,
  makeLoopable,
  normalizePeak,
} from './noise';

/** Hasard reproductible pour les tests (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function energy(data: Float32Array, from: number, to: number): number {
  let e = 0;
  for (let i = from; i < to; i++) e += data[i]! * data[i]!;
  return e;
}

describe('bruits', () => {
  it('bruit blanc dans [−1, 1]', () => {
    const out = new Float32Array(10000);
    fillWhite(out, seeded(1));
    for (const v of out) expect(Math.abs(v)).toBeLessThanOrEqual(1);
  });

  it('bruit brun normalisé : borné et plus lisse que le blanc', () => {
    const brown = new Float32Array(20000);
    fillBrown(brown, seeded(2));
    normalizePeak(brown, 0.9);
    let maxAbs = 0;
    let step = 0;
    for (let i = 1; i < brown.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(brown[i]!));
      step += Math.abs(brown[i]! - brown[i - 1]!);
    }
    expect(maxAbs).toBeCloseTo(0.9, 5);
    expect(step / brown.length).toBeLessThan(0.1);
  });
});

describe('makeLoopable', () => {
  it('rend la jointure continue : out[0] = raw[length], out[length − 1] = raw[length − 1]', () => {
    const length = 1000;
    const fade = 100;
    const raw = new Float32Array(length + fade);
    for (let i = 0; i < raw.length; i++) raw[i] = i;
    const out = makeLoopable(raw, length, fade);
    expect(out.length).toBe(length);
    expect(out[0]).toBeCloseTo(raw[length]!);
    expect(out[length - 1]).toBe(raw[length - 1]);
    expect(out[500]).toBe(raw[500]);
  });

  it('bruit brun bouclé : pas de saut à la jointure', () => {
    const length = 48000;
    const fade = 2400;
    const raw = new Float32Array(length + fade);
    fillBrown(raw, seeded(3));
    const out = makeLoopable(raw, length, fade);
    normalizePeak(out, 0.9);
    let maxStep = 0;
    for (let i = 1; i < out.length; i++)
      maxStep = Math.max(maxStep, Math.abs(out[i]! - out[i - 1]!));
    expect(Math.abs(out[0]! - out[length - 1]!)).toBeLessThanOrEqual(maxStep * 1.5);
  });
});

describe('fillCrackle', () => {
  it('produit des impulsions éparses, bornées', () => {
    const out = new Float32Array(48000);
    fillCrackle(out, 48000, 140, seeded(4));
    let silent = 0;
    for (const v of out) {
      expect(Math.abs(v)).toBeLessThanOrEqual(0.95 + 1e-6);
      if (v === 0) silent++;
    }
    expect(silent / out.length).toBeGreaterThan(0.5);
    expect(silent).toBeLessThan(out.length);
  });
});

describe('fillImpulseResponse', () => {
  const opts = { seconds: 2.5, decayDb: 60, preDelay: 0.018, brightStart: 0.6, brightEnd: 0.06 };
  const sr = 8000;

  it('silence pendant le pré-délai, décroissance marquée, fin à zéro', () => {
    const out = new Float32Array(Math.floor(opts.seconds * sr));
    fillImpulseResponse(out, sr, opts, seeded(5));
    const pre = Math.floor(opts.preDelay * sr);
    for (let i = 0; i < pre; i++) expect(out[i]).toBe(0);
    const tenth = Math.floor(out.length / 10);
    const head = energy(out, pre, pre + tenth);
    const tail = energy(out, out.length - tenth, out.length);
    expect(head).toBeGreaterThan(0);
    expect(tail / head).toBeLessThan(0.001);
    expect(Math.abs(out[out.length - 1]!)).toBe(0);
    for (const v of out) expect(Number.isFinite(v)).toBe(true);
  });
});
