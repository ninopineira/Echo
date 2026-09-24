# ÉCHO — architecture technique

Stack : TypeScript strict (6.0.x), Vite 8, Vitest 5, Canvas 2D, Web Audio, DOM et CSS pour les menus. Pas de moteur, pas de framework d'UI, pas de fichier image ni son. Les règles de jeu sont dans `docs/GDD.md`, le format des niveaux dans `docs/LEVEL_FORMAT.md`.

## 1. Vue d'ensemble

```
               ┌──────────────── app/ (seul orchestrateur) ─────────────────┐
 clavier ─► input/ ─InputFrame─► loop (pas fixe 1/120 s) ─► sim.stepWorld(world, input)
               │                        │                          │
               │                        │           world.state (données simples, mutées en place)
               │                        │           world.events[] (accumulés pendant la frame)
               │                        ▼                          │
               │      render.frame(world, alpha, view) ◄───────────┤ lecture seule
               │      audio.director.handle(events) ◄──────────────┤ événements
               │      audio.director.update(ambientModel(world)) ◄─┘ état continu dérivé
               │
               └─ flow (écrans) ─ScreenModel─► ui/ (DOM) ─UiCallbacks─► app ─► save/ ─► localStorage
```

**Une frame**, pilotée par `requestAnimationFrame` dans `app/session.ts` :

1. `advance(acc, dt)` (pur) donne le nombre de pas de simulation à exécuter et le facteur d'interpolation `alpha`.
2. Pour chaque pas : `input.sample()` renvoie un `InputFrame`, puis `stepWorld(world, frame)` fait avancer la simulation de 1/120 s et ajoute ses événements à `world.events`.
3. Les événements de la frame sont distribués à l'audio (`director.handle`), aux effets de rendu (tremblement, flash) et à l'app (fin de niveau, mort), puis `world.events` est vidé.
4. `director.update(ambientModel(world))` met à jour les sons continus : drone du Léviathan, souffle du courant, alarme de coque.
5. `renderer.frame(world, alpha)` dessine la scène, le HUD et l'overlay de debug.

## 2. Arborescence

