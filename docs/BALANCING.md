# ÉCHO — passe d'équilibrage

Point de départ pour l'équilibrage fait en jouant. Les valeurs font foi dans `src/data/tuning.ts` (`TUNING` global, `LEVELS` par niveau) : ce tableau en est une photographie au 29 septembre 2026. Pendant `npm run dev`, enregistrer `tuning.ts` relance le niveau en cours.

## 1. Valeurs actuelles par niveau

« Chemin » : plus court chemin du départ à la balise, portes ouvrables ouvertes (validateur). « Suggestion » : par suggéré par le validateur. W04 exige un par compris entre 0,5 et 2 fois la suggestion.

| # | Slug | Taille | Chemin | Suggestion | Par | Balise | Surcharges |
|---|---|---|---|---|---|---|---|
| 1 | `premier-echo` | 44 × 20 | 55 | 14 | 10 | 2 s | — |
| 2 | `meandres` | 52 × 34 | 66 | 16 | 9 | 3 s | — |
| 3 | `oursins` | 60 × 32 | 79 | 19 | 11 | 3,5 s | — |
| 4 | `courants` | 64 × 38 | 76 | 19 | 11 | 4 s | — |
| 5 | `le-guetteur` | 68 × 39 | 98 | 24 | 12 | 4 s | Guetteur : ouïe 8, chasse 3,2 |
| 6 | `leurres` | 70 × 44 | 100 | 24 | 12 | 4,5 s | — |
| 7 | `vannes` | 100 × 54 | 133 | 32 | 20 | 5 s | — |
| 8 | `vase` | 90 × 54 | 125 | 30 | 15 | 5,5 s | Guetteur : chasse 3,8 |
| 9 | `batterie-faible` | 104 × 60 | 213 | 51 | 26 | 6 s | énergie ; Guetteur : ouïe 10, chasse 3,9 |
| 10 | `leviathan` | 120 × 44 | 173 | 42 | 21 | 3 s | énergie, recharge 6/s |

Valeurs globales qui pèsent le plus : Guetteur ouïe 9, errance 6 cases, chasse 3,6 cases/s ; intensités des bruits (impulsion courte 1, longue 2, leurre 1,6, porte 1,2) ; énergie 100, recharge 4/s ; Léviathan 1 case/s + 0,3 par minute, élan 2 par impulsion.

Les par des niveaux 7 à 10 sont plus hauts que ceux des premiers niveaux parce que ces niveaux sont deux à trois fois plus longs (décision D48). Le par des niveaux 6, 9 et 10 est au plancher de W04 : le baisser demande de raccourcir le niveau.

## 2. À tester à la main

### Pour tous les niveaux

- Le par : une partie qui connaît le niveau le tient-elle avec un peu de marge, et une première partie le dépasse-t-elle nettement ?
- La balise : son intervalle suffit-il à s'orienter sans devenir un bruit de fond ?
- Rémanence allongée (Options) : chaque niveau reste-t-il jouable, et la tension demeure-t-elle ?
- Les grandes salles se lisent-elles avec l'impulsion courte, ou faut-il trop de longues ?

### Niveau 6 — Leurres

- Salle du premier Guetteur : le leurre lancé depuis le couloir nord tombe à 3 cases de son point de lancer, et le Guetteur fouille dans un rayon de 3. Faut-il partir vers le nord dès le grognement ? Est-ce lisible, ou trop serré ?
- Salle sûre : un joueur qui descend la galerie ouest juste après avoir lancé arrive au carrefour avant le premier ping (environ 5 s). Les cliquetis et le grognement suffisent-ils à apprendre qu'il faut attendre ?
- Perles risquées (niche du passage, perle du sud) : trop punitives, ou trop faciles ?
- La cavité latérale est juste sous le seuil d'écoute d'un leurre (14,3 cases pour 14,4). Si l'ouïe, l'errance ou l'intensité du leurre changent, revérifier avec `npm run validate-levels -- --verbose leurres`.

### Niveau 7 — Vannes

- Porte B : le Guetteur 1 arrive en 3,3 s et fouille jusqu'à environ 10 s ; le retour du levier b prend 6 à 8 s. Le trouve-t-on bien en train de fouiller ?
- Le leurre porte à 3 ou 4 cases : depuis l'antichambre, il ne peut pas attirer le Guetteur loin de la porte. Le choix réel est d'attendre puis de traverser la caverne avec un leurre. Cela suffit-il ?
- Passages délicats : perle du remous près d'un oursin, passage d'une case entre deux oursins devant le levier c, gorge de courant (19 rangées) qui peut paraître monotone.
- Chambre de la balise et salle du levier c : trop vides ?

### Niveau 8 — Vase

- Le gué (8 cases de vase) à côté de l'antre du Guetteur 1 : la fuite dans la vase est lente. Est-ce tendu mais juste ?
- Champ de vase de la deuxième salle : traverser à l'aveugle ou faire le détour nord. Les deux choix se valent-ils ?

### Niveau 9 — Batterie faible

- Coude du canal : l'oursin ne doit toucher que ceux qui foncent.
- Caverne du Guetteur 1 (16 × 22) : en longeant les parois, on passe à 7 ou 8 cases de lui. Tendu mais juste ?
- Marais : s'orienter à l'aveugle après le gué, en longeant la paroi sud près du Guetteur 2.
- Levier b : le trouve-t-on en suivant la paroi sud jusqu'au coin ?
- Énergie : une partie connue d'environ 2 minutes permet à peu près 29 impulsions pour un par de 26. Le par pousse-t-il vraiment à se retenir ?

### Niveau 10 — Le Léviathan

- Course : un pilote qui connaît le chemin (37 s, sans hésiter) garde le Léviathan à plus de 28 cases, même en émettant toutes les 2 s. Toute la pression vient donc des hésitations d'une première partie. Est-elle suffisante, ou trop forte avec l'élan ?
- Reprise au point de contrôle : le replacement à 14 cases laisse-t-il le temps de repartir ?
- Le drone qui enfle à l'approche : se lit-il comme une alarme ?
