import type { World } from './world';

/** Les trois étoiles d'un niveau (GDD § 3.10). */
export interface StarSet {
  complete: boolean;
  pearls: boolean;
  par: boolean;
}

/** Résultat d'une tentative, à la balise ou à l'abandon. */
export interface RunResult {
  slug: string;
  time: number;
  pulses: number;
  par: number;
  pearls: number;
  pearlsTotal: number;
  deaths: number;
  stars: StarSet;
}

export function runResult(world: World): RunResult {
  const complete = world.state.status === 'complete';
  const pearlsTotal = world.state.pearls.length;
  const pearls = world.state.pearls.filter((p) => p.taken).length;
  const { pulses, time, deaths } = world.stats;
  const par = world.levelTuning.par;
  return {
    slug: world.level.id,
    time,
    pulses,
    par,
    pearls,
    pearlsTotal,
    deaths,
    stars: {
      complete,
      pearls: complete && pearls === pearlsTotal,
      par: complete && pulses <= par,
    },
  };
}

export function countStars(stars: StarSet): number {
  return (stars.complete ? 1 : 0) + (stars.pearls ? 1 : 0) + (stars.par ? 1 : 0);
}

export function noStars(): StarSet {
  return { complete: false, pearls: false, par: false };
}
