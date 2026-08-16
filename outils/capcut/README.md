# Pipeline WebM → CapCut

Convertit automatiquement les vidéos générées par la chaîne Hero Lab en MP4
directement importables dans CapCut Desktop (macOS).

```text
CLAUDE → .webm → RUSH/GENERATED → ffmpeg → RUSH/CAPCUT_READY/*.mp4 → CapCut
```

## Installation sur le Mac (une fois)

```sh
# 1. ffmpeg (vérifier d'abord : ffmpeg -version)
brew install ffmpeg        # si Homebrew manque : https://brew.sh

# 2. depuis le dépôt Hero Lab :
./outils/capcut/installer_watch.sh     # active le mode automatique
```

C'est tout. `~/RUSH/GENERATED` et `~/RUSH/CAPCUT_READY` sont créés ; tout
fichier déposé dans le premier ressort en MP4 dans le second quelques
secondes plus tard (agent launchd natif macOS, aucune dépendance de plus).

## Les quatre scripts

| script | rôle |
|---|---|
| `convert_videos.sh` | la conversion : scanne `RUSH/GENERATED`, produit les MP4 |
| `collecter.sh` | copie les vidéos du dépôt (`Format court/*/NN - titre/video.webm`) vers `RUSH/GENERATED` sous des noms uniques (`Quizz 01 - ….webm`) |
| `installer_watch.sh` | active (`./installer_watch.sh`) ou désactive (`./installer_watch.sh off`) le mode automatique |
| `watch_videos.sh` | variante au premier plan du mode automatique (Ctrl-C pour arrêter) |

## Usage manuel

```sh
./outils/capcut/collecter.sh        # dépôt → RUSH/GENERATED (noms uniques)
./outils/capcut/convert_videos.sh   # GENERATED → CAPCUT_READY
```

Dossier RUSH ailleurs que `~/RUSH` : `RUSH_DIR=/chemin ./convert_videos.sh`.

## Qualité : remux d'abord, réencodage seulement si nécessaire

Pour chaque fichier, le conteneur et les codecs sont sondés (`ffprobe`) :

- **source H.264 + yuv420p (+ AAC ou muette)** → *remux* `-c copy` : les
  données vidéo sont conservées à l'octet près, **aucune perte** ;
- **sinon** → réencodage H.264 `-preset slow -crf 17 -pix_fmt yuv420p`,
  qualité visuellement transparente. Résolution, cadence, ratio et
  orientation d'origine conservés (aucun `-r`, aucun redimensionnement,
  aucun recadrage) ; une 1080×1920 reste une 1080×1920.

**Cas des vidéos Hero Lab** : elles sont en VP8 (le ffmpeg de l'environnement
de production ne sait écrire que du WebM). Le VP8 n'a pas de place standard
dans un MP4 et CapCut ne le lit pas : pour ces fichiers, le remux est
impossible par nature — c'est toujours la voie B (réencodage), et le script
l'affiche explicitement. Elles sont muettes : le MP4 sort sans piste audio,
la voix s'ajoute dans CapCut.

Le résumé final distingue toujours les deux voies :

```text
[1/4] Quizz 01 - 76s….webm  → OK (réencodage H.264 CRF 17 (source vp8 — non lisible par CapCut en MP4))
[2/4] capture.mov           → OK (remux sans réencodage — aucune perte)
```

Chaque conversion est revérifiée après coup (`ffprobe`) : mêmes dimensions,
même cadence, même durée à 0,2 s près — sinon le fichier est marqué en erreur.

## Idempotence

- un MP4 déjà présent et plus récent que sa source est ignoré ;
- une source **modifiée** est reconvertie (comparaison des dates) ;
- les `.webm` originaux ne sont **jamais** supprimés ni modifiés ;
- noms avec espaces, accents et caractères spéciaux gérés (collecte
  `find -print0`) ; écriture atomique (`.part.mp4` puis renommage), donc pas
  de MP4 tronqué si une conversion est interrompue.

## Mode automatique : activer / désactiver / surveiller

```sh
./outils/capcut/installer_watch.sh        # activer
./outils/capcut/installer_watch.sh off    # désactiver
tail -f ~/RUSH/pipeline.log               # voir ce que fait l'agent
```

L'agent launchd (`com.herolab.capcut`) se déclenche à chaque changement dans
`~/RUSH/GENERATED` (clé `WatchPaths` — natif macOS, pas de démon
supplémentaire), avec un délai anti-rafale de 10 s. `watch_videos.sh` offre la
même chose au premier plan, avec `fswatch` si présent, sinon un balayage de 5 s.

## Vérifier une conversion à la main

```sh
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,pix_fmt,width,height,avg_frame_rate \
  -of default=noprint_wrappers=1 "AVANT.webm"
# puis la même commande sur APRÈS.mp4 : codec h264, yuv420p,
# largeur/hauteur/cadence identiques à la source.
```

## Limite connue, assumée

Ce pipeline a été construit et testé en logique (scan, idempotence, noms à
espaces/accents, choix remux/réencodage, écriture atomique) depuis
l'environnement de production Hero Lab, dont le ffmpeg est compilé sans
H.264 ni MP4 : la **première conversion réelle** doit donc être faite sur le
Mac — `./outils/capcut/convert_videos.sh` après `collecter.sh` — et le script
vérifie lui-même le résultat (`ffprobe`) et annonce la voie utilisée (A remux
/ B réencodage).
