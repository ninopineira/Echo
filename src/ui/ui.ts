import './styles.css';
import { unreachable } from './dom';
import type { ScreenContext, ScreenInstance } from './screen';
import { buildLevelEnd } from './screens/levelEnd';
import { buildLevelSelect } from './screens/levelSelect';
import { buildOptions } from './screens/options';
import { buildPause } from './screens/pause';
import { buildTitle } from './screens/title';
import { buildVictory } from './screens/victory';
import { applyTheme } from './theme';
import type { ScreenModel, Ui, UiCallbacks } from './types';

type ShownModel = Exclude<ScreenModel, { kind: 'playing' }>;

function buildScreen(model: ShownModel, ctx: ScreenContext): ScreenInstance {
  switch (model.kind) {
    case 'title':
      return buildTitle(model, ctx);
    case 'levelSelect':
      return buildLevelSelect(model, ctx);
    case 'pause':
      return buildPause(model, ctx);
    case 'levelEnd':
      return buildLevelEnd(model, ctx);
    case 'victory':
      return buildVictory(model, ctx);
    case 'options':
      return buildOptions(model, ctx);
    default:
      return unreachable(model);
  }
}

/**
 * Écoute clavier d'un écran, attachée au frame suivant : l'appui qui a ouvert l'écran (Échap qui
 * ouvre la pause, Entrée qui valide l'écran précédent) ne doit pas y être traité aussi.
 * Les répétitions ne passent que pour une touche enfoncée pendant que cet écran était affiché :
 * une flèche tenue pendant la nage ne fait pas défiler le menu de pause.
 * Renvoie la fonction qui détache tout.
 */
function listenKeys(screen: ScreenInstance): () => void {
  const down = new Set<string>();
  let armedAt = Infinity;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (performance.now() < armedAt) return;
    if (e.repeat) {
      if (!down.has(e.code)) return;
    } else {
      down.add(e.code);
    }
    screen.onKey(e);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    down.delete(e.code);
    // Un bouton natif s'active au relâchement d'Espace : c'est l'UI qui décide, pas le navigateur.
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault();
  };

  const raf = requestAnimationFrame(() => {
    armedAt = performance.now() + (screen.armDelayMs ?? 0);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  });

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

interface Mounted {
  kind: ShownModel['kind'];
  screen: ScreenInstance;
  detach: () => void;
}

/**
 * UI DOM d'ÉCHO (ARCHITECTURE § 8). `show(model)` remplace l'écran courant ; `playing` vide la
 * racine et ne laisse aucun écouteur clavier actif.
 */
export function createUi(root: HTMLElement, callbacks: UiCallbacks): Ui {
  applyTheme(root);
  root.classList.add('ui-root');

  // Un clic dans le vide ne doit pas faire perdre la sélection courante.
  root.addEventListener('mousedown', (e) => {
    if (e.target instanceof Element && e.target.closest('button, [tabindex]')) return;
    e.preventDefault();
  });

  let current: Mounted | null = null;
  /** Dernier focus de chaque écran : au retour des options, on retrouve le bouton Options. */
  const lastFocus = new Map<ShownModel['kind'], number>();

  return {
    show(model) {
      if (current && current.kind === model.kind && current.screen.update?.(model) === true) return;

      let keepFocus: number | null = null;
      if (current) {
        const index = current.screen.focusIndex();
        if (index !== null) lastFocus.set(current.kind, index);
        if (current.kind === model.kind) keepFocus = index;
        else if (current.kind === 'options' && model.kind !== 'playing') {
          keepFocus = lastFocus.get(model.kind) ?? null;
        }
        current.detach();
        current = null;
      }
      root.replaceChildren();
      if (model.kind === 'playing') return;

      const screen = buildScreen(model, { cb: callbacks, keepFocus });
      root.append(screen.root);
      screen.enter();
      current = { kind: model.kind, screen, detach: listenKeys(screen) };
    },
  };
}
