import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/tuning';
import { input, run, seconds, worldFromGrid } from '../fixtures';
import { SURFACE_ABSORBED, SURFACE_NONE, SURFACE_ROCK } from '../world';
import { emitPulse } from './pulse';

const ROOM = `
  ###############
  #.............#
  #.............#
  #......S......#
  #.............#
  #.............#
  #............X#
  ###############
`;

describe('charge de l’impulsion', () => {
  it('un appui bref émet une impulsion courte au relâchement', () => {
    const w = worldFromGrid(ROOM);
    const down = run(w, 12, input({ pulsePressed: true, pulseHeld: true }));
    expect(down.some((e) => e.type === 'chargeStarted')).toBe(true);
    expect(down.some((e) => e.type === 'pulseEmitted')).toBe(false);
    const up = run(w, 1, input({ pulseReleased: true }));
    expect(up.find((e) => e.type === 'pulseEmitted')).toMatchObject({ kind: 'short' });
    expect(w.stats.pulses).toBe(1);
  });

  it('un appui et un relâchement dans le même pas ne sont pas perdus', () => {
    const w = worldFromGrid(ROOM);
    const events = run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(events.find((e) => e.type === 'pulseEmitted')).toMatchObject({ kind: 'short' });
  });

  it('le maintien déclenche seul l’impulsion longue à longChargeTime', () => {
    const w = worldFromGrid(ROOM);
    const events = run(w, seconds(TUNING.pulse.longChargeTime) + 2, input({ pulsePressed: true, pulseHeld: true }));
    const emitted = events.filter((e) => e.type === 'pulseEmitted');
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ kind: 'long' });
  });

  it('refuse pendant la recharge, sans compter l’impulsion', () => {
    const w = worldFromGrid(ROOM);
    run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    const again = run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(again).toContainEqual({ type: 'pulseDenied', reason: 'cooldown' });
    expect(w.stats.pulses).toBe(1);
    run(w, seconds(TUNING.pulse.short.cooldown));
    const later = run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(later.some((e) => e.type === 'pulseEmitted')).toBe(true);
  });

  it('la recharge suit le type de la dernière impulsion', () => {
    const w = worldFromGrid(ROOM);
    emitPulse(w, 'long');
    expect(w.state.probe.cooldown).toBe(TUNING.pulse.long.cooldown);
    run(w, seconds(TUNING.pulse.short.cooldown) + 1);
    const denied = run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(denied).toContainEqual({ type: 'pulseDenied', reason: 'cooldown' });
  });

  it('avec l’énergie, une impulsion coûte et un manque d’énergie la refuse', () => {
    const w = worldFromGrid(ROOM, { tuning: { energy: { enabled: true } } });
    const full = w.state.probe.energy;
    emitPulse(w, 'short');
    expect(w.state.probe.energy).toBe(full - TUNING.pulse.short.energyCost);
    w.state.probe.cooldown = 0;
    w.state.probe.energy = TUNING.pulse.short.energyCost - 1;
    const events = run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(events).toContainEqual({ type: 'pulseDenied', reason: 'energy' });
  });
});

