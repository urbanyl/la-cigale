# Assistant IA local (about:assistant)
HTML += ["apparence/assistant/assistant.html"]

PAIRES["apparence/assistant/assistant.html"] = [
    ('aria-label="Modèle" hidden', 'aria-label="Model" hidden'),
    ('      Réglages</button>', '      Settings</button>'),
    ("<!-- premier lancement : rien n'est téléchargé tant que l'utilisateur ne l'a pas demandé -->", "<!-- first run: nothing is downloaded until the user asks for it -->"),
    ("<h2>Une IA qui reste chez vous</h2>", "<h2>An AI that stays with you</h2>"),
    ("L'assistant fonctionne entièrement sur cet ordinateur. Vos questions, les pages que vous lui montrez et ses réponses ne sont envoyées nulle part : pas de compte, pas de serveur, pas de pistage.",
     "The assistant runs entirely on this computer. Your questions, the pages you show it and its answers are sent nowhere: no account, no server, no tracking."),
    ("<b>Hors ligne</b> une fois installé. Le moteur n'écoute que cet ordinateur, avec une clé changée à chaque démarrage.",
     "<b>Offline</b> once installed. The engine only listens to this computer, with a key that changes at every start."),
    ("<b>Sans filtre.</b> Les modèles proposés sont des versions dont les refus ont été retirés (« abliterated »). Vous restez responsable de ce que vous en faites.",
     "<b>Uncensored.</b> The models offered are versions with their refusals removed (\"abliterated\"). What you do with them is your responsibility."),
    ("<b>Résumé de page, analyse des liens, discussion libre</b>, dans cette page ou depuis le clic droit.",
     "<b>Page summaries, link analysis, open chat</b>, on this page or from the right-click menu."),
    ('aria-label="Modèle"></div>', 'aria-label="Model"></div>'),
    (">Télécharger et activer<", ">Download and enable<"),
    (">Annuler<", ">Cancel<"),
    ("Téléchargement unique : le moteur <b>llama.cpp</b> (environ 39 Mo, depuis github.com) puis le modèle choisi (depuis huggingface.co). Les versions sont fixées et chaque fichier est vérifié par son empreinte SHA-256 avant d'être utilisé. Tout est rangé dans votre profil et peut être supprimé dans les réglages.",
     "One-time download: the <b>llama.cpp</b> engine (about 39 MB, from github.com), then the chosen model (from huggingface.co). Versions are pinned and every file is checked against its SHA-256 fingerprint before use. Everything is stored in your profile and can be removed in the settings."),
    ("</svg>Utiliser une page</button>", "</svg>Use a page</button>"),
    ("</svg>Nouvelle conversation</button>", "</svg>New conversation</button>"),
    ("</svg>Résumer</button>", "</svg>Summarize</button>"),
    ("</svg>Analyser les liens</button>", "</svg>Analyze links</button>"),
    ("</svg>Expliquer la sélection</button>", "</svg>Explain selection</button>"),
    ("Bonjour, je suis La Cigale.", "Hello, I'm La Cigale."),
    ("Posez-moi n'importe quelle question. Je réfléchis sur cet ordinateur, rien ne sort d'ici.", "Ask me anything. I think on this computer, and nothing leaves it."),
    ('data-suggestion="Présente-toi : qui es-tu et que sais-tu faire ?">Qui es-tu ?<', 'data-suggestion="Introduce yourself: who are you and what can you do?">Who are you?<'),
    ("data-suggestion=\"Explique-moi simplement ce qu'est l'empreinte numérique d'un navigateur.\">L'empreinte d'un navigateur<",
     'data-suggestion="Explain simply what browser fingerprinting is.">Browser fingerprinting<'),
    ('data-suggestion="Écris-moi un petit poème sur une cigale qui protège la vie privée.">Un poème de cigale<',
     'data-suggestion="Write me a short poem about a cicada that protects privacy.">A cicada poem<'),
    (">Résumer la page ouverte<", ">Summarize the open page<"),
    ('placeholder="Demandez ce que vous voulez à La Cigale…"', 'placeholder="Ask La Cigale anything…"'),
    ("> Avec le contenu de la page<", "> Include the page content<"),
    (">Arrêter<", ">Stop<"),
    (">Envoyer<", ">Send<"),
    ("Tout est calculé sur cet ordinateur. La conversation n'est pas enregistrée : elle disparaît en fermant l'onglet ou avec le bouton panique. Un modèle peut se tromper : vérifiez ce qui compte.",
     "Everything is computed on this computer. The conversation is not saved: it disappears when you close the tab or press the panic button. A model can be wrong: check what matters."),
    ("<h2>Réglages de l'assistant</h2>", "<h2>Assistant settings</h2>"),
    ("Espace utilisé : <b", "Disk space used: <b"),
    (">Retour à la conversation<", ">Back to the conversation<"),
    (">Tout supprimer<", ">Remove everything<"),
    ("« Tout supprimer » retire le moteur et les modèles de votre profil. L'assistant redevient inactif jusqu'à un nouveau téléchargement.",
     "\"Remove everything\" deletes the engine and the models from your profile. The assistant stays off until you download them again."),
]

