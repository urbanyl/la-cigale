#!/usr/bin/env bash
# Construit La Cigale pour Linux (x86_64) à partir de Firefox ESR en français.
#
#   1. Récupère la dernière version ESR auprès de Mozilla (product-details).
#   2. Télécharge l'archive officielle française depuis archive.mozilla.org.
#   3. Vérifie la somme SHA-512 et, si gpg est présent, la signature GPG de Mozilla.
#   4. Applique réglages durcis, page d'accueil et identité La Cigale.
#   5. Produit dist/LaCigale-<version>-linux-x86_64.tar.gz (avec installer.sh).
#
# Usage : ./construire-linux.sh [--version 140.5.0esr] [--sans-rebrand]
# Dépendances : curl, tar, xz, sha512sum, python3 + Pillow ; gpg recommandé.
set -euo pipefail

RACINE="$(cd "$(dirname "$0")" && pwd)"
CACHE="$RACINE/construction/cache"
DIST="$RACINE/dist/la-cigale"
VERSION_CIGALE="$(tr -d '[:space:]' < "$RACINE/VERSION")"
VERSION=""
REBRAND=1
# Empreinte de la clé de signature des versions Firefox (Mozilla Software Releases).
CLE_MOZILLA="14F26682D0916CDD81E37B6D61B7B526D98F0353"

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --sans-rebrand) REBRAND=0; shift ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done

etape() { printf '\n==> %s\n' "$*"; }
erreur() { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }

etape "Vérification des outils"
for outil in curl tar sha512sum python3; do
  command -v "$outil" >/dev/null || erreur "$outil est requis."
done
python3 -c 'import PIL' 2>/dev/null || erreur "Pillow est requis : python3 -m pip install --user Pillow"

if [ -z "$VERSION" ]; then
  etape "Recherche de la dernière version de Firefox ESR"
  VERSION="$(curl -fsSL https://product-details.mozilla.org/1.0/firefox_versions.json \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["FIREFOX_ESR"])')"
fi
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?esr$ ]] || erreur "Version ESR invalide : $VERSION"
echo "Firefox ESR $VERSION  ->  La Cigale $VERSION_CIGALE"

etape "Téléchargement depuis archive.mozilla.org"
mkdir -p "$CACHE"
BASE="https://archive.mozilla.org/pub/firefox/releases/$VERSION"
SOMMES="$CACHE/SHA512SUMS-$VERSION"
curl -fsSL "$BASE/SHA512SUMS" -o "$SOMMES"
ARCHIVE=""
for ext in tar.xz tar.bz2; do
  nom="firefox-$VERSION.$ext"
  if grep -q " linux-x86_64/fr/$nom\$" "$SOMMES"; then ARCHIVE="$nom"; break; fi
done
[ -n "$ARCHIVE" ] || erreur "Archive française introuvable pour $VERSION"
CHEMIN="$CACHE/$ARCHIVE"
if [ ! -f "$CHEMIN" ]; then
  curl -fL "$BASE/linux-x86_64/fr/$ARCHIVE" -o "$CHEMIN.part"
  mv "$CHEMIN.part" "$CHEMIN"
fi

etape "Vérification de l'intégrité"
if command -v gpg >/dev/null; then
  GNUPGHOME="$(mktemp -d)"; export GNUPGHOME
  trap 'rm -rf "$GNUPGHOME"' EXIT
  curl -fsSL "$BASE/KEY" -o "$CACHE/KEY-$VERSION"
  curl -fsSL "$BASE/SHA512SUMS.asc" -o "$SOMMES.asc"
  gpg --quiet --import "$CACHE/KEY-$VERSION" 2>/dev/null
  gpg --quiet --status-fd 1 --verify "$SOMMES.asc" "$SOMMES" 2>/dev/null \
    | grep -q "VALIDSIG .* $CLE_MOZILLA\$" \
    || erreur "Signature GPG de SHA512SUMS invalide ou clé inattendue."
  echo "Signature GPG de Mozilla valide (clé $CLE_MOZILLA)."
else
  echo "AVERTISSEMENT : gpg absent, signature non vérifiée (seul le SHA-512 l'est)." >&2
