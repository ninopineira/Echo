# ÉCHO — décisions

Une ligne de décision, une ligne de justification. On ajoute les nouvelles décisions à la suite, avec le numéro suivant. Une décision qu'on remplace est barrée et renvoie à celle qui la remplace, elle n'est jamais supprimée.

## Structurantes

| # | Décision | Justification |
|---|---|---|
| D01 | TypeScript épinglé en `~6.0.3` | typescript-eslint 8.x exige `typescript < 6.1`, et TS 7 casserait le lint typé. |
| D02 | Vite 8, Vitest 5, ESM, `base: './'` | Build statique qui se sert depuis n'importe quel sous-dossier (itch.io, Pages). |
| D03 | Canvas 2D pour le jeu, DOM et CSS pour les menus, sans framework d'UI | Texte, focus et navigation clavier sont natifs en DOM, et six écrans ne justifient pas un framework. |
| D04 | HUD dessiné sur le canvas | Synchronisé avec la frame et le halo, sans mutation du DOM à chaque image. |
| D05 | Couches `sim` / `render` / `audio` / `input` / `ui` / `save` / `data`, seul `app` orchestre | Logique pure et testable sans navigateur, couches remplaçables et agents parallélisables. |
| D06 | Couches imposées par ESLint (imports, globales) et par `tsconfig.sim.json` sans DOM | Une règle qui n'est pas vérifiée automatiquement finit par être violée. |
| D07 | Pas fixe de 1/120 s, accumulateur plafonné à 8 pas, rendu interpolé | Collisions stables, timing d'entrée fin, fluidité sur écrans à 60 comme à 144 Hz. |
| D08 | Simulation déterministe : RNG à graine dans l'état, ni `Math.random` ni horloge | Tests reproductibles et bugs rejouables. |
| D09 | `World` = niveau compilé immuable + `WorldState` en données simples mutées en place | Instantanés triviaux pour les points de contrôle, et aucune allocation par pas. |
| D10 | Unités monde = cases de la grille, durées en secondes | L'équilibrage se lit directement (« rayon 7 cases »). |
| D11 | Niveau = module TS `defineLevel({ id, name, hint, grid })` avec une grille ASCII en template literal | Typé, commentable, lisible par Vite, Vitest et Node sans parseur de métadonnées. |
| D12 | Légende figée (LEVEL_FORMAT § 3) : symboles pour les éléments, `a`–`f` / `A`–`F` pour les leviers et portes | Lisible à l'œil, et la lettre relie le levier à sa porte sans coordonnées. |
| D13 | Tous les nombres dans `src/data/tuning.ts` : `TUNING` global + `LEVELS` par niveau (par, balise, surcharges) | Un seul fichier à ouvrir pour équilibrer, comme demandé. |
| D14 | Catalogue des niveaux en imports statiques (pas d'`import.meta.glob`) | Le validateur s'exécute sous Node avec tsx. |
| D15 | Parois = contour par marching squares de la grille ; la même géométrie sert à la collision, aux rayons et au rendu | Aspect de grotte (coins à 45°), glissement fluide, une seule source de vérité. |
| D16 | Impulsion = lancer de 720 rayons par DDA à l'émission, front animé rayon par rayon | Ligne de vue exacte, coût ponctuel, résultat testable. |
| D17 | Échos calculés par la simulation (1 par secteur sur 16, plus les objets), planifiés par l'audio sur l'horloge Web Audio | Information testable, timing précis indépendant de la fréquence d'images. |
| D18 | Propagation du son par distance de chemin (Dijkstra), vase plus coûteuse, portes fermées bloquantes | Pas d'écoute à travers la roche, et le même champ guide les créatures. |
| D19 | Objets mobiles révélés en image rémanente figée à l'endroit touché | Traduit « voir, c'est être entendu » : on voit où la créature était. |
| D20 | Point de contrôle = instantané de l'état ; statistiques jamais restaurées | Implémentation simple, et mourir ne rembourse pas les impulsions. |
| D21 | Sauvegarde `localStorage` versionnée, indexée par slug, module pur avec stockage injecté | Testable sans navigateur, robuste à un réordonnancement des niveaux. |
| D22 | Entrées par `KeyboardEvent.code` | ZQSD et WASD sont la même touche physique, sans détection de disposition. |
| D23 | Police Chakra Petch via `@fontsource/chakra-petch`, bundlée par Vite | Locale, sans CDN, licence OFL. |
| D24 | Halo par traits superposés en mode additif, sans `shadowBlur` ni `ctx.filter` | Performance prévisible sur tous les navigateurs de bureau. |
| D25 | Palette unique dans `src/data/palette.ts`, injectée en variables CSS pour l'UI | Une seule source de couleurs pour le canvas et le DOM. |
| D26 | Mixage audio dans `src/audio/mix.ts`, hors de `tuning.ts` | Le son n'est pas de l'équilibrage de jeu, et l'agent son n'entre pas en conflit avec le reste. |
| D27 | Tests colocalisés `*.test.ts` en environnement node | Un test qui réclame le DOM signale une fuite de couche. |
| D28 | Imports relatifs, sans alias de chemin | Fonctionne tel quel avec Vite, Vitest et tsx. |
| D29 | `noUncheckedIndexedAccess` activé ; assertion `!` tolérée seulement dans les boucles chaudes à bornes prouvées | Sûreté sur les grilles sans pénaliser les boucles de rayons. |
| D30 | Docs et commentaires en français, identifiants en anglais, textes d'UI centralisés dans `ui/strings.ts` | L'auteur maintient en français, et le code reste idiomatique. |
| D31 | Fins de ligne LF imposées (`.gitattributes`, `.editorconfig`), parseur tolérant au `\r\n` | Les grilles sont analysées ligne à ligne sous Windows. |
| D32 | Skill `frontend-design` (Anthropic) installé au niveau du projet ; `game-audio` (skills.sh) écarté | Le premier colle aux interdits du brief pour les menus ; le second suppose JavaScript, un EventBus et Phaser. |
| D33 | Horloge (`time`, `tick`, `nextId`) portée par `World`, jamais restaurée ; minuteries de l'état en comptes à rebours | Une reprise au point de contrôle ne fait pas reculer le temps, et les identifiants d'impulsion restent uniques pour les caches de rendu. |
| D34 | `STEP` défini dans `sim/step-constants.ts` et réexporté par `sim/step.ts` | Évite l'import circulaire entre `step.ts` et les systèmes. |
| D35 | Type `InputFrame` dans `sim/inputFrame.ts` (et non `sim/input.ts`) | Un fichier nommé comme une couche serait rejeté par la règle d'import ESLint. |
| D36 | `LEVELS` ne contient que les niveaux du catalogue ; les valeurs prévues des autres restent en commentaire jusqu'à leur création | Une entrée sans niveau est une erreur E06 du validateur. |
| D37 | Libellés du HUD dans `render/hud.ts`, textes des écrans dans `ui/strings.ts`, libellés de la table d'écoute dans `audio/soundboard.ts` | Les couches `render` et `audio` n'ont pas le droit d'importer `ui/` ; chaque couche garde ses propres textes. |
| D38 | Champs de distance calculés en double précision puis rendus en `Float32Array` | Un arrondi float32 faisait passer des entrées du tas de Dijkstra pour périmées et arrêtait l'exploration. |
| D39 | Test de franchissabilité par pilote automatique (`sim/autopilot.ts`) sur chaque niveau du catalogue, en mode sans dégât | Le validateur raisonne sur la grille ; le pilote vérifie avec la vraie physique (coins, courants, portes). |
| D40 | Écho panoramique selon la direction (`cos(angle) × 0,85`), la distance portée par le délai, le volume, la brillance et la réverbération | Une paroi proche à droite doit sonner aussi à droite qu'une paroi lointaine (choix de l'agent son, validé). |
| D41 | Volume maître en courbe au carré | Réglage perçu plus régulier sur la jauge. |
| D42 | `LevelRecord.bestPearls` ajouté à la sauvegarde v1 (champ absent lu comme `null`) | L'écran de victoire affiche le total de perles ; le chargement tolérant rend l'ajout rétrocompatible. |
| D43 | Reprise au point de contrôle au centre du point, à l'arrêt | L'instantané pris au contact plaçait la sonde là où elle avait frôlé le point. |
| D44 | Écran de fin : clavier armé après 400 ms, ouverture 1,1 s après la balise | Un Espace tapoté en touchant la balise ne saute pas l'écran, et l'éclat de la balise a le temps d'être vu. |
| D45 | Rappel des touches de nage (lettres réelles de la disposition) sous la consigne du premier niveau | Le GDD demande d'afficher les lettres réelles ; c'est le seul niveau où les contrôles doivent être rappelés. |
| D46 | Un champ de distance peut partir d'une case bloquée : il se propage alors depuis ses voisines | Le grondement d'une porte part de ses cases encore fermées ; sinon aucune créature ne l'entendait. |
| D47 | `nextWaypoint` applique la règle des diagonales de Dijkstra et repart de la meilleure voisine si la créature mord sur une case bloquée | Le Léviathan, sans collision, coupait un angle, entrait d'un cheveu dans la roche et restait figé. |
| D48 | Le par suit la longueur du niveau (bornes W04), même avec l'énergie : 20 aux Vannes, 26 à Batterie faible, 21 au Léviathan | Les niveaux 7 à 10 sont deux à trois fois plus longs que les premiers ; un par de 12 à 16 y serait sous le seuil de W04. |

