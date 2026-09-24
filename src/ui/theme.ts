import { PALETTE } from '../data/palette';

/** Palette → paires (variable CSS, valeur). Clés telles quelles : `--c-sonar`, `--c-textMuted`… */
export function themeVariables(
  palette: Readonly<Record<string, string>> = PALETTE,
): [name: string, value: string][] {
  return Object.entries(palette).map(([key, value]) => [`--c-${key}`, value]);
}

/** Pose les couleurs de src/data/palette.ts en variables CSS `--c-<clé>` sur la racine de l'UI. */
export function applyTheme(root: HTMLElement): void {
  for (const [name, value] of themeVariables()) root.style.setProperty(name, value);
}
