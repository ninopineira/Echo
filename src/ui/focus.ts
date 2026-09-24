/**
 * Navigation au clavier et à la souris dans les menus (ARCHITECTURE § 8).
 * Flèches ou ZQSD/WASD (par position physique, `KeyboardEvent.code`), Entrée ou Espace pour
 * valider, Échap pour revenir, Tab qui reste dans l'écran. Le survol déplace le focus : clavier et
 * souris partagent une seule sélection, toujours visible.
 * La partie pure (touches → actions, déplacements dans une liste ou une grille) est testée en node.
 */

import { unreachable } from './dom';

export type NavDir = 'up' | 'down' | 'left' | 'right';

export type NavAction =
  | { kind: 'move'; dir: NavDir }
  | { kind: 'cycle'; step: -1 | 1 }
  | { kind: 'activate' }
  | { kind: 'back' };

/** Sous-ensemble de KeyboardEvent utile ici (testable sans DOM). */
export interface KeyLike {
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

const MOVE_CODES: Readonly<Record<string, NavDir>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

/** Touche → action de menu ; null si la touche ne concerne pas les menus (ou avec Ctrl/Alt/Méta). */
export function keyAction(e: KeyLike): NavAction | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  const dir = MOVE_CODES[e.code];
  if (dir !== undefined) return { kind: 'move', dir };
  switch (e.code) {
    case 'Enter':
    case 'NumpadEnter':
    case 'Space':
      return { kind: 'activate' };
    case 'Escape':
      return { kind: 'back' };
    case 'Tab':
      return { kind: 'cycle', step: e.shiftKey ? -1 : 1 };
    default:
      return null;
  }
}

/**
 * Écran « Appuyez sur une touche » : touches qui réveillent le jeu. Échap n'est pas un geste qui
 * autorise l'audio (spécification HTML), et les modificateurs, Tab et F1–F24 servent au navigateur
 * ou aux outils de debug.
 */
export function isWakeKey(e: KeyLike): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (/^F\d{1,2}$/.test(e.code)) return false;
  switch (e.code) {
    case 'Escape':
    case 'Tab':
    case 'ShiftLeft':
    case 'ShiftRight':
    case 'ControlLeft':
    case 'ControlRight':
    case 'AltLeft':
    case 'AltRight':
    case 'MetaLeft':
    case 'MetaRight':
    case 'OSLeft':
    case 'OSRight':
    case 'CapsLock':
    case 'ContextMenu':
      return false;
    default:
      return true;
  }
}

/** Déplacement : index voisin, ou null s'il n'y en a pas dans cette direction. */
export type Navigate = (index: number, dir: NavDir) => number | null;

/** Liste de `count` éléments. `vertical` : haut/bas ; `horizontal` : gauche/droite ; `both`. */
export function listStep(
  index: number,
  count: number,
  dir: NavDir,
  axis: 'vertical' | 'horizontal' | 'both',
  wrap: boolean,
): number | null {
  if (count <= 0) return null;
  const backward = dir === 'up' || dir === 'left';
  const vertical = dir === 'up' || dir === 'down';
  if (axis === 'vertical' && !vertical) return null;
  if (axis === 'horizontal' && vertical) return null;
  const next = index + (backward ? -1 : 1);
  if (next >= 0 && next < count) return next;
  return wrap ? (next + count) % count : null;
}

/**
 * Grille de `count` cases sur `columns` colonnes. Gauche/droite suivent l'ordre des cases (on
 * passe d'une rangée à l'autre), haut/bas changent de rangée. Vers une rangée incomplète, on
 * s'arrête sur sa dernière case. Aucun bouclage : null au bord.
 */
export function gridStep(
  index: number,
  count: number,
  columns: number,
  dir: NavDir,
): number | null {
  if (count <= 0 || columns <= 0 || index < 0 || index >= count) return null;
  switch (dir) {
    case 'left':
      return index > 0 ? index - 1 : null;
    case 'right':
      return index < count - 1 ? index + 1 : null;
    case 'up':
      return index - columns >= 0 ? index - columns : null;
    case 'down': {
      const row = Math.floor(index / columns);
      const lastRow = Math.floor((count - 1) / columns);
      return row < lastRow ? Math.min(index + columns, count - 1) : null;
    }
  }
}

/** Index suivant ou précédent avec bouclage (Tab, Maj+Tab). */
export function cycleIndex(index: number, count: number, step: -1 | 1): number {
  if (count <= 0) return 0;
  return (((index + step) % count) + count) % count;
}

export function listNavigate(
  count: number,
  axis: 'vertical' | 'horizontal' | 'both',
  wrap = true,
): Navigate {
  return (index, dir) => listStep(index, count, dir, axis, wrap);
}

// ---------------------------------------------------------------------------------------------
// Partie DOM

export interface FocusItem {
  el: HTMLElement;
  /** Entrée, Espace ou clic. Absent : non activable (niveau verrouillé, curseur). */
  activate?: (e?: Event) => void;
  /** Gauche/droite sur un réglage (volume, oui/non) au lieu de déplacer le focus. */
  adjust?: (step: -1 | 1) => void;
}

export interface FocusNavOptions {
  items: readonly FocusItem[];
  navigate: Navigate;
  initial: number;
  /** Son de déplacement du focus. */
  onMove: () => void;
  /** Prévenu à chaque changement d'index (clavier, survol ou clic). */
  onChange?: (index: number) => void;
}

/** Sélection courante d'un écran : un seul élément en focus, piloté au clavier et à la souris. */
export class FocusNav {
  private current: number;

  constructor(private readonly opts: FocusNavOptions) {
    const n = opts.items.length;
    this.current = n > 0 ? Math.min(Math.max(0, opts.initial), n - 1) : 0;
    opts.items.forEach((item, index) => {
      item.el.addEventListener('pointermove', () => {
        if (index !== this.current) this.setFocus(index, true);
        else if (document.activeElement !== item.el) this.focusCurrent();
      });
      item.el.addEventListener('focus', () => {
        if (index !== this.current) {
          this.current = index;
          this.opts.onChange?.(index);
        }
      });
      item.el.addEventListener('click', (e) => {
        item.activate?.(e);
      });
    });
  }

  get index(): number {
    return this.current;
  }

  /** Remet le focus DOM sur l'élément sélectionné (ouverture, focus perdu). */
  focusCurrent(): void {
    this.opts.items[this.current]?.el.focus({ preventScroll: true });
  }

  handle(action: Exclude<NavAction, { kind: 'back' }>): void {
    const item = this.opts.items[this.current];
    switch (action.kind) {
      case 'move':
        if (item?.adjust && (action.dir === 'left' || action.dir === 'right')) {
          this.focusCurrent();
          item.adjust(action.dir === 'left' ? -1 : 1);
          return;
        }
        this.moveTo(this.opts.navigate(this.current, action.dir));
        return;
      case 'cycle':
        this.moveTo(cycleIndex(this.current, this.opts.items.length, action.step));
        return;
      case 'activate':
        this.focusCurrent();
        item?.activate?.();
        return;
      default:
        unreachable(action);
    }
  }

  private moveTo(next: number | null): void {
    if (next === null || next === this.current) this.focusCurrent();
    else this.setFocus(next, true);
  }

  private setFocus(index: number, sound: boolean): void {
    const item = this.opts.items[index];
    if (!item) return;
    this.current = index;
    item.el.focus({ preventScroll: true });
    if (sound) this.opts.onMove();
    this.opts.onChange?.(index);
  }
}
