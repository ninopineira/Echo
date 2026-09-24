import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Règles de couches (docs/ARCHITECTURE.md § Dépendances).
 * Chaque entrée : dossiers ciblés sous src/ → couches qu'ils n'ont pas le droit d'importer.
 * Seuls src/app/ et src/main.ts peuvent tout importer.
 */
const LAYER_RULES = {
  data: ['sim', 'save', 'app', 'render', 'audio', 'input', 'ui'],
  sim: ['save', 'app', 'render', 'audio', 'input', 'ui'],
  save: ['app', 'render', 'audio', 'input', 'ui'],
  render: ['save', 'app', 'audio', 'input', 'ui'],
  audio: ['save', 'app', 'render', 'input', 'ui'],
  input: ['save', 'app', 'render', 'audio', 'ui'],
  ui: ['app', 'render', 'audio', 'input'],
};

const layerConfigs = Object.entries(LAYER_RULES).map(([layer, forbidden]) => ({
  files: [`src/${layer}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: `(^|/)(${forbidden.join('|')})(/|$)`,
            message: `La couche « ${layer} » ne doit pas dépendre de : ${forbidden.join(', ')}.`,
          },
        ],
      },
    ],
  },
}));

/** Code pur : ni navigateur, ni horloge, ni hasard non reproductible. */
const pureConfig = {
  files: ['src/sim/**/*.ts', 'src/data/**/*.ts', 'src/save/**/*.ts'],
  rules: {
    'no-console': 'error',
    'no-restricted-globals': [
      'error',
      ...[
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'performance',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'setTimeout',
        'setInterval',
        'AudioContext',
        'fetch',
        'structuredClone',
      ].map((name) => ({ name, message: 'Interdit dans le code pur (sim/data/save).' })),
    ],
    'no-restricted-properties': [
      'error',
      { object: 'Math', property: 'random', message: 'Utiliser le RNG à graine de la simulation.' },
      { object: 'Date', property: 'now', message: 'Utiliser le temps de simulation.' },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: "NewExpression[callee.name='Date']",
        message: 'Utiliser le temps de simulation.',
      },
    ],
  },
};

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'node_modules/', '.claude/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Toléré dans les boucles chaudes dont les bornes sont prouvées (voir CLAUDE.md).
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  { files: ['src/**/*.ts'], languageOptions: { globals: globals.browser } },
  {
    files: ['scripts/**/*.ts', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  ...layerConfigs,
  pureConfig,
);
