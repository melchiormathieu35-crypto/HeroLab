# 10 - podium 76s continuer face a un 3bet face a un recreatif 98s sur

**Concept** : Podium des erreurs · **Potentiel contenu** : 74/100
**Titre interne** : Podium : 76s · 98s · Q9s
**Spot** : `pre-face-3bet_co_76s_rec`
**Fichier** : `video.webm` — 34.07 s, 1080×1920, 30 im/s

> Vidéo **montée**, d'un seul tenant. Il ne reste qu'à ajouter **la voix off et
> les sous-titres**. Aucun montage n'est nécessaire : les coupes, les mouvements
> et les temps de pose sont déjà en place.
>
> Une **proposition de script** (voix off + sous-titres, calée sur les
> timecodes) est fournie dans [`SCRIPT.md`](SCRIPT.md) — à reformuler
> librement, sans changer les chiffres.

## Ce que la vidéo démontre

Trois erreurs classées : n°3 à +6.12 bb, n°2 à +9.48 bb, n°1 à +16.21 bb — le coût réel, tel que le moteur le calcule.

**Objectif de rétention.** Retenir par le classement : chaque erreur est plus chère que la précédente, et la structure elle-même pousse à rester jusqu'au numéro un. Aucune main ne dépend d'une autre — ce sont trois preuves indépendantes.

**Moment du reveal.** Beat ERREUR N°1, sur le dernier verdict — le plus cher du classement. — à 00:00.00.

---

## Timecodes

| beat | début | fin | durée | ce qui est à l'écran |
|---|---|---|---|---|
| **HOOK** | `00:00.00` | `00:04.30` | 4.30 s | La main de la première erreur, sans contexte : la promesse du classement, pas encore la réponse. |
| **ERREUR N°3** | `00:04.30` | `00:12.57` | 8.27 s | Rang 3/3 du podium — 76s — continuer face à un 3bet face à un récréatif. |
| **ERREUR N°2** | `00:12.57` | `00:22.50` | 9.93 s | Rang 2/3 du podium — 98s sur monotone, carte blanche, face à une calling station. |
| **ERREUR N°1** | `00:22.50` | `00:34.07` | 11.57 s | Rang 1/3 du podium — Q9s sur as haut, une surcarte tombe, face à une calling station. |

**Durée totale : 34.07 s.**

Les coupes entre beats sont **franches** : aucun fondu, aucune transition. Une
insertion de texte peut donc être calée exactement sur un timecode ci-dessus
sans chevaucher un mouvement de caméra.

### Où poser voix, sous-titres et textes

| beat | de → à | voix | sous-titres | textes |
|---|---|---|---|---|
| HOOK | `00:00.00` → `00:04.30` | Rien, ou une seule phrase courte. Le plan doit tenir par l'image. | Aucun — ils entreraient en concurrence avec les cartes. | Une accroche très courte, en haut de la bande utile, hors des 10 % supérieurs. |
| ERREUR N°3 | `00:04.30` → `00:12.57` | La moins chère des trois. Rythme rapide : situation, réflexe, coût — sans s'attarder. | Oui, courts : le coût suffit. | Un repère « N°3 » possible en haut de bande utile. |
| ERREUR N°2 | `00:12.57` → `00:22.50` | Même rythme, un cran au-dessus. Ne pas ralentir : le classement doit se sentir monter. | Oui, courts. | Un repère « N°2 » possible. |
| ERREUR N°1 | `00:22.50` → `00:34.07` | La plus chère du lot — le clou de la vidéo. C'est ici que la voix peut s'attarder. | Oui — le chiffre final doit être lisible sans le son. | Un repère « N°1 » possible. Rien par-dessus le coût affiché. |

**Zones à ne pas encombrer.** La vidéo est cadrée en tenant compte de l'interface
des plateformes : rien d'essentiel dans les 10 % du haut, les 20 % du bas, ni la
bande droite des boutons. Garde cette contrainte pour tes ajouts.

---

## Ce que dit le moteur

Trois erreurs indépendantes, classées par coût réel — chacune rejouée et revérifiée au contrôle qualité.

