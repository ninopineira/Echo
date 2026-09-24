import type { EchoSurface } from '../sim/events';

/**
 * Mixage d'ÉCHO : volumes, portées, filtres, plafonds de voix (ARCHITECTURE § 6, DECISIONS D26).
 * Ce n'est pas de l'équilibrage : rien ici n'influence la simulation.
 *
 * Unités : gains linéaires (1 = 0 dB, 0,5 ≈ −6 dB), fréquences en Hz, durées et constantes de
 * temps en secondes, distances en cases. Valeurs de départ, à régler à l'oreille dans
 * `?soundboard=1` puis en jeu.
 */

/** Familles de voix : chacune a son plafond (VOICE_CAPS), on coupe la plus faible au-delà. */
export type VoiceFamily =
  | 'pulse'
  | 'echo'
  | 'probe'
  | 'pickup'
  | 'beacon'
  | 'creature'
  | 'lure'
  | 'door'
  | 'progress'
  | 'ambience'
  | 'menu';

export const MASTER = {
  /** Volume des options avant le premier réglage (0..1). */
  defaultVolume: 0.8,
  /** Courbe du curseur : gain = volume ^ exposant (2 ≈ perception régulière). */
  volumeExponent: 2,
  /** Constante de temps d'un changement de volume. */
  volumeTau: 0.03,
  /** Limiteur de sortie (DynamicsCompressorNode) : seuil en dB, ratio, attaque et relâchement. */
  limiter: { threshold: -6, knee: 3, ratio: 20, attack: 0.002, release: 0.15 },
} as const;

export const BUS = {
  game: 0.9,
  ambience: 0.6,
  ui: 0.55,
  /** Fondu de pause des bus game et ambience (τ = 0,04 s : ≈ −33 dB à 150 ms). */
  pauseTau: 0.04,
  /** Fondu d'une voix coupée (plafond atteint ou stopGameSounds). */
  cutTau: 0.008,
  /** Fondu des portes du bus game à stopGameSounds. */
  gateFade: 0.03,
} as const;

/** Réverbération : réponse impulsionnelle stéréo générée au déblocage. */
export const REVERB = {
  seconds: 2.5,
  /** Atténuation atteinte à la fin de la réponse (dB). */
  decayDb: 60,
  preDelay: 0.018,
  /** Filtre à un pôle de la réponse : clair au début (proche de 1), sombre à la fin. */
  brightStart: 0.6,
  brightEnd: 0.06,
  /** Niveau du retour de réverbération. */
  return: 0.5,
  /** stopGameSounds : la queue est coupée, puis le retour revient après `duckHold`. */
  duckHold: 0.6,
  duckTau: 0.15,
} as const;

/** Étouffement du bus game dans la vase. */
export const MUD = {
  cutoff: 650,
  /** Coupure hors vase (filtre transparent). */
  openCutoff: 20000,
  /** Gain supplémentaire du bus game dans la vase. */
  gain: 0.8,
  tau: 0.12,
} as const;

/** Avance de planification : un son « immédiat » part à currentTime + lead. */
export const SCHEDULE = {
  lead: 0.01,
  /** Sous ce gain, une voix n'est pas créée. */
  minLevel: 0.0005,
  /** Au-dessus de cette coupure, pas de filtre de brillance sur la voix. */
  bypassCutoff: 16000,
} as const;

/**
 * Portées de spatialisation (voir spatial.ts).
 * panRange : décalage horizontal (cases) qui donne un pan complet.
 * falloff : distance (cases) où le gain tombe à 1/2 ; gain = 1 / (1 + d / falloff).
 * minGain : plancher (audible de partout). maxDistance : silence au-delà.
 */
export const SPATIAL = {
  /** Échos : le pan suit la direction (cos angle × panWidth), la distance agit sur le gain. */
  echo: { panWidth: 0.85, falloff: 3.5 },
  /** Sons au contact de la sonde (choc, dégât, ramassage). */
  near: { panRange: 6, falloff: 4 },
  /** Sons du monde (grognement, porte, leurre, levier). */
  world: { panRange: 9, falloff: 5 },
  /** Balise : audible de partout, mais atténuée. */
  beacon: { panRange: 10, falloff: 9, minGain: 0.2 },
  /** Cliquetis de nage : proximité seulement. */
  click: { panRange: 7, falloff: 2.5, maxDistance: 10 },
  /** Léviathan (réveil, alerte). */
  leviathan: { panRange: 10, falloff: 10, minGain: 0.35 },
} as const;

/**
 * Brillance selon la direction (GDD § 3.3) : haut de l'écran plus clair, bas plus sourd.
 * La coupure passe-bas est interpolée (en échelle logarithmique) entre haut, côté et bas,
 * s'ouvre près de la sonde et s'assombrit avec la distance.
 */
export const BRIGHTNESS = {
  cutoffUp: 11000,
  cutoffSide: 4500,
  cutoffDown: 1300,
  cutoffOpen: 18000,
  /** En deçà, la coupure s'ouvre progressivement (source quasi confondue avec la sonde). */
  nearDistance: 0.8,
  /** La coupure est divisée par (1 + d / darkenDistance). */
  darkenDistance: 14,
  minCutoff: 350,
} as const;

/** Envois vers la réverbération (par voix) : plus un son est loin, plus il est réverbéré. */
export const SEND = {
  echoNear: 0.05,
  echoFar: 0.3,
  /** Distance à laquelle l'envoi atteint sa valeur « far ». */
  farDistance: 16,
  pulseShort: 0.3,
  pulseLong: 0.45,
  denied: 0,
  beaconNear: 0.25,
  beaconFar: 0.6,
  near: 0.12,
  world: 0.25,
  creature: 0.3,
  pickup: 0.3,
  progress: 0.4,
  crackle: 0.9,
} as const;

