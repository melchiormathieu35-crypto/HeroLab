# Format court — Podium des erreurs

Vidéos **montées**, prêtes pour la voix off et les sous-titres. Un fichier par
vidéo, 1080×1920, 30 im/s, entre 30 s et 1 min. Aucun montage supplémentaire
n'est nécessaire.

**Principe du concept.** Trois erreurs réelles, classées de la moins chère à la plus chère. Le format liste : la rétention vient du classement lui-même, le spectateur reste pour voir le numéro un.

| vidéo | titre interne | score | durée | différentiel EV |
|---|---|---|---|---|
| [01 - podium AQs continuer face a un 3bet face a un nit KTs sur bas](01%20-%20podium%20AQs%20continuer%20face%20a%20un%203bet%20face%20a%20un%20nit%20KTs%20sur%20bas/README.md) | Podium : AQs · KTs · A3s | 93/100 | 34.1 s | 17.64 bb |
| [02 - podium KQo continuer face a un 3bet face a une calling station](02%20-%20podium%20KQo%20continuer%20face%20a%20un%203bet%20face%20a%20une%20calling%20station/README.md) | Podium : KQo · 76s · 98s | 80/100 | 34.1 s | 17.22 bb |
| [03 - podium 55 continuer face a un 3bet face a une calling station](03%20-%20podium%2055%20continuer%20face%20a%20un%203bet%20face%20a%20une%20calling%20station/README.md) | Podium : 55 · 98s · TT | 85/100 | 34.1 s | 17.06 bb |
| [04 - podium 98s sur board bas et deconnecte face a un nit Q9s sur](04%20-%20podium%2098s%20sur%20board%20bas%20et%20deconnecte%20face%20a%20un%20nit%20Q9s%20sur/README.md) | Podium : 98s · Q9s · 88 | 87/100 | 34.1 s | 16.76 bb |
| [05 - podium TT continuer face a un 3bet face a une calling station](05%20-%20podium%20TT%20continuer%20face%20a%20un%203bet%20face%20a%20une%20calling%20station/README.md) | Podium : TT · KQo · Q9s | 79/100 | 34.1 s | 16.71 bb |
| [06 - podium QQ continuer face a un 3bet face a un nit A5s sur sec](06%20-%20podium%20QQ%20continuer%20face%20a%20un%203bet%20face%20a%20un%20nit%20A5s%20sur%20sec/README.md) | Podium : QQ · A5s · KQo | 85/100 | 34.1 s | 16.62 bb |
| [07 - podium 76s sur board paire face a un nit 55 sur tres connecte](07%20-%20podium%2076s%20sur%20board%20paire%20face%20a%20un%20nit%2055%20sur%20tres%20connecte/README.md) | Podium : 76s · 55 · JJ | 88/100 | 34.1 s | 16.56 bb |
| [08 - podium A3s continuer face a un 3bet face a une calling station](08%20-%20podium%20A3s%20continuer%20face%20a%20un%203bet%20face%20a%20une%20calling%20station/README.md) | Podium : A3s · Q9s · 33 | 81/100 | 34.1 s | 16.37 bb |
| [09 - podium A3s sur board bas et deconnecte face a un nit AKo sur](09%20-%20podium%20A3s%20sur%20board%20bas%20et%20deconnecte%20face%20a%20un%20nit%20AKo%20sur/README.md) | Podium : A3s · AKo · KQo | 86/100 | 34.1 s | 16.25 bb |
| [10 - podium 76s continuer face a un 3bet face a un recreatif 98s sur](10%20-%20podium%2076s%20continuer%20face%20a%20un%203bet%20face%20a%20un%20recreatif%2098s%20sur/README.md) | Podium : 76s · 98s · Q9s | 74/100 | 34.1 s | 16.21 bb |

**10 vidéo(s), 341 s au total.**

## Structure d'une vidéo de ce concept

| beat | rôle |
|---|---|
| HOOK | la main de la première erreur — aucun chiffre, la promesse du classement |
| ERREUR N°3 | la moins chère des trois — situation, réflexe joué, coût |
| ERREUR N°2 | situation rechargée — même mécanique, coût plus élevé |
| ERREUR N°1 | la plus chère du lot — le temps de pose final est le plus long |

Les timecodes exacts de chaque beat sont dans le README de chaque vidéo.

## Ce qui est fourni pour la voix et les sous-titres

Chaque vidéo est livrée avec un `SCRIPT.md` : une **proposition** de voix off
et de sous-titres, beat par beat, calée sur les timecodes réels et calibrée sur
la durée de chaque fenêtre. Le ton se reformule librement ; les chiffres sont
ceux de l'écran et ne doivent pas changer. L'enregistrement de la voix et
l'incrustation restent à faire au montage.

## Reproduire

```sh
node content/montage.mjs --concept quizz --count 2
```
