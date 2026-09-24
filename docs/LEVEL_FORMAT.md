# Format des niveaux

Contrat de données entre le level design et la simulation. Code associé : `src/data/levels/define.ts` (types et légende), `src/sim/level/` (analyse et compilation), `src/sim/validate/` (règles ci-dessous).

## 1. Fichiers

- Un niveau = un module `src/data/levels/NN-slug.ts` (`NN` = position à deux chiffres, pour le tri des fichiers seulement).
- Le module exporte par défaut `defineLevel({ id, name, hint, grid })`.
- L'ordre de jeu est celui de `LEVEL_CATALOG` dans `src/data/levels/index.ts`, avec des **imports statiques** : pas de `import.meta.glob`, car le validateur tourne sous Node.
- Les nombres du niveau (par, intervalle de balise, surcharges d'équilibrage) sont dans `LEVELS[id]` de `src/data/tuning.ts`, pas dans le module du niveau.

| Champ | Règle |
|---|---|
| `id` | slug `^[a-z0-9]+(-[a-z0-9]+)*$`, unique. Clé de sauvegarde : ne plus le changer une fois le niveau joué. |
| `name` | nom affiché, en français. |
| `hint` | consigne d'une phrase affichée au début du niveau, ou `''`. |
| `grid` | grille ASCII (§ 2). |

## 2. Grille

- Une ligne de texte = une rangée, un caractère = une case.
- Chaque ligne est débarrassée de ses espaces de début et de fin : on peut indenter la grille dans le template literal. Les lignes vides au début et à la fin sont ignorées, une ligne vide au milieu est une erreur. `\r\n` est accepté.
- La grille est rectangulaire et son pourtour est entièrement en roche `#`.
- Coordonnées : `x` = colonne, `y` = rangée, origine en haut à gauche. Une case mesure 1 × 1 unité monde, et son centre est `(x + 0,5 ; y + 0,5)`.
- Taille conseillée : jusqu'à 140 × 70 (avertissement au-delà de 160 × 100).

## 3. Légende

| Car. | Élément | Notes |
|---|---|---|
| `#` | roche | bloque la sonde, les rayons, le son et les créatures |
| `.` | eau | |
| `S` | départ de la sonde | exactement 1 |
| `X` | balise de sortie | exactement 1 |
| `o` | perle | au moins 1 par niveau, jamais dans la vase |
| `*` | oursin | occupe sa case (infranchissable pour le calcul d'atteignabilité) |
| `~` | vase | eau lente, absorbe rayons et son |
| `^` `>` `v` `<` | courant (haut, droite, bas, gauche) | une case = une poussée dans la direction indiquée |
| `+` | capsule de leurre | |
| `P` | point de contrôle | |
| `G` | Guetteur (point d'apparition) | case d'eau |
| `L` | Léviathan (point d'apparition) | au plus 1 |
| `a`–`f` | levier | ouvre les portes de la même lettre en majuscule, un seul levier par lettre |
| `A`–`F` | case de porte | plusieurs cases possibles par lettre, même non contiguës |

Les cases occupées par un objet (`S`, `X`, `o`, `+`, `P`, `G`, `L`, leviers) sont de l'eau libre. Un objet ne peut pas être posé sur une case de courant ou de vase. Si ce besoin apparaît, on l'ajoute au format (et à `docs/DECISIONS.md`) plutôt que de détourner un caractère.

Un caractère non listé est une erreur. Tous les caractères sont reconnus dès M0, même si la mécanique correspondante n'est pas encore simulée : l'élément reste alors inerte, ce qui permet d'ébaucher les niveaux en avance.

## 4. Géométrie dérivée

La compilation (`src/sim/level/compile.ts`) produit les segments de paroi par **marching squares** sur les centres de cases, où la roche vaut 1 et tout le reste 0 (cases hors grille comptées comme roche). Conséquences pour le dessin des niveaux :

- Une paroi droite suit exactement la frontière entre les cases. Un couloir de N cases fait N unités de large.
- Les coins sont coupés à 45°. Une case de roche isolée devient un pilier en losange.
- Deux cases d'eau qui ne se touchent que par un coin **ne communiquent pas** : les cas ambigus sont résolus du côté de la roche.
- Les portes ne font pas partie du contour de roche. Chaque porte est un rectangle aligné sur ses cases, actif tant qu'elle est fermée.
- La vase n'a pas de géométrie : c'est un masque de cases.

La même géométrie sert à la collision, aux rayons et au rendu.

## 5. Valeurs par niveau (`LEVELS` dans `tuning.ts`)

```ts
'premier-echo': { par: 10, beaconInterval: 2 },
'le-guetteur': { par: 10, beaconInterval: 4, overrides: { guetteur: { hearingRadius: 8 } } },
```

`par` (≥ 1) et `beaconInterval` (> 0) sont obligatoires. `overrides` est une surcharge partielle et profonde de `TUNING`, fusionnée au chargement du niveau.

## 6. Validation

`npm run validate-levels` valide tout le catalogue et sort en code 1 s'il y a au moins une erreur. `npm run validate-levels -- --verbose <slug>` affiche en plus la grille avec le plus court chemin tracé, les distances et les suggestions. La même validation s'exécute dans `npm test` (`src/sim/levels.test.ts`).

**Modèle d'atteignabilité** : parcours en 4-connexité sur les cases qui ne sont ni roche, ni oursin, ni porte fermée.

- Portes : point fixe. On part portes fermées, chaque levier atteint ouvre ses portes, et on recommence jusqu'à stabilité.
- Courants : si `current.strength ≥ probe.thrust` (après surcharges), on ne peut ni entrer dans une case de courant ni en sortir en allant à contre-sens. Sinon, les courants sont franchissables dans tous les sens.
- Vase : franchissable.

**Erreurs** (bloquantes) :

| Code | Règle |
|---|---|
| E01 | grille vide, non rectangulaire ou avec une ligne vide interne (le message indique la ligne et la largeur attendue) |
| E02 | caractère inconnu (ligne, colonne) |
| E03 | pourtour qui n'est pas entièrement en `#` |
| E04 | pas exactement un `S` ou pas exactement un `X`, ou plus d'un `L` |
| E05 | `id` invalide ou dupliqué dans le catalogue |
| E06 | entrée `LEVELS` manquante ou orpheline, `par < 1`, `beaconInterval ≤ 0` |
| E07 | balise inatteignable depuis le départ |
| E08 | perle, capsule, levier ou point de contrôle inatteignable |
| E09 | levier sans porte, porte sans levier, ou plus d'un levier pour une même lettre |
| E10 | porte jamais ouvrable (son levier reste inatteignable au point fixe) |
| E11 | niveau sans perle, ou perle dans la vase |
| E12 | Guetteur trop proche : distance de chemin à `S` ou à un `P` inférieure à `hearingRadius + 3` (il entendrait une impulsion courte émise au départ ou à la reprise) |
| E13 | Léviathan à moins de 20 cases de chemin du départ |

**Avertissements** (non bloquants, à lire) :

| Code | Règle |
|---|---|
| W01 | grille plus grande que 160 × 100 |
| W02 | poches d'eau inaccessibles, sans rien dedans (souvent un oubli) |
| W03 | capsules de leurre sans aucun Guetteur ni Léviathan |
| W04 | par hors de l'intervalle [0,5 ; 2] × suggestion |
| W05 | couloir d'une case dans un territoire de Guetteur (à moins de `wanderRadius` de son apparition) |
| W06 | élément utilisé avant son niveau d'introduction (oursin 3, courant 4, Guetteur 5, leurre 6, levier/porte/point de contrôle 7, vase 8, Léviathan 10) |

**Suggestion de par** : `ceil(L / (0,6 × pulse.short.radius))`, où `L` est la longueur du plus court chemin sûr de `S` à `X` au point fixe. C'est seulement un point de départ, à ajuster en jouant.

## 7. Exemple complet

Niveau valide, avec un avertissement attendu : W03 (capsule sans créature). Il sert aussi de fixture de test pour l'analyse et la validation.

```ts
import { defineLevel } from './define';

export default defineLevel({
  id: 'exemple',
  name: 'Exemple',
  hint: 'Le levier ouvre la vanne de la salle est.',
  grid: `
    ##############################
    #S........#.......#..........#
    #.........#...o...#...~~~~...#
    #...*.....#.......A...~~~~...#
    #.........>>>>>>>>A...~~~~.X.#
    #....a....#....P..#..........#
    ####.#######...*..#..........#
    #o.....+......#...#..........#
    ##############################
  `,
});
```

Lecture : on part de `S` dans la salle ouest. Le courant de la rangée 4 traverse la paroi vers la salle centrale, et un passage au sud mène au couloir (perle, capsule). Le levier `a` ouvre la porte `A` (deux cases), seul accès à la salle est, avec sa mare de vase et la balise `X`.
