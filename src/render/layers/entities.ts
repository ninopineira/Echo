import { PALETTE } from '../../data/palette';
import { dirVec, TAU } from '../../sim/math/vec';
import { hash01 } from '../../sim/rng';
import type { Reveal, World } from '../../sim/world';
import { revealAlpha } from '../afterglow';
import { mix, withAlpha } from '../color';
import { sx, sy, type View } from '../view';

/** Images rémanentes des objets révélés (GDD § 5), figées là où le front les a touchés. */
export function drawReveals(v: View, world: World): void {
  const flash = world.tuning.pulse.flashTime;
  const s = world.state;
  const { ctx } = v;
  ctx.save();
  for (const r of s.reveals) {
    if (r.kind === 'wallArc') continue;
    const elapsed = v.time - r.at;
    const a = revealAlpha(elapsed, flash, r.fade);
    if (a <= 0.01) continue;
    const x = sx(v, r.x);
    const y = sy(v, r.y);
    if (x < -v.scale * 3 || y < -v.scale * 3 || x > v.w + v.scale * 3 || y > v.h + v.scale * 3) {
      continue;
    }
    const hot = elapsed < flash;
    switch (r.kind) {
      case 'pearl':
        if (s.pearls[r.ref]?.taken) break;
        drawPearl(v, x, y, a, elapsed);
        break;
      case 'hazard':
        drawUrchin(v, x, y, a, r.ref, hot);
        break;
      case 'capsule':
        if (s.capsules[r.ref]?.taken) break;
        drawCapsule(v, x, y, a, Math.PI / 4);
        break;
      case 'lure':
        drawCapsule(v, x, y, a, 0);
        break;
      case 'lever':
        drawLever(v, x, y, a, r.state === 1);
        break;
      case 'door':
        drawDoorCell(v, r.x - 0.5, r.y - 0.5, a);
        break;
      case 'checkpoint':
        drawCheckpoint(v, x, y, a, r.state === 1);
        break;
      case 'current':
        drawCurrent(v, r, a);
        break;
      case 'guetteur':
        drawGuetteur(v, x, y, r.angle, a);
        break;
      case 'leviathan':
        drawLeviathan(v, r, a, world.tuning.leviathan.radius);
        break;
    }
  }
  ctx.restore();
}

function drawPearl(v: View, x: number, y: number, a: number, elapsed: number): void {
  const { ctx } = v;
  const r = 0.16 * v.scale;
  const twinkle = 0.75 + 0.25 * Math.sin(elapsed * 9);
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
  halo.addColorStop(0, withAlpha(PALETTE.pearl, 0.35 * a * twinkle));
  halo.addColorStop(1, withAlpha(PALETTE.pearl, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 3.5, y - r * 3.5, r * 7, r * 7);
  ctx.fillStyle = withAlpha(PALETTE.pearl, a);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = withAlpha('#FFFFFF', 0.8 * a);
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, TAU);
  ctx.fill();
}

function drawUrchin(v: View, x: number, y: number, a: number, ref: number, hot: boolean): void {
  const { ctx } = v;
  const spikes = 8 + Math.floor(hash01(ref * 7 + 1) * 3);
  const rot = hash01(ref * 7 + 2) * TAU;
  const outer = 0.44 * v.scale;
  const inner = 0.17 * v.scale;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = rot + (i * Math.PI) / spikes;
    const jitter = 0.8 + 0.35 * hash01(ref * 31 + i);
    const rad = i % 2 === 0 ? outer * jitter : inner;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = withAlpha(PALETTE.hazard, 0.25 * a);
  ctx.fill();
  ctx.lineWidth = Math.max(1, v.scale / 45);
  ctx.strokeStyle = hot ? mix(PALETTE.hazard, '#FFFFFF', 0.6, a) : withAlpha(PALETTE.hazard, a);
  ctx.stroke();
}

function drawCapsule(v: View, x: number, y: number, a: number, angle: number): void {
  const { ctx } = v;
  const len = 0.36 * v.scale;
  const r = 0.11 * v.scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-len / 2, -r);
  ctx.lineTo(len / 2, -r);
  ctx.arc(len / 2, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-len / 2, r);
  ctx.arc(-len / 2, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fillStyle = withAlpha(PALETTE.pearl, 0.2 * a);
  ctx.fill();
  ctx.lineWidth = Math.max(1, v.scale / 50);
  ctx.strokeStyle = withAlpha(PALETTE.pearl, a);
  ctx.stroke();
  ctx.restore();
}

