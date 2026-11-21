#!/usr/bin/env bash
# Prépare le dépôt APT « plat » de La Cigale, hébergé dans la release GitHub « apt ».
#
#   installeur/depot-apt.sh <paquet.deb> <dossier de sortie>
#
# La clé privée de signature est prise dans le trousseau gpg courant (variable CLE_APT = son
# identifiant ou son adresse). Le dossier produit contient InRelease, Release, Release.gpg,
# Packages, Packages.gz, le .deb et la clé publique la-cigale.gpg.
set -euo pipefail

DEB="$1"
SORTIE="$2"
: "${CLE_APT:?CLE_APT doit désigner la clé de signature}"

mkdir -p "$SORTIE"
cp "$DEB" "$SORTIE/"
cd "$SORTIE"

# GitHub ne sert pas les chemins en « ./ », on les retire
apt-ftparchive packages . | sed 's#^Filename: \./#Filename: #' > Packages
gzip -9kf Packages
apt-ftparchive \
  -o APT::FTPArchive::Release::Origin="La Cigale" \
  -o APT::FTPArchive::Release::Label="La Cigale" \
  -o APT::FTPArchive::Release::Description="Navigateur La Cigale" \
  -o APT::FTPArchive::Release::Architectures="amd64" \
  release . > Release

gpg --batch --yes --local-user "$CLE_APT" --clearsign -o InRelease Release
gpg --batch --yes --local-user "$CLE_APT" -abs -o Release.gpg Release
gpg --batch --yes --export "$CLE_APT" > la-cigale.gpg

ls -l
