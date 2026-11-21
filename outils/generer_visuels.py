"""Génère toute l'identité visuelle de La Cigale à partir du logo source.

Source : branding/source/noun_Cicada_6087481.svg
  « Cicada » par Alex Muravev, The Noun Project, licence CC BY 3.0 (crédit obligatoire).

Produit :
  branding/symbole-noir.svg, branding/symbole-blanc.svg   cigale seule, recadrée
  branding/logo.svg                                       icône : cigale noire sur carré blanc arrondi
  branding/wordmark.svg                                   icône + « La Cigale »
  branding/png/logo-<taille>.png, branding/png/symbole-*.png, branding/lacigale.ico
  accueil/img/symbole-blanc.webp, accueil/img/fond.jpg

Le rendu SVG → PNG passe par Edge ou Chrome en mode headless (aucune dépendance native).
Usage : python outils/generer_visuels.py   (nécessite Pillow)
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RACINE = Path(__file__).resolve().parent.parent
BRANDING = RACINE / "branding"
SOURCE = BRANDING / "source" / "noun_Cicada_6087481.svg"
ACCUEIL_IMG = RACINE / "accueil" / "img"

RAYON_COINS = 224         # sur 1024
REMPLISSAGE_ICONE = 0.78  # part du carré occupée par la cigale
NAVIGATEURS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
]


def formes_source() -> str:
    # contenu dessiné du SVG source, sans le texte de crédit
    svg = SOURCE.read_text(encoding="utf-8")
    corps = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    return re.sub(r"<text\b.*?</text>", "", corps, flags=re.S).strip()


def svg_symbole(formes: str, couleur: str, vue: str = "0 0 100 100") -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vue}" fill="{couleur}" '
            f'role="img" aria-label="La Cigale">{formes}</svg>\n')


def trouver_navigateur() -> str:
    for chemin in NAVIGATEURS:
        if os.path.exists(chemin):
            return chemin
    sys.exit("Edge ou Chrome introuvable : nécessaire pour convertir le SVG en PNG.")


def rendre_svg(svg: str, taille: int = 1024) -> Image.Image:
    # rend un SVG en PNG transparent via le navigateur headless
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "image.svg").write_text(svg, encoding="utf-8")
        (tmp / "page.html").write_text(
            '<!doctype html><html><body style="margin:0;background:transparent">'
            f'<img src="image.svg" width="{taille}" height="{taille}" style="display:block"></body></html>',
            encoding="utf-8")
        sortie = tmp / "rendu.png"
        subprocess.run([
            trouver_navigateur(), "--headless=new", "--disable-gpu", "--hide-scrollbars",
            f"--user-data-dir={tmp / 'profil'}", "--default-background-color=00000000",
            f"--window-size={taille},{taille}", f"--screenshot={sortie}",
            (tmp / "page.html").as_uri(),
        ], check=True, capture_output=True, timeout=120)
        return Image.open(sortie).convert("RGBA").crop((0, 0, taille, taille))


def recadrage(rendu: Image.Image):
    # boîte englobante carrée du dessin, en unités du viewBox d'origine (0..100)
    x0, y0, x1, y1 = rendu.getchannel("A").getbbox()
    cote = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    k = 100 / rendu.width
    return (cx - cote / 2) * k, (cy - cote / 2) * k, cote * k


def teinter(img: Image.Image, rgb) -> Image.Image:
    sortie = Image.new("RGBA", img.size, rgb + (0,))
    sortie.putalpha(img.getchannel("A"))
    return sortie


def icone(symbole_blanc: Image.Image, taille: int) -> Image.Image:
    # carré noir arrondi, halo discret et grain (comme le fond d'accueil), cigale blanche
    ss = 4
    t = taille * ss
    # Fond : dégradé vertical graphite -> noir, halo clair en haut
    fond = Image.linear_gradient("L").resize((t, t)).point(lambda v: 30 - v * 20 // 255)
    fond = Image.merge("RGB", (fond, fond, fond.point(lambda v: v + 2))).convert("RGBA")
    halo = Image.new("L", (t, t), 0)
    ImageDraw.Draw(halo).ellipse((t * 0.05, -t * 0.55, t * 0.95, t * 0.45), fill=255)
    halo = halo.filter(ImageFilter.GaussianBlur(t * 0.18)).point(lambda v: v * 22 // 255)
    fond.paste(Image.new("RGBA", (t, t), (255, 255, 255, 255)), (0, 0), halo)

    if symbole_blanc is not None:
        cote = round(t * REMPLISSAGE_ICONE)
        fond.alpha_composite(symbole_blanc.resize((cote, cote), Image.LANCZOS), ((t - cote) // 2, (t - cote) // 2))
    fond = fond.resize((taille, taille), Image.LANCZOS)

    # Grain appliqué à la taille finale (sinon il disparaît au redimensionnement)
    if taille >= 48:
        grain = Image.effect_noise((taille, taille), 40).convert("RGBA")
        grain.putalpha(18)
        fond = Image.alpha_composite(fond, grain)

    # Coins arrondis + liseré clair très fin pour détacher l'icône des fonds sombres
    masque = Image.new("L", (t, t), 0)
    ImageDraw.Draw(masque).rounded_rectangle((0, 0, t - 1, t - 1), RAYON_COINS * t / 1024, fill=255)
    if taille >= 32:
        lisere = Image.new("RGBA", (t, t), (0, 0, 0, 0))
        ImageDraw.Draw(lisere).rounded_rectangle((0, 0, t - 1, t - 1), RAYON_COINS * t / 1024,
                                                 outline=(255, 255, 255, 34), width=max(ss, t // 128))
        fond = Image.alpha_composite(fond, lisere.resize((taille, taille), Image.LANCZOS))
    fond.putalpha(masque.resize((taille, taille), Image.LANCZOS))
    return fond


def fond_accueil(symbole_blanc: Image.Image, l=1920, h=1080, clair=False, cigale=True) -> Image.Image:
    # fond de la page d'accueil : grain, halo et cigale fantôme, en version nuit ou claire
    base = Image.new("RGBA", (l, h), (238, 237, 233, 255) if clair else (10, 10, 11, 255))
    halo = Image.new("L", (l, h), 0)
    ImageDraw.Draw(halo).ellipse((l * 0.25, -h * 0.6, l * 0.75, h * 0.5), fill=40)
    halo = halo.filter(ImageFilter.GaussianBlur(240))
    base.paste(Image.new("RGBA", (l, h), (255, 255, 255, 255)), (0, 0), halo.point(lambda v: v // 3 * (3 if clair else 1)))

    if cigale:
        teinte = teinter(symbole_blanc, (0, 0, 0)) if clair else symbole_blanc
        fantome = teinte.resize((1000, 1000), Image.LANCZOS).rotate(-14, resample=Image.BICUBIC)
        fantome.putalpha(fantome.getchannel("A").point(lambda v: v * (7 if clair else 9) // 255))
        base.alpha_composite(fantome, (l - 760, h - 720))

    grain = Image.effect_noise((l, h), 24).convert("RGBA")
    grain.putalpha(11 if clair else 9)
    return Image.alpha_composite(base, grain).convert("RGB")


def main():
    png = BRANDING / "png"
    png.mkdir(parents=True, exist_ok=True)
    ACCUEIL_IMG.mkdir(parents=True, exist_ok=True)
    for ancien in png.glob("*.png"):
        ancien.unlink()
    (ACCUEIL_IMG / "logo.svg").unlink(missing_ok=True)

    formes = formes_source()

    # rendu brut pour mesurer le dessin, puis recadrage carré serré
    x, y, c = recadrage(rendre_svg(svg_symbole(formes, "#000")))
    vue = f"{x:.2f} {y:.2f} {c:.2f} {c:.2f}"

    # sVG finaux
    (BRANDING / "symbole-noir.svg").write_text(svg_symbole(formes, "#000", vue), encoding="utf-8")
    (BRANDING / "symbole-blanc.svg").write_text(svg_symbole(formes, "#fff", vue), encoding="utf-8")
    marge = 1024 * (1 - REMPLISSAGE_ICONE) / 2
    interieur = (f'<svg x="{marge:.0f}" y="{marge:.0f}" width="{1024 - 2 * marge:.0f}" '
                 f'height="{1024 - 2 * marge:.0f}" viewBox="{vue}" fill="#fff">{formes}</svg>')
    # Fond noir : dégradé, halo, grain (feTurbulence), liseré fin
    fond_svg = (
        '<defs>'
        '<linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#1e1e20"/><stop offset="1" stop-color="#0a0a0b"/></linearGradient>'
        '<radialGradient id="ch" cx="0.5" cy="0" r="0.7">'
        '<stop offset="0" stop-color="#fff" stop-opacity="0.09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>'
        '</radialGradient>'
        '<filter id="cg" x="0" y="0" width="100%" height="100%">'
        '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>'
        '<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0"/></filter>'
        f'<clipPath id="cc"><rect width="1024" height="1024" rx="{RAYON_COINS}"/></clipPath>'
        '</defs>'
        '<g clip-path="url(#cc)">'
        '<rect width="1024" height="1024" fill="url(#cf)"/>'
        '<rect width="1024" height="1024" fill="url(#ch)"/>'
        '<rect width="1024" height="1024" filter="url(#cg)"/></g>'
        f'<rect x="4" y="4" width="1016" height="1016" rx="{RAYON_COINS - 4}" fill="none" '
        'stroke="#fff" stroke-opacity="0.13" stroke-width="8"/>'
    )
    (BRANDING / "logo.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="La Cigale">'
        f'{fond_svg}{interieur}</svg>\n',
        encoding="utf-8")
    (BRANDING / "wordmark.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 320" role="img" aria-label="La Cigale">'
        f'<g transform="scale(0.3125)">{fond_svg}{interieur}</g>'
        '<text x="370" y="208" font-family="Inter, Segoe UI, Cantarell, sans-serif" font-size="150" '
        'font-weight="600" letter-spacing="-3" fill="currentColor">La Cigale</text></svg>\n',
        encoding="utf-8")

    # pNG et ICO
    symbole = rendre_svg((BRANDING / "symbole-noir.svg").read_text(encoding="utf-8"), 1024)
    symbole.save(png / "symbole-noir-1024.png", optimize=True)
    blanc = teinter(symbole, (255, 255, 255))
    blanc.save(png / "symbole-blanc-1024.png", optimize=True)

    tailles = [16, 22, 24, 32, 48, 64, 128, 256, 512, 1024]
    rendus = {n: icone(blanc, n) for n in tailles}
    for n, im in rendus.items():
        im.save(png / f"logo-{n}.png", optimize=True)
    for n in (64, 256):  # fond seul (pour les icônes dérivées : navigation privée, tâches)
        icone(None, n).save(png / f"fond-icone-{n}.png", optimize=True)
    try:  # icône « navigation privée » (masque) ; le module utilise l'API Windows
        sys.path.insert(0, str(Path(__file__).parent))
        from icones_exe import glyphe
        prive = glyphe("prive", 256)
        prive.save(png / "prive-256.png", optimize=True)
        prive.resize((64, 64), Image.LANCZOS).save(png / "prive-64.png", optimize=True)
    except (ImportError, AttributeError, OSError) as e:
        print("Icône de navigation privée non régénérée (Windows requis) :", e)
    rendus[256].save(BRANDING / "lacigale.ico",
                     sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    # page d'accueil
    # Logo en WebP sans perte, à 3x sa taille d'affichage (6 Ko au lieu d'un SVG de 160 Ko).
    # Le fond reste en JPEG : sur ce dégradé très sombre, le WebP crée des aplats visibles.
    for ancien in ("symbole-blanc.svg", "fond.webp"):
        (ACCUEIL_IMG / ancien).unlink(missing_ok=True)
    blanc.resize((168, 168), Image.LANCZOS).save(ACCUEIL_IMG / "symbole-blanc.webp", lossless=True, method=6)
    rendus[64].save(ACCUEIL_IMG / "favicon.png", optimize=True)
    jpeg = dict(quality=88, optimize=True, progressive=True)
    fond_accueil(blanc).save(ACCUEIL_IMG / "fond.jpg", **jpeg)                       # Cigale, nuit
    fond_accueil(blanc, clair=True).save(ACCUEIL_IMG / "fond-clair.jpg", **jpeg)     # Cigale, clair
    fond_accueil(blanc, cigale=False).save(ACCUEIL_IMG / "grain.jpg", **jpeg)        # Grain seul, nuit
    fond_accueil(blanc, clair=True, cigale=False).save(ACCUEIL_IMG / "grain-clair.jpg", **jpeg)
    teinter(blanc, (14, 14, 15)).resize((168, 168), Image.LANCZOS).save(
        ACCUEIL_IMG / "symbole-noir.webp", lossless=True, method=6)
    print("Visuels générés dans", BRANDING, "et", ACCUEIL_IMG)


if __name__ == "__main__":
    main()