```
src/
  main.ts                 amorçage : crée canvas, UI, entrées, audio, sauvegarde, App ; charge la police
  app/                    orchestration — seule couche qui connaît toutes les autres
    app.ts                contrôleur : écrans, session, options, sauvegarde
    flow.ts               machine d'états des écrans (pure, testée)
    session.ts            GameSession : World + boucle rAF + distribution des événements
    loop.ts               accumulateur à pas fixe (pur, testé)
    debug.ts              paramètres d'URL, touches F1–F4, window.__echo, HMR de tuning et niveaux
  sim/                    logique de jeu pure : ni DOM, ni horloge, ni hasard externe
    math/vec.ts, math/geom.ts   vecteurs, segments, intersections rayon/segment et cercle/segment
    rng.ts                RNG à graine (mulberry32), état stocké dans WorldState
    tuning.ts             mergeTuning(TUNING, overrides) → Tuning
    inputFrame.ts         type InputFrame (produit par input/, consommé ici)
    events.ts             union GameEvent (contrat pour audio/, render/, app/)
    level/parse.ts        LevelSource → ParsedLevel | ParseError[]
    level/contour.ts      marching squares → segments de roche
    level/compile.ts      ParsedLevel → CompiledLevel (segments, index spatial, portes, masques)
    world.ts              types World/WorldState, createWorld, snapshot/restore
    step.ts               stepWorld : appelle les systèmes dans l'ordre (§ 4.2)
    nav.ts                champs de distance (Dijkstra sur grille) avec cache
    systems/              probe, pulse, echoes, noise, pickups, doors, lures, hazards,
                          currents, energy, beacon, guetteur, leviathan, lifecycle
    scoring.ts            étoiles et RunResult
    views.ts              hudModel(world), ambientModel(world) : vues dérivées pures
    validate/             règles de validation des niveaux (LEVEL_FORMAT § 6), rapport texte
  data/                   données pures, ne dépendent de rien
    tuning.ts             TOUTES les valeurs d'équilibrage + LEVELS (par niveau)
    palette.ts            couleurs
    levels/define.ts      LevelSource, defineLevel, LEGEND
    levels/index.ts       LEVEL_CATALOG ordonné (imports statiques)
    levels/NN-slug.ts     un fichier par niveau
  render/                 Canvas 2D, lit le monde sans jamais le modifier
    renderer.ts           canvas, DPR, redimensionnement, ordre des calques
    camera.ts             suivi amorti, tremblement, monde ↔ écran
    afterglow.ts          courbes d'éclat et d'effacement (pur, testé)
    glow.ts               tracés lumineux par lots (3 passes additives)
    layers/               walls, ring, entities, beacon, probe, effects
    hud.ts                HUD à partir de HudModel
    debug.ts              overlay F1
  audio/                  Web Audio, réagit aux événements
    engine.ts             AudioContext, déblocage, bus, limiteur, réverbération générée
    mix.ts                constantes de mixage (volumes, portées, filtres) — hors tuning.ts
    spatial.ts            pan / gain / brillance selon la position (pur, testé)
    director.ts           GameEvent → sons ; AmbientModel → sons continus ; limite de voix
    sfx/                  recettes de synthèse, une par famille de sons
    soundboard.ts         page d'écoute ?soundboard=1 (dev)
  input/                  clavier → InputFrame
    keyboard.ts           états et fronts de touches, perte de focus, preventDefault
    bindings.ts           KeyboardEvent.code → action (pur, testé)
    layout.ts             libellés des touches selon la disposition (getLayoutMap si dispo)
  ui/                     écrans DOM
    ui.ts                 createUi(root, callbacks) → { show(model) }
    screens/              title, levelSelect, pause, levelEnd, victory, options
    dom.ts, focus.ts      mini-helper de création d'éléments, navigation clavier
    strings.ts            tous les textes (français)
    theme.ts              palette → variables CSS
    base.css, styles.css
  save/
    save.ts               schéma, chargement, fusion, migration (pur, stockage injecté)
scripts/
  validate-levels.ts      CLI autour de src/sim/validate/
```

Les tests sont colocalisés (`*.test.ts` à côté du module) et tournent dans un environnement node.

## 3. Dépendances entre couches

| Couche | Peut importer | Ne doit pas importer |
|---|---|---|
| `data` | — | tout le reste |
| `sim` | `data` | save, app, render, audio, input, ui |
| `save` | `data`, `sim` (types) | app, render, audio, input, ui |
| `render` | `sim`, `data` | save, app, audio, input, ui |
| `audio` | `sim`, `data` | save, app, render, input, ui |
| `input` | `sim` (type `InputFrame`), `data` | save, app, render, audio, ui |
| `ui` | `sim` (types), `save`, `data` | app, render, audio, input |
| `app`, `main.ts` | tout | — |

Garde-fous automatiques :
- ESLint (`eslint.config.js`) rejette les imports interdits. Dans `sim`, `data` et `save`, il rejette aussi `window`, `document`, `localStorage`, `performance`, `setTimeout`, `Math.random`, `Date.now`, `new Date` et `console`.
- `tsconfig.sim.json` compile `sim`, `data` et `save` sans les lib DOM ni les types Node.

Autres règles : aucun dossier interne ne porte le nom d'une couche (les règles d'import reposent sur ces noms). Pas d'alias de chemin, seulement des imports relatifs. La simulation ne lit jamais `TUNING` directement : elle reçoit la version fusionnée dans `World`. Seuls `app/` (au chargement d'un niveau) et `sim/validate/` importent `TUNING` et `LEVELS`.

## 4. Simulation

### 4.1 Monde