fi
attendu="$(grep " linux-x86_64/fr/$ARCHIVE\$" "$SOMMES" | cut -d' ' -f1)"
obtenu="$(sha512sum "$CHEMIN" | cut -d' ' -f1)"
if [ "$attendu" != "$obtenu" ]; then rm -f "$CHEMIN"; erreur "SHA-512 incorrect : fichier supprimé."; fi
echo "SHA-512 conforme."

etape "Extraction"
rm -rf "$DIST" && mkdir -p "$DIST"
tar -xf "$CHEMIN" -C "$DIST" --strip-components=1

etape "Application de la configuration La Cigale"
# Mise à jour automatique et rapports de plantage : retirés.
rm -f "$DIST"/{updater,updater.ini,update-settings.ini,crashreporter,crashreporter.ini,pingsender,minidump-analyzer}
cp "$RACINE/reglages/cigale.cfg" "$DIST/"
echo "lockPref(\"cigale.version\", \"$VERSION_CIGALE\");" >> "$DIST/cigale.cfg"
mkdir -p "$DIST/defaults/pref" "$DIST/distribution" "$DIST/cigale" "$DIST/icones"
cp "$RACINE/reglages/defaults/pref/autoconfig.js" "$DIST/defaults/pref/"
cp "$RACINE/reglages/distribution/policies.json" "$DIST/distribution/"
cp -r "$RACINE/accueil" "$DIST/cigale/accueil"
for t in 16 22 24 32 48 64 128 256 512; do cp "$RACINE/branding/png/logo-$t.png" "$DIST/icones/"; done
cp "$RACINE/branding/logo.svg" "$DIST/icones/la-cigale.svg"
if [ "$REBRAND" -eq 1 ]; then python3 "$RACINE/outils/rebrander_omni.py" "$DIST"; fi

# Lanceur : profil dédié, classe de fenêtre propre (bonne icône dans le dock).
cat > "$DIST/la-cigale" <<'LANCEUR'
#!/bin/sh
ICI="$(dirname "$(readlink -f "$0")")"
PROFIL="${XDG_DATA_HOME:-$HOME/.local/share}/la-cigale/profil"
mkdir -p "$PROFIL" && chmod 700 "$PROFIL"
exec "$ICI/firefox" --name la-cigale --class LaCigale -profile "$PROFIL" "$@"
LANCEUR
chmod +x "$DIST/la-cigale"

cat > "$DIST/la-cigale.desktop" <<'BUREAU'
[Desktop Entry]
Type=Application
Name=La Cigale
GenericName=Navigateur Web
Comment=Naviguer sur le Web avec anonymat et sécurité
Exec=la-cigale %u
Icon=la-cigale
Terminal=false
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;
StartupWMClass=LaCigale
Keywords=web;internet;navigateur;vie privée;anonymat;
Actions=nouvelle-fenetre;fenetre-privee;

[Desktop Action nouvelle-fenetre]
Name=Nouvelle fenêtre
Exec=la-cigale --new-window

[Desktop Action fenetre-privee]
Name=Nouvelle fenêtre de navigation privée
Exec=la-cigale --private-window
BUREAU

cp "$RACINE/installeur/installer-linux.sh" "$DIST/installer.sh"
chmod +x "$DIST/installer.sh"
echo "La Cigale $VERSION_CIGALE (Firefox ESR $VERSION)" > "$DIST/VERSION.txt"

etape "Création de l'archive"
SORTIE="$RACINE/dist/LaCigale-$VERSION_CIGALE-linux-x86_64.tar.gz"
tar -C "$RACINE/dist" --owner=0 --group=0 --mode='go-w' -czf "$SORTIE" la-cigale
echo "-> $SORTIE"

if command -v dpkg-deb >/dev/null; then
  etape "Création du paquet .deb (Ubuntu, Debian)"
  bash "$RACINE/installeur/paquet-deb.sh" "$VERSION_CIGALE" "$VERSION"
else
  echo "dpkg-deb absent : pas de paquet .deb."
fi
etape "Terminé. Tester : $DIST/la-cigale   |   Installer : $DIST/installer.sh"
