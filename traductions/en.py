# Version anglaise de La Cigale : lu par outils/traduire.py.
# FICHIERS : remplacés en entier (traductions/en/…). PAIRES : remplacements exacts, dans l'ordre.

FICHIERS = {
    "accueil/salutations.js": "salutations.js",
    "accueil/citations.js": "citations.js",
}

HTML = [
    "accueil/index.html", "accueil/apropos.html",
]

PAIRES = {}

PAIRES["accueil/index.html"] = [
    ("<title>Nouvel onglet</title>", "<title>New tab</title>"),
    ('id="salut">Bonjour<', 'id="salut">Hello<'),
    (">Rechercher sur le Web<", ">Search the web<"),
    ('placeholder="Rechercher ou saisir une adresse"', 'placeholder="Search or enter address"'),
    (">Moteur de recherche : <", ">Search engine: <"),
    ('aria-label="Moteur de recherche"', 'aria-label="Search engine"'),
    (">Wikipédia</li>", ">Wikipedia</li>"),
    ('aria-label="Lancer la recherche"', 'aria-label="Search"'),
    (">Cette semaine, La Cigale a bloqué<", ">This week, La Cigale blocked<"),
    (">Qui vous suivait<", ">Who was following you<"),
    (">tentatives de pistage<", ">tracking attempts<"),
    ('aria-label="Blocages par jour"', 'aria-label="Blocks per day"'),
    ("<span>traqueurs</span>", "<span>trackers</span>"),
    ("<span>requêtes uBlock</span>", "<span>uBlock requests</span>"),
    ("<span>lectures d'empreinte</span>", "<span>fingerprint reads</span>"),
    ("<span>liens nettoyés</span>", "<span>links cleaned</span>"),
    ("Protection et profils</a>", "Protection and profiles</a>"),
    ("Réglages</a>", "Settings</a>"),
    ("<b>Fenêtre Tor</b><small>naviguer par le réseau Tor</small>", "<b>Tor window</b><small>browse through the Tor network</small>"),
    (">Raccourcis</h2>", ">Shortcuts</h2>"),
    ('id="modifier" type="button">Modifier<', 'id="modifier" type="button">Edit<'),
    ('placeholder="Nom"', 'placeholder="Name"'),
    ('<button type="submit">Ajouter</button>', '<button type="submit">Add</button>'),
    ('id="reinitialiser">Réinitialiser<', 'id="reinitialiser">Reset<'),
    ("Astuce : faites glisser une tuile pour réordonner vos raccourcis.", "Tip: drag a tile to reorder your shortcuts."),
    ('aria-controls="panneau">Personnaliser<', 'aria-controls="panneau">Customize<'),
    ('data-ouvrir="apropos">À propos<', 'data-ouvrir="apropos">About<'),
    ('id="panneau-titre">Personnaliser<', 'id="panneau-titre">Customize<'),
    ('aria-label="Fermer"', 'aria-label="Close"'),
    ("<legend>Apparence</legend>", "<legend>Appearance</legend>"),
    ("<span>Sombre</span>", "<span>Dark</span>"),
    ("<span>Clair</span>", "<span>Light</span>"),
    ("<legend>Fond</legend>", "<legend>Background</legend>"),
    ("<span>Cigale</span>", "<span>Cicada</span>"),
    ("<span>Uni</span>", "<span>Plain</span>"),
    ("<span>Citation du jour</span>", "<span>Quote of the day</span>"),
    ("<span>Bilan de la semaine</span>", "<span>Weekly summary</span>"),
    ("<span>Horloge</span>", "<span>Clock</span>"),
    ("""Protection et profils de sécurité : bouton « Protection et profils » ci-dessus,
        bouton <b>cigale</b> de la barre d'outils, ou <kbd>about:cigale</kbd> dans la barre d'adresse.""",
     """Protection and security profiles: the "Protection and profiles" button above,
        the <b>cicada</b> button in the toolbar, or <kbd>about:cigale</kbd> in the address bar."""),
]