describe('propagation', () => {
  it('les rayons s’arrêtent sur les parois de la salle', () => {
    const w = worldFromGrid(ROOM);
    const pulse = emitPulse(w, 'short');
    // Rayon vers la droite (angle 0) : paroi en x = 14, sonde en 7,5.
    expect(pulse.hitSurface[0]).toBe(SURFACE_ROCK);
    expect(pulse.hitDist[0]).toBeCloseTo(14 - 7.5, 3);
    // Vers le haut (angle 3π/2) : paroi en y = 1, sonde en 3,5.
    const up = (pulse.hitDist.length * 3) / 4;
    expect(pulse.hitDist[up]).toBeCloseTo(2.5, 3);
  });

  it('un rayon sans obstacle s’arrête au rayon maximal', () => {
    const w = worldFromGrid(`
      ##################################
      #S..............................X#
      ##################################
    `);
    const pulse = emitPulse(w, 'short');
    expect(pulse.hitSurface[0]).toBe(SURFACE_NONE);
    expect(pulse.hitDist[0]).toBeCloseTo(TUNING.pulse.short.radius);
  });

  it('ne révèle que ce qui est en ligne de vue', () => {
    const w = worldFromGrid(`
      #############
      #S..o..#.o..#
      #......#....#
      #..........X#
      #############
    `);
    emitPulse(w, 'short');
    run(w, seconds(1));
    const pearls = w.state.reveals.filter((r) => r.kind === 'pearl').map((r) => r.ref);
    expect(pearls).toEqual([0]);
  });

  it('les révélations et impulsions s’éteignent, plus tard avec la rémanence allongée', () => {
    const normal = worldFromGrid(ROOM.replace('S......#', 'S..o...#'));
    const long = worldFromGrid(ROOM.replace('S......#', 'S..o...#'), { afterglowMultiplier: 1.75 });
    emitPulse(normal, 'short');
    emitPulse(long, 'short');
    run(normal, seconds(1));
    run(long, seconds(1));
    expect(normal.state.reveals.length).toBeGreaterThan(0);
    run(normal, seconds(TUNING.pulse.short.afterglow + 0.5));
    run(long, seconds(TUNING.pulse.short.afterglow + 0.5));
    expect(normal.state.reveals).toHaveLength(0);
    expect(normal.state.pulses).toHaveLength(0);
    expect(long.state.reveals.length).toBeGreaterThan(0);
  });

  it('la vase absorbe les rayons, et tout est absorbé si l’on émet depuis la vase', () => {
    const w = worldFromGrid(`
      ###########
      #S..~~~..X#
      #.........#
      ###########
    `);
    const pulse = emitPulse(w, 'short');
    expect(pulse.hitSurface[0]).toBe(SURFACE_ABSORBED);
    expect(pulse.hitDist[0]).toBeCloseTo(4 - 1.5, 3);
    w.state.probe.pos = { x: 5.5, y: 1.5 };
    w.state.probe.cooldown = 0;
    const inside = emitPulse(w, 'short');
    expect(Array.from(inside.hitSurface).every((s) => s === SURFACE_ABSORBED)).toBe(true);
  });

  it('une porte fermée arrête les rayons, ouverte elle les laisse passer', () => {
    const w = worldFromGrid(`
      ###########
      #S..A...aX#
      ###########
    `);
    const closed = emitPulse(w, 'short');
    expect(closed.hitDist[0]).toBeCloseTo(4 - 1.5, 3);
    w.state.doors[0]!.progress = 1;
    w.state.probe.cooldown = 0;
    const open = emitPulse(w, 'short');
    expect(open.hitDist[0]).toBeGreaterThan(5);
  });
});

describe('échos', () => {
  it('un écho de paroi par secteur, délai = aller-retour', () => {
    const w = worldFromGrid(ROOM);
    const events = run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    const e = events.find((x) => x.type === 'pulseEchoes');
    expect(e).toBeDefined();
    if (e?.type !== 'pulseEchoes') return;
    const walls = e.echoes.filter((x) => x.surface === 'rock');
    expect(walls).toHaveLength(TUNING.echo.sectors);
    for (const echo of walls) {
      expect(echo.delay).toBeCloseTo((2 * echo.distance) / TUNING.pulse.short.speed, 6);
    }
    // Le plus proche est la paroi du haut ou du bas (2,5 cases).
    expect(Math.min(...walls.map((x) => x.distance))).toBeCloseTo(2.5, 1);
  });

  it('pas d’écho dans une direction absorbée ou vide, écho de perle en ligne de vue', () => {
    const w = worldFromGrid(`
      ##################################
      #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
      #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
      #~~~~~~~~~~S..o.................X#
      #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
      ##################################
    `);
    const events = run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    const e = events.find((x) => x.type === 'pulseEchoes');
    if (e?.type !== 'pulseEchoes') throw new Error('pas d’échos');
    expect(e.echoes.filter((x) => x.surface === 'rock')).toHaveLength(0);
    expect(e.echoes.filter((x) => x.surface === 'pearl')).toHaveLength(1);
  });
});
