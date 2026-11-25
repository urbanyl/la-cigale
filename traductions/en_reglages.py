# Réglages du navigateur, moteurs de recherche, marque dans Firefox
FICHIERS["reglages/distribution/policies.json"] = "distribution/policies.json"

PAIRES["reglages/cigale.cfg"] = [
    ('defaultPref("intl.locale.requested", "fr");', 'defaultPref("intl.locale.requested", "en-US");'),
    ('defaultPref("browser.translations.neverTranslateLanguages", "fr");', 'defaultPref("browser.translations.neverTranslateLanguages", "en");'),
    ('bascule.setAttribute("label", "Tout effacer à la fermeture");', 'bascule.setAttribute("label", "Erase everything on close");'),
    ('"Historique, cookies, cache et formulaires sont supprimés quand vous fermez La Cigale. "',
     '"History, cookies, cache and forms are deleted when you close La Cigale. "'),
    ('"Désactivez pour rester connecté à vos sites et garder votre historique."',
     '"Turn off to stay signed in to your sites and keep your history."'),
    ('label: "Fenêtre Tor",', 'label: "Tor window",'),
    ('"Ouvrir une fenêtre qui passe par le réseau Tor"', '"Open a window that goes through the Tor network"'),
    ('`Fenêtre Tor : tout passe par le réseau Tor (port ${port}). Rien n\'est gardé à la fermeture.`',
     '`Tor window: everything goes through the Tor network (port ${port}). Nothing is kept on close.`'),
    ('`La Cigale ${propre} est disponible (vous avez la ${version}).`', '`La Cigale ${propre} is available (you have ${version}).`'),
    ('{ label: "Mettre à jour", accessKey: "M",', '{ label: "Update", accessKey: "U",'),
    ('{ label: "Télécharger", accessKey: "T",', '{ label: "Download", accessKey: "D",'),
    ('{ label: "Ignorer cette version", accessKey: "I",', '{ label: "Ignore this version", accessKey: "I",'),
    ('`Téléchargement de La Cigale ${propre}…`', '`Downloading La Cigale ${propre}…`'),
    ('`Empreinte vérifiée, installation de La Cigale ${propre}…`', '`Checksum verified, installing La Cigale ${propre}…`'),
    ('"L\'installeur est lancé, La Cigale va se fermer."', '"The installer is running, La Cigale will close."'),
    ('"La mise à jour a échoué (téléchargement ou empreinte non vérifiée). Téléchargez-la depuis la page des versions."',
     '"The update failed (download or checksum not verified). Download it from the releases page."'),
    ('"https://check.torproject.org/?lang=fr"', '"https://check.torproject.org/?lang=en"'),
]

PAIRES["outils/rebrander_omni.py"] = [
    ('"-vendor-short-name": "Projet La Cigale",', '"-vendor-short-name": "La Cigale Project",'),
    ('"vendorShortName": "Projet La Cigale",', '"vendorShortName": "La Cigale Project",'),
    ('"trademarkInfo = La Cigale est un logiciel libre dérivé de Mozilla Firefox. "',
     '"trademarkInfo = La Cigale is free software derived from Mozilla Firefox. "'),
    ('"Firefox et les logos Firefox sont des marques déposées de la Mozilla Foundation."',
     '"Firefox and the Firefox logos are trademarks of the Mozilla Foundation."'),
    ('"La Cigale clair", "Papier et encre : le thème clair de La Cigale."', '"La Cigale light", "Paper and ink: La Cigale\'s light theme."'),
    ('"La Cigale olive", "Tableau noir et vert olive : les couleurs du site de La Cigale."', '"La Cigale olive", "Blackboard and olive green: the colors of La Cigale\'s website."'),
    ('"-firefox-home-brand-name": "Page d\'accueil de La Cigale",', '"-firefox-home-brand-name": "La Cigale Home",'),
    ('"-firefoxview-brand-name": "Vue d\'ensemble",', '"-firefoxview-brand-name": "Overview",'),
    ('"-firefoxlabs-brand-name": "Labos",', '"-firefoxlabs-brand-name": "Labs",'),
    ('"-screenshots-brand-name": "Captures d\'écran",', '"-screenshots-brand-name": "Screenshots",'),
    ('"-profiler-brand-name": "Profileur",', '"-profiler-brand-name": "Profiler",'),
    ('"-translations-brand-name": "Traductions",', '"-translations-brand-name": "Translations",'),
]
