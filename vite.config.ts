import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Chemins relatifs : le build se sert depuis n'importe quel sous-dossier (itch.io, GitHub Pages…).
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
  test: {
    // Environnement node volontaire : un test qui a besoin du DOM signale une fuite de couche.
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    passWithNoTests: true,
  },
});
