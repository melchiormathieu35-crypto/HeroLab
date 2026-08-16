#!/bin/bash
# Pont entre la chaîne Hero Lab et le pipeline CapCut.
#
# Toutes les vidéos montées s'appellent `video.webm` dans leur dossier : les
# déposer telles quelles dans RUSH/GENERATED les ferait s'écraser entre elles.
# Ce script copie chaque vidéo du dépôt vers RUSH/GENERATED sous un nom
# unique et lisible : « Quizz 01 - 76s sur board bas ….webm ».
#
# Idempotent : une vidéo déjà copiée et inchangée n'est pas recopiée (la date
# de la source est comparée), donc convert_videos.sh ne la reconvertira pas.
# Les originaux du dépôt ne sont jamais touchés.
#
# Usage, depuis la racine du dépôt Hero Lab :
#   ./outils/capcut/collecter.sh
set -u

DEPOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUSH_DIR="${RUSH_DIR:-$HOME/RUSH}"
SRC="$RUSH_DIR/GENERATED"
mkdir -p "$SRC"

# mtime portable — voir convert_videos.sh : sur GNU/Linux `stat -f` répond du
# texte au lieu d'échouer, on ne garde qu'une réponse purement numérique.
mtime() {
  m="$(stat -f %m "$1" 2>/dev/null)"
  case "$m" in *[!0-9]*|"") m="$(stat -c %Y "$1" 2>/dev/null)";; esac
  case "$m" in *[!0-9]*|"") m=0;; esac
  printf '%s\n' "$m"
}

copies=0; deja=0
while IFS= read -r -d '' f; do
  dossier="$(basename "$(dirname "$f")")"                 # « 01 - 76s sur … »
  concept="$(basename "$(dirname "$(dirname "$f")")")"    # « Quizz »
  dst="$SRC/$concept $dossier.webm"
  if [ -f "$dst" ] && [ "$(mtime "$dst")" -ge "$(mtime "$f")" ]; then
    deja=$((deja + 1)); continue
  fi
  cp -p "$f" "$dst" && { copies=$((copies + 1)); echo "  + $concept $dossier.webm"; }
done < <(find "$DEPOT/Format court" -mindepth 3 -maxdepth 3 -type f -name 'video.webm' -print0)

echo ""
echo "$copies vidéo(s) copiée(s), $deja déjà à jour, dans : $SRC"
echo "Étape suivante : $(dirname "$0")/convert_videos.sh (ou rien, si le mode automatique est actif)"
