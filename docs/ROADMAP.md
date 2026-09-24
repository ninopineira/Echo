# ÉCHO — feuille de route

Jalons en tranches verticales. À la fin de chaque jalon, `npm run dev` lance le jeu et tout ce qui est implémenté est jouable. On commence par le niveau 1.
On travaille dans l'ordre et on coche une case quand le code, ses tests et la doc concernée sont faits. Le jalon se clôture avec le skill `milestone`.

**Définition de fini, pour chaque jalon :**
- `npm run check` passe (typecheck, lint à 0 avertissement, tests, validation des niveaux), et `npm run build` passe aussi.
- Playtest (skill `playtest`) : le ou les niveaux du jalon se jouent du début à la fin, sans erreur dans la console, sans chute sous 58 images par seconde dans l'overlay F1. Les niveaux précédents se chargent toujours.
- Toute nouvelle valeur de gameplay est dans `src/data/tuning.ts`. Toute décision structurante prise pendant le jalon est ajoutée à `docs/DECISIONS.md`. Le GDD est à jour si une règle a changé.
- Les suites découvertes sont ajoutées comme cases non cochées dans le jalon concerné, jamais cochées d'avance.

**Travail parallélisable** : les jalons indiquent ce qui peut être confié aux agents `level-designer`, `sound-designer` et `ui-screens` pendant que le fil principal avance sur la simulation et le rendu.

---

## M0 — Fondations : la sonde nage dans le niveau 1

Jouable : `npm run dev` ouvre le niveau 1 dans le noir. La sonde nage avec inertie et glisse le long des parois (F2 affiche la carte).

- [ ] `sim/math` (vecteurs, segments, intersections rayon/segment et cercle/segment) et `sim/rng.ts`
- [ ] `sim/tuning.ts` : `mergeTuning` (fusion profonde et typée) et ses tests
- [ ] `sim/level/parse.ts` : légende complète (LEVEL_FORMAT § 3), erreurs positionnées, tests (indentation, `\r\n`, portes et leviers)
- [ ] `sim/level/contour.ts` et `compile.ts` : marching squares, index spatial, rectangles de porte, masques vase et courant, tests de contour
- [ ] `sim/world.ts` (création, clonage, instantané et restauration), `sim/step.ts` (squelette ordonné, `STEP`), `sim/events.ts`, `sim/input.ts`
- [ ] `systems/probe.ts` : poussée, frottement, collisions, glissement, choc (événement et bruit en attente), tests
- [ ] `sim/validate/` : E01–E07, E11, W01, W02, suggestion de par, rapport texte ; `scripts/validate-levels.ts` avec `--verbose` ; `src/sim/levels.test.ts`
- [ ] Niveau `01-premier-echo.ts` (première version), catalogue, entrée `LEVELS`
- [ ] `app/loop.ts` (accumulateur pur et tests), `app/session.ts`, `main.ts` réel, `app/debug.ts` (`?level`, `?reveal`, `?debug`, F1, F2, `window.__echo`)
- [ ] `input/keyboard.ts` et `bindings.ts` (codes physiques, flèches, perte de focus, `preventDefault`) et tests
- [ ] `render/renderer.ts` (DPR, redimensionnement), `camera.ts`, fond, sonde (goutte orientée), overlay F1 (segments, images par seconde, temps), révélation F2
- [ ] HMR : modifier `tuning.ts` ou un niveau relance le niveau en cours

En parallèle, dès que le parseur et le validateur sont en place : `level-designer` ébauche les niveaux 2 à 10 d'après leurs fiches du GDD. Les éléments non simulés restent inertes et ces ébauches seront reprises à chaque jalon.

## M1 — Premier écho : le niveau 1 de bout en bout

Jouable : on termine le niveau 1 à l'impulsion courte, guidé par la balise. Les échos s'entendent et sont directionnels. Un écran de fin provisoire s'affiche.

