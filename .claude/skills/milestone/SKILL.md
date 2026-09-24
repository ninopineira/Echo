---
name: milestone
description: Clôturer un jalon de docs/ROADMAP.md — vérifier chaque case contre le code, lancer les contrôles automatiques et le playtest de la tranche, mettre à jour la feuille de route, les décisions et le GDD, résumer à l'auteur. À utiliser quand toutes les cases d'un jalon semblent faites, avant de passer au suivant.
---

# Clôturer un jalon

## 1. Identifier

Le jalon en cours est le premier de `docs/ROADMAP.md` qui a des cases non cochées. Relis sa phrase « Jouable » : c'est le critère d'acceptation.

## 2. Vérifier chaque case contre le code

Pour chaque case, retrouve l'implémentation et son test (Grep ou Glob). Une case sans code ou sans test correspondant n'est pas faite, même si elle est cochée : décoche-la et termine-la.

## 3. Contrôles automatiques

```
npm run check
npm run build
```

Tout doit passer. Ne saute jamais un test (`.skip`, `.only`) et n'ajoute pas d'`eslint-disable` sans justification. Si un test échoue, corrige le code, ou le test s'il était faux, en expliquant pourquoi.

## 4. Playtest

Suis le skill `playtest` :
- vérifie le critère « Jouable » du jalon, en entier, sur le niveau concerné ;
- fais le tour de non-régression des niveaux précédents ;
- vérifie la tenue des 60 images par seconde dans l'overlay F1.

## 5. Mettre à jour les documents

- `docs/ROADMAP.md` : coche les cases vérifiées. Chaque suite découverte devient une case non cochée dans le jalon où elle a sa place.
- `docs/DECISIONS.md` : une ligne numérotée par décision structurante ou interprétation prise pendant le jalon.
- `docs/GDD.md` : toute règle précisée ou modifiée.
- `CLAUDE.md` : tout nouveau piège rencontré qui resservira.

## 6. Git

Si le dépôt est sous git et que l'auteur a demandé des commits : un commit par jalon, intitulé `M<n> — <titre du jalon>`, après les contrôles. Ne pousse jamais sans demande explicite.

## 7. Résumé à l'auteur

En quelques lignes :
- ce qui est jouable maintenant, et comment le lancer (`npm run dev`, `?level=…`) ;
- les valeurs de `tuning.ts` à régler en jouant, les par provisoires en tête ;
- ce qui a été reporté, et où ;
- les points que l'auteur doit trancher.