PAIRES["accueil/accueil.js"] = [
    ("search?language=francais&query=", "search?language=english&query="),
    ('wikipedia: "https://fr.wikipedia.org/w/index.php?search="', 'wikipedia: "https://en.wikipedia.org/w/index.php?search="'),
    ('{ nom: "Wikipédia", url: "https://fr.wikipedia.org" }', '{ nom: "Wikipedia", url: "https://en.wikipedia.org" }'),
    ('{ nom: "Météo-France", url: "https://meteofrance.com" }', '{ nom: "Internet Archive", url: "https://archive.org" }'),
    ('{ nom: "France Culture", url: "https://www.radiofrance.fr/franceculture" }', '{ nom: "Project Gutenberg", url: "https://www.gutenberg.org" }'),
    ('{ nom: "Framasoft", url: "https://framasoft.org" }', '{ nom: "Wikimedia Commons", url: "https://commons.wikimedia.org" }'),
    ('"fr-FR"', '"en-US"'),
    ("`Retirer ${r.nom}`", "`Remove ${r.nom}`"),
    ("`Déplacer ${r.nom} vers la gauche`", "`Move ${r.nom} left`"),
    ("`Déplacer ${r.nom} vers la droite`", "`Move ${r.nom} right`"),
    ('actif ? "Terminé" : "Modifier"', 'actif ? "Done" : "Edit"'),
    ('"Votre bilan commence aujourd\'hui"', '"Your summary starts today"'),
    ('"Depuis votre arrivée, La Cigale a bloqué" : "Cette semaine, La Cigale a bloqué"',
     '"Since you arrived, La Cigale blocked" : "This week, La Cigale blocked"'),
    ('b.bloques == 1 ? "tentative de pistage" : "tentatives de pistage"', 'b.bloques == 1 ? "tracking attempt" : "tracking attempts"'),
    ("`${nombre(j.bloques)} le ${date", "`${nombre(j.bloques)} on ${date"),
    ('qui.append("Le plus souvent : ");', 'qui.append("Most often: ");'),
    ('" et " : ", "', '" and " : ", "'),
    ('`présent sur ${nombre(n)} page${n > 1 ? "s" : ""}`', '`found on ${nombre(n)} page${n > 1 ? "s" : ""}`'),
    ('"Aucun traqueur rencontré pour l\'instant."', '"No trackers encountered yet."'),
    ('"Chaque traqueur bloqué sera compté ici, sans jamais noter les sites que vous visitez."',
     '"Every blocked tracker will be counted here, without ever recording the sites you visit."'),
    ("""`${parties.weekday == "Mon" ? "La semaine passée" : "Votre semaine"} en bref : ${nombre(b.bloques)} tentative${b.bloques > 1 ? "s" : ""} de pistage bloquée${b.bloques > 1 ? "s" : ""}`""",
     """`${parties.weekday == "Mon" ? "Last week" : "Your week"} at a glance: ${nombre(b.bloques)} tracking attempt${b.bloques > 1 ? "s" : ""} blocked`"""),
    ("`, dont ${nombre(b.traqueurs)} traqueur${b.traqueurs > 1 ? \"s\" : \"\"}`", "`, including ${nombre(b.traqueurs)} tracker${b.traqueurs > 1 ? \"s\" : \"\"}`"),
    ("`Le jour le plus chargé : ${nomJour(fort)}, avec ${nombre(fort.bloques)}.`", "`Busiest day: ${nomJour(fort)}, with ${nombre(fort.bloques)}.`"),
    ('`${nombre(b.liens)} lien${b.liens > 1 ? "s" : ""} nettoyé${b.liens > 1 ? "s" : ""} au passage.`',
     '`${nombre(b.liens)} link${b.liens > 1 ? "s" : ""} cleaned along the way.`'),
]

