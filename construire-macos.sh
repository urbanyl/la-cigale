#!/usr/bin/env bash
# Construit La Cigale pour macOS (Intel et Apple Silicon) à partir de Firefox ESR en français.
# À lancer sur un Mac (hdiutil, codesign, iconutil, sips) : le workflow « macOS » le fait sur GitHub.
#
#   1. Télécharge l'image disque officielle française depuis archive.mozilla.org.
#   2. Vérifie la somme SHA-512 et la signature GPG de Mozilla.
#   3. Applique réglages durcis, page d'accueil et identité La Cigale (comme sous Linux).
#   4. Profil propre (~/Library/Application Support/La Cigale), jamais celui de Firefox.
#   5. Signature ad hoc puis dist/LaCigale-<version>-macos.dmg.
#
# Usage : ./construire-macos.sh [--version 153.8.0esr]
# Dépendances : curl, python3 + Pillow, gpg (recommandé).
set -euo pipefail

RACINE="$(cd "$(dirname "$0")" && pwd)"
CACHE="$RACINE/construction/cache"
TRAVAIL="$RACINE/construction/macos"
VERSION_CIGALE="$(tr -d '[:space:]' < "$RACINE/VERSION")"
VERSION=""
CLE_MOZILLA="14F26682D0916CDD81E37B6D61B7B526D98F0353"

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done

etape() { printf '\n==> %s\n' "$*"; }
erreur() { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }

etape "Vérification des outils"
for outil in curl python3 hdiutil codesign iconutil sips shasum ditto; do
  command -v "$outil" >/dev/null || erreur "$outil est requis (à lancer sur macOS)."
done
python3 -c 'import PIL' 2>/dev/null || erreur "Pillow est requis : python3 -m pip install Pillow"

if [ -z "$VERSION" ]; then
  VERSION="$(curl -fsSL https://product-details.mozilla.org/1.0/firefox_versions.json \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["FIREFOX_ESR"])')"
fi
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?esr$ ]] || erreur "Version ESR invalide : $VERSION"
echo "Firefox ESR $VERSION  ->  La Cigale $VERSION_CIGALE (macOS)"

etape "Téléchargement depuis archive.mozilla.org"
mkdir -p "$CACHE"
BASE="https://archive.mozilla.org/pub/firefox/releases/$VERSION"
SOMMES="$CACHE/SHA512SUMS-$VERSION"
curl -fsSL "$BASE/SHA512SUMS" -o "$SOMMES"
NOM="Firefox $VERSION.dmg"
grep -qF " mac/fr/$NOM" "$SOMMES" || erreur "Image française introuvable pour $VERSION"
DMG_MOZ="$CACHE/firefox-$VERSION-mac-fr.dmg"
if [ ! -f "$DMG_MOZ" ]; then
  curl -fL "$BASE/mac/fr/Firefox%20$VERSION.dmg" -o "$DMG_MOZ.part"
  mv "$DMG_MOZ.part" "$DMG_MOZ"
fi

etape "Vérification de l'intégrité"
if command -v gpg >/dev/null; then
  GNUPGHOME="$(mktemp -d)"; export GNUPGHOME
  curl -fsSL "$BASE/KEY" -o "$CACHE/KEY-$VERSION"
  curl -fsSL "$BASE/SHA512SUMS.asc" -o "$SOMMES.asc"
  gpg --quiet --import "$CACHE/KEY-$VERSION" 2>/dev/null
  gpg --quiet --status-fd 1 --verify "$SOMMES.asc" "$SOMMES" 2>/dev/null \
    | grep -q "VALIDSIG .* $CLE_MOZILLA\$" \
    || erreur "Signature GPG de SHA512SUMS invalide ou clé inattendue."
  rm -rf "$GNUPGHOME"
  echo "Signature GPG de Mozilla valide (clé $CLE_MOZILLA)."
else
  echo "AVERTISSEMENT : gpg absent, signature non vérifiée (seul le SHA-512 l'est)." >&2
fi
attendu="$(grep -F " mac/fr/$NOM" "$SOMMES" | cut -d' ' -f1)"
obtenu="$(shasum -a 512 "$DMG_MOZ" | cut -d' ' -f1)"
if [ "$attendu" != "$obtenu" ]; then rm -f "$DMG_MOZ"; erreur "SHA-512 incorrect : fichier supprimé."; fi
echo "SHA-512 conforme."

etape "Extraction"
rm -rf "$TRAVAIL" && mkdir -p "$TRAVAIL/image"
POINT="$(mktemp -d)"
hdiutil attach -nobrowse -readonly -noautoopen -mountpoint "$POINT" "$DMG_MOZ" >/dev/null
APP_MOZ="$(find "$POINT" -maxdepth 1 -name '*.app' | head -n 1)"
[ -n "$APP_MOZ" ] || { hdiutil detach "$POINT" >/dev/null; erreur "Aucune application dans l'image de Mozilla."; }
APP="$TRAVAIL/image/La Cigale.app"
ditto "$APP_MOZ" "$APP"
hdiutil detach "$POINT" >/dev/null
RES="$APP/Contents/Resources"

