# Video 003 — 55 sur deux broadway, une surcarte tombe, face à un reg

**Titre interne** : 55 sur deux broadway, une surcarte tombe, face à un reg
**Spot** : `turn-apres-call_btn_55_reg_deux-broadway_surcarte`
**Potentiel contenu** : 89/100

## Concept

Une main qui semble jouable ne l'est pas : payer coûte -10.53 bb, alors que passer est la bonne réponse.

**Objectif de rétention.** Retenir par la contradiction : le spectateur croit connaître la réponse au plan 1, choisit au plan 4, et découvre au plan 5 que son réflexe est chiffré comme une perte. Le plan 6 empêche le doute en montrant le calcul.

**Moment exact du reveal.** Plan 05-reveal, à l'affichage du verdict après l'action jouée.

---

## Ce que dit le moteur

- Le héros a **4.1 % d'équité**.
- L'action instinctive est **Suivre 4.50 €**, à **-10.53 bb**.
  Passer valant 0 par construction, ce coup coûte donc plus cher que de jeter la main.
- La meilleure action est **Passer**, à **0.00 bb**.
- **Différentiel d'EV : 10.53 bb.** Verdict de l'application : « erreur ».

### Espérance de chaque option

En big blinds, à partir de la décision. Passer vaut 0 : c'est la référence
commune, l'argent déjà investi étant ignoré pour toutes les options. Un chiffre
négatif signifie donc « pire que jeter la main ».

| option | espérance |
|---|---|
| Passer | 0.00 bb |
| Relancer Tapis | -0.29 bb |
| Relancer Pot | -0.36 bb |
| Relancer 1/3 pot | -0.42 bb |
| Suivre 4.50 € | -10.53 bb |

Ces valeurs sont celles affichées à l'écran dans `06-payoff.webm`. Elles
viennent de `Judge.evaluate`. Comme l'indique l'application elle-même, ce sont
des estimations sur la range adverse et les profils en jeu — un ordre de
grandeur et un classement, pas une sortie de solveur. Ne les présente pas
autrement.

---

## Ordre des rushs

| # | fichier | beat | durée | rôle |
|---|---|---|---|---|
| 1 | `01-hook.webm` | HOOK | 2.8 s | Montrer la main sans son contexte. |
| 2 | `02-situation.webm` | SITUATION | 5.1 s | Poser la table puis désigner le board, qui est le cœur du problème. |
| 3 | `03-tension.webm` | TENSION | 3.2 s | Isoler le montant à payer : c'est lui qui rend la décision coûteuse. |
| 4 | `04-choice.webm` | CHOICE | 4.1 s | Présenter les options légales et leurs montants exacts. |
| 5 | `05-reveal.webm` | REVEAL | 4.8 s | Jouer l'action instinctive (call) et afficher le verdict du moteur avec son coût. |
| 6 | `06-payoff.webm` | PAYOFF | 4.5 s | Montrer l'espérance de chaque option, en big blinds. |

**Durée totale de matière : 24.5 s.**


---

## Détail des plans

### `01-hook.webm` — HOOK · 2.8 s

Montrer la main sans son contexte. C'est le plan qui doit retenir dans les deux premières secondes.

**Mouvements et leur raison**

- *zoomIn* (0.8 s) — Resserrer sur les cartes isole la seule information utile à cet instant et coupe court à la lecture du reste de l'écran.

**Montage** — voix : Rien, ou une seule phrase courte. Le plan doit tenir par l'image. · sous-titres : Aucun — ils entreraient en concurrence avec les cartes. · textes : Une accroche très courte, en haut de la bande utile, hors des 10 % supérieurs.

### `02-situation.webm` — SITUATION · 5.1 s

Poser la table puis désigner le board, qui est le cœur du problème.

**Mouvements et leur raison**

- *zoomIn* (0.8 s) — Le board est ce qui rend la décision difficile : le rapprochement dit au spectateur où regarder avant qu'on lui pose la question.
- *zoomOut* (0.6 s) — Rendre le contexte après le détail : le spectateur doit relier le board aux tapis et au pot pour juger.

**Montage** — voix : Pose du contexte. C'est le plan le plus tolérant à la parole. · sous-titres : À partir d'ici, en bas de la bande utile. · textes : Rappel de position et de tapis si tu veux les souligner ; l'information est déjà à l'écran.

### `03-tension.webm` — TENSION · 3.2 s

Isoler le montant à payer : c'est lui qui rend la décision coûteuse.

**Mouvements et leur raison**

- *pan* (0.8 s) — Descendre sur la ligne du montant à payer conduit l'œil vers la donnée que le spectateur oublie de regarder : c'est elle qui rend la décision coûteuse.
- *freeze* (1.9 s) — L'arrêt franc laisse le temps de se forger un avis — sans ce temps mort, il n'y a pas de participation, donc pas de rétention.

**Montage** — voix : Silence recommandé sur le freeze. Le vide fait le travail. · sous-titres : La question, si tu veux la poser à l'écrit. · textes : C'est l'emplacement naturel d'un « tu fais quoi ? ». Ne masque pas le montant.

### `04-choice.webm` — CHOICE · 4.1 s

Présenter les options légales et leurs montants exacts. C'est ici que le spectateur choisit.

**Mouvements et leur raison**

- *pan* (0.9 s) — Descendre de la table vers les boutons reproduit le geste réel du joueur : le mouvement raconte le passage de l'observation à la décision.
- *fixe* (2.5 s) — Temps de lecture des options. Couper ici ferait perdre l'engagement que tout le plan sert à créer.

**Montage** — voix : Énoncé des options, ou silence complet pour laisser choisir. · sous-titres : Oui, courts. · textes : Éventuel compte à rebours. Ne recouvre pas les boutons : ce sont eux le sujet.

