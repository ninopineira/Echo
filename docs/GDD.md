# ÉCHO — document de conception

Document de référence pour les règles, le contenu et le style du jeu. Si l'implémentation doit s'en écarter, on met ce document à jour dans le même changement.
Les valeurs numériques sont dans `src/data/tuning.ts`. Ce document en donne l'intention et renvoie aux clés entre `backticks`.

## 1. Intention

On pilote une petite sonde dans des grottes sous-marines plongées dans le noir total. On ne voit pas le décor. Pour percevoir les parois, on émet des impulsions sonar : un anneau se propage, illumine brièvement ce qu'il touche, puis tout s'efface. Chaque impulsion fait du bruit, et les créatures aveugles des abysses chassent au son.

Les trois piliers, qui servent à trancher toute question de conception :

1. **Voir, c'est être entendu.** Toute information visuelle a un coût sonore. Aucune mécanique ne doit permettre de voir gratuitement le décor.
2. **Le son est une information.** Les échos, la balise, les grognements et les cliquetis disent où sont les choses. Un joueur attentif doit pouvoir s'orienter à l'oreille.
3. **Mémoire et anticipation.** Entre deux impulsions, on nage de mémoire. Les niveaux offrent des formes reconnaissables et récompensent un itinéraire planifié.

Objectif de chaque niveau : atteindre la balise de sortie, qui émet d'elle-même un faible signal périodique servant de repère.

## 2. Contrôles

Clavier uniquement, par **position physique** des touches (`KeyboardEvent.code`) : ZQSD en AZERTY et WASD en QWERTY correspondent aux mêmes touches.

| Action | Touches |
|---|---|
| Nager | ZQSD / WASD (codes `KeyW` `KeyA` `KeyS` `KeyD`), flèches |
| Impulsion courte | Espace, appui bref |
| Impulsion longue | Espace maintenu (`pulse.longChargeTime`, ≈ 1 s) |
| Lancer un leurre | E (`KeyE`) |
| Pause / retour | Échap |
| Menus | flèches ou ZQSD/WASD, Entrée ou Espace pour valider, Échap pour revenir |

- La diagonale est normalisée : on ne nage pas plus vite en diagonale.
- Si la fenêtre perd le focus, le jeu se met en pause et toutes les touches sont relâchées.
- Les consignes à l'écran affichent les lettres réelles de la disposition quand le navigateur les fournit (`navigator.keyboard.getLayoutMap`), et sinon « ZQSD / WASD ».

## 3. Règles

### 3.1 Sonde et déplacement

- Nage inertielle vue de dessus : la poussée accélère (`probe.thrust`), l'eau freine proportionnellement à la vitesse (`probe.drag`). Relâcher les touches laisse glisser la sonde jusqu'à l'arrêt.
- La sonde est un disque (`probe.radius`). Contre une paroi, la composante normale de la vitesse est annulée (léger rebond `probe.wallRestitution`) et la composante tangentielle est conservée : **la sonde glisse le long des parois** au lieu de s'arrêter net.
- Un choc dont la vitesse normale dépasse `probe.bumpMinSpeed` :
  - produit un petit bruit, proportionnel à la vitesse d'impact (au plus `probe.bumpLoudnessMax`), que les créatures peuvent entendre ;
  - révèle un petit arc de paroi autour du point de contact (`probe.bumpRevealRadius`), en rémanence courte. Toucher, c'est percevoir localement.
