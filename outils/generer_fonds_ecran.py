"""Fonds d'écran La Cigale en 4K UHD (3840 × 2160, PNG sans perte) dans fonds-ecran/.

Usage : python outils/generer_fonds_ecran.py   (Pillow, et Edge ou Chrome pour le rendu du SVG)
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from generer_visuels import BRANDING, RACINE, rendre_svg, teinter

L, H = 3840, 2160
SORTIE = RACINE / "fonds-ecran"
POLICES = Path(r"C:\Windows\Fonts")


def police(nom, taille):
    for candidat in (POLICES / nom, Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")):
        if candidat.exists():
            return ImageFont.truetype(str(candidat), taille)
    return ImageFont.load_default(taille)


def grain(img, force=24, alpha=9):
    bruit = Image.effect_noise(img.size, force).convert("RGBA")
    bruit.putalpha(alpha)
    return Image.alpha_composite(img.convert("RGBA"), bruit)


def degrade(couleurs, l=L, h=H):
    # dégradé vertical par paliers [(position 0..1, (r, g, b)), …]
    colonne = Image.new("RGB", (1, h))
    px = colonne.load()
    for y in range(h):
        t = y / (h - 1)
        for (p0, c0), (p1, c1) in zip(couleurs, couleurs[1:]):
            if p0 <= t <= p1:
                k = (t - p0) / (p1 - p0)
                k = k * k * (3 - 2 * k)
                px[0, y] = tuple(round(a + (b - a) * k) for a, b in zip(c0, c1))
                break
    return colonne.resize((l, h)).convert("RGBA")


def halo(img, boite, couleur, intensite, flou):
    masque = Image.new("L", img.size, 0)
    ImageDraw.Draw(masque).ellipse(boite, fill=intensite)
    masque = masque.filter(ImageFilter.GaussianBlur(flou))
    img.paste(Image.new("RGBA", img.size, couleur + (255,)), (0, 0), masque)


def opacite(img, facteur):
    img = img.copy()
    img.putalpha(img.getchannel("A").point(lambda v: round(v * facteur)))
    return img


def texte_espace(dessin, xy, texte, fonte, couleur, espacement, ancre="m"):
    # texte avec interlettrage ; ancre « m » = centré sur x
    largeurs = [dessin.textlength(c, font=fonte) for c in texte]
    total = sum(largeurs) + espacement * (len(texte) - 1)
    x, y = xy
    if ancre == "m":
        x -= total / 2
    for c, w in zip(texte, largeurs):
        dessin.text((x, y), c, font=fonte, fill=couleur)
        x += w + espacement


# 1. Comme la page d'accueil : nuit, halo en haut, cigale fantôme en bas à droite
def accueil(blanc):
    img = Image.new("RGBA", (L, H), (10, 10, 11, 255))
    halo(img, (L * 0.25, -H * 0.6, L * 0.75, H * 0.5), (255, 255, 255), 13, 480)
    fantome = blanc.resize((2000, 2000), Image.LANCZOS).rotate(-14, resample=Image.BICUBIC)
    img.alpha_composite(opacite(fantome, 9 / 255), (L - 1520, H - 1440))
    return grain(img)


# 2. Minimal : la cigale au centre, le nom dessous
def minimal(blanc):
    img = degrade([(0, (22, 22, 24)), (1, (8, 8, 9))])
    halo(img, (L * 0.3, H * 0.12, L * 0.7, H * 0.78), (255, 255, 255), 12, 320)
    cote = 620
    img.alpha_composite(opacite(blanc.resize((cote, cote), Image.LANCZOS), 0.92), ((L - cote) // 2, 610))
    d = ImageDraw.Draw(img)
    texte_espace(d, (L / 2, 1300), "LA CIGALE", police("segoeuil.ttf", 104), (232, 232, 234, 255), 34)
    texte_espace(d, (L / 2, 1450), "naviguer sans être suivi", police("segoeuil.ttf", 46), (150, 150, 156, 255), 6)
    return grain(img, alpha=8)


# 3. Motif : cigales en quinconce, à peine visibles
def motif(blanc):
    img = degrade([(0, (20, 20, 22)), (1, (11, 11, 12))])
    cote, pas = 210, 420
    petites = {a: opacite(blanc.resize((cote, cote), Image.LANCZOS).rotate(a, resample=Image.BICUBIC, expand=True), 0.07)
               for a in (-18, 18)}
    for j, y in enumerate(range(-pas // 2, H + pas, pas // 2)):
        decalage = (pas // 2) if j % 2 else 0
        for i, x in enumerate(range(-pas + decalage, L + pas, pas)):
            p = petites[-18 if (i + j) % 2 else 18]
            img.alpha_composite(p, (x - p.width // 2, y - p.height // 2))
    # une seule, plus nette, un peu à droite du centre
    vedette = blanc.resize((520, 520), Image.LANCZOS).rotate(-10, resample=Image.BICUBIC, expand=True)
    halo(img, (2330, 700, 3170, 1540), (255, 255, 255), 10, 200)
    img.alpha_composite(opacite(vedette, 0.85), (2750 - vedette.width // 2, 1120 - vedette.height // 2))
    # vignettage
    v = Image.new("L", (L, H), 0)
    ImageDraw.Draw(v).ellipse((-L * 0.15, -H * 0.25, L * 1.15, H * 1.25), fill=255)
    v = v.filter(ImageFilter.GaussianBlur(300)).point(lambda a: 255 - a)
    img.paste(Image.new("RGBA", (L, H), (0, 0, 0, 255)), (0, 0), v.point(lambda a: a * 150 // 255))
    return grain(img)


# 4. Crépuscule provençal : soleil couchant, pin parasol, cigale devant le soleil
def crepuscule(blanc):
    img = degrade([(0, (16, 14, 34)), (0.40, (52, 30, 62)), (0.66, (150, 70, 62)), (0.8, (214, 132, 78)), (1, (214, 132, 78))])
    sx, sy, r = L * 0.6, H * 0.52, 420
    halo(img, (sx - 1000, sy - 1000, sx + 1000, sy + 1000), (255, 196, 120), 90, 280)
    d = ImageDraw.Draw(img)
    d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(255, 214, 150, 255))

    rnd = random.Random(7)
    sommets = {}
    plans = [(0.72, (88, 44, 58), 70), (0.79, (58, 30, 46), 90), (0.87, (34, 20, 32), 110), (0.95, (18, 12, 20), 50)]
    for n, (base, couleur, ampl) in enumerate(plans):
        phases = [rnd.uniform(0, 6.3) for _ in range(4)]
        points = [(0, H)]
        for x in range(0, L + 20, 20):
            y = H * base + sum(ampl / (k + 1) * math.sin(x / (900 / (k + 1)) + phases[k]) for k in range(4))
            points.append((x, y))
            sommets[(n, x)] = y
        points.append((L, H))
        d.polygon(points, fill=couleur + (255,))

    # pin parasol sur la colline la plus proche, à gauche : tronc qui s'affine, houppier plat et touffu
    ombre = (12, 8, 14, 255)
    pied = (700, sommets[(2, 700)] + 40)
    tete = (1020, 1000)

    def tronc(a, b, e0, e1, courbure):
        # bande effilée le long d'une courbe de Bézier
        mx, my = (a[0] + b[0]) / 2 + courbure, (a[1] + b[1]) / 2
        gauche, droite = [], []
        for i in range(41):
            s = i / 40
            x = (1 - s) ** 2 * a[0] + 2 * (1 - s) * s * mx + s * s * b[0]
            y = (1 - s) ** 2 * a[1] + 2 * (1 - s) * s * my + s * s * b[1]
            dx = 2 * (1 - s) * (mx - a[0]) + 2 * s * (b[0] - mx)
            dy = 2 * (1 - s) * (my - a[1]) + 2 * s * (b[1] - my)
            n = math.hypot(dx, dy)
            e = (e0 + (e1 - e0) * s) / 2
            gauche.append((x - dy / n * e, y + dx / n * e))
            droite.append((x + dy / n * e, y - dx / n * e))
        d.polygon(gauche + droite[::-1], fill=ombre)

    tronc(pied, tete, 62, 30, -90)
    for bout, epaisseur, courbe in [((tete[0] - 330, tete[1] - 120), 22, -30), ((tete[0] + 360, tete[1] - 110), 22, 40),
                                    ((tete[0] - 80, tete[1] - 150), 18, -20), ((tete[0] + 140, tete[1] - 160), 16, 20)]:
        tronc(tete, bout, epaisseur, 6, courbe)

    houppier = Image.new("L", (L, H), 0)
    h = ImageDraw.Draw(houppier)
    cx0, cy0, demi = tete[0] + 10, tete[1] - 190, 720
    for _ in range(900):
        u = rnd.uniform(-1, 1)
        haut = 150 * math.sqrt(max(0, 1 - u * u)) + 30          # dôme aplati
        x = cx0 + u * demi
        y = cy0 + rnd.uniform(-haut, 55 * (1 - abs(u)) + 10)
        rr = rnd.uniform(18, 58)
        h.ellipse((x - rr * 1.6, y - rr, x + rr * 1.6, y + rr), fill=255)
    houppier = houppier.filter(ImageFilter.GaussianBlur(2)).point(lambda v: 255 if v > 110 else 0)
    img.paste(Image.new("RGBA", (L, H), ombre), (0, 0), houppier)

    # la cigale, en ombre chinoise devant le soleil
    cote = 600
    noire = teinter(blanc, (14, 9, 14)).resize((cote, cote), Image.LANCZOS).rotate(-8, resample=Image.BICUBIC, expand=True)
    img.alpha_composite(noire, (round(sx - noire.width / 2), round(sy - noire.height / 2 - 20)))
    return grain(img, alpha=10)


# 5. Plan technique : grille, cigale au trait, ce que fait le navigateur
def plan(blanc):
    img = Image.new("RGBA", (L, H), (9, 17, 30, 255))
    halo(img, (L * 0.15, H * 0.05, L * 0.85, H * 0.95), (40, 80, 140), 40, 400)
    d = ImageDraw.Draw(img)
    for x in range(0, L, 48):
        d.line([(x, 0), (x, H)], fill=(120, 170, 230, 14 if x % 240 else 34))
    for y in range(0, H, 48):
        d.line([(0, y), (L, y)], fill=(120, 170, 230, 14 if y % 240 else 34))

    trait = (170, 205, 245)
    cote, cx, cy = 1300, 1700, 1080
    x0, y0 = cx - cote // 2, cy - cote // 2
    img.alpha_composite(opacite(teinter(blanc.resize((cote, cote), Image.LANCZOS), trait), 0.82), (x0, y0))

    d = ImageDraw.Draw(img)
    mono = police("consola.ttf", 40)
    petite = police("consola.ttf", 30)
    # (point sur la cigale en fraction du carré, extrémité du libellé, titre, détail)
    reperes = [
        ((0.50, 0.36), (2860, 520), "A  TÊTE", "empreinte masquée (resistFingerprinting)"),
        ((0.80, 0.40), (2860, 860), "B  AILE DROITE", "pisteurs et publicités bloqués (uBlock Origin)"),
        ((0.52, 0.68), (2860, 1200), "C  ABDOMEN", "cookies isolés par site, effacés à la fermeture"),
        ((0.18, 0.38), (420, 520), "D  AILE GAUCHE", "DNS chiffré (Quad9, DoH)"),
        ((0.34, 0.60), (420, 980), "E  AILE ARRIÈRE", "télémétrie et études coupées"),
    ]
    couleur = (190, 220, 255, 230)
    for (fx, fy), (lx, ly), titre, detail in reperes:
        px, py = x0 + fx * cote, y0 + fy * cote
        # le trait part du point, rejoint le bout du soulignement du libellé côté cigale
        gauche, droite = lx - 30, lx + 760
        coude = (gauche, ly) if lx > cx else (droite, ly)
        d.ellipse((px - 9, py - 9, px + 9, py + 9), outline=couleur, width=3)
        d.line([(px, py), coude], fill=(190, 220, 255, 150), width=2)
        d.line([(gauche, ly), (droite, ly)], fill=(190, 220, 255, 150), width=2)
        d.text((lx, ly - 54), titre, font=mono, fill=couleur)
        d.text((lx, ly + 14), detail, font=petite, fill=(150, 185, 225, 200))

    # cotes
    d.line([(x0, y0 - 80), (x0 + cote, y0 - 80)], fill=(150, 185, 225, 120), width=2)
    for x in (x0, x0 + cote):
        d.line([(x, y0 - 100), (x, y0 - 60)], fill=(150, 185, 225, 120), width=2)
    d.text((cx, y0 - 128), "Firefox ESR, réglé pour la vie privée", font=petite, fill=(150, 185, 225, 170), anchor="mm")

    # cartouche
    bx, by, bw, bh = 2760, 1720, 900, 300
    d.rectangle((bx, by, bx + bw, by + bh), outline=(170, 205, 245, 160), width=3)
    d.line([(bx, by + 120), (bx + bw, by + 120)], fill=(170, 205, 245, 120), width=2)
    d.line([(bx + 520, by + 120), (bx + 520, by + bh)], fill=(170, 205, 245, 120), width=2)
    d.text((bx + 36, by + 34), "LA CIGALE", font=police("consola.ttf", 58), fill=(225, 238, 255, 240))
    d.text((bx + 36, by + 150), "navigateur", font=petite, fill=(150, 185, 225, 200))
    d.text((bx + 36, by + 200), "anonymat · sécurité", font=petite, fill=(150, 185, 225, 200))
    d.text((bx + 556, by + 150), "PLANCHE", font=petite, fill=(150, 185, 225, 200))
    d.text((bx + 556, by + 196), "01 / 01", font=mono, fill=(225, 238, 255, 230))
    return grain(img, force=20, alpha=7)


def main():
    SORTIE.mkdir(exist_ok=True)
    blanc = rendre_svg((BRANDING / "symbole-blanc.svg").read_text(encoding="utf-8"), 2000)
    fonds = {
        "la-cigale-1-accueil": accueil,
        "la-cigale-2-minimal": minimal,
        "la-cigale-3-motif": motif,
        "la-cigale-4-crepuscule": crepuscule,
        "la-cigale-5-plan": plan,
    }
    for nom, fabrique in fonds.items():
        # PNG sans perte : le JPEG crée des paliers sur ces fonds très sombres
        chemin = SORTIE / f"{nom}.png"
        fabrique(blanc).convert("RGB").save(chemin, optimize=True)
        print(chemin)


if __name__ == "__main__":
    main()