etape "Application de la configuration La Cigale"
# Mise à jour automatique et rapports de plantage : retirés.
rm -rf "$APP/Contents/MacOS/updater.app" "$APP/Contents/MacOS/crashreporter.app" \
       "$APP/Contents/MacOS/minidump-analyzer" "$APP/Contents/MacOS/pingsender" \
       "$APP/Contents/Library/LaunchServices" "$RES/update-settings.ini" "$RES/updater.ini"
cp "$RACINE/reglages/cigale.cfg" "$RES/"
echo "lockPref(\"cigale.version\", \"$VERSION_CIGALE\");" >> "$RES/cigale.cfg"
mkdir -p "$RES/defaults/pref" "$RES/distribution" "$RES/cigale"
cp "$RACINE/reglages/defaults/pref/autoconfig.js" "$RES/defaults/pref/"
cp "$RACINE/reglages/distribution/policies.json" "$RES/distribution/"
rm -rf "$RES/cigale/accueil" && cp -R "$RACINE/accueil" "$RES/cigale/accueil"
python3 "$RACINE/outils/rebrander_omni.py" "$RES"

# Profil et instance à part : La Cigale ne touche jamais au profil ni à la fenêtre de Firefox.
python3 - "$RES/application.ini" <<'INI'
import re, sys
p = sys.argv[1]; t = open(p, encoding="utf-8").read()
def poser(t, cle, valeur):
    if re.search(rf"(?m)^{cle}=", t): return re.sub(rf"(?m)^{cle}=.*$", f"{cle}={valeur}", t)
    return re.sub(r"(?m)^\[App\]\s*$", f"[App]\n{cle}={valeur}", t, count=1)
t = poser(t, "Profile", "La Cigale")
t = poser(t, "RemotingName", "lacigale")
open(p, "w", encoding="utf-8").write(t)
INI

# Nom, identifiant et version visibles dans le Finder et le Dock
PLIST="$APP/Contents/Info.plist"
pb() { /usr/libexec/PlistBuddy -c "$1" "$PLIST" 2>/dev/null || true; }
pb "Set :CFBundleName La Cigale"
pb "Delete :CFBundleDisplayName"; pb "Add :CFBundleDisplayName string La Cigale"
pb "Set :CFBundleIdentifier io.github.urbanyl.lacigale"
pb "Set :CFBundleShortVersionString $VERSION_CIGALE"
pb "Set :CFBundleGetInfoString La Cigale $VERSION_CIGALE (Firefox ESR $VERSION)"
pb "Delete :SUFeedURL"

# Icône : le logo de La Cigale (fichier .icns construit depuis branding/png)
ICONSET="$TRAVAIL/la-cigale.iconset"; mkdir -p "$ICONSET"
SRC="$RACINE/branding/png/logo-1024.png"
for t in 16 32 128 256 512; do
  sips -z $t $t "$SRC" --out "$ICONSET/icon_${t}x${t}.png" >/dev/null
  d=$((t * 2)); [ $d -le 1024 ] && sips -z $d $d "$SRC" --out "$ICONSET/icon_${t}x${t}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$TRAVAIL/la-cigale.icns"
ICONE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' "$PLIST" 2>/dev/null || echo firefox)"
ICONE="${ICONE%.icns}.icns"
cp "$TRAVAIL/la-cigale.icns" "$RES/$ICONE"
[ -f "$RES/document.icns" ] && cp "$TRAVAIL/la-cigale.icns" "$RES/document.icns"

echo "La Cigale $VERSION_CIGALE (Firefox ESR $VERSION)" > "$RES/VERSION.txt"

etape "Signature ad hoc"
# Les fichiers modifiés invalident la signature de Mozilla : on resigne l'ensemble (sans identité Apple).
xattr -cr "$APP"
codesign --force --deep --sign - "$APP"
codesign --verify --deep "$APP" && echo "Signature ad hoc valide."

etape "Création de l'image disque"
ln -s /Applications "$TRAVAIL/image/Applications"
mkdir -p "$RACINE/dist"
SORTIE="$RACINE/dist/LaCigale-$VERSION_CIGALE-macos.dmg"
rm -f "$SORTIE"
# hdiutil échoue parfois avec « Resource busy » (analyse antivirus de macOS en cours) : on réessaie.
for essai in 1 2 3 4 5 6; do
  if hdiutil create -volname "La Cigale" -srcfolder "$TRAVAIL/image" -fs HFS+ -format UDZO -imagekey zlib-level=9 "$SORTIE" >/dev/null; then
    break
  fi
  [ "$essai" -eq 6 ] && erreur "hdiutil n'a pas pu créer l'image disque."
  echo "hdiutil occupé, nouvel essai dans 15 s ($essai/6)"
  rm -f "$SORTIE"; sleep 15
done
echo "-> $SORTIE"
