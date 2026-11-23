"""Génère les pages FAQ et comparaison du site (français et anglais).

Usage : python site/pages.py   (réécrit faq/, comparaison/, en/faq/, en/comparison/ et sitemap.xml)
"""
import html
import json
from pathlib import Path

ICI = Path(__file__).parent
BASE = "https://urbanyl.github.io/la-cigale/"
DATE = "2026-11-23"

FAQ_FR = [
    ("La Cigale est-elle gratuite ?",
     "Oui, entièrement. Pas d'abonnement, pas de version payante, pas de publicité. Le code source est public sous licence MPL-2.0, la même que Firefox."),
    ("Sur quoi repose La Cigale ?",
     "Sur Firefox ESR, la version à support étendu de Mozilla. Elle reçoit tous les correctifs de sécurité de Mozilla, sans les changements d'interface toutes les quatre semaines. La Cigale y ajoute ses réglages, sa page d'accueil et ses outils de protection."),
    ("En quoi est-ce différent de Firefox ?",
     "Firefox envoie par défaut des données d'utilisation à Mozilla, affiche du contenu sponsorisé et garde l'historique. La Cigale coupe la télémétrie, installe uBlock Origin, active l'anti-empreinte de Tor Browser, chiffre le DNS, impose le HTTPS et efface tout à la fermeture."),
    ("Mes extensions Firefox fonctionnent-elles ?",
     "Oui. La Cigale accepte les extensions du site officiel de Mozilla, comme Firefox."),
    ("Est-ce que La Cigale me rend anonyme ?",
     "Elle rend le pistage beaucoup plus difficile, mais sans réglage votre adresse IP reste visible des sites. Pour la cacher, choisissez un proxy dans Protection, Adresse IP (votre propre liste, par exemple Webshare), ouvrez la fenêtre Tor, ou utilisez un VPN de confiance. Pour un anonymat fort, Tor Browser reste la référence."),
    ("Qu'est-ce que la fenêtre Tor ?",
     "Une fenêtre à part dont tout le trafic, DNS compris, passe par le réseau Tor, avec un profil séparé effacé à la fermeture. Il faut que Tor soit déjà lancé : Tor Browser ouvert, ou le service tor sous Linux."),
    ("Pourquoi des sites me demandent-ils de me reconnecter ?",
     "Parce que les cookies sont effacés à la fermeture. Ajoutez les sites où vous voulez rester connecté dans la page Protection (bouton cigale), ou choisissez le profil Confort."),
    ("Comment garder mes favoris d'un ordinateur à l'autre ?",
     "Avec la sauvegarde chiffrée : un fichier protégé par mot de passe que vous rangez où vous voulez (clé USB, cloud). Il n'y a pas de serveur La Cigale, rien n'est envoyé en ligne."),
    ("Comment La Cigale se met-elle à jour ?",
     "Elle prévient une fois par jour quand une nouvelle version sort. Sous Ubuntu et Debian, le dépôt APT la met à jour avec le reste du système. Une nouvelle version est construite à chaque mise à jour de sécurité de Firefox ESR."),
    ("Windows affiche un avertissement SmartScreen, est-ce normal ?",
     "Oui : l'installeur n'est pas signé avec un certificat payant. Cliquez sur « Informations complémentaires » puis « Exécuter quand même ». Les empreintes SHA-256 de chaque fichier sont publiées pour vérifier le téléchargement."),
    ("Sur quels systèmes La Cigale fonctionne-t-elle ?",
     "Windows 10 et 11 (64 bits), Ubuntu, Debian et leurs dérivées (Linux Mint, Pop!_OS…), et toute distribution Linux 64 bits avec l'archive .tar.gz."),
    ("Qui développe La Cigale ?",
     "Un projet indépendant, sans lien avec Mozilla. Les questions et suggestions sont les bienvenues sur le Discord et sur GitHub."),
]

FAQ_EN = [
    ("Is La Cigale free?",
     "Yes, completely. No subscription, no paid tier, no ads. The source code is public under the MPL-2.0 licence, the same as Firefox."),
    ("What is La Cigale based on?",
     "Firefox ESR, Mozilla's extended support release. It gets every Mozilla security fix without the interface changes every four weeks. La Cigale adds its own settings, home page and protection tools."),
    ("How is it different from Firefox?",
     "Firefox sends usage data to Mozilla by default, shows sponsored content and keeps your history. La Cigale turns telemetry off, ships uBlock Origin, enables Tor Browser's fingerprinting protection, encrypts DNS, forces HTTPS and wipes everything on close."),
    ("Do my Firefox extensions work?",
     "Yes. La Cigale installs extensions from Mozilla's official add-ons site, just like Firefox."),
    ("Does La Cigale make me anonymous?",
     "It makes tracking much harder, but by default websites still see your IP address. To hide it, pick a proxy in Protection, IP address (your own list, for example Webshare), open the Tor window, or use a VPN you trust. For strong anonymity, Tor Browser remains the reference."),
    ("Is the interface available in English?",
     "Not yet: La Cigale is designed in French. Everything else works the same for any website in any language."),
    ("What is the Tor window?",
     "A separate window whose traffic, DNS included, goes through the Tor network, with its own profile wiped on close. Tor must already be running: Tor Browser open, or the tor service on Linux."),
    ("Why do sites ask me to log in again?",
     "Because cookies are wiped on close. Add the sites where you want to stay logged in on the Protection page (cicada button), or choose the Comfort profile."),
    ("How is La Cigale updated?",
     "It tells you once a day when a new version is out. On Ubuntu and Debian, the APT repository updates it with the rest of the system. A new version is built for every Firefox ESR security update."),
    ("Windows shows a SmartScreen warning. Is that normal?",
     "Yes: the installer is not signed with a paid certificate. Click \"More info\" then \"Run anyway\". SHA-256 checksums of every file are published so you can check the download."),
]