/** Niveau de chaque son (avant spatialisation). */
export const LEVEL = {
  pulseShort: 0.5,
  pulseLong: 0.6,
  deniedCooldown: 0.35,
  deniedEnergy: 0.4,
  echo: 0.6,
  beacon: 0.4,
  bump: 0.55,
  pearl: 0.35,
  capsule: 0.4,
  damage: 0.6,
  destroyed: 0.7,
  respawn: 0.35,
  creatureClick: 0.35,
  growl: 0.75,
  leviathanGrowl: 0.7,
  leviathanWoke: 0.9,
  attack: 0.65,
  lureThrown: 0.3,
  lureBounce: 0.25,
  lurePing: 0.5,
  lureEmpty: 0.3,
  lever: 0.45,
  doorOpening: 0.6,
  doorOpened: 0.4,
  checkpoint: 0.4,
  levelComplete: 0.45,
  crackle: 0.35,
  uiMove: 0.3,
  uiConfirm: 0.4,
  uiBack: 0.35,
} as const;

/** Réflectivité par surface : multiplie le gain de l'écho (GDD § 3.3 « volume »). */
export const REFLECTIVITY: Record<EchoSurface, number> = {
  rock: 1,
  door: 1,
  hazard: 0.85,
  pearl: 0.75,
  creature: 0.95,
  lever: 0.8,
  capsule: 0.8,
  checkpoint: 0.7,
};

export const ECHO = {
  /** Variation aléatoire de hauteur d'un écho (±4 %), pour éviter l'effet mitraillette. */
  pitchJitter: 0.04,
  /** Les échos d'une impulsion longue sont un peu plus forts et plus graves. */
  longGain: 1.1,
  /**
   * Compensation de foule : des échos arrivant dans la même fenêtre (s) sont atténués de
   * 1 / n^exposant, pour qu'une salle ronde ne sonne pas comme une détonation.
   */
  crowdWindow: 0.02,
  crowdExponent: 0.5,
} as const;

/** Sons continus (bus ambience, sauf la charge qui est sur le bus game). */
export const AMBIENCE = {
  /** Au-delà de idleTaus × τ de silence, une couche est arrêtée et ses nœuds libérés. */
  idleTaus: 8,
  bed: {
    level: 0.4,
    cutoff: 190,
    /** Ondulation lente de la coupure (Hz) et sa fréquence (Hz). */
    cutoffSwing: 70,
    swingRate: 0.07,
    /** Couche « eau » en passe-bande, au-dessus du grondement. */
    waterLevel: 0.12,
    waterFreq: 420,
    waterRate: 0.11,
    tauIn: 1.2,
    tauOut: 0.5,
  },
  crackle: {
    /** Intervalle entre deux salves de craquements lointains. */
    minGap: 5,
    maxGap: 14,
    firstMin: 2,
    firstMax: 6,
    /** Craquements lointains : coupés au-dessus de cette fréquence. */
    cutoff: 2600,
    panSpread: 0.8,
  },
  current: {
    level: 0.35,
    center: 700,
    swing: 260,
    swingRate: 0.23,
    panSwing: 0.35,
    panRate: 0.13,
    /** Part du grondement grave dans le souffle. */
    rumble: 0.35,
    tau: 0.25,
  },
  hunt: {
    level: 0.5,
    /** Battements par seconde avec 1 Guetteur, gain par Guetteur supplémentaire, plafond. */
    baseRate: 1.6,
    ratePerCreature: 0.35,
    maxRate: 2.6,
    tone: 62,
    cutoff: 260,
    /** Souffle rapide (bruit passe-bande) calé sur la pulsation. */
    breath: 0.35,
    breathFreq: 1100,
    tauIn: 0.3,
    tauOut: 0.9,
  },
  leviathan: {
    level: 0.8,
    /** Distance de chemin (cases) sous laquelle le drone devient audible. */
    range: 30,
    /** Courbe de proximité : (1 − d / range) ^ exposant. */
    exponent: 1.6,
    tone: 41,
    cutoffFar: 150,
    cutoffNear: 650,
    /** Battement d'amplitude (Hz), plus rapide quand il approche. */
    beatFar: 0.25,
    beatNear: 0.9,
    beatDepth: 0.35,
    tau: 0.5,
  },
  hull: {
    level: 0.3,
    /** Pulsation lente (Hz) de l'alarme de coque critique. */
    rate: 0.75,
    tone: 123,
    cutoff: 700,
    tau: 0.3,
  },
  charge: {
    level: 0.28,
    /** Hauteur au début de la charge, puis montée de `octaves` jusqu'à la charge complète. */
    pitchStart: 160,
    octaves: 1.5,
    /** Le bourdonnement apparaît entre ces deux fractions de charge (un appui bref reste muet). */
    fadeStart: 0.04,
    fadeEnd: 0.3,
    /** Vibrato qui s'élargit avec la charge (Hz, puis profondeur en cents à charge complète). */
    vibratoRate: 6,
    vibratoCents: 25,
    tauUp: 0.03,
    tauDown: 0.035,
  },
} as const;

/** Plafond de voix simultanées par famille. */
export const VOICE_CAPS: Record<VoiceFamily, number> = {
  pulse: 3,
  echo: 30,
  probe: 6,
  pickup: 4,
  beacon: 3,
  creature: 8,
  lure: 6,
  door: 4,
  progress: 2,
  ambience: 3,
  menu: 4,
};
