import { el, type Child } from './dom';
import { keyAction, type FocusNav } from './focus';
import { sonarMark } from './icons';
import type { ScreenModel, UiCallbacks, UiSound } from './types';

/** Ce que ui.ts transmet à la construction d'un écran. */
export interface ScreenContext {
  cb: UiCallbacks;
  /** Index du focus à reprendre quand un écran du même type est reconstruit, sinon null. */
  keepFocus: number | null;
}

/** Un écran monté : sa racine DOM et sa gestion du clavier. */
export interface ScreenInstance {
  root: HTMLElement;
  /** Touche reçue sur window (les répétitions d'une touche enfoncée avant l'écran sont filtrées). */
  onKey(e: KeyboardEvent): void;
  /** Appelé une fois la racine insérée dans le document : focus initial. */
  enter(): void;
  /** Index du focus courant, pour une reconstruction du même écran. */
  focusIndex(): number | null;
  /** Mise à jour sur place d'un écran du même type ; false : il faut reconstruire. */
  update?(model: ScreenModel): boolean;
  /** Délai après l'ouverture pendant lequel le clavier est ignoré (ms). */
  armDelayMs?: number;
}

/** Rappels sans argument (Jouer, Reprendre, Rejouer…). */
export type SimpleCallback = {
  [K in keyof UiCallbacks]: UiCallbacks[K] extends () => void ? K : never;
}[keyof UiCallbacks];

/**
 * Action qui joue un son d'interface puis appelle le rappel (qui peut changer d'écran).
 * Appel par nom (`cb[name]()`) : le `this` de l'objet de rappels est conservé.
 */
export function withSound(cb: UiCallbacks, sound: UiSound, name: SimpleCallback): () => void {
  return () => {
    cb.onUiSound(sound);
    cb[name]();
  };
}

/** Bouton de menu : rectangle chanfreiné, marque sonar visible au focus, libellé en casse normale. */
export function menuButton(label: string, extraClass = ''): HTMLButtonElement {
  return el('button', { class: `btn chamfer ${extraClass}`.trim(), attrs: { type: 'button' } }, [
    sonarMark(),
    el('span', { class: 'btn-label', text: label }),
  ]);
}

/** Racine d'écran plein cadre ; `variant` choisit le voile (voir styles.css). */
export function screenRoot(
  variant: string,
  label: string,
  children: readonly Child[],
): HTMLElement {
  return el(
    'section',
    { class: `screen screen-${variant}`, attrs: { 'aria-label': label } },
    children,
  );
}

/** Bloc de statistique : libellé discret au-dessus d'une valeur lisible, note facultative. */
export function statBlock(
  label: string,
  value: string,
  opts: { valueClass?: string; note?: string; srNote?: string } = {},
): HTMLElement {
  const children: Child[] = [
    el('dt', { class: 'stat-label', text: label }),
    el('dd', { class: `stat-value ${opts.valueClass ?? ''}`.trim() }, [
      value,
      ...(opts.srNote !== undefined
        ? [el('span', { class: 'sr-only', text: `, ${opts.srNote}` })]
        : []),
    ]),
  ];
  if (opts.note !== undefined) children.push(el('dd', { class: 'stat-note', text: opts.note }));
  return el('div', { class: 'stat' }, children);
}

/**
 * Écran piloté par une FocusNav : les touches de menu vont à la navigation, Échap à `back`.
 * Validation et retour ignorent les répétitions ; les déplacements les acceptent.
 */
export function navScreen(
  root: HTMLElement,
  nav: FocusNav,
  back: (() => void) | null,
  extra: Pick<ScreenInstance, 'update' | 'armDelayMs'> = {},
): ScreenInstance {
  return {
    root,
    ...extra,
    onKey(e) {
      const action = keyAction(e);
      if (action === null) return;
      e.preventDefault();
      if (e.repeat && action.kind !== 'move') return;
      if (action.kind === 'back') back?.();
      else nav.handle(action);
    },
    enter() {
      nav.focusCurrent();
    },
    focusIndex: () => nav.index,
  };
}
