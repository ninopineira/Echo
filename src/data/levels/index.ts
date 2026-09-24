import type { LevelSource } from './define';

/**
 * Catalogue ordonné des niveaux : l'ordre ici est l'ordre de jeu et de déblocage.
 * Imports statiques uniquement (pas d'import.meta.glob) : le validateur s'exécute sous Node.
 * Exemple d'ajout :
 *   import premierEcho from './01-premier-echo';
 *   export const LEVEL_CATALOG = [premierEcho, …];
 */
export const LEVEL_CATALOG: readonly LevelSource[] = [];
