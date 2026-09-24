# ÉCHO

Jeu 2D d'exploration au sonar. Vous pilotez une sonde dans des grottes sous-marines plongées dans le noir : chaque impulsion révèle un instant les parois, mais les créatures aveugles des abysses chassent au son. Voir, c'est être entendu.

TypeScript, Vite, Canvas 2D et Web Audio. Tout est procédural : aucun fichier image ni son.

## Jouer en local

Il faut Node.js 22.12 ou plus récent.

```
npm install
npm run dev
```

Ouvrez ensuite http://localhost:5173 dans un navigateur de bureau (Chrome, Edge ou Firefox) et appuyez sur une touche : ce premier appui active le son.

| Action | Touches |
|---|---|
| Nager | ZQSD (AZERTY), WASD (QWERTY) ou flèches |
| Impulsion courte | Espace, appui bref |
| Impulsion longue | Espace maintenu environ une seconde |
| Lancer un leurre | E |
| Pause | Échap |

La progression, les étoiles et les options sont enregistrées dans le navigateur (`localStorage`).

## Construire la version à publier

```
npm run build      # site statique dans dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

Le dossier `dist/` utilise des chemins relatifs : il se sert tel quel depuis n'importe quel hébergement statique ou sous-dossier.

## Ajouter un niveau

Le format complet est décrit dans `docs/LEVEL_FORMAT.md`. En résumé :

1. Créez `src/data/levels/NN-mon-niveau.ts`, où `NN` est la position à deux chiffres :

   ```ts
   import { defineLevel } from './define';

   export default defineLevel({
     id: 'mon-niveau',            // slug stable : clé de sauvegarde
     name: 'Mon niveau',
     hint: 'Une phrase de consigne.',
     grid: `
       ##########
       #S..o...X#
       ##########
     `,
   });
   ```

   Légende principale : `#` roche, `.` eau, `S` départ, `X` balise de sortie, `o` perle, `*` oursin, `~` vase, `^ > v <` courants, `+` capsule de leurre, `P` point de contrôle, `G` Guetteur, `L` Léviathan, `a`–`f` leviers qui ouvrent les portes `A`–`F`.
2. Importez-le dans `src/data/levels/index.ts` et placez-le dans `LEVEL_CATALOG`. L'ordre du tableau est l'ordre de jeu et de déblocage.
3. Ajoutez son entrée dans `LEVELS` de `src/data/tuning.ts` : `'mon-niveau': { par: 8, beaconInterval: 3 }`, avec éventuellement des `overrides` d'équilibrage propres au niveau.
4. Vérifiez-le :

   ```
   npm run validate-levels -- --verbose mon-niveau
   ```

   La commande affiche la grille avec le plus court chemin, sa longueur et une suggestion de par, puis les erreurs et avertissements. `npm test` rejoue aussi chaque niveau avec un pilote automatique.
5. Jouez-le directement avec http://localhost:5173/?level=mon-niveau. Ajoutez `&reveal=1` pour voir toute la carte.

## Équilibrer

Toutes les valeurs d'équilibrage sont dans `src/data/tuning.ts` : valeurs globales dans `TUNING`, valeurs par niveau (par, intervalle de la balise, surcharges) dans `LEVELS`. Chaque clé est commentée avec son unité (cases, secondes). Pendant `npm run dev`, enregistrer ce fichier relance le niveau en cours avec les nouvelles valeurs.

## Outils de test

| Paramètre d'URL | Effet |
|---|---|
| `?level=<numéro ou slug>` | lance directement ce niveau |
| `&reveal=1` | carte entièrement visible |
| `&god=1` | aucun dégât |
| `&unlock=1` | tous les niveaux ouverts, sans modifier la sauvegarde |
| `&debug=1` | active les touches de debug dans la version construite |
| `?soundboard=1` | table d'écoute de tous les sons |

En développement, les touches de debug sont toujours actives : F1 affiche l'overlay (images par seconde, états des créatures, journal des événements), F2 la révélation permanente, F3 le mode sans dégât, F4 relance le niveau.

```
npm run check      # typecheck, lint, tests et validation des niveaux
```

## Documentation

- `docs/GDD.md` : conception du jeu (règles, écrans, direction artistique, fiches des niveaux)
- `docs/ARCHITECTURE.md` : architecture technique
- `docs/LEVEL_FORMAT.md` : format des niveaux et règles de validation
- `docs/ROADMAP.md` : feuille de route
- `docs/DECISIONS.md` : décisions
