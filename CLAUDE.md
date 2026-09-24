# ÉCHO — instructions du projet

Jeu 2D d'exploration au sonar : une sonde dans des grottes sous-marines noires, qui ne voit le décor qu'en émettant des impulsions dont le bruit attire des créatures aveugles. TypeScript strict, Vite, Canvas 2D, Web Audio, sans moteur ni fichier image ou son. Site statique pour navigateur de bureau, 60 images par seconde.

## À lire avant de coder

| Document | Contenu | Quand le lire |
|---|---|---|
| `docs/ROADMAP.md` | jalons en tranches verticales, cases à cocher | au début de chaque session : le premier jalon incomplet est le travail en cours |
| `docs/GDD.md` | règles, écrans, direction artistique, fiches des 10 niveaux | toute question de gameplay, d'UI ou de style |
| `docs/ARCHITECTURE.md` | modules, flux de données, contrats de types, outils de dev | avant de créer ou déplacer un module, ou de toucher un contrat |
| `docs/LEVEL_FORMAT.md` | format des niveaux, légende, règles de validation | avant de toucher `src/data/levels/` ou `src/sim/validate/` |
| `docs/DECISIONS.md` | décisions structurantes et choix tranchés | avant de remettre un choix en cause |

Ces documents font référence. Si le code doit s'en écarter, mettre à jour le document dans le même changement, et ajouter une décision numérotée dans `DECISIONS.md` si le choix est structurant.

## Commandes

```
npm install
npm run dev              # http://localhost:5173 — paramètres : ?level=<n|slug> &debug=1 &reveal=1 &god=1 &unlock=1 &seed=<n> &soundboard=1
npm run check            # typecheck + lint + tests + validation des niveaux : doit passer avant de cocher une case
npm run typecheck        # tsc : app (DOM), node (scripts), garde-fou sim/data/save sans DOM
npm run lint             # ESLint typé, 0 avertissement toléré
npm test                 # vitest run ; un fichier : npx vitest run src/sim/systems/pulse.test.ts
npm run validate-levels  # tout le catalogue ; détail : npm run validate-levels -- --verbose <slug>
npm run build            # typecheck puis build statique dans dist/ ; npm run preview pour le servir
npm run format           # Prettier (les .md sont exclus)
```

## Architecture en bref

- `src/sim/` : logique de jeu **pure et déterministe**. `stepWorld(world, input)` fait avancer d'un pas fixe de 1/120 s, mute `world.state` en place et ajoute des `GameEvent`. Pas de DOM, pas d'horloge, pas de `Math.random`, pas de `console`.
- `src/data/` : données sans logique. `tuning.ts` contient **toutes** les valeurs d'équilibrage (`TUNING` global, `LEVELS` par niveau), `palette.ts` les couleurs, `levels/` les niveaux et leur catalogue ordonné.
- `src/render/` (Canvas 2D), `src/audio/` (Web Audio), `src/input/` (clavier), `src/ui/` (écrans DOM), `src/save/` (sauvegarde pure, stockage injecté).
- `src/app/` est la seule couche qui assemble les autres : boucle à pas fixe, flux d'écrans, distribution des événements, outils de debug.
- Flux : `input` → `InputFrame` → `sim` → `events` → `audio` et effets ; `render` lit `world` sans le modifier ; `ui` reçoit un `ScreenModel` et rappelle des `UiCallbacks`.
- Règles d'import par couche : `docs/ARCHITECTURE.md` § 3, imposées par `eslint.config.js` et `tsconfig.sim.json`.

## Conventions

