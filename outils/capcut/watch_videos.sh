#!/bin/bash
# Mode « watch » au premier plan : convertit dès qu'un fichier apparaît ou
# change dans RUSH/GENERATED. Utilise fswatch s'il est installé (réactif),
# sinon un balayage toutes les 5 secondes — convert_videos.sh étant
# idempotent, le balayage ne refait jamais un travail déjà fait.
#
# Pour un fonctionnement en arrière-plan permanent, préférer l'agent launchd
# fourni (com.herolab.capcut.plist) : natif macOS, aucune dépendance.
#
# Usage :  ./watch_videos.sh        (Ctrl-C pour arrêter)
set -u

ICI="$(cd "$(dirname "$0")" && pwd)"
RUSH_DIR="${RUSH_DIR:-$HOME/RUSH}"
export RUSH_DIR
mkdir -p "$RUSH_DIR/GENERATED"

echo "Surveillance de : $RUSH_DIR/GENERATED  (Ctrl-C pour arrêter)"
"$ICI/convert_videos.sh"

if command -v fswatch >/dev/null 2>&1; then
  fswatch -o "$RUSH_DIR/GENERATED" | while read -r _; do
    "$ICI/convert_videos.sh"
  done
else
  echo "(fswatch absent — balayage toutes les 5 s ; « brew install fswatch » pour du temps réel)"
  while true; do
    sleep 5
    "$ICI/convert_videos.sh" | grep -v "déjà converti" | sed '/^$/d;/^VIDEO PIPELINE$/d;/^Aucune vidéo/d;/^-\{2,\}$/d'
  done
fi