```ts
interface World {
  readonly level: CompiledLevel;      // immuable, partagé
  readonly tuning: Tuning;            // TUNING fusionné avec LEVELS[slug].overrides
  readonly levelTuning: LevelTuning;  // par, beaconInterval
  readonly options: SimOptions;       // { afterglowMultiplier, god }
  state: WorldState;                  // données simples et clonables, mutées en place
  stats: RunStats;                    // { time, pulses, deaths } — jamais restauré
  checkpoint: WorldState;             // instantané de reprise : départ, puis dernier point de contrôle
  checkpointActive: boolean;          // un point de contrôle a été activé
  events: GameEvent[];                // vidé par l'app après distribution
  time: number; tick: number;         // horloge monotone, jamais restaurée
  nextId: number;                     // identifiants d'impulsions et de leurres, jamais restauré
  navCache: Map<string, Float32Array>; // champs de distance mis en cache
}

interface WorldState {
  rng: number;
  status: 'playing' | 'dying' | 'complete'; statusTimer: number;
  probe: { pos: Vec2; prev: Vec2; vel: Vec2; facing: Vec2; hull: number; invuln: number;
           lures: number; energy: number; charge: number; cooldown: number; cooldownMax: number;
           bumpCooldown: number };
  pulses: Pulse[]; reveals: Reveal[];
  pearls: { x: number; y: number; taken: boolean }[];
  capsules: { x: number; y: number; taken: boolean }[];
  lures: LureBody[];
  levers: { letter: string; x: number; y: number; pulled: boolean }[];
  doors: { letter: string; progress: number; opening: boolean }[];   // 0 fermée → 1 ouverte
  checkpoints: { x: number; y: number; active: boolean }[];
  creatures: Creature[];                              // union discriminée guetteur | leviathan
  beaconTimer: number;
  doorsVersion: number;                               // invalide le cache de navigation
  pendingNoises: Noise[];                             // bruits du pas en cours
}
```

- `Vec2` est `{ x: number; y: number }`. Les positions sont en cases (unités monde).
- Les corps mobiles (sonde, créatures, leurres) gardent `prev`, mis à jour au début de chaque pas, pour l'interpolation du rendu.
- **Minuteries en comptes à rebours** (`invuln`, `cooldown`, `charge`, `beaconTimer`, minuteries des créatures) : l'état ne contient aucun temps absolu, si bien qu'un instantané restauré reste cohérent. Seules les impulsions et révélations (vidées à la restauration) portent des temps absolus, pris sur `world.time`.
- `createWorld(level, tuning, levelTuning, options, seed)` construit l'état initial, et `checkpoint` reçoit l'instantané du départ.
- L'instantané (`snapshotState`) est une copie profonde de `WorldState` par une fonction de clonage écrite à la main (`structuredClone` est interdit dans `sim`). `pulses`, `reveals`, `lures` en vol et `pendingNoises` sont vidés.

### 4.2 Ordre d'un pas (`stepWorld`)

1. `tick++`, `time += STEP` (sur `World`), sauvegarde des `prev`.
2. Si `status !== 'playing'`, on gère seulement l'animation de mort ou de fin, puis on sort.
3. **Entrées** : machine de charge de l'impulsion (émission courte ou longue, refus), lancer de leurre.
4. **Énergie** : recharge.
5. **Sonde** : poussée, courants, frottement (vase), intégration semi-implicite, collisions (roche et portes fermées, 3 itérations de dépénétration, glissement). Les chocs produisent un événement, un bruit et une révélation d'arc.
6. **Leurres** : physique (rebonds, courants, arrêt), puis pings.
7. **Ramassages** : perles, capsules, leviers (qui lancent l'ouverture des portes et leur bruit), points de contrôle (qui prennent l'instantané).
8. **Portes** : progression de l'ouverture. Quand une porte est ouverte, sa géométrie est désactivée et le cache de `nav` est invalidé.
9. **Impulsions** : avancée des fronts, révélation des objets traversés (§ 4.5), purge des impulsions et révélations éteintes.
10. **Bruit** : chaque `pendingNoise` est testé contre chaque créature (§ 4.6), puis la liste est vidée.
11. **Créatures** : machines d'état et déplacement.
12. **Dégâts** : oursins et créatures contre la sonde, invulnérabilité, recul.
13. **Balise** : émission périodique.
14. **Cycle de vie** : balise atteinte (`complete`), coque à zéro (`dying`, puis restauration de `checkpoint` et événement `respawn`).

