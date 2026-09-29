import { describe, expect, it } from 'vitest';
import { TUNING } from '../data/tuning';
import { mergeTuning } from './tuning';

describe('mergeTuning', () => {
  it('applique les surcharges en profondeur sans toucher la base', () => {
    const merged = mergeTuning(TUNING, {
      guetteur: { hearingRadius: 42 },
      energy: { enabled: true },
    });
    expect(merged.guetteur.hearingRadius).toBe(42);
    expect(merged.guetteur.huntSpeed).toBe(TUNING.guetteur.huntSpeed);
    expect(merged.energy.enabled).toBe(true);
    expect(TUNING.guetteur.hearingRadius).not.toBe(42);
    expect(TUNING.energy.enabled).toBe(false);
  });

  it('renvoie une copie indépendante sans surcharge', () => {
    const merged = mergeTuning(TUNING);
    expect(merged).toEqual(TUNING);
    merged.probe.thrust = 999;
    expect(TUNING.probe.thrust).not.toBe(999);
  });
});
