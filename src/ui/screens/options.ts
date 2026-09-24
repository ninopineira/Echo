import type { Options } from '../../save/save';
import { el } from '../dom';
import { FocusNav, listNavigate } from '../focus';
import {
  formatPercent,
  litSegments,
  stepVolume,
  volumeFromRatio,
  volumePercent,
  VOLUME_SEGMENTS,
} from '../format';
import { sonarMark } from '../icons';
import {
  menuButton,
  navScreen,
  screenRoot,
  withSound,
  type ScreenContext,
  type ScreenInstance,
} from '../screen';
import { STRINGS } from '../strings';
import type { ScreenModel, UiSound } from '../types';

type OptionsModel = Extract<ScreenModel, { kind: 'options' }>;

function sameOptions(a: Options, b: Options): boolean {
  return (
    a.volume === b.volume && a.longAfterglow === b.longAfterglow && a.screenShake === b.screenShake
  );
}

interface ToggleRow {
  row: HTMLButtonElement;
  set(on: boolean): void;
}

/** Ligne oui/non : un interrupteur dont l'état se lit sur deux cases, Non à gauche, Oui à droite. */
function toggleRow(label: string, hint: string | null, hintId: string): ToggleRow {
  const s = STRINGS.options;
  const no = el('span', { class: 'seg-cell', text: s.no, attrs: { 'data-value': 'off' } });
  const yes = el('span', { class: 'seg-cell', text: s.yes, attrs: { 'data-value': 'on' } });
  const text = el('span', { class: 'opt-text' }, [el('span', { class: 'opt-label', text: label })]);
  const attrs: Record<string, string> = { type: 'button', role: 'switch', 'aria-label': label };
  if (hint !== null) {
    text.append(el('span', { class: 'opt-hint', text: hint, attrs: { id: hintId } }));
    attrs['aria-describedby'] = hintId;
  }
  const row = el('button', { class: 'opt chamfer', attrs }, [
    sonarMark(),
    text,
    el('span', { class: 'seg', attrs: { 'aria-hidden': 'true' } }, [no, yes]),
  ]);
  return {
    row,
    set(on) {
      row.setAttribute('aria-checked', String(on));
      no.classList.toggle('is-on', !on);
      yes.classList.toggle('is-on', on);
    },
  };
}

/** Valeur visée par un clic dans une ligne oui/non : la case cliquée, sinon l'inverse de l'état. */
function clickedValue(e: Event | undefined, current: boolean): boolean {
  const cell = e?.target instanceof Element ? e.target.closest('[data-value]') : null;
  return cell ? cell.getAttribute('data-value') === 'on' : !current;
}

/**
 * Options : volume (jauge de 20 crans, ±5 % aux flèches gauche/droite), rémanence allongée,
 * tremblement de l'écran, Retour (Échap aussi). Chaque changement part tout de suite vers l'app.
 * Si l'app renvoie le même écran avec les nouvelles options, il est mis à jour sur place (le
 * glisser de la jauge et le focus ne sont pas interrompus).
 */
export function buildOptions(model: OptionsModel, ctx: ScreenContext): ScreenInstance {
  const { cb } = ctx;
  const s = STRINGS.options;
  const returnTo = model.returnTo;
  let state: Options = { ...model.options };

  // Volume : rôle « slider », piloté au clavier par la navigation et à la souris sur la jauge.
  const segments = Array.from({ length: VOLUME_SEGMENTS }, () =>
    el('span', { class: 'gauge-seg' }),
  );
  const gauge = el('span', { class: 'gauge' }, segments);
  const volumeValue = el('span', { class: 'opt-value' });
  const volumeRow = el(
    'div',
    {
      class: 'opt chamfer',
      attrs: {
        role: 'slider',
        tabindex: '0',
        'aria-label': s.volume,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
      },
    },
    [
      sonarMark(),
      el('span', { class: 'opt-text' }, [el('span', { class: 'opt-label', text: s.volume })]),
      el('span', { class: 'opt-control' }, [gauge, volumeValue]),
    ],
  );

  const afterglow = toggleRow(s.longAfterglow, s.longAfterglowHint, 'opt-afterglow-hint');
  const shake = toggleRow(s.screenShake, null, 'opt-shake-hint');
  const back = menuButton(s.back);

  function render(): void {
    const lit = litSegments(state.volume);
    segments.forEach((seg, i) => seg.classList.toggle('is-on', i < lit));
    volumeValue.textContent = formatPercent(state.volume);
    volumeRow.setAttribute('aria-valuenow', String(volumePercent(state.volume)));
    volumeRow.setAttribute('aria-valuetext', formatPercent(state.volume));
    afterglow.set(state.longAfterglow);
    shake.set(state.screenShake);
  }

  function commit(next: Options, sound: UiSound): void {
    if (sameOptions(next, state)) return;
    state = next;
    render();
    // Options d'abord : le son de confirmation joue déjà au nouveau volume.
    cb.onOptionsChange({ ...state });
    cb.onUiSound(sound);
  }

  const setVolumeFromPointer = (e: PointerEvent): void => {
    const rect = gauge.getBoundingClientRect();
    if (rect.width <= 0) return;
    commit({ ...state, volume: volumeFromRatio((e.clientX - rect.left) / rect.width) }, 'move');
  };
  gauge.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    gauge.setPointerCapture(e.pointerId);
    setVolumeFromPointer(e);
  });
  gauge.addEventListener('pointermove', (e) => {
    if (gauge.hasPointerCapture(e.pointerId)) setVolumeFromPointer(e);
  });

  const nav = new FocusNav({
    items: [
      {
        el: volumeRow,
        adjust: (step) => {
          commit({ ...state, volume: stepVolume(state.volume, step) }, 'move');
        },
      },
      {
        el: afterglow.row,
        activate: (e) => {
          commit({ ...state, longAfterglow: clickedValue(e, state.longAfterglow) }, 'confirm');
        },
        adjust: (step) => {
          commit({ ...state, longAfterglow: step > 0 }, 'move');
        },
      },
      {
        el: shake.row,
        activate: (e) => {
          commit({ ...state, screenShake: clickedValue(e, state.screenShake) }, 'confirm');
        },
        adjust: (step) => {
          commit({ ...state, screenShake: step > 0 }, 'move');
        },
      },
      { el: back, activate: withSound(cb, 'back', 'onBack') },
    ],
    navigate: listNavigate(4, 'vertical'),
    initial: ctx.keepFocus ?? 0,
    onMove: () => {
      cb.onUiSound('move');
    },
  });

  render();

  const root = screenRoot('options', s.heading, [
    el(
      'div',
      {
        class: 'panel chamfer',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': s.heading },
      },
      [
        el('h2', { class: 'heading', text: s.heading }),
        el('div', { class: 'opt-list' }, [volumeRow, afterglow.row, shake.row]),
        el('div', { class: 'opt-actions' }, [back]),
      ],
    ),
  ]);

  return navScreen(root, nav, withSound(cb, 'back', 'onBack'), {
    update(next) {
      if (next.kind !== 'options' || next.returnTo !== returnTo) return false;
      state = { ...next.options };
      render();
      return true;
    },
  });
}