Le pas de temps `STEP = 1/120` s est une constante technique définie dans `sim/step-constants.ts`, réexportée par `sim/step.ts` et importée par `app/loop.ts`. Ce n'est pas une valeur d'équilibrage.

### 4.3 Événements (`sim/events.ts`)

C'est le contrat avec l'audio, le rendu et l'app. Chaque événement porte assez d'information pour être joué sans relire le monde.

```ts
type GameEvent =
  | { type: 'pulseEmitted'; kind: PulseKind; pos: Vec2 }
  | { type: 'pulseEchoes'; origin: Vec2; echoes: Echo[] }
  | { type: 'pulseDenied'; reason: 'cooldown' | 'energy' }
  | { type: 'chargeStarted'; pos: Vec2 }
  | { type: 'wallBump'; pos: Vec2; intensity: number }            // 0..1
  | { type: 'pearlCollected'; pos: Vec2; remaining: number }
  | { type: 'capsulePicked'; pos: Vec2; carried: number }
  | { type: 'lureThrown'; pos: Vec2; dir: Vec2 }
  | { type: 'lureEmpty' }
  | { type: 'lurePing'; pos: Vec2 }
  | { type: 'leverPulled'; pos: Vec2; letter: string }
  | { type: 'doorOpening'; pos: Vec2; letter: string }
  | { type: 'doorOpened'; letter: string }
  | { type: 'checkpointReached'; pos: Vec2 }
  | { type: 'beaconPing'; pos: Vec2 }
  | { type: 'noise'; pos: Vec2; loudness: number; source: NoiseSource }   // debug et tests
  | { type: 'creatureClick'; id: number; pos: Vec2 }
  | { type: 'creatureAlerted'; id: number; kind: CreatureKind; pos: Vec2; target: Vec2 }
  | { type: 'creatureAttack'; id: number; pos: Vec2 }
  | { type: 'damage'; source: 'hazard' | 'creature'; pos: Vec2; hull: number }
  | { type: 'probeDestroyed'; pos: Vec2 }
  | { type: 'respawn'; pos: Vec2; fromCheckpoint: boolean }
  | { type: 'levelComplete'; pos: Vec2 };

interface Echo {
  delay: number;        // secondes après l'émission : 2 × distance / speed
  angle: number;        // radians, 0 = droite (+x), sens horaire à l'écran (+y vers le bas)
  distance: number;     // cases
  surface: 'rock' | 'door' | 'hazard' | 'pearl' | 'creature' | 'lever' | 'capsule' | 'checkpoint';
}
```

Ajouter une mécanique, c'est ajouter ses variantes ici (skill `add-mechanic`).

### 4.4 Géométrie et collisions

- `CompiledLevel` : dimensions ; `cells: Uint8Array` (type de case) ; segments de roche (tableau plat `Float32Array` [x1,y1,x2,y2]…) ; index spatial (pour chaque case, la liste des segments qui la touchent) ; rectangles de porte par lettre ; masques `mud` et `current` (direction) ; positions des objets.
- Le contour vient d'un marching squares sur les centres de cases (LEVEL_FORMAT § 4). Les segments colinéaires consécutifs peuvent être fusionnés.
- Collision cercle contre segments : on collecte les segments des cases voisines, on repousse le cercle selon la normale de pénétration maximale, on retire la composante normale entrante de la vitesse (avec restitution), et on recommence jusqu'à 3 fois. La composante tangentielle est conservée, ce qui produit le glissement.
- Pas de traversée possible : vitesse maximale × `STEP` ≪ rayon. Un test le vérifie à la vitesse maximale augmentée du recul.

