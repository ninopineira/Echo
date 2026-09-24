import { noStars, type RunResult, type StarSet } from '../sim/scoring';

/** Sauvegarde locale versionnée (ARCHITECTURE § 9). Module pur : le stockage est injecté. */
export const SAVE_KEY = 'echo.save.v1';

export interface Options {
  /** Volume maître 0..1. */
  volume: number;
  longAfterglow: boolean;
  screenShake: boolean;
}

export interface LevelRecord {
  completed: boolean;
  stars: StarSet;
  bestTime: number | null;
  bestPulses: number | null;
  /** Meilleur nombre de perles ramassées lors d'une tentative terminée. */
  bestPearls: number | null;
}

export interface SaveData {
  version: 1;
  levels: Record<string, LevelRecord>;
  options: Options;
}

/** Sous-ensemble de Storage : `window.localStorage` convient tel quel. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultOptions(): Options {
  return { volume: 0.8, longAfterglow: false, screenShake: true };
}

export function defaultSave(): SaveData {
  return { version: 1, levels: {}, options: defaultOptions() };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readStars(v: unknown): StarSet {
  if (!isRecord(v)) return noStars();
  return { complete: v.complete === true, pearls: v.pearls === true, par: v.par === true };
}

function readNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Lit une sauvegarde v1 champ par champ ; tout champ invalide reprend sa valeur par défaut. */
function fromV1(raw: Record<string, unknown>): SaveData {
  const save = defaultSave();
  if (isRecord(raw.levels)) {
    for (const [slug, rec] of Object.entries(raw.levels)) {
      if (!isRecord(rec)) continue;
      save.levels[slug] = {
        completed: rec.completed === true,
        stars: readStars(rec.stars),
        bestTime: readNumber(rec.bestTime),
        bestPulses: readNumber(rec.bestPulses),
        bestPearls: readNumber(rec.bestPearls),
      };
    }
  }
  if (isRecord(raw.options)) {
    const o = raw.options;
    const d = save.options;
    save.options = {
      volume: typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1 ? o.volume : d.volume,
      longAfterglow: typeof o.longAfterglow === 'boolean' ? o.longAfterglow : d.longAfterglow,
      screenShake: typeof o.screenShake === 'boolean' ? o.screenShake : d.screenShake,
    };
  }
  return save;
}

/** Convertit n'importe quelle donnée brute en SaveData ; version inconnue → null. */
export function migrate(raw: unknown): SaveData | null {
  if (!isRecord(raw)) return null;
  if (raw.version === 1) return fromV1(raw);
  return null;
}

/** Chargement tolérant : JSON invalide, version inconnue ou stockage qui lève → valeurs par défaut. */
export function loadSave(store: KeyValueStore): SaveData {
  try {
    const text = store.getItem(SAVE_KEY);
    if (text === null) return defaultSave();
    return migrate(JSON.parse(text)) ?? defaultSave();
  } catch {
    return defaultSave();
  }
}

/** Écrit la sauvegarde ; renvoie faux si le stockage a refusé (quota, navigation privée). */
export function writeSave(store: KeyValueStore, save: SaveData): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

/** Intègre une tentative terminée : étoiles cumulées par critère (OU), records. */
export function recordRun(
  save: SaveData,
  result: RunResult,
): { save: SaveData; newRecords: { time: boolean; pulses: boolean } } {
  const prev = save.levels[result.slug];
  const newRecords = { time: false, pulses: false };
  if (!result.stars.complete) return { save, newRecords };
  const stars = prev?.stars ?? noStars();
  const bestTime = prev?.bestTime ?? null;
  const bestPulses = prev?.bestPulses ?? null;
  const bestPearls = prev?.bestPearls ?? null;
  newRecords.time = bestTime === null || result.time < bestTime;
  newRecords.pulses = bestPulses === null || result.pulses < bestPulses;
  const record: LevelRecord = {
    completed: true,
    stars: {
      complete: true,
      pearls: stars.pearls || result.stars.pearls,
      par: stars.par || result.stars.par,
    },
    bestTime: newRecords.time ? result.time : bestTime,
    bestPulses: newRecords.pulses ? result.pulses : bestPulses,
    bestPearls: Math.max(bestPearls ?? 0, result.pearls),
  };
  return { save: { ...save, levels: { ...save.levels, [result.slug]: record } }, newRecords };
}

/** Le premier niveau est toujours ouvert ; le niveau N l'est si le N−1 est terminé. */
export function isUnlocked(
  save: SaveData,
  catalog: readonly { id: string }[],
  index: number,
): boolean {
  if (index <= 0) return true;
  const prev = catalog[index - 1];
  return prev !== undefined && save.levels[prev.id]?.completed === true;
}

export function starsOf(save: SaveData, slug: string): StarSet {
  return save.levels[slug]?.stars ?? noStars();
}
