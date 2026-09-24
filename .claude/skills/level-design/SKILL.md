---
name: level-design
description: Créer ou retoucher un niveau d'ÉCHO — grille ASCII dans src/data/levels/, entrée LEVELS de src/data/tuning.ts, validation et vérification en jeu. À utiliser pour tout changement de contenu de niveau (tracé, placement, par, intervalle de balise, surcharges).
---

# Concevoir un niveau

## 1. Partir de la fiche

- Lis la fiche du niveau dans `docs/GDD.md` § 7.3 (intention, déroulé, consigne) et sa ligne dans la courbe (§ 7.2 : taille, balise, créatures, points de contrôle).
- Relis `docs/LEVEL_FORMAT.md` § 3 (légende) et § 4 (géométrie dérivée).
- Note les distances qui comptent, tirées de `TUNING` après surcharges : `pulse.short.radius`, `pulse.long.radius`, `guetteur.hearingRadius`, `guetteur.wanderRadius`, `current.strength` comparé à `probe.thrust`.

## 2. Esquisser les temps forts

Découpe le niveau en 3 à 6 zones et écris une ligne d'intention par zone : **apprendre sans risque**, puis **appliquer**, puis **combiner**. Place d'abord le départ, la sortie et l'itinéraire principal, puis les perles et les dangers.

## 3. Heuristiques propres au sonar

- **Repères** : des formes singulières (pilier en losange, niche, coude marqué) que l'on reconnaît dans la rémanence. Évite les longs couloirs uniformes et les grands vides silencieux, sauf quand ils servent une leçon voulue (grande salle du niveau 2).
- **Sortie** : jamais en ligne droite visible depuis le départ. Le signal de la balise doit indiquer une direction utile, pas un chemin direct.
- **Largeurs** : 1 case exige de la précision, 2 cases laissent de la marge. Dans le territoire d'une créature, pas de couloir d'une case (W05). Deux cases d'eau qui ne se touchent que par un coin ne communiquent pas.
- **Perles** : dans des culs-de-sac, derrière un danger ou dans un remous, chacune à un seul détour du chemin. Jamais dans la vase.
- **Créatures** : un territoire d'au moins 2 cases de large. Des points d'émission sûrs, à une distance de chemin supérieure à `hearingRadius` de toute la zone d'errance (`wanderRadius`), d'où l'on peut cartographier. Une géométrie qui permet de s'éloigner du point d'émission.
- **Points de contrôle** : dans des niches calmes, hors de portée d'écoute, avant les passages difficiles.
- **Courants** : le sens du courant raconte quelque chose (porter vers la suite, pousser vers un danger).
- **Par** : un joueur qui connaît le niveau doit pouvoir le finir avec environ 60 à 70 % des impulsions d'une première partie.

## 4. Écrire

- Crée `src/data/levels/NN-slug.ts` avec `export default defineLevel({ id, name, hint, grid })`. La grille peut être indentée, mais elle doit être rectangulaire et bordée de `#`.
- Ajoute l'import et l'entrée dans `LEVEL_CATALOG` (`src/data/levels/index.ts`) à la bonne position.
- Ajoute ou ajuste `LEVELS[slug]` dans `src/data/tuning.ts` : `par`, `beaconInterval`, et `overrides` si le niveau doit s'écarter des valeurs globales.

## 5. Valider

```
npm run validate-levels -- --verbose <slug>
npx vitest run src/sim/levels.test.ts
```

Corrige toutes les erreurs. Pour chaque avertissement, corrige-le ou justifie-le. Le mode `--verbose` trace le plus court chemin, donne sa longueur et une suggestion de par : pars de cette suggestion, puis ajuste selon la difficulté voulue.

## 6. Vérifier en jeu

Avec le skill `playtest` :
- `?level=<slug>&reveal=1` pour voir tout le tracé (lisibilité, proportions, repères) ;
- `?level=<slug>` pour le parcours réel : zones lisibles à la rémanence, balise utile, rien d'injuste.

## 7. Rapport

Fais un rapport court : l'intention de chaque zone, le par retenu et sa justification, les valeurs à confirmer par l'auteur en jouant.