## Choix de conception tranchés

| # | Décision | Justification |
|---|---|---|
| C01 | Deux perles sur le chemin du niveau 1, et au moins une perle par niveau | L'étoile des perles n'est jamais automatique, et le niveau 1 montre que l'impulsion révèle les objets. |
| C02 | Niveau 6 : « deux » est lu comme deux Guetteurs, avec trois capsules de leurre | « les Guetteurs » au pluriel suit le niveau 5 qui n'en a qu'un ; une capsule de réserve évite le blocage. |
| C03 | Impulsion : relâcher avant 0,9 s donne une courte ; à 0,9 s la longue part seule | Pas d'attente au relâchement et pas d'état ambigu. |
| C04 | Recharge commune, dont la durée dépend du type de la dernière impulsion | Empêche d'enchaîner une courte juste après une longue pour contourner la recharge. |
| C05 | Les impulsions courtes et longues comptent chacune 1 pour le par | La longue est rentable pour le par, et son vrai coût est le bruit. |
| C06 | Les étoiles se cumulent entre tentatives, par critère | Plus accueillant : on peut viser une étoile à la fois. |
| C07 | La balise est visible à travers les parois, avec un repère en bord d'écran quand elle est hors champ | C'est le seul repère gratuit, et il ne révèle aucun décor. |
| C08 | Un choc contre une paroi révèle un petit arc de paroi (1,2 case, 1 s) | Toucher, c'est percevoir : utile dans le noir, et payé par le bruit du choc. |
| C09 | Guetteur : cible l'origine du bruit, pas la sonde ; cliquetis audibles de près ; grognement d'alerte | Le jeu devient « émettre puis se déplacer », et le son informe du danger. |
| C10 | Léviathan : suit toujours la sonde, entend toutes les impulsions (élan), contact fatal, replacé à 14 cases à la reprise | C'est une course, avec une reprise juste. |
| C11 | Leviers au contact, ouverture définitive, porte bruyante | Cause et effet lisibles, et l'ouverture devient une décision tactique. |
| C12 | Leurres : ne révèlent rien, pings visibles à travers les parois, dérivent dans les courants | Outil contre les créatures, pas un sonar gratuit. |
| C13 | Émettre depuis la vase : tout est absorbé, mais le bruit part | Cohérent avec la vase qui étouffe, et une leçon claire. |
| C14 | Énergie active aux niveaux 9 et 10 ; HUD « Leurres » seulement dans les niveaux qui ont des capsules | Le HUD reste minimal, et l'information apparaît quand elle sert. |
| C15 | La pause masque le terrain | Empêche d'étudier la rémanence à l'arrêt. |
| C16 | Rémanence allongée = × 1,75 sur toutes les rémanences | Aide réelle sans vider la tension. |
| C17 | Pas de courant infranchissable dans les niveaux prévus, mais la règle existe (validateur, `current.strength ≥ probe.thrust`) | Remonter lentement suffit à enseigner la dérive ; la règle reste disponible. |
