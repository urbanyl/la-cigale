"use strict";

// Panneau du bouton cigale (barre d'outils) : état du site ouvert et raccourcis.
const $ = (id) => document.getElementById(id);
const fenetre = window.browsingContext.topChromeWindow;
const cigale = ChromeUtils.importESModule("chrome://browser/content/cigale/cigale.sys.mjs");
const plus = ChromeUtils.importESModule("chrome://browser/content/cigale/plus.sys.mjs");
const WPL = Ci.nsIWebProgressListener;
const EMPREINTE = WPL.STATE_BLOCKED_FINGERPRINTING_CONTENT | (WPL.STATE_REPLACED_FINGERPRINTING_CONTENT || 0) |
  (WPL.STATE_ALLOWED_CANVAS_FINGERPRINTING || 0) | (WPL.STATE_ALLOWED_FONT_FINGERPRINTING || 0);
const COOKIES_TIERS = WPL.STATE_COOKIES_BLOCKED_FOREIGN | WPL.STATE_COOKIES_BLOCKED_TRACKER |
  WPL.STATE_COOKIES_BLOCKED_SOCIALTRACKER | (WPL.STATE_COOKIES_PARTITIONED_FOREIGN || 0);
const PISTAGE = WPL.STATE_BLOCKED_TRACKING_CONTENT | WPL.STATE_BLOCKED_SOCIALTRACKING_CONTENT |
  WPL.STATE_BLOCKED_FINGERPRINTING_CONTENT | WPL.STATE_BLOCKED_CRYPTOMINING_CONTENT |
  WPL.STATE_COOKIES_BLOCKED_TRACKER;
const PROFILS = { confort: "Confort", standard: "Standard", renforce: "Renforcé" };

function fermer() {
  frameElement?.closest("panel")?.hidePopup();
}

function ajusterHauteur() {
  // le cadre prend exactement la hauteur du contenu : jamais de barre de défilement
  if (frameElement) frameElement.style.height = Math.ceil(document.body.getBoundingClientRect().height) + "px";
}

async function badgeUblock(onglet) {
  try {
    const { ExtensionParent } = ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");
    const extension = WebExtensionPolicy.getByID("uBlock0@raymondhill.net")?.extension;
    return ExtensionParent.apiManager.global.browserActionFor?.(extension)?.action?.getContextData(onglet)?.badgeText || "";
  } catch {
    return "";
  }
}

function chiffre(id, n) {
  const b = $(id);
  b.textContent = n;
  b.classList.toggle("zero", !n);
}

function etat(classe, texte) {
  const e = $("etat");
  e.className = "etat " + classe;
  e.querySelector("span").textContent = texte;
}

async function rafraichir() {
  document.documentElement.classList.toggle("olive",
    Services.prefs.getStringPref("extensions.activeThemeID", "") == "firefox-alpenglow@mozilla.org");
  const profil = Services.prefs.getStringPref("cigale.profil", "standard");
  $("profil").textContent = "Profil " + (PROFILS[profil] || "personnalisé").toLowerCase();

  const onglet = fenetre.gBrowser.selectedTab;
  const navigateur = onglet.linkedBrowser;
  const adresse = navigateur.currentURI;
  const web = /^https?$/.test(adresse.scheme);
  for (const id of ["oublier", "fuites"]) $(id).disabled = !web;
  $("alerte").hidden = true;

  if (!web) {
    etat("neutre", "Page interne");
    $("hote").textContent = "Aucun site ouvert";
    for (const id of ["n-traqueurs", "n-ublock", "n-empreinte"]) chiffre(id, 0);
    $("certificat").textContent = "";
    ajusterHauteur();
    return;
  }

  $("hote").textContent = adresse.host.replace(/^www\./, "");
  const sur = (navigateur.securityUI?.state || 0) & WPL.STATE_IS_SECURE;

  let journal = {};
  try { journal = JSON.parse(await navigateur.getContentBlockingLog()); } catch { /* journal indisponible */ }
  const compter = (masque, bloque) => Object.values(journal)
    .filter((ev) => ev.some(([e, b]) => (e & masque) && (!bloque || b))).length;
  chiffre("n-traqueurs", compter(PISTAGE, true));
  chiffre("n-ublock", Number(await badgeUblock(onglet)) || 0);
  chiffre("n-empreinte", compter(EMPREINTE));

  const cert = plus.rapportCertificat(navigateur);
  const c = $("certificat");
  c.classList.toggle("recent", !!cert && cert.jours < 7);
  c.textContent = cert
    ? `Certificat de ${cert.jours} jour${cert.jours > 1 ? "s" : ""}` + (cert.emetteur ? ` · ${cert.emetteur}` : "") + (cert.jours < 7 ? " · très récent" : "")
    : (compter(COOKIES_TIERS) ? `${compter(COOKIES_TIERS)} site(s) tiers isolé(s)` : "");

  const sosie = plus.sosieDe(adresse.host);
  if (sosie) {
    etat("risque", "Site sosie");
    $("alerte").hidden = false;
    $("alerte").textContent = `Ressemble à ${sosie} sans être lui : risque d'hameçonnage.`;
  } else if (!sur) {
    etat("risque", "Connexion non chiffrée");
  } else {
    etat("", "Connexion chiffrée · protégé");
  }
  ajusterHauteur();
}

function ouvrirProtection(categorie) {
  fenetre.cigaleOngletSource = fenetre.gBrowser.selectedTab;
  fenetre.switchToTabHavingURI("about:cigale" + (categorie ? "#" + categorie : ""), true, { ignoreFragment: "whenComparingAndReplace" });
  fermer();
}

$("oublier").addEventListener("click", () => {
  cigale.oublierSite(fenetre).catch(console.error);
  fermer();
});
$("identite").addEventListener("click", () => {
  fermer();
  plus.nouvelleIdentite(fenetre).catch(console.error);
});
$("tor").addEventListener("click", () => {
  cigale.ouvrirFenetreTor(fenetre).catch(console.error);
  fermer();
});
$("fuites").addEventListener("click", () => ouvrirProtection("page"));
$("reglages").addEventListener("click", () => ouvrirProtection(""));
$("profil").addEventListener("click", () => ouvrirProtection(""));

// appelé par le bouton à chaque ouverture du panneau
window.cigaleRafraichir = () => rafraichir().catch(console.error);
window.cigaleRafraichir();
