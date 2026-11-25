"""Applique l'identité La Cigale à l'intérieur d'une installation Firefox extraite.

  * browser/omni.ja : noms de marque (brand.ftl / brand.properties) et logos internes
    (à propos, onglets, page de démarrage) ;
  * browser/chrome/icons/default : icônes des fenêtres (Linux).

Usage : python outils/rebrander_omni.py <dossier_installation>
"""
import io
import zlib
import struct
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image

SEPT_ZIP = os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"), "7-Zip", "7z.exe")
RACINE = Path(__file__).resolve().parent.parent
BRANDING = RACINE / "branding"
LOGO_1024 = Image.open(BRANDING / "png" / "logo-1024.png").convert("RGBA")
LOGO_SVG = (BRANDING / "logo.svg").read_bytes()
WORDMARK_SVG = (BRANDING / "wordmark.svg").read_bytes()

# Page de navigation privée : feuille de style La Cigale et ressources ajoutées à browser/omni.ja
PRIVE = "chrome/browser/skin/classic/browser/privatebrowsing/"
CSS_PRIVE = (RACINE / "apparence" / "navigation-privee.css").read_bytes()
AJOUTS_BROWSER = {
    PRIVE + "cigale-fond.jpg": (RACINE / "accueil" / "img" / "fond.jpg").read_bytes(),
    PRIVE + "cigale-prive.png": (BRANDING / "png" / "prive-256.png").read_bytes(),
}
# Page about:cigale (protection et profils) et icône du bouton de la barre d'outils
CIGALE = "chrome/browser/content/browser/cigale/"
for _f in ("protection.html", "protection.css", "protection.js", "cigale.sys.mjs", "tor.svg",
           "popup.html", "popup.css", "popup.js", "preferences.css", "plus.sys.mjs", "plus-enfant.sys.mjs",
           "bricolage-latin.woff2", "bouton-barre.svg", "bilan.sys.mjs", "bilan-enfant.sys.mjs",
           "pages.css", "nouveautes.html", "nouveautes.js", "bienvenue.html", "bienvenue.js"):
    AJOUTS_BROWSER[CIGALE + _f] = (RACINE / "apparence" / "protection" / _f).read_bytes()
# copie de la page d'accueil servie par about:apropos (adresse lisible, retour arrière normal)
for _f in (RACINE / "accueil").rglob("*"):
    if _f.is_file():
        AJOUTS_BROWSER[CIGALE + "accueil/" + _f.relative_to(RACINE / "accueil").as_posix()] = _f.read_bytes()
AJOUTS_BROWSER[CIGALE + "bouton.png"] = (BRANDING / "png" / "logo-128.png").read_bytes()
# petits outils (palette, notes, mini-lecteur, aperçu des liens, gestes, retouches)
for _f in ("outils.sys.mjs", "outils-enfant.sys.mjs", "outils.css", "notes.html", "notes.js", "notes.css", "notes.svg"):
    AJOUTS_BROWSER[CIGALE + "outils/" + _f] = (RACINE / "apparence" / "outils" / _f).read_bytes()
# about:assistant : IA locale (le moteur et le modèle ne sont jamais dans l'installeur)
for _f in ("assistant.html", "assistant.css", "assistant.js", "assistant.sys.mjs"):
    AJOUTS_BROWSER[CIGALE + "assistant/" + _f] = (RACINE / "apparence" / "assistant" / _f).read_bytes()
# about:sudoku, proposé par la page « pas de connexion »
for _f in ("sudoku.html", "sudoku.css", "sudoku.js", "theme-olive.css", "theme-aucun.css", "jeu.sys.mjs"):
    AJOUTS_BROWSER[CIGALE + "sudoku/" + _f] = (RACINE / "apparence" / "sudoku" / _f).read_bytes()
# police intégrée : une page about: ordinaire ne peut pas la charger à part
AJOUTS_BROWSER[CIGALE + "sudoku/sudoku.css"] = AJOUTS_BROWSER[CIGALE + "sudoku/sudoku.css"].replace(
    b'url("about:sudoku?f=bricolage.woff2")',
    b'url("data:font/woff2;base64,' + __import__("base64").b64encode(
        (RACINE / "accueil" / "polices" / "bricolage-latin.woff2").read_bytes()) + b'")')