PAIRES["apparence/assistant/assistant.sys.mjs"] = [
    ('nom: "Léger"', 'nom: "Light"'),
    ('nom: "Puissant"', 'nom: "Powerful"'),
    ('"Gemma 3 4B, version sans filtre (abliterated)"', '"Gemma 3 4B, uncensored version (abliterated)"'),
    ('"Llama 3.1 8B, version sans filtre (abliterated)"', '"Llama 3.1 8B, uncensored version (abliterated)"'),
    ('"Pour la plupart des ordinateurs, 8 Go de mémoire suffisent."', '"For most computers: 8 GB of memory is enough."'),
    ('"Plus juste, plus lent : 16 Go de mémoire ou une carte graphique recommandés."', '"Sharper but slower: 16 GB of memory or a graphics card recommended."'),
    ('"Conditions d\'utilisation de Gemma"', '"Gemma Terms of Use"'),
    ('"Licence communautaire Llama 3.1"', '"Llama 3.1 Community License"'),
    ('`Téléchargement refusé (${reponse.status})`', '`Download refused (${reponse.status})`'),
    ('"Le fichier reçu ne correspond pas à l\'empreinte attendue : il a été supprimé."', '"The downloaded file does not match the expected fingerprint: it was deleted."'),
    ('"Extraction impossible (tar " + exitCode + ")"', '"Could not extract (tar " + exitCode + ")"'),
    ('"Assistant indisponible sur ce système."', '"The assistant is not available on this system."'),
    ('"Un téléchargement est déjà en cours."', '"A download is already in progress."'),
    ('"Le moteur n\'a pas été trouvé dans l\'archive."', '"The engine was not found in the archive."'),
    ('"L\'assistant n\'est pas encore installé."', '"The assistant is not installed yet."'),
    ('"Le moteur s\'est arrêté au démarrage (mémoire insuffisante ?)."', '"The engine stopped while starting (not enough memory?)."'),
    ('"Le moteur ne répond pas."', '"The engine is not responding."'),
    ('"Le texte est trop long pour le modèle."', '"The text is too long for the model."'),
    ('"Le moteur a refusé la demande. "', '"The engine refused the request. "'),
    ('"Cette page ne peut pas être lue (page interne ou pas encore chargée)."', '"This page cannot be read (internal page or not loaded yet)."'),
    ('"lien non chiffré (http)"', '"unencrypted link (http)"'),
    ('"adresse IP au lieu d\'un nom de site"', '"IP address instead of a site name"'),
    ('"nom de domaine en caractères spéciaux (punycode) : peut imiter un autre site"', '"domain name in special characters (punycode): may imitate another site"'),
    ('"lien raccourci : la vraie destination est cachée"', '"shortened link: the real destination is hidden"'),
    ('"domaine connu pour la publicité ou le pistage"', '"domain known for advertising or tracking"'),
    ('"passe par une redirection qui enregistre le clic"', '"goes through a redirect that records the click"'),
    ('"paramètres de pistage : "', '"tracking parameters: "'),
    ('`le texte affiche « ${domaineTexte} » mais le lien mène à ${hote}`', '`the text shows "${domaineTexte}" but the link goes to ${hote}`'),
]

