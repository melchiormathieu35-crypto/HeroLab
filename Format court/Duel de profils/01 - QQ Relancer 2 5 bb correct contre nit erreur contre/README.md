# 01 - QQ Relancer 2 5 bb correct contre nit erreur contre

**Concept** : Duel de profils · **Potentiel contenu** : 100/100
**Titre interne** : QQ — continuer face à un 3bet face à un nit — puis face à station, la même action bascule
**Spot** : `pre-face-3bet_btn_qq_nit`
**Fichier** : `video.webm` — 36.90 s, 1080×1920, 30 im/s

> Vidéo **montée**, d'un seul tenant. Il ne reste qu'à ajouter **la voix off et
> les sous-titres**. Aucun montage n'est nécessaire : les coupes, les mouvements
> et les temps de pose sont déjà en place.
>
> Une **proposition de script** (voix off + sous-titres, calée sur les
> timecodes) est fournie dans [`SCRIPT.md`](SCRIPT.md) — à reformuler
> librement, sans changer les chiffres.

## Ce que la vidéo démontre

Relancer 2.5 bb vaut +6.17 bb contre nit et -11.39 bb contre station : la même action bascule de 17.56 bb quand seul l'adversaire change.

**Objectif de rétention.** Retenir par la bascule : le spectateur voit une action validée en manche A, parie sur sa tenue en manche B, et découvre que le seul changement d'adversaire l'a rendue perdante. Le PAYOFF montre le reclassement complet.

**Moment du reveal.** Beat REVEAL B, quand la même action reçoit le verdict opposé. — à 00:00.00.

---

## Timecodes

| beat | début | fin | durée | ce qui est à l'écran |
|---|---|---|---|---|
| **HOOK** | `00:00.00` | `00:03.50` | 3.50 s | Montrer la main, point commun des deux manches. |
| **MANCHE A** | `00:03.50` | `00:08.10` | 4.60 s | Poser la table contre le premier adversaire (nit). |
| **CHOICE A** | `00:08.10` | `00:13.10` | 5.00 s | Les options et leurs montants. |
| **REVEAL A** | `00:13.10` | `00:17.90` | 4.80 s | Jouer Relancer 2. |
| **MANCHE B** | `00:17.90` | `00:22.10` | 4.20 s | Recharger la même situation contre le second adversaire (station). |
| **TENSION B** | `00:22.10` | `00:26.10` | 4.00 s | Poser la question du duel : la même action est-elle encore la bonne ?. |
| **REVEAL B** | `00:26.10` | `00:31.20` | 5.10 s | Rejouer exactement Relancer 2. |
| **PAYOFF** | `00:31.20` | `00:36.90` | 5.70 s | La preuve finale : contre B, l'action de la manche A est au fond de la liste des espérances. |

**Durée totale : 36.90 s.**

Les coupes entre beats sont **franches** : aucun fondu, aucune transition. Une
insertion de texte peut donc être calée exactement sur un timecode ci-dessus
sans chevaucher un mouvement de caméra.

### Où poser voix, sous-titres et textes

| beat | de → à | voix | sous-titres | textes |
|---|---|---|---|---|
| HOOK | `00:00.00` → `00:03.50` | Rien, ou une seule phrase courte. Le plan doit tenir par l'image. | Aucun — ils entreraient en concurrence avec les cartes. | Une accroche très courte, en haut de la bande utile, hors des 10 % supérieurs. |
| MANCHE A | `00:03.50` → `00:08.10` | Présenter le premier adversaire. Son badge de profil est à l'écran — le nommer suffit. | Oui, courts : profil et action en face. | Un marqueur « Manche 1 » possible en haut de bande utile. Ne pas cacher le badge de profil. |
| CHOICE A | `00:08.10` → `00:13.10` | Poser la question du choix contre CE profil, ou silence. | Oui, courts. | Éventuel compte à rebours. Ne pas recouvrir les boutons. |
| REVEAL A | `00:13.10` → `00:17.90` | Valider le coup et citer son espérance — le chiffre est à l'écran dans la liste. | Oui — la validation doit se lire sans le son. | Rien par-dessus la liste des espérances. |
| MANCHE B | `00:17.90` → `00:22.10` | Le pivot du concept : tout est identique, sauf l'adversaire. Le dire simplement. | Oui : « même main, même mise — autre adversaire ». | Un marqueur « Manche 2 » possible. Le badge de profil, différent, est le seul changement visible : ne pas le couvrir. |
| TENSION B | `00:22.10` → `00:26.10` | Poser la question de la bascule, puis silence sur le freeze. | La question, si tu veux la poser à l'écrit. | « La même relance ? » fonctionne. Ne pas donner la réponse. |
| REVEAL B | `00:26.10` → `00:31.20` | La bascule. C'est ici que la voix a le plus de valeur. | Oui — le verdict doit être lisible sans le son. | Le coût est déjà à l'écran : éviter de le doubler. |
| PAYOFF | `00:31.20` → `00:36.90` | Explication de l'écart, calmement. | Oui. | Rien par-dessus la liste des espérances : c'est la preuve, elle doit rester lisible. |

