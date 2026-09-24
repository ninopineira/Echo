/**
 * Palette unique d'ÉCHO (docs/GDD.md § Direction artistique).
 * Le rendu canvas l'importe directement ; l'UI DOM la reçoit en variables CSS (--c-<clé>).
 * Les six premières couleurs sont imposées par le brief : ne pas les modifier sans l'accord de l'auteur.
 */
export const PALETTE = {
  background: '#04070C',
  sonar: '#5CE1E6',
  hazard: '#FF5A4E',
  pearl: '#F4EBD0',
  beacon: '#7CFFB2',
  creature: '#8A1F2B',

  // Dérivées, ajustables.
  /** Sonde : blanc bleuté, toujours visible. */
  probe: '#E6FCFF',
  /** Liseré des créatures, pour qu'elles se détachent du fond. */
  creatureRim: '#C23A4A',
  /** Texte courant de l'UI. */
  text: '#CDE8EC',
  /** Texte secondaire, éléments verrouillés. */
  textMuted: '#5F7C86',
  /** Surfaces de panneaux de menu (jamais crème ni blanc cassé). */
  panel: '#08111A',
  /** Filets et contours discrets. */
  line: '#16303B',
} as const;

export type PaletteKey = keyof typeof PALETTE;
