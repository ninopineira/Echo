// Point d'entrée : charge la police, crée les couches et lance l'app (ARCHITECTURE § 2).
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/600.css';
import './ui/base.css';
import { App } from './app/app';
import { readParams } from './app/debug';
import { createAudioSystem } from './audio/audio';
import { mountSoundboard } from './audio/soundboard';
import { KeyboardInput } from './input/keyboard';
import { Renderer } from './render/renderer';
import { loadSave } from './save/save';
import { createUi } from './ui/ui';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const uiRoot = document.querySelector<HTMLElement>('#ui');
if (!canvas || !uiRoot) throw new Error('Éléments #game ou #ui introuvables');

await Promise.all([
  document.fonts.load('400 16px "Chakra Petch"'),
  document.fonts.load('600 16px "Chakra Petch"'),
]);

const params = readParams(location.search);
const audio = createAudioSystem();
const store = window.localStorage;

if (params.soundboard) {
  // Table d'écoute de développement (?soundboard=1) à la place du jeu.
  mountSoundboard(uiRoot, audio);
} else {
  const app = new App(
    new Renderer(canvas),
    new KeyboardInput(window),
    audio,
    store,
    loadSave(store),
    params,
  );
  app.attachUi((callbacks) => createUi(uiRoot, callbacks));
  app.start();
}
