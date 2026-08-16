# Format court — Quizz

Vidéos **montées**, prêtes pour la voix off et les sous-titres. Un fichier par
vidéo, 1080×1920, 30 im/s, entre 30 s et 1 min. Aucun montage supplémentaire
n'est nécessaire.

**Principe du concept.** Le spectateur est mis en situation, voit les options réelles, doit choisir, puis le moteur tranche et chiffre ce que son réflexe coûte.

| vidéo | titre interne | score | durée | différentiel EV |
|---|---|---|---|---|
| [01 - 76s sur board bas et deconnecte face a un nit](01%20-%2076s%20sur%20board%20bas%20et%20deconnecte%20face%20a%20un%20nit/README.md) | 76s sur board bas et déconnecté face à un nit | 93/100 | 34.3 s | 7.26 bb |
| [02 - 55 sur deux broadway une surcarte tombe face a un reg](02%20-%2055%20sur%20deux%20broadway%20une%20surcarte%20tombe%20face%20a%20un%20reg/README.md) | 55 sur deux broadway, une surcarte tombe, face à un reg | 89/100 | 34.3 s | 10.53 bb |

**2 vidéo(s), 69 s au total.**

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

## Ce qui n'est pas fourni

Voix off, sous-titres et textes incrustés définitifs. Le README de chaque vidéo
donne les timecodes, les emplacements recommandés et les chiffres exacts du
moteur, pour que rien de ce qui sera ajouté ne contredise l'image.

## Reproduire

```sh
node content/montage.mjs --concept quizz --count 2
```