### 4.5 Impulsion

- **Émission** : `rayCount` rayons à angles réguliers. Chacun parcourt la grille par DDA et teste les segments indexés (roche, portes fermées) des cases traversées. Entrer dans une case de vase absorbe le rayon, ce qui donne `hitSurface = Absorbed` avec la distance d'entrée. Un rayon qui atteint le rayon maximal donne `None`. Si l'origine est dans la vase, tout est absorbé à distance 0.
- `Pulse { id, kind, origin, startTime, speed, maxRadius, afterglow (déjà multiplié), hitDist: Float32Array, hitSurface: Uint8Array }`. L'angle du rayon `i` vaut `i × 2π / rayCount`.
- **Front** : `r(t) = (time − startTime) × speed`, borné pour chaque rayon par `hitDist[i]`. Une surface est touchée à `startTime + hitDist / speed`. Le rendu calcule l'éclat et l'effacement à partir de ces instants, sans état supplémentaire.
- **Objets** : à chaque pas, un objet dont la distance à l'origine passe dans la bande `[r_prev − revealBand/2, r + revealBand/2]` et qui est en ligne de vue est révélé. Il est en ligne de vue si le rayon le plus proche de son angle a `hitDist` supérieur à la distance de l'objet. On ajoute alors `Reveal { kind, refId, pos (figée), angle, at, fade }`. Les courants sont révélés case par case, avec leur direction.
- **Échos** : calculés à l'émission (`systems/echoes.ts`). Pour chacun des `echo.sectors` secteurs, on prend le rayon `Rock` ou `Door` le plus proche. On y ajoute les objets en ligne de vue et dans le rayon maximal, triés par distance et limités à `echo.maxEntityEchoes`. Les objets mobiles sont pris à leur position à l'émission. Le tout est émis dans `pulseEchoes`.
- **Arc de choc** : un `Reveal` de type `wallArc`, centré sur le point de contact, avec `bumpRevealRadius`.
- **Purge** : une impulsion disparaît quand `time > startTime + maxRadius / speed + afterglow`, une révélation quand `time > at + fade`.

### 4.6 Bruit, navigation, créatures

- `nav.ts` construit des champs de distance (Dijkstra, 8-voisinage, diagonale seulement si les deux cases orthogonales sont libres) sur les cases qui ne sont ni roche ni porte fermée. Deux profils de coût : **son** (vase × `mud.soundCostMultiplier`) et **nage** (vase × 2). Le calcul est borné par une portée maximale. Le cache est indexé par (case source, profil, version des portes).
- **Écoute** : pour un bruit en `p` d'intensité `l`, la créature `c` entend si `distSon(p → c) ≤ c.hearingRadius × l`. Le Léviathan entend toutes les impulsions sans condition de distance.
- **Déplacement** : descente du champ de distance de la cible (8 voisins), avec un pilotage « seek/arrive » vers le centre de la case choisie. Le Guetteur subit la collision cercle/segments comme la sonde, et sa vitesse est divisée par deux dans la vase. Le Léviathan suit les centres de cases sans collision, et son corps n'est que visuel.
- Le Léviathan recalcule le champ vers la sonde toutes les `repathInterval` secondes.
- Machines d'état : GDD § 3.9. Les tirages (points d'errance, pauses) utilisent le RNG de l'état.

### 4.7 Vues dérivées (`sim/views.ts`)

```ts
interface HudModel {
  hull: number; hullMax: number; pulses: number; par: number; pearls: number; pearlsTotal: number;
  lures: number | null;                       // null si le niveau n'a pas de capsule
  energy: { value: number; max: number } | null;
  cooldown01: number; charge01: number | null;
}
interface AmbientModel {
  listener: Vec2; currentStrength01: number; inMud: boolean;
  leviathanPathDistance: number | null; huntingCreatures: number; hullCritical: boolean;
}
```

