"""Remplace TOUTES les icônes d'un exécutable Windows par celles de La Cigale.

rcedit ne change que l'icône principale ; firefox.exe en contient d'autres, utilisées par
la liste de raccourcis de la barre des tâches (nouvel onglet, nouvelle fenêtre, fenêtre
privée), les documents HTML/PDF associés, etc. Ce script les remplace toutes.

Usage :
  python outils/icones_exe.py lister   <exe> [dossier_apercus]
  python outils/icones_exe.py remplacer <exe>
"""
import ctypes
import io
import struct
import sys
from ctypes import wintypes
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

RACINE = Path(__file__).resolve().parent.parent
PNG = RACINE / "branding" / "png"

RT_ICON, RT_GROUP_ICON = 3, 14
LOAD_LIBRARY_AS_DATAFILE = 0x2
k32 = ctypes.WinDLL("kernel32", use_last_error=True)
k32.LoadLibraryExW.restype = wintypes.HMODULE
k32.LoadLibraryExW.argtypes = [wintypes.LPCWSTR, wintypes.HANDLE, wintypes.DWORD]
k32.FindResourceW.restype = wintypes.HRSRC
k32.FindResourceW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p]
k32.LoadResource.restype = wintypes.HGLOBAL
k32.LoadResource.argtypes = [wintypes.HMODULE, wintypes.HRSRC]
k32.LockResource.restype = ctypes.c_void_p
k32.LockResource.argtypes = [wintypes.HGLOBAL]
k32.SizeofResource.restype = wintypes.DWORD
k32.SizeofResource.argtypes = [wintypes.HMODULE, wintypes.HRSRC]
k32.BeginUpdateResourceW.restype = wintypes.HANDLE
k32.BeginUpdateResourceW.argtypes = [wintypes.LPCWSTR, wintypes.BOOL]
k32.UpdateResourceW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.c_void_p, wintypes.WORD,
                                 ctypes.c_void_p, wintypes.DWORD]
k32.EndUpdateResourceW.argtypes = [wintypes.HANDLE, wintypes.BOOL]
ENUM = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p)
k32.EnumResourceNamesW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, ENUM, ctypes.c_void_p]
k32.EnumResourceLanguagesW.argtypes = [wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p,
                                       ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMODULE, ctypes.c_void_p,
                                                          ctypes.c_void_p, wintypes.WORD, ctypes.c_void_p),
                                       ctypes.c_void_p]


def _nom(valeur):
    # identifiant de ressource : entier (MAKEINTRESOURCE) ou chaîne
    return valeur if valeur < 0x10000 else ctypes.wstring_at(valeur)


def _ptr(nom):
    return ctypes.c_void_p(nom) if isinstance(nom, int) else ctypes.c_wchar_p(nom)


def lire_ressource(module, type_, nom) -> bytes:
    h = k32.FindResourceW(module, _ptr(nom), ctypes.c_void_p(type_))
    taille = k32.SizeofResource(module, h)
    return ctypes.string_at(k32.LockResource(k32.LoadResource(module, h)), taille)


def groupes(exe: Path):
    # [(nom, langue, [(largeur, id_icone)])] pour chaque groupe d'icônes
    module = k32.LoadLibraryExW(str(exe), None, LOAD_LIBRARY_AS_DATAFILE)
    noms = []
    rappel = ENUM(lambda m, t, n, p: noms.append(_nom(n)) or True)
    k32.EnumResourceNamesW(module, ctypes.c_void_p(RT_GROUP_ICON), rappel, None)
    resultat = []
    for nom in noms:
        langues = []
        rl = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMODULE, ctypes.c_void_p, ctypes.c_void_p,
                                wintypes.WORD, ctypes.c_void_p)(lambda m, t, n, l, p: langues.append(l) or True)
        k32.EnumResourceLanguagesW(module, ctypes.c_void_p(RT_GROUP_ICON), _ptr(nom), rl, None)
        donnees = lire_ressource(module, RT_GROUP_ICON, nom)
        _, _, nb = struct.unpack_from("<HHH", donnees)
        entrees = []
        for i in range(nb):
            l, h, _, _, _, _, _, ident = struct.unpack_from("<BBBBHHIH", donnees, 6 + i * 14)
            entrees.append((l or 256, ident))
        resultat.append((nom, langues[0] if langues else 0, entrees, module))
    return resultat


def apercu(module, entrees) -> Image.Image:
    largeur, ident = max(entrees)
    brut = lire_ressource(module, RT_ICON, ident)
    if brut[:8] == b"\x89PNG\r\n\x1a\n":
        return Image.open(io.BytesIO(brut))
    # Image BMP sans en-tête de fichier : on reconstruit un .ico d'une seule image
    ico = struct.pack("<HHHBBBBHHII", 0, 1, 1, largeur % 256, largeur % 256, 0, 0, 1, 32, len(brut), 22) + brut
    return Image.open(io.BytesIO(ico))


