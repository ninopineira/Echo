import { svg } from './dom';

/**
 * Pictogrammes SVG inline. Tous dessinés en `currentColor` : la couleur vient du CSS (variables
 * --c-*), jamais d'une valeur en dur ici.
 */

function round2(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Tracé d'une étoile à `branches` pointes (première pointe vers le haut). */
export function starPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  branches = 5,
): string {
  const parts: string[] = [];
  for (let i = 0; i < branches * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / branches;
    parts.push(
      `${i === 0 ? 'M' : 'L'}${round2(cx + r * Math.cos(a))} ${round2(cy + r * Math.sin(a))}`,
    );
  }
  return `${parts.join(' ')}Z`;
}

/** Arc de cercle centré en (cx, cy), ouvert vers la droite, de −angle à +angle (degrés). */
export function sonarArc(cx: number, cy: number, r: number, angleDeg: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const x = round2(cx + r * Math.cos(a));
  const y1 = round2(cy - r * Math.sin(a));
  const y2 = round2(cy + r * Math.sin(a));
  return `M${x} ${y1}A${r} ${r} 0 0 1 ${x} ${y2}`;
}

const STAR_D = starPath(12, 12.8, 10.5, 4.4);

function base(className: string, viewBox: string): Record<string, string> {
  return { class: className, viewBox, 'aria-hidden': 'true', focusable: 'false' };
}

/** Étoile pleine (obtenue) ou en creux (manquée). */
export function starIcon(filled: boolean, extraClass = ''): SVGSVGElement {
  const cls = `star ${filled ? 'star-on' : 'star-off'} ${extraClass}`.trim();
  return svg('svg', base(cls, '0 0 24 24'), [
    svg('path', {
      d: STAR_D,
      fill: filled ? 'currentColor' : 'none',
      stroke: 'currentColor',
      'stroke-width': filled ? 1 : 1.5,
      'stroke-linejoin': 'round',
    }),
  ]);
}

/** Cadenas au corps chanfreiné, comme les boutons. */
export function lockIcon(): SVGSVGElement {
  return svg(
    'svg',
    {
      ...base('lock', '0 0 24 24'),
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    },
    [
      svg('path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }),
      svg('path', { d: 'M7.5 11H19v7.5L16.5 21H5v-7.5z' }),
      svg('path', { d: 'M12 14.8v2.6' }),
    ],
  );
}

/** Marque de focus : un point et deux arcs, une impulsion qui part vers le libellé. */
export function sonarMark(): SVGSVGElement {
  const arc = (r: number, opacity: number): SVGPathElement =>
    svg('path', {
      d: sonarArc(4, 9, r, 50),
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
      opacity,
    });
  return svg('svg', base('mark', '0 0 18 18'), [
    svg('circle', { cx: 4, cy: 9, r: 2.2, fill: 'currentColor' }),
    arc(5.5, 1),
    arc(9.5, 0.55),
  ]);
}

/** Losange de la balise de sortie (même forme que dans le jeu). */
export function beaconMark(): SVGSVGElement {
  return svg('svg', base('beacon-mark', '0 0 16 16'), [
    svg('path', { d: 'M8 1L15 8L8 15L1 8Z', fill: 'currentColor' }),
  ]);
}