PAIRES["accueil/apropos.html"] = [
    ("<title>À propos</title>", "<title>About</title>"),
    ("Le navigateur libre, sobre et respectueux, conçu en France.", "The free, lean and respectful browser, made in France."),
    ("<h2>Notre démarche</h2>", "<h2>Our approach</h2>"),
    ("""<p>La Cigale reprend Firefox ESR, la version à support étendu de Mozilla, et la règle
        pour l'anonymat et la sécurité : empreinte uniformisée façon Tor Browser, aucune
        télémétrie, DNS chiffré, HTTPS imposé, tout effacé à la fermeture. Interface en français.</p>""",
     """<p>La Cigale is built on Firefox ESR, Mozilla's extended support release, and tunes it
        for anonymity and security: a uniform fingerprint like Tor Browser, no
        telemetry, encrypted DNS, HTTPS enforced, everything wiped on close. Available in English and French.</p>"""),
    ("""<p>La Cigale réduit fortement le pistage. Sans réglage, votre adresse IP reste visible des sites :
        pour la cacher, choisissez un proxy (Protection, Adresse IP) ou la fenêtre Tor. Le logiciel est
        fourni tel quel, sans garantie, et ne promet pas l'anonymat total.</p>""",
     """<p>La Cigale greatly reduces tracking. Without changes, your IP address stays visible to sites:
        to hide it, choose a proxy (Protection, IP address) or the Tor window. The software is
        provided as is, without warranty, and does not promise complete anonymity.</p>"""),
    ("<h2>Réglages avancés</h2>", "<h2>Advanced settings</h2>"),
    ("""<p>Chaque réglage reste modifiable dans <code>about:config</code>. La liste complète des choix
        par défaut se trouve dans le fichier <code>cigale.cfg</code> livré avec le navigateur.</p>""",
     """<p>Every setting can still be changed in <code>about:config</code>. The full list of defaults
        is in the <code>cigale.cfg</code> file shipped with the browser.</p>"""),
    ("<p>Pour retrouver le nouvel onglet natif de Firefox, passez <code>cigale.nouvelOnglet.natif</code> à <code>true</code>.</p>",
     "<p>To get Firefox's native new tab back, set <code>cigale.nouvelOnglet.natif</code> to <code>true</code>.</p>"),
    ("<h2>Vos données</h2>", "<h2>Your data</h2>"),
    ("""<p>Le projet La Cigale ne collecte aucune donnée : pas de compte, pas de serveur, pas de télémétrie.
        Le navigateur contacte seulement Quad9 (DNS chiffré), GitHub (nouvelle version, une fois par jour),
        les auteurs des listes de filtres d'uBlock Origin et, à votre demande, Mozilla, api.ipify.org,
        votre proxy ou le réseau Tor.</p>""",
     """<p>The La Cigale project collects no data: no account, no server, no telemetry.
        The browser only contacts Quad9 (encrypted DNS), GitHub (new version, once a day),
        the authors of uBlock Origin's filter lists and, when you ask, Mozilla, api.ipify.org,
        your proxy or the Tor network.</p>"""),
    ("<h2>Licences</h2>", "<h2>Licenses</h2>"),
    ("""<p>La Cigale est distribuée sous licence publique Mozilla 2.0 (MPL-2.0). Firefox et ses logos
        sont des marques déposées de la Mozilla Foundation. La Cigale n'est ni affiliée à Mozilla
        ni approuvée par elle.</p>""",
     """<p>La Cigale is distributed under the Mozilla Public License 2.0 (MPL-2.0). Firefox and its logos
        are registered trademarks of the Mozilla Foundation. La Cigale is neither affiliated with
        nor endorsed by Mozilla.</p>"""),
    ("""<p>uBlock Origin, de Raymond Hill et ses contributeurs, est inclus sans modification sous licence GPL-3.0.
        Tor est une marque du Tor Project, Inc., qui n'est pas associé à La Cigale ; icône Tor sous licence CC BY-SA 4.0.</p>""",
     """<p>uBlock Origin, by Raymond Hill and contributors, is included unmodified under the GPL-3.0 license.
        Tor is a trademark of The Tor Project, Inc., which is not associated with La Cigale; Tor icon under CC BY-SA 4.0.</p>"""),
    ("""<p>Logo : « Cicada » par Alex Muravev, The Noun Project, licence
        <a href="https://creativecommons.org/licenses/by/3.0/deed.fr">CC BY 3.0</a>.</p>""",
     """<p>Logo: "Cicada" by Alex Muravev, The Noun Project, license
        <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>.</p>"""),
    ("<h2>Informations légales</h2>", "<h2>Legal information</h2>"),
    ("<p>Éditeur : urbanyl. Hébergeur du site et des téléchargements : GitHub, Inc.</p>",
     "<p>Publisher: urbanyl. Website and downloads hosted by GitHub, Inc.</p>"),
    (">Mentions légales<", ">Legal notice<"),
    (">Confidentialité<", ">Privacy<"),
    (">Conditions d'utilisation<", ">Terms of use<"),
    (">Licences et marques<", ">Licenses and trademarks<"),
    (">Code source<", ">Source code<"),
    ("← Retour</a>", "← Back</a>"),
]

# Les autres parties (une par dossier) complètent FICHIERS, HTML et PAIRES.
from pathlib import Path as _Path
for _partie in sorted(_Path(__file__).parent.glob("en_*.py")):
    exec(_partie.read_text(encoding="utf-8"))