# Tracé du masque (repère 32 x 32), identique à MASQUE_SVG dans outils/rebrander_omni.py.
MASQUE_TRACE = """
M16 10.6 C12 8.9 5.2 8.4 2.6 10 C0.9 11.1 1.1 16 3 19.2 C5 22.6 10.2 23.1 12.6 20.6
C14 19.1 15 18.3 16 18.3 C17 18.3 18 19.1 19.4 20.6 C21.8 23.1 27 22.6 29 19.2
C30.9 16 31.1 11.1 29.4 10 C26.8 8.4 20 8.9 16 10.6 Z
M5.4 15.3 C7 12.7 11.2 12.6 12.8 15.4 C11.2 17.4 7 17.4 5.4 15.3 Z
M26.6 15.3 C25 12.7 20.8 12.6 19.2 15.4 C20.8 17.4 25 17.4 26.6 15.3 Z
"""


def contours_masque(pas=24):
    # aplatit le tracé (M, C, Z uniquement) en polygones
    import re as _re
    jetons = _re.findall(r"[MCZ]|-?[\d.]+", MASQUE_TRACE)
    contours, courant, i = [], [], 0
    while i < len(jetons):
        j = jetons[i]
        if j == "M":
            courant = [(float(jetons[i + 1]), float(jetons[i + 2]))]
            i += 3
        elif j == "C":
            p0 = courant[-1]
            p1, p2, p3 = [(float(jetons[i + k]), float(jetons[i + k + 1])) for k in (1, 3, 5)]
            for s in range(1, pas + 1):
                u = s / pas
                courant.append(tuple((1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u ** 2 * c + u ** 3 * d
                                     for a, b, c, d in zip(p0, p1, p2, p3)))
            i += 7
        else:  # Z
            contours.append(courant)
            i += 1
    return contours


def _fond(t):
    # base commune : l'icône principale de La Cigale
    return Image.open(PNG / "logo-256.png").convert("RGBA").resize((t, t), Image.LANCZOS)


def _carre(t):
    # fond de l'icône La Cigale (dégradé, halo, grain), sans la cigale
    return Image.open(PNG / "fond-icone-256.png").convert("RGBA").resize((t, t), Image.LANCZOS)


def glyphe(type_, t=256):
    ss = 4
    T = t * ss
    img = _carre(T)
    d = ImageDraw.Draw(img)
    blanc = (255, 255, 255, 255)
    w = round(T * 0.055)
    if type_ == "onglet":  # onglet avec un +
        d.rounded_rectangle((T * .20, T * .30, T * .80, T * .76), T * .06, outline=blanc, width=w)
        d.line((T * .20, T * .30, T * .46, T * .30), fill=blanc, width=w)
        d.line((T * .50, T * .43, T * .50, T * .65), fill=blanc, width=w)
        d.line((T * .39, T * .54, T * .61, T * .54), fill=blanc, width=w)
        d.rounded_rectangle((T * .20, T * .22, T * .48, T * .34), T * .04, outline=blanc, width=w)
    elif type_ == "fenetre":  # fenêtre avec barre de titre
        d.rounded_rectangle((T * .18, T * .24, T * .82, T * .76), T * .07, outline=blanc, width=w)
        d.line((T * .18, T * .37, T * .82, T * .37), fill=blanc, width=w)
        for x in (.27, .34):
            d.ellipse((T * x - w * .6, T * .305 - w * .6, T * x + w * .6, T * .305 + w * .6), fill=blanc)
    elif type_ == "prive":  # le masque La Cigale (même tracé que l'icône vectorielle de l'interface)
        forme = Image.new("L", (T, T), 0)
        f = ImageDraw.Draw(forme)
        echelle = lambda x, y: (T * (.5 + (x - 16) / 30 * .72), T * (.5 + (y - 15.75) / 30 * .72))
        for i, contour in enumerate(contours_masque()):
            f.polygon([echelle(x, y) for x, y in contour], fill=0 if i else 255)  # 1er : masque ; suivants : yeux
        img.paste(Image.new("RGBA", (T, T), blanc), (0, 0), forme)
    elif type_ in ("document", "pdf"):  # feuille cornée, cigale ou « PDF »
        noir = (14, 14, 15, 255)
        img = Image.new("RGBA", (T, T), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.polygon([(T * .22, T * .08), (T * .62, T * .08), (T * .80, T * .26), (T * .80, T * .92), (T * .22, T * .92)],
                  fill=(250, 250, 250, 255))
        d.polygon([(T * .62, T * .08), (T * .62, T * .26), (T * .80, T * .26)], fill=(200, 200, 200, 255))
        mini = _fond(round(T * .40))
        img.alpha_composite(mini, (round(T * .31), round(T * .40)))
        if type_ == "pdf":
            d = ImageDraw.Draw(img)
            d.rounded_rectangle((T * .10, T * .62, T * .58, T * .84), T * .03, fill=noir)
            # lettres P D F en traits simples
            y0, y1, e = T * .67, T * .79, round(T * .03)
            x = T * .16
            d.line((x, y0, x, y1), fill=blanc, width=e)
            d.arc((x - T * .04, y0, x + T * .07, y0 + T * .07), 270, 90, fill=blanc, width=e)
            x = T * .30
            d.line((x, y0, x, y1), fill=blanc, width=e)
            d.arc((x - T * .07, y0, x + T * .07, y1), 270, 90, fill=blanc, width=e)
            x = T * .45
            d.line((x, y0, x, y1), fill=blanc, width=e)
            d.line((x, y0, x + T * .08, y0), fill=blanc, width=e)
            d.line((x, (y0 + y1) / 2, x + T * .06, (y0 + y1) / 2), fill=blanc, width=e)
    return img.resize((t, t), Image.LANCZOS)


TAILLES = [16, 20, 24, 32, 40, 48, 64, 256]


def icone_ico(image256: Image.Image) -> list:
    # liste de (taille, octets) au format attendu dans RT_ICON (PNG, accepté depuis Vista)
    sortie = []
    for t in TAILLES:
        img = image256 if t == 256 else image256.resize((t, t), Image.LANCZOS)
        if t <= 32 and image256 is not None:
            img = img.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=0))
        tampon = io.BytesIO()
        img.save(tampon, "PNG", optimize=True)
        sortie.append((t, tampon.getvalue()))
    return sortie


