// Point d'entrée — squelette provisoire.
// Le câblage réel (app/, sim/, render/, audio/, input/, ui/) est décrit dans docs/ARCHITECTURE.md
// et remplace ce fichier au jalon M0 de docs/ROADMAP.md.
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/600.css';
import './ui/base.css';
import { PALETTE } from './data/palette';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const ctx = canvas?.getContext('2d');
if (!canvas || !ctx) throw new Error('Canvas 2D indisponible');

const drawPlaceholder = (): void => {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = PALETTE.sonar;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 64px "Chakra Petch"';
  ctx.fillText('ÉCHO', window.innerWidth / 2, window.innerHeight / 2);
};

await document.fonts.load('600 64px "Chakra Petch"');
drawPlaceholder();
window.addEventListener('resize', drawPlaceholder);
