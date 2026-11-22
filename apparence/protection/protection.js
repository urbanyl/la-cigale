"use strict";

const $ = (id) => document.getElementById(id);
const prefs = Services.prefs;
const cigale = ChromeUtils.importESModule("chrome://browser/content/cigale/cigale.sys.mjs");
const fenetre = window.browsingContext.topChromeWindow;

// Les profils ne touchent qu'à des defaultPref : ce qui est verrouillé dans
// cigale.cfg (télémétrie, WebRTC, HTTPS...) ne bouge pas.
const PROFILS = {
  confort: {
    "javascript.enabled": true,
    "privacy.resistFingerprinting.letterboxing": false,
    "privacy.spoof_english": 1,
    "privacy.clearOnShutdown_v2.cookiesAndStorage": false,
  },
  standard: {
    "javascript.enabled": true,
    "privacy.resistFingerprinting.letterboxing": false,
    "privacy.spoof_english": 2,
    "privacy.clearOnShutdown_v2.cookiesAndStorage": true,
  },
  renforce: {
    "javascript.enabled": false,
    "privacy.resistFingerprinting.letterboxing": true,
    "privacy.spoof_english": 2,
    "privacy.clearOnShutdown_v2.cookiesAndStorage": true,
  },
};

function lire(nom) {
  switch (prefs.getPrefType(nom)) {
    case prefs.PREF_BOOL: return prefs.getBoolPref(nom);
    case prefs.PREF_INT: return prefs.getIntPref(nom);
    case prefs.PREF_STRING: return prefs.getStringPref(nom);
  }
  return undefined;
}

function ecrire(nom, val) {
  if (prefs.prefIsLocked(nom)) return;
  if (typeof val == "boolean") prefs.setBoolPref(nom, val);
  else if (typeof val == "number") prefs.setIntPref(nom, val);
  else prefs.setStringPref(nom, val);
}

function profilActuel() {
  for (const [nom, reglages] of Object.entries(PROFILS)) {
    if (Object.entries(reglages).every(([p, v]) => lire(p) === v)) return nom;
  }
  return null;
}

$("profils").addEventListener("change", (e) => {
  const nom = e.target.value;
  if (nom == "renforce" && !confirm("Avec JavaScript coupé, la plupart des messageries, banques et sites de vidéo ne marcheront plus. Continuer ?")) {
    afficher();
    return;
  }
  for (const [p, v] of Object.entries(PROFILS[nom])) ecrire(p, v);
  prefs.setStringPref("cigale.profil", nom);
  afficher();
});

