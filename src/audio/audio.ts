import type { GameEvent } from '../sim/events';
import type { Vec2 } from '../sim/math/vec';
import type { AmbientModel } from '../sim/views';
import { Director, type UiSound } from './director';
import { AudioEngine } from './engine';
import { MASTER } from './mix';

export type { UiSound } from './director';

/**
 * Système audio d'ÉCHO (ARCHITECTURE § 6) : point d'entrée unique pour l'app.
 * Avant unlock(), toutes les méthodes sont des no-op ; volume et pause sont mémorisés
 * et appliqués au déblocage.
 */
export interface AudioSystem {
  /** Crée ou reprend l'AudioContext. Appelé dans un gestionnaire de geste utilisateur (keydown/click). Idempotent. */
  unlock(): void;
  readonly unlocked: boolean;
  /** Sons des événements d'une frame. listener = position de la sonde en cases (y vers le bas). */
  handle(events: readonly GameEvent[], listener: Vec2): void;
  /** Sons continus ; ambient = null hors partie (menus) → coupe les sons continus de jeu. dt en secondes. */
  update(ambient: AmbientModel | null, dt: number): void;
  /** Volume maître 0..1 (option). */
  setVolume(volume: number): void;
  /** Pause : bus game et ambience vers 0 en ~150 ms, bus ui actif. */
  setPaused(paused: boolean): void;
  ui(kind: UiSound): void;
  /** Coupe immédiatement (avec micro-fondu) les sons de jeu en cours et planifiés (changement de niveau, reprise). */
  stopGameSounds(): void;
}

interface Running {
  ctx: AudioContext;
  engine: AudioEngine;
  director: Director;
}

export function createAudioSystem(): AudioSystem {
  let running: Running | null = null;
  let volume: number = MASTER.defaultVolume;
  let paused = false;

  /** Le contexte peut jouer (ou jouera dès sa reprise) : pas fermé. */
  const live = (): Running | null => (running && running.ctx.state !== 'closed' ? running : null);

  return {
    unlock(): void {
      if (running) {
        if (running.ctx.state !== 'running' && running.ctx.state !== 'closed') {
          running.ctx.resume().catch((error: unknown) => {
            console.warn('Audio : reprise impossible', error);
          });
        }
        return;
      }
      try {
        const ctx = new AudioContext({ latencyHint: 'interactive' });
        const engine = new AudioEngine(ctx, volume, paused);
        running = { ctx, engine, director: new Director(engine) };
        if (ctx.state !== 'running') {
          ctx.resume().catch((error: unknown) => {
            console.warn('Audio : reprise impossible', error);
          });
        }
      } catch (error) {
        console.warn('Audio indisponible', error);
        running = null;
      }
    },

    get unlocked(): boolean {
      return running !== null;
    },

    handle(events, listener): void {
      live()?.director.handle(events, listener);
    },

    update(ambient, _dt): void {
      live()?.director.update(ambient);
    },

    setVolume(v): void {
      volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : volume;
      live()?.engine.setVolume(volume);
    },

    setPaused(p): void {
      paused = p;
      live()?.engine.setPaused(p);
    },

    ui(kind): void {
      live()?.director.ui(kind);
    },

    stopGameSounds(): void {
      live()?.director.stopGame();
    },
  };
}