PAIRES["apparence/assistant/assistant.js"] = [
    ('"Tu es La Cigale : une cigale, l\'assistante du navigateur La Cigale. Tu le sais et tu l\'assumes avec un brin d\'humour " +\n'
     '  "(le chant, l\'été, la fourmi de La Fontaine), sans en faire trop. Tu fonctionnes entièrement sur l\'ordinateur de l\'utilisateur : " +\n'
     '  "rien de ce qu\'il écrit ne quitte sa machine. Réponds dans la langue de l\'utilisateur (le français par défaut), " +\n'
     '  "directement et franchement, sans sermon ni avertissement inutile. Mets en forme avec du Markdown simple : " +\n',
     '"You are La Cigale: a cicada, the assistant of the La Cigale web browser. You know it and own it with a touch of humor " +\n'
     '  "(singing, summer, the ant from the fable), without overdoing it. You run entirely on the user\'s computer: " +\n'
     '  "nothing they write leaves their machine. Answer in the user\'s language (English by default), " +\n'
     '  "directly and frankly, without lecturing or needless warnings. Format with simple Markdown: " +\n'),
    ('(n / 1e9).toFixed(1).replace(".", ",") + " Go" : Math.max(1, Math.round(n / 1e6)) + " Mo"', '(n / 1e9).toFixed(1) + " GB" : Math.max(1, Math.round(n / 1e6)) + " MB"'),
    ('"Téléchargement" : e.demarrage ? "Démarrage du moteur…"', '"Downloading" : e.demarrage ? "Starting the engine…"'),
    ('"Local · en marche" : pret ? "Local · en veille"', '"Local · running" : pret ? "Local · idle"'),
    ('"L\'assistant n\'est disponible que sur Windows et Linux 64 bits."', '"The assistant is only available on 64-bit Windows and Linux."'),
    ('"Installation du moteur…"', '"Installing the engine…"'),
    ('`${t.etape == "moteur" ? "Moteur llama.cpp" : "Modèle"} : ${octets(t.recu)} sur ${octets(t.total)} (${Math.floor(part * 100)} %)`',
     '`${t.etape == "moteur" ? "llama.cpp engine" : "Model"}: ${octets(t.recu)} of ${octets(t.total)} (${Math.floor(part * 100)}%)`'),
    ('"Licence : " + m.licence', '"License: " + m.licence'),
    ('"Déjà téléchargé"', '"Already downloaded"'),
    ('"À télécharger : " + octets(reste) : "Déjà sur cet ordinateur"', '"To download: " + octets(reste) : "Already on this computer"'),
    ('" · utilisé"', '" · in use"'),
    ('"Utiliser"', '"Use"'),
    ('suppr.textContent = "Supprimer"', 'suppr.textContent = "Delete"'),
    ('"Télécharger (" + octets(m.taille) + ")"', '"Download (" + octets(m.taille) + ")"'),
    ('"Téléchargement annulé." : "Échec : "', '"Download cancelled." : "Failed: "'),
    ('"Aucune page web ouverte"', '"No web page open"'),
    ('"Choisissez d\'abord une page web ouverte."', '"First choose an open web page."'),
    ('`Titre : ${page.titre}\\nAdresse : ${page.adresse}\\n\\nContenu de la page${coupe ? " (début seulement, la page est longue)" : ""} :',
     '`Title: ${page.titre}\\nAddress: ${page.adresse}\\n\\nPage content${coupe ? " (beginning only, the page is long)" : ""}:'),
    ('lecture: ["La Cigale lit la page…", "La Cigale parcourt le texte…", "La Cigale repère l\'essentiel…", "La Cigale souligne les passages importants…"]',
     'lecture: ["La Cigale is reading the page…", "La Cigale is skimming the text…", "La Cigale is spotting what matters…", "La Cigale is underlining the key parts…"]'),
    ('pensee: ["La Cigale réfléchit…", "La Cigale rassemble ses idées…", "La Cigale cherche les bons mots…", "La Cigale pèse le pour et le contre…", "La Cigale fredonne en réfléchissant…"]',
     'pensee: ["La Cigale is thinking…", "La Cigale is gathering her thoughts…", "La Cigale is looking for the right words…", "La Cigale is weighing it up…", "La Cigale is humming while she thinks…"]'),
    ('ecriture: ["La Cigale écrit…"]', 'ecriture: ["La Cigale is writing…"]'),
    ('"Réveil du moteur local"', '"Waking up the local engine"'),
    ('`Modèle : ${A.nomModele(etatCourant.modele)}, sur cet ordinateur`', '`Model: ${A.nomModele(etatCourant.modele)}, on this computer`'),
    ('`Lecture du texte : ${fait} sur ${p.total} jetons` + (p.cache ? ` (dont ${p.cache} déjà lus)` : "")',
     '`Reading the text: ${fait} of ${p.total} tokens` + (p.cache ? ` (${p.cache} already read)` : "")'),
    ('`Rédaction de la réponse (après ${secondes()} s)`', '`Writing the answer (after ${secondes()} s)`'),
    ('`Arrêté après ${secondes()} s` : `Terminé en ${secondes()} s · ${mots} mots`', '`Stopped after ${secondes()} s` : `Done in ${secondes()} s · ${mots} words`'),
    ('"Réflexion arrêtée" : "Réflexion de La Cigale"', '"Thinking stopped" : "La Cigale\'s thinking"'),
    ('`Page lue : « ${page.titre || page.adresse} »`', '`Page read: "${page.titre || page.adresse}"`'),
    ('`Texte retenu : ${Math.min(page.texte.length, LIMITE_PAGE)} caractères` + (coupe ? ` sur ${page.texte.length} (début de la page)` : "")',
     '`Text kept: ${Math.min(page.texte.length, LIMITE_PAGE)} characters` + (coupe ? ` of ${page.texte.length} (start of the page)` : "")'),
    ('`Passage sélectionné : ${page.selection.length} caractères`', '`Selected passage: ${page.selection.length} characters`'),
    ('`Liens lus sur la page : ${a.total}`, `Règles locales appliquées : ${a.alertes.length} lien(s) à surveiller`',
     '`Links read on the page: ${a.total}`, `Local rules applied: ${a.alertes.length} link(s) to watch`'),
    ('"Réglage pour cet ordinateur (processeur ou carte graphique, une minute environ)…"', '"Tuning for this computer (processor or graphics card, about a minute)…"'),
    ('copier.textContent = "Copier";', 'copier.textContent = "Copy";'),
    ('copier.textContent = "Copié";', 'copier.textContent = "Copied";'),
    ('(copier.textContent = "Copier")', '(copier.textContent = "Copy")'),
    ('"Avec la page : "', '"With the page: "'),
    ('"Cette page ne contient presque pas de texte à résumer."', '"This page has almost no text to summarize."'),
    ('bulleUtilisateur("Résume cette page.",', 'bulleUtilisateur("Summarize this page.",'),
    ('`Résume cette page. Commence par l\'essentiel en deux phrases, puis les points clés en liste. Termine par ce qui manque ou paraît douteux, s\'il y a lieu.',
     '`Summarize this page. Start with the gist in two sentences, then the key points as a list. End with anything missing or dubious, if relevant.'),
    ('"Sélectionnez d\'abord un passage dans la page, puis recommencez."', '"First select a passage in the page, then try again."'),
    ('bulleUtilisateur("Explique ce passage.", `« ${page.selection.slice(0, 160)}${page.selection.length > 160 ? "…" : ""} »`)',
     'bulleUtilisateur("Explain this passage.", `"${page.selection.slice(0, 160)}${page.selection.length > 160 ? "…" : ""}"`)'),
    ('`Explique simplement ce passage, tiré de la page « ${page.titre} » (${page.adresse}) :', '`Explain this passage simply. It comes from the page "${page.titre}" (${page.adresse}):'),
    ('"Liens de « " + (page.titre || page.adresse) + " »"', '"Links on \\"" + (page.titre || page.adresse) + "\\""'),
    ('[[a.total, "liens"], [a.domaines.length, "sites différents"], [a.total - a.internes, "vers d\'autres sites"], [a.alertes.length, "à surveiller"]]',
     '[[a.total, "links"], [a.domaines.length, "different sites"], [a.total - a.internes, "to other sites"], [a.alertes.length, "to watch"]]'),
    ('"Aucun lien suspect selon les règles locales (raccourcisseurs, pistage, redirections, http, punycode, texte trompeur)."',
     '"No suspicious link according to the local rules (shorteners, tracking, redirects, http, punycode, misleading text)."'),
    ('"Tous les sites liés"', '"All linked sites"'),
    ('" (ce site)"', '" (this site)"'),
    ('", ce site"', '", this site"'),
    ('bulleUtilisateur("Analyse les liens de cette page.",', 'bulleUtilisateur("Analyze the links on this page.",'),
    ('"Voici l\'analyse automatique des liens d\'une page web (faite localement par La Cigale). " +\n'
     '    "Explique en quelques points ce qu\'il faut en retenir : qui la page relie, quels liens éviter ou nettoyer et pourquoi. " +\n'
     '    "N\'invente pas de liens qui ne sont pas dans la liste.\\n\\n"',
     '"Here is the automatic analysis of the links of a web page (done locally by La Cigale). " +\n'
     '    "Explain in a few points what to take away: which sites the page connects to, which links to avoid or clean, and why. " +\n'
     '    "Do not invent links that are not in the list.\\n\\n"'),
    ('"Supprimer le moteur et tous les modèles téléchargés ?"', '"Delete the engine and all downloaded models?"'),
]