- La direction de la sonde (pour l'affichage et le lancer de leurre) est celle de la dernière poussée non nulle.

### 3.2 Impulsion sonar

**Déclenchement** (machine d'état testée dans la simulation) :

- On appuie sur Espace et la charge commence ; un anneau de charge se remplit autour de la sonde.
- Si on relâche avant `pulse.longChargeTime`, une impulsion courte part au relâchement.
- Si on atteint `pulse.longChargeTime`, l'impulsion longue part automatiquement, sans attendre le relâchement.
- Un appui et un relâchement survenus entre deux pas de simulation produisent quand même une impulsion courte : aucun appui bref n'est perdu.
- La recharge est commune aux deux impulsions et sa durée dépend du type de la dernière émise (`pulse.short.cooldown`, `pulse.long.cooldown`). Pendant la recharge, appuyer ne fait rien, à part un petit « clic » sec et le signal visuel de la recharge.
- Avec l'énergie (niveaux 9 et 10), une impulsion coûte `energyCost`. Sans assez d'énergie, elle ne part pas : on entend un clic sec, la jauge clignote et le compteur n'augmente pas.

| | Courte | Longue |
|---|---|---|
| Rayon | moyen (`pulse.short.radius`, ≈ la moitié de la hauteur de vue) | bien plus grand (`pulse.long.radius`) |
| Rémanence | 2 à 3 s (`afterglow`) | plus longue |
| Bruit | modéré (`loudness` 1) | fort (`loudness` 2) |
| Recharge | courte | longue |

**Propagation** :

- À l'émission, la simulation lance `pulse.rayCount` rayons en étoile depuis la sonde, contre la géométrie de l'instant (portes fermées incluses). Chaque rayon s'arrête sur la première paroi ou porte, ou se perd dans la vase, ou atteint le rayon maximal.
- L'anneau visible avance à la vitesse `speed`. Dans chaque direction, il s'arrête là où son rayon s'est arrêté. L'anneau ne passe donc jamais derrière une paroi : seul ce qui est en ligne de vue depuis le point d'émission est révélé.
- Quand le front atteint une surface, elle s'illumine avec un éclat bref (`pulse.flashTime`), puis s'efface progressivement pendant `afterglow`. L'option « Rémanence allongée » multiplie toutes les rémanences par `accessibility.longAfterglowMultiplier`.
- Les objets (perles, oursins, créatures, leviers, portes, capsules, points de contrôle, courants) sont révélés quand le front passe sur eux (bande `pulse.revealBand`) et qu'ils sont en ligne de vue. Les objets ne bloquent pas les rayons. Seules la roche et les portes fermées les arrêtent, et la vase les absorbe.
- Un objet mobile (créature, leurre en vol) laisse une **image rémanente figée** à l'endroit où le front l'a touché. On voit où il *était*, pas où il est.
- La sonde elle-même est toujours visible. Le décor ne l'est jamais sans impulsion (ni lampe, ni lueur ambiante).

### 3.3 Écho sonore

Chaque impulsion renvoie des échos qui informent réellement :

- **Délai** : aller-retour à la vitesse du front, soit `2 × distance / speed`. Une paroi proche répond vite, une paroi lointaine tard.
- **Volume** : décroît avec la distance, et dépend de la réflectivité de la surface.
- **Balance stéréo** : suit la composante horizontale de la direction (paroi à gauche → oreille gauche).
- **Brillance** : un filtre rend plus clairs les échos venant du haut de l'écran et plus sourds ceux du bas, ce qui lève l'ambiguïté avant/arrière.
- **Timbre selon la surface** : roche = « toc » boisé, porte = tintement métallique, oursin = crépitement, perle = tintement cristallin, créature = grondement mat, levier = clic sec, capsule = petit cliquetis creux.
- **Silence** : une direction sans surface à portée, ou absorbée par la vase, ne renvoie rien. Une grande salle sonne clairsemé et tardif, un couloir sonne dense et rapide.

Pour rester lisible, chacun des `echo.sectors` secteurs angulaires renvoie un seul écho de paroi (la surface la plus proche du secteur). Au plus `echo.maxEntityEchoes` objets, les plus proches, ajoutent leur propre écho. La simulation calcule ces échos à l'émission (données testables), et l'audio les planifie avec l'horloge Web Audio.

### 3.4 Bruit et écoute

Sources de bruit et intensité (`loudness`, multiplicateur du rayon d'écoute) : impulsion courte (1), impulsion longue (2), choc contre une paroi (≤ 0,4), ping de leurre (`lure.loudness`), porte qui s'ouvre (`lever.doorLoudness`).
La balise de sortie et les points de contrôle ne font pas de bruit pour les créatures.

- Le son se propage **par l'eau, pas à travers la roche** : la distance d'écoute est une distance de chemin sur la grille. La vase coûte `mud.soundCostMultiplier` fois plus cher et les portes fermées bloquent le son.
- Une créature entend un bruit si sa distance de chemin à la source est inférieure ou égale à `hearingRadius × loudness`.
- Conséquence voulue : on ne peut pas voir une créature sans risquer d'être entendu, puisque la portée de l'impulsion et celle de l'écoute sont du même ordre. Le jeu consiste à émettre, puis à changer de place.

### 3.5 Intégrité, dégâts, reprise

- La coque a `probe.hullMax` points (3). Un oursin ou un Guetteur en retire 1. Le Léviathan détruit la sonde d'un coup.
- Après un dégât : recul (`probe.knockback`), invulnérabilité (`probe.invulnerability`) pendant laquelle la sonde clignote, flash corail en bord d'écran et tremblement si l'option est active.
- À zéro, la sonde implose et, après un fondu au noir, le niveau reprend au **dernier point de contrôle activé**, ou au départ s'il n'y en a pas. La coque est pleine, les impulsions en cours sont effacées.
- La reprise restaure l'état du niveau tel qu'il était à l'activation du point de contrôle : perles ramassées, portes ouvertes, leurres en réserve, créatures. Les perles prises après ce point sont donc perdues.
- Les statistiques de la tentative (impulsions, temps, pertes de sonde) ne sont **jamais** restaurées : mourir ne rembourse pas les impulsions.

### 3.6 Balise de sortie, fin de niveau

- La balise émet un signal vert toutes les `LEVELS[slug].beaconInterval` secondes : un petit anneau (`beacon.pingRadius`) visible **à travers les parois**, et un son positionné (direction et distance). Elle ne révèle aucun décor.
- Si la balise est hors champ au moment d'un signal, un repère vert apparaît brièvement au bord de l'écran, dans sa direction (`beacon.offscreenIndicator`).
- Toucher la balise (`exit.radius`) termine le niveau. La balise s'illumine, la simulation s'arrête, et l'écran de fin s'ouvre après un court fondu.

### 3.7 Perles

- Objets optionnels, invisibles hors impulsion. On les ramasse au contact (`pearl.radius`) avec un son scintillant.
- Chaque niveau en contient au moins une, pour que l'étoile des perles ne soit jamais automatique. Aucune perle dans la vase, où elle serait impossible à révéler.

### 3.8 Éléments de niveau

| Élément | Règle |
|---|---|
| **Oursin** | Fixe. Au contact (`hazard.radius`) : −1 coque. Révélé en corail. |
| **Courant** | Chaque case pousse la sonde et les leurres dans sa direction (`current.strength`). Il n'agit pas sur les créatures. Si `strength < probe.thrust`, on peut le remonter lentement, sinon il est infranchissable à contre-sens (le validateur en tient compte). Révélé sous forme de **stries** orientées qui dérivent pendant la rémanence. Un souffle discret se fait entendre tant qu'on est dedans. |
| **Vase** | Traversable, mais freine fortement (`mud.dragMultiplier`). Absorbe les rayons, sans écho ni révélation, et n'est jamais dessinée : on la devine à l'absence de retour et à l'anneau qui s'y éteint. Une impulsion émise depuis la vase est entièrement absorbée, mais le bruit part quand même. La vase étouffe aussi la propagation du son. |
| **Capsule de leurre** | Ramassée au contact, jusqu'à `lure.maxCarried`. E lance le leurre dans la direction de la sonde (`lure.throwSpeed`). Le leurre rebondit sur les parois, dérive avec les courants, puis s'immobilise et émet `lure.pings` pings audibles (`lure.loudness`) avant de s'éteindre. Chaque ping se voit comme un petit anneau ivoire à travers les parois, sans rien révéler. Sans leurre, E produit un clic sec. |
| **Levier / porte** | Un levier (lettre minuscule) s'actionne au contact et ouvre définitivement toutes les portes de même lettre (majuscule) en `lever.doorOpenTime`. Une porte fermée bloque la sonde, les rayons et le son, et renvoie un écho métallique. L'ouverture fait du bruit à l'emplacement de la porte : on l'entend de loin, les créatures aussi. |
| **Point de contrôle** | S'active au contact (`checkpoint.radius`), avec un accord doux et un halo vert discret qui reste ensuite visible. C'est le point de reprise (§ 3.5). |
| **Énergie** | Niveaux 9 et 10 (`energy.enabled`). Chaque impulsion coûte `energyCost`. La réserve (`energy.max`) se recharge lentement (`energy.regen`). La jauge n'apparaît que dans ces niveaux. |

### 3.9 Créatures

**Guetteur** : aveugle, il chasse au son.

| État | Comportement | Sortie |
|---|---|---|
| Errance | Nage lentement (`wanderSpeed`) vers des points tirés au hasard (RNG à graine), atteignables dans `wanderRadius` autour de son point d'apparition, et marque des pauses. | Entend un bruit → Alerte |
| Alerte | S'immobilise `alertDelay` et pousse un **grognement** positionné : le joueur sait qu'il a été entendu, et d'où. | → Chasse |
| Chasse | Fonce (`huntSpeed`) vers l'**origine du bruit** en suivant le chemin, pas vers la sonde. Un nouveau bruit entendu remplace la cible. | Arrivé → Fouille |
| Fouille | Rôde autour de la cible (`searchRadius`) pendant `searchDuration`. | Bruit → Alerte ; délai écoulé → Errance |
| Retrait | Après avoir touché la sonde, s'éloigne pendant `retreatDuration`. | → Errance |

- Au contact, il retire `damage` point de coque.
- Il émet de faibles **cliquetis** de nage toutes les `clickInterval` secondes, audibles à moins de `clickRange`, sans rien révéler : on sent qu'il est proche.
- Il est plus lent que la sonde lancée, ce qui permet de fuir si l'on réagit.

**Léviathan** (niveau 10) : immense (`leviathan.radius`), il est la course contre la montre du jeu.

- Il dort jusqu'à `wakeDelay` ou jusqu'à la première impulsion. Ensuite, il suit **en permanence** le chemin vers la sonde à `baseSpeed`, une vitesse qui augmente avec le temps (`speedGainPerMinute`).
- Il entend **toutes** les impulsions, quelle que soit la distance. Chacune lui donne un élan (`surgeSpeed`, qui décroît en `surgeDecay`), et un choc contre une paroi lui en donne une fraction.
- Son contact détruit la sonde. Un grondement grave, dont le volume dépend de la distance de chemin, annonce son approche.
- À la reprise au point de contrôle, il est replacé à au moins `respawnDistance` de la sonde, en arrière sur son chemin.
- Il navigue sur la grille des cases d'eau. Son corps, dessiné plus large, peut déborder visuellement sur les parois.

### 3.10 Étoiles et statistiques

Trois étoiles par niveau, gagnées indépendamment :

1. **Balise atteinte** : terminer le niveau.
2. **Toutes les perles** : toutes les perles du niveau sont ramassées au moment d'atteindre la balise.
3. **Par** : terminer en émettant au plus `LEVELS[slug].par` impulsions, courtes et longues confondues. Les leurres ne comptent pas.

Les étoiles se **cumulent d'une tentative à l'autre** : on peut obtenir les perles lors d'une partie et le par lors d'une autre. Les statistiques affichées en fin de niveau sont le temps, les impulsions par rapport au par, les perles ramassées sur le total et les pertes de sonde. Le meilleur temps et le meilleur nombre d'impulsions sont conservés.

### 3.11 Progression et sauvegarde

- Dix niveaux joués dans l'ordre. Le niveau 1 est toujours ouvert, et terminer le niveau N débloque le niveau N + 1.
- La sauvegarde est locale (`localStorage`) : niveaux terminés, étoiles, records et options. Elle est indexée par slug de niveau et versionnée. Une sauvegarde corrompue ou inconnue repart des valeurs par défaut sans planter.

## 4. Écrans et interface

Parcours : Titre → Sélection → Jeu ⇄ Pause → Fin de niveau → (niveau suivant | Sélection). Les options sont accessibles depuis le titre et la pause. L'écran de victoire s'affiche après la fin du niveau 10.

| Écran | Contenu |
|---|---|
| **Titre** | Logo « ÉCHO » et une phrase : « Voir, c'est être entendu. » En fond, des anneaux sonar révèlent une silhouette de grotte décorative (canvas). « Appuyez sur une touche », qui débloque l'audio, puis les choix Jouer et Options. |
| **Sélection** | Grille de 10 cases (5 × 2) : numéro simple (« 1 », pas « 01 »), nom, trois étoiles pleines ou vides, verrou dessiné pour les niveaux fermés. Total d'étoiles « 14 / 30 ». Navigation au clavier et à la souris, Échap pour revenir au titre. |
| **Jeu** | Canvas plein écran et HUD. Au début du niveau, le nom et la consigne (`hint`) apparaissent puis s'effacent en ~4 s, sans bloquer le jeu. |
| **Pause** | Masque le terrain (voile opaque à ~85 %, pour qu'on ne puisse pas étudier la rémanence à l'arrêt). Choix : Reprendre, Revenir au point de contrôle (si un point est actif), Recommencer le niveau, Options, Quitter vers la sélection. |
| **Fin de niveau** | « Balise atteinte », les statistiques avec « nouveau record » s'il y a lieu, puis les trois étoiles qui s'allument une à une. Choix : Niveau suivant (focus par défaut), Rejouer, Sélection. |
| **Victoire** | Après le niveau 10 : texte de clôture court, total d'étoiles et de perles, retour à la sélection. |
| **Options** | Volume (0–100 %, par pas de 5 au clavier), Rémanence allongée (oui/non), Tremblement de l'écran (oui/non), Retour. Les réglages s'appliquent et s'enregistrent immédiatement. |

**HUD** (dessiné sur le canvas, discret, cyan à faible opacité) :

- en haut à gauche, la coque : trois segments qui virent au corail quand ils sont perdus ;
- en haut à droite, « Impulsions 4 / 10 », qui passe en corail au-delà du par, et « Perles 2 / 5 » ;
- « Leurres 2 », seulement dans les niveaux qui contiennent des capsules ;
- autour de la sonde, un arc de recharge et un anneau de charge de l'impulsion longue, directement dans la scène ;
- en bas à gauche, la jauge d'énergie, seulement quand `energy.enabled`.

Ton des textes : phrases courtes, verbes simples, pas de jargon. Tous les textes de l'interface sont en français et centralisés dans `src/ui/strings.ts`.

## 5. Direction artistique

Ambiance abyssale, à la fois sombre et lumineuse : le noir domine, et la lumière n'existe que là où le son a touché.

| Rôle | Couleur | Règle |
|---|---|---|
| Fond | `#04070C` | uniforme, sans texture visible |
| Parois révélées | `#5CE1E6` | traits fins avec un léger halo |
| Dangers | `#FF5A4E` | oursins, dégâts, par dépassé |
| Perles | `#F4EBD0` | ivoire, petit reflet |
| Balise de sortie | `#7CFFB2` | seul élément visible sans impulsion (à part la sonde) |
| Créatures | `#8A1F2B` | visibles seulement quand l'anneau les touche, liseré `creatureRim` |

Couleurs dérivées et UI : `src/data/palette.ts`.

**Rendu du jeu** :

- **Parois** : les points d'impact des rayons sont reliés en polylignes, sauf si deux impacts voisins sont trop éloignés (discontinuité). On obtient des contours « scannés ». Le halo est fait de trois traits superposés (large et transparent, moyen, fin et opaque) en mode additif. Au contact, un éclat blanc-cyan apparaît, puis la couleur s'efface avec une courbe douce.
- **Front d'onde** : un trait cyan fin qui s'estompe avec le rayon et s'interrompt dans chaque direction où son rayon s'est arrêté.
- **Oursins** : étoiles corail à 8–10 pointes, légèrement irrégulières (aléa à graine par instance).
- **Perles** : petits disques ivoire avec reflet, qui scintillent pendant qu'elles sont révélées.
- **Balise** : losange vert, et un anneau qui s'élargit à chaque signal.
- **Guetteur** : silhouette allongée d'anguille ou de baudroie, orientée selon sa vitesse au moment où il est touché. **Léviathan** : corps immense et segmenté, dessiné le long de sa traîne de positions.
- **Courants** : stries courtes, cyan plus pâle, orientées dans le sens du flux et qui dérivent. **Portes** : rectangles hachurés en cyan, pour distinguer le construit de l'organique. **Leviers**, **capsules** et **points de contrôle** : petits glyphes ivoire ou cyan. **Vase** : jamais dessinée.
- **Sonde** : goutte blanc bleuté orientée, avec un halo doux. Elle clignote pendant l'invulnérabilité et implose en flash à la destruction.
- **Caméra** : elle suit la sonde avec un amortissement (`camera.followStiffness`) et montre `camera.visibleTilesY` cases en hauteur. Tremblement (`shake.*`) sur les dégâts et les impulsions longues, désactivable.
- La forme des parois vient d'un contour lissé de la grille : les coins sont coupés à 45°, pour faire une grotte et non un damier. Le rendu peut ajouter un très léger bruit sur les sommets, à condition que la collision reste exacte.

**Menus** :

- Police **Chakra Petch** partout (titres en 600, texte en 400), embarquée localement. Échelle typographique : titre ~96 px, titres d'écran ~32 px, texte ~18 px, secondaire ~14 px.
- Fond `#04070C`, panneaux `panel` avec un filet `line`. Boutons rectangulaires à **coins chanfreinés** (angle coupé), en casse normale. Focus clavier très visible : contour cyan et petite marque sonar.
- Un seul moment de mise en scène par écran : les anneaux sonar du titre, ou les étoiles qui s'allument en fin de niveau. Pas d'animations d'entrée sur chaque élément.
- **À proscrire** : fonds crème ou blanc cassé, dégradés violets, boutons en pilule, étiquettes numérotées « 01 / 02 / 03 », étiquettes en police monospace, mots d'accent en italique, polices Inter, Roboto ou Arial.

## 6. Audio

Tout est synthétisé avec la Web Audio API (oscillateurs, bruit généré, filtres, réverbération à réponse impulsionnelle générée). Il n'y a pas de musique : une ambiance sous-marine grave (grondement filtré, craquements lointains rares) sert de lit sonore.

| Événement | Intention sonore | Information portée |
|---|---|---|
| Impulsion courte / longue | ping sonar net et clair / plus grave, plus long et plus riche | type d'impulsion |
| Échos | voir § 3.3 | forme et nature du décor |
| Charge de l'impulsion longue | bourdonnement qui monte | moment du déclenchement |
| Impulsion refusée (recharge ou énergie) | clic sec | action impossible |
| Signal de la balise | double note douce, positionnée | direction et distance de la sortie |
| Choc contre une paroi | bruit sourd, proportionnel à la vitesse | on a fait du bruit |
| Perle | scintillement ascendant | ramassage |
| Dégât / coque critique | craquement et alarme brève / pulsation grave continue à 1 point | danger |
| Destruction / reprise | implosion / remontée | — |
| Guetteur : cliquetis, alerte, chasse | cliquetis de proximité, grognement positionné, souffle rapide | présence, « il m'a entendu », poursuite |
| Léviathan | drone grave dont le volume dépend de la distance | urgence |
| Leurre : lancer, ping | glissement, pings creux positionnés | où le leurre attire |
| Levier, porte | clac sec, grondement métallique positionné | où la porte s'est ouverte |
| Point de contrôle, fin de niveau, étoiles | accord doux, résolution, trois notes | progression |
| Interface | tic de navigation, validation | — |

Le volume des options agit sur le bus principal. La pause coupe progressivement le bus de jeu mais laisse le bus d'interface actif.

## 7. Niveaux

### 7.1 Principes

- Chaque niveau apporte un élément nouveau, présenté d'abord **sans risque**, puis appliqué, puis combiné avec les éléments précédents.
- Leviers de difficulté : taille, intervalle de la balise, nombre, vitesse et ouïe des créatures, valeur du par, densité de dangers.
- Des repères mémorisables (piliers, niches, formes singulières) valent mieux que de longs couloirs uniformes. Les grands vides silencieux sont réservés aux leçons voulues.
- La sortie n'est jamais en ligne droite visible depuis le départ.
- Les zones de créatures ont des passages d'au moins 2 cases de large. Aucune créature ne doit pouvoir entendre une impulsion courte émise depuis le départ ou depuis un point de contrôle.
- Les règles de construction vérifiées automatiquement sont listées dans `docs/LEVEL_FORMAT.md`.

### 7.2 Courbe de difficulté

Valeurs de départ. Les valeurs exactes sont dans `LEVELS` de `src/data/tuning.ts`.

| # | Slug | Nouveauté | Taille indicative | Balise | Créatures | Points de contrôle |
|---|---|---|---|---|---|---|
| 1 | `premier-echo` | nage, impulsion courte, balise | 44 × 20 | 2 s | — | 0 |
| 2 | `meandres` | impulsion longue, perles hors chemin | 52 × 34 | 3 s | — | 0 |
| 3 | `oursins` | oursins, coque | 60 × 32 | 3,5 s | — | 0 |
| 4 | `courants` | courants | 64 × 38 | 4 s | — | 0 |
| 5 | `le-guetteur` | Guetteur | 68 × 42 | 4 s | 1 (ouïe 8, lent) | 0 |
| 6 | `leurres` | leurres (3 capsules) | 76 × 46 | 4,5 s | 2 | 0 |
| 7 | `vannes` | leviers et portes, points de contrôle | 100 × 54 | 5 s | 2 | 2 |
| 8 | `vase` | vase | 90 × 54 | 5,5 s | 2–3 (plus rapides) | 2 |
| 9 | `batterie-faible` | énergie | 104 × 60 | 6 s | 3 (ouïe 10, rapides) | 3 |
| 10 | `leviathan` | Léviathan, course | 120 × 44 | 3 s | Léviathan + 2 | 2 |

Le par se resserre d'un niveau à l'autre, à mesure que le joueur maîtrise l'impulsion longue et la mémoire. La balise du niveau 10 revient à un rythme rapide : dans la course, elle guide sans faire de bruit.

### 7.3 Fiches

Chaque fiche donne l'intention et le déroulé. Le tracé exact revient au level design (skill `level-design`, agent `level-designer`). La consigne est le texte `hint` du niveau.

**1. Premier écho** (`premier-echo`) : apprendre à nager et à émettre.
1. Chambre de départ fermée, avec une seule issue. Le signal vert de la balise, au loin, est la première chose visible.
2. Couloir large (2–3 cases) avec deux coudes doux, pour apprendre à glisser le long des parois.
3. Une perle au milieu du couloir : l'impulsion révèle aussi les objets.
4. Rétrécissement à 1 case, pour la précision, puis une seconde perle.
5. Chambre de la balise.
Aucune bifurcation trompeuse, aucun danger.
Consigne : « Espace émet une impulsion. Rejoignez le signal vert. »

**2. Méandres** (`meandres`) : lire un labyrinthe et découvrir l'impulsion longue.
1. Départ dans un petit carrefour à trois branches.
2. Labyrinthe de couloirs de 1–2 cases, avec 5–6 carrefours. Trois perles au fond de culs-de-sac.
3. Grande salle (~14 × 10) dont les parois sont hors de portée d'une impulsion courte depuis l'entrée. Le silence enseigne l'impulsion longue. Deux perles le long des parois.
4. Issue de l'autre côté de la salle, repérable seulement avec l'impulsion longue.
Le par récompense l'usage de l'impulsion longue, qui compte pour une seule impulsion.
Consigne : « Maintenez Espace : l'impulsion longue porte bien plus loin. »

**3. Oursins** (`oursins`) : craindre le contact.
1. Chambre large avec trois oursins isolés au centre, loin des parois, faciles à contourner.
2. Couloir de 3 cases en slalom, avec des oursins alternés sur les bords.
3. Niche à perle gardée par des oursins : un risque optionnel.
4. Passage de 2 cases avec un oursin au centre : il faut ralentir.
Consigne : « Les oursins abîment la coque. Trois chocs et la sonde est perdue. »

**4. Courants** (`courants`) : se laisser porter, anticiper la dérive.
1. Canal large où un courant porte vers la suite. On sent la poussée, et l'impulsion montre les stries.
2. Traversée d'un courant latéral qui pousse vers une paroi bordée d'oursins : il faut prendre l'angle.
3. Couloir à contre-courant, lent à remonter, en alternative à un détour calme mais plus long.
4. Perles dans des remous, derrière les courants.
Consigne : « Les courants vous portent. L'impulsion les révèle en stries. »

**5. Le Guetteur** (`le-guetteur`) : émettre loin de lui, puis changer de place.
1. Départ dans une alcôve, puis un long couloir hors de portée d'écoute. Ses cliquetis deviennent audibles en approchant.
2. Points d'émission sûrs, à plus de `hearingRadius × 1` de son territoire, d'où l'on cartographie la traversée.
3. Galerie de 2 cases qui longe son territoire, à traverser de mémoire : émettre ici, c'est se faire entendre.
4. Si on se fait entendre, le grognement prévient et le Guetteur fonce vers le point d'émission. La géométrie permet de s'en éloigner.
5. Une perle dans sa caverne (risque), les autres en zone sûre. Zone calme avant la sortie.
Consigne : « Les créatures chassent au son. Émettez loin d'elles, puis changez de place. »

**6. Leurres** (`leurres`) : détourner l'attention.
1. Première capsule en zone sûre, près du départ.
2. Un premier Guetteur tient un passage étroit. Une cavité latérale, atteignable d'un lancer, permet de l'attirer ailleurs.
3. Deuxième capsule, puis un second Guetteur près d'un carrefour. Un courant peut emporter un leurre loin (combinaison avec le niveau 4).
4. Troisième capsule en réserve, près d'une perle risquée.
Consigne : « E lance un leurre. Son bruit attire les créatures. »

**7. Vannes** (`vannes`) : relier cause et effet à distance. Niveau plus long, avec points de contrôle.
1. Levier `a` et porte `A` dans la même salle : la cause et l'effet sont visibles.
2. Point de contrôle.
3. Levier `b` sur une branche éloignée de la porte `B`. Le grondement de la porte attire un Guetteur qui fouille devant à l'arrivée : attendre ou utiliser un leurre.
4. Point de contrôle.
5. Levier `c` derrière des oursins et un courant. La porte `C` garde la chambre de la balise.
Consigne : « Les leviers ouvrent des vannes ailleurs. Écoutez où elles grondent. »

**8. Vase** (`vase`) : lire l'absence.
1. Mare de vase dans une salle calme : l'anneau s'y éteint, et un « trou » apparaît dans la carte. La traversée est lente.
2. Champ de vase qui masque une partie de l'itinéraire. On dessine son contour par l'absence d'écho. Il faut choisir entre contourner et traverser lentement.
3. Territoire d'un Guetteur au bord d'une traversée de vase : fuir y est lent, donc il faut planifier. La vase étouffe aussi le son et offre des points d'émission abrités.
4. Aucune perle dans la vase.
Consigne : « La vase étouffe tout. Là où rien ne répond, elle vous attend. »

**9. Batterie faible** (`batterie-faible`) : économiser la vue.
1. La jauge d'énergie apparaît. Une première section calme laisse sentir la recharge lente.
2. Long niveau qui combine courants (pour avancer sans effort), vannes, vase, leurres et oursins, avec trois Guetteurs plus vifs.
3. Mémoire et balise sont les outils principaux. L'impulsion longue devient un luxe.
Consigne : « Chaque impulsion vide la batterie. Elle se recharge lentement. »

**10. Le Léviathan** (`leviathan`) : fuir.
1. Salle d'introduction calme. Le Léviathan dort loin en arrière, à au moins 20 cases de chemin du départ.
2. Il s'éveille, et son drone grandit avec la proximité.
3. Course sur un tracé allongé : courants porteurs, levier juste avant sa porte, vase à éviter ou à traverser, slalom d'oursins, deux Guetteurs à détourner.
4. Deux points de contrôle, avec la distance de reprise garantie.
5. La balise fréquente guide dans la dernière ligne droite. Écran de victoire.
Consigne : « Il entend chaque impulsion. Ne vous arrêtez pas. »

## 8. Hors périmètre

Multijoueur, serveur, éditeur de niveaux en jeu, version mobile ou tactile, manette, musique, localisation autre que le français, classements en ligne.