### `05-reveal.webm` — REVEAL · 4.8 s

Jouer l'action instinctive (call) et afficher le verdict du moteur avec son coût.

**Mouvements et leur raison**

- *jouer* — La décision est jouée à l'écran, pas racontée : le verdict vient du moteur, ce qui rend la révélation vérifiable.
- *pan* (0.85 s) — Le bloc verdict fait presque la hauteur de la bande utile ; on le cale en haut pour que le titre et le coût entrent dans le cadre.
- *zoomIn* (0.5 s) — Le resserrement final accompagne la révélation : le coût chiffré est le point de bascule de la vidéo.

**Montage** — voix : La bascule. C'est ici que la voix a le plus de valeur. · sous-titres : Oui — le verdict doit être lisible sans le son. · textes : Le coût chiffré peut être repris en gros, mais il est déjà à l'écran : évite de le doubler.

### `06-payoff.webm` — PAYOFF · 4.5 s

Montrer l'espérance de chaque option, en big blinds. C'est la preuve, et ce qui distingue la vidéo d'un simple quiz.

**Mouvements et leur raison**

- *fixe* (1.5 s) — La meilleure option est lue en premier : elle donne la réponse avant de montrer ce que l'erreur coûte.
- *panPx* (1.4 s) — La descente le long de la liste fait parcourir l'écart du meilleur au pire coup — le classement se lit comme une chute, ce qui est exactement le propos.

**Montage** — voix : Explication de l'écart, calmement. · sous-titres : Oui. · textes : Rien par-dessus la liste des espérances : c'est la preuve, elle doit rester lisible.

---

## Indications de montage

1. Les plans sont **indépendants** : aucun ne dépend du précédent, l'ordre et
   les coupes restent libres.
2. Chaque plan **commence sur une image posée**, donc une coupe franche au début
   ne coupe jamais un mouvement.
3. Les mouvements sont **calculés image par image**, pas enregistrés au vol : un
   ralenti ou un accéléré reste propre.
4. Le plan `06-payoff` est celui à ne pas sacrifier si tu raccourcis : c'est
   lui qui rend le propos vérifiable.

### Emplacement recommandé de la voix, des sous-titres et des textes

| beat | voix | sous-titres | textes |
|---|---|---|---|
| HOOK | Rien, ou une seule phrase courte. Le plan doit tenir par l'image. | Aucun — ils entreraient en concurrence avec les cartes. | Une accroche très courte, en haut de la bande utile, hors des 10 % supérieurs. |
| SITUATION | Pose du contexte. C'est le plan le plus tolérant à la parole. | À partir d'ici, en bas de la bande utile. | Rappel de position et de tapis si tu veux les souligner ; l'information est déjà à l'écran. |
| TENSION | Silence recommandé sur le freeze. Le vide fait le travail. | La question, si tu veux la poser à l'écrit. | C'est l'emplacement naturel d'un « tu fais quoi ? ». Ne masque pas le montant. |
| CHOICE | Énoncé des options, ou silence complet pour laisser choisir. | Oui, courts. | Éventuel compte à rebours. Ne recouvre pas les boutons : ce sont eux le sujet. |
| REVEAL | La bascule. C'est ici que la voix a le plus de valeur. | Oui — le verdict doit être lisible sans le son. | Le coût chiffré peut être repris en gros, mais il est déjà à l'écran : évite de le doubler. |
| PAYOFF | Explication de l'écart, calmement. | Oui. | Rien par-dessus la liste des espérances : c'est la preuve, elle doit rester lisible. |

**Zones à ne pas encombrer.** Les plans sont cadrés en tenant compte de
l'interface des plateformes : rien d'essentiel dans les 10 % du haut, les 20 %
du bas, ni la bande droite des boutons. Garde cette contrainte pour tes ajouts.

**Ce qui n'est pas fait ici, volontairement** : pas de voix off, pas de
sous-titres, pas de texte définitif, pas de montage. Ces éléments t'appartiennent.
Le README fournit les chiffres exacts pour que rien de ce que tu écriras ne
contredise ce qui est à l'image.

---

## Contrôle qualité

**Tous les contrôles sont passés.**

| plan | format | durée | image | safe area | cohérence moteur |
|---|---|---|---|---|---|
| `01-hook.webm` | ok | ok | ok | ok | — |
| `02-situation.webm` | ok | ok | ok | ok | — |
| `03-tension.webm` | ok | ok | ok | ok | — |
| `04-choice.webm` | ok | ok | ok | ok | — |
| `05-reveal.webm` | ok | ok | ok | ok | — |
| `06-payoff.webm` | ok | ok | ok | ok | ok |

---

## Format

WebM / VP8, 1080×1920, 30 im/s.

Le `ffmpeg` de l'environnement de production est compilé sans multiplexeur
MP4 ; il ne sait écrire que du WebM. Les fichiers s'importent tels quels dans
CapCut, Premiere, DaVinci Resolve et Final Cut, donc le montage n'est pas gêné —
c'est à l'export final que le MP4 se fait. Pour convertir un rush en amont, avec
un ffmpeg complet :

```sh
ffmpeg -i 01-hook.webm -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p 01-hook.mp4
```

---

## Reproduire ce spot

Ouvre l'application avec `?admin=1` et colle ceci dans le mode Studio :

```
Hero: BTN, 5h 5s, 100bb
Table: 6-max, NL50
Villains: BB (reg, 100bb)
Preflop: hero raise 2.5bb, BB call
Flop: Kd Qs 7h | BB check, hero bet 3bb, BB call
Turn: Ac | BB bet 9bb, hero to act
```