function drawLever(v: View, x: number, y: number, a: number, pulled: boolean): void {
  const { ctx } = v;
  const r = 0.14 * v.scale;
  ctx.lineWidth = Math.max(1.5, v.scale / 30);
  ctx.strokeStyle = withAlpha(PALETTE.pearl, a);
  ctx.beginPath();
  ctx.arc(x, y + r, r, Math.PI, TAU);
  ctx.stroke();
  const ang = pulled ? -Math.PI / 4 : (-3 * Math.PI) / 4;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.6);
  ctx.lineTo(x + Math.cos(ang) * r * 3, y + r * 0.6 + Math.sin(ang) * r * 3);
  ctx.stroke();
}

function drawDoorCell(v: View, cx: number, cy: number, a: number): void {
  const { ctx } = v;
  const x = sx(v, cx);
  const y = sy(v, cy);
  const s = v.scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, s, s);
  ctx.clip();
  ctx.strokeStyle = withAlpha(PALETTE.sonar, 0.55 * a);
  ctx.lineWidth = Math.max(1, s / 60);
  ctx.beginPath();
  for (let k = -s; k < s * 2; k += s / 5) {
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + k + s, y + s);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = withAlpha(PALETTE.sonar, a);
  ctx.lineWidth = Math.max(1, s / 40);
  ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
}

function drawCheckpoint(v: View, x: number, y: number, a: number, active: boolean): void {
  const { ctx } = v;
  const color = active ? PALETTE.beacon : PALETTE.pearl;
  ctx.lineWidth = Math.max(1, v.scale / 45);
  ctx.strokeStyle = withAlpha(color, a);
  ctx.beginPath();
  ctx.arc(x, y, 0.3 * v.scale, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = withAlpha(color, a);
  ctx.beginPath();
  ctx.arc(x, y, 0.08 * v.scale, 0, TAU);
  ctx.fill();
}

function drawCurrent(v: View, r: Reveal, a: number): void {
  const { ctx } = v;
  const d = dirVec(r.state);
  const drift = ((v.time - r.at) * 0.9) % 1;
  ctx.lineWidth = Math.max(1, v.scale / 55);
  ctx.strokeStyle = withAlpha(PALETTE.sonar, 0.5 * a);
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const lateral = (k - 1) * 0.28;
    const along = ((drift + k * 0.37) % 1) - 0.5;
    const cx = r.x + d.x * along + -d.y * lateral;
    const cy = r.y + d.y * along + d.x * lateral;
    ctx.moveTo(sx(v, cx - d.x * 0.18), sy(v, cy - d.y * 0.18));
    ctx.lineTo(sx(v, cx + d.x * 0.18), sy(v, cy + d.y * 0.18));
  }
  ctx.stroke();
}

function drawGuetteur(v: View, x: number, y: number, heading: number, a: number): void {
  const { ctx } = v;
  const s = v.scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.beginPath();
  ctx.moveTo(0.55 * s, 0);
  ctx.bezierCurveTo(0.35 * s, -0.3 * s, -0.25 * s, -0.24 * s, -0.55 * s, -0.04 * s);
  ctx.lineTo(-0.85 * s, -0.2 * s);
  ctx.lineTo(-0.75 * s, 0);
  ctx.lineTo(-0.85 * s, 0.2 * s);
  ctx.lineTo(-0.55 * s, 0.04 * s);
  ctx.bezierCurveTo(-0.25 * s, 0.24 * s, 0.35 * s, 0.3 * s, 0.55 * s, 0);
  ctx.closePath();
  ctx.fillStyle = withAlpha(PALETTE.creature, 0.85 * a);
  ctx.fill();
  ctx.lineWidth = Math.max(1, s / 45);
  ctx.strokeStyle = withAlpha(PALETTE.creatureRim, a);
  ctx.stroke();
  ctx.restore();
}

function drawLeviathan(v: View, r: Reveal, a: number, radius: number): void {
  const { ctx } = v;
  const back = { x: -Math.cos(r.angle), y: -Math.sin(r.angle) };
  const side = { x: -back.y, y: back.x };
  for (let k = 7; k >= 0; k--) {
    const along = k * radius * 0.85;
    const wiggle = Math.sin(k * 0.9 + r.at * 2) * radius * 0.25 * (k / 7);
    const cx = r.x + back.x * along + side.x * wiggle;
    const cy = r.y + back.y * along + side.y * wiggle;
    const rad = radius * (1 - k * 0.09) * v.scale;
    ctx.beginPath();
    ctx.arc(sx(v, cx), sy(v, cy), rad, 0, TAU);
    ctx.fillStyle = withAlpha(PALETTE.creature, 0.8 * a);
    ctx.fill();
    ctx.lineWidth = Math.max(1, v.scale / 35);
    ctx.strokeStyle = withAlpha(PALETTE.creatureRim, 0.9 * a);
    ctx.stroke();
  }
}
