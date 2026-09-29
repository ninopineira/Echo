import { describe, expect, it } from 'vitest';
import type { RunResult } from '../sim/scoring';
import {
  defaultSave,
  isUnlocked,
  loadSave,
  recordRun,
  SAVE_KEY,
  writeSave,
  type KeyValueStore,
} from './save';

function memoryStore(
  initial: Record<string, string> = {},
): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

function result(partial: Partial<RunResult> = {}): RunResult {
  return {
    slug: 'premier-echo',
    time: 60,
    pulses: 8,
    par: 10,
    pearls: 2,
    pearlsTotal: 2,
    deaths: 0,
    stars: { complete: true, pearls: true, par: true },
    ...partial,
  };
}

const catalog = [{ id: 'premier-echo' }, { id: 'meandres' }, { id: 'oursins' }];

describe('sauvegarde', () => {
  it('renvoie les valeurs par défaut sans sauvegarde, avec JSON invalide ou version inconnue', () => {
    expect(loadSave(memoryStore())).toEqual(defaultSave());
    expect(loadSave(memoryStore({ [SAVE_KEY]: '{pas du json' }))).toEqual(defaultSave());
    expect(loadSave(memoryStore({ [SAVE_KEY]: '{"version":99}' }))).toEqual(defaultSave());
  });

  it('survit à un stockage qui lève', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('refusé');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadSave(broken)).toEqual(defaultSave());
    expect(writeSave(broken, defaultSave())).toBe(false);
  });

  it('fait l’aller-retour et répare les champs invalides', () => {
    const store = memoryStore();
    const { save } = recordRun(defaultSave(), result());
    save.options.volume = 0.3;
    expect(writeSave(store, save)).toBe(true);
    expect(loadSave(store)).toEqual(save);
    store.data[SAVE_KEY] = JSON.stringify({
      version: 1,
      levels: { x: { completed: 'oui', stars: null, bestTime: -3 } },
      options: { volume: 7, longAfterglow: true },
    });
    const repaired = loadSave(store);
    expect(repaired.levels.x).toEqual({
      completed: false,
      stars: { complete: false, pearls: false, par: false },
      bestTime: null,
      bestPulses: null,
      bestPearls: null,
    });
    expect(repaired.options).toEqual({ volume: 0.8, longAfterglow: true, screenShake: true });
  });

  it('cumule les étoiles par critère et garde les records', () => {
    let save = defaultSave();
    save = recordRun(
      save,
      result({ pulses: 14, stars: { complete: true, pearls: true, par: false } }),
    ).save;
    const second = recordRun(
      save,
      result({
        time: 40,
        pulses: 9,
        pearls: 1,
        stars: { complete: true, pearls: false, par: true },
      }),
    );
    expect(second.save.levels['premier-echo']!.stars).toEqual({
      complete: true,
      pearls: true,
      par: true,
    });
    expect(second.newRecords).toEqual({ time: true, pulses: true });
    expect(second.save.levels['premier-echo']!.bestPulses).toBe(9);
    expect(second.save.levels['premier-echo']!.bestPearls).toBe(2);
    const third = recordRun(second.save, result({ time: 90, pulses: 20 }));
    expect(third.newRecords).toEqual({ time: false, pulses: false });
    expect(third.save.levels['premier-echo']!.bestTime).toBe(40);
  });

  it('ignore une tentative non terminée', () => {
    const save = defaultSave();
    const r = recordRun(save, result({ stars: { complete: false, pearls: false, par: false } }));
    expect(r.save).toBe(save);
  });

  it('débloque les niveaux un par un', () => {
    let save = defaultSave();
    expect(isUnlocked(save, catalog, 0)).toBe(true);
    expect(isUnlocked(save, catalog, 1)).toBe(false);
    save = recordRun(save, result()).save;
    expect(isUnlocked(save, catalog, 1)).toBe(true);
    expect(isUnlocked(save, catalog, 2)).toBe(false);
  });
});