async function extensionActive(id) {
  try {
    const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    const addon = await AddonManager.getAddonByID(id);
    return !!(addon && addon.isActive);
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function afficher() {
  const ublock = await extensionActive("uBlock0@raymondhill.net");
  const conteneurs = await extensionActive("@testpilot-containers");
  const js = lire("javascript.enabled");
  const anglais = lire("privacy.spoof_english") == 2;
  const marges = lire("privacy.resistFingerprinting.letterboxing");
  const garderCookies = lire("privacy.clearOnShutdown_v2.cookiesAndStorage") === false;

  // [libellé, actif, détail]
  const lignes = [
    ["Bloqueur uBlock Origin", ublock, ublock ? "pubs et traqueurs" : "désactivé"],
    ["Anti-empreinte", lire("privacy.resistFingerprinting"), "comme Tor Browser"],
    ["HTTPS obligatoire", lire("dom.security.https_only_mode"), ""],
    ["DNS chiffré", lire("network.trr.mode") == 3, "Quad9"],
    ["WebRTC coupé", lire("media.peerconnection.enabled") === false, "pas de fuite d'IP"],
    ["Télémétrie coupée", lire("toolkit.telemetry.enabled") === false && lire("datareporting.healthreport.uploadEnabled") === false, ""],
    ["Effacement à la fermeture", lire("privacy.sanitize.sanitizeOnShutdown"), garderCookies ? "sauf les cookies" : "tout"],
    ["Liens nettoyés", lire("privacy.query_stripping.enabled"), "utm, fbclid, gclid…"],
    ["Conteneurs", conteneurs, conteneurs ? "Multi-Account Containers" : "extension absente"],
    ["Langue cachée", anglais, anglais ? "les sites voient de l'anglais" : "les sites voient du français"],
    ["Marges autour des pages", marges, ""],
    ["JavaScript coupé", js === false, ""],
  ];

  $("etats").replaceChildren(...lignes.map(([nom, actif, detail]) => {
    const tr = document.createElement("tr");
    tr.className = actif ? "oui" : "non";
    const a = document.createElement("td");
    a.textContent = nom;
    const b = document.createElement("td");
    b.textContent = detail || (actif ? "oui" : "non");
    tr.append(a, b);
    return tr;
  }));

  // les 7 premières lignes doivent être actives quel que soit le profil
  const manquantes = lignes.slice(0, 7).filter((l) => !l[1]).length;
  $("resume").textContent = manquantes
    ? `Attention, ${manquantes} protection${manquantes > 1 ? "s" : ""} de base ${manquantes > 1 ? "sont désactivées" : "est désactivée"}.`
    : "Toutes les protections de base sont en place.";

  const actuel = profilActuel();
  for (const radio of document.querySelectorAll("[name=profil]")) radio.checked = radio.value == actuel;
  $("note-profil").hidden = !!actuel;

  afficherExceptions();
  afficherMaj();
  afficherVerrou();
}

function afficherExceptions() {
  const liste = $("exceptions");
  const perms = Services.perms.getAllByTypes(["cookie"])
    .filter((p) => p.capability == Services.perms.ALLOW_ACTION && p.principal.origin.startsWith("http"))
    .sort((a, b) => a.principal.origin.localeCompare(b.principal.origin));

  if (!perms.length) {
    liste.innerHTML = '<li class="vide">Aucun pour le moment.</li>';
    return;
  }
  liste.replaceChildren(...perms.map((p) => {
    const li = document.createElement("li");
    const site = p.principal.origin.replace(/^https?:\/\//, "");
    const bouton = document.createElement("button");
    bouton.textContent = "Retirer";
    bouton.title = "Retirer " + site;
    bouton.onclick = () => {
      Services.perms.removeFromPrincipal(p.principal, "cookie");
      afficherExceptions();
    };
    li.append(site, bouton);
    return li;
  }));
}

$("ajout-exception").addEventListener("submit", (e) => {
  e.preventDefault();
  const erreur = $("erreur-exception");
  let url;
  try {
    let saisie = $("exception").value.trim();
    if (!/^https?:\/\//i.test(saisie)) saisie = "https://" + saisie;
    url = new URL(saisie);
    if (!url.hostname.includes(".")) throw new Error();
  } catch {
    erreur.textContent = "Ce n'est pas une adresse valide (exemple : laposte.fr).";
    erreur.hidden = false;
    return;
  }
  // on ajoute aussi la variante avec ou sans www
  const hote = url.hostname.replace(/^www\./, "");
  for (const h of [hote, "www." + hote]) {
    const principal = Services.scriptSecurityManager.createContentPrincipalFromOrigin(url.protocol + "//" + h);
    Services.perms.addFromPrincipal(principal, "cookie", Services.perms.ALLOW_ACTION);
  }
  erreur.hidden = true;
  e.target.reset();
  afficherExceptions();
});

function afficherMaj() {
  $("maj-verifier").checked = prefs.getBoolPref("cigale.maj.verifier", true);

  const version = prefs.getStringPref("cigale.version", "");
  const dispo = prefs.getStringPref("cigale.maj.disponible", "").replace(/^v/, "");
  const derniere = prefs.getIntPref("cigale.maj.derniere", 0);

  let texte = version ? `Vous utilisez La Cigale ${version}.` : "";
  if (version && dispo && Services.vc.compare(dispo, version) > 0) texte += ` La version ${dispo} est sortie.`;
  if (derniere) {
    const quand = new Date(derniere * 1000).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
    texte += ` Dernière vérification le ${quand}.`;
  }
  $("maj-etat").textContent = texte.trim();
}

$("maj-verifier").addEventListener("change", (e) => prefs.setBoolPref("cigale.maj.verifier", e.target.checked));

// --- Cette page ---

const WPL = Ci.nsIWebProgressListener;
// [libellé, drapeaux, compter même si non « bloqué » (isolement des cookies)]
const CATEGORIES = [
  ["Traqueurs", WPL.STATE_BLOCKED_TRACKING_CONTENT, false],
  ["Traqueurs de réseaux sociaux", WPL.STATE_BLOCKED_SOCIALTRACKING_CONTENT, false],
  ["Détecteurs d'empreinte", WPL.STATE_BLOCKED_FINGERPRINTING_CONTENT, false],
  ["Mineurs de cryptomonnaie", WPL.STATE_BLOCKED_CRYPTOMINING_CONTENT, false],
  ["Cookies de pistage refusés", WPL.STATE_COOKIES_BLOCKED_TRACKER | (WPL.STATE_COOKIES_BLOCKED_SOCIALTRACKER || 0), false],
  ["Cookies tiers isolés", WPL.STATE_COOKIES_PARTITIONED_FOREIGN || 0, true],
];

function ongletsExaminables() {
  return [...fenetre.gBrowser.tabs].filter((o) => /^https?$/.test(o.linkedBrowser.currentURI.scheme));
}

function remplirOnglets() {
  const choix = $("rapport-onglet");
  const avant = choix.value;
  const onglets = ongletsExaminables();
  choix.replaceChildren(...onglets.map((o, i) => {
    const option = document.createElement("option");
    option.value = i;
    const hote = o.linkedBrowser.currentURI.host;
    const titre = o.label.length > 50 ? o.label.slice(0, 49) + "…" : o.label;
    option.textContent = `${hote} — ${titre}`;
    option.onglet = o;
    return option;
  }));
  const source = fenetre.cigaleOngletSource;
  const i = onglets.indexOf(source);
  if (i >= 0 && avant === "") choix.value = i;
  else if (avant !== "" && avant < onglets.length) choix.value = avant;
  return onglets.length > 0;
}

function ongletChoisi() {
  const option = $("rapport-onglet").selectedOptions[0];
  return option && option.onglet;
}

async function badgeUblock(onglet) {
  try {
    const { ExtensionParent } = ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");
    const extension = WebExtensionPolicy.getByID("uBlock0@raymondhill.net")?.extension;
    const action = ExtensionParent.apiManager.global.browserActionFor?.(extension);
    return action?.action?.getContextData(onglet)?.badgeText || "";
  } catch (e) {
    return "";
  }
}

async function afficherRapport() {
  const corps = $("rapport");
  const ligne = (a, b, classe) => {
    const tr = document.createElement("tr");
    if (classe) tr.className = classe;
    const x = document.createElement("td");
    x.textContent = a;
    const y = document.createElement("td");
    y.textContent = b;
    tr.append(x, y);
    return tr;
  };
  if (!remplirOnglets()) {
    corps.replaceChildren(ligne("Aucun site ouvert dans cette fenêtre.", ""));
    $("rapport-details").hidden = true;
    $("rapport-oublier").hidden = true;
    return;
  }
  $("rapport-oublier").hidden = false;
  const onglet = ongletChoisi();
  const navigateur = onglet.linkedBrowser;
  const lignes = [];

  const sur = (navigateur.securityUI?.state || 0) & WPL.STATE_IS_SECURE;
  lignes.push(ligne("Connexion", sur ? "chiffrée (HTTPS)" : "non chiffrée", sur ? "oui" : "non"));

  let journal = {};
  try {
    journal = JSON.parse(await navigateur.getContentBlockingLog());
  } catch (e) {
    console.error(e);
  }
  const bloquees = [];
  for (const [libelle, drapeaux, toujours] of CATEGORIES) {
    if (!drapeaux) continue;
    const origines = Object.entries(journal)
      .filter(([, evenements]) => evenements.some(([etat, bloque]) => (etat & drapeaux) && (bloque || toujours)))
      .map(([origine]) => origine);
    if (!toujours) bloquees.push(...origines);
    lignes.push(ligne(libelle, origines.length ? `${origines.length} site${origines.length > 1 ? "s" : ""}` : "aucun",
      origines.length ? "oui" : "non"));
  }
  const badge = await badgeUblock(onglet);
  if (badge) lignes.push(ligne("Bloqué par uBlock Origin", `${badge} requête${badge == "1" ? "" : "s"}`, "oui"));
  corps.replaceChildren(...lignes);

  const uniques = [...new Set(bloquees)].sort();
  $("rapport-details").hidden = !uniques.length;
  $("rapport-liste").replaceChildren(...uniques.map((o) => {
    const li = document.createElement("li");
    li.textContent = o.replace(/^https?:\/\//, "");
    return li;
  }));
}

$("rapport-onglet").addEventListener("change", afficherRapport);
$("rapport-actualiser").addEventListener("click", afficherRapport);
$("rapport-oublier").addEventListener("click", async () => {
  const onglet = ongletChoisi();
  if (!onglet) return;
  const ici = fenetre.gBrowser.selectedTab;
  fenetre.gBrowser.selectedTab = onglet;
  await cigale.oublierSite(fenetre).catch(console.error);
  if (ici.isConnected) fenetre.gBrowser.selectedTab = ici;
  fenetre.cigaleOngletSource = null;
  afficherRapport();
});

// --- Fenêtre Tor ---

async function afficherTor() {
  const etat = $("tor-etat");
  if (cigale.estFenetreTor()) {
    etat.textContent = "Vous êtes dans une fenêtre Tor.";
    return;
  }
  etat.textContent = "Recherche de Tor…";
  const port = await cigale.portTor();
  etat.textContent = port ? `Tor est prêt (port ${port}).` : "Tor n'est pas lancé sur cet ordinateur.";
}

$("tor-ouvrir").addEventListener("click", async () => {
  await cigale.ouvrirFenetreTor(fenetre).catch(console.error);
  afficherTor();
});

// --- Mots-clés de recherche ---

async function afficherMotsCles() {
  // Firefox 153 n'expose plus Services.search : le service est un module
  let recherche = Services.search;
  if (!recherche) {
    ({ SearchService: recherche } = ChromeUtils.importESModule("moz-src:///toolkit/components/search/SearchService.sys.mjs"));
  }
  await recherche.init();
  const moteurs = await recherche.getVisibleEngines();
  const lignes = moteurs
    .map((m) => [m.alias || (m.aliases || [])[0] || "", m.name])
    .filter(([mot]) => mot)
    .sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]));
  $("mots-cles").replaceChildren(...lignes.map(([mot, nom]) => {
    const tr = document.createElement("tr");
    const a = document.createElement("td");
    const kbd = document.createElement("kbd");
    kbd.textContent = mot;
    a.append(kbd);
    const b = document.createElement("td");
    b.textContent = nom;
    tr.append(a, b);
    return tr;
  }));
}

// --- Sauvegarde chiffrée ---

const STOCKAGE_ACCUEIL = ["cigale.moteur", "cigale.raccourcis", "cigale.reglages"];

function stockageAccueil() {
  const adresse = prefs.getStringPref("browser.startup.homepage", "").split("|")[0];
  if (!adresse.startsWith("file:")) return null;
  const principal = Services.scriptSecurityManager.createContentPrincipal(Services.io.newURI(adresse), {});
  // sans fenêtre, le localStorage de Firefox refuse d'ouvrir la base
  return Services.domStorageManager.createStorage(window, principal, principal, adresse);
}

function versBase64(octets) {
  let texte = "";
  for (let i = 0; i < octets.length; i += 0x8000) texte += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(texte);
}

function depuisBase64(texte) {
  return Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));
}

