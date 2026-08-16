# Rushes avant montage — format court

Matière brute pour TikTok, Instagram Reels et YouTube Shorts, produite depuis le
mode Studio de Hero Lab. 10 vidéo(s), 60 plans,
240 s au total. Tout est en 1080×1920, 30 im/s, un plan par fichier.

| vidéo | titre interne | score | plans | durée | différentiel EV |
|---|---|---|---|---|---|
| [Video 001](Video%20001/README.md) | 76s sur board bas et déconnecté face à un nit | 93/100 | 6 | 24 s | 7.26 bb |
| [Video 002](Video%20002/README.md) | 55 sur board très connecté face à un nit | 89/100 | 6 | 24 s | 6.13 bb |
| [Video 003](Video%20003/README.md) | 55 sur deux broadway, une surcarte tombe, face à un reg | 89/100 | 6 | 24 s | 10.53 bb |
| [Video 004](Video%20004/README.md) | QQ — continuer face à un 3bet face à un nit | 86/100 | 6 | 22 s | 7.65 bb |
| [Video 005](Video%20005/README.md) | 98s sur sec, dame haute, carte qui connecte, face à un nit | 84/100 | 6 | 24 s | 28.16 bb |
| [Video 006](Video%20006/README.md) | 76s sur board sec, tête haute face à un reg | 83/100 | 6 | 24 s | 4.80 bb |
| [Video 007](Video%20007/README.md) | Q9s sur board pairé face à un TAG | 83/100 | 6 | 24 s | 4.91 bb |
| [Video 008](Video%20008/README.md) | KTs sur sec, dame haute, carte blanche, face à un TAG | 83/100 | 6 | 24 s | 15.21 bb |
| [Video 009](Video%20009/README.md) | KTs sur monotone, une surcarte tombe, face à un reg | 83/100 | 6 | 24 s | 11.65 bb |
| [Video 010](Video%20010/README.md) | AKo — continuer face à un 3bet face à un nit | 81/100 | 6 | 22 s | 9.32 bb |

## Comment ces spots ont été choisis

Aucun n'a été choisi à la main. La chaîne énumère des situations réelles à
partir du vocabulaire du produit (positions, profils, limites, grammaire
Studio), soumet chacune à `Judge.evaluate`, et note le potentiel de contenu sur
100 à partir des seuls chiffres du moteur : paradoxe, contre-intuitivité,
différentiel d'EV, difficulté, curiosité, lisibilité, force du reveal, intérêt
pédagogique, potentiel de débat et de série.

Deux garde-fous s'appliquent ensuite :

- **anti-redondance** — deux spots qui racontent la même chose (même modèle,
  même famille de main, même texture, même nature de paradoxe, même famille
  d'action correcte) ne donnent qu'une vidéo, la mieux notée ;
- **fragilité** — un spot dont la bonne réponse repose entièrement sur
  l'estimation de fold equity du modèle est écarté, même s'il score haut. Voir
  `content/scan.mjs`.

## La chaîne

| étape | commande | rôle |
|---|---|---|
| génération | `content/generate.mjs` | énumère les situations à partir du vocabulaire réel |
| sélection | `node content/scan.mjs` | note sur 100, écarte fragiles et doublons |
| blueprint | `content/blueprint.mjs` | traduit un spot en plan de tournage |
| tournage | `content/produce.mjs` | exécute le blueprint, image par image |
| contrôle | `node content/qa.mjs` | format, durée, image, cadrage, cohérence moteur |
| README | `content/readme.mjs` | cette documentation |
| tout | `node content/engine.mjs --count 10` | la chaîne complète |

## Contrôle qualité

**60 plans contrôlés, aucune anomalie.**

## Ce qui n'est pas fourni

Voix off, sous-titres, textes définitifs et montage final. Chaque README de
vidéo donne en revanche les chiffres exacts du moteur et l'emplacement
recommandé de chaque élément, pour que le texte ajouté ne contredise jamais
l'image.