- [ ] `systems/pulse.ts` : machine de charge (appui bref seulement, la longue arrive en M2), recharge, rayons par DDA, vase absorbante, front, révélations d'objets en ligne de vue, purge, compteur d'impulsions, tests
- [ ] `systems/echoes.ts` : secteurs, échos d'objets, délais, tests
- [ ] Arc de révélation au choc
- [ ] `systems/pickups.ts` (perles), `systems/beacon.ts` (signal périodique), `systems/lifecycle.ts` (balise atteinte → `complete`), tests
- [ ] `render/afterglow.ts` (pur, testé), `glow.ts`, calques parois, front d'onde, perles, balise (anneau à travers les parois, repère hors champ), arc de choc
- [ ] `sim/views.ts` (`HudModel`) et `render/hud.ts` : impulsions / par, perles, coque, arc de recharge autour de la sonde
- [ ] `audio/engine.ts` (déblocage au premier geste, bus, limiteur, réverbération générée), `spatial.ts` (testé), `mix.ts`, `director.ts`
- [ ] Sons : impulsion courte, échos roche et perle, balise, choc, perle ramassée, fin de niveau ; `?soundboard=1`
- [ ] Écran « Appuyez sur une touche » minimal (déblocage de l'audio), apparition du nom et de la consigne du niveau, fin de niveau provisoire (texte des stats, Entrée pour rejouer)
- [ ] Niveau 1 finalisé : tracé, par et intervalle de balise calés en jouant

En parallèle : `sound-designer` réalise les sons de cette liste dès que `events.ts` et `engine.ts` existent.

## M2 — Méandres : impulsion longue, perles, étoiles

Jouable : niveaux 1 et 2 enchaînés. L'impulsion longue fonctionne, les trois étoiles sont calculées et l'écran de fin est le vrai.

- [ ] Impulsion longue : charge avec déclenchement automatique à `longChargeTime`, recharge commune selon le type de la dernière émise, tests (appui et relâchement dans le même pas, maintien)
- [ ] `RunStats` (temps, impulsions, pertes), `sim/scoring.ts` (étoiles, `RunResult`), tests
- [ ] Rendu : anneau de charge, impulsion longue, par dépassé en corail dans le HUD
- [ ] Sons : impulsion longue, montée de charge, impulsion refusée, étoiles
- [ ] Contrat UI : `ScreenModel` et `UiCallbacks`, `ui/ui.ts`, `theme.ts`, `strings.ts`, `focus.ts`, styles de base
- [ ] Écran de fin de niveau : statistiques, étoiles qui s'allument, Niveau suivant / Rejouer / Sélection (la sélection renvoie au niveau 1 tant que M3 n'est pas fait)
- [ ] Niveau 2 `meandres` finalisé

En parallèle : `ui-screens` construit l'écran de fin et la base de style dès que le contrat UI est écrit.

## M3 — Progression : écrans et sauvegarde

Jouable : le parcours complet titre → sélection → niveau → fin → suivant, avec pause, options et sauvegarde persistante.

