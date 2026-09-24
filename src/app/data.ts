import type { LevelSource } from '../data/levels/define';
import { LEVEL_CATALOG } from '../data/levels/index';
import { LEVELS, TUNING, type LevelTuning, type Tuning } from '../data/tuning';

/** Données de jeu courantes ; remplacées à chaud (HMR) en dev quand tuning.ts ou un niveau change. */
export const gameData: {
  catalog: readonly LevelSource[];
  levels: Readonly<Record<string, LevelTuning>>;
  tuning: Tuning;
} = { catalog: LEVEL_CATALOG, levels: LEVELS, tuning: TUNING };

const listeners = new Set<() => void>();

export function onDataChanged(fn: () => void): void {
  listeners.add(fn);
}

if (import.meta.hot) {
  import.meta.hot.accept(['../data/tuning', '../data/levels/index'], (mods) => {
    const tuningMod = mods[0] as typeof import('../data/tuning') | undefined;
    const levelsMod = mods[1] as typeof import('../data/levels/index') | undefined;
    if (tuningMod) {
      gameData.tuning = tuningMod.TUNING;
      gameData.levels = tuningMod.LEVELS;
    }
    if (levelsMod) gameData.catalog = levelsMod.LEVEL_CATALOG;
    for (const fn of listeners) fn();
  });
}
