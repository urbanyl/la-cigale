# Construire et personnaliser La Cigale


## Windows

Prérequis : [Python 3](https://www.python.org) avec Pillow (`python -m pip install Pillow`)
et [7-Zip](https://www.7-zip.org). En option : [Inno Setup 6](https://jrsoftware.org/isdl.php)
pour l'installeur, et [rcedit](https://github.com/electron/rcedit/releases) (`rcedit-x64.exe`
dans `outils\`) pour l'icône de l'exécutable.

```powershell
.\construire-windows.ps1
```

Résultats dans `dist\` :
- `LaCigale-<version>-windows-x64-portable.zip` : lancer `La Cigale (portable).cmd` ;
- `LaCigale-<version>-windows-x64-installeur.exe` (si Inno Setup est présent).

## Linux

Prérequis : `curl`, `tar`, `xz`, `python3` avec Pillow ; `gpg` fortement recommandé.

```sh
./construire-linux.sh
```

Résultat : `dist/LaCigale-<version>-linux-x86_64.tar.gz`. Après extraction, lancer
`./installer.sh` (installation dans `~/.local`, sans root).

## Options

| Windows | Linux | Effet |
|---|---|---|
| `-Version 140.5.0esr` | `--version 140.5.0esr` | Version ESR précise |
| `-SansRebrand` | `--sans-rebrand` | Ne touche pas à `omni.ja` (diagnostic) |
| `-SansInstalleur` | | Version portable seulement |

## Organisation du projet

```
reglages/
  cigale.cfg                  préférences durcies (le cœur du projet)
  defaults/pref/autoconfig.js charge cigale.cfg
  distribution/policies.json  stratégies d'entreprise : moteurs, extensions, verrous
accueil/                      page d'accueil et nouvel onglet (HTML/CSS/JS locaux)
branding/                     logo source, SVG, PNG, ICO générés
outils/
  generer_visuels.py          régénère toute l'identité visuelle depuis le logo source
  rebrander_omni.py           renomme « Firefox » en « La Cigale » dans l'interface
installeur/                   installeur Windows (Inno Setup) et installation Linux
docs/securite.md              modèle de menace, compromis, chaîne de confiance
```

## Personnaliser

- **Logo** : remplacer `branding/source/*.svg`, ajuster `SOURCE` dans
  `outils/generer_visuels.py`, puis `python outils/generer_visuels.py`.
- **Réglages** : modifier `reglages/cigale.cfg` (`defaultPref` = modifiable,
  `lockPref` = verrouillé).
- **Raccourcis par défaut** : `RACCOURCIS_DEFAUT` dans `accueil/accueil.js`.

## Mises à jour

Le programme de mise à jour de Firefox est retiré. Reconstruisez La Cigale à chaque
nouvelle version ESR (environ toutes les 4 semaines) pour recevoir les correctifs de sécurité.

## Limites connues

- L'onglet « À propos » interne et quelques textes rares peuvent encore mentionner Firefox :
  le rebranding agit sur les fichiers de marque, pas sur le code compilé.
- Sous Windows, `lacigale.exe` garde l'icône Firefox si rcedit n'est pas disponible.
- La Cigale doit être lancée via ses raccourcis ou lanceurs (profil dédié). Lancer
  `lacigale.exe` directement utiliserait le profil Firefox habituel.

## Licence

MPL-2.0, comme Firefox. Logo : « Cicada » par Alex Muravev (The Noun Project, CC BY 3.0).
Voir [LICENCE.txt](LICENCE.txt).
