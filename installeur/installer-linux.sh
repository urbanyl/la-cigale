#!/bin/sh
# Installe (ou désinstalle) La Cigale pour l'utilisateur courant, sans droits root.
#   ./installer.sh              installe dans ~/.local/opt/la-cigale
#   ./installer.sh --desinstaller
set -eu

ICI="$(cd "$(dirname "$0")" && pwd)"
DONNEES="${XDG_DATA_HOME:-$HOME/.local/share}"
CIBLE="$HOME/.local/opt/la-cigale"
BIN="$HOME/.local/bin"

desinstaller() {
  rm -rf "$CIBLE"
  rm -f "$BIN/la-cigale" "$DONNEES/applications/la-cigale.desktop"
  find "$DONNEES/icons/hicolor" -name 'la-cigale.*' -delete 2>/dev/null || true
  command -v update-desktop-database >/dev/null && update-desktop-database "$DONNEES/applications" || true
  echo "La Cigale est désinstallée. Votre profil reste dans $DONNEES/la-cigale (supprimez-le à la main si besoin)."
}

if [ "${1:-}" = "--desinstaller" ]; then desinstaller; exit 0; fi

if [ "$ICI" != "$CIBLE" ]; then
  rm -rf "$CIBLE"
  mkdir -p "$(dirname "$CIBLE")"
  cp -r "$ICI" "$CIBLE"
fi

mkdir -p "$BIN" "$DONNEES/applications"
ln -sf "$CIBLE/la-cigale" "$BIN/la-cigale"
for t in 16 22 24 32 48 64 128 256 512; do
  mkdir -p "$DONNEES/icons/hicolor/${t}x${t}/apps"
  cp "$CIBLE/icones/logo-$t.png" "$DONNEES/icons/hicolor/${t}x${t}/apps/la-cigale.png"
done
mkdir -p "$DONNEES/icons/hicolor/scalable/apps"
cp "$CIBLE/icones/la-cigale.svg" "$DONNEES/icons/hicolor/scalable/apps/la-cigale.svg"
sed "s|^Exec=la-cigale|Exec=$CIBLE/la-cigale|" "$CIBLE/la-cigale.desktop" > "$DONNEES/applications/la-cigale.desktop"

command -v update-desktop-database >/dev/null && update-desktop-database "$DONNEES/applications" || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$DONNEES/icons/hicolor" || true

echo "La Cigale est installée dans $CIBLE."
echo "Lancez-la depuis le menu des applications, ou avec la commande : la-cigale"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "Astuce : ajoutez $BIN à votre PATH." ;; esac