- Identifiants et noms de fichiers en anglais (camelCase, `PascalCase` pour les types). Commentaires et docs en français. Textes d'interface en français, uniquement dans `src/ui/strings.ts`.
- Aucune valeur numérique de gameplay en dur : ajouter la clé dans `TUNING`, avec l'unité en commentaire. La simulation lit `world.tuning`, jamais `TUNING` directement.
- Mixage audio (volumes, portées, filtres) dans `src/audio/mix.ts`. Couleurs uniquement depuis `PALETTE`.
- Imports relatifs, sans alias. `import type` pour les types (`verbatimModuleSyntax`).
- `noUncheckedIndexedAccess` est actif : passer par des accesseurs bornés. L'assertion `!` n'est tolérée que dans une boucle chaude dont les bornes sont prouvées juste au-dessus.
- Tests colocalisés `*.test.ts`, environnement node. Fixtures de niveau en chaînes ASCII inline, fonctions pures privilégiées. Chaque système de `sim/` a ses tests.
- Unions discriminées pour les événements, les créatures et les écrans. `switch` exhaustif avec un `never` de contrôle.
- Pas d'allocation dans les boucles de rendu ou de simulation par pas : réutiliser les tableaux, `Float32Array` pour les rayons.
- Pas de `eslint-disable` sans commentaire qui justifie l'exception.

## Pièges connus

- Pas de `import.meta.glob` dans `src/data/` ni dans ce qu'importe le validateur : il tourne sous Node (tsx). Le catalogue `LEVEL_CATALOG` utilise des imports statiques.
- Grilles : chaque ligne est débarrassée de ses espaces, et `\r\n` doit être accepté (Windows). Les fichiers sont en LF (`.gitattributes`).
- `AudioContext` se crée ou se reprend uniquement après un geste de l'utilisateur (écran « Appuyez sur une touche »). Toute temporisation audio passe par `ctx.currentTime`, jamais par `setTimeout`.
- Texte sur canvas : attendre `document.fonts.load('600 16px "Chakra Petch"')`, sinon la police de secours s'affiche.
- Espace, flèches et Échap : `preventDefault`. Perte de focus : relâcher toutes les touches et mettre en pause. L'Échap qui ouvre la pause ne doit pas refermer l'écran de pause.
- Un appui et un relâchement d'Espace entre deux pas doivent produire une impulsion : les fronts sont mémorisés jusqu'au `sample()` suivant.
- Instantané de point de contrôle : copie profonde écrite à la main (`structuredClone` est interdit dans `sim`). Les statistiques de la tentative ne sont jamais restaurées.
- Aucun dossier interne ne doit porter le nom d'une couche (`render`, `audio`, `ui`…), car les règles ESLint d'import s'appuient sur ces noms.
- Canvas : DPR plafonné à 2. Pas de `shadowBlur` ni de `ctx.filter` : le halo se fait en traits additifs (`glow.ts`).
- TypeScript est épinglé en 6.0.x (typescript-eslint n'accepte pas encore TS 6.1 et plus). Ne pas monter de version sans vérifier `npm view typescript-eslint peerDependencies`.
- Couleurs imposées par le brief (fond, sonar, danger, perle, balise, créature) : ne pas les modifier. Menus : voir les interdits du GDD § 5.
- Shell : Windows. Les scripts npm marchent sous PowerShell comme sous Git Bash. Utiliser des chemins avec `/` dans le code et les scripts.

## Façon de travailler

- Avancer jalon par jalon dans `docs/ROADMAP.md`. Chaque jalon est une tranche verticale jouable : simulation, rendu, audio, niveau, tests. Cocher une case seulement quand le code, ses tests et la doc sont faits.
- Skills du projet (`.claude/skills/`) :
  - `add-mechanic` : ajouter ou modifier une mécanique de bout en bout ;
  - `level-design` : créer ou retoucher un niveau ;
  - `procedural-audio` : ajouter ou régler un son ;
  - `playtest` : lancer le jeu et le vérifier dans un navigateur ;
  - `milestone` : clôturer un jalon ;
  - `frontend-design` : direction visuelle des menus (le GDD § 5 prime).
- Agents (`.claude/agents/`), pour du travail parallèle sur des fichiers disjoints :
  - `level-designer` : un agent par niveau ;
  - `sound-designer` : `src/audio/` ;
  - `ui-screens` : `src/ui/`.
  Le fil principal garde `sim/`, `render/`, `app/` et les contrats (`events.ts`, `ScreenModel`), et relit ce que les agents rapportent.
- L'équilibrage fin est fait par l'auteur en jouant. Proposer des valeurs de départ raisonnables, signaler celles qui sont à ajuster, ne pas les « optimiser » sans playtest.