async function cleDe(motDePasse, sel, iterations) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(motDePasse), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sel, iterations, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

const REGLAGES_SAUVES = [...new Set(Object.values(PROFILS).flatMap(Object.keys))].concat(["cigale.profil", "cigale.maj.verifier"]);

async function rassembler() {
  const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
  const contenu = {
    marquePages: await PlacesUtils.promiseBookmarksTree(""),
    accueil: {},
    exceptions: Services.perms.getAllByTypes(["cookie"])
      .filter((p) => p.capability == Services.perms.ALLOW_ACTION && p.principal.origin.startsWith("http"))
      .map((p) => p.principal.origin),
    reglages: {},
  };
  try {
    const stockage = stockageAccueil();
    for (const cle of STOCKAGE_ACCUEIL) {
      const valeur = stockage?.getItem(cle);
      if (valeur != null) contenu.accueil[cle] = valeur;
    }
  } catch (e) {
    console.error(e);
  }
  for (const nom of REGLAGES_SAUVES) {
    if (prefs.prefHasUserValue(nom)) contenu.reglages[nom] = lire(nom);
  }
  return contenu;
}

async function restaurer(contenu) {
  const { BookmarkJSONUtils } = ChromeUtils.importESModule("resource://gre/modules/BookmarkJSONUtils.sys.mjs");
  if (contenu.marquePages) {
    // importFromURL n'accepte que file: et chrome:, on passe par un fichier temporaire
    const temporaire = PathUtils.join(PathUtils.tempDir, `la-cigale-marques-${Date.now()}.json`);
    await IOUtils.writeUTF8(temporaire, JSON.stringify(contenu.marquePages));
    try {
      await BookmarkJSONUtils.importFromFile(temporaire, { replace: true });
    } finally {
      await IOUtils.remove(temporaire, { ignoreAbsent: true });
    }
  }
  try {
    const stockage = stockageAccueil();
    for (const [cle, valeur] of Object.entries(contenu.accueil || {})) {
      if (STOCKAGE_ACCUEIL.includes(cle)) stockage?.setItem(cle, valeur);
    }
  } catch (e) {
    console.error(e);
  }
  for (const origine of contenu.exceptions || []) {
    if (!/^https?:\/\/[^/]+$/.test(origine)) continue;
    const principal = Services.scriptSecurityManager.createContentPrincipalFromOrigin(origine);
    Services.perms.addFromPrincipal(principal, "cookie", Services.perms.ALLOW_ACTION);
  }
  for (const [nom, valeur] of Object.entries(contenu.reglages || {})) {
    if (REGLAGES_SAUVES.includes(nom) && ["boolean", "number", "string"].includes(typeof valeur)) ecrire(nom, valeur);
  }
}