- [ ] `save/save.ts` (schéma v1, chargement tolérant, `recordRun`, `isUnlocked`, options, migration) et tests
- [ ] `app/flow.ts` (machine d'états des écrans) et tests ; `app/app.ts`
- [ ] Écrans titre (anneaux sonar en fond, « Appuyez sur une touche », Jouer, Options), sélection (10 cases, verrous, étoiles, total), pause (terrain masqué, Reprendre, Recommencer, Options, Quitter), options (volume, rémanence allongée, tremblement), victoire (générique, affiché après le dernier niveau disponible)
- [ ] Application des options en direct : volume sur `master`, rémanence via `SimOptions` au chargement du niveau, tremblement dans le rendu
- [ ] Pause automatique à la perte de focus ; gestion d'Échap sans double traitement
- [ ] `?unlock=1`, libellés des touches selon la disposition (`input/layout.ts`)

En parallèle : `ui-screens` réalise les cinq écrans pendant que le fil principal fait la sauvegarde et le flux.

## M4 — Oursins : coque et dangers (niveau 3)

Jouable : niveaux 1 à 3. On peut perdre la sonde et le niveau reprend au départ.

- [ ] `systems/hazards.ts` : contact, dégât, invulnérabilité, recul ; `lifecycle` : destruction, fondu, restauration de l'instantané de départ, stats conservées ; `?god=1`, F3, F4 ; tests
- [ ] Rendu : oursins (étoiles corail irrégulières), coque dans le HUD, clignotement, vignette de dégât, tremblement (option), implosion et fondu
- [ ] Sons : écho d'oursin (crépitement), dégât, alarme de coque critique, destruction, reprise
- [ ] Validation : oursins bloquants pour l'atteignabilité, W06
- [ ] Niveau 3 `oursins`

## M5 — Courants (niveau 4)

Jouable : niveaux 1 à 4.

- [ ] `systems/currents.ts` : poussée sur la sonde (les leurres suivront en M7), tests
- [ ] Révélation des courants en stries qui dérivent
- [ ] Son : souffle continu tant qu'on est dans un courant (`AmbientModel`)
- [ ] Validation : sens unique si `strength ≥ thrust`, tests
- [ ] Niveau 4 `courants`

## M6 — Le Guetteur (niveau 5)

Jouable : niveaux 1 à 5. Le Guetteur erre, entend, fonce vers l'origine du bruit, fouille et blesse.

- [ ] `sim/nav.ts` (Dijkstra, profils son et nage, cache, version des portes) et tests
- [ ] `systems/noise.ts` (écoute par distance de chemin) ; bruits des impulsions et des chocs ; événement `noise`
- [ ] `systems/guetteur.ts` : errance, alerte, chasse, fouille, retrait, cliquetis, contact ; tests (pas d'écoute à travers la roche, cible = origine du bruit, déterminisme)
- [ ] Rendu : image rémanente figée (silhouette et liseré) ; overlay F1 avec états, cibles et cercles d'écoute
- [ ] Sons : écho de créature, cliquetis de proximité, grognement d'alerte positionné, tension de chasse
- [ ] Validation : E12, W05
- [ ] Niveau 5 `le-guetteur`

## M7 — Leurres (niveau 6)

Jouable : niveaux 1 à 6.

- [ ] `systems/lures.ts` : capsules, réserve, lancer (E), rebonds, dérive dans les courants, pings et bruit ; clic sans leurre ; tests
- [ ] Rendu : capsules, leurre en vol, anneaux de ping ivoire à travers les parois ; « Leurres n » dans le HUD
- [ ] Sons : lancer, rebond, ping, capsule ramassée, écho de capsule
- [ ] Validation : W03
- [ ] Niveau 6 `leurres` (2 Guetteurs, 3 capsules)

## M8 — Vannes et points de contrôle (niveau 7)

Jouable : niveaux 1 à 7. Leviers, portes et reprise au point de contrôle.

- [ ] `systems/doors.ts` : leviers, ouverture progressive, géométrie désactivée, bruit de porte, invalidation de `nav` ; tests
- [ ] Points de contrôle : activation, instantané, reprise (perles perdues après le point, stats conservées), « Revenir au point de contrôle » dans la pause ; tests
- [ ] Rendu : portes hachurées, leviers, halo des points de contrôle actifs
- [ ] Sons : levier, grondement de porte positionné, point de contrôle, écho métallique
- [ ] Validation : E09, E10, point fixe des portes, E08 pour les leviers et points de contrôle ; tests
- [ ] Niveau 7 `vannes`

## M9 — Vase (niveau 8)

Jouable : niveaux 1 à 8.

- [ ] Vase : frottement de la sonde, Guetteur ralenti, coût du son dans `nav` ; tests (absorption déjà faite en M1)
- [ ] Rendu : l'anneau s'éteint net sur la vase, aucun dessin de vase hors debug
- [ ] Son : étouffement quand la sonde est dans la vase (`AmbientModel.inMud`)
- [ ] Validation : E11 (perle dans la vase)
- [ ] Niveau 8 `vase`

## M10 — Batterie faible (niveau 9)

Jouable : niveaux 1 à 9.

- [ ] `systems/energy.ts` : coût, recharge, refus ; activation par `LEVELS[slug].overrides` ; tests
- [ ] HUD : jauge d'énergie (clignote au refus)
- [ ] Son : refus pour manque d'énergie, distinct du refus pendant la recharge
- [ ] Niveau 9 `batterie-faible`

## M11 — Le Léviathan et la victoire (niveau 10)

Jouable : le jeu complet, du titre à la victoire.

- [ ] `systems/leviathan.ts` : réveil, poursuite permanente, élan à chaque impulsion et fraction au choc, contact fatal, replacement à la reprise ; tests
- [ ] Rendu : corps segmenté le long de sa traîne, image rémanente
- [ ] Son : drone qui dépend de la distance de chemin, réveil
- [ ] Validation : E13
- [ ] Écran de victoire final (textes, totaux) après le niveau 10
- [ ] Niveau 10 `leviathan`

## M12 — Finition

Jouable : version livrable (`npm run build`, puis `dist/` servi en statique).

- [ ] Passe d'équilibrage guidée : un tableau des par et intervalles actuels, et les points à tester à la main pour l'auteur
- [ ] Performance : trace Chrome sur le niveau le plus lourd, budgets d'ARCHITECTURE § 12 tenus, pas de ramasse-miettes visible
- [ ] Accessibilité : rémanence allongée vérifiée sur tous les niveaux, focus visible partout, textes lisibles à 1280 × 720
- [ ] Polish visuel : bruit léger sur les sommets de paroi, scintillement des perles, anneaux du titre
- [ ] Polish sonore : équilibre du mixage, ambiance, limites de voix sous charge
- [ ] Relecture des textes de l'UI ; `README.md` (comment jouer, comment équilibrer)
- [ ] `npm run build` puis `npm run preview` : parcours complet sans erreur