| rang | situation | réflexe joué | coût |
|---|---|---|---|
| **N°3** | 76s — continuer face à un 3bet face à un récréatif | payer | **+6.12 bb** |
| **N°2** | 98s sur monotone, carte blanche, face à une calling station | payer | **+9.48 bb** |
| **N°1** | Q9s sur as haut, une surcarte tombe, face à une calling station | payer | **+16.21 bb** |

Le rang 1 est la vidéo qui se termine : c'est l'erreur la plus chère du lot,
tenue le plus longtemps à l'écran. Les trois chiffres viennent de
`Judge.evaluate`, comme partout ailleurs dans cette chaîne — rien n'est classé
à l'œil.




---

## Mouvements de caméra et leur raison

Aucun mouvement n'est décoratif. Chacun a été écrit pour une raison, reprise ici
telle quelle depuis le plan de tournage.

### HOOK — `00:00.00` → `00:04.30`

- *zoomIn* (0.9 s) — Ouvrir sur une main, sans dire laquelle des trois erreurs elle est, pose la promesse du classement.

### ERREUR N°3 — `00:04.30` → `00:12.57`

- *jouer* — Le réflexe (payer) est joué à l'écran : c'est lui, chiffré, qui fait l'erreur n°3.
- *pan* (0.85 s) — Le bloc verdict monte en haut du cadre pour que le titre et le coût entrent dans la bande utile.
- *zoomIn* (0.5 s) — Le resserrement accompagne le chiffre qui classe cette erreur — le point de preuve du rang n°3.

### ERREUR N°2 — `00:12.57` → `00:22.50`

- *jouer* — Le réflexe (payer) est joué à l'écran : c'est lui, chiffré, qui fait l'erreur n°2.
- *pan* (0.85 s) — Le bloc verdict monte en haut du cadre pour que le titre et le coût entrent dans la bande utile.
- *zoomIn* (0.5 s) — Le resserrement accompagne le chiffre qui classe cette erreur — le point de preuve du rang n°2.

### ERREUR N°1 — `00:22.50` → `00:34.07`

- *jouer* — Le réflexe (payer) est joué à l'écran : c'est lui, chiffré, qui fait l'erreur n°1.
- *pan* (0.85 s) — Le bloc verdict monte en haut du cadre pour que le titre et le coût entrent dans la bande utile.
- *zoomIn* (0.5 s) — Le resserrement accompagne le chiffre qui classe cette erreur — le point de preuve du rang n°1.


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
| HOOK | `00:01.08` `00:03.22` | 89 % · 89 % |
| ERREUR N°3 | `00:06.37` `00:10.50` | 82 % · 81 % |
| ERREUR N°2 | `00:15.05` `00:20.02` | 82 % · 81 % |
| ERREUR N°1 | `00:25.39` `00:31.18` | 82 % · 81 % |

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

## Reproduire ces spots

Ouvre l'application avec `?admin=1` et colle ceci dans le mode Studio :

**Erreur n°3** — 76s — continuer face à un 3bet face à un récréatif

```
Hero: CO, 7h 6h, 100bb
Table: 6-max, NL10
Villains: SB (rec, 100bb)
Preflop: hero raise 2.5bb, SB raise 11bb, hero to act
```

**Erreur n°2** — 98s sur monotone, carte blanche, face à une calling station

```
Hero: BTN, 9s 8s, 100bb
Table: 6-max, NL25
Villains: BB (station, 100bb)
Preflop: hero raise 2.5bb, BB call
Flop: Jd 7d 3d | BB check, hero bet 3bb, BB call
Turn: 2h | BB bet 9bb, hero to act
```

**Erreur n°1** — Q9s sur as haut, une surcarte tombe, face à une calling station

```
Hero: BB, Qd 9d, 100bb
Table: 6-max, NL25
Villains: BTN (station, 100bb)
Preflop: BTN raise 2.5bb, hero call
Flop: Ah 9c 4s | hero check, BTN bet 4bb, hero call
Turn: Ac | hero check, BTN bet 12bb, hero to act
```
