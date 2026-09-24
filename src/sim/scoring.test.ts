import { describe, expect, it } from 'vitest';
import { input, run, seconds, worldFromGrid } from './fixtures';
import { countStars, runResult } from './scoring';
import { emitPulse } from './systems/pulse';

const GRID = `
  ##############
  #S..o..o...X.#
  ##############
`;

describe('étoiles', () => {
  it('trois étoiles : terminé, toutes les perles, sous le par', () => {
    const w = worldFromGrid(GRID, { par: 2 });
    emitPulse(w, 'short');
    run(w, seconds(4), input({ move: { x: 1, y: 0 } }));
    const r = runResult(w);
    expect(r.stars).toEqual({ complete: true, pearls: true, par: true });
    expect(countStars(r.stars)).toBe(3);
    expect(r).toMatchObject({ pulses: 1, par: 2, pearls: 2, pearlsTotal: 2, deaths: 0 });
  });

  it('le par compte courtes et longues ; dépassé, pas d’étoile de par', () => {
    const w = worldFromGrid(GRID, { par: 1 });
    emitPulse(w, 'short');
    w.state.probe.cooldown = 0;
    emitPulse(w, 'long');
    run(w, seconds(4), input({ move: { x: 1, y: 0 } }));
    expect(runResult(w).stars).toEqual({ complete: true, pearls: true, par: false });
  });

  it('une perle manquée retire l’étoile des perles ; non terminé, aucune étoile', () => {
    const w = worldFromGrid(GRID);
    w.state.pearls[1]!.taken = false;
    w.state.probe.pos = { x: 8.5, y: 1.5 };
    run(w, seconds(3), input({ move: { x: 1, y: 0 } }));
    expect(runResult(w).stars).toEqual({ complete: true, pearls: false, par: true });
    const unfinished = worldFromGrid(GRID);
    expect(countStars(runResult(unfinished).stars)).toBe(0);
  });
});