# [critère, La Cigale, LibreWolf, Brave] — état en novembre 2026
COMPARAISON_FR = [
    ("Moteur", "Firefox ESR (Gecko)", "Firefox (Gecko)", "Chromium (Blink)"),
    ("Rythme des versions", "ESR : correctifs de sécurité, interface stable", "suit chaque version de Firefox", "suit Chromium, toutes les 4 semaines environ"),
    ("Télémétrie", "aucune", "aucune", "statistiques anonymisées (P3A) activées d'office, désactivables"),
    ("Bloqueur de publicités", "uBlock Origin", "uBlock Origin", "Brave Shields (intégré)"),
    ("Anti-empreinte", "resistFingerprinting (méthode Tor Browser)", "resistFingerprinting", "valeurs aléatoires par site"),
    ("Effacement à la fermeture", "oui, avec liste de sites à garder", "oui", "non par défaut"),
    ("Navigation par Tor", "fenêtre Tor (Tor lancé à part)", "non", "fenêtre privée avec Tor intégrée"),
    ("Cryptomonnaie, récompenses, IA", "aucune", "aucune", "portefeuille, Brave Rewards, assistant Leo (désactivables)"),
    ("Interface et accueil en français", "oui, pensé en français", "traduit", "traduit"),
    ("Profils de protection en un clic", "Confort, Standard, Renforcé", "réglages manuels", "réglages des Shields par site"),
    ("Sauvegarde sans serveur", "fichier chiffré", "non", "synchronisation Brave (chiffrée)"),
    ("Systèmes", "Windows, Linux", "Windows, macOS, Linux", "Windows, macOS, Linux, Android, iOS"),
    ("Licence", "MPL-2.0", "MPL-2.0", "MPL-2.0"),
]

COMPARAISON_EN = [
    ("Engine", "Firefox ESR (Gecko)", "Firefox (Gecko)", "Chromium (Blink)"),
    ("Release cycle", "ESR: security fixes, stable interface", "follows every Firefox release", "follows Chromium, about every 4 weeks"),
    ("Telemetry", "none", "none", "anonymised statistics (P3A) on by default, can be turned off"),
    ("Ad blocker", "uBlock Origin", "uBlock Origin", "Brave Shields (built in)"),
    ("Fingerprinting protection", "resistFingerprinting (Tor Browser method)", "resistFingerprinting", "per-site randomised values"),
    ("Wipe on close", "yes, with a list of sites to keep", "yes", "not by default"),
    ("Browsing over Tor", "Tor window (Tor running separately)", "no", "private window with Tor built in"),
    ("Crypto, rewards, AI", "none", "none", "wallet, Brave Rewards, Leo assistant (can be turned off)"),
    ("Interface language", "designed in French", "translated", "translated"),
    ("One-click protection profiles", "Comfort, Standard, Hardened", "manual settings", "per-site Shields settings"),
    ("Serverless backup", "encrypted file", "no", "Brave Sync (encrypted)"),
    ("Platforms", "Windows, Linux", "Windows, macOS, Linux", "Windows, macOS, Linux, Android, iOS"),
    ("Licence", "MPL-2.0", "MPL-2.0", "MPL-2.0"),
]