function choisirFichier(enregistrer) {
  return new Promise((resolve) => {
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window.browsingContext, enregistrer ? "Enregistrer la sauvegarde" : "Restaurer une sauvegarde",
      enregistrer ? Ci.nsIFilePicker.modeSave : Ci.nsIFilePicker.modeOpen);
    fp.appendFilter("Sauvegarde La Cigale", "*.cigale");
    fp.appendFilters(Ci.nsIFilePicker.filterAll);
    if (enregistrer) {
      fp.defaultString = `la-cigale-${new Date().toISOString().slice(0, 10)}.cigale`;
      fp.defaultExtension = "cigale";
    }
    fp.open((resultat) => resolve(resultat == Ci.nsIFilePicker.returnCancel ? null : fp.file.path));
  });
}

$("sauvegarde").addEventListener("submit", async (e) => {
  e.preventDefault();
  const etat = $("sauvegarde-etat");
  const motDePasse = $("sauvegarde-mdp").value;
  const exporter = e.submitter?.value != "importer";
  try {
    if (exporter) {
      const chemin = await choisirFichier(true);
      if (!chemin) return;
      etat.textContent = "Chiffrement…";
      const sel = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const iterations = 600000;
      const clair = new TextEncoder().encode(JSON.stringify(await rassembler()));
      const chiffre = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cleDe(motDePasse, sel, iterations), clair);
      await IOUtils.writeUTF8(chemin, JSON.stringify({
        format: "la-cigale-sauvegarde", version: 1, iterations,
        sel: versBase64(sel), iv: versBase64(iv), donnees: versBase64(new Uint8Array(chiffre)),
      }));
      etat.textContent = `Sauvegarde enregistrée : ${PathUtils.filename(chemin)}.`;
    } else {
      const chemin = await choisirFichier(false);
      if (!chemin) return;
      const fichier = JSON.parse(await IOUtils.readUTF8(chemin));
      if (fichier.format != "la-cigale-sauvegarde") throw new Error("Ce fichier n'est pas une sauvegarde La Cigale.");
      etat.textContent = "Déchiffrement…";
      let contenu;
      try {
        const cle = await cleDe(motDePasse, depuisBase64(fichier.sel), fichier.iterations || 600000);
        const clair = await crypto.subtle.decrypt({ name: "AES-GCM", iv: depuisBase64(fichier.iv) }, cle, depuisBase64(fichier.donnees));
        contenu = JSON.parse(new TextDecoder().decode(clair));
      } catch {
        throw new Error("Mot de passe incorrect, ou fichier abîmé.");
      }
      if (!confirm("Remplacer vos marque-pages actuels par ceux de la sauvegarde ? Les raccourcis, les sites où rester connecté et le profil seront aussi repris.")) {
        etat.textContent = "";
        return;
      }
      await restaurer(contenu);
      etat.textContent = "Sauvegarde restaurée. Rechargez la page d'accueil pour voir vos raccourcis.";
      afficher();
    }
    $("sauvegarde-mdp").value = "";
  } catch (erreur) {
    console.error(erreur);
    etat.textContent = erreur.message || String(erreur);
  }
});

