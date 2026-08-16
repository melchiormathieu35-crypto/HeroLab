# 09 - la cote dit non Q9s sur board paire face a une calling station

**Concept** : La Cote · **Potentiel contenu** : 71/100
**Titre interne** : La cote dit non : Q9s sur board pairé face à une calling station
**Spot** : `flop-face-mise_bb_q9s_station_paire`
**Fichier** : `video.webm` — 33.50 s, 1080×1920, 30 im/s

> Vidéo **montée**, d'un seul tenant. Il ne reste qu'à ajouter **la voix off et
> les sous-titres**. Aucun montage n'est nécessaire : les coupes, les mouvements
> et les temps de pose sont déjà en place.
>
> Une **proposition de script** (voix off + sous-titres, calée sur les
> timecodes) est fournie dans [`SCRIPT.md`](SCRIPT.md) — à reformuler
> librement, sans changer les chiffres.

## Ce que la vidéo démontre

Le prix exige 30 % d'équité, le héros n'en a que 13 % : payer coûte 5.65 bb, la cote disait non.

**Objectif de rétention.** Retenir par la méthode : la question est posée (que demande le prix ?), le calcul est affiché, la réponse est chiffrée. La série alterne « la cote dit non » et « la cote dit oui » — c'est la comparaison qui s'apprend, pas un réflexe.

**Moment du reveal.** Beat REVEAL, quand le moteur affiche la comparaison exigé/réel et tranche. — à 00:16.40.

---

## Timecodes

| beat | début | fin | durée | ce qui est à l'écran |
|---|---|---|---|---|
| **HOOK** | `00:00.00` | `00:04.40` | 4.40 s | La main, et la promesse d'un calcul — pas encore les nombres. |
| **SITUATION** | `00:04.40` | `00:09.80` | 5.40 s | La table, l'adversaire, la mise en face — le contexte du prix. |
| **LA COTE** | `00:09.80` | `00:16.40` | 6.60 s | Isoler le prix : 1 à payer. |
| **REVEAL** | `00:16.40` | `00:24.10` | 7.70 s | Le réflexe (payer) est joué ; le moteur écrit lui-même la comparaison à l'écran — exigé 30 %, réel 13 % — et tranche : erreur. |
| **ÉQUITÉ** | `00:24.10` | `00:33.50` | 9.40 s | Le panneau d'équité en grand : le nombre réel, la barre, la preuve. |

**Durée totale : 33.50 s.**

Les coupes entre beats sont **franches** : aucun fondu, aucune transition. Une
insertion de texte peut donc être calée exactement sur un timecode ci-dessus
sans chevaucher un mouvement de caméra.

### Où poser voix, sous-titres et textes

| beat | de → à | voix | sous-titres | textes |
|---|---|---|---|---|
| HOOK | `00:00.00` → `00:04.40` | Rien, ou une seule phrase courte. Le plan doit tenir par l'image. | Aucun — ils entreraient en concurrence avec les cartes. | Une accroche très courte, en haut de la bande utile, hors des 10 % supérieurs. |
| SITUATION | `00:04.40` → `00:09.80` | Pose du contexte. C'est le plan le plus tolérant à la parole. | À partir d'ici, en bas de la bande utile. | Rappel de position et de tapis si tu veux les souligner ; l'information est déjà à l'écran. |
| LA COTE | `00:09.80` → `00:16.40` | Poser l'exigence du prix — le nombre est le sujet du beat. Puis silence sur le freeze. | Oui : « prix X → il faut Y % ». | L'emplacement naturel d'un « fais le calcul ». Ne pas masquer la ligne « à payer ». |
| REVEAL | `00:16.40` → `00:24.10` | La bascule. C'est ici que la voix a le plus de valeur. | Oui — le verdict doit être lisible sans le son. | Le coût chiffré peut être repris en gros, mais il est déjà à l'écran : évite de le doubler. |
| ÉQUITÉ | `00:24.10` → `00:33.50` | La leçon de méthode, calmement — le nombre à l'écran répond à la question posée. | Oui. | Rien par-dessus le panneau d'équité : c'est la preuve et la dernière image. |

**Zones à ne pas encombrer.** La vidéo est cadrée en tenant compte de l'interface
des plateformes : rien d'essentiel dans les 10 % du haut, les 20 % du bas, ni la
bande droite des boutons. Garde cette contrainte pour tes ajouts.

---

## Ce que dit le moteur

Une leçon de cote, dont les deux nombres sont écrits par le moteur lui-même dans
son explication à l'écran (beat REVEAL) :

| donnée | valeur |
|---|---|
| à payer | 1.00 € |
| pot au moment de payer | 2.38 € |
| équité **exigée** par le prix | **30 %** |
| équité **réelle** du héros | **13 %** |
| écart | -17 points |
| la cote dit | **NON** |
| verdict de l'application | « erreur » |
| coût du call | 5.65 bb |

L'équité réelle est nettement sous l'exigée : payer est une erreur chiffrée, passer est la réponse.




---

## Mouvements de caméra et leur raison

Aucun mouvement n'est décoratif. Chacun a été écrit pour une raison, reprise ici
telle quelle depuis le plan de tournage.

### HOOK — `00:00.00` → `00:04.40`

- *zoomIn* (0.9 s) — Ouvrir sur la main pose le sujet ; la promesse de la vidéo est le calcul, pas la réponse.

### LA COTE — `00:09.80` → `00:16.40`

- *pan* (0.8 s) — Descendre sur la ligne « à payer » isole la seule donnée dont le calcul a besoin : le prix.
- *freeze* (5.2 s) — Le temps du calcul. La voix pose l'exigence de la cote pendant que le prix est seul à l'écran — sans ce temps, la vidéo affirme au lieu de démontrer.

### REVEAL — `00:16.40` → `00:24.10`

- *jouer* — La décision est jouée, pas racontée : la phrase de comparaison qui s'affiche vient du moteur, mot pour mot.
- *pan* (0.9 s) — Le bloc verdict porte la phrase de la cote ; calé en haut pour que le titre et le coût entrent dans la bande utile.
- *zoomIn* (0.5 s) — Le resserrement accompagne le verdict — le point de bascule de la vidéo.

### ÉQUITÉ — `00:24.10` → `00:33.50`

- *fixe* (9.4 s) — La vidéo se termine sur le nombre qui répond à la question posée au beat LA COTE — la leçon est la comparaison, elle doit rester à l'écran le temps de s'installer.


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
| HOOK | `00:01.10` `00:03.30` | 90 % · 89 % |
| SITUATION | `00:05.75` `00:08.45` | 82 % · 82 % |
| LA COTE | `00:11.45` `00:14.75` | 88 % · 88 % |
| REVEAL | `00:18.33` `00:22.17` | 83 % · 82 % |
| ÉQUITÉ | `00:26.45` `00:31.15` | 85 % · 84 % |

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
Hero: BB, Qd 9d, 100bb
Table: 6-max, NL25
Villains: BTN (station, 100bb)
Preflop: BTN raise 2.5bb, hero call
Flop: 8h 8s 4c | hero check, BTN bet 4bb, hero to act
```
