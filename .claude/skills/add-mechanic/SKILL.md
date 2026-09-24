---
name: add-mechanic
description: Procédure pour ajouter ou modifier une mécanique de gameplay d'ÉCHO en tranche verticale (données, simulation, événements, rendu, audio, validation, tests, docs). À utiliser pour chaque élément de la feuille de route (impulsion longue, oursins, courants, Guetteur, leurres, vannes, vase, énergie, Léviathan) ou quand une règle du GDD change.
---

# Ajouter une mécanique

Une mécanique n'est terminée que lorsqu'elle est simulée, visible, audible, validée dans les niveaux, testée et documentée. Travaille dans cet ordre, en gardant le jeu lançable à chaque étape.

## 0. Cadrer

- Lis la règle dans `docs/GDD.md` (§ 3.x) et la fiche du niveau qui l'introduit (§ 7.3), puis le jalon correspondant de `docs/ROADMAP.md`.
- Passe en revue la grille d'interactions ci-dessous et note les réponses avant d'écrire du code.

| Question | Où ça se code |
|---|---|
| Quel caractère de légende ? (déjà réservé dans `LEGEND`, ne pas en inventer) | `src/data/levels/define.ts`, `sim/level/parse.ts` |
| Est-ce que ça bloque la sonde, les rayons, le son, les créatures ? | `sim/level/compile.ts`, `systems/probe.ts`, `systems/pulse.ts`, `sim/nav.ts` |
| Est-ce révélé par l'impulsion ? Sous quelle forme ? | `systems/pulse.ts` (`Reveal`), `render/layers/` |
| Est-ce que ça renvoie un écho, et avec quel timbre ? | `systems/echoes.ts` (`Echo.surface`), `audio/sfx/` |
| Est-ce que ça fait du bruit ? Quelle intensité (`loudness`) ? | `pendingNoises`, `TUNING` |
| Est-ce que ça agit sur la sonde, les leurres, les créatures ? | système dédié, ordre du pas (ARCHITECTURE § 4.2) |
| Est-ce restauré au point de contrôle ? | `WorldState` (restauré) ou `RunStats` (jamais restauré) |
| Est-ce que ça change l'atteignabilité ? | `sim/validate/` |
| Est-ce que ça doit apparaître dans le HUD ou dans l'overlay F1 ? | `sim/views.ts`, `render/hud.ts`, `render/debug.ts` |

## 1. Données

- Ajoute chaque paramètre dans `TUNING` (`src/data/tuning.ts`), avec l'unité en commentaire et la valeur de départ tirée de l'intention du GDD. Les variations par niveau passent par `LEVELS[slug].overrides`.
- Aucune valeur en dur dans le code.

## 2. Simulation

- Ajoute l'état dans `WorldState` en données simples et clonables, sans classe ni fonction.
- Écris le système dans `src/sim/systems/<nom>.ts` sous forme de fonctions `(world) => void` qui lisent `world.tuning`, et insère l'appel à sa place dans `stepWorld`.
- Ajoute les variantes d'événements dans `sim/events.ts`. C'est le contrat pour l'audio et le rendu : chaque événement doit porter assez d'information (position, intensité) pour être joué seul.
- Garde la simulation déterministe : pas de `Math.random` (utilise le RNG de l'état), et pas d'itération sur une structure à ordre non déterministe.

## 3. Tests de simulation

Colocalisés dans `src/sim/systems/<nom>.test.ts`. Chaque test part d'une fixture ASCII minimale écrite inline et d'une suite d'`InputFrame` scriptée. Couvre le cas nominal, les bords (seuils, simultanéités) et l'interaction avec l'impulsion ou le bruit si elle existe.

## 4. Validation des niveaux

Si l'atteignabilité ou la sécurité change, ajoute la règle dans `src/sim/validate/` avec son code (erreur `Exx` ou avertissement `Wxx`), mets à jour le tableau de `docs/LEVEL_FORMAT.md` § 6 et ajoute un test sur une fixture.

## 5. Rendu

Dans un calque de `src/render/layers/`. Couleurs de `PALETTE`, halo via `glow.ts`, effacement via `afterglow.ts`. Aucune allocation par frame. Si la mécanique a un état interne (IA, minuteries), ajoute-le à l'overlay F1.

## 6. Audio

Liste les événements et l'ambiance à sonoriser. Réalise les sons toi-même avec le skill `procedural-audio`, ou confie-les à l'agent `sound-designer` en parallèle, en lui indiquant les événements et l'intention.

## 7. Niveau

Écris le niveau qui introduit la mécanique avec le skill `level-design`, ou confie-le à l'agent `level-designer`.

## 8. Documentation

- Mets à jour le GDD si la règle a été précisée ou ajustée.
- Ajoute une ligne à `docs/DECISIONS.md` pour tout choix structurant ou toute interprétation.
- Coche les cases de `docs/ROADMAP.md`. Les suites découvertes deviennent de nouvelles cases.

## 9. Vérifier

`npm run check`, puis le skill `playtest` sur le niveau concerné et sur un niveau précédent (non-régression).
