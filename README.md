# ÉCHO

Jeu 2D d'exploration au sonar. Vous pilotez une sonde dans des grottes sous-marines plongées dans le noir : chaque impulsion révèle un instant les parois, mais les créatures aveugles des abysses chassent au son. Voir, c'est être entendu.

TypeScript, Vite, Canvas 2D et Web Audio. Tout est procédural : aucun fichier image ni son.

## Jouer en local

```
npm install
npm run dev        # puis ouvrir http://localhost:5173
```

Contrôles : ZQSD / WASD ou flèches pour nager, Espace pour une impulsion (maintenir pour l'impulsion longue), E pour lancer un leurre, Échap pour la pause.

## Construire

```
npm run build      # site statique dans dist/, servable depuis n'importe quel dossier
npm run preview
```

## Équilibrer

Toutes les valeurs d'équilibrage sont dans `src/data/tuning.ts` (valeurs globales en haut, par niveau dans `LEVELS`). En `npm run dev`, enregistrer le fichier relance le niveau en cours avec les nouvelles valeurs. Les niveaux sont des grilles ASCII dans `src/data/levels/`, décrites dans `docs/LEVEL_FORMAT.md`. `npm run validate-levels` les vérifie.

## Documentation

- `docs/GDD.md` : conception du jeu
- `docs/ARCHITECTURE.md` : architecture technique
- `docs/LEVEL_FORMAT.md` : format des niveaux
- `docs/ROADMAP.md` : feuille de route
- `docs/DECISIONS.md` : décisions
