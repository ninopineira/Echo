import { el } from '../dom';
import { FocusNav, listNavigate, type FocusItem } from '../focus';
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

type PauseModel = Extract<ScreenModel, { kind: 'pause' }>;

/**
 * Pause : voile opaque à 85 % qui masque le terrain (on ne peut pas étudier la rémanence à l'arrêt).
 * Échap reprend la partie.
 */
export function buildPause(model: PauseModel, ctx: ScreenContext): ScreenInstance {
  const { cb } = ctx;
  const s = STRINGS.pause;

  const items: FocusItem[] = [
    { el: menuButton(s.resume), activate: withSound(cb, 'confirm', 'onResume') },
  ];
  if (model.canRestoreCheckpoint) {
    items.push({
      el: menuButton(s.restoreCheckpoint),
      activate: withSound(cb, 'confirm', 'onRestoreCheckpoint'),
    });
  }
  items.push(
    { el: menuButton(s.restartLevel), activate: withSound(cb, 'confirm', 'onRestartLevel') },
    { el: menuButton(s.options), activate: withSound(cb, 'confirm', 'onOpenOptions') },
    { el: menuButton(s.quitToSelect), activate: withSound(cb, 'confirm', 'onQuitToSelect') },
  );

  const nav = new FocusNav({
    items,
    navigate: listNavigate(items.length, 'vertical'),
    initial: ctx.keepFocus ?? 0,
    onMove: () => {
      cb.onUiSound('move');
    },
  });

  const root = screenRoot('pause', s.heading, [
    el(
      'div',
      {
        class: 'panel chamfer',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': s.heading },
      },
      [
        el('h2', { class: 'heading', text: s.heading }),
        el('p', { class: 'subtitle', text: model.levelName }),
        el(
          'div',
          { class: 'menu' },
          items.map((i) => i.el),
        ),
      ],
    ),
  ]);

  return navScreen(root, nav, withSound(cb, 'back', 'onResume'));
}