TEXTES = {
    "fr": {
        "faq": {
            "chemin": "faq/", "titre": "Questions fréquentes sur La Cigale, navigateur privé",
            "h1": "Questions fréquentes",
            "description": "Réponses aux questions sur La Cigale : gratuit, basé sur Firefox ESR, anonymat, fenêtre Tor, extensions, mises à jour, Windows et Linux.",
        },
        "comparaison": {
            "chemin": "comparaison/", "titre": "La Cigale, LibreWolf ou Brave : comparaison des navigateurs privés",
            "h1": "La Cigale, LibreWolf et Brave",
            "description": "Comparaison honnête de trois navigateurs axés sur la vie privée : La Cigale, LibreWolf et Brave. Moteur, télémétrie, bloqueur, anti-empreinte, Tor, systèmes.",
        },
        "retour": "← Accueil", "langue": "English", "telecharger": "Télécharger La Cigale",
        "intro_comp": "Trois navigateurs qui prennent la vie privée au sérieux, avec des choix différents. "
                      "Ce tableau décrit leur état en novembre 2026 ; une erreur ? Signalez-la sur GitHub.",
        "conclusion": "<b>LibreWolf</b> est très proche dans l'esprit et suit Firefox au plus près. "
                      "<b>Brave</b> convient si vous voulez Chromium, le mobile ou Tor intégré, avec des services en plus. "
                      "<b>La Cigale</b> vise une base stable (ESR), des profils simples et une interface pensée en français.",
        "colonnes": ("", "La Cigale", "LibreWolf", "Brave"),
    },
    "en": {
        "faq": {
            "chemin": "en/faq/", "titre": "La Cigale privacy browser: frequently asked questions",
            "h1": "Frequently asked questions",
            "description": "Answers about La Cigale: free, based on Firefox ESR, anonymity, Tor window, extensions, updates, Windows and Linux.",
        },
        "comparaison": {
            "chemin": "en/comparison/", "titre": "La Cigale vs LibreWolf vs Brave: privacy browser comparison",
            "h1": "La Cigale, LibreWolf and Brave",
            "description": "A fair comparison of three privacy-focused browsers: La Cigale, LibreWolf and Brave. Engine, telemetry, ad blocking, fingerprinting, Tor, platforms.",
        },
        "retour": "← Home", "langue": "Français", "telecharger": "Download La Cigale",
        "intro_comp": "Three browsers that take privacy seriously, with different choices. "
                      "This table describes them as of November 2026; spotted a mistake? Report it on GitHub.",
        "conclusion": "<b>LibreWolf</b> is very close in spirit and tracks Firefox closely. "
                      "<b>Brave</b> suits you if you want Chromium, mobile or built-in Tor, with extra services. "
                      "<b>La Cigale</b> aims for a stable base (ESR), simple profiles and a French-first interface.",
        "colonnes": ("", "La Cigale", "LibreWolf", "Brave"),
    },
}
AUTRE = {"fr": "en", "en": "fr"}
CORRESPONDANCE = {"faq/": "en/faq/", "comparaison/": "en/comparison/", "securite/": "en/security/",
                  "en/faq/": "faq/", "en/comparison/": "comparaison/", "en/security/": "securite/"}

TEXTES["fr"]["securite"] = {
    "chemin": "securite/", "titre": "Sécurité de La Cigale : protections, vérifications et limites",
    "h1": "Sécurité",
    "description": "Ce que La Cigale verrouille, comment ses versions sont vérifiées, ce qu'elle contacte sur le réseau et ses limites connues. Rapport d'audit publié.",
}
TEXTES["en"]["securite"] = {
    "chemin": "en/security/", "titre": "La Cigale security: protections, verification and limits",
    "h1": "Security",
    "description": "What La Cigale locks down, how its releases are verified, what it contacts on the network and its known limits. Audit report published.",
}

# Icônes SVG (trait), même graphisme partout
ICONES = {
    "cadenas": '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/>',
    "paquet": '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    "reseau": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    "alerte": '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.5"/>',
    "rapport": '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13l2 2 4-4"/>',
}