### 4.8 Déterminisme

Même niveau, même graine et même suite d'`InputFrame` donnent le même état, au bit près. Aucune itération ne dépend de l'ordre d'insertion d'un `Map` ou d'un `Set` alimenté par des données non déterministes. Un test compare l'empreinte (hash) de l'état après N pas sur deux exécutions.

## 5. Rendu

- `renderer.frame(world, alpha)` : le temps de rendu vaut `state.time + alpha × STEP`, et les positions sont interpolées entre `prevPos` et `pos`.
- La taille du canvas suit la fenêtre (`ResizeObserver`), avec un DPR plafonné à 2. L'échelle est `hauteurCanvas / camera.visibleTilesY` pixels par case.
- Ordre des calques : fond, parois révélées, fronts d'onde, révélations d'objets, signaux (balise, leurres), points de contrôle actifs, sonde (avec anneaux de charge et de recharge), effets plein écran (vignette de dégât, fondu), HUD, overlay de debug.
- **Parois** : le rendu garde un cache par impulsion (points d'impact en `Float32Array`, calculés une fois, libérés à la purge). Les points voisins sont reliés sauf si leur écart dépasse 0,6 case ou si l'un n'est pas une surface. Les segments sont regroupés en 8 paliers d'opacité, avec un seul `Path2D` par palier et par passe de halo (3 passes, `globalCompositeOperation = 'lighter'`). Pas de `shadowBlur` ni de `ctx.filter`.
- `afterglow.ts` (pur) : `revealAlpha(t, flashTime, fade)` renvoie 0 avant le contact, puis 1 en éclat blanc-cyan, puis une décroissance douce.
- La caméra (`camera.ts`) suit la sonde avec un ressort amorti et se limite aux bords du niveau. Le tremblement vient d'un « traumatisme » alimenté par les événements (`damage`, impulsion longue) et est nul si l'option est désactivée.
- Pas d'allocation dans les boucles de dessin : les tampons et les `Path2D` sont réutilisés, ou recréés au plus une fois par frame et par palier.
- Le texte sur canvas (HUD) attend `document.fonts.load('600 16px "Chakra Petch"')`, appelé dans `main.ts`.

## 6. Audio

- `engine.ts` crée ou reprend l'`AudioContext` **uniquement** sur un geste de l'utilisateur (écran titre « Appuyez sur une touche »). Graphe : sources → gain de voix → `StereoPannerNode` → bus (`game`, `ambience`, `ui`) → `master` (volume des options) → limiteur (`DynamicsCompressorNode`) → sortie. Le bus `game` a un envoi vers une réverbération (`ConvolverNode`) dont la réponse impulsionnelle est générée au déblocage (bruit stéréo à décroissance exponentielle, ~2,5 s).
- `director.handle(events)` associe chaque événement à une recette de `sfx/`. `pulseEchoes` planifie chaque écho à `ctx.currentTime + echo.delay`. Toute temporisation passe par l'horloge Web Audio, jamais par `setTimeout`.
- `spatial.ts` (pur) : `pan = clamp(dx / panRange, −1, 1)`, `gain = 1 / (1 + d / falloff)`, et une coupure passe-bas qui dépend de l'angle (haut de l'écran plus clair). Les constantes sont dans `mix.ts`.
- Les tampons de bruit sont générés une fois et réutilisés. Les voix sont limitées par famille : on coupe la plus faible au-delà du plafond.
- La pause fait descendre les bus `game` et `ambience` à 0 en ~150 ms. Le bus `ui` reste actif.
- `?soundboard=1` affiche une page de test qui liste chaque son avec un bouton, et des curseurs de distance et d'angle pour les échos.

## 7. Entrées

