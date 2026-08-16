# 01 - 76s sur board bas et deconnecte face a un nit

**Concept** : Quizz · **Potentiel contenu** : 93/100
**Titre interne** : 76s sur board bas et déconnecté face à un nit
**Spot** : `flop-face-mise_bb_76s_nit_bas`
**Fichier** : `video.webm` — 34.30 s, 1080×1920, 30 im/s

> Vidéo **montée**, d'un seul tenant. Il ne reste qu'à ajouter **la voix off et
> les sous-titres**. Aucun montage n'est nécessaire : les coupes, les mouvements
> et les temps de pose sont déjà en place.
>
> Une **proposition de script** (voix off + sous-titres, calée sur les
> timecodes) est fournie dans [`SCRIPT.md`](SCRIPT.md) — à reformuler
> librement, sans changer les chiffres.

## Ce que la vidéo démontre

Le réflexe (payer) coûte -2.43 bb ; la bonne réponse est relancer pot, à +4.83 bb.

**Objectif de rétention.** Retenir par la contradiction : le spectateur croit connaître la réponse au HOOK, choisit au CHOICE, et découvre au REVEAL que son réflexe est chiffré comme une perte. Le PAYOFF empêche le doute en montrant le calcul.

**Moment du reveal.** Beat REVEAL, à l'affichage du verdict après l'action jouée. — à 00:22.20.

---

## Timecodes

| beat | début | fin | durée | ce qui est à l'écran |
|---|---|---|---|---|
| **HOOK** | `00:00.00` | `00:03.70` | 3.70 s | Montrer la main sans son contexte. |
| **SITUATION** | `00:03.70` | `00:10.70` | 7.00 s | Poser la table puis désigner le board, qui est le cœur du problème. |
| **TENSION** | `00:10.70` | `00:15.30` | 4.60 s | Isoler le montant à payer : c'est lui qui rend la décision coûteuse. |
| **CHOICE** | `00:15.30` | `00:22.20` | 6.90 s | Présenter les options légales et leurs montants exacts. |
| **REVEAL** | `00:22.20` | `00:28.10` | 5.90 s | Jouer l'action instinctive (call) et afficher le verdict du moteur avec son coût. |
| **PAYOFF** | `00:28.10` | `00:34.30` | 6.20 s | Montrer l'espérance de chaque option, en big blinds. |

**Durée totale : 34.30 s.**

Les coupes entre beats sont **franches** : aucun fondu, aucune transition. Une
insertion de texte peut donc être calée exactement sur un timecode ci-dessus
sans chevaucher un mouvement de caméra.

### Où poser voix, sous-titres et textes

| beat | de → à | voix | sous-titres | textes |
|---|---|---|---|---|
| HOOK | `00:00.00` → `00:03.70` | Rien, ou une seule phrase courte. Le plan doit tenir par l'image. | Aucun — ils entreraient en concurrence avec les cartes. | Une accroche très courte, en haut de la bande utile, hors des 10 % supérieurs. |
| SITUATION | `00:03.70` → `00:10.70` | Pose du contexte. C'est le plan le plus tolérant à la parole. | À partir d'ici, en bas de la bande utile. | Rappel de position et de tapis si tu veux les souligner ; l'information est déjà à l'écran. |
| TENSION | `00:10.70` → `00:15.30` | Silence recommandé sur le freeze. Le vide fait le travail. | La question, si tu veux la poser à l'écrit. | C'est l'emplacement naturel d'un « tu fais quoi ? ». Ne masque pas le montant. |
| CHOICE | `00:15.30` → `00:22.20` | Énoncé des options, ou silence complet pour laisser choisir. | Oui, courts. | Éventuel compte à rebours. Ne recouvre pas les boutons : ce sont eux le sujet. |
| REVEAL | `00:22.20` → `00:28.10` | La bascule. C'est ici que la voix a le plus de valeur. | Oui — le verdict doit être lisible sans le son. | Le coût chiffré peut être repris en gros, mais il est déjà à l'écran : évite de le doubler. |
| PAYOFF | `00:28.10` → `00:34.30` | Explication de l'écart, calmement. | Oui. | Rien par-dessus la liste des espérances : c'est la preuve, elle doit rester lisible. |

**Zones à ne pas encombrer.** La vidéo est cadrée en tenant compte de l'interface
des plateformes : rien d'essentiel dans les 10 % du haut, les 20 % du bas, ni la
bande droite des boutons. Garde cette contrainte pour tes ajouts.

---

## Ce que dit le moteur

- Le héros a **31.5 % d'équité**.
- L'action instinctive est **Suivre 0.40 €**, à **-2.43 bb**.
  Passer valant 0 par construction, ce coup coûte donc plus cher que de jeter la main.
- La meilleure action est **Relancer Pot**, à **+4.83 bb**.
- **Différentiel d'EV : 7.26 bb.** Verdict de l'application : « erreur ».

### Espérance de chaque option

En big blinds, à partir de la décision. Passer vaut 0 : c'est la référence
commune, l'argent déjà investi étant ignoré pour toutes les options. Un chiffre
négatif signifie donc « pire que jeter la main ».

