import { describe, expect, it } from 'vitest';
import { input, run, seconds, worldFromGrid } from '../fixtures';

const CORRIDOR = `
  ##############
  #S..o......X.#
  ##############
`;

describe('balise, perles et fin de niveau', () => {
  it('la balise émet à l’intervalle du niveau', () => {
    const w = worldFromGrid(CORRIDOR, { beaconInterval: 2 });
    const events = run(w, seconds(6.5));
    const pings = events.filter((e) => e.type === 'beaconPing');
    expect(pings).toHaveLength(3);
    expect(pings[0]).toMatchObject({ pos: { x: 11.5, y: 1.5 } });
  });

  it('ramasse une perle au contact puis termine le niveau à la balise', () => {
    const w = worldFromGrid(CORRIDOR);
    const events = run(w, seconds(4), input({ move: { x: 1, y: 0 } }));
    expect(events).toContainEqual({
      type: 'pearlCollected',
      pos: { x: 4.5, y: 1.5 },
      remaining: 0,
    });
    expect(events.some((e) => e.type === 'levelComplete')).toBe(true);
    expect(w.state.status).toBe('complete');
    const t = w.stats.time;
    run(w, seconds(1), input({ move: { x: 1, y: 0 } }));
    expect(w.stats.time).toBe(t);
  });
});
