# Format court — Quizz

Vidéos **montées**, prêtes pour la voix off et les sous-titres. Un fichier par
vidéo, 1080×1920, 30 im/s, entre 30 s et 1 min. Aucun montage supplémentaire
n'est nécessaire.

**Principe du concept.** Le spectateur est mis en situation, voit les options réelles, doit choisir, puis le moteur tranche et chiffre ce que son réflexe coûte.

| vidéo | titre interne | score | durée | différentiel EV |
|---|---|---|---|---|
| [01 - 76s sur board bas et deconnecte face a un nit](01%20-%2076s%20sur%20board%20bas%20et%20deconnecte%20face%20a%20un%20nit/README.md) | 76s sur board bas et déconnecté face à un nit | 93/100 | 34.3 s | 7.26 bb |
| [02 - 55 sur deux broadway une surcarte tombe face a un reg](02%20-%2055%20sur%20deux%20broadway%20une%20surcarte%20tombe%20face%20a%20un%20reg/README.md) | 55 sur deux broadway, une surcarte tombe, face à un reg | 89/100 | 34.3 s | 10.53 bb |
| [03 - 55 sur board tres connecte face a un nit](03%20-%2055%20sur%20board%20tres%20connecte%20face%20a%20un%20nit/README.md) | 55 sur board très connecté face à un nit | 89/100 | 34.3 s | 6.13 bb |
| [04 - QQ continuer face a un 3bet face a un nit](04%20-%20QQ%20continuer%20face%20a%20un%203bet%20face%20a%20un%20nit/README.md) | QQ — continuer face à un 3bet face à un nit | 86/100 | 33.3 s | 7.65 bb |
| [05 - 98s sur sec dame haute carte qui connecte face a un nit](05%20-%2098s%20sur%20sec%20dame%20haute%20carte%20qui%20connecte%20face%20a%20un%20nit/README.md) | 98s sur sec, dame haute, carte qui connecte, face à un nit | 84/100 | 34.3 s | 28.16 bb |
| [06 - 76s sur board sec tete haute face a un reg](06%20-%2076s%20sur%20board%20sec%20tete%20haute%20face%20a%20un%20reg/README.md) | 76s sur board sec, tête haute face à un reg | 83/100 | 34.3 s | 4.80 bb |
| [07 - Q9s sur board paire face a un TAG](07%20-%20Q9s%20sur%20board%20paire%20face%20a%20un%20TAG/README.md) | Q9s sur board pairé face à un TAG | 83/100 | 34.3 s | 4.91 bb |
| [08 - KTs sur sec dame haute carte blanche face a un TAG](08%20-%20KTs%20sur%20sec%20dame%20haute%20carte%20blanche%20face%20a%20un%20TAG/README.md) | KTs sur sec, dame haute, carte blanche, face à un TAG | 83/100 | 34.3 s | 15.21 bb |
| [09 - KTs sur monotone une surcarte tombe face a un reg](09%20-%20KTs%20sur%20monotone%20une%20surcarte%20tombe%20face%20a%20un%20reg/README.md) | KTs sur monotone, une surcarte tombe, face à un reg | 83/100 | 34.3 s | 11.65 bb |
| [10 - AKo continuer face a un 3bet face a un nit](10%20-%20AKo%20continuer%20face%20a%20un%203bet%20face%20a%20un%20nit/README.md) | AKo — continuer face à un 3bet face à un nit | 81/100 | 33.3 s | 9.32 bb |

**10 vidéo(s), 341 s au total.**

## Structure d'une vidéo de ce concept

| beat | rôle |
|---|---|
| HOOK | la main seule, sans contexte — tenir les deux premières secondes |
| SITUATION | la table, la position, l'adversaire, le board |
| TENSION | la donnée qui rend la décision coûteuse, tenue à l'écran |
| CHOICE | les options réelles et leurs montants — le temps de choix |
| REVEAL | l'action instinctive est jouée, le moteur tranche |
| PAYOFF | l'espérance de chaque option — la preuve |

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
