import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/tuning';
import { input, run, seconds, worldFromGrid } from '../fixtures';
import type { GuetteurState, LeviathanState, World } from '../world';
import { emitPulse } from './pulse';

function guetteur(w: World): GuetteurState {
  const c = w.state.creatures.find((x) => x.kind === 'guetteur');
  if (c?.kind !== 'guetteur') throw new Error('pas de Guetteur');
  return c;
}

function leviathan(w: World): LeviathanState {
  const c = w.state.creatures.find((x) => x.kind === 'leviathan');
  if (c?.kind !== 'leviathan') throw new Error('pas de Léviathan');
  return c;
}

const OPEN = `
  ##################################
  #S..............................X#
  #................................#
  #..................G.............#
  #................................#
  ##################################
`;

describe('écoute', () => {
  it('un Guetteur entend une impulsion dans son rayon et fonce vers son origine, pas vers la sonde', () => {
    const w = worldFromGrid(OPEN);
    const g = guetteur(w);
    w.state.probe.pos = { x: 12.5, y: 1.5 };
    const origin = { ...w.state.probe.pos };
    const events = run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(events.find((e) => e.type === 'creatureAlerted')).toMatchObject({ id: g.id, target: origin });
    expect(g.mode).toBe('alert');
    // La sonde s'éloigne ; le Guetteur va quand même à l'origine du bruit.
    w.state.probe.pos = { x: 30.5, y: 4.5 };
    run(w, seconds(TUNING.guetteur.alertDelay + 0.05));
    expect(g.mode).toBe('hunt');
    run(w, seconds(4));
    expect(g.mode).toBe('search');
    expect(Math.hypot(g.pos.x - origin.x, g.pos.y - origin.y)).toBeLessThan(TUNING.guetteur.searchRadius + 1);
  });

  it('n’entend pas au-delà de hearingRadius × loudness', () => {
    const w = worldFromGrid(OPEN);
    w.state.probe.pos = { x: 1.5, y: 1.5 };
    run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(guetteur(w).mode).toBe('wander');
  });

  it('n’entend pas à travers la roche (distance de chemin)', () => {
    const grid = `
      ##############################
      #S..........#...............X#
      #...........#................#
      #...........#.......G........#
      #...........#................#
      #............................#
      ##############################
    `;
    const w = worldFromGrid(grid);
    // En ligne droite le Guetteur est à ~5,4 cases, mais le chemin contourne la paroi (> 9).
    w.state.probe.pos = { x: 11.5, y: 1.5 };
    run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(guetteur(w).mode).toBe('wander');
  });

  it('une impulsion longue porte plus loin', () => {
    const w = worldFromGrid(OPEN);
    w.state.probe.pos = { x: 5.5, y: 1.5 };
    emitPulse(w, 'long');
    run(w, 1);
    expect(guetteur(w).mode).toBe('alert');
  });
});

describe('Guetteur', () => {
  it('au contact, blesse la sonde puis se retire', () => {
    const w = worldFromGrid(OPEN);
    const g = guetteur(w);
    w.state.probe.pos = { x: g.pos.x + 0.5, y: g.pos.y };
    const events = run(w, 1);
    expect(events.some((e) => e.type === 'creatureAttack')).toBe(true);
    expect(w.state.probe.hull).toBe(TUNING.probe.hullMax - 1);
    expect(g.mode).toBe('retreat');
  });

  it('erre sans quitter son territoire, de façon déterministe', () => {
    const a = worldFromGrid(OPEN, { seed: 11 });
    const b = worldFromGrid(OPEN, { seed: 11 });
    run(a, seconds(20));
    run(b, seconds(20));
    const ga = guetteur(a);
    expect(ga.pos).toEqual(guetteur(b).pos);
    expect(Math.hypot(ga.pos.x - ga.home.x, ga.pos.y - ga.home.y)).toBeLessThan(TUNING.guetteur.wanderRadius + 1);
  });

  it('cliquette quand la sonde est proche', () => {
    const w = worldFromGrid(OPEN);
    const g = guetteur(w);
    w.state.probe.pos = { x: g.pos.x + 3, y: g.pos.y };
    w.state.probe.invuln = 99;
    const events = run(w, seconds(TUNING.guetteur.clickInterval * 2 + 0.1));
    expect(events.some((e) => e.type === 'creatureClick')).toBe(true);
  });
});

describe('Léviathan', () => {
  const RACE = `
    ####################################
    #L.................................#
    #..................................#
    #........................S........X#
    ####################################
  `;

  it('s’éveille à la première impulsion et se rapproche sans cesse', () => {
    const w = worldFromGrid(RACE);
    const l = leviathan(w);
    run(w, 1);
    expect(l.awake).toBe(false);
    const events = run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(events.some((e) => e.type === 'leviathanWoke')).toBe(true);
    const x0 = l.pos.x;
    run(w, seconds(2));
    expect(l.pos.x).toBeGreaterThan(x0 + 1.5);
  });

  it('chaque impulsion lui donne un élan qui décroît', () => {
    const w = worldFromGrid(RACE);
    const l = leviathan(w);
    emitPulse(w, 'short');
    run(w, 1);
    expect(l.surge).toBeGreaterThan(TUNING.leviathan.surgeSpeed * 0.9);
    run(w, seconds(TUNING.leviathan.surgeDecay + 0.1));
    expect(l.surge).toBe(0);
  });

  it('son contact détruit la sonde ; à la reprise il est replacé loin', () => {
    const w = worldFromGrid(RACE);
    const l = leviathan(w);
    l.awake = true;
    l.pos = { x: w.state.probe.pos.x - 1, y: w.state.probe.pos.y };
    const events = run(w, 2);
    expect(events.some((e) => e.type === 'probeDestroyed')).toBe(true);
    run(w, seconds(TUNING.probe.destroyedDuration + 0.1));
    const back = leviathan(w);
    expect(w.state.probe.pos.x - back.pos.x).toBeGreaterThanOrEqual(TUNING.leviathan.respawnDistance - 1);
  });
});
