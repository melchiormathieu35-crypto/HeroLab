#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Pipeline vidéo → CapCut.
#
#   RUSH/GENERATED/*.webm|mkv|mov|mp4   →   RUSH/CAPCUT_READY/*.mp4
#
# Règle de qualité : JAMAIS de réencodage quand un remux suffit.
#   · source déjà H.264 + yuv420p (+ AAC ou muette)  → remux `-c copy`,
#     données vidéo conservées à l'octet près ;
#   · sinon (VP8/VP9/HEVC…) → réencodage H.264 CRF 17 preset slow, yuv420p,
#     résolution / cadence / ratio / orientation conservés (aucun -r, aucun
#     scale). Les WebM produits par la chaîne Hero Lab sont en VP8 : le VP8
#     n'a pas de place standard dans un MP4 et CapCut ne le lit pas — pour
#     eux, le réencodage n'est pas un choix, c'est la seule voie.
#
# Idempotent : un MP4 déjà présent et plus récent que sa source est ignoré ;
# une source modifiée est reconvertie. Noms avec espaces et accents gérés.
# Les sources ne sont JAMAIS supprimées ni modifiées.
#
# Usage :
#   ./convert_videos.sh                 # RUSH par défaut : ~/RUSH
#   RUSH_DIR=/chemin ./convert_videos.sh
# ─────────────────────────────────────────────────────────────────────────────
set -u

RUSH_DIR="${RUSH_DIR:-$HOME/RUSH}"
SRC="$RUSH_DIR/GENERATED"
OUT="$RUSH_DIR/CAPCUT_READY"
FFMPEG="${FFMPEG:-ffmpeg}"
FFPROBE="${FFPROBE:-ffprobe}"
CRF="${CRF:-17}"

if ! command -v "$FFMPEG" >/dev/null 2>&1; then
  echo "ERREUR : ffmpeg introuvable. Sur macOS : brew install ffmpeg" >&2; exit 1
fi
if ! command -v "$FFPROBE" >/dev/null 2>&1; then
  echo "ERREUR : ffprobe introuvable (fourni avec ffmpeg). Sur macOS : brew install ffmpeg" >&2; exit 1
fi
mkdir -p "$SRC" "$OUT"

# mtime portable. Piège réel : sur GNU/Linux, `stat -f` ne se trompe pas
# bruyamment — il décrit le SYSTÈME DE FICHIERS et la comparaison de dates
# devient silencieusement fausse. On ne garde donc une réponse que si elle est
# purement numérique.
mtime() {
  m="$(stat -f %m "$1" 2>/dev/null)"
  case "$m" in *[!0-9]*|"") m="$(stat -c %Y "$1" 2>/dev/null)";; esac
  case "$m" in *[!0-9]*|"") m=0;; esac
  printf '%s\n' "$m"
}

sonde_video() {  # codec, pix_fmt, largeur, hauteur, fps — première piste vidéo
  "$FFPROBE" -v error -select_streams v:0 \
    -show_entries stream=codec_name,pix_fmt,width,height,avg_frame_rate \
    -of default=noprint_wrappers=1 "$1" 2>/dev/null
}
sonde_audio() {  # codec de la première piste audio, vide si muette
  "$FFPROBE" -v error -select_streams a:0 \
    -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$1" 2>/dev/null
}
sonde_duree() {
  "$FFPROBE" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1" 2>/dev/null
}
champ() { printf '%s\n' "$1" | sed -n "s/^$2=//p" | head -1; }

# ── Collecte (null-safe : espaces, accents, quotes dans les noms)
set --
while IFS= read -r -d '' f; do set -- "$@" "$f"; done < <(
  find "$SRC" -maxdepth 1 -type f \
    \( -iname '*.webm' -o -iname '*.mkv' -o -iname '*.mov' -o -iname '*.mp4' \) -print0
)

echo ""
echo "VIDEO PIPELINE"
echo ""
total=$#
[ "$total" -eq 0 ] && { echo "Aucune vidéo dans $SRC"; exit 0; }

