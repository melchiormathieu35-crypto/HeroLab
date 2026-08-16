#!/bin/bash
# Installe (ou désinstalle) le mode automatique : agent launchd natif macOS.
#
#   ./installer_watch.sh          # active la conversion automatique
#   ./installer_watch.sh off      # la désactive
set -u

ICI="$(cd "$(dirname "$0")" && pwd)"
PLIST_SRC="$ICI/com.herolab.capcut.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.herolab.capcut.plist"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Cet installeur est pour macOS (launchd). Sur une autre machine, utiliser watch_videos.sh." >&2
  exit 1
fi

if [ "${1:-}" = "off" ]; then
  launchctl unload "$PLIST_DST" 2>/dev/null
  rm -f "$PLIST_DST"
  echo "Mode automatique désactivé."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/RUSH/GENERATED" "$HOME/RUSH/CAPCUT_READY"
sed -e "s|__SCRIPT__|$ICI/convert_videos.sh|g" -e "s|__HOME__|$HOME|g" \
  "$PLIST_SRC" > "$PLIST_DST"
launchctl unload "$PLIST_DST" 2>/dev/null
launchctl load "$PLIST_DST"

echo "Mode automatique activé."
echo "  Dépose tes vidéos dans : $HOME/RUSH/GENERATED"
echo "  Les MP4 arrivent dans  : $HOME/RUSH/CAPCUT_READY"
echo "  Journal                : $HOME/RUSH/pipeline.log"
echo "  Désactiver             : $ICI/installer_watch.sh off"