# Correspondance des groupes de firefox.exe (browser/app/splash.rc) vers nos dessins
ROLES = {1: "app", 2: "document", 3: "fenetre", 4: "onglet", 5: "prive", 6: "pdf", 32512: "app"}


def image_pour(role):
    if role == "app":
        return Image.open(PNG / "logo-256.png").convert("RGBA")
    return glyphe(role)


def remplacer(exe: Path):
    liste = groupes(exe)
    prochain_id = 1 + max(ident for _, _, entrees, _ in liste for _, ident in entrees)
    ecritures = []  # (type, nom, langue, octets)
    for nom, langue, entrees, _ in liste:
        role = ROLES.get(nom, "app")
        if exe.name.startswith("private_browsing") and role == "app":
            role = "prive"  # exécutable des fenêtres privées épinglées
        # Les anciennes images de ce groupe sont supprimées
        for _, ident in entrees:
            ecritures.append((RT_ICON, ident, langue, None))
        repertoire = struct.pack("<HHH", 0, 1, len(TAILLES))
        for t, octets in icone_ico(image_pour(role)):
            repertoire += struct.pack("<BBBBHHIH", t % 256, t % 256, 0, 0, 1, 32, len(octets), prochain_id)
            ecritures.append((RT_ICON, prochain_id, langue, octets))
            prochain_id += 1
        ecritures.append((RT_GROUP_ICON, nom, langue, repertoire))
        print(f"  groupe {nom} -> {role}")

    h = k32.BeginUpdateResourceW(str(exe), False)
    if not h:
        sys.exit(f"Impossible d'ouvrir {exe} en écriture (programme lancé ?)")
    for type_, nom, langue, octets in ecritures:
        tampon = ctypes.create_string_buffer(octets) if octets else None
        ok = k32.UpdateResourceW(h, ctypes.c_void_p(type_), _ptr(nom), langue,
                                 tampon, len(octets) if octets else 0)
        if not ok:
            k32.EndUpdateResourceW(h, True)
            sys.exit(f"UpdateResource a échoué ({type_}/{nom}) : {ctypes.get_last_error()}")
    if not k32.EndUpdateResourceW(h, False):
        sys.exit(f"EndUpdateResource a échoué : {ctypes.get_last_error()}")
    print(f"{len(liste)} groupes d'icônes remplacés dans {exe.name}")


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("lister", "remplacer"):
        sys.exit(__doc__)
    exe = Path(sys.argv[2]).resolve()
    if sys.argv[1] == "remplacer":
        remplacer(exe)
        return
    dossier = Path(sys.argv[3]) if len(sys.argv) > 3 else None
    for nom, langue, entrees, module in groupes(exe):
        print(f"groupe {nom} (langue {langue}) : tailles {sorted(l for l, _ in entrees)}")
        if dossier:
            dossier.mkdir(parents=True, exist_ok=True)
            apercu(module, entrees).save(dossier / f"groupe-{nom}.png")


if __name__ == "__main__":
    main()
