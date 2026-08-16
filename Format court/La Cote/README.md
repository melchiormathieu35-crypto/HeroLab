# Format court — La Cote

Vidéos **montées**, prêtes pour la voix off et les sous-titres. Un fichier par
vidéo, 1080×1920, 30 im/s, entre 30 s et 1 min. Aucun montage supplémentaire
n'est nécessaire.

**Principe du concept.** Le prix à payer, le pot, et la question que tout joueur devrait se poser : combien d'équité ce prix exige-t-il, et combien en ai-je vraiment ? Le moteur écrit les deux nombres à l'écran — parfois la cote dit non, parfois elle dit oui. La leçon est la méthode, pas la main.

| vidéo | titre interne | score | durée | différentiel EV |
|---|---|---|---|---|
| [01 - la cote dit oui QQ sur sec tete haute carte qui connecte face a](01%20-%20la%20cote%20dit%20oui%20QQ%20sur%20sec%20tete%20haute%20carte%20qui%20connecte%20face%20a/README.md) | La cote dit oui : QQ sur sec, tête haute, carte qui connecte, face à un maniac | 26/100 | 33.5 s | 0.00 bb |
| [02 - la cote dit non 33 sur tres connecte une surcarte tombe face a](02%20-%20la%20cote%20dit%20non%2033%20sur%20tres%20connecte%20une%20surcarte%20tombe%20face%20a/README.md) | La cote dit non : 33 sur très connecté, une surcarte tombe, face à un TAG | 84/100 | 33.5 s | 16.14 bb |
| [03 - la cote dit non A3s sur sec dame haute carte blanche face a une](03%20-%20la%20cote%20dit%20non%20A3s%20sur%20sec%20dame%20haute%20carte%20blanche%20face%20a%20une/README.md) | La cote dit non : A3s sur sec, dame haute, carte blanche, face à une calling station | 75/100 | 33.5 s | 15.97 bb |
| [04 - la cote dit non 76s sur sec dame haute carte blanche face a une](04%20-%20la%20cote%20dit%20non%2076s%20sur%20sec%20dame%20haute%20carte%20blanche%20face%20a%20une/README.md) | La cote dit non : 76s sur sec, dame haute, carte blanche, face à une calling station | 75/100 | 33.5 s | 15.76 bb |
| [05 - la cote dit non 55 sur as haut une surcarte tombe face a une](05%20-%20la%20cote%20dit%20non%2055%20sur%20as%20haut%20une%20surcarte%20tombe%20face%20a%20une/README.md) | La cote dit non : 55 sur as haut, une surcarte tombe, face à une calling station | 73/100 | 33.5 s | 9.41 bb |
| [06 - la cote dit oui 98s sur sec tete haute carte qui connecte face](06%20-%20la%20cote%20dit%20oui%2098s%20sur%20sec%20tete%20haute%20carte%20qui%20connecte%20face/README.md) | La cote dit oui : 98s sur sec, tête haute, carte qui connecte, face à un maniac | 29/100 | 33.5 s | 0.00 bb |
| [07 - la cote dit oui TT sur monotone carte blanche face a un LAG](07%20-%20la%20cote%20dit%20oui%20TT%20sur%20monotone%20carte%20blanche%20face%20a%20un%20LAG/README.md) | La cote dit oui : TT sur monotone, carte blanche, face à un LAG | 28/100 | 33.5 s | 0.00 bb |
| [08 - la cote dit non KTs sur paire une surcarte tombe face a un reg](08%20-%20la%20cote%20dit%20non%20KTs%20sur%20paire%20une%20surcarte%20tombe%20face%20a%20un%20reg/README.md) | La cote dit non : KTs sur pairé, une surcarte tombe, face à un reg | 80/100 | 33.5 s | 8.09 bb |
| [09 - la cote dit non Q9s sur board paire face a une calling station](09%20-%20la%20cote%20dit%20non%20Q9s%20sur%20board%20paire%20face%20a%20une%20calling%20station/README.md) | La cote dit non : Q9s sur board pairé face à une calling station | 71/100 | 33.5 s | 5.65 bb |
| [10 - la cote dit non A5s sur board sec dame haute face a un TAG](10%20-%20la%20cote%20dit%20non%20A5s%20sur%20board%20sec%20dame%20haute%20face%20a%20un%20TAG/README.md) | La cote dit non : A5s sur board sec, dame haute face à un TAG | 83/100 | 33.5 s | 5.27 bb |

**10 vidéo(s), 335 s au total.**

## Structure d'une vidéo de ce concept

| beat | rôle |
|---|---|
| HOOK | la main et le prix à payer — la promesse d'un calcul, pas la réponse |
| SITUATION | la table, l'adversaire, la mise en face |
| LA COTE | le prix isolé à l'écran — l'équité exigée par la cote |
| REVEAL | le réflexe est joué : le moteur compare l'exigé au réel et tranche |
| ÉQUITÉ | le panneau d'équité en grand — la preuve chiffrée, tenue jusqu'au bout |

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
