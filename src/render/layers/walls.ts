import { PALETTE } from '../../data/palette';
import { TAU } from '../../sim/math/vec';
import { SEG_STRIDE } from '../../sim/level/types';
import { SURFACE_DOOR, SURFACE_ROCK, type Pulse, type World } from '../../sim/world';
import { alphaBucket, isFlashing, revealAlpha } from '../afterglow';
import type { GlowBatch } from '../glow';
import { sx, sy, type View } from '../view';

/** Points d'impact (x, y) de chaque rayon, calculés une fois par impulsion. */
const impactCache = new WeakMap<Pulse, Float32Array>();

/** Amplitude (cases) du relief ajouté au dessin des parois ; la collision reste exacte. */
const WALL_RELIEF = 0.07;

/**
 * Relief lisse et fixe dans l'espace, dans [-1, 1] : une même paroi garde la même forme d'une
 * impulsion à l'autre, sans le crénelage d'un bruit tiré au hasard par rayon.
 */
function relief(x: number, y: number): number {
  return (
    0.6 * Math.sin(x * 2.3 + y * 1.1) * Math.cos(y * 1.9 - x * 0.7) +
    0.4 * Math.sin(x * 5.3 - y * 4.1 + 1.7)
  );
}

function impacts(pulse: Pulse): Float32Array {
  let pts = impactCache.get(pulse);
  if (!pts) {
    const n = pulse.hitDist.length;
    pts = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const d = pulse.hitDist[i]!;
      const x = pulse.ox + cos * d;
      const y = pulse.oy + sin * d;
      // Le relief pousse le point le long du rayon : la roche ondule à peine, les portes restent droites.
      const r = pulse.hitSurface[i] === SURFACE_ROCK ? WALL_RELIEF * relief(x, y) : 0;
      pts[i * 2] = x + cos * r;
      pts[i * 2 + 1] = y + sin * r;
    }
    impactCache.set(pulse, pts);
  }
  return pts;
}

function isWall(surface: number | undefined): boolean {
  return surface === SURFACE_ROCK || surface === SURFACE_DOOR;
}

/**
 * Parois révélées : points d'impact voisins reliés en polylignes « scannées » (sauf discontinuité),
 * éclat au contact puis effacement ; plus les arcs révélés par les chocs.
 */
export function drawWalls(v: View, world: World, batch: GlowBatch): void {
  batch.reset();
  const flash = world.tuning.pulse.flashTime;
  for (const pulse of world.state.pulses) {
    const pts = impacts(pulse);
    const n = pulse.hitDist.length;
    const spacing = TAU / n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (!isWall(pulse.hitSurface[i]) || !isWall(pulse.hitSurface[j])) continue;
      const di = pulse.hitDist[i]!;
      const dj = pulse.hitDist[j]!;
      const far = Math.max(di, dj);
      const x1 = pts[i * 2]!;
      const y1 = pts[i * 2 + 1]!;
      const x2 = pts[j * 2]!;
      const y2 = pts[j * 2 + 1]!;
      const gap = Math.max(0.6, 3 * far * spacing);
      if (Math.abs(x2 - x1) + Math.abs(y2 - y1) > gap) continue;
      const elapsed = v.time - (pulse.start + far / pulse.speed);
      const a = revealAlpha(elapsed, flash, pulse.afterglow);
      if (a <= 0.01) continue;
      batch.segment(
        isFlashing(elapsed, flash) ? -1 : alphaBucket(a),
        sx(v, x1),
        sy(v, y1),
        sx(v, x2),
        sy(v, y2),
      );
    }
  }
  drawWallArcs(v, world, batch, flash);
  batch.draw(v.ctx, PALETTE.sonar, v.scale / 50);
}

/** Arcs de paroi révélés par un choc : segments proches du point de contact. */
function drawWallArcs(v: View, world: World, batch: GlowBatch, flash: number): void {
  const { segs, segDoor, cellStart, cellSegs, width, height } = world.level;
  const doors = world.state.doors;
  for (const r of world.state.reveals) {
    if (r.kind !== 'wallArc') continue;
    const elapsed = v.time - r.at;
    const base = revealAlpha(elapsed, flash, r.fade);
    if (base <= 0.01) continue;
    const x0 = Math.max(0, Math.floor(r.x - r.radius));
    const x1 = Math.min(width - 1, Math.floor(r.x + r.radius));
    const y0 = Math.max(0, Math.floor(r.y - r.radius));
    const y1 = Math.min(height - 1, Math.floor(r.y + r.radius));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * width + cx;
        for (let k = cellStart[c]!; k < cellStart[c + 1]!; k++) {
          const s = cellSegs[k]!;
          const d = segDoor[s]!;
          if (d >= 0 && doors[d]!.progress >= 1) continue;
          const o = s * SEG_STRIDE;
          const mx = (segs[o]! + segs[o + 2]!) / 2;
          const my = (segs[o + 1]! + segs[o + 3]!) / 2;
          const dist = Math.hypot(mx - r.x, my - r.y);
          if (dist > r.radius) continue;
          const a = base * (1 - dist / r.radius);
          batch.segment(
            isFlashing(elapsed, flash) ? -1 : alphaBucket(a),
            sx(v, segs[o]!),
            sy(v, segs[o + 1]!),
            sx(v, segs[o + 2]!),
            sy(v, segs[o + 3]!),
          );
        }
      }
    }
  }
}

/** Fronts d'onde : trait fin qui s'estompe avec le rayon et s'arrête là où chaque rayon s'est arrêté. */
export function drawRings(v: View, world: World, batch: GlowBatch): void {
  batch.reset();
  let any = false;
  for (const pulse of world.state.pulses) {
    const r = (v.time - pulse.start) * pulse.speed;
    if (r <= 0 || r >= pulse.maxHit) continue;
    const bucket = alphaBucket(0.75 * Math.sqrt(Math.max(0, 1 - r / pulse.maxRadius)));
    const n = pulse.hitDist.length;
    let prevAlive = false;
    let px = 0;
    let py = 0;
    for (let k = 0; k <= n; k++) {
      const i = k % n;
      const alive = pulse.hitDist[i]! > r;
      const a = (i * TAU) / n;
      const x = sx(v, pulse.ox + Math.cos(a) * r);
      const y = sy(v, pulse.oy + Math.sin(a) * r);
      if (alive && prevAlive) {
        batch.segment(bucket, px, py, x, y);
        any = true;
      }
      prevAlive = alive;
      px = x;
      py = y;
    }
  }
  if (any) batch.draw(v.ctx, PALETTE.sonar, v.scale / 90, 0.8);
}