PAIRES["apparence/outils/outils.sys.mjs"] += [
    ('["Assistant IA local", ""', '["Local AI assistant", ""'),
    ('["Assistant : résumer cette page", ""', '["Assistant: summarize this page", ""'),
    ('["Assistant : analyser les liens de la page", ""', '["Assistant: analyze the links on this page", ""'),
    ('ia.setAttribute("label", "Demander à La Cigale");', 'ia.setAttribute("label", "Ask La Cigale");'),
    ('iaOuvrir.setAttribute("label", "Ouvrir l\'assistant");', 'iaOuvrir.setAttribute("label", "Open the assistant");'),
    ('entree("Résumer l\'onglet", "resumer");', 'entree("Summarize the tab", "resumer");'),
    ('entree("Analyser les liens", "liens");', 'entree("Analyze the links", "liens");'),
    ('entree("Ouvrir l\'assistant", "ouvrir");', 'entree("Open the assistant", "ouvrir");'),
    ('iaEntree("Résumer cette page", "resumer"', 'iaEntree("Summarize this page", "resumer"'),
    ('iaEntree("Analyser les liens", "liens"', 'iaEntree("Analyze the links", "liens"'),
    ('iaEntree("Expliquer la sélection", "selection"', 'iaEntree("Explain the selection", "selection"'),
]

