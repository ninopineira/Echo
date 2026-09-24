/**
 * Contrat du format de niveau. Spécification complète : docs/LEVEL_FORMAT.md.
 * Un niveau = un module `NN-slug.ts` qui exporte par défaut `defineLevel({...})`.
 * Les nombres (par, balise, surcharges) sont dans src/data/tuning.ts, pas ici.
 */
export interface LevelSource {
  /** Slug stable : clé de sauvegarde et de LEVELS (tuning.ts). Ne plus le changer une fois publié. */
  id: string;
  /** Nom affiché. */
  name: string;
  /** Consigne affichée au début du niveau (une phrase), ou chaîne vide. */
  hint: string;
  /** Grille ASCII : une ligne par rangée, un caractère par case (voir LEGEND). */
  grid: string;
}

export function defineLevel(source: LevelSource): LevelSource {
  return source;
}

/** Caractères à sens fixe. */
export const LEGEND = {
  '#': 'rock',
  '.': 'water',
  S: 'start',
  X: 'exit',
  o: 'pearl',
  '*': 'hazard',
  '~': 'mud',
  '^': 'currentUp',
  '>': 'currentRight',
  v: 'currentDown',
  '<': 'currentLeft',
  '+': 'lure',
  P: 'checkpoint',
  G: 'guetteur',
  L: 'leviathan',
} as const;

export type LegendChar = keyof typeof LEGEND;
export type CellKind = (typeof LEGEND)[LegendChar];

/**
 * Leviers et portes : un levier `a`–`f` ouvre toutes les cases de porte de la même lettre
 * en majuscule `A`–`F`. Une seule case de levier par lettre.
 */
export const LEVER_CHARS = 'abcdef';
export const DOOR_CHARS = 'ABCDEF';
