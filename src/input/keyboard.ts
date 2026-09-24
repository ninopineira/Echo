import type { InputFrame } from '../sim/inputFrame';
import { actionForCode, moveFromActions, type GameAction } from './bindings';

/**
 * Clavier → InputFrame (ARCHITECTURE § 7). Les fronts (appui, relâchement, lancer, pause) sont
 * mémorisés jusqu'au prochain `sample()`, pour qu'aucun appui bref ne soit perdu entre deux pas.
 */
export class KeyboardInput {
  private readonly held = new Set<GameAction>();
  private pulsePressed = false;
  private pulseReleased = false;
  private throwPressed = false;
  private pausePressed = false;
  private gameplay = false;
  /** Appelé quand la fenêtre perd le focus ou devient cachée. */
  onFocusLost: (() => void) | null = null;

  constructor(target: Window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
    target.document.addEventListener('visibilitychange', () => {
      if (target.document.hidden) this.onBlur();
    });
  }

  /** Active le routage des touches vers le jeu (sinon l'UI DOM gère le clavier). */
  setGameplay(active: boolean): void {
    if (this.gameplay === active) return;
    this.gameplay = active;
    this.clear();
  }

  sample(): InputFrame {
    const frame: InputFrame = {
      move: moveFromActions(this.held),
      pulseHeld: this.held.has('pulse'),
      pulsePressed: this.pulsePressed,
      pulseReleased: this.pulseReleased,
      throwPressed: this.throwPressed,
    };
    this.pulsePressed = false;
    this.pulseReleased = false;
    this.throwPressed = false;
    return frame;
  }

  consumePause(): boolean {
    const p = this.pausePressed;
    this.pausePressed = false;
    return p;
  }

  /** Oublie toutes les touches et tous les fronts. */
  clear(): void {
    this.held.clear();
    this.pulsePressed = false;
    this.pulseReleased = false;
    this.throwPressed = false;
    this.pausePressed = false;
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.gameplay) return;
    const action = actionForCode(e.code);
    if (action === null) return;
    e.preventDefault();
    if (e.repeat || this.held.has(action)) return;
    this.held.add(action);
    if (action === 'pulse') this.pulsePressed = true;
    else if (action === 'throw') this.throwPressed = true;
    else if (action === 'pause') this.pausePressed = true;
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const action = actionForCode(e.code);
    if (action === null || !this.held.has(action)) return;
    this.held.delete(action);
    if (action === 'pulse') this.pulseReleased = true;
  };

  private readonly onBlur = (): void => {
    this.clear();
    this.onFocusLost?.();
  };
}