**Zones à ne pas encombrer.** La vidéo est cadrée en tenant compte de l'interface
des plateformes : rien d'essentiel dans les 10 % du haut, les 20 % du bas, ni la
bande droite des boutons. Garde cette contrainte pour tes ajouts.

---

## Ce que dit le moteur

Deux manches, une seule action : **Relancer 2.5 bb**.

| | manche A (nit) | manche B (station) |
|---|---|---|
| équité du héros | 41.4 % | 23.5 % |
| EV de **Relancer 2.5 bb** | **+6.17 bb** | **-11.39 bb** |
| verdict de l'application | « correct » | « erreur » |
| meilleure action | Relancer 2.5 bb | Passer (0.00 bb) |

**La bascule : 17.56 bb** pour la même action, quand seul
le profil adverse change. C'est la démonstration de la vidéo : les deux specs ne
diffèrent que d'un mot — le profil de l'adversaire actif. (Seule variation
visuelle sans effet sur la main : l'habillage des sièges couchés, décoratif,
est tiré par la table à chaque chargement.)

### Espérances à l'écran, manche par manche

En big blinds, à partir de la décision ; passer vaut 0 par construction. Ces
valeurs viennent de `Judge.evaluate` — des estimations sur la range adverse et
les profils en jeu, un ordre de grandeur et un classement, pas une sortie de
solveur. Ne les présente pas autrement.

| option | manche A (nit) | manche B (station) |
|---|---|---|
| Relancer 2.5 bb | +6.17 bb | -11.39 bb |
| Relancer Tapis | +5.75 bb | -13.85 bb |
| Passer | 0.00 bb | 0.00 bb |
| Suivre 4.25 € | -1.48 bb | -7.13 bb |




---

## Mouvements de caméra et leur raison

Aucun mouvement n'est décoratif. Chacun a été écrit pour une raison, reprise ici
telle quelle depuis le plan de tournage.

### HOOK — `00:00.00` → `00:03.50`

- *zoomIn* (0.9 s) — Resserrer sur les cartes pose le point commun des deux manches sans montrer encore l'adversaire.

### CHOICE A — `00:08.10` → `00:13.10`

- *pan* (0.9 s) — Descendre de la table vers les boutons reproduit le geste du joueur qui décide.

### REVEAL A — `00:13.10` → `00:17.90`

- *jouer* — La décision est jouée à l'écran ; le verdict et les chiffres viennent du moteur, pas du commentaire.
- *pan* (0.9 s) — La liste des espérances est la preuve de la manche : le chiffre dit par la voix doit être lisible à l'image.

### TENSION B — `00:22.10` → `00:26.10`

- *pan* (0.8 s) — Revenir sur la main rappelle que rien n'a changé côté héros : la question ne porte que sur l'adversaire.
- *freeze* (2.6 s) — L'arrêt laisse le spectateur parier sur la bascule — c'est la participation qui fait la rétention.

### REVEAL B — `00:26.10` → `00:31.20`

- *jouer* — La même action, jouée à l'identique : la bascule du verdict vient du seul changement d'adversaire.
- *pan* (0.9 s) — Le bloc verdict porte la bascule ; calé en haut pour que le titre et le coût entrent dans la bande utile.
- *zoomIn* (0.5 s) — Le resserrement accompagne le point de bascule de la vidéo : le coût chiffré.

### PAYOFF — `00:31.20` → `00:36.90`

- *fixe* (1.8 s) — La nouvelle meilleure option se lit en premier : la réponse avant le coût.
- *panPx* (1.5 s) — La descente de la liste fait parcourir la chute de l'action de la manche A — le classement se lit comme la bascule qu'il est.
- *fixe* (2.4 s) — Dernière image tenue : la vidéo finit sur la preuve, pas sur un mouvement.


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
| HOOK | `00:00.88` `00:02.63` | 90 % · 88 % |
| MANCHE A | `00:04.65` `00:06.95` | 82 % · 82 % |
| CHOICE A | `00:09.35` `00:11.85` | 85 % · 81 % |
| REVEAL A | `00:14.30` `00:16.70` | 84 % · 75 % |
| MANCHE B | `00:18.95` `00:21.05` | 82 % · 82 % |
| TENSION B | `00:23.10` `00:25.10` | 90 % · 88 % |
| REVEAL B | `00:27.38` `00:29.93` | 82 % · 75 % |
| PAYOFF | `00:32.63` `00:35.48` | 79 % · 77 % |

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
Hero: BTN, Qh Qs, 100bb
Table: 6-max, NL50
Villains: SB (nit, 100bb)
Preflop: hero raise 2.5bb, SB raise 11bb, hero to act
```
