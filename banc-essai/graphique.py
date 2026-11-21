"""Graphique SVG des résultats du banc d'essai (banc-essai/resultats.json -> docs/captures/benchmark.svg)."""
import json
from pathlib import Path

ICI = Path(__file__).resolve().parent
resultats = json.loads((ICI / "resultats.json").read_text(encoding="utf-8"))
SORTIE = ICI.parent / "docs" / "captures" / "benchmark.svg"

MESURES = [
    ("demarrage_ms", "Démarrage", "ms"),
    ("javascript_ms", "JavaScript", "ms"),
    ("dom_ms", "DOM", "ms"),
    ("canvas_ms", "Canvas 2D", "ms"),
    ("memoire_mo", "Mémoire", "Mo"),
]
NAVS = list(resultats)
L, MARGE, COL = 920, 40, 168
LIGNE, ESPACE = 22, 6
H_BLOC = len(NAVS) * (LIGNE + ESPACE) + 44
HAUT = 96 + 2 * H_BLOC - 10
BARRE_MAX = COL - 64

parties = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {L} {HAUT}" width="{L}" height="{HAUT}" '
    'font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif">',
    f'<rect width="{L}" height="{HAUT}" rx="18" fill="#0d0d0e"/>',
    f'<text x="{MARGE}" y="50" fill="#ededed" font-size="22" font-weight="600">Banc d\'essai</text>',
    f'<text x="{MARGE}" y="74" fill="#8c8c90" font-size="13">Plus court = meilleur · médiane de 3 lancements × 5 tours · '
    'Windows 11, profil vierge, sans interface</text>',
]
# Deux rangées : 3 mesures puis 2, chacune avec ses barres horizontales
for i, (cle, titre, unite) in enumerate(MESURES):
    rangee, colonne = divmod(i, 3)
    x0 = MARGE + colonne * (COL + 120)
    y0 = 110 + rangee * H_BLOC
    valeurs = {n: resultats[n][cle] for n in NAVS}
    vmax = max(valeurs.values())
    meilleur = min(valeurs.values())
    parties.append(f'<text x="{x0}" y="{y0}" fill="#ededed" font-size="14" font-weight="600">{titre}</text>')
    for j, nav in enumerate(NAVS):
        y = y0 + 16 + j * (LIGNE + ESPACE)
        v = valeurs[nav]
        largeur = max(4, round(v / vmax * BARRE_MAX))
        cigale = nav == "La Cigale"
        couleur = "#f2f2f2" if cigale else "#4a4a50"
        texte = "#ededed" if cigale else "#9a9aa0"
        gras = ' font-weight="600"' if cigale else ""
        parties += [
            f'<text x="{x0}" y="{y + 15}" fill="{texte}" font-size="12"'
            f'{gras}>{nav}</text>',
            f'<rect x="{x0 + 86}" y="{y + 3}" width="{largeur}" height="{LIGNE - 6}" rx="4" fill="{couleur}"/>',
            f'<text x="{x0 + 92 + largeur}" y="{y + 15}" fill="{texte}" font-size="12">'
            f'{v:,}'.replace(",", " ") + f' {unite}{" ★" if v == meilleur else ""}</text>',
        ]
parties.append("</svg>")
SORTIE.write_text("\n".join(parties), encoding="utf-8")
print(SORTIE)