| option | espérance |
|---|---|
| Relancer Pot | +4.83 bb |
| Relancer 1/3 pot | +4.75 bb |
| Relancer Tapis | +2.32 bb |
| Passer | 0.00 bb |
| Suivre 0.40 € | -2.43 bb |

Ces valeurs sont celles affichées à l'écran pendant le beat PAYOFF. Elles
viennent de `Judge.evaluate`. Comme l'indique l'application elle-même, ce sont
des estimations sur la range adverse et les profils en jeu — un ordre de grandeur
et un classement, pas une sortie de solveur. Ne les présente pas autrement.

---

## Mouvements de caméra et leur raison

Aucun mouvement n'est décoratif. Chacun a été écrit pour une raison, reprise ici
telle quelle depuis le plan de tournage.

### HOOK — `00:00.00` → `00:03.70`

- *zoomIn* (0.9 s) — Resserrer sur les cartes conduit l'œil vers la seule information utile à cet instant, sans jamais rogner un montant.

### SITUATION — `00:03.70` → `00:10.70`

- *pan* (0.9 s) — Le board est ce qui rend la décision difficile : amener le centre de la table au centre du cadre dit où regarder avant qu'on pose la question.
- *pan* (0.7 s) — Rendre le contexte après le détail : le spectateur doit relier le board aux tapis et au pot pour juger.

### TENSION — `00:10.70` → `00:15.30`

- *pan* (0.9 s) — Descendre sur la ligne du montant à payer conduit l'œil vers la donnée que le spectateur oublie de regarder : c'est elle qui rend la décision coûteuse.
- *freeze* (3 s) — L'arrêt franc laisse le temps de se forger un avis. Sans ce temps mort il n'y a pas de participation, donc pas de rétention.

### CHOICE — `00:15.30` → `00:22.20`

- *pan* (1 s) — Descendre de la table vers les boutons reproduit le geste réel du joueur : le mouvement raconte le passage de l'observation à la décision.
- *fixe* (5 s) — Temps de choix. Cinq secondes sur les options est la seule durée de la vidéo qui n'est pas dictée par la lecture mais par la décision : c'est la fenêtre où poser un compte à rebours si tu en veux un.

### REVEAL — `00:22.20` → `00:28.10`

- *jouer* — La décision est jouée à l'écran, pas racontée : le verdict vient du moteur, ce qui rend la révélation vérifiable.
- *pan* (0.9 s) — Le bloc verdict fait presque la hauteur de la bande utile ; on le cale en haut pour que le titre et le coût entrent dans le cadre.
- *zoomIn* (0.5 s) — Le resserrement final accompagne la révélation : le coût chiffré est le point de bascule de la vidéo.

### PAYOFF — `00:28.10` → `00:34.30`

- *fixe* (2 s) — La meilleure option est lue en premier : elle donne la réponse avant de montrer ce que l'erreur coûte.
- *panPx* (1.6 s) — La descente le long de la liste fait parcourir l'écart du meilleur au pire coup — le classement se lit comme une chute, ce qui est exactement le propos.
- *fixe* (2.6 s) — Dernière image tenue : la vidéo se termine sur la preuve, pas sur un mouvement.


---

## Contrôle qualité

**Tous les contrôles sont passés.**

| contrôle | résultat |
|---|---|
| fichier | ok |
| format | ok |
| ratio | ok |
| fps | ok |
| durée | ok |
| continuité | ok |
| enchaînement | ok |
| image | ok |
| safe area | ok |
| console | ok |
| cohérence moteur | ok |

### Image, beat par beat

Le remplissage mesure la part du cadre qui n'est pas sur une seule valeur : il
détecte une image vide ou une application qui n'occuperait pas le cadre.

| beat | échantillons | remplissage |
|---|---|---|
| HOOK | `00:00.93` `00:02.78` | 89 % · 88 % |
| SITUATION | `00:05.45` `00:08.95` | 82 % · 82 % |
| TENSION | `00:11.85` `00:14.15` | 91 % · 87 % |
| CHOICE | `00:17.03` `00:20.48` | 85 % · 88 % |
| REVEAL | `00:23.68` `00:26.63` | 87 % · 80 % |
| PAYOFF | `00:29.65` `00:32.75` | 79 % · 74 % |

---

## Format

WebM / VP8, 1080×1920, 30 im/s.

Le `ffmpeg` de l'environnement de production est compilé sans multiplexeur MP4 ;
il ne sait écrire que du WebM. Le fichier s'importe tel quel dans CapCut,
Premiere, DaVinci Resolve et Final Cut — c'est à l'export final que le MP4 se
fait. Pour convertir en amont, avec un ffmpeg complet :

```sh
ffmpeg -i video.webm -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p video.mp4
```

---

## Reproduire ce spot

Ouvre l'application avec `?admin=1` et colle ceci dans le mode Studio :

```
Hero: BB, 7h 6h, 100bb
Table: 6-max, NL10
Villains: BTN (nit, 100bb)
Preflop: BTN raise 2.5bb, hero call
Flop: 6c 5h 2s | hero check, BTN bet 4bb, hero to act
```