SECURITE = {
    "fr": [
        ("cadenas", "Verrouillé, même face aux extensions", [
            "Télémétrie, études et rapports de plantage coupés ; les programmes correspondants sont retirés du paquet.",
            "Anti-empreinte de Tor Browser (<code>resistFingerprinting</code>) ; WebGL, WebGPU et WebRTC coupés.",
            "HTTPS imposé, TLS 1.2 minimum, pas de 0-RTT, OCSP obligatoire et CRLite.",
            "Cookies et cache isolés par site ; tout est effacé à la fermeture, rien n'est écrit dans un cache disque.",
            "Pas de mots de passe enregistrés, pas de JavaScript dans les PDF, pas de DRM.",
            "Les extensions installées en douce par d'autres programmes sont refusées.",
        ]),
        ("paquet", "Des versions vérifiables", [
            "Firefox ESR vient de Mozilla : empreinte SHA-512 et signature GPG de Mozilla vérifiées, signature Authenticode sous Windows.",
            "Chaque version publie ses empreintes SHA-256 (<code>SHA256SUMS.txt</code>).",
            "La mise à jour en un clic compare l'empreinte de l'installeur téléchargé à celle publiée ; un écart annule tout.",
            "Le dépôt APT est signé (clé ed25519, empreinte <code>8133 6ADC CAD0 2142 F542 BE53 E231 938C AAB4 F2D5</code>).",
            "La clé privée du dépôt APT n'est jamais dans le code source : seule la construction automatique s'en sert.",
        ]),
        ("reseau", "Ce que La Cigale contacte", [
            "<b>Quad9</b> (Suisse) pour le DNS chiffré : il voit les domaines visités.",
            "<b>L'autorité de certification</b> du site (OCSP) : elle voit le certificat consulté.",
            "<b>GitHub</b>, une fois par jour, pour savoir s'il existe une nouvelle version. Désactivable dans la page Protection.",
            "<b>Mozilla</b>, seulement si vous traduisez une page : téléchargement du modèle de langue. Le texte reste sur l'ordinateur.",
            "<b>api.ipify.org</b>, seulement quand vous lancez le test de fuites.",
            "<b>Les sites de vos raccourcis</b>, pour afficher leur logo. Jamais Google ni un service tiers.",
        ]),
        ("alerte", "Limites connues", [
            "L'installeur Windows n'est pas signé : SmartScreen affiche un avertissement. Vérifiez l'empreinte SHA-256 avant de l'ouvrir.",
            "La configuration de La Cigale tourne avec les droits du navigateur (bac à sable <code>autoconfig</code> désactivé), parce qu'elle en a besoin. Un site web ne peut pas la modifier.",
            "Sans réglage, La Cigale ne cache pas votre adresse IP : choisissez un proxy (Protection, Adresse IP) ou la fenêtre Tor. Le fournisseur du proxy voit alors les sites visités. Pour un anonymat fort, Tor Browser reste la référence.",
        ]),
        ("rapport", "Audit", [
            'Un audit statique du code a été mené en novembre 2026 : aucune faille critique, un risque élevé (mise à jour non vérifiée) corrigé depuis. <a href="https://github.com/urbanyl/la-cigale/blob/main/docs/audit-securite-zh.md">Lire le rapport</a>.',
            'Une faille ? Signalez-la sur <a href="https://github.com/urbanyl/la-cigale/security">GitHub</a>.',
        ]),
    ],
    "en": [
        ("cadenas", "Locked, even against extensions", [
            "Telemetry, studies and crash reports are off; the matching programs are removed from the package.",
            "Tor Browser's fingerprinting protection (<code>resistFingerprinting</code>); WebGL, WebGPU and WebRTC off.",
            "HTTPS only, TLS 1.2 minimum, no 0-RTT, mandatory OCSP and CRLite.",
            "Cookies and cache isolated per site; everything is wiped on close, nothing goes to a disk cache.",
            "No saved passwords, no JavaScript in PDFs, no DRM.",
            "Extensions sideloaded by other programs are refused.",
        ]),
        ("paquet", "Verifiable releases", [
            "Firefox ESR comes from Mozilla: SHA-512 checksum and Mozilla's GPG signature checked, Authenticode signature on Windows.",
            "Every release publishes its SHA-256 checksums (<code>SHA256SUMS.txt</code>).",
            "One-click update compares the downloaded installer to the published checksum; any mismatch cancels it.",
            "The APT repository is signed (ed25519 key, fingerprint <code>8133 6ADC CAD0 2142 F542 BE53 E231 938C AAB4 F2D5</code>).",
            "The APT private key is never in the source code: only the automated build uses it.",
        ]),
        ("reseau", "What La Cigale contacts", [
            "<b>Quad9</b> (Switzerland) for encrypted DNS: it sees the domains you visit.",
            "<b>The site's certificate authority</b> (OCSP): it sees which certificate is checked.",
            "<b>GitHub</b>, once a day, to check for a new version. Can be turned off on the Protection page.",
            "<b>Mozilla</b>, only when you translate a page: the language model is downloaded. The text stays on your computer.",
            "<b>api.ipify.org</b>, only when you run the leak test.",
            "<b>Your shortcuts' websites</b>, to show their logo. Never Google or a third-party service.",
        ]),
        ("alerte", "Known limits", [
            "The Windows installer is not signed: SmartScreen shows a warning. Check the SHA-256 checksum before running it.",
            "La Cigale's configuration runs with browser privileges (<code>autoconfig</code> sandbox off), because it needs them. Websites cannot change it.",
            "By default, La Cigale does not hide your IP address: pick a proxy (Protection, IP address) or the Tor window. The proxy provider then sees the sites you visit. For strong anonymity Tor Browser remains the reference.",
        ]),
        ("rapport", "Audit", [
            'A static code audit was carried out in November 2026: no critical flaw, one high risk (unverified update) fixed since. <a href="https://github.com/urbanyl/la-cigale/blob/main/docs/audit-securite-zh.md">Read the report</a> (Chinese).',
            'Found a flaw? Report it on <a href="https://github.com/urbanyl/la-cigale/security">GitHub</a>.',
        ]),
    ],
}


def tete(langue, page, relatif, schema):
    t = TEXTES[langue][page]
    chemin, autre = t["chemin"], CORRESPONDANCE[t["chemin"]]
    fr, en = (chemin, autre) if langue == "fr" else (autre, chemin)
    return f'''<!DOCTYPE html>
<html lang="{langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(t["titre"])}</title>
<meta name="description" content="{html.escape(t["description"])}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="{BASE}{chemin}">
<link rel="alternate" hreflang="fr" href="{BASE}{fr}">
<link rel="alternate" hreflang="en" href="{BASE}{en}">
<link rel="alternate" hreflang="x-default" href="{BASE}{fr}">
<link rel="icon" type="image/png" href="{relatif}favicon.png">
<meta name="theme-color" content="#0e0e10">
<meta property="og:type" content="article">
<meta property="og:site_name" content="La Cigale">
<meta property="og:locale" content="{"fr_FR" if langue == "fr" else "en_US"}">
<meta property="og:title" content="{html.escape(t["titre"])}">
<meta property="og:description" content="{html.escape(t["description"])}">
<meta property="og:url" content="{BASE}{chemin}">
<meta property="og:image" content="{BASE}apercu.jpg">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
{json.dumps(schema, ensure_ascii=False, indent=1)}
</script>
<link rel="stylesheet" href="{relatif}style.css?v=4">
</head>
'''


