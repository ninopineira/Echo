import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/tuning';
import { input, run, seconds, worldFromGrid } from '../fixtures';
import { emitPulse } from './pulse';
import { respawn } from './lifecycle';

const URCHINS = `
  ##############
  #S.*.........#
  #............#
  #...........X#
  ##############
`;

describe('oursins, coque et reprise', () => {
  it('un oursin retire un point, repousse la sonde et rend invulnérable', () => {
    const w = worldFromGrid(URCHINS);
    const events = run(w, seconds(1), input({ move: { x: 1, y: 0 } }));
    const damage = events.filter((e) => e.type === 'damage');
    expect(damage).toHaveLength(1);
    expect(w.state.probe.hull).toBe(TUNING.probe.hullMax - 1);
    expect(w.state.probe.invuln).toBeGreaterThan(0);
  });

  it('ne blesse pas en mode sans dégât', () => {
    const w = worldFromGrid(URCHINS, { god: true });
    run(w, seconds(1), input({ move: { x: 1, y: 0 } }));
    expect(w.state.probe.hull).toBe(TUNING.probe.hullMax);
  });

  it('à zéro, la sonde implose puis reprend au départ ; les stats sont conservées', () => {
    const w = worldFromGrid(URCHINS);
    w.state.pearls = [];
    emitPulse(w, 'short');
    w.state.probe.hull = 1;
    const events = run(w, seconds(1), input({ move: { x: 1, y: 0 } }));
    expect(events.some((e) => e.type === 'probeDestroyed')).toBe(true);
    expect(w.state.status).toBe('dying');
    const more = run(w, seconds(TUNING.probe.destroyedDuration + 0.1));
    expect(more).toContainEqual({ type: 'respawn', pos: { x: 1.5, y: 1.5 }, fromCheckpoint: false });
    expect(w.state.status).toBe('playing');
    expect(w.state.probe.hull).toBe(TUNING.probe.hullMax);
    expect(w.stats.deaths).toBe(1);
    expect(w.stats.pulses).toBe(1);
  });
});

describe('points de contrôle', () => {
  it('reprend au dernier point activé, perles prises après perdues, stats gardées', () => {
    const w = worldFromGrid(`
      ################
      #S.oP.o......X.#
      ################
    `);
    run(w, seconds(1.4), input({ move: { x: 1, y: 0 } }));
    expect(w.checkpointActive).toBe(true);
    expect(w.state.pearls.map((p) => p.taken)).toEqual([true, true]);
    emitPulse(w, 'short');
    const pulses = w.stats.pulses;
    respawn(w);
    expect(w.state.probe.pos).toEqual({ x: 4.5, y: 1.5 });
    expect(w.state.pearls.map((p) => p.taken)).toEqual([true, false]);
    expect(w.stats.pulses).toBe(pulses);
    expect(w.state.pulses).toHaveLength(0);
  });
});

describe('leviers et portes', () => {
  it('le levier ouvre la porte en doorOpenTime, avec du bruit à la porte', () => {
    const w = worldFromGrid(`
      ##############
      #Sa....A....X#
      ##############
    `);
    const events = run(w, seconds(0.3), input({ move: { x: 1, y: 0 } }));
    expect(events.some((e) => e.type === 'leverPulled')).toBe(true);
    expect(events.find((e) => e.type === 'doorOpening')).toMatchObject({ pos: { x: 7.5, y: 1.5 } });
    expect(events.find((e) => e.type === 'noise')).toMatchObject({ source: 'door' });
    const later = run(w, seconds(TUNING.lever.doorOpenTime + 0.1));
    expect(later).toContainEqual({ type: 'doorOpened', letter: 'A' });
    expect(w.state.doorsVersion).toBe(1);
  });

  it('une porte fermée bloque la sonde', () => {
    const w = worldFromGrid(`
      ##############
      #S.....A...aX#
      ##############
    `);
    run(w, seconds(3), input({ move: { x: 1, y: 0 } }));
    expect(w.state.probe.pos.x).toBeLessThan(7);
  });
});

describe('leurres', () => {
  it('ramasse, lance, rebondit, se pose puis émet des pings bruyants', () => {
    const w = worldFromGrid(`
      ####################
      #S+...............X#
      #..................#
      ####################
    `);
    const pick = run(w, seconds(0.4), input({ move: { x: 1, y: 0 } }));
    expect(pick.some((e) => e.type === 'capsulePicked')).toBe(true);
    expect(w.state.probe.lures).toBe(1);
    const thrown = run(w, 1, input({ throwPressed: true }));
    expect(thrown.some((e) => e.type === 'lureThrown')).toBe(true);
    expect(w.state.probe.lures).toBe(0);
    const later = run(w, seconds(6));
    const pings = later.filter((e) => e.type === 'lurePing');
    expect(pings).toHaveLength(TUNING.lure.pings);
    expect(later.filter((e) => e.type === 'noise' && e.source === 'lure')).toHaveLength(TUNING.lure.pings);
    expect(w.state.lures).toHaveLength(0);
    const empty = run(w, 1, input({ throwPressed: true }));
    expect(empty).toContainEqual({ type: 'lureEmpty' });
  });

  it('un courant emporte le leurre', () => {
    const w = worldFromGrid(`
      ####################
      #S>>>>>>>>>>>>>>>>X#
      ####################
    `);
    w.state.probe.lures = 1;
    w.state.probe.facing = { x: 1, y: 0 };
    run(w, 1, input({ throwPressed: true }));
    run(w, seconds(2));
    // Sans courant, le leurre s'arrêterait vers x ≈ 4,7 ; le courant l'emporte bien au-delà.
    expect(w.state.lures[0]?.pos.x ?? 99).toBeGreaterThan(7);
  });
});

describe('courants et énergie', () => {
  it('un courant pousse la sonde', () => {
    const w = worldFromGrid(`
      ####################
      #S>>>>>>>>........X#
      ####################
    `);
    w.state.probe.pos = { x: 2.5, y: 1.5 };
    run(w, seconds(1));
    expect(w.state.probe.pos.x).toBeGreaterThan(3);
  });

  it('la batterie se recharge lentement jusqu’au maximum', () => {
    const w = worldFromGrid(URCHINS, { tuning: { energy: { enabled: true } } });
    w.state.probe.energy = 0;
    run(w, seconds(2));
    expect(w.state.probe.energy).toBeCloseTo(TUNING.energy.regen * 2, 1);
    run(w, seconds(60));
    expect(w.state.probe.energy).toBe(TUNING.energy.max);
  });
});