// --- Verrou au démarrage ---

function afficherVerrou() {
  const actif = cigale.verrouActif();
  $("verrou-actuel").hidden = !actif;
  $("verrou-retirer").hidden = !actif;
  $("verrou-valider").textContent = actif ? "Changer le mot de passe" : "Activer";
  $("verrou-nouveau").required = !actif;
  if (!$("verrou-etat").dataset.message) {
    $("verrou-etat").textContent = actif ? "Le verrou est actif." : "Pas de verrou pour le moment.";
  }
}

function messageVerrou(texte) {
  $("verrou-etat").dataset.message = "1";
  $("verrou-etat").textContent = texte;
}

// l'empreinte prend une seconde environ : on laisse le message s'afficher avant
const plusTard = (f) => setTimeout(f, 30);

$("verrou").addEventListener("submit", (e) => {
  e.preventDefault();
  const actuel = $("verrou-actuel").value;
  const nouveau = $("verrou-nouveau").value;
  if (nouveau.length < 4) return messageVerrou("Choisissez au moins 4 caractères.");
  if (nouveau != $("verrou-confirmation").value) return messageVerrou("Les deux mots de passe ne sont pas identiques.");
  messageVerrou("Un instant…");
  plusTard(() => {
    if (cigale.verrouActif() && !cigale.verifierMotDePasse(actuel)) return messageVerrou("Le mot de passe actuel est faux.");
    cigale.definirMotDePasse(nouveau);
    e.target.reset();
    messageVerrou("C'est fait. Il sera demandé au prochain démarrage. Si vous l'oubliez, voir « Verrou » dans le README.");
    afficherVerrou();
  });
});

