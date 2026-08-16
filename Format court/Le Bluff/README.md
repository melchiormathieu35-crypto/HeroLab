# Format court — Le Bluff

Vidéos **montées**, prêtes pour la voix off et les sous-titres. Un fichier par
vidéo, 1080×1920, 30 im/s, entre 30 s et 1 min. Aucun montage supplémentaire
n'est nécessaire.

**Principe du concept.** Une relance qui a l'air d'un bon coup — mais un bluff se juge par un calcul, pas par une impression. Le moteur écrit lui-même l'équation (« cette mise demande X % de folds, ce profil en donne Y % ») ; parfois elle valide l'instinct, parfois elle le dément. La série alterne les deux pour enseigner la méthode, jamais un réflexe.

| vidéo | titre interne | score | durée | différentiel EV |
|---|---|---|---|---|
| [01 - le bluff brule JJ sur as haut une surcarte tombe face a une](01%20-%20le%20bluff%20brule%20JJ%20sur%20as%20haut%20une%20surcarte%20tombe%20face%20a%20une/README.md) | Le bluff brûle : JJ sur as haut, une surcarte tombe, face à une calling station | 75/100 | 33.9 s | 20.71 bb |
| [02 - le bluff brule 88 sur sec dame haute carte qui connecte face a](02%20-%20le%20bluff%20brule%2088%20sur%20sec%20dame%20haute%20carte%20qui%20connecte%20face%20a/README.md) | Le bluff brûle : 88 sur sec, dame haute, carte qui connecte, face à une calling station | 75/100 | 33.9 s | 21.75 bb |
| [03 - le bluff brule A5s sur paire carte qui connecte face a une](03%20-%20le%20bluff%20brule%20A5s%20sur%20paire%20carte%20qui%20connecte%20face%20a%20une/README.md) | Le bluff brûle : A5s sur pairé, carte qui connecte, face à une calling station | 75/100 | 33.9 s | 21.39 bb |
| [04 - le bluff brule Q9s sur deux broadway carte blanche face a une](04%20-%20le%20bluff%20brule%20Q9s%20sur%20deux%20broadway%20carte%20blanche%20face%20a%20une/README.md) | Le bluff brûle : Q9s sur deux broadway, carte blanche, face à une calling station | 75/100 | 33.9 s | 21.35 bb |
| [05 - le bluff brule A3s sur bas et deconnecte carte qui connecte](05%20-%20le%20bluff%20brule%20A3s%20sur%20bas%20et%20deconnecte%20carte%20qui%20connecte/README.md) | Le bluff brûle : A3s sur bas et déconnecté, carte qui connecte, face à une calling station | 70/100 | 33.9 s | 9.57 bb |
| [06 - le bluff brule AJo sur sec tete haute carte blanche face a une](06%20-%20le%20bluff%20brule%20AJo%20sur%20sec%20tete%20haute%20carte%20blanche%20face%20a%20une/README.md) | Le bluff brûle : AJo sur sec, tête haute, carte blanche, face à une calling station | 68/100 | 33.9 s | 10.65 bb |
| [07 - le bluff brule 98s sur bas et deconnecte carte blanche face a](07%20-%20le%20bluff%20brule%2098s%20sur%20bas%20et%20deconnecte%20carte%20blanche%20face%20a/README.md) | Le bluff brûle : 98s sur bas et déconnecté, carte blanche, face à une calling station | 68/100 | 33.9 s | 7.87 bb |
| [08 - le bluff passe 33 sur board tres connecte face a un nit](08%20-%20le%20bluff%20passe%2033%20sur%20board%20tres%20connecte%20face%20a%20un%20nit/README.md) | Le bluff passe : 33 sur board très connecté face à un nit | 50/100 | 33.9 s | 0.00 bb |
| [09 - le bluff passe 76s sur board bas et deconnecte face a un nit](09%20-%20le%20bluff%20passe%2076s%20sur%20board%20bas%20et%20deconnecte%20face%20a%20un%20nit/README.md) | Le bluff passe : 76s sur board bas et déconnecté face à un nit | 49/100 | 33.9 s | 0.00 bb |
| [10 - le bluff passe TT sur board monotone face a un nit](10%20-%20le%20bluff%20passe%20TT%20sur%20board%20monotone%20face%20a%20un%20nit/README.md) | Le bluff passe : TT sur board monotone face à un nit | 49/100 | 33.9 s | 0.00 bb |

**10 vidéo(s), 339 s au total.**

## Structure d'une vidéo de ce concept

| beat | rôle |
|---|---|
| HOOK | la main et la mise — la question posée, pas encore la réponse |
| SITUATION | la table et le profil adverse — le facteur qui décide de tout ici |
| LE PARI | la mise isolée, freeze — le temps de deviner ce qu'elle exige |
| REVEAL | le bluff est joué ; le moteur affiche son propre calcul et tranche |
| LA LEÇON | l'espérance de chaque option — la preuve, et la méthode à retenir |

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
