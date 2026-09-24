import { NBSP } from './format';

/**
 * Tous les textes de l'interface (GDD § 4) : français, phrases courtes, casse normale.
 * Les nombres sont mis en forme par format.ts ; ici, seulement les mots.
 */
export const STRINGS = {
  title: {
    logo: 'ÉCHO',
    tagline: 'Voir, c’est être entendu.',
    pressKey: 'Appuyez sur une touche',
    play: 'Jouer',
    options: 'Options',
  },
  levelSelect: {
    heading: 'Sélection des niveaux',
    stars: 'Étoiles',
    back: 'Retour',
    locked: 'verrouillé',
  },
  pause: {
    heading: 'Pause',
    resume: 'Reprendre',
    restoreCheckpoint: 'Revenir au point de contrôle',
    restartLevel: 'Recommencer le niveau',
    options: 'Options',
    quitToSelect: 'Quitter vers la sélection',
  },
  levelEnd: {
    heading: 'Balise atteinte',
    time: 'Temps',
    pulses: 'Impulsions',
    pearls: 'Perles',
    deaths: 'Pertes de sonde',
    newRecord: 'Nouveau record',
    overPar: 'au-delà du par',
    starComplete: 'Balise atteinte',
    starPearls: 'Toutes les perles',
    starPar: 'Par respecté',
    starEarned: 'obtenue',
    starMissed: 'manquée',
    next: 'Niveau suivant',
    continue: 'Continuer',
    replay: 'Rejouer',
    select: 'Sélection',
  },
  victory: {
    heading: 'Fin de la plongée',
    text: 'Le dernier écho s’éteint. La sonde remonte vers la surface.',
    stars: 'Étoiles',
    pearls: 'Perles',
    time: 'Temps total',
    back: 'Retour à la sélection',
  },
  options: {
    heading: 'Options',
    volume: 'Volume',
    longAfterglow: 'Rémanence allongée',
    longAfterglowHint: 'Les parois révélées restent visibles plus longtemps.',
    screenShake: 'Tremblement de l’écran',
    yes: 'Oui',
    no: 'Non',
    back: 'Retour',
  },
} as const;

/** « Niveau 3 : Oursins » (numéro simple, espace insécable avant les deux-points). */
export function levelTitle(number: number, name: string): string {
  return `Niveau ${number}${NBSP}: ${name}`;
}

/** « 2 étoiles sur 3 » ; singulier pour 0 et 1, comme en français. */
export function starsOutOf(count: number, max: number): string {
  return `${count} ${count > 1 ? 'étoiles' : 'étoile'} sur ${max}`;
}

/** Libellé lu par les lecteurs d'écran pour une case de la sélection. */
export function levelCardLabel(
  number: number,
  name: string,
  locked: boolean,
  stars: number,
  maxStars: number,
): string {
  const state = locked ? STRINGS.levelSelect.locked : starsOutOf(stars, maxStars);
  return `Niveau ${number}, ${name}, ${state}`;
}
