#!/usr/bin/env bash
# Fabrique dist/la-cigale_<version>_amd64.deb (Ubuntu, Debian) à partir de dist/la-cigale.
# Appelé par construire-linux.sh ; il faut dpkg-deb, pas besoin d'être root.
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$RACINE/dist/la-cigale"
VERSION_CIGALE="$1"
VERSION_FIREFOX="${2%esr}"
SORTIE="$RACINE/dist/la-cigale_${VERSION_CIGALE}_amd64.deb"

# On assemble dans /tmp : sous WSL, /mnt/c ne garde pas les droits des fichiers.
PAQ="$(mktemp -d)"
trap 'rm -rf "$PAQ"' EXIT

mkdir -p "$PAQ/DEBIAN" "$PAQ/opt" "$PAQ/usr/bin" "$PAQ/usr/share/applications" "$PAQ/usr/share/doc/la-cigale"
cp -r "$SOURCE" "$PAQ/opt/la-cigale"
rm -f "$PAQ/opt/la-cigale/installer.sh" "$PAQ/opt/la-cigale/la-cigale.desktop"

# droits propres : 755 pour les dossiers, les binaires et les scripts, 644 pour le reste
find "$PAQ" -type d -exec chmod 755 {} +
find "$PAQ/opt" -type f -exec chmod 644 {} +
find "$PAQ/opt" -type f -size +3c | while read -r f; do
  case "$(head -c 4 "$f" | od -An -c | tr -d ' ')" in
    177ELF*|\#!*) chmod 755 "$f" ;;
  esac
done
# les bibliothèques n'ont pas à être exécutables
find "$PAQ/opt" -type f -name '*.so' -exec chmod 644 {} +

ln -s /opt/la-cigale/la-cigale "$PAQ/usr/bin/la-cigale"
sed 's|^Exec=la-cigale|Exec=/usr/bin/la-cigale|' "$SOURCE/la-cigale.desktop" \
  > "$PAQ/usr/share/applications/la-cigale.desktop"
for t in 16 22 24 32 48 64 128 256 512; do
  install -Dm644 "$RACINE/branding/png/logo-$t.png" "$PAQ/usr/share/icons/hicolor/${t}x${t}/apps/la-cigale.png"
done
install -Dm644 "$RACINE/branding/logo.svg" "$PAQ/usr/share/icons/hicolor/scalable/apps/la-cigale.svg"
install -m644 "$RACINE/LICENCE.txt" "$PAQ/usr/share/doc/la-cigale/copyright"
find "$PAQ/usr" -type f -exec chmod 644 {} +

taille="$(du -sk --apparent-size "$PAQ/opt" "$PAQ/usr" | awk '{s+=$1} END {print s}')"

cat > "$PAQ/DEBIAN/control" <<EOF
Package: la-cigale
Version: $VERSION_CIGALE
Architecture: amd64
Maintainer: urbanyl <urbanyl@users.noreply.github.com>
Installed-Size: $taille
Depends: libc6 (>= 2.28), libgtk-3-0t64 | libgtk-3-0, libasound2t64 | libasound2, libx11-xcb1, libdbus-1-3, libxtst6
Recommends: fonts-dejavu-core
Provides: www-browser, gnome-www-browser
Section: web
Priority: optional
Homepage: https://github.com/urbanyl/la-cigale
Description: navigateur web français axé sur l'anonymat et la sécurité
 La Cigale est un dérivé de Firefox ESR $VERSION_FIREFOX en français, réglé pour
 la vie privée : anti-empreinte façon Tor Browser, uBlock Origin intégré,
 DNS chiffré, HTTPS obligatoire, aucune télémétrie, tout effacé à la fermeture.
EOF

cat > "$PAQ/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
if [ "$1" = configure ]; then
  update-alternatives --install /usr/bin/x-www-browser x-www-browser /usr/bin/la-cigale 40
  update-alternatives --install /usr/bin/gnome-www-browser gnome-www-browser /usr/bin/la-cigale 40
fi
EOF

cat > "$PAQ/DEBIAN/prerm" <<'EOF'
#!/bin/sh
set -e
if [ "$1" = remove ] || [ "$1" = deconfigure ]; then
  update-alternatives --remove x-www-browser /usr/bin/la-cigale
  update-alternatives --remove gnome-www-browser /usr/bin/la-cigale
fi
EOF
chmod 755 "$PAQ/DEBIAN/postinst" "$PAQ/DEBIAN/prerm"

dpkg-deb --root-owner-group -Zxz --build "$PAQ" "$SORTIE" >/dev/null
echo "-> $SORTIE"
