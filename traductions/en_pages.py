# Bienvenue, nouveautés, panneau du bouton cigale
FICHIERS["apparence/protection/bienvenue.html"] = "bienvenue.html"
FICHIERS["apparence/protection/nouveautes.html"] = "nouveautes.html"

PAIRES["apparence/protection/bienvenue.js"] = [
    ('["Wikipédia", "https://fr.wikipedia.org", "encyclopédie"]', '["Wikipedia", "https://en.wikipedia.org", "encyclopedia"]'),
    ('["OpenStreetMap", "https://www.openstreetmap.org", "cartes libres"]', '["OpenStreetMap", "https://www.openstreetmap.org", "free maps"]'),
    ('["Seyra", "https://seyra.website", "recherche"]', '["Seyra", "https://seyra.website", "search"]'),
    ('["Météo-France", "https://meteofrance.com", "météo"]', '["Internet Archive", "https://archive.org", "archives"]'),
    ('["France Culture", "https://www.radiofrance.fr/franceculture", "radio"]', '["Project Gutenberg", "https://www.gutenberg.org", "free books"]'),
    ('["Framasoft", "https://framasoft.org", "outils libres"]', '["Wikimedia Commons", "https://commons.wikimedia.org", "free media"]'),
    ('["Proton Mail", "https://mail.proton.me", "messagerie chiffrée"]', '["Proton Mail", "https://mail.proton.me", "encrypted email"]'),
    ('["Le Monde", "https://www.lemonde.fr", "actualités"]', '["BBC News", "https://www.bbc.com/news", "news"]'),
    ('["YouTube", "https://www.youtube.com", "vidéos"]', '["YouTube", "https://www.youtube.com", "videos"]'),
    ('["Leboncoin", "https://www.leboncoin.fr", "petites annonces"]', '["eBay", "https://www.ebay.com", "marketplace"]'),
    ('["Doctolib", "https://www.doctolib.fr", "santé"]', '["Duolingo", "https://www.duolingo.com", "languages"]'),
    ('["Impots.gouv", "https://www.impots.gouv.fr", "impôts"]', '["Stack Overflow", "https://stackoverflow.com", "questions"]'),
    ('["Ameli", "https://www.ameli.fr", "assurance maladie"]', '["MDN", "https://developer.mozilla.org", "web docs"]'),
    ('["Reddit", "https://www.reddit.com", "forums"]', '["Reddit", "https://www.reddit.com", "forums"]'),
    ('["Spotify", "https://open.spotify.com", "musique"]', '["Spotify", "https://open.spotify.com", "music"]'),
    ('"Ouvrir La Cigale" : "Continuer"', '"Open La Cigale" : "Continue"'),
    ('`${choisis.size} raccourci${choisis.size > 1 ? "s" : ""} choisi${choisis.size > 1 ? "s" : ""}`',
     '`${choisis.size} shortcut${choisis.size > 1 ? "s" : ""} chosen`'),
    ('"Avec JavaScript coupé, la plupart des messageries, banques et sites de vidéo ne marcheront plus. Continuer ?"',
     '"With JavaScript off, most email, banking and video sites will stop working. Continue?"'),
]

PAIRES["apparence/protection/nouveautes.js"] = [
    ('"Conversations gardées : activé" : "Garder mes conversations"', '"Conversations kept: on" : "Keep my conversations"'),
]

PAIRES["apparence/protection/popup.html"] = [
    ('title="Changer de profil de protection"', 'title="Change protection profile"'),
    ("<span>traqueurs</span>", "<span>trackers</span>"),
    ("<span>requêtes uBlock</span>", "<span>uBlock requests</span>"),
    ("<span>empreintes</span>", "<span>fingerprints</span>"),
    ("<span>Oublier<br>ce site</span>", "<span>Forget<br>this site</span>"),
    ("<span>Nouvelle<br>identité</span>", "<span>New<br>identity</span>"),
    ("<span>Fenêtre<br>Tor</span>", "<span>Tor<br>window</span>"),
    ("<span>Cette<br>page</span>", "<span>This<br>page</span>"),
    ('title="Copier l\'adresse de cette page sans ses paramètres de pistage"', 'title="Copy this page\'s address without its tracking parameters"'),
    ("<span>Lien<br>propre</span>", "<span>Clean<br>link</span>"),
    ('title="Ouvrir toujours ce site dans son propre coffre : cookies et connexion à part"', 'title="Always open this site in its own vault: separate cookies and login"'),
    ('<span id="coffre-texte">Mettre au<br>coffre</span>', '<span id="coffre-texte">Put in<br>vault</span>'),
    ('title="Tout fermer et tout effacer d\'un coup (Ctrl+Maj+F12)"', 'title="Close and erase everything at once (Ctrl+Shift+F12)"'),
    ('<span id="panique-texte">Panique<small>tout effacer</small></span>', '<span id="panique-texte">Panic<small>erase everything</small></span>'),
    ("<span>Protection et réglages</span>", "<span>Protection and settings</span>"),
]

