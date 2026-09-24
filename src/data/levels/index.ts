import type { LevelSource } from './define';
import premierEcho from './01-premier-echo';

/**
 * Catalogue ordonné des niveaux : l'ordre ici est l'ordre de jeu et de déblocage.
 * Imports statiques uniquement (pas d'import.meta.glob) : le validateur s'exécute sous Node.
 */
export const LEVEL_CATALOG: readonly LevelSource[] = [premierEcho];
