# Rushes avant montage — format court

Matière brute pour TikTok, Reels et Shorts, produite depuis le mode Studio de
Hero Lab. 3 vidéo(s), 21 plans,
81 s au total. Tous les plans sont en 1080×1920, 30 im/s.

| vidéo | spot | plans | durée | série |
|---|---|---|---|---|
| [Tirage couleur au turn face à une grosse mise](tu-fais-quoi/turn_draw_price/README.md) | `turn_draw_price` | 7 | 27 s | tu-fais-quoi |
| [Défense de grosse blinde face à un nit](tu-fais-quoi/river_overfold_bb/README.md) | `river_overfold_bb` | 7 | 27 s | tu-fais-quoi |
| [Petite paire face à un 3bet](tu-fais-quoi/pre_facing_3bet/README.md) | `pre_facing_3bet` | 7 | 27 s | tu-fais-quoi |

## Comment ces spots ont été choisis

Ils ne l'ont pas été à la main. `content/scan.mjs` soumet chaque spot candidat
au moteur de l'application, lit l'espérance de chaque option légale, et classe
selon trois mesures : l'action instinctive est-elle perdante, l'équité
contredit-elle la bonne décision, et combien coûte l'erreur. On mesure d'abord,
on raconte ensuite — jamais l'inverse.

## La chaîne

| étape | commande | rôle |
|---|---|---|
| catalogue | `content/spots.mjs` | spots candidats, en DSL Studio |
| sélection | `node content/scan.mjs` | classement par le moteur |
| tournage | `node content/produce.mjs --serie <clé>` | plans 1080×1920 |
| contrôle | `node content/qa.mjs` | format, durée, image, cadrage |
| README | `node content/readme.mjs` | cette documentation |

## Ce qui n'est pas fourni

Voix off, sous-titres, texte à l'écran et montage final. Chaque README de
vidéo donne en revanche les chiffres exacts du moteur, pour que le texte
ajouté ne contredise jamais l'image.

## Format des fichiers

WebM / VP8. Le `ffmpeg` de l'environnement de production est compilé sans
multiplexeur MP4. Les fichiers s'importent tels quels dans les logiciels de
montage courants ; la conversion en MP4 se fait à l'export final. La commande
de conversion figure dans chaque README de vidéo.
