import type { LevelSource } from './define';
import premierEcho from './01-premier-echo';
import meandres from './02-meandres';
import oursins from './03-oursins';
import courants from './04-courants';
import leGuetteur from './05-le-guetteur';
import leurres from './06-leurres';
import vannes from './07-vannes';
import vase from './08-vase';
import batterieFaible from './09-batterie-faible';
import leviathan from './10-leviathan';

/**
 * Catalogue ordonné des niveaux : l'ordre ici est l'ordre de jeu et de déblocage.
 * Imports statiques uniquement (pas d'import.meta.glob) : le validateur s'exécute sous Node.
 */
export const LEVEL_CATALOG: readonly LevelSource[] = [
  premierEcho,
  meandres,
  oursins,
  courants,
  leGuetteur,
  leurres,
  vannes,
  vase,
  batterieFaible,
  leviathan,
];
