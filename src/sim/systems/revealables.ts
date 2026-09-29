import type { EchoSurface } from '../events';
import { cellCenter } from '../level/types';
import type { RevealKind, World } from '../world';

/** Objet que l'impulsion peut révéler et qui peut renvoyer un écho. */
export interface Revealable {
  kind: RevealKind;
  /** Surface d'écho, null si l'objet n'en renvoie pas (courants). */
  surface: EchoSurface | null;
  ref: number;
  x: number;
  y: number;
  /** Tolérance de ligne de vue (objet collé à une paroi, porte bloquante…). */
  margin: number;
  angle: number;
  state: number;
}

/** Énumère les objets révélables du monde à cet instant (GDD § 3.2). */
export function forEachRevealable(world: World, fn: (r: Revealable) => void): void {
  const s = world.state;
  const t = world.tuning;
  const level = world.level;
  s.pearls.forEach((p, i) => {
    if (!p.taken) {
      fn({
        kind: 'pearl',
        surface: 'pearl',
        ref: i,
        x: p.x,
        y: p.y,
        margin: t.pearl.radius,
        angle: 0,
        state: 0,
      });
    }
  });
  level.hazards.forEach((h, i) => {
    const c = cellCenter(h);
    fn({
      kind: 'hazard',
      surface: 'hazard',
      ref: i,
      x: c.x,
      y: c.y,
      margin: t.hazard.radius,
      angle: 0,
      state: 0,
    });
  });
  s.capsules.forEach((c, i) => {
    if (!c.taken) {
      fn({
        kind: 'capsule',
        surface: 'capsule',
        ref: i,
        x: c.x,
        y: c.y,
        margin: 0.35,
        angle: 0,
        state: 0,
      });
    }
  });
  s.levers.forEach((l, i) => {
    fn({
      kind: 'lever',
      surface: 'lever',
      ref: i,
      x: l.x,
      y: l.y,
      margin: 0.4,
      angle: 0,
      state: l.pulled ? 1 : 0,
    });
  });
  s.checkpoints.forEach((c, i) => {
    fn({
      kind: 'checkpoint',
      surface: 'checkpoint',
      ref: i,
      x: c.x,
      y: c.y,
      margin: 0.4,
      angle: 0,
      state: c.active ? 1 : 0,
    });
  });
  level.doors.forEach((d, i) => {
    const door = s.doors[i]!;
    if (door.progress >= 1) return;
    for (const cell of d.cells) {
      const c = cellCenter(cell);
      fn({
        kind: 'door',
        surface: null,
        ref: i,
        x: c.x,
        y: c.y,
        margin: 0.75,
        angle: 0,
        state: door.progress,
      });
    }
  });
  for (const cur of level.currents) {
    const c = cellCenter(cur.cell);
    fn({
      kind: 'current',
      surface: null,
      ref: cur.dir,
      x: c.x,
      y: c.y,
      margin: 0.2,
      angle: 0,
      state: cur.dir,
    });
  }
  for (const c of s.creatures) {
    const radius = c.kind === 'guetteur' ? t.guetteur.radius : t.leviathan.radius;
    fn({
      kind: c.kind,
      surface: 'creature',
      ref: c.id,
      x: c.pos.x,
      y: c.pos.y,
      margin: radius,
      angle: c.heading,
      state: c.kind === 'guetteur' ? 0 : 1,
    });
  }
  for (const l of s.lures) {
    fn({
      kind: 'lure',
      surface: 'capsule',
      ref: l.id,
      x: l.pos.x,
      y: l.pos.y,
      margin: 0.2,
      angle: 0,
      state: l.landed ? 1 : 0,
    });
  }
}
