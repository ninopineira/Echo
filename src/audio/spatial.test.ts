import { describe, expect, it } from 'vitest';
import { BRIGHTNESS, SPATIAL } from './mix';
import {
  brightnessCutoff,
  distanceGain,
  distanceSend,
  echoSpatial,
  geoLerp,
  panFromOffset,
  spatialAt,
  spatialFromOffset,
  verticalCutoff,
} from './spatial';

const RIGHT = 0;
const DOWN = Math.PI / 2;
const LEFT = Math.PI;
const UP = -Math.PI / 2;

describe('panFromOffset', () => {
  it('suit le décalage horizontal et se borne à ±1', () => {
    expect(panFromOffset(0, 8)).toBe(0);
    expect(panFromOffset(4, 8)).toBeCloseTo(0.5);
    expect(panFromOffset(-4, 8)).toBeCloseTo(-0.5);
    expect(panFromOffset(20, 8)).toBe(1);
    expect(panFromOffset(-20, 8)).toBe(-1);
  });

  it('tolère une portée nulle', () => {
    expect(panFromOffset(3, 0)).toBe(1);
    expect(panFromOffset(0, 0)).toBe(0);
  });
});

describe('distanceGain', () => {
  it('vaut 1 au contact et 1/2 à la distance falloff', () => {
    expect(distanceGain(0, { falloff: 4 })).toBe(1);
    expect(distanceGain(4, { falloff: 4 })).toBeCloseTo(0.5);
    expect(distanceGain(12, { falloff: 4 })).toBeCloseTo(0.25);
  });

  it('décroît strictement avec la distance', () => {
    let prev = Infinity;
    for (let d = 0; d <= 20; d += 0.5) {
      const g = distanceGain(d, { falloff: 3.5 });
      expect(g).toBeLessThan(prev);
      prev = g;
    }
  });

  it('respecte le plancher (balise audible de partout)', () => {
    expect(distanceGain(1000, SPATIAL.beacon)).toBeCloseTo(SPATIAL.beacon.minGain);
  });

  it("s'éteint à maxDistance (cliquetis de proximité)", () => {
    const r = SPATIAL.click;
    expect(distanceGain(r.maxDistance, r)).toBe(0);
    expect(distanceGain(r.maxDistance + 5, r)).toBe(0);
    expect(distanceGain(1, r)).toBeGreaterThan(0.5);
  });
});

describe('brillance', () => {
  it('le haut est plus clair que le côté, le côté plus clair que le bas', () => {
    const up = verticalCutoff(-1, BRIGHTNESS);
    const side = verticalCutoff(0, BRIGHTNESS);
    const down = verticalCutoff(1, BRIGHTNESS);
    expect(up).toBeCloseTo(BRIGHTNESS.cutoffUp);
    expect(side).toBeCloseTo(BRIGHTNESS.cutoffSide);
    expect(down).toBeCloseTo(BRIGHTNESS.cutoffDown);
    expect(up).toBeGreaterThan(side);
    expect(side).toBeGreaterThan(down);
  });

  it('une source plus lointaine est plus sombre dans la même direction', () => {
    expect(brightnessCutoff(0, -8, BRIGHTNESS)).toBeLessThan(brightnessCutoff(0, -2, BRIGHTNESS));
    expect(brightnessCutoff(8, 0, BRIGHTNESS)).toBeLessThan(brightnessCutoff(2, 0, BRIGHTNESS));
  });

  it("s'ouvre quand la source est confondue avec la sonde", () => {
    expect(brightnessCutoff(0, 0, BRIGHTNESS)).toBe(BRIGHTNESS.cutoffOpen);
    expect(brightnessCutoff(0, 0.05, BRIGHTNESS)).toBeGreaterThan(
      brightnessCutoff(0, 2, BRIGHTNESS),
    );
  });

  it('ne descend jamais sous la coupure minimale', () => {
    expect(brightnessCutoff(0, 500, BRIGHTNESS)).toBeGreaterThanOrEqual(BRIGHTNESS.minCutoff);
  });

  it('geoLerp interpole en échelle logarithmique', () => {
    expect(geoLerp(100, 10000, 0)).toBeCloseTo(100);
    expect(geoLerp(100, 10000, 0.5)).toBeCloseTo(1000);
    expect(geoLerp(100, 10000, 1)).toBeCloseTo(10000);
  });
});

