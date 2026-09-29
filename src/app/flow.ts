/** Machine d'états des écrans (ARCHITECTURE § 8), pure et testée. */

export type Screen =
  'title' | 'levelSelect' | 'playing' | 'pause' | 'levelEnd' | 'victory' | 'options';

export interface FlowState {
  screen: Screen;
  titlePhase: 'pressKey' | 'menu';
  /** Écran auquel revient « Retour » depuis les options. */
  optionsReturn: 'title' | 'pause';
}

export type FlowAction =
  | { type: 'anyKey'; directLevel: boolean }
  | { type: 'play' }
  | { type: 'openOptions' }
  | { type: 'back' }
  | { type: 'selectLevel' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'restoreCheckpoint' }
  | { type: 'quitToSelect' }
  | { type: 'levelComplete' }
  | { type: 'next'; isLast: boolean }
  | { type: 'replay' };

export function initialFlow(): FlowState {
  return { screen: 'title', titlePhase: 'pressKey', optionsReturn: 'title' };
}

/** Transition ; une action sans effet dans l'écran courant renvoie l'état inchangé. */
export function reduce(state: FlowState, action: FlowAction): FlowState {
  const to = (screen: Screen, extra: Partial<FlowState> = {}): FlowState => ({
    ...state,
    screen,
    ...extra,
  });
  switch (state.screen) {
    case 'title':
      if (state.titlePhase === 'pressKey') {
        if (action.type !== 'anyKey') return state;
        return action.directLevel
          ? to('playing', { titlePhase: 'menu' })
          : { ...state, titlePhase: 'menu' };
      }
      if (action.type === 'play') return to('levelSelect');
      if (action.type === 'openOptions') return to('options', { optionsReturn: 'title' });
      return state;
    case 'options':
      if (action.type !== 'back') return state;
      return to(state.optionsReturn === 'pause' ? 'pause' : 'title');
    case 'levelSelect':
      if (action.type === 'back') return to('title');
      if (action.type === 'selectLevel') return to('playing');
      return state;
    case 'playing':
      if (action.type === 'pause') return to('pause');
      if (action.type === 'levelComplete') return to('levelEnd');
      if (action.type === 'restart') return state;
      return state;
    case 'pause':
      switch (action.type) {
        case 'resume':
        case 'restart':
        case 'restoreCheckpoint':
          return to('playing');
        case 'openOptions':
          return to('options', { optionsReturn: 'pause' });
        case 'quitToSelect':
          return to('levelSelect');
        default:
          return state;
      }
    case 'levelEnd':
      if (action.type === 'next') return to(action.isLast ? 'victory' : 'playing');
      if (action.type === 'replay') return to('playing');
      if (action.type === 'quitToSelect') return to('levelSelect');
      return state;
    case 'victory':
      if (action.type === 'quitToSelect') return to('levelSelect');
      return state;
  }
}
