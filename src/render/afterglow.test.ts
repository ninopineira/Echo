import { describe, expect, it } from 'vitest';
import { alphaBucket, ALPHA_BUCKETS, isFlashing, revealAlpha } from './afterglow';

describe('revealAlpha', () => {
  it('rien avant le contact, éclat, puis effacement jusqu’à zéro', () => {
    expect(revealAlpha(-0.1, 0.08, 2.5)).toBe(0);
    expect(revealAlpha(0.02, 0.08, 2.5)).toBe(1);
    expect(isFlashing(0.02, 0.08)).toBe(true);
    const mid = revealAlpha(0.08 + 1.25, 0.08, 2.5);
    expect(mid).toBeGreaterThan(0.6);
    expect(mid).toBeLessThan(0.9);
    expect(revealAlpha(0.08 + 2.5, 0.08, 2.5)).toBe(0);
  });

  it('décroît de façon monotone', () => {
    let prev = 1;
    for (let t = 0.1; t < 3; t += 0.1) {
      const a = revealAlpha(t, 0.08, 2.5);
      expect(a).toBeLessThanOrEqual(prev);
      prev = a;
    }
  });

  it('range les opacités en paliers bornés', () => {
    expect(alphaBucket(0)).toBe(0);
    expect(alphaBucket(1)).toBe(ALPHA_BUCKETS - 1);
    expect(alphaBucket(0.5)).toBe(4);
  });
});