PAIRES["apparence/assistant/assistant.html"] += [
    ("Ce que La Cigale sait de vous</h3>", "What La Cigale knows about you</h3>"),
    ("Rien de tout cela ne quitte cet ordinateur : ces informations sont seulement données au modèle local, à chaque question. La date et l'heure lui sont toujours données.",
     "None of this leaves this computer: it is only given to the local model, with each question. The date and time are always given."),
    (">À propos de vous<", ">About you<"),
    ('placeholder="Par exemple : je m\'appelle Alex, tutoie-moi, j\'habite à Lyon, je suis développeur."',
     'placeholder="For example: my name is Alex, keep it casual, I live in Lyon, I am a developer."'),
    ("> Les onglets ouverts (titres et adresses)<", "> Open tabs (titles and addresses)<"),
    ("> Mes notes<", "> My notes<"),
    ("> Mes favoris récents<", "> My recent bookmarks<"),
    ("> Mon historique récent (20 dernières pages)<", "> My recent history (last 20 pages)<"),
    (">Modèles</h3>", ">Models</h3>"),
    (">Me présenter à La Cigale<", ">Introduce myself to La Cigale<"),
]

PAIRES["apparence/assistant/assistant.js"] += [
    ('''"titres courts (###), listes, **gras**. Quand on te fournit le contenu d\'une page, appuie-toi dessus et dis-le si l\'information n\'y est pas. " +
  "Réponds avec des phrases complètes et utiles, jamais par un seul mot. Le navigateur te donne ci-dessous la date, l\'heure et ce que " +
  "l'utilisateur a choisi de partager : sers-t\'en. Si une information n\'y est pas (actualité, météo, ce que tu ne sais pas), " +
  "dis-le franchement au lieu de l\'inventer.";''',
     '''"short headings (###), lists, **bold**. When given the content of a page, rely on it and say so if the information is not there. " +
  "Answer with full, useful sentences, never a single word. Below, the browser gives you the date, the time and what " +
  "the user chose to share: use it. If something is not there (news, weather, anything you do not know), " +
  "say so frankly instead of making it up.";'''),
    ('"\\n\\nContexte fourni par le navigateur (à jour) :\\n"', '"\\n\\nContext provided by the browser (up to date):\\n"'),
]

PAIRES["apparence/assistant/assistant.sys.mjs"] += [
    ('"Date et heure actuelles : "', '"Current date and time: "'),
    ('" (fuseau "', '" (time zone "'),
    ('", basé sur Firefox "', '", based on Firefox "'),
    ('", sur " + (WINDOWS', '", on " + (WINDOWS'),
    ('"Langue du navigateur : "', '"Browser language: "'),
    ('"Ce que l\'utilisateur a écrit sur lui-même : "', '"What the user wrote about themselves: "'),
    ('"Onglets ouverts :\\n"', '"Open tabs:\\n"'),
    ('"Notes de l\'utilisateur (extrait) :\\n"', '"User notes (excerpt):\\n"'),
    ('"Favoris récents :\\n"', '"Recent bookmarks:\\n"'),
    ('"Pages visitées récemment :\\n"', '"Recently visited pages:\\n"'),
]

PAIRES["accueil/index.html"] += [
    ("        Assistant IA</a>", "        AI assistant</a>"),
]
