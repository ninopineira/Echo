// Point d'entrée : charge la police, crée les couches et lance l'app (ARCHITECTURE § 2).
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/600.css';
import './ui/base.css';
import { App } from './app/app';
import { readParams } from './app/debug';
import { KeyboardInput } from './input/keyboard';
import { Renderer } from './render/renderer';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game introuvable');

await Promise.all([
  document.fonts.load('400 16px "Chakra Petch"'),
  document.fonts.load('600 16px "Chakra Petch"'),
]);

const app = new App(new Renderer(canvas), new KeyboardInput(window), readParams(location.search));
app.start();