- Une seule écoute `keydown`/`keyup` sur `window`. Les codes (`KeyboardEvent.code`) sont traduits en actions par `bindings.ts`. `preventDefault` s'applique sur Espace, les flèches et Échap, pour éviter le défilement.
- Les entrées de jeu ne sont prises en compte que si l'app est en mode jeu. Dans les menus, c'est l'UI qui gère le clavier par le focus DOM.
- `sample()` renvoie l'`InputFrame` et vide les fronts. Seul le premier pas d'une frame voit donc les fronts, et les suivants ne voient que les états maintenus :

```ts
interface InputFrame {
  move: Vec2;                 // normalisé, longueur ≤ 1
  pulseHeld: boolean;
  pulsePressed: boolean;      // front montant depuis le dernier sample
  pulseReleased: boolean;     // front descendant depuis le dernier sample
  throwPressed: boolean;
}
```

- `blur` et `visibilitychange` relâchent toutes les touches et demandent la pause à l'app.
- Échap en jeu sert à demander la pause. L'événement qui ouvre la pause ne doit pas être traité aussi par l'écran de pause (on ignore `repeat`, et l'UI s'attache au tick suivant).

## 8. UI et flux d'écrans

- `app/flow.ts` est une machine d'états pure (titre, sélection, jeu, pause, fin, victoire, options) qui produit un `ScreenModel`. `ui.show(model)` construit l'écran DOM correspondant. L'UI ne connaît pas l'app, elle appelle seulement des callbacks.

```ts
type ScreenModel =
  | { kind: 'title'; phase: 'pressKey' | 'menu' }
  | { kind: 'levelSelect'; levels: LevelCard[]; stars: number; maxStars: number }
  | { kind: 'playing' }
  | { kind: 'pause'; canRestoreCheckpoint: boolean }
  | { kind: 'levelEnd'; result: RunResult; newRecords: { time: boolean; pulses: boolean }; hasNext: boolean }
  | { kind: 'victory'; stars: number; maxStars: number; pearls: number; maxPearls: number }
  | { kind: 'options'; options: Options; returnTo: 'title' | 'pause' };

interface LevelCard { slug: string; number: number; name: string; locked: boolean; stars: StarSet }

interface UiCallbacks {
  onAnyKey(): void;            // titre : débloque l'audio
  onPlay(): void; onOpenOptions(): void; onBack(): void;
  onSelectLevel(slug: string): void;
  onResume(): void; onRestoreCheckpoint(): void; onRestartLevel(): void; onQuitToSelect(): void;
  onNextLevel(): void; onReplay(): void;
  onOptionsChange(options: Options): void;
  onUiSound(kind: 'move' | 'confirm' | 'back'): void;
}
```

- Le HUD n'est pas dans l'UI DOM : il est dessiné par `render/hud.ts`.
- Les couleurs viennent de `palette.ts` via `theme.ts`, qui pose des variables CSS `--c-<clé>`. Les textes viennent de `strings.ts`. La navigation au clavier passe par `focus.ts` (flèches, ZQSD/WASD, Entrée, Espace, Échap) et la souris fonctionne aussi.

## 9. Sauvegarde

```ts
interface SaveData { version: 1; levels: Record<string, LevelRecord>; options: Options }
interface LevelRecord { completed: boolean; stars: StarSet; bestTime: number | null; bestPulses: number | null }
interface StarSet { complete: boolean; pearls: boolean; par: boolean }
interface Options { volume: number; longAfterglow: boolean; screenShake: boolean }   // volume 0..1
interface RunResult { slug: string; time: number; pulses: number; par: number; pearls: number;
                      pearlsTotal: number; deaths: number; stars: StarSet }
interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
```

- La clé de stockage est `echo.save.v1`. `loadSave(store)` : si le JSON est invalide, la version inconnue ou le schéma non conforme, on repart des valeurs par défaut sans exception. `migrate` est prévu pour les versions futures.
- `recordRun(save, result)` combine les étoiles par OU logique, met à jour les records et renvoie `{ save, newRecords }`. `isUnlocked(save, catalog, index)` : l'index 0 est toujours ouvert, et l'index N l'est si le niveau N−1 est terminé.
- L'écriture a lieu à chaque fin de niveau et à chaque changement d'option. `setItem` peut lever une exception (quota, navigation privée) : l'app l'intercepte et affiche un avertissement en console.

