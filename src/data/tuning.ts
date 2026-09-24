/**
 * ÉCHO — toutes les valeurs d'équilibrage, et seulement ici.
 *
 * Unités : distances en cases (1 case = 1 caractère de la grille), durées en secondes,
 * vitesses en cases/s, accélérations en cases/s².
 * « loudness » : multiplicateur du rayon d'écoute des créatures (1 = une impulsion courte).
 *
 * TUNING : valeurs globales. LEVELS : valeurs propres à chaque niveau (par, balise, surcharges).
 * Au chargement d'un niveau, la simulation reçoit TUNING fusionné avec LEVELS[slug].overrides.
 * En dev, enregistrer ce fichier relance le niveau en cours avec les nouvelles valeurs.
 *
 * Valeurs de départ, à calibrer en jouant (docs/GDD.md donne l'intention de chaque mécanique).
 */
export const TUNING = {
  probe: {
    /** Rayon de collision de la sonde. */
    radius: 0.3,
    /** Accélération de nage. */
    thrust: 14,
    /** Frottement de l'eau (1/s). Vitesse de croisière ≈ thrust / drag. */
    drag: 3,
    /** Rebond sur paroi : 0 = glisse sans rebondir, 1 = rebond parfait. */
    wallRestitution: 0.1,
    /** Vitesse d'impact (composante normale) en dessous de laquelle un contact est silencieux. */
    bumpMinSpeed: 1.5,
    /** Bruit d'un choc à pleine vitesse (loudness). */
    bumpLoudnessMax: 0.4,
    /** Délai minimal entre deux chocs sonores (évite la rafale en frottant un coin). */
    bumpCooldown: 0.25,
    /** Rayon de l'arc de paroi révélé au point de choc (0 = désactivé). */
    bumpRevealRadius: 1.2,
    /** Rémanence de cet arc. */
    bumpRevealAfterglow: 1,
    /** Points de coque. */
    hullMax: 3,
    /** Invulnérabilité après un dégât. */
    invulnerability: 1.5,
    /** Vitesse de recul après un dégât. */
    knockback: 4,
    /** Durée de l'implosion et du fondu avant la reprise. */
    destroyedDuration: 1.2,
  },

  pulse: {
    /** Durée de maintien d'Espace qui déclenche automatiquement l'impulsion longue. */
    longChargeTime: 0.9,
    /** Nombre de rayons lancés à l'émission. */
    rayCount: 720,
    /** Épaisseur du front d'onde qui révèle les objets au passage. */
    revealBand: 0.6,
    /** Durée de l'éclat blanc au moment où le front touche une surface. */
    flashTime: 0.08,
    short: {
      radius: 7,
      /** Vitesse du front d'onde (et du retour de l'écho). */
      speed: 16,
      /** Durée d'effacement de ce qui a été révélé. */
      afterglow: 2.5,
      loudness: 1,
      cooldown: 0.6,
      energyCost: 20,
    },
    long: {
      radius: 16,
      speed: 20,
      afterglow: 4.5,
      loudness: 2,
      cooldown: 2.5,
      energyCost: 45,
    },
  },

  accessibility: {
    /** Multiplicateur de rémanence de l'option « Rémanence allongée ». */
    longAfterglowMultiplier: 1.75,
  },

  echo: {
    /** Directions renvoyant un écho de paroi (la surface la plus proche de chaque secteur). */
    sectors: 16,
    /** Échos d'objets (perles, oursins, créatures, leviers…) par impulsion, les plus proches d'abord. */
    maxEntityEchoes: 6,
  },

  beacon: {
    /** Rayon du signal vert affiché autour de la balise à chaque émission. */
    pingRadius: 1.2,
    /** Repère en bord d'écran quand la balise émet hors champ. */
    offscreenIndicator: true,
  },

  exit: { radius: 0.6 },
  pearl: { radius: 0.4 },
  hazard: { radius: 0.4, damage: 1 },

  current: {
    /** Accélération imposée par une case de courant. Si ≥ probe.thrust, on ne peut pas le remonter. */
    strength: 6,
  },

  mud: {
    /** Multiplicateur du frottement dans la vase. */
    dragMultiplier: 4,
    /** Coût de propagation du son à travers une case de vase (1 = eau libre). */
    soundCostMultiplier: 3,
  },

  lure: {
    pickupRadius: 0.5,
    maxCarried: 3,
    throwSpeed: 7,
    drag: 2.5,
    restitution: 0.4,
    /** Vitesse sous laquelle le leurre s'immobilise et commence à émettre. */
    stopSpeed: 0.3,
    pings: 3,
    pingInterval: 1,
    loudness: 1.6,
  },

  lever: {
    radius: 0.6,
    doorOpenTime: 0.8,
    /** Bruit de la porte qui s'ouvre. */
    doorLoudness: 1.2,
  },

  checkpoint: { radius: 0.7 },

  energy: {
    /** Activée par niveau via LEVELS[slug].overrides (niveaux 9 et 10). */
    enabled: false,
    max: 100,
    regen: 4,
  },

  guetteur: {
    radius: 0.45,
    wanderSpeed: 1.2,
    huntSpeed: 3.6,
    /** Entend un bruit si distance de chemin ≤ hearingRadius × loudness. */
    hearingRadius: 9,
    /** Pause entre l'écoute et la charge (le grognement d'alerte). */
    alertDelay: 0.4,
    searchDuration: 4,
    searchRadius: 3,
    /** Rayon d'errance autour du point d'apparition. */
    wanderRadius: 6,
    wanderPauseMin: 1,
    wanderPauseMax: 2.5,
    /** Durée pendant laquelle il s'éloigne après avoir touché la sonde. */
    retreatDuration: 2.5,
    damage: 1,
    /** Cliquetis de nage, audibles de près : indice sonore de présence. */
    clickInterval: 1.4,
    clickRange: 6,
  },

  leviathan: {
    radius: 1.2,
    /** Délai avant son réveil (ou première impulsion, si plus tôt). */
    wakeDelay: 3,
    baseSpeed: 1,
    speedGainPerMinute: 0.3,
    /** Élan ajouté par chaque impulsion entendue, qui décroît sur surgeDecay secondes. */
    surgeSpeed: 2,
    surgeDecay: 2,
    /** Fraction de l'élan donnée par un choc contre une paroi. */
    bumpSurgeFactor: 0.3,
    /** Distance de chemin minimale entre lui et la sonde à la reprise au point de contrôle. */
    respawnDistance: 14,
    repathInterval: 0.5,
  },

  camera: {
    /** Hauteur de la vue, en cases. */
    visibleTilesY: 14,
    followStiffness: 8,
  },

  shake: {
    damage: 0.5,
    longPulse: 0.15,
    /** Décalage maximal, en cases. */
    maxOffset: 0.35,
  },
};