def pied(langue, page, relatif):
    t = TEXTES[langue]
    autre = CORRESPONDANCE[t[page]["chemin"]]
    vers_autre = relatif + autre
    return f'''<a class="coin gauche" href="{relatif}{"" if langue == "fr" else "en/"}">{t["retour"]}</a>
<a class="coin droite" href="{vers_autre}" hreflang="{AUTRE[langue]}" lang="{AUTRE[langue]}">{t["langue"]}</a>
'''


def fil(langue, page):
    t = TEXTES[langue][page]
    accueil = BASE if langue == "fr" else BASE + "en/"
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "La Cigale", "item": accueil},
        {"@type": "ListItem", "position": 2, "name": t["h1"], "item": BASE + t["chemin"]},
    ]}


def page_faq(langue):
    faq = FAQ_FR if langue == "fr" else FAQ_EN
    t = TEXTES[langue]
    relatif = "../" if langue == "fr" else "../../"
    schema = [{"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": langue, "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": r}} for q, r in faq]},
        fil(langue, "faq")]
    corps = "\n".join(f'''  <details{" open" if i < 2 else ""}>
    <summary>{html.escape(q)}</summary>
    <p>{html.escape(r)}</p>
  </details>''' for i, (q, r) in enumerate(faq))
    return tete(langue, "faq", relatif, schema) + f'''<body class="page">
<main>
  <header>
    <img src="{relatif}symbole.png" alt="La Cigale">
    <div>
      <h1>{t["faq"]["h1"]}</h1>
      <p class="sous-titre">La Cigale</p>
    </div>
  </header>
  <section class="questions">
{corps}
  </section>
  <p class="suite"><a class="bouton" href="https://github.com/urbanyl/la-cigale/releases/latest">{t["telecharger"]}</a></p>
</main>
''' + pied(langue, "faq", relatif) + "</body>\n</html>\n"


def page_comparaison(langue):
    lignes = COMPARAISON_FR if langue == "fr" else COMPARAISON_EN
    t = TEXTES[langue]
    relatif = "../" if langue == "fr" else "../../"
    schema = [fil(langue, "comparaison")]
    tete_tableau = "".join(f"<th scope=\"col\">{c}</th>" for c in t["colonnes"])
    corps = "\n".join("      <tr><th scope=\"row\">{}</th>{}</tr>".format(
        html.escape(l[0]), "".join(f"<td>{html.escape(c)}</td>" for c in l[1:])) for l in lignes)
    return tete(langue, "comparaison", relatif, schema) + f'''<body class="page">
<main>
  <header>
    <img src="{relatif}symbole.png" alt="La Cigale">
    <div>
      <h1>{t["comparaison"]["h1"]}</h1>
      <p class="sous-titre">{t["intro_comp"]}</p>
    </div>
  </header>
  <div class="tableau">
    <table>
      <thead><tr>{tete_tableau}</tr></thead>
      <tbody>
{corps}
      </tbody>
    </table>
  </div>
  <p class="conclusion">{t["conclusion"]}</p>
  <p class="suite"><a class="bouton" href="https://github.com/urbanyl/la-cigale/releases/latest">{t["telecharger"]}</a></p>
</main>
''' + pied(langue, "comparaison", relatif) + "</body>\n</html>\n"


def page_securite(langue):
    t = TEXTES[langue]
    relatif = "../" if langue == "fr" else "../../"
    blocs = []
    for icone, titre, lignes in SECURITE[langue]:
        items = "".join(f"      <li>{ligne}</li>\n" for ligne in lignes)
        blocs.append(f"""  <section class="bloc">
    <h2><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONES[icone]}</svg>{html.escape(titre)}</h2>
    <ul>
{items}    </ul>
  </section>""")
    blocs = "\n".join(blocs)
    return tete(langue, "securite", relatif, [fil(langue, "securite")]) + f"""<body class="page">
<main>
  <header>
    <img src="{relatif}symbole.png" alt="La Cigale">
    <div>
      <h1>{t["securite"]["h1"]}</h1>
      <p class="sous-titre">La Cigale</p>
    </div>
  </header>
{blocs}
  <p class="suite"><a class="bouton" href="https://github.com/urbanyl/la-cigale/releases/latest">{t["telecharger"]}</a></p>
</main>
""" + pied(langue, "securite", relatif) + "</body>\n</html>\n"


# ---------- Pages légales ----------

ICONES.update({
    "personne": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "serveur": '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    "balance": '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    "oeil": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "document": '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
})

GH = "https://github.com/urbanyl/la-cigale"
CONTACT_FR = f'par une <a href="{GH}/issues">issue sur GitHub</a>, ou en privé par <a href="{GH}/security">le signalement de sécurité</a>'
CONTACT_EN = f'through a <a href="{GH}/issues">GitHub issue</a>, or privately through <a href="{GH}/security">security reporting</a>'
HEBERGEUR_FR = 'GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (<a href="https://github.com">github.com</a>).'
HEBERGEUR_EN = 'GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, United States (<a href="https://github.com">github.com</a>).'
MPL = '<a href="https://www.mozilla.org/MPL/2.0/">MPL-2.0</a>'