describe('echoSpatial (angle, distance)', () => {
  const r = SPATIAL.echo;

  it('paroi à droite → oreille droite, à gauche → oreille gauche, en haut ou en bas → centre', () => {
    expect(echoSpatial(RIGHT, 3, r, BRIGHTNESS).pan).toBeCloseTo(r.panWidth);
    expect(echoSpatial(LEFT, 3, r, BRIGHTNESS).pan).toBeCloseTo(-r.panWidth);
    expect(echoSpatial(UP, 3, r, BRIGHTNESS).pan).toBeCloseTo(0);
    expect(echoSpatial(DOWN, 3, r, BRIGHTNESS).pan).toBeCloseTo(0);
  });

  it('le pan dépend de la direction, pas de la distance', () => {
    const near = echoSpatial(Math.PI / 4, 1, r, BRIGHTNESS);
    const far = echoSpatial(Math.PI / 4, 12, r, BRIGHTNESS);
    expect(near.pan).toBeCloseTo(far.pan);
    expect(near.pan).toBeGreaterThan(0);
  });

  it("un écho lointain est plus faible et plus sombre qu'un écho proche", () => {
    const near = echoSpatial(RIGHT, 1.5, r, BRIGHTNESS);
    const far = echoSpatial(RIGHT, 12, r, BRIGHTNESS);
    expect(far.gain).toBeLessThan(near.gain);
    expect(far.cutoff).toBeLessThan(near.cutoff);
  });

  it("un écho du haut de l'écran est plus clair qu'un écho du bas (angle 0 = +x, y vers le bas)", () => {
    const up = echoSpatial(UP, 4, r, BRIGHTNESS);
    const down = echoSpatial(DOWN, 4, r, BRIGHTNESS);
    expect(up.cutoff).toBeGreaterThan(down.cutoff);
    expect(up.gain).toBeCloseTo(down.gain);
  });

  it('accepte des angles hors de [0, 2π[', () => {
    const a = echoSpatial(RIGHT + 2 * Math.PI, 3, r, BRIGHTNESS);
    const b = echoSpatial(RIGHT, 3, r, BRIGHTNESS);
    expect(a.pan).toBeCloseTo(b.pan);
    expect(a.cutoff).toBeCloseTo(b.cutoff);
  });

  it('borne une distance négative à 0', () => {
    expect(echoSpatial(RIGHT, -2, r, BRIGHTNESS).gain).toBe(1);
  });
});

describe('spatialAt (listener, pos)', () => {
  const r = SPATIAL.world;

  it('se calcule relativement à la sonde', () => {
    const a = spatialAt({ x: 10, y: 5 }, { x: 13, y: 1 }, r, BRIGHTNESS);
    const b = spatialFromOffset(3, -4, r, BRIGHTNESS);
    expect(a).toEqual(b);
    expect(a.distance).toBeCloseTo(5);
  });

  it('pan = clamp(dx / panRange) : source à droite → pan positif', () => {
    const s = spatialAt({ x: 0, y: 0 }, { x: r.panRange / 2, y: 0 }, r, BRIGHTNESS);
    expect(s.pan).toBeCloseTo(0.5);
    const far = spatialAt({ x: 0, y: 0 }, { x: -3 * r.panRange, y: 0 }, r, BRIGHTNESS);
    expect(far.pan).toBe(-1);
  });

  it('source au-dessus plus claire que source en dessous', () => {
    const up = spatialAt({ x: 0, y: 0 }, { x: 0, y: -4 }, r, BRIGHTNESS);
    const down = spatialAt({ x: 0, y: 0 }, { x: 0, y: 4 }, r, BRIGHTNESS);
    expect(up.cutoff).toBeGreaterThan(down.cutoff);
  });
});

describe('distanceSend', () => {
  it('va de near à far, borné', () => {
    expect(distanceSend(0, 0.1, 0.5, 10)).toBeCloseTo(0.1);
    expect(distanceSend(5, 0.1, 0.5, 10)).toBeCloseTo(0.3);
    expect(distanceSend(50, 0.1, 0.5, 10)).toBeCloseTo(0.5);
  });
});
