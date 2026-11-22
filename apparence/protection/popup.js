"use strict";

// Panneau du bouton cigale (barre d'outils) : état du site ouvert et raccourcis.
const $ = (id) => document.getElementById(id);
const fenetre = window.browsingContext.topChromeWindow;
const cigale = ChromeUtils.importESModule("chrome://browser/content/cigale/cigale.sys.mjs");
const WPL = Ci.nsIWebProgressListener;
const PISTAGE = WPL.STATE_BLOCKED_TRACKING_CONTENT | WPL.STATE_BLOCKED_SOCIALTRACKING_CONTENT |
  WPL.STATE_BLOCKED_FINGERPRINTING_CONTENT | WPL.STATE_BLOCKED_CRYPTOMINING_CONTENT |
  WPL.STATE_COOKIES_BLOCKED_TRACKER;
const PROFILS = { confort: "Confort", standard: "Standard", renforce: "Renforcé" };

function fermer() {
  frameElement?.closest("panel")?.hidePopup();
}

function ajusterHauteur() {
  if (frameElement) frameElement.style.height = document.documentElement.scrollHeight + "px";
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

async function rafraichir() {
  const profil = Services.prefs.getStringPref("cigale.profil", "standard");
  $("profil").textContent = PROFILS[profil] || "Personnalisé";

  const onglet = fenetre.gBrowser.selectedTab;
  const navigateur = onglet.linkedBrowser;
  const adresse = navigateur.currentURI;
  const web = /^https?$/.test(adresse.scheme);
  $("oublier").disabled = !web;

  if (!web) {
    $("hote").textContent = "Aucun site sur cet onglet";
    $("connexion").textContent = "";
    $("bloques").textContent = "";
    ajusterHauteur();
    return;
  }

  $("hote").textContent = adresse.host;
  const sur = (navigateur.securityUI?.state || 0) & WPL.STATE_IS_SECURE;
  $("connexion").textContent = sur ? "Connexion chiffrée" : "Connexion non chiffrée";

  let journal = {};
  try { journal = JSON.parse(await navigateur.getContentBlockingLog()); } catch { /* journal indisponible */ }
  const traqueurs = Object.values(journal)
    .filter((evenements) => evenements.some(([etat, bloque]) => (etat & PISTAGE) && bloque)).length;
  const badge = await badgeUblock(onglet);
  const morceaux = [traqueurs ? `${traqueurs} traqueur${traqueurs > 1 ? "s" : ""} bloqué${traqueurs > 1 ? "s" : ""}` : "Aucun traqueur détecté"];
  if (badge) morceaux.push(`${badge} requête${badge == "1" ? "" : "s"} arrêtée${badge == "1" ? "" : "s"} par uBlock`);
  $("bloques").textContent = morceaux.join(" · ");
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
$("tor").addEventListener("click", () => {
  cigale.ouvrirFenetreTor(fenetre).catch(console.error);
  fermer();
});
$("fuites").addEventListener("click", () => ouvrirProtection("page"));
$("reglages").addEventListener("click", () => ouvrirProtection(""));

// appelé par le bouton à chaque ouverture du panneau
window.cigaleRafraichir = () => rafraichir().catch(console.error);
window.cigaleRafraichir();
