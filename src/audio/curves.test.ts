import { describe, expect, it } from 'vitest';
import {
  bumpLevel,
  chargeLevel,
  chargePitch,
  crowdFactors,
  HEARTBEAT,
  huntRate,
  leviathanProximity,
  pulseTrainCurve,
  SLOW_PULSE,
  smoothstep,
  softClipCurve,
  volumeToGain,
} from './curves';
import { AMBIENCE } from './mix';

describe('volume', () => {
  it('suit une courbe de puissance bornée', () => {
    expect(volumeToGain(0, 2)).toBe(0);
    expect(volumeToGain(1, 2)).toBe(1);
    expect(volumeToGain(0.5, 2)).toBeCloseTo(0.25);
    expect(volumeToGain(3, 2)).toBe(1);
    expect(volumeToGain(-1, 2)).toBe(0);
  });
});

describe('bumpLevel', () => {
  it('croît avec l’intensité, un frôlement reste audible', () => {
    expect(bumpLevel(0)).toBeGreaterThan(0);
    expect(bumpLevel(1)).toBe(1);
    expect(bumpLevel(0.5)).toBeLessThan(bumpLevel(0.8));
    expect(bumpLevel(5)).toBe(1);
  });
});

describe('leviathanProximity', () => {
  const { range, exponent } = AMBIENCE.leviathan;

  it('est nulle endormi ou hors de portée, maximale au contact', () => {
    expect(leviathanProximity(null, range, exponent)).toBe(0);
    expect(leviathanProximity(range, range, exponent)).toBe(0);
    expect(leviathanProximity(range + 10, range, exponent)).toBe(0);
    expect(leviathanProximity(0, range, exponent)).toBe(1);
  });

  it('augmente quand la distance de chemin diminue', () => {
    let prev = -1;
    for (let d: number = range; d >= 0; d -= 1) {
      const p = leviathanProximity(d, range, exponent);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe('charge', () => {
  const c = AMBIENCE.charge;

  it('la hauteur monte de `octaves` sur la charge', () => {
    expect(chargePitch(0, c.pitchStart, c.octaves)).toBeCloseTo(c.pitchStart);
    expect(chargePitch(1, c.pitchStart, c.octaves)).toBeCloseTo(c.pitchStart * 2 ** c.octaves);
    expect(chargePitch(0.5, c.pitchStart, c.octaves)).toBeGreaterThan(c.pitchStart);
  });

  it('muette sans charge et au tout début (appui bref), présente ensuite', () => {
    expect(chargeLevel(null, c.fadeStart, c.fadeEnd)).toBe(0);
    expect(chargeLevel(0, c.fadeStart, c.fadeEnd)).toBe(0);
    expect(chargeLevel(c.fadeStart, c.fadeStart, c.fadeEnd)).toBe(0);
    expect(chargeLevel(0.5, c.fadeStart, c.fadeEnd)).toBeGreaterThan(0.5);
    expect(chargeLevel(1, c.fadeStart, c.fadeEnd)).toBeCloseTo(1);
  });
});

describe('huntRate', () => {
  it('accélère avec le nombre de Guetteurs, plafonnée', () => {
    expect(huntRate(1, 1.6, 0.35, 2.6)).toBeCloseTo(1.6);
    expect(huntRate(2, 1.6, 0.35, 2.6)).toBeCloseTo(1.95);
    expect(huntRate(10, 1.6, 0.35, 2.6)).toBe(2.6);
    expect(huntRate(0, 1.6, 0.35, 2.6)).toBeCloseTo(1.6);
  });
});

describe('crowdFactors', () => {
  it('atténue les échos simultanés, laisse intacts les échos isolés', () => {
    const f = crowdFactors([0.1, 0.1, 0.1, 0.1, 0.5], 0.02, 0.5);
    expect(f[0]).toBeCloseTo(0.5);
    expect(f[3]).toBeCloseTo(0.5);
    expect(f[4]).toBe(1);
  });

  it('renvoie un facteur par écho', () => {
    expect(crowdFactors([], 0.02, 0.5)).toEqual([]);
    expect(crowdFactors([0.3], 0.02, 0.5)).toEqual([1]);
  });
});

describe('formes de WaveShaper', () => {
  it('saturation douce : impaire, bornée à ±1, monotone', () => {
    const c = softClipCurve(3, 257);
    expect(c[0]).toBeCloseTo(-1);
    expect(c[256]).toBeCloseTo(1);
    expect(c[128]).toBeCloseTo(0);
    for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThanOrEqual(c[i - 1]!);
  });

  it('impulsions : ~0 aux extrémités (pas de claquement au saut de la dent de scie), dans [0, 1]', () => {
    for (const bumps of [HEARTBEAT, SLOW_PULSE]) {
      const c = pulseTrainCurve(bumps);
      expect(c[0]!).toBeLessThan(0.001);
      expect(c[c.length - 1]!).toBeLessThan(0.001);
      let max = 0;
      for (const v of c) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        max = Math.max(max, v);
      }
      expect(max).toBeGreaterThan(0.9);
    }
  });

  it('smoothstep', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(1, 1, 0.5)).toBe(0);
  });
});
