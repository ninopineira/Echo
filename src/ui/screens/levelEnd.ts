import { el } from '../dom';
import { FocusNav, listNavigate, type FocusItem } from '../focus';
import { formatFraction, formatTime } from '../format';
import { beaconMark, starIcon } from '../icons';
import {
  menuButton,
  navScreen,
  screenRoot,
  statBlock,
  withSound,
  type ScreenContext,
  type ScreenInstance,
} from '../screen';
import { levelTitle, STRINGS } from '../strings';
import type { ScreenModel } from '../types';

type EndModel = Extract<ScreenModel, { kind: 'levelEnd' }>;

/**
 * Cadence des étoiles qui s'allument (le seul moment animé de l'écran). Exportée pour que l'app
 * puisse caler les trois notes des étoiles sur l'animation : étoile i à FIRST + i × STEP ms.
 * Avec `prefers-reduced-motion`, les étoiles sont allumées d'emblée (voir `starRevealDelays`).
 */
export const STAR_REVEAL_FIRST_MS = 450;
export const STAR_REVEAL_STEP_MS = 420;

/**
 * Délai d'armement du clavier : un joueur qui tapotait Espace en touchant la balise ne doit pas
 * sauter l'écran de fin par accident.
 */
export const LEVEL_END_ARM_MS = 400;

/** Délais d'allumage des trois étoiles (ms) ; tous nuls si les animations sont réduites. */
export function starRevealDelays(reducedMotion: boolean): [number, number, number] {
  if (reducedMotion) return [0, 0, 0];
  const at = (i: number): number => STAR_REVEAL_FIRST_MS + i * STAR_REVEAL_STEP_MS;
  return [at(0), at(1), at(2)];
}

function endStar(label: string, earned: boolean, delayMs: number): HTMLElement {
  const s = STRINGS.levelEnd;
  return el(
    'li',
    { class: `end-star${earned ? ' is-earned' : ''}`, vars: { '--delay': `${delayMs}ms` } },
    [
      el('span', { class: 'end-star-icon' }, [
        el('span', { class: 'ping' }),
        starIcon(false, 'star-base'),
        starIcon(true, 'star-fill'),
      ]),
      el('span', { class: 'end-star-label', text: label }),
      el('span', { class: 'sr-only', text: `, ${earned ? s.starEarned : s.starMissed}` }),
    ],
  );
}

/**
 * Fin de niveau : panneau sur le jeu figé (voile à 70 %). Statistiques, puis les trois étoiles
 * qui s'allument une à une, puis Niveau suivant (ou Continuer), Rejouer, Sélection.
 */
export function buildLevelEnd(model: EndModel, ctx: ScreenContext): ScreenInstance {
  const { cb } = ctx;
  const s = STRINGS.levelEnd;
  const r = model.result;
  const overPar = r.pulses > r.par;

  const items: FocusItem[] = [];
  if (model.hasNext || model.isLast) {
    items.push({
      el: menuButton(model.hasNext ? s.next : s.continue),
      activate: withSound(cb, 'confirm', 'onNextLevel'),
    });
  }
  items.push(
    { el: menuButton(s.replay), activate: withSound(cb, 'confirm', 'onReplay') },
    { el: menuButton(s.select), activate: withSound(cb, 'confirm', 'onQuitToSelect') },
  );

  const nav = new FocusNav({
    items,
    navigate: listNavigate(items.length, 'both', false),
    initial: ctx.keepFocus ?? 0,
    onMove: () => {
      cb.onUiSound('move');
    },
  });

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [d0, d1, d2] = starRevealDelays(reduced);

  const root = screenRoot('end', s.heading, [
    el(
      'div',
      {
        class: 'panel chamfer',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': s.heading },
      },
      [
        el('h2', { class: 'heading end-heading' }, [beaconMark(), el('span', { text: s.heading })]),
        el('p', { class: 'subtitle', text: levelTitle(model.levelNumber, model.levelName) }),
        el('dl', { class: 'stats' }, [
          statBlock(s.time, formatTime(r.time), {
            note: model.newRecords.time ? s.newRecord : undefined,
          }),
          statBlock(s.pulses, formatFraction(r.pulses, r.par), {
            valueClass: overPar ? 'is-over' : undefined,
            srNote: overPar ? s.overPar : undefined,
            note: model.newRecords.pulses ? s.newRecord : undefined,
          }),
          statBlock(s.pearls, formatFraction(r.pearls, r.pearlsTotal)),
          statBlock(s.deaths, String(r.deaths)),
        ]),
        el('ul', { class: 'end-stars' }, [
          endStar(s.starComplete, r.stars.complete, d0),
          endStar(s.starPearls, r.stars.pearls, d1),
          endStar(s.starPar, r.stars.par, d2),
        ]),
        el(
          'div',
          { class: 'row' },
          items.map((i) => i.el),
        ),
      ],
    ),
  ]);

  return navScreen(root, nav, withSound(cb, 'back', 'onQuitToSelect'), {
    armDelayMs: LEVEL_END_ARM_MS,
  });
}
