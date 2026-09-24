import { PALETTE } from '../data/palette';
import type { HudModel } from '../sim/views';
import type { World } from '../sim/world';
import { withAlpha } from './color';

/** Libellés du HUD (le HUD est dessiné sur le canvas, ARCHITECTURE § 5). */
const LABELS = {
  pulses: 'Impulsions',
  pearls: 'Perles',
  lures: 'Leurres',
  energy: 'Énergie',
  hull: 'Coque',
  controls: (keys: string): string => `Nager : ${keys} ou flèches`,
};

/** HUD minimal (GDD § 4) : coque, impulsions / par, perles, leurres, énergie, nom et consigne. */
export function drawHud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hud: HudModel,
  world: World,
  energyDeniedAge: number,
  /** Touches de nage à rappeler sous la consigne (premier niveau), ou null. */
  controlsKeys: string | null,
): void {
  const k = Math.min(1.5, Math.max(0.8, h / 720));
  const font = (weight: number, size: number): string =>
    `${weight} ${Math.round(size * k)}px "Chakra Petch", system-ui, sans-serif`;
  const pad = 22 * k;
  ctx.save();
  ctx.textBaseline = 'top';

  // Coque : segments en parallélogramme.
  ctx.font = font(400, 13);
  ctx.fillStyle = withAlpha(PALETTE.textMuted, 0.9);
  ctx.textAlign = 'left';
  ctx.fillText(LABELS.hull, pad, pad);
  const segW = 26 * k;
  const segH = 9 * k;
  const top = pad + 20 * k;
  for (let i = 0; i < hud.hullMax; i++) {
    const x = pad + i * (segW + 7 * k);
    ctx.beginPath();
    ctx.moveTo(x + 4 * k, top);
    ctx.lineTo(x + segW + 4 * k, top);
    ctx.lineTo(x + segW, top + segH);
    ctx.lineTo(x, top + segH);
    ctx.closePath();
    if (i < hud.hull) {
      ctx.fillStyle = withAlpha(PALETTE.sonar, 0.8);
      ctx.fill();
    } else {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = withAlpha(PALETTE.hazard, 0.85);
      ctx.stroke();
    }
  }

  // Compteurs à droite.
  ctx.textAlign = 'right';
  const rows: { label: string; value: string; color: string }[] = [
    {
      label: LABELS.pulses,
      value: `${hud.pulses} / ${hud.par}`,
      color: hud.pulses > hud.par ? PALETTE.hazard : PALETTE.text,
    },
    { label: LABELS.pearls, value: `${hud.pearls} / ${hud.pearlsTotal}`, color: PALETTE.pearl },
  ];
  if (hud.lures !== null) rows.push({ label: LABELS.lures, value: `${hud.lures}`, color: PALETTE.pearl });
  rows.forEach((row, i) => {
    const y = pad + i * 26 * k;
    ctx.font = font(600, 17);
    ctx.fillStyle = withAlpha(row.color, 0.92);
    const valueW = ctx.measureText(row.value).width;
    ctx.fillText(row.value, w - pad, y);
    ctx.font = font(400, 13);
    ctx.fillStyle = withAlpha(PALETTE.textMuted, 0.95);
    ctx.fillText(row.label, w - pad - valueW - 10 * k, y + 3 * k);
  });

  // Énergie (niveaux 9 et 10).
  if (hud.energy) {
    const barW = 170 * k;
    const barH = 8 * k;
    const x = pad;
    const y = h - pad - barH;
    const denied = energyDeniedAge >= 0 && energyDeniedAge < 0.6 && Math.floor(energyDeniedAge * 10) % 2 === 0;
    ctx.textAlign = 'left';
    ctx.font = font(400, 13);
    ctx.fillStyle = withAlpha(PALETTE.textMuted, 0.95);
    ctx.fillText(LABELS.energy, x, y - 20 * k);
    ctx.fillStyle = withAlpha(PALETTE.line, 1);
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = withAlpha(denied ? PALETTE.hazard : PALETTE.sonar, 0.85);
    ctx.fillRect(x, y, barW * Math.max(0, Math.min(1, hud.energy.value / hud.energy.max)), barH);
  }

  // Nom et consigne en début de niveau.
  const t = world.time;
  const intro = t < 0.4 ? 0 : t < 0.9 ? (t - 0.4) / 0.5 : t < 4 ? 1 : Math.max(0, 1 - (t - 4) / 1);
  if (intro > 0) {
    ctx.textAlign = 'center';
    ctx.font = font(600, 30);
    ctx.fillStyle = withAlpha(PALETTE.sonar, 0.95 * intro);
    ctx.fillText(world.level.name, w / 2, h * 0.7);
    if (world.level.hint !== '') {
      ctx.font = font(400, 18);
      ctx.fillStyle = withAlpha(PALETTE.text, 0.9 * intro);
      ctx.fillText(world.level.hint, w / 2, h * 0.7 + 42 * k);
    }
    if (controlsKeys !== null) {
      ctx.font = font(400, 16);
      ctx.fillStyle = withAlpha(PALETTE.textMuted, 0.95 * intro);
      ctx.fillText(LABELS.controls(controlsKeys), w / 2, h * 0.7 + 74 * k);
    }
  }
  ctx.restore();
}
