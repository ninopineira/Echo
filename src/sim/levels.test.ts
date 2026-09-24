import { describe, expect, it } from 'vitest';
import { LEVEL_CATALOG } from '../data/levels/index';
import { LEVELS, TUNING } from '../data/tuning';
import { compileLevel } from './level/compile';
import { parseLevel } from './level/parse';
import { nextRandom } from './rng';
import { stepWorld } from './step';
import { mergeTuning } from './tuning';
import { validateCatalog } from './validate/validate';
import { createWorld, type World } from './world';

function build(index: number, seed: number): World {
  const src = LEVEL_CATALOG[index]!;
  const parsed = parseLevel(src);
  if (!parsed.ok) throw new Error(`niveau ${src.id} invalide`);
  const lt = LEVELS[src.id]!;
  return createWorld(
    compileLevel(parsed.level),
    mergeTuning(TUNING, lt.overrides),
    lt,
    { afterglowMultiplier: 1, god: false },
    seed,
  );
}

/** Joue 10 s d'entrées pseudo-aléatoires (à graine) : impulsions, lancers, nage. */
function playRandom(world: World, seed: number, steps = 1200): void {
  const r = { rng: seed };
  let held = false;
  for (let i = 0; i < steps; i++) {
    const press = !held && nextRandom(r) < 0.02;
    const release = held && nextRandom(r) < 0.05;
    if (press) held = true;
    if (release) held = false;
    const a = nextRandom(r) * Math.PI * 2;
    stepWorld(world, {
      move: nextRandom(r) < 0.8 ? { x: Math.cos(a), y: Math.sin(a) } : { x: 0, y: 0 },
      pulseHeld: held,
      pulsePressed: press,
      pulseReleased: release,
      throwPressed: nextRandom(r) < 0.01,
    });
    world.events = [];
  }
}

function fingerprint(world: World): string {
  const s = world.state;
  return JSON.stringify([
    s.probe.pos,
    s.probe.vel,
    s.probe.hull,
    s.rng,
    world.stats,
    s.creatures.map((c) => c.pos),
  ]);
}

describe('catalogue des niveaux', () => {
  it('tous les niveaux passent la validation sans erreur', () => {
    const report = validateCatalog(LEVEL_CATALOG, LEVELS, TUNING);
    const errors = [
      ...report.catalog,
      ...report.reports.flatMap((r) => r.diagnostics.map((d) => ({ ...d, message: `${r.id}: ${d.message}` }))),
    ].filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });

  it.each(LEVEL_CATALOG.map((l, i) => [l.id, i] as const))(
    '%s : 10 s sans entrée puis avec des entrées aléatoires, sans NaN ni exception',
    (_id, index) => {
      const world = build(index, 7);
      for (let i = 0; i < 1200; i++) {
        stepWorld(world, {
          move: { x: 0, y: 0 },
          pulseHeld: false,
          pulsePressed: false,
          pulseReleased: false,
          throwPressed: false,
        });
        world.events = [];
      }
      playRandom(world, 99);
      const p = world.state.probe;
      expect(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y)).toBe(true);
      expect(p.pos.x).toBeGreaterThan(0);
      expect(p.pos.x).toBeLessThan(world.level.width);
      expect(p.pos.y).toBeGreaterThan(0);
      expect(p.pos.y).toBeLessThan(world.level.height);
    },
  );

  it.each(LEVEL_CATALOG.map((l, i) => [l.id, i] as const))('%s : déterministe', (_id, index) => {
    const a = build(index, 3);
    const b = build(index, 3);
    playRandom(a, 5);
    playRandom(b, 5);
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});
