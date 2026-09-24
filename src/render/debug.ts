import { PALETTE } from '../data/palette';
import { SEG_STRIDE } from '../sim/level/types';
import type { World } from '../sim/world';
import { withAlpha } from './color';
import { sx, sy, type View } from './view';

export interface FrameStats {
  fps: number;
  frameMs: number;
  simMs: number;
  renderMs: number;
}

/** Toute la géométrie (F2 révélation permanente, ou F1 en filigrane). */
export function drawGeometry(v: View, world: World, strong: boolean): void {
  const { ctx } = v;
  const { segs, segCount, segDoor } = world.level;
  const doors = world.state.doors;
  const rock = new Path2D();
  const door = new Path2D();
  for (let s = 0; s < segCount; s++) {
    const d = segDoor[s]!;
    if (d >= 0 && doors[d]!.progress >= 1) continue;
    const o = s * SEG_STRIDE;
    const path = d >= 0 ? door : rock;
    path.moveTo(sx(v, segs[o]!), sy(v, segs[o + 1]!));
    path.lineTo(sx(v, segs[o + 2]!), sy(v, segs[o + 3]!));
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = strong ? 1.6 : 1;
  ctx.strokeStyle = withAlpha(PALETTE.sonar, strong ? 0.75 : 0.25);
  ctx.stroke(rock);
  ctx.strokeStyle = withAlpha(PALETTE.hazard, strong ? 0.75 : 0.3);
  ctx.stroke(door);
}

/**
 * F1 : créatures (position réelle, cercle d'écoute à l'intensité d'une impulsion courte,
 * cible de déplacement, origine du dernier bruit) et bruits récents.
 */
export function drawCreatureDebug(v: View, world: World): void {
  const { ctx } = v;
  ctx.save();
  ctx.lineWidth = 1;
  for (const c of world.state.creatures) {
    const x = sx(v, c.pos.x);
    const y = sy(v, c.pos.y);
    ctx.strokeStyle = withAlpha(PALETTE.creatureRim, 0.9);
    ctx.beginPath();
    ctx.arc(x, y, (c.kind === 'guetteur' ? world.tuning.guetteur.radius : world.tuning.leviathan.radius) * v.scale, 0, Math.PI * 2);
    ctx.stroke();
    if (c.kind !== 'guetteur') continue;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = withAlpha(PALETTE.creatureRim, 0.35);
    ctx.beginPath();
    ctx.arc(x, y, world.tuning.guetteur.hearingRadius * v.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (c.target) {
      ctx.strokeStyle = withAlpha(PALETTE.hazard, 0.7);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(sx(v, c.target.x), sy(v, c.target.y));
      ctx.stroke();
    }
    if (c.noiseOrigin) {
      ctx.fillStyle = withAlpha(PALETTE.hazard, 0.8);
      ctx.fillRect(sx(v, c.noiseOrigin.x) - 3, sy(v, c.noiseOrigin.y) - 3, 6, 6);
    }
  }
  ctx.restore();
}

/** Overlay texte F1 : mesures et journal d'événements. */
export function drawDebugText(
  ctx: CanvasRenderingContext2D,
  world: World | null,
  stats: FrameStats,
  eventLog: readonly string[],
): void {
  const lines = [
    `${stats.fps.toFixed(0)} i/s · frame ${stats.frameMs.toFixed(1)} ms · sim ${stats.simMs.toFixed(2)} ms · rendu ${stats.renderMs.toFixed(2)} ms`,
  ];
  if (world) {
    const p = world.state.probe;
    lines.push(
      `${world.level.id} · pas ${world.tick} · t ${world.time.toFixed(1)} s · sonde (${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}) v ${Math.hypot(p.vel.x, p.vel.y).toFixed(2)}`,
      `impulsions ${world.stats.pulses} · actives ${world.state.pulses.length} · révélations ${world.state.reveals.length} · segments ${world.level.segCount}`,
    );
    for (const c of world.state.creatures) {
      lines.push(
        c.kind === 'guetteur'
          ? `Guetteur ${c.id} : ${c.mode} (${c.pos.x.toFixed(1)}, ${c.pos.y.toFixed(1)})`
          : `Léviathan : ${c.awake ? 'éveillé' : 'endormi'} élan ${c.surge.toFixed(2)}`,
      );
    }
  }
  lines.push(...eventLog);
  ctx.save();
  ctx.font = '400 12px "Chakra Petch", sans-serif';
  ctx.textBaseline = 'top';
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
  ctx.fillStyle = withAlpha(PALETTE.background, 0.78);
  ctx.fillRect(8, 8, width, lines.length * 15 + 10);
  ctx.fillStyle = withAlpha(PALETTE.text, 0.9);
  lines.forEach((line, i) => {
    ctx.fillText(line, 16, 13 + i * 15);
  });
  ctx.restore();
}