LEGAL = {
    "fr": {
        "mentions": [
            ("personne", "Éditeur", [
                "Site et logiciel publiés par <b>urbanyl</b>, particulier agissant à titre non professionnel. "
                "Conformément à l'article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 (LCEN), l'éditeur a choisi de rester sous pseudonyme ; "
                "ses éléments d'identification ont été communiqués à l'hébergeur.",
                "Directeur de la publication : urbanyl.",
                f"Contact : {CONTACT_FR}.",
            ]),
            ("serveur", "Hébergeur", [HEBERGEUR_FR]),
            ("balance", "Propriété intellectuelle", [
                f"Le code de La Cigale et les textes de ce site sont distribués sous licence {MPL}.",
                'Les marques et logiciels tiers restent la propriété de leurs titulaires ; voir <a href="../licences/">Licences et marques</a>.',
            ]),
        ],
        "confidentialite": [
            ("oeil", "En bref", [
                "Le projet La Cigale ne collecte <b>aucune</b> donnée personnelle : pas de compte, pas de serveur à lui, pas de télémétrie, pas de mesure d'audience, pas de cookie.",
                "Comme rien n'est collecté, il n'y a rien à consulter, corriger ou supprimer chez nous.",
            ]),
            ("serveur", "Ce site", [
                'Il est hébergé par GitHub Pages. GitHub enregistre l\'adresse IP des visiteurs pour la sécurité du service, selon sa <a href="https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement">déclaration de confidentialité</a>. L\'éditeur n\'a pas accès à ces journaux.',
                "Aucun cookie, aucun script de suivi. La police d'écriture est servie par le site lui-même, sans appel à Google ni à un autre service.",
                "Les téléchargements se font depuis GitHub Releases, dans les mêmes conditions.",
            ]),
            ("reseau", "Le navigateur", [
                "Les données de navigation (historique, cookies, cache) restent sur votre ordinateur et sont effacées à la fermeture, sauf réglage contraire de votre part.",
                "<b>Quad9</b> (Suisse) résout les noms de domaine en DNS chiffré : il voit les domaines visités, sans les associer à un compte.",
                "<b>GitHub</b>, une fois par jour, pour vérifier s'il existe une nouvelle version (désactivable dans la page Protection).",
                "<b>uBlock Origin</b> télécharge ses listes de filtres auprès de leurs auteurs.",
                "<b>Mozilla</b>, seulement si vous traduisez une page ou installez une extension depuis son site.",
                "<b>api.ipify.org</b>, seulement quand vous testez votre adresse IP.",
                "<b>Les sites de vos raccourcis</b>, pour afficher leur logo.",
                "<b>Votre fournisseur de proxy</b> ou <b>le réseau Tor</b>, seulement si vous les activez : ils voient alors les sites visités, selon leurs propres conditions.",
            ]),
            ("balance", "Vos droits", [
                f"Pour toute question sur vos données : {CONTACT_FR}.",
                'Vous pouvez aussi saisir la <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.',
            ]),
        ],
        "conditions": [
            ("document", "Licence", [
                f"La Cigale est gratuite et son code source est public sous {MPL}. Vous pouvez l'utiliser, l'étudier, la modifier et la redistribuer selon cette licence.",
            ]),
            ("alerte", "Sans garantie", [
                "Le logiciel est fourni « tel quel », sans garantie d'aucune sorte, dans les limites prévues par la loi (sections 6 et 7 de la MPL-2.0).",
                "La Cigale réduit fortement le pistage mais ne garantit pas l'anonymat. Un proxy cache votre adresse au site visité, pas à son fournisseur. Pour un anonymat fort, utilisez Tor Browser.",
            ]),
            ("personne", "Votre usage", [
                "Vous restez responsable de l'usage que vous faites du navigateur et des services auxquels vous le connectez (proxys, extensions, sites), dans le respect de la loi et de leurs propres conditions.",
            ]),
            ("balance", "Droit applicable", [
                "Ces conditions relèvent du droit français. Elles peuvent évoluer avec le logiciel ; la version en ligne fait foi.",
            ]),
        ],
        "licences": [
            ("paquet", "Logiciels inclus", [
                f"<b>Firefox ESR</b>, Mozilla Foundation, {MPL}. Firefox est une marque déposée de la Mozilla Foundation. La Cigale n'est ni affiliée à Mozilla ni approuvée par elle, et n'utilise ni le nom ni le logo de Firefox comme sa propre marque.",
                '<b>uBlock Origin</b>, Raymond Hill et contributeurs, <a href="https://github.com/gorhill/uBlock/blob/master/LICENSE.txt">GPL-3.0</a>, inclus sans modification.',
                '<b>La Cigale</b> elle-même : <a href="https://github.com/urbanyl/la-cigale/blob/main/LICENSE">MPL-2.0</a>.',
            ]),
            ("reseau", "Marques et services cités", [
                "<b>Tor</b> est une marque du Tor Project, Inc. L'icône « Tor Browser icon » (The Tor Project, <a href=\"https://commons.wikimedia.org/wiki/File:Tor_Browser_icon.svg\">Wikimedia Commons</a>, licence CC BY-SA 4.0) sert uniquement à désigner la fenêtre qui passe par le réseau Tor ; La Cigale n'est ni affiliée au Tor Project ni approuvée par lui.",
                "Quad9, Qwant, Startpage, Lilo, Wikipédia, OpenStreetMap, Légifrance, Seyra et les autres services cités appartiennent à leurs titulaires.",
            ]),
            ("document", "Logo et police", [
                'Logo : « Cicada » par Alex Muravev, The Noun Project, licence <a href="https://creativecommons.org/licenses/by/3.0/deed.fr">CC BY 3.0</a>.',
                'Police <b>Bricolage Grotesque</b>, Mathieu Triay, <a href="https://openfontlicense.org">SIL Open Font License 1.1</a>.',
            ]),
        ],
    },
    "en": {
        "mentions": [
            ("personne", "Publisher", [
                "Website and software published by <b>urbanyl</b>, a private individual acting on a non-professional basis. "
                "Under article 6, III, 2 of French law no. 2004-575 of 21 June 2004 (LCEN), the publisher chose to remain pseudonymous; "
                "their identification details have been given to the host.",
                "Publication director: urbanyl.",
                f"Contact: {CONTACT_EN}.",
            ]),
            ("serveur", "Host", [HEBERGEUR_EN]),
            ("balance", "Intellectual property", [
                f"La Cigale's code and this website's texts are released under the {MPL}.",
                'Third-party trademarks and software belong to their owners; see <a href="../licenses/">Licenses and trademarks</a>.',
            ]),
        ],
        "confidentialite": [
            ("oeil", "In short", [
                "The La Cigale project collects <b>no</b> personal data: no account, no server of its own, no telemetry, no analytics, no cookies.",
                "Since nothing is collected, there is nothing for us to access, correct or delete.",
            ]),
            ("serveur", "This website", [
                'It is hosted on GitHub Pages. GitHub logs visitors\' IP addresses for security, as described in its <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">privacy statement</a>. The publisher has no access to these logs.',
                "No cookies, no tracking scripts. The font is served by the site itself, with no call to Google or any other service.",
                "Downloads come from GitHub Releases, under the same terms.",
            ]),
            ("reseau", "The browser", [
                "Browsing data (history, cookies, cache) stays on your computer and is wiped on close, unless you change that.",
                "<b>Quad9</b> (Switzerland) resolves domain names over encrypted DNS: it sees the domains you visit, without linking them to an account.",
                "<b>GitHub</b>, once a day, to check for a new version (can be turned off on the Protection page).",
                "<b>uBlock Origin</b> downloads its filter lists from their authors.",
                "<b>Mozilla</b>, only when you translate a page or install an extension from its site.",
                "<b>api.ipify.org</b>, only when you test your IP address.",
                "<b>Your shortcuts' websites</b>, to show their logo.",
                "<b>Your proxy provider</b> or <b>the Tor network</b>, only if you turn them on: they then see the sites you visit, under their own terms.",
            ]),
            ("balance", "Your rights", [
                f"For any question about your data: {CONTACT_EN}.",
                'You can also contact the French data protection authority, the <a href="https://www.cnil.fr/en/home">CNIL</a>, or your own.',
            ]),
        ],
        "conditions": [
            ("document", "License", [
                f"La Cigale is free and its source code is public under the {MPL}. You may use, study, modify and redistribute it under that license.",
            ]),
            ("alerte", "No warranty", [
                'The software is provided "as is", without warranty of any kind, to the extent permitted by law (sections 6 and 7 of the MPL-2.0).',
                "La Cigale greatly reduces tracking but does not guarantee anonymity. A proxy hides your address from the site you visit, not from its provider. For strong anonymity, use Tor Browser.",
            ]),
            ("personne", "Your use", [
                "You remain responsible for how you use the browser and the services you connect it to (proxies, extensions, websites), in line with the law and their own terms.",
            ]),
            ("balance", "Governing law", [
                "These terms are governed by French law. They may change along with the software; the online version prevails.",
            ]),
        ],
        "licences": [
            ("paquet", "Included software", [
                f"<b>Firefox ESR</b>, Mozilla Foundation, {MPL}. Firefox is a registered trademark of the Mozilla Foundation. La Cigale is neither affiliated with nor endorsed by Mozilla, and does not use the Firefox name or logo as its own brand.",
                '<b>uBlock Origin</b>, Raymond Hill and contributors, <a href="https://github.com/gorhill/uBlock/blob/master/LICENSE.txt">GPL-3.0</a>, included unmodified.',
                '<b>La Cigale</b> itself: <a href="https://github.com/urbanyl/la-cigale/blob/main/LICENSE">MPL-2.0</a>.',
            ]),
            ("reseau", "Trademarks and services mentioned", [
                "<b>Tor</b> is a trademark of The Tor Project, Inc. The \"Tor Browser icon\" (The Tor Project, <a href=\"https://commons.wikimedia.org/wiki/File:Tor_Browser_icon.svg\">Wikimedia Commons</a>, CC BY-SA 4.0) only identifies the window that goes through the Tor network; La Cigale is neither affiliated with nor endorsed by the Tor Project.",
                "Quad9, Qwant, Startpage, Lilo, Wikipedia, OpenStreetMap, Légifrance, Seyra and the other services mentioned belong to their owners.",
            ]),
            ("document", "Logo and font", [
                'Logo: "Cicada" by Alex Muravev, The Noun Project, <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>.',
                '<b>Bricolage Grotesque</b> font, Mathieu Triay, <a href="https://openfontlicense.org">SIL Open Font License 1.1</a>.',
            ]),
        ],
    },
}

