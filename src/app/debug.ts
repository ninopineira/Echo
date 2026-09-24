import type { GameEvent } from '../sim/events';
import type { World } from '../sim/world';

export interface DebugParams {
  /** Niveau à lancer directement (numéro 1-based ou slug). */
  level: string | null;
  debug: boolean;
  reveal: boolean;
  god: boolean;
  unlock: boolean;
  seed: number | null;
  soundboard: boolean;
}

export function readParams(search: string): DebugParams {
  const q = new URLSearchParams(search);
  const flag = (name: string): boolean => q.get(name) === '1';
  const seed = q.get('seed');
  return {
    level: q.get('level'),
    debug: flag('debug'),
    reveal: flag('reveal'),
    god: flag('god'),
    unlock: flag('unlock'),
    seed: seed !== null && /^-?\d+$/.test(seed) ? Number(seed) : null,
    soundboard: flag('soundboard'),
  };
}

/** Résout `?level=` (numéro 1-based ou slug) en indice de catalogue, ou null. */
export function resolveLevelParam(
  param: string | null,
  catalog: readonly { id: string }[],
): number | null {
  if (param === null) return null;
  if (/^\d+$/.test(param)) {
    const i = Number(param) - 1;
    return i >= 0 && i < catalog.length ? i : null;
  }
  const i = catalog.findIndex((l) => l.id === param);
  return i >= 0 ? i : null;
}

/** Résumé court d'un événement pour le journal de l'overlay F1 et window.__echo. */
export function describeEvent(e: GameEvent): string {
  switch (e.type) {
    case 'pulseEchoes':
      return `pulseEchoes ${e.kind} (${e.echoes.length} échos)`;
    case 'noise':
      return `noise ${e.source} ${e.loudness.toFixed(2)}`;
    case 'wallBump':
      return `wallBump ${e.intensity.toFixed(2)}`;
    case 'pulseEmitted':
      return `pulseEmitted ${e.kind}`;
    case 'pulseDenied':
      return `pulseDenied ${e.reason}`;
    case 'damage':
      return `damage ${e.source} (coque ${e.hull})`;
    case 'creatureAlerted':
      return `creatureAlerted ${e.kind} ${e.id}`;
    default:
      return e.type;
  }
}

export interface EchoDebugHandle {
  world(): World | null;
  loadLevel(slugOrNumber: string): void;
  teleport(x: number, y: number): void;
  lastEvents(): string[];
}

declare global {
  interface Window {
    __echo?: EchoDebugHandle;
  }
}

/** Touches F1–F4 (dev ou ?debug=1). */
export function attachDebugKeys(
  target: Window,
  handlers: { overlay: () => void; reveal: () => void; god: () => void; restart: () => void },
): void {
  target.addEventListener('keydown', (e) => {
    const map: Record<string, (() => void) | undefined> = {
      F1: handlers.overlay,
      F2: handlers.reveal,
      F3: handlers.god,
      F4: handlers.restart,
    };
    const fn = map[e.code];
    if (!fn) return;
    e.preventDefault();
    fn();
  });
}
