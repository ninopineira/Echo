---
name: procedural-audio
description: Ajouter ou retoucher un son procédural d'ÉCHO dans src/audio/ (Web Audio, aucun fichier son) — correspondance événement → son, timbres d'écho, spatialisation, mixage, table d'écoute. À utiliser dès qu'un événement de jeu doit s'entendre, qu'un son doit être ajusté, ou pour une passe de mixage.
---

# Sons procéduraux

## Principes

- **Aucun fichier son.** On n'utilise que des oscillateurs, des tampons de bruit générés (une seule fois, puis réutilisés), des `BiquadFilterNode`, des `WaveShaperNode` pour le grain, et une `ConvolverNode` dont la réponse impulsionnelle est générée au déblocage.
- **Le son informe.** Avant d'écrire une recette, formule en une phrase ce que le joueur doit comprendre en l'entendant (quoi, où, à quelle distance). Voir le tableau de `docs/GDD.md` § 6.
- **Chaîne** : source(s) → enveloppe (gain de voix) → `StereoPannerNode` → bus (`game`, `ambience` ou `ui`) → `master` → limiteur → sortie. Le bus `game` a un envoi vers la réverbération.

## Ajouter un son

1. **Déclencheur** : un `GameEvent` (`src/sim/events.ts`) ou un champ d'`AmbientModel` pour un son continu. Ne modifie pas la simulation : s'il manque une information, signale-le.
2. **Recette** : une fonction dans `src/audio/sfx/<famille>.ts` avec la signature `(ctx, out: AudioNode, when: number, params) => void`. Ses paramètres sont des nombres (intensité, distance, brillance), pas des événements.
3. **Correspondance** : ajoute le cas dans `director.ts`. La position est convertie par `spatial.ts` (pan, gain, coupure passe-bas) par rapport à la sonde. Pour les échos, la date est `ctx.currentTime + echo.delay`.
4. **Mixage** : volumes, portées et plafond de voix de la famille dans `mix.ts`.
5. **Table d'écoute** : ajoute une entrée dans `soundboard.ts` (`?soundboard=1`), avec des curseurs pour les paramètres (distance, angle, intensité).
6. **Tests** : les fonctions pures (`spatial.ts`, calculs de paramètres) sont testées dans l'environnement node. Les nœuds Web Audio ne sont pas testés.

## Règles techniques

- **Pas de clic** : ne démarre ni n'arrête jamais une source à gain non nul. Attaque avec `setValueAtTime(0, t)` puis `linearRampToValueAtTime(v, t + ≥0.003)`. Relâche avec `setTargetAtTime(0, t, τ)` ou une rampe exponentielle vers `0.0001`, puis `stop()` après la fin du relâchement.
- **Horloge** : toute temporisation se fait avec `ctx.currentTime + délai`, jamais avec `setTimeout` ni avec la boucle de jeu.
- **Voix** : chaque famille a un plafond, et au-delà on coupe la voix la plus faible. Déconnecte les nœuds à `onended`.
- **Déblocage** : l'`AudioContext` n'existe qu'après le premier geste de l'utilisateur. Avant cela, `director` ignore les événements sans lever d'exception.
- **Pause** : les bus `game` et `ambience` descendent à 0 en ~150 ms, le bus `ui` reste actif.
- **Hasard** : pour de légères variations (hauteur ±3 %), `Math.random` est autorisé dans `audio/`, qui ne fait pas partie de la simulation.

## Timbres d'écho (GDD § 3.3)

| Surface | Caractère | Piste de synthèse |
|---|---|---|
| roche | « toc » boisé, court | bruit filtré passe-bande (~800–1500 Hz) avec enveloppe de 30–60 ms |
| porte | tintement métallique | 3–4 sinus inharmoniques, décroissance de 300–500 ms |
| oursin | crépitement | rafale de micro-impulsions de bruit passe-haut |
| perle | tintement cristallin | sinus aigu (2–3 kHz) et une harmonique, décroissance longue |
| créature | grondement mat | bruit passe-bas (< 300 Hz) avec une légère modulation |
| levier, capsule, point de contrôle | clic sec, cliquetis creux, accord doux | variantes courtes |

La distance agit sur le gain et, légèrement, sur la brillance. La direction agit sur le pan (axe horizontal) et sur la coupure passe-bas (haut de l'écran plus clair).

## Vérifier

`npm run typecheck`, `npm run lint`, `npx vitest run src/audio`, puis écoute dans `?soundboard=1` et en jeu (skill `playtest`). Si tu ne peux pas écouter, décris précisément ce qu'il faut entendre pour valider.
