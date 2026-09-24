import { describe, expect, it } from 'vitest';
import { TUNING } from '../../data/tuning';
import { input, run, seconds, worldFromGrid } from '../fixtures';
import type { GuetteurState } from '../world';

describe('vase', () => {
  it('freine fortement la sonde', () => {
    const grid = (floor: string): string => `
      ##########################
      #S${floor}X#
      ##########################
    `;
    const water = worldFromGrid(grid('......................'));
    const mud = worldFromGrid(grid('~~~~~~~~~~~~~~~~~~~~~~'));
    mud.state.probe.pos = { x: 2.5, y: 1.5 };
    water.state.probe.pos = { x: 2.5, y: 1.5 };
    run(water, seconds(2), input({ move: { x: 1, y: 0 } }));
    run(mud, seconds(2), input({ move: { x: 1, y: 0 } }));
    const cruiseMud = TUNING.probe.thrust / (TUNING.probe.drag * TUNING.mud.dragMultiplier);
    // Vitesse limite discrète un peu sous thrust / (drag × mud) à cause de l'intégration par pas.
    expect(mud.state.probe.vel.x).toBeGreaterThan(cruiseMud * 0.9);
    expect(mud.state.probe.vel.x).toBeLessThan(cruiseMud * 1.01);
    expect(mud.state.probe.pos.x - 2.5).toBeLessThan((water.state.probe.pos.x - 2.5) * 0.4);
  });

  it('ralentit le Guetteur et étouffe le son', () => {
    const w = worldFromGrid(`
      ####################################
      #S~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~X#
      #~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#
      #~~~~~~~~~~~~~~~~~G~~~~~~~~~~~~~~~~#
      ####################################
    `);
    const g = w.state.creatures[0] as GuetteurState;
    // À 6 cases en eau libre il entendrait une impulsion courte (ouïe 9) ; dans la vase le coût × 3 l'en empêche.
    w.state.probe.pos = { x: g.pos.x - 6, y: g.pos.y };
    run(w, 1, input({ pulsePressed: true, pulseReleased: true }));
    expect(g.mode).toBe('wander');
    // Chasse forcée : vitesse divisée par deux.
    g.pos.x += 1;
    g.mode = 'hunt';
    g.target = { x: g.pos.x + 10, y: g.pos.y };
    const x0 = g.pos.x;
    run(w, seconds(2));
    expect(g.pos.x - x0).toBeLessThan(TUNING.guetteur.huntSpeed * 0.5 * 2 + 0.2);
  });
});
