import { describe, expect, it } from 'vitest';
import { initialFlow, reduce, type FlowAction, type FlowState } from './flow';

function play(...actions: FlowAction[]): FlowState {
  return actions.reduce(reduce, initialFlow());
}

describe('flux des écrans', () => {
  it('titre → touche → menu → sélection → partie → pause → reprise', () => {
    expect(play({ type: 'anyKey', directLevel: false })).toMatchObject({ screen: 'title', titlePhase: 'menu' });
    const s = play(
      { type: 'anyKey', directLevel: false },
      { type: 'play' },
      { type: 'selectLevel' },
      { type: 'pause' },
    );
    expect(s.screen).toBe('pause');
    expect(reduce(s, { type: 'resume' }).screen).toBe('playing');
    expect(reduce(s, { type: 'quitToSelect' }).screen).toBe('levelSelect');
  });

  it('?level= saute les menus après la touche', () => {
    expect(play({ type: 'anyKey', directLevel: true }).screen).toBe('playing');
  });

  it('les options reviennent à l’écran d’origine', () => {
    const fromTitle = play({ type: 'anyKey', directLevel: false }, { type: 'openOptions' });
    expect(fromTitle.screen).toBe('options');
    expect(reduce(fromTitle, { type: 'back' })).toMatchObject({ screen: 'title', titlePhase: 'menu' });
    const fromPause = play(
      { type: 'anyKey', directLevel: true },
      { type: 'pause' },
      { type: 'openOptions' },
    );
    expect(reduce(fromPause, { type: 'back' }).screen).toBe('pause');
  });

  it('fin de niveau → suivant, rejouer, ou victoire après le dernier', () => {
    const end = play({ type: 'anyKey', directLevel: true }, { type: 'levelComplete' });
    expect(end.screen).toBe('levelEnd');
    expect(reduce(end, { type: 'next', isLast: false }).screen).toBe('playing');
    expect(reduce(end, { type: 'replay' }).screen).toBe('playing');
    const victory = reduce(end, { type: 'next', isLast: true });
    expect(victory.screen).toBe('victory');
    expect(reduce(victory, { type: 'quitToSelect' }).screen).toBe('levelSelect');
  });

  it('ignore les actions sans objet', () => {
    const s = initialFlow();
    expect(reduce(s, { type: 'pause' })).toBe(s);
    const playing = play({ type: 'anyKey', directLevel: true });
    expect(reduce(playing, { type: 'back' })).toBe(playing);
  });
});
