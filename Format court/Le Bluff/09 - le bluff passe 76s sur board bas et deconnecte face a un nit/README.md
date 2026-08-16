# 09 - le bluff passe 76s sur board bas et deconnecte face a un nit

**Concept** : Le Bluff · **Potentiel contenu** : 49/100
**Titre interne** : Le bluff passe : 76s sur board bas et déconnecté face à un nit
**Spot** : `flop-initiative_co_76s_nit_bas`
**Fichier** : `video.webm` — 33.90 s, 1080×1920, 30 im/s

> Vidéo **montée**, d'un seul tenant. Il ne reste qu'à ajouter **la voix off et
> les sous-titres**. Aucun montage n'est nécessaire : les coupes, les mouvements
> et les temps de pose sont déjà en place.
>
> Une **proposition de script** (voix off + sous-titres, calée sur les
> timecodes) est fournie dans [`SCRIPT.md`](SCRIPT.md) — à reformuler
> librement, sans changer les chiffres.

## Ce que la vidéo démontre

Miser 1/3 pot demande 25 % de folds — ce profil en donne 53 % : le bluff passe, marge 28 points.

**Objectif de rétention.** Retenir par la méthode : le pari est isolé, l'exigence de folds est posée, la réponse du profil est comparée — et la leçon ferme sur une règle transposable, pas sur une seule main.

**Moment du reveal.** Beat REVEAL, quand le moteur affiche sa propre équation de fold equity et tranche. — à 00:17.00.

---

## Timecodes

| beat | début | fin | durée | ce qui est à l'écran |
|---|---|---|---|---|
| **HOOK** | `00:00.00` | `00:04.10` | 4.10 s | La main, sans dire si le pari qui vient paie ou brûle — la question est la promesse. |
| **SITUATION** | `00:04.10` | `00:09.10` | 5.00 s | La table et le profil adverse — c'est lui qui décide si un bluff a une chance ici. |
| **LE PARI** | `00:09.10` | `00:17.00` | 7.90 s | Isoler la mise envisagée (Miser 1/3 pot) : c'est elle qu'il faut juger, pas la main. |
| **REVEAL** | `00:17.00` | `00:25.90` | 8.90 s | La mise (Miser 1/3 pot) est jouée à l'écran ; le moteur écrit sa propre équation et tranche : le bluff passe. |
| **LA LEÇON** | `00:25.90` | `00:33.90` | 8.00 s | L'espérance de chaque option — la preuve chiffrée, et la méthode qui s'en dégage. |

**Durée totale : 33.90 s.**

Les coupes entre beats sont **franches** : aucun fondu, aucune transition. Une
insertion de texte peut donc être calée exactement sur un timecode ci-dessus
sans chevaucher un mouvement de caméra.

### Où poser voix, sous-titres et textes

| beat | de → à | voix | sous-titres | textes |
|---|---|---|---|---|
| HOOK | `00:00.00` → `00:04.10` | Rien, ou une seule phrase courte. Le plan doit tenir par l'image. | Aucun — ils entreraient en concurrence avec les cartes. | Une accroche très courte, en haut de la bande utile, hors des 10 % supérieurs. |
| SITUATION | `00:04.10` → `00:09.10` | Pose du contexte. C'est le plan le plus tolérant à la parole. | À partir d'ici, en bas de la bande utile. | Rappel de position et de tapis si tu veux les souligner ; l'information est déjà à l'écran. |
| LE PARI | `00:09.10` → `00:17.00` | Poser l'exigence de folds — c'est le sujet du beat. Silence sur la fin du freeze : laisser deviner. | Oui : « il faut qu'il passe X % du temps ». | L'emplacement naturel d'un « il faudrait qu'il passe combien de fois ? ». Ne pas masquer les options. |
| REVEAL | `00:17.00` → `00:25.90` | La bascule. C'est ici que la voix a le plus de valeur. | Oui — le verdict doit être lisible sans le son. | Le coût chiffré peut être repris en gros, mais il est déjà à l'écran : évite de le doubler. |
| LA LEÇON | `00:25.90` → `00:33.90` | La méthode, calmement — pas seulement le chiffre de cette main. | Oui. | Rien par-dessus la liste des espérances : c'est la preuve, elle doit rester lisible. |

