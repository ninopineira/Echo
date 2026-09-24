---
name: playtest
description: Lancer ÉCHO en local et le vérifier dans un navigateur — serveur Vite, paramètres d'URL de debug, raccourcis F1–F4, window.__echo, table de sons, captures d'écran, mesure des images par seconde, build de production. À utiliser pour voir un changement tourner dans le vrai jeu (pas seulement dans les tests), avant de cocher un jalon ou pour diagnostiquer un bug visuel ou sonore.
---

# Playtest

## 1. Lancer

- Démarre le serveur en arrière-plan : `npm run dev -- --port 5173 --strictPort`. Attends la ligne `Local:`. Si le port est pris, un serveur tourne peut-être déjà : réutilise-le.
- Pour le build de production : `npm run build`, puis `npm run preview -- --port 4173 --strictPort`.

## 2. Raccourcis de test

| URL | Usage |
|---|---|
| `http://localhost:5173/?level=<n\|slug>` | aller directement à un niveau |
| `…&reveal=1` | carte entièrement visible, pour juger un tracé |
| `…&god=1` | aucun dégât |
| `…&unlock=1` | tous les niveaux ouverts, sans toucher la sauvegarde |
| `…&seed=<n>` | reproduire un comportement aléatoire |
| `…&debug=1` | active F1–F4 dans le build de production |
| `/?soundboard=1` | écouter chaque son isolément |

Touches : **F1** overlay (images par seconde, temps de simulation et de rendu, géométrie, rayons, états des créatures, journal des événements), **F2** révélation permanente, **F3** mode sans dégât, **F4** recommencer.

La page d'accueil demande d'appuyer sur une touche : c'est nécessaire pour débloquer l'audio, y compris avec `?level=`.

## 3. Piloter un navigateur

Si un outil de navigateur est disponible (skill `claude-in-chrome`, navigateur intégré, ou plugin Playwright ou Chrome DevTools) :
- ouvre l'URL dans un nouvel onglet, appuie sur une touche, puis capture l'écran ;
- simule les entrées par événements clavier (`KeyW`, `Space`…). Pour maintenir une touche, envoie `keydown`, attends, puis envoie `keyup` ;
- lis l'état avec `window.__echo.world()` (position, coque, impulsions) et les derniers événements avec `window.__echo.lastEvents()`. C'est le moyen de vérifier que les sons sont **déclenchés** quand on ne peut pas les entendre ;
- `window.__echo.teleport(x, y)` permet de tester une zone précise sans y nager ;
- relève la console : aucune erreur ni avertissement inattendu.

Si aucun navigateur n'est pilotable, dis-le clairement, liste ce que l'auteur doit vérifier à la main, et appuie-toi sur les tests de simulation (partie scriptée avec des `InputFrame`) pour ce qui peut être automatisé.

## 4. Quoi vérifier

- Le niveau se charge. La sonde nage, glisse et bute avec le son attendu.
- L'impulsion révèle ce qui est en ligne de vue et rien derrière les parois. La rémanence s'efface dans les délais.
- La balise est visible et audible depuis tout le niveau.
- La mécanique du jalon se comporte comme dans le GDD : utilise l'overlay F1 pour les états internes.
- L'overlay F1 affiche au moins 58 images par seconde en jeu, y compris pendant une impulsion longue.
- Pas d'erreur dans la console. Après un changement dans `tuning.ts`, le HMR relance bien le niveau.
- Non-régression : chaque niveau précédent se charge et se joue quelques secondes.

## 5. Terminer

Arrête le serveur que tu as lancé. Rends compte de ce qui a été vérifié, avec les captures, de ce qui ne l'a pas été et pourquoi, et de ce que l'auteur doit juger à l'oreille ou en main.