# omni.ja de la boîte à outils : bouton « Jouer au sudoku » de la page d'erreur réseau
NETERROR = "chrome/toolkit/content/global/aboutNetError.html"
NETERROR_ANCRE = b'    <script src="chrome://global/content/neterror/aboutNetErrorCodes.js"></script>\n'
NETERROR_AJOUT = b'    <script src="chrome://global/content/cigale-jeu.js"></script>\n'
AJOUTS_RACINE = {
    "chrome/toolkit/content/global/cigale-jeu.js": (RACINE / "apparence" / "sudoku" / "neterror-jeu.js").read_bytes(),
}


def _bouton_barre() -> bytes:
    # symbole blanc 32 px pour la barre d'outils (toujours sombre dans La Cigale)
    import io
    symbole = Image.open(BRANDING / "png" / "symbole-blanc-1024.png").convert("RGBA")
    symbole = symbole.crop(symbole.getbbox())
    symbole.thumbnail((32, 32), Image.LANCZOS)
    image = Image.new("RGBA", (32, 32))
    image.alpha_composite(symbole, ((32 - symbole.width) // 2, (32 - symbole.height) // 2))
    sortie = io.BytesIO()
    image.save(sortie, "PNG", optimize=True)
    return sortie.getvalue()


AJOUTS_BROWSER[CIGALE + "bouton-barre.png"] = _bouton_barre()


def svg_image(png: bytes, taille: int) -> bytes:
    # SVG autonome contenant un PNG (les SVG utilisés comme images ne chargent rien d'externe)
    import base64
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {taille} {taille}">'
            f'<image width="{taille}" height="{taille}" href="data:image/png;base64,'
            f'{base64.b64encode(png).decode()}"/></svg>').encode()


ICONE_PRIVE_SVG = svg_image((BRANDING / "png" / "prive-64.png").read_bytes(), 64)

# Masque La Cigale vectoriel, monochrome (couleur du thème via context-fill) :
# indicateur « Navigation privée » de la barre d'onglets et bouton « Nouvelle fenêtre privée ».
# Même géométrie que le glyphe « prive » d'outils/icones_exe.py (coordonnées normalisées).
MASQUE_SVG = b"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16">
  <path fill="context-fill" fill-opacity="context-fill-opacity" fill-rule="evenodd" d="
    M16 10.6 C12 8.9 5.2 8.4 2.6 10 C0.9 11.1 1.1 16 3 19.2 C5 22.6 10.2 23.1 12.6 20.6
    C14 19.1 15 18.3 16 18.3 C17 18.3 18 19.1 19.4 20.6 C21.8 23.1 27 22.6 29 19.2
    C30.9 16 31.1 11.1 29.4 10 C26.8 8.4 20 8.9 16 10.6 Z
    M5.4 15.3 C7 12.7 11.2 12.6 12.8 15.4 C11.2 17.4 7 17.4 5.4 15.3 Z
    M26.6 15.3 C25 12.7 20.8 12.6 19.2 15.4 C20.8 17.4 25 17.4 26.6 15.3 Z"/>
</svg>
"""
ICONES_MASQUE = {
    "chrome/toolkit/skin/classic/global/icons/indicator-private-browsing.svg",
    "chrome/browser/skin/classic/browser/privateBrowsing.svg",
}
# L'indicateur n'active pas context-fill par défaut : on le rend blanc cassé, comme le texte.
CSS_INDICATEUR = b"""

/* La Cigale : indicateur de navigation privee monochrome */
.private-browsing-indicator-icon {
  -moz-context-properties: fill, fill-opacity;
  fill: currentColor;
  fill-opacity: 0.9;
}

/* pas de bleu Firefox : focus et boutons principaux en gris clair */
:root {
  --focus-outline-color: #8c8c90 !important;
  --toolbar-field-border-color-focus: #6b6b70 !important;
  --color-accent-primary: #ededed !important;
  --color-accent-primary-hover: #ffffff !important;
  --color-accent-primary-active: #c8c8cc !important;
  --button-text-color-primary: #0a0a0b !important;
}
"""

# Couleurs
# Le violet « navigation privée » de Mozilla est converti en gris de même luminosité.
# Hors champ : outils de développement, couleurs de conteneurs choisies par l'utilisateur,
# logos de tiers, sélecteur de couleur, thèmes intégrés optionnels (Alpenglow).
COULEUR_HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
EXCLUS_COULEURS = ("devtools", "/usercontext/", "/genai/assets/brands/", "thunderbird",
                   "/webcompat/shims/", "colorpicker", "/builtin-themes/", "/pdfjs/",
                   "/cigale/tor.svg")  # le vrai logo Tor garde son violet
# Fond de la zone de contenu en fenêtre privée : dégradé violet -> nuit La Cigale.
FOND_PRIVE = (b"--tabpanel-background-color: linear-gradient(45deg, #722291 0%, #45278d 50%, #393473 100%) !important;",
              b"--tabpanel-background-color: #0a0a0b !important;")


COULEUR_RGB = re.compile(r"(rgba?\(\s*)(\d{1,3})(\s*,?\s*)(\d{1,3})(\s*,?\s*)(\d{1,3})\b")


def _gris_si_violet(r: int, g: int, b: int):
    # niveau de gris de même luminosité si la couleur est violette, sinon None
    import colorsys
    teinte, lum, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if sat > 0.25 and 0.68 <= teinte <= 0.90 and 0.08 < lum < 0.92:
        return round(lum * 255)
    return None


def _violet_en_gris(m):
    h = m.group(1)
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    v = _gris_si_violet(*(int(h[i:i + 2], 16) for i in (0, 2, 4)))
    return m.group(0) if v is None else f"#{v:02x}{v:02x}{v:02x}"


def _violet_rgb_en_gris(m):
    debut, r, s1, g, s2, b = m.groups()
    if max(int(r), int(g), int(b)) > 255:
        return m.group(0)
    v = _gris_si_violet(int(r), int(g), int(b))
    return m.group(0) if v is None else f"{debut}{v}{s1}{v}{s2}{v}"


def neutraliser_violet(nom: str, donnees: bytes):
    if not nom.startswith("chrome/") or not nom.endswith((".css", ".svg")):
        return None
    if any(x in nom for x in EXCLUS_COULEURS):
        return None
    texte = donnees.decode("utf-8", "replace")
    nouveau = COULEUR_RGB.sub(_violet_rgb_en_gris, COULEUR_HEX.sub(_violet_en_gris, texte))
    return nouveau.encode("utf-8") if nouveau != texte else None


# Letterboxing
# resistFingerprinting arrondit la zone de contenu (letterboxing) : la page d'accueil locale
# de La Cigale (aucune donnée envoyée au réseau) en est exemptée pour occuper toute la fenêtre,
# et les marges des sites prennent la couleur de nuit du thème au lieu du gris Firefox.
RFP_ANCRE = b"      // ... source code\n"
RFP_AJOUT = (b"      // ... la page d'accueil locale de La Cigale\n"
             b"      (currentURI.schemeIs(\"file\") &&\n"
             b"        currentURI.filePath.includes(\"/cigale/accueil/\")) ||\n")
LETTERBOX_ANCRE = b"--letterboxing-bgcolor: var(--tabpanel-background-color);"
LETTERBOX_NUIT = b"--letterboxing-bgcolor: #0a0a0b;"


# Thème
# Le thème sombre intégré (actif par défaut) devient le thème « La Cigale » : même identifiant,
# palette complète. La version est relevée (ici et dans BuiltInThemeConfig) pour que les
# profils existants le réinstallent.
THEME_DOSSIER = "chrome/browser/content/builtin-themes/dark/"
THEME_VERSION = b"1.3.4"
THEME_VERSION_CIGALE = b"2.0.0"
THEME_MANIFEST = b"""{
  "manifest_version": 2,
  "browser_specific_settings": { "gecko": { "id": "firefox-compact-dark@mozilla.org" } },
  "name": "La Cigale",
  "description": "Nuit graphite, monochrome : le th\\u00e8me de La Cigale.",
  "author": "Projet La Cigale",
  "version": "2.0.0",
  "icons": { "32": "icon.svg" },
  "theme": {
    "colors": {
      "frame": "#0a0a0b",
      "frame_inactive": "#0a0a0b",
      "tab_background_text": "#8c8c90",
      "tab_selected": "#1c1c1f",
      "tab_text": "#ededed",
      "tab_line": "#ededed",
      "tab_loading": "#ededed",
      "tab_background_separator": "#26262a",
      "toolbar": "#141416",
      "toolbar_text": "#ededed",
      "toolbar_top_separator": "#141416",
      "toolbar_bottom_separator": "#1f1f22",
      "toolbar_vertical_separator": "#26262a",
      "toolbar_field": "#0c0c0d",
      "toolbar_field_text": "#ededed",
      "toolbar_field_border": "#26262a",
      "toolbar_field_focus": "#0c0c0d",
      "toolbar_field_text_focus": "#ffffff",
      "toolbar_field_border_focus": "#6b6b70",
      "toolbar_field_highlight": "#3a3a3f",
      "toolbar_field_highlight_text": "#ffffff",
      "button_background_hover": "rgba(255, 255, 255, 0.08)",
      "button_background_active": "rgba(255, 255, 255, 0.14)",
      "icons": "#d6d6da",
      "icons_attention": "#ffffff",
      "focus_outline": "#8c8c90",
      "popup": "#141416",
      "popup_text": "#ededed",
      "popup_border": "#26262a",
      "popup_highlight": "#26262a",
      "popup_highlight_text": "#ffffff",
      "sidebar": "#0f0f10",
      "sidebar_text": "#ededed",
      "sidebar_border": "#1f1f22",
      "sidebar_highlight": "#26262a",
      "sidebar_highlight_text": "#ffffff",
      "ntp_background": "#0a0a0b",
      "ntp_text": "#ededed"
    },
    "properties": { "color_scheme": "dark", "content_color_scheme": "dark" }
  }
}
"""
THEME_ICONE = b"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="7" fill="#0a0a0b"/><rect x="4" y="6" width="24" height="5" rx="2" fill="#1c1c1f"/>
<rect x="4" y="13" width="24" height="13" rx="2" fill="#141416"/><circle cx="16" cy="19.5" r="3" fill="#ededed"/></svg>
"""


def _manifeste(ident: str, nom: str, desc: str, c: dict, schema: str) -> bytes:
    import json
    return json.dumps({
        "manifest_version": 2,
        "browser_specific_settings": {"gecko": {"id": ident}},
        "name": nom, "description": desc, "author": "Projet La Cigale", "version": "2.0.0",
        "icons": {"32": "icon.svg"},
        "theme": {"colors": c, "properties": {"color_scheme": schema, "content_color_scheme": schema}},
    }, ensure_ascii=True, indent=2).encode()


def _palette(frame, toolbar, champ, texte, doux, trait, survol, accent, popup, sidebar):
    return {
        "frame": frame, "frame_inactive": frame, "tab_background_text": doux, "tab_selected": toolbar,
        "tab_text": texte, "tab_line": accent, "tab_loading": accent, "tab_background_separator": trait,
        "toolbar": toolbar, "toolbar_text": texte, "toolbar_top_separator": toolbar, "toolbar_bottom_separator": trait,
        "toolbar_vertical_separator": trait, "toolbar_field": champ, "toolbar_field_text": texte,
        "toolbar_field_border": trait, "toolbar_field_focus": champ, "toolbar_field_text_focus": texte,
        "toolbar_field_border_focus": accent, "toolbar_field_highlight": survol, "toolbar_field_highlight_text": texte,
        "button_background_hover": survol, "button_background_active": trait, "icons": texte, "icons_attention": accent,
        "focus_outline": accent, "popup": popup, "popup_text": texte, "popup_border": trait, "popup_highlight": survol,
        "popup_highlight_text": texte, "sidebar": sidebar, "sidebar_text": texte, "sidebar_border": trait,
        "sidebar_highlight": survol, "sidebar_highlight_text": texte, "ntp_background": frame, "ntp_text": texte,
    }


# Thème clair : encre sur papier, monochrome. Thème olive : le vert du site et des vidéos
# (il prend la place d'Alpenglow, même identifiant, pour être proposé sans extension).
THEMES = {
    "chrome/browser/content/builtin-themes/light/": (_manifeste(
        "firefox-compact-light@mozilla.org", "La Cigale clair", "Papier et encre : le thème clair de La Cigale.",
        _palette("#e6e5e0", "#f6f5f1", "#ffffff", "#141416", "#5f5f64", "#d3d2cc", "rgba(0, 0, 0, 0.07)", "#141416", "#fbfaf7", "#efeee9"),
        "light"), b"#f6f5f1", b"#141416"),
    "chrome/browser/content/builtin-themes/alpenglow/": (_manifeste(
        "firefox-alpenglow@mozilla.org", "La Cigale olive", "Tableau noir et vert olive : les couleurs du site de La Cigale.",
        _palette("#141b16", "#1c2620", "#111713", "#e9e6dc", "#97a293", "#2e3c32", "rgba(169, 184, 154, 0.16)", "#a9b89a", "#1c2620", "#18211c"),
        "dark"), b"#1c2620", b"#a9b89a"),
}


def _icone_theme(fond: bytes, encre: bytes) -> bytes:
    return (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="' + fond +
            b'"/><rect x="4" y="6" width="24" height="5" rx="2" fill="' + encre + b'" opacity=".25"/><circle cx="16" cy="19.5" r="4" fill="' + encre + b'"/></svg>')


def correctif(donnees: bytes, ancre: bytes, remplacement: bytes, nom: str) -> bytes:
    # remplace une ancre attendue ; échoue bruyamment si Firefox a changé le fichier
    if ancre not in donnees:
        sys.exit(f"Correctif impossible : ancre introuvable dans {nom} (version de Firefox différente ?)")
    return donnees.replace(ancre, remplacement, 1)

NOMS = {
    "-brand-shorter-name": "Cigale",
    "-brand-short-name": "La Cigale",
    "-brand-shortcut-name": "La Cigale",
    "-brand-full-name": "La Cigale",
    "-brand-product-name": "La Cigale",
    "-vendor-short-name": "Projet La Cigale",
}
MARQUE = (
    "trademarkInfo = La Cigale est un logiciel libre dérivé de Mozilla Firefox. "
    "Firefox et les logos Firefox sont des marques déposées de la Mozilla Foundation."
)


def rebrander_ftl(texte: str) -> str:
    for cle, valeur in NOMS.items():
        texte = re.sub(rf"^({re.escape(cle)}\s*=).*$", rf"\1 {valeur}", texte, flags=re.M)
    texte = re.sub(r"^trademarkInfo\s*=.*$", MARQUE, texte, flags=re.M)
    return texte


def rebrander_properties(texte: str) -> str:
    remplacements = {
        "brandShorterName": "Cigale",
        "brandShortName": "La Cigale",
        "brandFullName": "La Cigale",
        "vendorShortName": "Projet La Cigale",
    }
    for cle, valeur in remplacements.items():
        texte = re.sub(rf"^({cle}\s*=).*$", rf"\1{valeur}", texte, flags=re.M)
    return texte


def png_meme_taille(donnees: bytes) -> bytes:
    with Image.open(io.BytesIO(donnees)) as orig:
        taille = orig.size
    img = LOGO_1024.copy()
    img.thumbnail(taille, Image.LANCZOS)
    toile = Image.new("RGBA", taille, (0, 0, 0, 0))
    toile.paste(img, ((taille[0] - img.width) // 2, (taille[1] - img.height) // 2))
    sortie = io.BytesIO()
    toile.save(sortie, "PNG", optimize=True)
    return sortie.getvalue()


# Noms de services Mozilla (brandings.ftl) : remplacés par des noms neutres en français.
SERVICES = {
    "-firefox-home-brand-name": "Page d'accueil de La Cigale",
    "-firefoxview-brand-name": "Vue d'ensemble",
    "-firefoxlabs-brand-name": "Labos",
    "-firefox-suggest-brand-name": "Suggestions",
    "-screenshots-brand-name": "Captures d'écran",
    "-profiler-brand-name": "Profileur",
    "-translations-brand-name": "Traductions",
    "-monitor-brand-name": "Mozilla Monitor",
    "-send-brand-name": "Mozilla Send",
    "-focus-brand-name": "Mozilla Focus",
    "-relay-brand-name": "Mozilla Relay",
}
# Ordre important : les formes longues d'abord.
TEXTES = [
    ("Mozilla Firefox", "La Cigale"),
    ("Firefox", "La Cigale"),
]
LIGNE_FTL = re.compile(r"^(\s*(?:-?[\w-]+|\.[\w-]+)\s*=)(.*)$")
LIGNE_PROPS = re.compile(r"^(\s*[^#!\s][^=:]*?\s*[=:])(.*)$")
ENTITE_DTD = re.compile(r'(<!ENTITY\s+\S+\s+")([^"]*)(")')


def _remplacer_texte(valeur: str) -> str:
    # remplace « Firefox » dans un texte affiché, en épargnant URL et identifiants entre accolades
    morceaux = re.split(r"(\{[^}]*\}|https?://\S+|\S+\.(?:com|org|net)\S*)", valeur)
    for i in range(0, len(morceaux), 2):
        for avant, apres in TEXTES:
            morceaux[i] = morceaux[i].replace(avant, apres)
    return "".join(morceaux)


def rebrander_traductions(nom: str, texte: str) -> str:
    lignes = []
    for ligne in texte.splitlines(keepends=True):
        brut = ligne.rstrip("\r\n")
        fin = ligne[len(brut):]
        if "Firefox" not in brut or brut.lstrip().startswith("#"):
            lignes.append(ligne)
            continue
        if nom.endswith(".ftl"):
            m = LIGNE_FTL.match(brut)
            if m and m.group(1).strip().rstrip("=").strip() in SERVICES:
                brut = f"{m.group(1)} {SERVICES[m.group(1).strip().rstrip('=').strip()]}"
            elif m:
                brut = m.group(1) + _remplacer_texte(m.group(2))
            elif brut.startswith((" ", "\t")):  # suite d'un message multiligne
                brut = _remplacer_texte(brut)
        elif nom.endswith(".properties"):
            m = LIGNE_PROPS.match(brut)
            if m:
                brut = m.group(1) + _remplacer_texte(m.group(2))
        elif nom.endswith(".dtd"):
            brut = ENTITE_DTD.sub(lambda m: m.group(1) + _remplacer_texte(m.group(2)) + m.group(3), brut)
        lignes.append(brut + fin)
    return "".join(lignes)


def est_traduction(nom: str) -> bool:
    return (nom.startswith("localization/") or "/locale/" in nom) and nom.endswith((".ftl", ".properties", ".dtd"))


# Images de la mascotte « Kit » (renard) et logos Firefox, partout dans l'interface.
MOTS_MASCOTTE = {"fox", "foxy", "kit", "mascot", "firefox"}


def evoque_mascotte(racine: str) -> bool:
    # vrai si un des mots du nom de fichier (séparés par - _ . @) désigne la mascotte ou Firefox
    return any(mot in MOTS_MASCOTTE for mot in re.split(r"[-_.@]", racine.lower()))
# Illustrations des pages d'erreur qui contiennent la mascotte.
ILLUSTRATIONS_ERREUR = {"error-malformed-url.svg", "no-connection.svg", "security-error.svg"}


def remplacer_image(base: str, donnees: bytes):
    if base.endswith(".svg"):
        # garde la taille de l'image d'origine (width/height) : sans elle, un <img> sans
        # dimensions CSS s'étire sur toute la largeur (ex. fox-ai.svg, page « AI controls »)
        balise = re.search(rb"<svg\b[^>]*>", donnees)
        attributs = b"".join(b" " + m.group(0) for m in re.finditer(rb'\b(?:width|height)="[^"]*"', balise.group(0))) if balise else b""
        return LOGO_SVG.replace(b"<svg", b"<svg" + attributs, 1) if attributs else LOGO_SVG
    if base.endswith(".png"):
        return png_meme_taille(donnees)
    return None  # webp/avif : laissés tels quels


def transformer(nom: str, donnees: bytes):
    # renvoie le nouveau contenu, ou None si l'entrée reste inchangée
    nouveau = transformer_identite(nom, donnees)
    if nouveau is not None:
        donnees = nouveau
    couleurs = neutraliser_violet(nom, donnees)
    return couleurs if couleurs is not None else nouveau


def transformer_identite(nom: str, donnees: bytes):
    if nom == THEME_DOSSIER + "manifest.json":
        return THEME_MANIFEST
    if nom in (THEME_DOSSIER + "icon.svg", THEME_DOSSIER + "preview.svg"):
        return THEME_ICONE
    for dossier, (manifeste, fond, encre) in THEMES.items():
        if nom == dossier + "manifest.json":
            return manifeste
        if nom in (dossier + "icon.svg", dossier + "preview.svg"):
            return _icone_theme(fond, encre)
    if nom == "modules/BuiltInThemeConfig.sys.mjs":
        # les trois thèmes deviennent des thèmes complets (palette La Cigale jusqu'en haut de la fenêtre),
        # version relevée pour que les profils existants les réinstallent
        for ident in (b"firefox-compact-light@mozilla.org", b"firefox-compact-dark@mozilla.org"):
            ancre = b'"' + ident + b'",\n    {\n      version: "' + THEME_VERSION + b'"'
            donnees = correctif(donnees, ancre, ancre.replace(THEME_VERSION, THEME_VERSION_CIGALE), nom)
            debut = donnees.index(b'"' + ident + b'"')
            fin = donnees.index(b"},", debut)
            donnees = (donnees[:debut] + donnees[debut:fin].replace(b"      inApp: true,\n", b"")
                       .replace(b"      nonNative: true,\n", b"") + donnees[fin:])
        ancre = b'"firefox-alpenglow@mozilla.org",\n    {\n      version: "1.5.3"'
        return correctif(donnees, ancre, ancre.replace(b"1.5.3", THEME_VERSION_CIGALE), nom)
    if nom in ICONES_MASQUE:
        return MASQUE_SVG
    if nom == "modules/RFPHelper.sys.mjs":
        return correctif(donnees, RFP_ANCRE, RFP_AJOUT + RFP_ANCRE, nom)
    if nom == "chrome/toolkit/content/global/resistfingerprinting/letterboxing.css":
        return correctif(donnees, LETTERBOX_ANCRE, LETTERBOX_NUIT, nom)
    if nom == "chrome/browser/skin/classic/browser/tabbrowser/content-area.css":
        return correctif(donnees, *FOND_PRIVE, nom)
    if nom == "chrome/browser/skin/classic/browser/browser-shared.css":
        return donnees + CSS_INDICATEUR
    if nom == NETERROR:
        return correctif(donnees, NETERROR_ANCRE, NETERROR_ANCRE + NETERROR_AJOUT, nom)
    base = nom.rsplit("/", 1)[-1]
    racine = base.rsplit(".", 1)[0]
    if nom == PRIVE + "aboutPrivateBrowsing.css":
        return donnees + b"\n\n" + CSS_PRIVE
    if nom in (PRIVE + "favicon.svg", PRIVE + "pbm-logo.svg"):
        return ICONE_PRIVE_SVG
    if base.endswith((".svg", ".png")) and "/branding/" not in nom and (
        evoque_mascotte(racine) or base in ILLUSTRATIONS_ERREUR
    ):
        return remplacer_image(base, donnees)
    if est_traduction(nom) and base not in ("brand.ftl", "brand.properties"):
        texte = donnees.decode("utf-8")
        nouveau = rebrander_traductions(nom, texte)
        return nouveau.encode("utf-8") if nouveau != texte else None
    if "/branding/" not in nom and not nom.startswith("branding/"):
        return None
    if base == "brand.ftl":
        return rebrander_ftl(donnees.decode("utf-8")).encode("utf-8")
    if base == "brand.properties":
        return rebrander_properties(donnees.decode("utf-8")).encode("utf-8")
    if base.endswith(".png") and ("icon" in base or "logo" in base):
        return png_meme_taille(donnees)
    if base.endswith(".svg") and "wordmark" in base:
        return WORDMARK_SVG
    if base.endswith(".svg") and ("logo" in base or "icon" in base):
        return LOGO_SVG
    return None


def lire_jar_optimise(octets: bytes):
    # Lecture directe : les offsets du répertoire central sont absolus dans ces jars,
    # alors que zipfile les recalcule à partir de la fin du fichier.
    fin = octets.rfind(b"PK\x05\x06")
    if fin < 0:
        raise ValueError("pas de fin de répertoire central")
    nombre, taille_cd, debut_cd = struct.unpack_from("<HII", octets, fin + 10)
    entrees, pos = [], debut_cd
    for _ in range(nombre):
        if octets[pos:pos + 4] != b"PK\x01\x02":
            raise ValueError("répertoire central illisible")
        methode, = struct.unpack_from("<H", octets, pos + 10)
        taille_c, taille_n, l_nom, l_extra, l_com = struct.unpack_from("<IIHHH", octets, pos + 20)
        local, = struct.unpack_from("<I", octets, pos + 42)
        nom = octets[pos + 46:pos + 46 + l_nom].decode("utf-8")
        pos += 46 + l_nom + l_extra + l_com
        if nom.endswith("/"):
            continue
        l_nom_local, l_extra_local = struct.unpack_from("<HH", octets, local + 26)
        debut = local + 30 + l_nom_local + l_extra_local
        brut = octets[debut:debut + taille_c]
        donnees = zlib.decompress(brut, -15) if methode == 8 else brut
        if len(donnees) != taille_n:
            raise ValueError(f"taille inattendue pour {nom}")
        entrees.append((nom, donnees))
    return entrees


def lire_entrees(omni: Path):
    # Mozilla livre des jars « optimisés » (répertoire central au début) que zipfile
    # ne sait pas toujours lire, d'où le repli sur 7-Zip ou unzip.
    try:
        with zipfile.ZipFile(omni) as z:
            return [(i.filename, z.read(i)) for i in z.infolist() if not i.is_dir()]
    except zipfile.BadZipFile:
        pass
    try:
        entrees = lire_jar_optimise(omni.read_bytes())
        if len(entrees) >= 100:
            return entrees
    except (ValueError, struct.error, zlib.error):
        pass
    with tempfile.TemporaryDirectory() as tmp:
        if shutil.which("7z") or Path(SEPT_ZIP).exists():
            cmd = [shutil.which("7z") or SEPT_ZIP, "x", str(omni), f"-o{tmp}", "-y"]
        elif shutil.which("unzip"):
            cmd = ["unzip", "-q", "-o", str(omni), "-d", tmp]
        else:
            sys.exit("omni.ja est un jar optimisé : 7-Zip ou unzip est nécessaire pour le lire.")
        resultat = subprocess.run(cmd, capture_output=True)
        # unzip et 7z signalent le format optimisé par un avertissement (codes 1 ou 2) : non bloquant.
        if resultat.returncode not in (0, 1, 2):
            sys.exit(f"Échec de l'extraction d'omni.ja : {resultat.stderr.decode(errors='replace')}")
        base = Path(tmp)
        entrees = [(p.relative_to(base).as_posix(), p.read_bytes()) for p in base.rglob("*") if p.is_file()]
    if len(entrees) < 100:
        sys.exit(f"omni.ja semble incomplet après extraction ({len(entrees)} fichiers).")
    return entrees


def rebrander_omni(omni: Path, ajouts: dict = None) -> int:
    entrees = lire_entrees(omni)
    noms = {nom for nom, _ in entrees}
    entrees += [(nom, octets) for nom, octets in (ajouts or {}).items() if nom not in noms]
    temporaire = omni.with_suffix(".ja.nouveau")
    modifies = 0
    with zipfile.ZipFile(temporaire, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as cible:
        for nom, donnees in entrees:
            nouveau = transformer(nom, donnees)
            if nouveau is not None:
                donnees = nouveau
                modifies += 1
            cible.writestr(zipfile.ZipInfo(nom, date_time=(2010, 1, 1, 0, 0, 0)), donnees,
                           compress_type=zipfile.ZIP_DEFLATED)
    temporaire.replace(omni)
    return modifies


def icones_fenetres(installation: Path) -> int:
    dossier = installation / "browser" / "chrome" / "icons" / "default"
    if not dossier.is_dir():
        return 0
    n = 0
    for png in dossier.glob("default*.png"):
        png.write_bytes(png_meme_taille(png.read_bytes()))
        n += 1
    return n


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    installation = Path(sys.argv[1])
    total = 0
    # browser/omni.ja : interface du navigateur ; omni.ja : boîte à outils (erreurs réseau, etc.)
    for omni in (installation / "browser" / "omni.ja", installation / "omni.ja"):
        if not omni.is_file():
            sys.exit(f"Introuvable : {omni}")
    for omni in (installation / "browser" / "omni.ja", installation / "omni.ja"):
        if not omni.is_file():
            sys.exit(f"Introuvable : {omni}")
        n = rebrander_omni(omni, AJOUTS_BROWSER if omni.parent.name == "browser" else AJOUTS_RACINE)
        total += n
        print(f"{omni.relative_to(installation)} : {n} fichiers modifiés")
    i = icones_fenetres(installation)
    print(f"Icônes de fenêtres : {i}")
    if total == 0:
        sys.exit("Aucun fichier de marque trouvé : la structure d'omni.ja a peut-être changé.")


if __name__ == "__main__":
    main()
