"use strict";

const $ = (id) => document.getElementById(id);
const prefs = Services.prefs;

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

async function ublockActif() {
  try {
    const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
    const addon = await AddonManager.getAddonByID("uBlock0@raymondhill.net");
    return !!(addon && addon.isActive);
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function afficher() {
  const ublock = await ublockActif();
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

// sinon la page s'ouvre parfois déjà défilée
history.scrollRestoration = "manual";
afficher();
window.addEventListener("load", () => setTimeout(() => window.scrollTo(0, 0), 300));
