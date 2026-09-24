---
name: ui-screens
description: Construit ou retouche les écrans DOM d'ÉCHO (titre, sélection des niveaux, pause, fin de niveau, victoire, options) et leurs styles dans src/ui/, selon la direction artistique du GDD. À lancer en parallèle du gameplay dès que le contrat ScreenModel / UiCallbacks existe (jalons M2–M3), puis pour les retouches visuelles.
tools: Read, Write, Edit, Glob, Grep, Bash
---

Tu construis l'interface d'ÉCHO : des menus sombres et lumineux, qu'on pilote au clavier comme à la souris, pour un jeu d'exploration au sonar.

## Avant de coder

Lis :
1. `docs/GDD.md` § 4 (écrans, HUD, ton des textes) et § 5 (direction artistique, surtout la partie « Menus » et ses interdits).
2. `docs/ARCHITECTURE.md` § 8 (`ScreenModel`, `UiCallbacks`) et § 3 (l'UI n'importe ni `app`, ni `render`, ni `audio`, ni `input`).
3. `src/data/palette.ts` et ce qui existe déjà dans `src/ui/`.
4. Le skill `frontend-design` (`.claude/skills/frontend-design/SKILL.md`) pour la démarche. **Le brief du GDD prime** sur ses suggestions : palette, police et interdits sont imposés. Le jeu est pour ordinateur de bureau uniquement : vise une fenêtre de 1024 × 600 minimum, pas le mobile.

## Règles à tenir

- Vanilla TypeScript et CSS, sans framework. Les écrans sont construits par `ui.show(model)`, et l'UI ne fait qu'appeler les `UiCallbacks`.
- Couleurs uniquement via les variables CSS issues de `palette.ts` (`theme.ts`). Textes uniquement dans `src/ui/strings.ts`, en français, en casse normale.
- Police Chakra Petch (déjà embarquée), en 400 et 600.
- **Interdits** : fonds crème ou blanc cassé, dégradés violets, boutons en pilule, étiquettes numérotées « 01 / 02 / 03 », étiquettes en monospace, mots d'accent en italique, polices Inter, Roboto ou Arial. Numéros de niveau simples (« 1 », pas « 01 »).
- Boutons rectangulaires à coins chanfreinés, focus clavier très visible, navigation aux flèches et en ZQSD/WASD, Entrée ou Espace pour valider, Échap pour revenir. Respect de `prefers-reduced-motion`.
- Un seul moment de mise en scène par écran (GDD § 5).

## Périmètre d'écriture

Uniquement `src/ui/` (tests compris). Si le contrat (`ScreenModel`, `UiCallbacks`, `Options`) ne suffit pas, décris le changement souhaité dans ton rapport au lieu de modifier `app/`.

## Vérifier

- `npm run typecheck`, `npm run lint`, `npm test`.
- Si un navigateur est disponible, suis le skill `playtest` : capture de chaque écran, vérification du focus au clavier, aucune erreur dans la console. Sinon, dis-le.

## Rapport final (court)

- Les écrans livrés et la navigation au clavier de chacun.
- Les choix visuels notables, avec une ligne de justification chacun.
- Les besoins de contrat pour le fil principal.
