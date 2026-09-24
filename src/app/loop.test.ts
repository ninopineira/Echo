import { describe, expect, it } from 'vitest';
import { STEP } from '../sim/step';
import { advance, MAX_STEPS } from './loop';

describe('advance', () => {
  it('exécute deux pas par frame de 60 Hz et garde le reste', () => {
    const a = advance(0, 1 / 60 + STEP / 2);
    expect(a.steps).toBe(2);
    expect(a.acc).toBeCloseTo(STEP / 2);
    expect(a.alpha).toBeCloseTo(0.5);
  });

  it('accumule les petites frames', () => {
    let acc = 0;
    let steps = 0;
    for (let i = 0; i < 144; i++) {
      const a = advance(acc, 1 / 144);
      acc = a.acc;
      steps += a.steps;
    }
    expect(steps).toBeGreaterThanOrEqual(119);
    expect(steps).toBeLessThanOrEqual(120);
  });

  it('plafonne les grandes frames', () => {
    const a = advance(0, 5);
    expect(a.steps).toBe(MAX_STEPS);
    expect(a.acc).toBeLessThan(STEP);
  });

  it('ignore les durées négatives', () => {
    expect(advance(0, -1).steps).toBe(0);
  });
});