## 10. Outils de développement

| Paramètre d'URL | Effet |
|---|---|
| `?level=<n\|slug>` | lance directement le niveau, après l'écran « appuyez sur une touche » nécessaire à l'audio |
| `?debug=1` | active les touches F1 à F4 dans un build de production (toujours actives en dev) |
| `?reveal=1` | carte entièrement visible (révélation permanente) |
| `?god=1` | aucun dégât |
| `?unlock=1` | tous les niveaux ouverts, sans modifier la sauvegarde |
| `?seed=<n>` | graine du RNG |
| `?soundboard=1` | page d'écoute des sons |

- **F1** : overlay avec images par seconde, temps de simulation et de rendu, segments, rayons de la dernière impulsion, créatures (état, cible, cercle d'écoute), bruits et journal des 12 derniers événements. **F2** : révélation permanente. **F3** : mode sans dégât. **F4** : recommencer le niveau.
- `window.__echo` (dev ou `?debug=1`) : `{ world(), loadLevel(slug), teleport(x, y), lastEvents() }`, pour piloter et inspecter le jeu depuis un navigateur automatisé.
- **HMR** : en dev, modifier `src/data/tuning.ts` ou un niveau recharge le niveau en cours avec les nouvelles données, sans repasser par les menus (`import.meta.hot.accept` dans `app/debug.ts`).

## 11. Tests

| Module | Ce qui est vérifié |
|---|---|
| `sim/level/*` | analyse (dimensions, indentation, `\r\n`, erreurs positionnées, portes et leviers), contour (pilier en losange, bord aligné, diagonale fermée) |
| `sim/systems/probe` | vitesse de croisière, glissement le long d'une paroi, coin, absence de traversée, seuil de choc |
| `sim/systems/pulse`, `echoes` | charge (appui bref, maintien, appui dans un même pas, refus), arrêt des rayons, ligne de vue, vase, portes, rémanence et purge, échos par secteur, délais |
| `sim/nav`, `guetteur`, `leviathan` | pas d'écoute à travers la roche, seuils, transitions d'état, cible = origine du bruit, retrait, élan, distance de reprise |
| autres systèmes | leurres, leviers et portes, points de contrôle (stats non restaurées), oursins et invulnérabilité, courants, énergie, balise, fin de niveau |
| `sim/scoring` | étoiles |
| `sim/validate/*` | chaque règle sur une fixture minimale |
| `sim/levels.test.ts` | tous les niveaux du catalogue valides ; 10 s sans entrée puis avec des entrées aléatoires à graine, sans NaN ni exception ; déterminisme |
| `save/save` | défauts, aller-retour, fusion des étoiles, records, déblocage, JSON corrompu, version inconnue, stockage qui lève |
| `app/loop`, `app/flow` | accumulateur (plafond, reste, alpha), transitions d'écrans |
| `input/bindings`, `audio/spatial`, `render/afterglow` | fonctions pures |

Les fixtures de niveau sont écrites inline sous forme de chaînes ASCII. On n'utilise pas de lecture de fichier dans les tests de `src/`.

## 12. Performance

Cible : 60 images par seconde stables à 1080p sur un portable milieu de gamme.

| Poste | Budget |
|---|---|
| Simulation (≈ 2 pas par frame) | ≤ 2 ms |
| Émission d'une impulsion (720 rayons) | ≤ 3 ms, ponctuel |
| Champ de distance (140 × 70) | ≤ 1 ms, mis en cache |
| Rendu | ≤ 8 ms |

L'overlay F1 affiche ces mesures. En fin de projet, une trace de performance dans les DevTools de Chrome sert de vérification.