PAGES_LEGALES = {
    "mentions": (("mentions-legales/", "Mentions légales", "Éditeur, hébergeur et propriété intellectuelle du site et du navigateur La Cigale."),
                 ("en/legal-notice/", "Legal notice", "Publisher, host and intellectual property of the La Cigale website and browser.")),
    "confidentialite": (("confidentialite/", "Confidentialité", "Ce que le site et le navigateur La Cigale font de vos données : rien n'est collecté, et voici ce que le navigateur contacte."),
                        ("en/privacy/", "Privacy", "What the La Cigale website and browser do with your data: nothing is collected, and here is what the browser contacts.")),
    "conditions": (("conditions/", "Conditions d'utilisation", "Licence, absence de garantie et responsabilité pour l'utilisation de La Cigale."),
                   ("en/terms/", "Terms of use", "License, no warranty and responsibility when using La Cigale.")),
    "licences": (("licences/", "Licences et marques", "Logiciels inclus dans La Cigale, leurs licences, et les marques citées."),
                 ("en/licenses/", "Licenses and trademarks", "Software included in La Cigale, their licenses, and the trademarks mentioned.")),
}
for _cle, ((_fr, _hfr, _dfr), (_en, _hen, _den)) in PAGES_LEGALES.items():
    TEXTES["fr"][_cle] = {"chemin": _fr, "titre": _hfr + " | La Cigale", "h1": _hfr, "description": _dfr}
    TEXTES["en"][_cle] = {"chemin": _en, "titre": _hen + " | La Cigale", "h1": _hen, "description": _den}
    CORRESPONDANCE[_fr] = _en
    CORRESPONDANCE[_en] = _fr