**Zones à ne pas encombrer.** La vidéo est cadrée en tenant compte de l'interface
des plateformes : rien d'essentiel dans les 10 % du haut, les 20 % du bas, ni la
bande droite des boutons. Garde cette contrainte pour tes ajouts.

---

## Ce que dit le moteur

Une leçon de bluff, dont l'équation est écrite par le moteur lui-même dans son
explication à l'écran (beat REVEAL) :

| donnée | valeur |
|---|---|
| pari jugé | **Miser 1/3 pot** |
| EV de ce pari | **+3.97 bb** |
| meilleure action | Miser 1/3 pot (+3.97 bb) |
| fold equity **exigée** | **25 %** |
| fold equity **estimée** (ce profil) | **53 %** |
| marge | +28 points |
| équité une fois payé | 45 % |
| le bluff | **PASSE** |
| coût / gain | +3.97 bb |

La fold equity estimée dépasse nettement l'exigée : ce pari est le bon coup — la série alterne les deux sens, c'est la comparaison qui s'enseigne.


### Espérance de chaque option

En big blinds, à partir de la décision. Passer vaut 0 : c'est la référence
commune, l'argent déjà investi étant ignoré pour toutes les options. Un chiffre
négatif signifie donc « pire que jeter la main ».

| option | espérance |
|---|---|
| Miser 1/3 pot | +3.97 bb |
| Miser 1/2 pot | +3.90 bb |
| Miser 2/3 pot | +3.81 bb |
| Miser Pot | +3.56 bb |
| Checker | +3.24 bb |
| Miser Tapis | +0.50 bb |

Ces valeurs sont celles affichées à l'écran pendant le beat LA LEÇON.
Elles viennent de `Judge.evaluate`. Comme l'indique l'application elle-même, ce sont
des estimations sur la range adverse et les profils en jeu — un ordre de grandeur
et un classement, pas une sortie de solveur. Ne les présente pas autrement.

---

## Mouvements de caméra et leur raison

Aucun mouvement n'est décoratif. Chacun a été écrit pour une raison, reprise ici
telle quelle depuis le plan de tournage.

### HOOK — `00:00.00` → `00:04.10`

- *zoomIn* (0.9 s) — Ouvrir sur la main sans indice sur l'issue : le spectateur doit regarder pour savoir si le pari tient.

### LE PARI — `00:09.10` → `00:17.00`

- *pan* (0.9 s) — Descendre vers les options montre le pari envisagé au milieu des autres : la comparaison est le point du beat.
- *freeze* (6.4 s) — Le temps du calcul : combien de fois l'adversaire doit-il passer pour que ce pari soit rentable ? Le silence laisse deviner avant la réponse.

### REVEAL — `00:17.00` → `00:25.90`

- *jouer* — Le pari est joué à l'écran, pas raconté : l'équation qui s'affiche est celle du moteur, vérifiable telle quelle.
- *pan* (0.9 s) — Le bloc verdict porte l'équation complète ; calé en haut pour que le titre et le calcul entrent dans la bande utile.
- *zoomIn* (0.5 s) — Le resserrement accompagne le verdict — le point de bascule de la vidéo.

### LA LEÇON — `00:25.90` → `00:33.90`

- *fixe* (2 s) — La meilleure option se lit en premier — la réponse avant la démonstration.
- *panPx* (1.4 s) — La descente parcourt le classement complet : c'est la preuve que le calcul, pas l'instinct, doit trancher.
- *fixe* (4.6 s) — Dernière image tenue : la vidéo se termine sur la preuve, pas sur un mouvement.


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
| HOOK | `00:01.02` `00:03.08` | 91 % · 90 % |
| SITUATION | `00:05.35` `00:07.85` | 82 % · 82 % |
| LE PARI | `00:11.08` `00:15.03` | 88 % · 88 % |
| REVEAL | `00:19.23` `00:23.68` | 78 % · 78 % |
| LA LEÇON | `00:27.90` `00:31.90` | 73 % · 70 % |

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
Hero: CO, 7h 6h, 100bb
Table: 6-max, NL10
Villains: BB (nit, 100bb)
Preflop: hero raise 2.5bb, BB call
Flop: 6c 5h 2s | BB check, hero to act
```