i=0; ok=0; err=0; ignorees=0; remux=0; reenc=0
for src in "$@"; do
  i=$((i + 1))
  nom="$(basename "$src")"
  base="${nom%.*}"
  dst="$OUT/$base.mp4"
  etiquette=$(printf '[%d/%d] %-40s' "$i" "$total" "$nom")

  # Déjà à jour ? (source plus vieille que le MP4 existant)
  if [ -f "$dst" ] && [ "$(mtime "$dst")" -gt "$(mtime "$src")" ]; then
    echo "$etiquette → déjà converti, ignoré"
    ignorees=$((ignorees + 1)); continue
  fi

  v="$(sonde_video "$src")"
  vcodec="$(champ "$v" codec_name)"; pixfmt="$(champ "$v" pix_fmt)"
  larg="$(champ "$v" width)"; haut="$(champ "$v" height)"; fps="$(champ "$v" avg_frame_rate)"
  acodec="$(sonde_audio "$src")"
  if [ -z "$vcodec" ]; then
    echo "$etiquette → ERREUR : piste vidéo illisible"; err=$((err + 1)); continue
  fi

  # Audio : muette → aucune piste ; AAC → copie ; autre → AAC haute qualité.
  if [ -z "$acodec" ]; then A=(-an)
  elif [ "$acodec" = "aac" ]; then A=(-c:a copy)
  else A=(-c:a aac -b:a 192k); fi

  tmp="$dst.part.mp4"
  if [ "$vcodec" = "h264" ] && [ "$pixfmt" = "yuv420p" ] && { [ -z "$acodec" ] || [ "$acodec" = "aac" ]; }; then
    mode="remux sans réencodage — aucune perte"
    "$FFMPEG" -hide_banner -loglevel error -i "$src" -map 0:v:0 $( [ -n "$acodec" ] && echo "-map 0:a:0" ) \
      -c copy -movflags +faststart -y "$tmp"
  else
    mode="réencodage H.264 CRF $CRF (source $vcodec — non lisible par CapCut en MP4)"
    "$FFMPEG" -hide_banner -loglevel error -i "$src" \
      -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p "${A[@]}" \
      -movflags +faststart -y "$tmp"
  fi

  if [ $? -ne 0 ] || [ ! -s "$tmp" ]; then
    rm -f "$tmp"
    echo "$etiquette → ERREUR de conversion"; err=$((err + 1)); continue
  fi
  mv -f "$tmp" "$dst"

  # Vérification après coup : mêmes dimensions, même cadence, même durée (±0,2 s).
  v2="$(sonde_video "$dst")"
  d1="$(sonde_duree "$src")"; d2="$(sonde_duree "$dst")"
  probleme=""
  [ "$(champ "$v2" width)x$(champ "$v2" height)" != "${larg}x${haut}" ] && probleme="dimensions modifiées"
  [ "$(champ "$v2" avg_frame_rate)" != "$fps" ] && probleme="${probleme:+$probleme, }cadence modifiée"
  if [ -n "$d1" ] && [ -n "$d2" ]; then
    ecart=$(awk -v a="$d1" -v b="$d2" 'BEGIN{d=a-b; if(d<0)d=-d; print (d>0.2)?"1":"0"}')
    [ "$ecart" = "1" ] && probleme="${probleme:+$probleme, }durée modifiée ($d1 → $d2)"
  fi

  if [ -n "$probleme" ]; then
    echo "$etiquette → ATTENTION : $probleme"
    err=$((err + 1))
  else
    echo "$etiquette → OK ($mode)"
    ok=$((ok + 1))
    case "$mode" in remux*) remux=$((remux + 1));; *) reenc=$((reenc + 1));; esac
  fi
done

echo ""
echo "--------------------------------"
echo "$((ok + err)) vidéo(s) traitée(s), $ignorees déjà à jour"
echo "$ok réussite(s) — $remux remux sans perte, $reenc réencodage(s) H.264"
echo "$err erreur(s)"
echo "Dossier de sortie :"
echo "$OUT"
echo "--------------------------------"
[ "$err" -gt 0 ] && exit 1
exit 0
