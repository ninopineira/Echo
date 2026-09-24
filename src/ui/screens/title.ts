import { el } from '../dom';
import { FocusNav, isWakeKey, listNavigate } from '../focus';
import {
  menuButton,
  navScreen,
  screenRoot,
  withSound,
  type ScreenContext,
  type ScreenInstance,
} from '../screen';
import { STRINGS } from '../strings';
import type { ScreenModel } from '../types';

type TitleModel = Extract<ScreenModel, { kind: 'title' }>;

/**
 * Titre. Écran transparent : les anneaux sonar sont dessinés dessous par le rendu (seul moment de
 * mise en scène). Le logo ne bouge pas entre les deux phases : la zone du bas a une hauteur fixe.
 */
export function buildTitle(model: TitleModel, ctx: ScreenContext): ScreenInstance {
  const { cb } = ctx;
  const t = STRINGS.title;
  const lower = el('div', { class: 'title-lower' });
  const root = screenRoot('title', t.logo, [
    el('div', { class: 'title-stack' }, [
      el('h1', { class: 'title-logo', text: t.logo }),
      el('p', { class: 'title-tagline', text: t.tagline }),
      lower,
    ]),
  ]);

  if (model.phase === 'pressKey') {
    lower.append(el('p', { class: 'title-prompt', text: t.pressKey }));
    let woken = false;
    const wake = (): void => {
      if (woken) return;
      woken = true;
      cb.onAnyKey();
      cb.onUiSound('confirm');
    };
    root.addEventListener('pointerdown', wake);
    return {
      root,
      onKey(e) {
        if (e.repeat || !isWakeKey(e)) return;
        if (e.code === 'Space' || e.code === 'Enter') e.preventDefault();
        wake();
      },
      enter() {
        // Aucun élément à mettre en focus : toute touche convient.
      },
      focusIndex: () => null,
    };
  }

  const play = menuButton(t.play);
  const options = menuButton(t.options);
  lower.append(el('div', { class: 'menu title-menu' }, [play, options]));
  const nav = new FocusNav({
    items: [
      { el: play, activate: withSound(cb, 'confirm', 'onPlay') },
      { el: options, activate: withSound(cb, 'confirm', 'onOpenOptions') },
    ],
    navigate: listNavigate(2, 'vertical'),
    initial: ctx.keepFocus ?? 0,
    onMove: () => {
      cb.onUiSound('move');
    },
  });
  return navScreen(root, nav, null);
}