$("verrou-retirer").addEventListener("click", () => {
  messageVerrou("Un instant…");
  plusTard(() => {
    if (!cigale.verifierMotDePasse($("verrou-actuel").value)) return messageVerrou("Entrez d'abord le mot de passe actuel.");
    cigale.definirMotDePasse("");
    $("verrou").reset();
    messageVerrou("Le verrou est retiré.");
    afficherVerrou();
  });
});

// --- Vérifier les fuites ---

async function candidatsWebRTC() {
  if (!prefs.getBoolPref("media.peerconnection.enabled", true)) return null;
  const pc = new RTCPeerConnection({ iceServers: [] });
  const ips = new Set();
  pc.createDataChannel("cigale");
  pc.onicecandidate = (e) => {
    const m = e.candidate?.candidate.match(/ ([0-9a-f.:]+|[\w-]+\.local) \d+ typ/i);
    if (m) ips.add(m[1]);
  };
  await pc.setLocalDescription(await pc.createOffer());
  await new Promise((fin) => setTimeout(fin, 1500));
  pc.close();
  return [...ips];
}

$("fuites-tester").addEventListener("click", async () => {
  const bouton = $("fuites-tester");
  bouton.disabled = true;
  const lignes = [];
  const ligne = (nom, ok, detail) => lignes.push([nom, ok, detail]);
  $("fuites").replaceChildren();
  try {
    const { v4, v6 } = await cigale.adressesPubliques();
    if (!v4 && !v6) ligne("Adresse IP", false, "test impossible : pas de réseau ?");
    else {
      const tor = prefs.getBoolPref("cigale.tor", false);
      ligne("Adresse IP", tor, [v4, v6].filter(Boolean).join(" · ") +
        (tor ? " (sortie Tor)" : " : votre vraie adresse, sauf si vous utilisez un VPN"));
    }
    const mode = prefs.getIntPref("network.trr.mode", 0);
    const fournisseur = (prefs.getStringPref("network.trr.uri", "").match(/\/\/([^/]+)/) || [])[1] || "";
    ligne("DNS", mode == 3 || mode == 5,
      mode == 5 ? "par le réseau Tor" : mode == 3 ? `chiffré, uniquement par ${fournisseur}` :
      mode == 2 ? `chiffré par ${fournisseur}, avec repli sur le DNS du système` : "DNS du système, en clair (fuite possible)");
    const ips = await candidatsWebRTC().catch(() => []);
    if (ips === null) ligne("WebRTC", true, "désactivé");
    else {
      const visibles = ips.filter((ip) => !ip.endsWith(".local"));
      ligne("WebRTC", visibles.length == 0,
        visibles.length ? "adresses exposées : " + visibles.join(", ") : "aucune adresse locale exposée");
    }
  } finally {
    $("fuites").replaceChildren(...lignes.map(([nom, ok, detail]) => {
      const tr = document.createElement("tr");
      tr.className = ok ? "oui" : "non";
      const a = document.createElement("td");
      a.textContent = nom;
      const b = document.createElement("td");
      b.textContent = detail;
      tr.append(a, b);
      return tr;
    }));
    bouton.disabled = false;
  }
});

// --- Nouveautés ---

function afficherNouveautes() {
  // montrée une fois après une mise à jour, ou sur demande (lien « Voir les nouveautés »)
  const apresMiseAJour = prefs.getBoolPref("cigale.nouveautes.afficher", false);
  prefs.clearUserPref("cigale.nouveautes.afficher");
  const visible = apresMiseAJour || location.hash == "#nouveautes";
  $("nouveautes").hidden = !visible;
  if (visible) window.scrollTo(0, 0);
}

$("fermer-nouveautes").addEventListener("click", () => {
  history.replaceState(null, "", location.href.split("#")[0]);
  afficherNouveautes();
});
window.addEventListener("hashchange", afficherNouveautes);

// sinon la page s'ouvre parfois déjà défilée
history.scrollRestoration = "manual";
afficher();
afficherNouveautes();
afficherRapport();
afficherTor();
afficherMotsCles().catch(console.error);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) afficherRapport();
});
window.addEventListener("load", () => setTimeout(() => window.scrollTo(0, 0), 300));