PAIRES["apparence/protection/popup.js"] = [
    ('const PROFILS = { confort: "Confort", standard: "Standard", renforce: "Renforcé" };',
     'const PROFILS = { confort: "Comfort", standard: "Standard", renforce: "Hardened" };'),
    ('$("profil").textContent = "Profil " + (PROFILS[profil] || "personnalisé").toLowerCase();',
     '$("profil").textContent = (PROFILS[profil] || "Custom") + " profile";'),
    ('etat("neutre", "Page interne");', 'etat("neutre", "Internal page");'),
    ('$("hote").textContent = "Aucun site ouvert";', '$("hote").textContent = "No site open";'),
    ('"Au coffre<br>(sortir)" : "Mettre au<br>coffre"', '"In vault<br>(take out)" : "Put in<br>vault"'),
    ('`Certificat de ${cert.jours} jour${cert.jours > 1 ? "s" : ""}`', '`Certificate ${cert.jours} day${cert.jours > 1 ? "s" : ""} old`'),
    ('" · très récent"', '" · very recent"'),
    ('`${compter(COOKIES_TIERS)} site(s) tiers isolé(s)`', '`${compter(COOKIES_TIERS)} third-party site(s) isolated`'),
    ('etat("risque", "Site sosie");', 'etat("risque", "Lookalike site");'),
    ('`Ressemble à ${sosie} sans être lui : risque d\'hameçonnage.`', '`Looks like ${sosie} without being it: phishing risk.`'),
    ('etat("risque", "Connexion non chiffrée");', 'etat("risque", "Unencrypted connection");'),
    ('etat("", "Connexion chiffrée · protégé");', 'etat("", "Encrypted connection · protected");'),
    ('raisons.push("se fait passer pour " + sosie)', 'raisons.push("poses as " + sosie)'),
    ('retirer(40, "connexion non chiffrée");', 'retirer(40, "unencrypted connection");'),
    ('`${traqueurs} traqueur${traqueurs > 1 ? "s" : ""}`', '`${traqueurs} tracker${traqueurs > 1 ? "s" : ""}`'),
    ('`${empreintes} lecture${empreintes > 1 ? "s" : ""} d\'empreinte`', '`${empreintes} fingerprint read${empreintes > 1 ? "s" : ""}`'),
    ('`${ublock} requête${ublock > 1 ? "s" : ""} bloquée${ublock > 1 ? "s" : ""} par uBlock`', '`${ublock} request${ublock > 1 ? "s" : ""} blocked by uBlock`'),
    ('`${cookies} site${cookies > 1 ? "s" : ""} tiers posant des cookies`', '`${cookies} third-party site${cookies > 1 ? "s" : ""} setting cookies`'),
    ('retirer(15, "certificat de moins d\'une semaine");', 'retirer(15, "certificate less than a week old");'),
    ('`Note ${lettre} : ce que ce site tente sur cette page, vu par La Cigale.\\n`', '`Grade ${lettre}: what this site attempts on this page, as seen by La Cigale.\\n`'),
    ('"En moins : " + raisons.join(", ") + "." : "Rien à signaler : chiffré, sans traqueur ni lecture d\'empreinte."',
     '"Points lost: " + raisons.join(", ") + "." : "Nothing to report: encrypted, no trackers or fingerprint reads."'),
    ('$("panique-texte").innerHTML = "Panique<small>tout effacer</small>";', '$("panique-texte").innerHTML = "Panic<small>erase everything</small>";'),
    ('`Lien copié, ${r.retire} caractères de pistage retirés.` : "Lien copié : il était déjà propre."',
     '`Link copied, ${r.retire} tracking characters removed.` : "Link copied: it was already clean."'),
    ('$("panique-texte").innerHTML = "Confirmer<small>cliquez encore</small>";', '$("panique-texte").innerHTML = "Confirm<small>click again</small>";'),
]
