import { el } from '../dom';
import { FocusNav, gridStep, type FocusItem, type Navigate } from '../focus';
import { earnedStars, formatFraction } from '../format';
import { lockIcon, sonarMark, starIcon } from '../icons';
import {
  menuButton,
  navScreen,
  screenRoot,
  withSound,
  type ScreenContext,
  type ScreenInstance,
} from '../screen';
import { levelCardLabel, STRINGS } from '../strings';
import type { LevelCard, ScreenModel } from '../types';

type SelectModel = Extract<ScreenModel, { kind: 'levelSelect' }>;

/** Cases par rangée (GDD § 4 : grille 5 × 2). */
export const SELECT_COLUMNS = 5;
const STARS_PER_LEVEL = 3;

/**
 * Déplacements de la sélection : la grille des cases (index 0..count−1), puis le bouton Retour
 * (index count), atteint en descendant depuis la dernière rangée. En remontant depuis Retour, on
 * retrouve la dernière case visitée.
 */
export function selectNavigate(count: number, columns: number, lastCard: () => number): Navigate {
  return (index, dir) => {
    if (index === count) return dir === 'up' && count > 0 ? lastCard() : null;
    const next = gridStep(index, count, columns, dir);
    if (next === null && dir === 'down') return count;
    return next;
  };
}

function levelCard(card: LevelCard): HTMLButtonElement {
  const stars = earnedStars(card.stars);
  const foot = card.locked
    ? el('span', { class: 'card-foot' }, [lockIcon()])
    : el('span', { class: 'card-foot' }, [
        starIcon(card.stars.complete),
        starIcon(card.stars.pearls),
        starIcon(card.stars.par),
      ]);
  const attrs: Record<string, string> = {
    type: 'button',
    'aria-label': levelCardLabel(card.number, card.name, card.locked, stars, STARS_PER_LEVEL),
  };
  if (card.locked) attrs['aria-disabled'] = 'true';
  return el('button', { class: `card chamfer${card.locked ? ' is-locked' : ''}`, attrs }, [
    sonarMark(),
    el('span', { class: 'card-num', text: String(card.number) }),
    el('span', { class: 'card-name', text: card.name }),
    foot,
  ]);
}

/** Sélection des niveaux : grille de cases, total d'étoiles, Retour. Échap revient au titre. */
export function buildLevelSelect(model: SelectModel, ctx: ScreenContext): ScreenInstance {
  const { cb } = ctx;
  const s = STRINGS.levelSelect;
  const count = model.levels.length;

  const cards = model.levels.map(levelCard);
  const back = menuButton(s.back, 'btn-back');
  const items: FocusItem[] = cards.map((cardEl, i) => {
    const card = model.levels[i];
    return {
      el: cardEl,
      activate:
        card && !card.locked
          ? () => {
              cb.onUiSound('confirm');
              cb.onSelectLevel(card.slug);
            }
          : undefined,
    };
  });
  items.push({ el: back, activate: withSound(cb, 'back', 'onBack') });

  const focusIdx = model.levels.findIndex((l) => l.slug === model.focusSlug);
  const initial = ctx.keepFocus ?? Math.max(0, focusIdx);
  let lastCard = Math.min(initial, Math.max(0, count - 1));

  const nav = new FocusNav({
    items,
    navigate: selectNavigate(count, SELECT_COLUMNS, () => lastCard),
    initial,
    onMove: () => {
      cb.onUiSound('move');
    },
    onChange: (i) => {
      if (i < count) lastCard = i;
    },
  });

  const root = screenRoot('select', s.heading, [
    el('div', { class: 'select-frame' }, [
      el('header', { class: 'select-head' }, [
        el('h2', { class: 'heading', text: s.heading }),
        el('p', { class: 'select-total' }, [
          starIcon(true),
          el('span', { text: s.stars }),
          el('span', {
            class: 'select-total-value',
            text: formatFraction(model.stars, model.maxStars),
          }),
        ]),
      ]),
      el('div', { class: 'level-grid', attrs: { role: 'group', 'aria-label': s.heading } }, cards),
      el('footer', { class: 'select-foot' }, [back]),
    ]),
  ]);

  return navScreen(root, nav, withSound(cb, 'back', 'onBack'));
}
