import { PALETTE } from '../data/palette';
import { TUNING } from '../data/tuning';
import type { Echo, EchoSurface, GameEvent, PulseKind } from '../sim/events';
import type { Vec2 } from '../sim/math/vec';
import type { AmbientModel } from '../sim/views';
import type { AudioSystem } from './audio';

/**
 * Table d'écoute (`?soundboard=1`, outil de dev) : un bouton par son, en passant par l'API
 * publique (handle, ui, update) pour exercer exactement la correspondance du directeur.
 * La sonde est en (0, 0) ; les sons positionnés et les échos sont placés par les curseurs
 * distance et angle (0° = droite, 90° = bas, comme dans la simulation).
 * Textes en dur : page de développement, hors de ui/strings.ts (couche ui non importable ici).
 */

const LISTENER: Vec2 = { x: 0, y: 0 };
const SECTORS = 16;

interface ContinuousState {
  game: boolean;
  current: boolean;
  mud: boolean;
  leviathan: boolean;
  leviathanDistance: number;
  hunt: boolean;
  huntCount: number;
  hull: boolean;
  charge: boolean;
}

const SURFACES: readonly [EchoSurface, string][] = [
  ['rock', 'Roche'],
  ['door', 'Porte'],
  ['hazard', 'Oursin'],
  ['pearl', 'Perle'],
  ['creature', 'Créature'],
  ['lever', 'Levier'],
  ['capsule', 'Capsule'],
  ['checkpoint', 'Point de contrôle'],
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function speed(kind: PulseKind): number {
  return kind === 'long' ? TUNING.pulse.long.speed : TUNING.pulse.short.speed;
}

function makeEcho(angle: number, distance: number, surface: EchoSurface, kind: PulseKind): Echo {
  return { delay: (2 * distance) / speed(kind), angle, distance, surface };
}

function sectorAngle(i: number): number {
  return ((i + 0.5) * 2 * Math.PI) / SECTORS;
}

/** Couloir horizontal : parois à ±1,2 case au-dessus et en dessous. */
function corridorEchoes(): Echo[] {
  const out: Echo[] = [];
  for (let i = 0; i < SECTORS; i++) {
    const a = sectorAngle(i);
    const d = 1.2 / Math.max(1e-3, Math.abs(Math.sin(a)));
    if (d <= TUNING.pulse.short.radius) out.push(makeEcho(a, d, 'rock', 'short'));
  }
  return out;
}

/** Grande salle ronde irrégulière (~6 cases). */
function roomEchoes(): Echo[] {
  const out: Echo[] = [];
  for (let i = 0; i < SECTORS; i++) {
    out.push(makeEcho(sectorAngle(i), 5.6 + Math.random() * 1.2, 'rock', 'short'));
  }
  return out;
}

/** Caverne vue par une impulsion longue : parois de 4 à 15 cases et quelques objets. */
function caveEchoes(): Echo[] {
  const out: Echo[] = [];
  for (let i = 0; i < SECTORS; i++) {
    out.push(makeEcho(sectorAngle(i), 4 + Math.random() * 11, 'rock', 'long'));
  }
  out.push(makeEcho(-Math.PI / 3, 3, 'pearl', 'long'));
  out.push(makeEcho(Math.PI / 5, 5, 'hazard', 'long'));
  out.push(makeEcho((3 * Math.PI) / 4, 9, 'creature', 'long'));
  out.push(makeEcho(Math.PI, 12, 'door', 'long'));
  return out;
}

function injectStyle(): void {
  if (document.getElementById('sb-style')) return;
  const p = PALETTE;
  const chamfer = (s: number): string =>
    `polygon(${s}px 0, 100% 0, 100% calc(100% - ${s}px), calc(100% - ${s}px) 100%, 0 100%, 0 ${s}px)`;
  const style = el('style');
  style.id = 'sb-style';
  style.textContent = `
.sb-page { position: fixed; inset: 0; overflow-y: auto; pointer-events: auto; z-index: 10;
  box-sizing: border-box; padding: 32px 40px 64px; background: ${p.background}; color: ${p.text};
  font-family: 'Chakra Petch', system-ui, sans-serif; font-weight: 400; font-size: 16px; }
.sb-page h1 { font-weight: 600; font-size: 32px; margin: 0 0 4px; }
.sb-page h2 { font-weight: 600; font-size: 18px; margin: 0 0 6px; color: ${p.sonar}; }
.sb-status { font-size: 14px; color: ${p.textMuted}; margin: 0 0 24px; }
.sb-status[data-on="true"] { color: ${p.sonar}; }
.sb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.sb-panel { background: ${p.panel}; box-shadow: inset 0 0 0 1px ${p.line}; padding: 16px 18px;
  clip-path: ${chamfer(12)}; }
.sb-hint { font-size: 14px; line-height: 1.45; color: ${p.textMuted}; margin: 0 0 12px; }
.sb-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.sb-btn { font: inherit; font-size: 14px; color: ${p.text}; cursor: pointer; border: none;
  padding: 8px 14px; background: color-mix(in srgb, ${p.sonar} 6%, ${p.panel});
  box-shadow: inset 0 0 0 1px ${p.line}; clip-path: ${chamfer(7)}; }
.sb-btn:hover { background: color-mix(in srgb, ${p.sonar} 14%, ${p.panel}); }
.sb-btn:focus-visible { outline: none; box-shadow: inset 0 0 0 2px ${p.sonar}; }
.sb-btn:active { background: ${p.sonar}; color: ${p.background}; }
.sb-btn[aria-pressed="true"] { background: color-mix(in srgb, ${p.sonar} 22%, ${p.panel});
  box-shadow: inset 0 0 0 1px ${p.sonar}; color: ${p.probe}; }
.sb-row { display: grid; grid-template-columns: 120px 1fr 72px; align-items: center; gap: 10px;
  font-size: 14px; margin: 6px 0; }
.sb-row input { accent-color: ${p.sonar}; width: 100%; }
.sb-value { text-align: right; color: ${p.sonar}; font-variant-numeric: tabular-nums; }
.sb-compass { display: block; margin: 10px auto 0; }
`;
  document.head.append(style);
}

export function mountSoundboard(root: HTMLElement, audio: AudioSystem): void {
  injectStyle();
  root.style.pointerEvents = 'auto';

  const place = { distance: 4, angleDeg: 0, intensity: 0.7 };
  const cont: ContinuousState = {
    game: false,
    current: false,
    mud: false,
    leviathan: false,
    leviathanDistance: 15,
    hunt: false,
    huntCount: 1,
    hull: false,
    charge: false,
  };

  const page = el('div', 'sb-page');
  page.append(el('h1', undefined, "ÉCHO — table d'écoute"));
  const status = el('p', 'sb-status');
  page.append(status);
  const grid = el('div', 'sb-grid');
  page.append(grid);
  root.append(page);

  const refreshStatus = (): void => {
    status.dataset['on'] = String(audio.unlocked);
    status.textContent = audio.unlocked
      ? 'Audio actif. La sonde est au centre ; curseurs : position des sons et des échos.'
      : "Audio inactif : cliquez n'importe où pour l'activer.";
  };
  const unlock = (): void => {
    audio.unlock();
    refreshStatus();
  };
  page.addEventListener('pointerdown', unlock, { capture: true });
  page.addEventListener('keydown', unlock, { capture: true });
  refreshStatus();

  /** Événements différés, livrés par la boucle d'images comme le ferait la session de jeu. */
  const pending: { in: number; event: GameEvent }[] = [];
  const charge = { t: 0, fired: false };

  const angle = (): number => (place.angleDeg * Math.PI) / 180;
  const pos = (): Vec2 => ({
    x: Math.cos(angle()) * place.distance,
    y: Math.sin(angle()) * place.distance,
  });
  const send = (...events: GameEvent[]): void => {
    unlock();
    audio.handle(events, LISTENER);
  };

  // --- Construction des panneaux -------------------------------------------------------

  const panel = (title: string, hint: string): HTMLElement => {
    const section = el('section', 'sb-panel');
    section.append(el('h2', undefined, title), el('p', 'sb-hint', hint));
    grid.append(section);
    return section;
  };
  const buttons = (parent: HTMLElement): HTMLElement => {
    const row = el('div', 'sb-buttons');
    parent.append(row);
    return row;
  };
  const button = (parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement => {
    const b = el('button', 'sb-btn', label);
    b.type = 'button';
    b.addEventListener('click', () => {
      unlock();
      onClick();
    });
    parent.append(b);
    return b;
  };
  const toggle = (parent: HTMLElement, label: string, onChange: (on: boolean) => void): void => {
    const b = button(parent, label, () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      onChange(on);
    });
    b.setAttribute('aria-pressed', 'false');
  };
  const slider = (
    parent: HTMLElement,
    label: string,
    range: { min: number; max: number; step: number; value: number },
    format: (v: number) => string,
    onInput: (v: number) => void,
  ): void => {
    const row = el('label', 'sb-row');
    const input = el('input');
    input.type = 'range';
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    input.value = String(range.value);
    const value = el('span', 'sb-value', format(range.value));
    input.addEventListener('input', () => {
      const v = Number(input.value);
      value.textContent = format(v);
      onInput(v);
    });
    row.append(el('span', undefined, label), input, value);
    parent.append(row);
  };

  // --- Position ------------------------------------------------------------------------

  const position = panel(
    'Position',
    'Appliquée aux échos et aux sons positionnés. Droite → oreille droite ; haut plus clair, bas plus sourd ; loin plus faible, plus sombre et plus réverbéré.',
  );
  const compass = createCompass();
  slider(
    position,
    'Distance',
    { min: 0, max: 16, step: 0.1, value: place.distance },
    (v) => `${v.toFixed(1)} c.`,
    (v) => {
      place.distance = v;
      compass.update(place.distance, angle());
    },
  );
  slider(
    position,
    'Angle',
    { min: 0, max: 360, step: 1, value: place.angleDeg },
    (v) => `${v}°`,
    (v) => {
      place.angleDeg = v;
      compass.update(place.distance, angle());
    },
  );
  slider(
    position,
    'Intensité du choc',
    { min: 0, max: 1, step: 0.05, value: place.intensity },
    (v) => v.toFixed(2),
    (v) => {
      place.intensity = v;
    },
  );
  position.append(compass.svg);
  compass.update(place.distance, angle());

  // --- Mixage --------------------------------------------------------------------------

  const mixing = panel(
    'Mixage',
    'Volume maître (courbe au carré), pause (bus game et ambiance coupés, interface active), coupure des sons de jeu.',
  );
  slider(
    mixing,
    'Volume',
    { min: 0, max: 1, step: 0.01, value: 0.8 },
    (v) => `${Math.round(v * 100)} %`,
    (v) => {
      audio.setVolume(v);
    },
  );
  const mixButtons = buttons(mixing);
  toggle(mixButtons, 'Pause', (on) => {
    audio.setPaused(on);
  });
  button(mixButtons, 'Couper les sons de jeu', () => {
    audio.stopGameSounds();
  });

  // --- Impulsion -----------------------------------------------------------------------

  const pulse = panel(
    'Impulsion',
    'Courte : ping net 1400 → 900 Hz, ~0,4 s. Longue : plus grave (900 → 520 Hz), poussée sourde, ~1,5 s. Refus : clic sec aigu (recharge), clic grave étouffé qui retombe (énergie).',
  );
  const pulseRow = buttons(pulse);
  button(pulseRow, 'Impulsion courte', () => {
    send({ type: 'pulseEmitted', kind: 'short', pos: LISTENER });
  });
  button(pulseRow, 'Impulsion longue', () => {
    send({ type: 'pulseEmitted', kind: 'long', pos: LISTENER });
  });
  button(pulseRow, 'Refus (recharge)', () => {
    send({ type: 'pulseDenied', reason: 'cooldown' });
  });
  button(pulseRow, 'Refus (énergie)', () => {
    send({ type: 'pulseDenied', reason: 'energy' });
  });

  // --- Échos ---------------------------------------------------------------------------

  const echoes = panel(
    'Échos',
    "Un écho à la position choisie, délai = 2 × distance / vitesse de l'impulsion courte. Scènes : couloir (dense et rapide), salle (clairsemée et tardive), tour d'horizon (16 directions, de la droite vers le bas, la gauche puis le haut), distances (1 à 16 cases dans la direction choisie).",
  );
  const surfaceRow = buttons(echoes);
  for (const [surface, label] of SURFACES) {
    button(surfaceRow, label, () => {
      send({
        type: 'pulseEchoes',
        origin: LISTENER,
        kind: 'short',
        echoes: [makeEcho(angle(), place.distance, surface, 'short')],
      });
    });
  }
  const sceneRow = buttons(echoes);
  button(sceneRow, 'Couloir', () => {
    send(
      { type: 'pulseEmitted', kind: 'short', pos: LISTENER },
      { type: 'pulseEchoes', origin: LISTENER, kind: 'short', echoes: corridorEchoes() },
    );
  });
  button(sceneRow, 'Grande salle', () => {
    send(
      { type: 'pulseEmitted', kind: 'short', pos: LISTENER },
      { type: 'pulseEchoes', origin: LISTENER, kind: 'short', echoes: roomEchoes() },
    );
  });
  button(sceneRow, 'Caverne (longue)', () => {
    send(
      { type: 'pulseEmitted', kind: 'long', pos: LISTENER },
      { type: 'pulseEchoes', origin: LISTENER, kind: 'long', echoes: caveEchoes() },
    );
  });
  button(sceneRow, "Tour d'horizon", () => {
    const list: Echo[] = [];
    for (let i = 0; i < SECTORS; i++) {
      const e = makeEcho((i * 2 * Math.PI) / SECTORS, place.distance, 'rock', 'short');
      list.push({ ...e, delay: e.delay + i * 0.35 });
    }
    send({ type: 'pulseEchoes', origin: LISTENER, kind: 'short', echoes: list });
  });
  button(sceneRow, 'Distances', () => {
    const list = [1, 2, 4, 8, 12, 16].map((d, i) => {
      const e = makeEcho(angle(), d, 'rock', 'long');
      return { ...e, delay: e.delay + i * 0.6 };
    });
    send({ type: 'pulseEchoes', origin: LISTENER, kind: 'long', echoes: list });
  });

  // --- Sonde ---------------------------------------------------------------------------

  const probe = panel(
    'Sonde',
    'Choc : coup sourd, plus fort et plus clair avec l’intensité. Dégât : craquement puis un bip (deux bips plus aigus si coque critique). Destruction : balayage résonant qui descend (~1 s) puis coup sourd. Reprise : glissement ascendant doux.',
  );
  const probeRow = buttons(probe);
  button(probeRow, 'Choc', () => {
    send({ type: 'wallBump', pos: LISTENER, intensity: place.intensity });
  });
  button(probeRow, 'Dégât (oursin)', () => {
    send({ type: 'damage', source: 'hazard', pos: LISTENER, hull: 2 });
  });
  button(probeRow, 'Dégât (créature)', () => {
    send({ type: 'damage', source: 'creature', pos: LISTENER, hull: 2 });
  });
  button(probeRow, 'Dégât critique', () => {
    send({ type: 'damage', source: 'hazard', pos: LISTENER, hull: 1 });
  });
  button(probeRow, 'Destruction', () => {
    send({ type: 'probeDestroyed', pos: LISTENER });
  });
  button(probeRow, 'Reprise', () => {
    send({ type: 'respawn', pos: LISTENER, fromCheckpoint: false });
  });
  button(probeRow, 'Reprise (point de contrôle)', () => {
    send({ type: 'respawn', pos: LISTENER, fromCheckpoint: true });
  });

  // --- Balise, ramassages, progression -------------------------------------------------

  const progress = panel(
    'Balise et progression',
    'Balise : deux notes douces 880 puis 1320 Hz, à la position choisie, jamais muette. Perle : arpège montant scintillant (une note de plus pour la dernière). Capsule : clic et carillon, plus aigu avec la réserve.',
  );
  const progressRow = buttons(progress);
  button(progressRow, 'Balise', () => {
    send({ type: 'beaconPing', pos: pos() });
  });
  button(progressRow, 'Perle', () => {
    send({ type: 'pearlCollected', pos: LISTENER, remaining: 2 });
  });
  button(progressRow, 'Dernière perle', () => {
    send({ type: 'pearlCollected', pos: LISTENER, remaining: 0 });
  });
  for (const carried of [1, 2, 3]) {
    button(progressRow, `Capsule (${carried})`, () => {
      send({ type: 'capsulePicked', pos: LISTENER, carried });
    });
  }
  button(progressRow, 'Point de contrôle', () => {
    send({ type: 'checkpointReached', pos: LISTENER });
  });
  button(progressRow, 'Fin de niveau', () => {
    send({ type: 'levelComplete', pos: LISTENER });
  });

  // --- Créatures -----------------------------------------------------------------------

  const creatures = panel(
    'Créatures',
    'À la position choisie. Cliquetis : deux micro-clics aigus, muets au-delà de 10 cases. Alerte : grognement grave ~0,6 s avec trémolo. Réveil du Léviathan : grondement très grave qui enfle pendant ~1,5 s.',
  );
  const creatureRow = buttons(creatures);
  button(creatureRow, 'Cliquetis', () => {
    send({ type: 'creatureClick', id: 1, pos: pos() });
  });
  button(creatureRow, 'Alerte Guetteur', () => {
    send({ type: 'creatureAlerted', id: 1, kind: 'guetteur', pos: pos(), target: LISTENER });
  });
  button(creatureRow, 'Alerte Léviathan', () => {
    send({ type: 'creatureAlerted', id: 9, kind: 'leviathan', pos: pos(), target: LISTENER });
  });
  button(creatureRow, 'Réveil Léviathan', () => {
    send({ type: 'leviathanWoke', pos: pos() });
  });
  button(creatureRow, 'Morsure', () => {
    send({ type: 'creatureAttack', id: 1, pos: LISTENER });
  });

  // --- Leurre --------------------------------------------------------------------------

  const lure = panel(
    'Leurre',
    'Lancer : glissement qui monte et part vers la direction choisie. Rebond et ping : à la position choisie ; ping = note creuse ~720 Hz. Vide : double clic grave.',
  );
  const lureRow = buttons(lure);
  button(lureRow, 'Lancer', () => {
    send({
      type: 'lureThrown',
      pos: LISTENER,
      dir: { x: Math.cos(angle()), y: Math.sin(angle()) },
    });
  });
  button(lureRow, 'Rebond', () => {
    send({ type: 'lureBounce', pos: pos() });
  });
  button(lureRow, 'Ping', () => {
    send({ type: 'lurePing', pos: pos() });
  });
  button(lureRow, 'Réserve vide', () => {
    send({ type: 'lureEmpty' });
  });

  // --- Leviers et portes ---------------------------------------------------------------

  const doors = panel(
    'Leviers et portes',
    "Levier : « clac » puis petit cliquet. Porte : grondement métallique ~0,8 s à la position choisie ; « Porte complète » enchaîne l'ouverture et le choc de butée au même endroit.",
  );
  const doorRow = buttons(doors);
  button(doorRow, 'Levier', () => {
    send({ type: 'leverPulled', pos: LISTENER, letter: 'a' });
  });
  button(doorRow, "Porte s'ouvre", () => {
    send({ type: 'doorOpening', pos: pos(), letter: 'a' });
  });
  button(doorRow, 'Porte ouverte', () => {
    send({ type: 'doorOpened', letter: 'a' });
  });
  button(doorRow, 'Porte complète', () => {
    send({ type: 'doorOpening', pos: pos(), letter: 'b' });
    // Comme la simulation : doorOpened arrive lever.doorOpenTime plus tard (boucle d'images).
    pending.push({ in: TUNING.lever.doorOpenTime, event: { type: 'doorOpened', letter: 'b' } });
  });

  // --- Interface -----------------------------------------------------------------------

  const menu = panel('Interface', 'Bus ui, sans réverbération, audible même en pause.');
  const menuRow = buttons(menu);
  button(menuRow, 'Navigation', () => {
    audio.ui('move');
  });
  button(menuRow, 'Validation', () => {
    audio.ui('confirm');
  });
  button(menuRow, 'Retour', () => {
    audio.ui('back');
  });

  // --- Sons continus -------------------------------------------------------------------

  const continuous = panel(
    'Sons continus',
    'Partie : lit sonore grave et craquements lointains rares. Courant : souffle qui ondule. Vase : tout le bus de jeu s’étouffe (essayer avec des échos). Léviathan : drone qui enfle et bat plus vite en approchant (muet au-delà de 30 cases). Chasse : battement de cœur grave et souffle. Coque critique : pulsation lente. Charge : bourdonnement qui monte pendant 0,9 s, puis impulsion longue.',
  );
  const contRow = buttons(continuous);
  const flag =
    (key: Exclude<keyof ContinuousState, 'leviathanDistance' | 'huntCount'>) =>
    (on: boolean): void => {
      cont[key] = on;
    };
  toggle(contRow, 'Partie', flag('game'));
  toggle(contRow, 'Courant', flag('current'));
  toggle(contRow, 'Vase', flag('mud'));
  toggle(contRow, 'Léviathan', flag('leviathan'));
  toggle(contRow, 'Chasse', flag('hunt'));
  toggle(contRow, 'Coque critique', flag('hull'));
  toggle(contRow, 'Charge', (on) => {
    cont.charge = on;
    charge.t = 0;
    charge.fired = false;
  });
  slider(
    continuous,
    'Léviathan à',
    { min: 0, max: 40, step: 0.5, value: cont.leviathanDistance },
    (v) => `${v.toFixed(1)} c.`,
    (v) => {
      cont.leviathanDistance = v;
    },
  );
  slider(
    continuous,
    'Guetteurs en chasse',
    { min: 1, max: 4, step: 1, value: cont.huntCount },
    (v) => String(v),
    (v) => {
      cont.huntCount = v;
    },
  );

  // --- Boucle des sons continus ----------------------------------------------------------

  const chargeTime = TUNING.pulse.longChargeTime;
  let last = performance.now();

  const model = (dt: number): AmbientModel | null => {
    let charge01: number | null = null;
    if (cont.charge) {
      charge.t += dt;
      if (charge.t < chargeTime) {
        charge01 = charge.t / chargeTime;
      } else if (!charge.fired) {
        charge.fired = true;
        audio.handle(
          [
            { type: 'pulseEmitted', kind: 'long', pos: LISTENER },
            { type: 'pulseEchoes', origin: LISTENER, kind: 'long', echoes: caveEchoes() },
          ],
          LISTENER,
        );
      } else if (charge.t > chargeTime + 2) {
        charge.t = 0;
        charge.fired = false;
      }
    }
    const any =
      cont.game ||
      cont.current ||
      cont.mud ||
      cont.leviathan ||
      cont.hunt ||
      cont.hull ||
      cont.charge;
    if (!any) return null;
    return {
      listener: LISTENER,
      currentStrength01: cont.current ? 1 : 0,
      inMud: cont.mud,
      leviathanPathDistance: cont.leviathan ? cont.leviathanDistance : null,
      leviathanPos: cont.leviathan
        ? { x: LISTENER.x - cont.leviathanDistance * 0.5, y: LISTENER.y }
        : null,
      huntingCreatures: cont.hunt ? cont.huntCount : 0,
      hullCritical: cont.hull,
      charge01,
    };
  };

  const tick = (t: number): void => {
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
    last = t;
    const due: GameEvent[] = [];
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (!p) continue;
      p.in -= dt;
      if (p.in <= 0) {
        due.push(p.event);
        pending.splice(i, 1);
      }
    }
    if (due.length > 0) audio.handle(due, LISTENER);
    audio.update(model(dt), dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Petit schéma : la sonde au centre, le point de la position choisie, cercles à 4, 8 et 16 cases. */
function createCompass(): {
  svg: SVGSVGElement;
  update: (distance: number, angle: number) => void;
} {
  const NS = 'http://www.w3.org/2000/svg';
  const size = 170;
  const c = size / 2;
  const scale = 64 / 16;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'sb-compass');
  svg.setAttribute('aria-hidden', 'true');
  for (const r of [4, 8, 16]) {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', String(c));
    circle.setAttribute('cy', String(c));
    circle.setAttribute('r', String(r * scale));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', PALETTE.line);
    svg.append(circle);
  }
  const label = (text: string, x: number, y: number): void => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', String(x));
    t.setAttribute('y', String(y));
    t.setAttribute('fill', PALETTE.textMuted);
    t.setAttribute('font-size', '11');
    t.setAttribute('text-anchor', 'middle');
    t.textContent = text;
    svg.append(t);
  };
  label('haut : clair', c, 11);
  label('bas : sourd', c, size - 3);
  label('G', 8, c + 4);
  label('D', size - 8, c + 4);
  const probe = document.createElementNS(NS, 'circle');
  probe.setAttribute('cx', String(c));
  probe.setAttribute('cy', String(c));
  probe.setAttribute('r', '3');
  probe.setAttribute('fill', PALETTE.probe);
  svg.append(probe);
  const line = document.createElementNS(NS, 'line');
  line.setAttribute('x1', String(c));
  line.setAttribute('y1', String(c));
  line.setAttribute('stroke', PALETTE.sonar);
  line.setAttribute('stroke-opacity', '0.5');
  svg.append(line);
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('r', '4');
  dot.setAttribute('fill', PALETTE.sonar);
  svg.append(dot);
  return {
    svg,
    update: (distance, angle) => {
      const x = c + Math.cos(angle) * distance * scale;
      const y = c + Math.sin(angle) * distance * scale;
      line.setAttribute('x2', x.toFixed(1));
      line.setAttribute('y2', y.toFixed(1));
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
    },
  };
}
