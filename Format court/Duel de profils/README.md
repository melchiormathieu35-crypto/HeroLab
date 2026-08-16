# Format court — Duel de profils

Vidéos **montées**, prêtes pour la voix off et les sous-titres. Un fichier par
vidéo, 1080×1920, 30 im/s, entre 30 s et 1 min. Aucun montage supplémentaire
n'est nécessaire.

**Principe du concept.** Même main, même board, même mise en face — seul l'adversaire change. La même action, correcte contre le premier profil, devient une erreur chiffrée contre le second. La leçon : on ne joue pas contre des cartes, on joue contre quelqu'un.

| vidéo | titre interne | score | durée | différentiel EV |
|---|---|---|---|---|
| [01 - QQ Relancer 2 5 bb correct contre nit erreur contre](01%20-%20QQ%20Relancer%202%205%20bb%20correct%20contre%20nit%20erreur%20contre/README.md) | QQ — continuer face à un 3bet face à un nit — puis face à station, la même action bascule | 100/100 | 36.9 s | 11.39 bb |
| [02 - AKo Relancer 2 5 bb correct contre nit erreur contre](02%20-%20AKo%20Relancer%202%205%20bb%20correct%20contre%20nit%20erreur%20contre/README.md) | AKo — continuer face à un 3bet face à un nit — puis face à station, la même action bascule | 100/100 | 36.9 s | 8.55 bb |
| [03 - 55 Relancer Pot correct contre nit erreur contre station](03%20-%2055%20Relancer%20Pot%20correct%20contre%20nit%20erreur%20contre%20station/README.md) | 55 sur board très connecté face à un nit — puis face à station, la même action bascule | 84/100 | 36.9 s | 1.67 bb |

**3 vidéo(s), 111 s au total.**

## Structure d'une vidéo de ce concept

| beat | rôle |
|---|---|
| HOOK | la main seule — le point commun des deux manches |
| MANCHE A | la table contre le premier profil, badge visible |
| CHOICE A | les options réelles — le spectateur choisit contre CE profil |
| REVEAL A | l'action optimale est jouée et prouvée par la liste des espérances |
| MANCHE B | même situation rechargée — seul le badge de profil a changé |
| TENSION B | la question du duel : la même action tient-elle encore ? |
| REVEAL B | la même action, rejouée à l'identique, reçoit le verdict opposé |
| PAYOFF | la liste des espérances de la manche B — le reclassement complet |

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
