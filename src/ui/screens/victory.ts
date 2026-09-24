import { el } from '../dom';
import { FocusNav, listNavigate } from '../focus';
import { formatFraction, formatTime } from '../format';
import {
  menuButton,
  navScreen,
  screenRoot,
  statBlock,
  withSound,
  type ScreenContext,
  type ScreenInstance,
} from '../screen';
import { STRINGS } from '../strings';
import type { ScreenModel } from '../types';

type VictoryModel = Extract<ScreenModel, { kind: 'victory' }>;

/** Victoire : texte de clôture sobre, totaux, retour à la sélection (Échap aussi). */
export function buildVictory(model: VictoryModel, ctx: ScreenContext): ScreenInstance {
  const { cb } = ctx;
  const s = STRINGS.victory;
  const back = menuButton(s.back);
  const nav = new FocusNav({
    items: [{ el: back, activate: withSound(cb, 'confirm', 'onQuitToSelect') }],
    navigate: listNavigate(1, 'vertical'),
    initial: 0,
    onMove: () => {
      cb.onUiSound('move');
    },
  });

  const root = screenRoot('victory', s.heading, [
    el('div', { class: 'victory-frame' }, [
      el('h2', { class: 'heading', text: s.heading }),
      el('p', { class: 'victory-text', text: s.text }),
      el('dl', { class: 'stats stats-3' }, [
        statBlock(s.stars, formatFraction(model.stars, model.maxStars)),
        statBlock(s.pearls, formatFraction(model.pearls, model.maxPearls)),
        statBlock(s.time, formatTime(model.time)),
      ]),
      el('div', { class: 'victory-actions' }, [back]),
    ]),
  ]);

  return navScreen(root, nav, withSound(cb, 'back', 'onQuitToSelect'));
}
