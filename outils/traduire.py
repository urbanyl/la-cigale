"""Prépare une copie anglaise des sources de La Cigale.

  python outils/traduire.py <dossier_sortie>

Copie accueil/, apparence/, branding/, reglages/, outils/ et LICENCE.txt dans <dossier_sortie>,
puis applique traductions/en.py :
  * FICHIERS : fichiers remplacés en entier par leur version anglaise (traductions/en/…) ;
  * PAIRES : remplacements exacts « texte français -> texte anglais », fichier par fichier.
Chaque texte français doit être trouvé : sinon la construction s'arrête (texte changé depuis).
"""
import importlib.util
import shutil
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
TRAD = RACINE / "traductions"
COPIES = ["accueil", "apparence", "branding", "reglages", "outils", "LICENCE.txt", "LICENSE", "VERSION"]


def charger():
    spec = importlib.util.spec_from_file_location("en", TRAD / "en.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    sortie = Path(sys.argv[1]).resolve()
    if sortie.exists():
        shutil.rmtree(sortie)
    sortie.mkdir(parents=True)
    for nom in COPIES:
        src = RACINE / nom
        if src.is_dir():
            shutil.copytree(src, sortie / nom, ignore=shutil.ignore_patterns("__pycache__"))
        elif src.exists():
            shutil.copy2(src, sortie / nom)
    en = charger()
    manquants = []
    for chemin, source in en.FICHIERS.items():
        shutil.copy2(TRAD / "en" / source, sortie / chemin)
    for chemin, paires in en.PAIRES.items():
        f = sortie / chemin
        texte = f.read_text(encoding="utf-8")
        for fr, anglais in paires:
            if fr not in texte:
                manquants.append(f"{chemin} : {fr[:70]!r}")
                continue
            texte = texte.replace(fr, anglais)
        f.write_text(texte, encoding="utf-8", newline="")
    for chemin in en.HTML:
        f = sortie / chemin
        f.write_text(f.read_text(encoding="utf-8").replace('<html lang="fr"', '<html lang="en"'), encoding="utf-8", newline="")
    if manquants:
        print("Textes introuvables :\n  " + "\n  ".join(manquants))
        sys.exit(1)
    print(f"Copie anglaise prête : {sortie}")


if __name__ == "__main__":
    main()