LIENS_LEGAUX = {
    "fr": [("mentions-legales/", "Mentions légales"), ("confidentialite/", "Confidentialité"), ("conditions/", "Conditions"), ("licences/", "Licences")],
    "en": [("en/legal-notice/", "Legal notice"), ("en/privacy/", "Privacy"), ("en/terms/", "Terms"), ("en/licenses/", "Licenses")],
}


def page_legale(langue, cle):
    t = TEXTES[langue]
    relatif = "../" if langue == "fr" else "../../"
    blocs = []
    for icone, titre, lignes in LEGAL[langue][cle]:
        items = "".join(f"      <li>{ligne}</li>\n" for ligne in lignes)
        blocs.append(f"""  <section class="bloc">
    <h2><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONES[icone]}</svg>{html.escape(titre)}</h2>
    <ul>
{items}    </ul>
  </section>""")
    autres = " ".join(f'<a href="{relatif}{c}">{n}</a>' for c, n in LIENS_LEGAUX[langue] if c != t[cle]["chemin"])
    maj = "Mise à jour le 23 novembre 2026." if langue == "fr" else "Last updated 23 November 2026."
    corps = "\n".join(blocs)
    return tete(langue, cle, relatif, [fil(langue, cle)]) + f"""<body class="page">
<main>
  <header>
    <img src="{relatif}symbole.png" alt="La Cigale">
    <div>
      <h1>{t[cle]["h1"]}</h1>
      <p class="sous-titre">{maj}</p>
    </div>
  </header>
{corps}
  <p class="liens">{autres}</p>
</main>
""" + pied(langue, cle, relatif) + "</body>\n</html>\n"


def sitemap():
    paires = [("", "en/"), ("faq/", "en/faq/"), ("comparaison/", "en/comparison/"), ("securite/", "en/security/")] + [(v[0][0], v[1][0]) for v in PAGES_LEGALES.values()]
    entrees = []
    for fr, en in paires:
        for chemin in (fr, en):
            entrees.append(f'''  <url>
    <loc>{BASE}{chemin}</loc>
    <lastmod>{DATE}</lastmod>
    <xhtml:link rel="alternate" hreflang="fr" href="{BASE}{fr}"/>
    <xhtml:link rel="alternate" hreflang="en" href="{BASE}{en}"/>
  </url>''')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
            + "\n".join(entrees) + "\n</urlset>\n")


if __name__ == "__main__":
    for langue in ("fr", "en"):
        for page, fabrique in (("faq", page_faq), ("comparaison", page_comparaison), ("securite", page_securite)):
            cible = ICI / TEXTES[langue][page]["chemin"] / "index.html"
            cible.parent.mkdir(parents=True, exist_ok=True)
            cible.write_text(fabrique(langue), encoding="utf-8")
            print(cible.relative_to(ICI))
        for cle in PAGES_LEGALES:
            cible = ICI / TEXTES[langue][cle]["chemin"] / "index.html"
            cible.parent.mkdir(parents=True, exist_ok=True)
            cible.write_text(page_legale(langue, cle), encoding="utf-8")
            print(cible.relative_to(ICI))
    (ICI / "sitemap.xml").write_text(sitemap(), encoding="utf-8")