export type Tuning = typeof TUNING;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface LevelTuning {
  /** Nombre d'impulsions maximal pour la troisième étoile. */
  par: number;
  /** Intervalle entre deux signaux de la balise de sortie. */
  beaconInterval: number;
  /** Surcharges de TUNING propres au niveau. */
  overrides?: DeepPartial<Tuning>;
}

/**
 * Valeurs par niveau, indexées par slug (LevelSource.id).
 * Le validateur vérifie que chaque niveau du catalogue a son entrée, et inversement.
 * Les « par » sont provisoires : à fixer après quelques parties.
 */
export const LEVELS: Record<string, LevelTuning> = {
  'premier-echo': { par: 10, beaconInterval: 2 },
  // Valeurs prévues par le GDD § 7.2, à activer (décommenter) avec leur niveau : une entrée
  // sans niveau dans le catalogue est une erreur E06.
  meandres: { par: 9, beaconInterval: 3 },
  oursins: { par: 11, beaconInterval: 3.5 },
  courants: { par: 11, beaconInterval: 4 },
  'le-guetteur': { par: 12, beaconInterval: 4, overrides: { guetteur: { hearingRadius: 8, huntSpeed: 3.2 } } },
  // leurres: { par: 11, beaconInterval: 4.5 },
  // vannes: { par: 16, beaconInterval: 5 },
  // vase: { par: 14, beaconInterval: 5.5, overrides: { guetteur: { huntSpeed: 3.8 } } },
  // 'batterie-faible': { par: 15, beaconInterval: 6, overrides: { energy: { enabled: true }, guetteur: { hearingRadius: 10, huntSpeed: 3.9 } } },
  // leviathan: { par: 12, beaconInterval: 3, overrides: { energy: { enabled: true, regen: 6 } } },
};
