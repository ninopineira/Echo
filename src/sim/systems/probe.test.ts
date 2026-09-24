import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/tuning';
import { input, run, seconds, worldFromGrid } from '../fixtures';

const OPEN = `
  ####################
  #..................#
  #..................#
  #........S.........#
  #..................#
  #..................#
  #.................X#
  ####################
`;

describe('nage de la sonde', () => {
  it('atteint la vitesse de croisière thrust / drag', () => {
    const w = worldFromGrid(OPEN);
    run(w, seconds(1.5), input({ move: { x: 1, y: 0 } }));
    const v = w.state.probe.vel.x;
    expect(v).toBeGreaterThan((TUNING.probe.thrust / TUNING.probe.drag) * 0.97);
    expect(v).toBeLessThan((TUNING.probe.thrust / TUNING.probe.drag) * 1.01);
  });

  it('glisse encore après avoir relâché, puis ralentit', () => {
    const w = worldFromGrid(OPEN);
    run(w, seconds(0.5), input({ move: { x: 1, y: 0 } }));
    const x0 = w.state.probe.pos.x;
    run(w, seconds(0.3));
    expect(w.state.probe.pos.x).toBeGreaterThan(x0 + 0.3);
    run(w, seconds(3));
    expect(Math.abs(w.state.probe.vel.x)).toBeLessThan(0.01);
  });

  it('glisse le long d’une paroi : la composante tangentielle est conservée', () => {
    const w = worldFromGrid(OPEN);
    // Diagonale haut-droite : la paroi du haut (y = 1) arrête y, pas x.
    run(w, seconds(1.2), input({ move: { x: Math.SQRT1_2, y: -Math.SQRT1_2 } }));
    const p = w.state.probe;
    expect(p.pos.y).toBeGreaterThanOrEqual(1 + TUNING.probe.radius - 1e-6);
    expect(p.pos.y).toBeLessThan(1 + TUNING.probe.radius + 0.01);
    expect(p.vel.x).toBeGreaterThan(2);
  });

  it('ne traverse pas une paroi, même à grande vitesse dans un coin', () => {
    const w = worldFromGrid(OPEN);
    const p = w.state.probe;
    p.vel.x = -12;
    p.vel.y = -12;
    run(w, seconds(2), input({ move: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 } }));
    expect(p.pos.x).toBeGreaterThanOrEqual(1 + TUNING.probe.radius - 1e-6);
    expect(p.pos.y).toBeGreaterThanOrEqual(1 + TUNING.probe.radius - 1e-6);
  });

  it('reste immobile sans entrée, même à côté d’un pilier', () => {
    const w = worldFromGrid(`
      #########
      #.......#
      #.S.#..X#
      #.......#
      #########
    `);
    run(w, seconds(3));
    expect(w.state.probe.pos).toEqual({ x: 2.5, y: 2.5 });
  });

  it('un choc rapide produit un événement, un bruit et un arc révélé ; un contact lent non', () => {
    const fast = worldFromGrid(OPEN);
    const events = run(fast, seconds(2), input({ move: { x: 0, y: 1 } }));
    expect(events.some((e) => e.type === 'wallBump')).toBe(true);
    expect(events.some((e) => e.type === 'noise' && e.source === 'bump')).toBe(true);
    expect(fast.state.reveals.some((r) => r.kind === 'wallArc')).toBe(true);

    const slow = worldFromGrid(OPEN);
    slow.state.probe.pos.y = 5.5;
    slow.state.probe.vel.y = 1;
    const soft = run(slow, seconds(1));
    expect(soft.some((e) => e.type === 'wallBump')).toBe(false);
  });
});
