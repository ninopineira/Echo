import type { Options } from '../save/save';
import type { RunResult, StarSet } from '../sim/scoring';

/** Contrat app ⇄ UI (ARCHITECTURE § 8). L'UI ne connaît pas l'app : elle affiche et rappelle. */

export interface LevelCard {
  slug: string;
  /** Numéro affiché (1-based, sans zéro initial). */
  number: number;
  name: string;
  locked: boolean;
  stars: StarSet;
}

export type ScreenModel =
  | { kind: 'title'; phase: 'pressKey' | 'menu' }
  | {
      kind: 'levelSelect';
      levels: LevelCard[];
      stars: number;
      maxStars: number;
      /** Niveau à mettre en focus à l'ouverture (dernier joué ou premier ouvert). */
      focusSlug: string | null;
    }
  | { kind: 'playing' }
  | { kind: 'pause'; levelName: string; canRestoreCheckpoint: boolean }
  | {
      kind: 'levelEnd';
      levelName: string;
      levelNumber: number;
      result: RunResult;
      newRecords: { time: boolean; pulses: boolean };
      /** Un niveau suivant existe (sinon, « Continuer » mène à la victoire si `isLast`). */
      hasNext: boolean;
      isLast: boolean;
    }
  | {
      kind: 'victory';
      stars: number;
      maxStars: number;
      pearls: number;
      maxPearls: number;
      /** Somme des meilleurs temps (s). */
      time: number;
    }
  | { kind: 'options'; options: Options; returnTo: 'title' | 'pause' };

export type UiSound = 'move' | 'confirm' | 'back';

export interface UiCallbacks {
  /** Écran titre, phase « appuyez sur une touche » : débloque l'audio. */
  onAnyKey: () => void;
  onPlay: () => void;
  onOpenOptions: () => void;
  /** Retour : options → écran précédent, sélection → titre. */
  onBack: () => void;
  onSelectLevel: (slug: string) => void;
  onResume: () => void;
  onRestoreCheckpoint: () => void;
  onRestartLevel: () => void;
  onQuitToSelect: () => void;
  /** Fin de niveau : niveau suivant, ou victoire si c'était le dernier. */
  onNextLevel: () => void;
  onReplay: () => void;
  onOptionsChange: (options: Options) => void;
  onUiSound: (kind: UiSound) => void;
}

export interface Ui {
  show(model: ScreenModel): void;
}
