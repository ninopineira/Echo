import type { Vec2 } from './math/vec';
import { cellAt, type World } from './world';

/** Ce que le HUD affiche (ARCHITECTURE § 4.7). */
export interface HudModel {
  hull: number;
  hullMax: number;
  pulses: number;
  par: number;
  pearls: number;
  pearlsTotal: number;
  /** Leurres en réserve, null si le niveau n'a pas de capsule. */
  lures: number | null;
  energy: { value: number; max: number } | null;
  /** Recharge restante, 1 = vient d'émettre, 0 = prête. */
  cooldown01: number;
  /** Progression de la charge vers l'impulsion longue, null sans charge. */
  charge01: number | null;
}

/** État continu dérivé, pour les sons d'ambiance (ARCHITECTURE § 4.7). */
export interface AmbientModel {
  listener: Vec2;
  /** 1 dans une case de courant, 0 sinon. */
  currentStrength01: number;
  inMud: boolean;
  /** Distance de chemin du Léviathan éveillé à la sonde, null sinon. */
  leviathanPathDistance: number | null;
  /** Position du Léviathan éveillé (pour spatialiser son drone), null sinon. */
  leviathanPos: Vec2 | null;
  /** Guetteurs en alerte ou en chasse. */
  huntingCreatures: number;
  hullCritical: boolean;
  /** Progression de la charge (0..1), null sans charge. */
  charge01: number | null;
}

export function hudModel(world: World): HudModel {
  const s = world.state;
  const p = s.probe;
  const t = world.tuning;
  return {
    hull: p.hull,
    hullMax: t.probe.hullMax,
    pulses: world.stats.pulses,
    par: world.levelTuning.par,
    pearls: s.pearls.filter((x) => x.taken).length,
    pearlsTotal: s.pearls.length,
    lures: s.capsules.length > 0 ? p.lures : null,
    energy: t.energy.enabled ? { value: p.energy, max: t.energy.max } : null,
    cooldown01: p.cooldown > 0 ? Math.min(1, p.cooldown / Math.max(0.001, p.cooldownMax)) : 0,
    charge01: p.charge >= 0 ? Math.min(1, p.charge / t.pulse.longChargeTime) : null,
  };
}

export function ambientModel(world: World): AmbientModel {
  const s = world.state;
  const p = s.probe;
  const cell = cellAt(world.level, p.pos.x, p.pos.y);
  let leviathan: number | null = null;
  let leviathanPos: Vec2 | null = null;
  let hunting = 0;
  for (const c of s.creatures) {
    if (c.kind === 'leviathan') {
      if (c.awake) {
        leviathan = c.pathDistance;
        leviathanPos = { x: c.pos.x, y: c.pos.y };
      }
    } else if (c.mode === 'alert' || c.mode === 'hunt') {
      hunting++;
    }
  }
  return {
    listener: { x: p.pos.x, y: p.pos.y },
    currentStrength01: world.level.current[cell]! >= 0 ? 1 : 0,
    inMud: world.level.mud[cell] === 1,
    leviathanPathDistance: leviathan,
    leviathanPos,
    huntingCreatures: hunting,
    hullCritical: s.status === 'playing' && p.hull === 1 && world.tuning.probe.hullMax > 1,
    charge01: p.charge >= 0 ? Math.min(1, p.charge / world.tuning.pulse.longChargeTime) : null,
  };
}
