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
  for (const id of ["oublier", "fuites", "propre", "coffre"]) $(id).disabled = !web;
  $("alerte").hidden = true;
  $("note").hidden = !web;
  desarmer();

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
  const traqueurs = compter(PISTAGE, true);
  const ublock = Number(await badgeUblock(onglet)) || 0;
  const empreintes = compter(EMPREINTE);
  chiffre("n-traqueurs", traqueurs);
  chiffre("n-ublock", ublock);
  chiffre("n-empreinte", empreintes);

  const auCoffre = plus.estAuCoffre(adresse.host);
  $("coffre").classList.toggle("actif", auCoffre);
  $("coffre-texte").innerHTML = auCoffre ? "Au coffre<br>(sortir)" : "Mettre au<br>coffre";

  const cert = plus.rapportCertificat(navigateur);
  const c = $("certificat");
  c.classList.toggle("recent", !!cert && cert.jours < 7);
  c.textContent = cert
    ? `Certificat de ${cert.jours} jour${cert.jours > 1 ? "s" : ""}` + (cert.emetteur ? ` · ${cert.emetteur}` : "") + (cert.jours < 7 ? " · très récent" : "")
    : (compter(COOKIES_TIERS) ? `${compter(COOKIES_TIERS)} site(s) tiers isolé(s)` : "");

  const sosie = plus.sosieDe(adresse.host);
  afficherNote({ sur, traqueurs, ublock, empreintes, cookies: compter(COOKIES_TIERS), cert, sosie });
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

// Note du site, de A à F : ce que La Cigale voit sur cette page, pas un avis sur le site.
function afficherNote({ sur, traqueurs, ublock, empreintes, cookies, cert, sosie }) {
  const raisons = [];
  let points = 100;
  const retirer = (n, texte) => { if (n > 0) { points -= n; raisons.push(texte); } };
  if (sosie) points = 0, raisons.push("se fait passer pour " + sosie);
  if (!sur) retirer(40, "connexion non chiffrée");
  retirer(Math.min(30, traqueurs * 5), `${traqueurs} traqueur${traqueurs > 1 ? "s" : ""}`);
  retirer(Math.min(25, empreintes * 10), `${empreintes} lecture${empreintes > 1 ? "s" : ""} d'empreinte`);
  retirer(Math.min(15, Math.ceil(ublock / 2)), `${ublock} requête${ublock > 1 ? "s" : ""} bloquée${ublock > 1 ? "s" : ""} par uBlock`);
  retirer(Math.min(10, cookies * 2), `${cookies} site${cookies > 1 ? "s" : ""} tiers posant des cookies`);
  if (cert && cert.jours < 7) retirer(15, "certificat de moins d'une semaine");
  const lettre = points >= 90 ? "A" : points >= 75 ? "B" : points >= 60 ? "C" : points >= 45 ? "D" : points >= 30 ? "E" : "F";
  $("note-lettre").textContent = lettre;
  $("note").className = "note" + ("CD".includes(lettre) ? " moyenne" : "EF".includes(lettre) ? " mauvaise" : "");
  $("note").title = `Note ${lettre} : ce que ce site tente sur cette page, vu par La Cigale.\n` +
    (raisons.length ? "En moins : " + raisons.join(", ") + "." : "Rien à signaler : chiffré, sans traqueur ni lecture d'empreinte.");
}

// Panique : un premier clic arme le bouton, le second efface tout
let minuteurPanique = null;
function desarmer() {
  clearTimeout(minuteurPanique);
  $("panique").classList.remove("arme");
  $("panique-texte").innerHTML = "Panique<small>tout effacer</small>";
}

function retour(texte) {
  const c = $("certificat");
  const avant = [c.textContent, c.className];
  c.textContent = texte;
  c.className = "certificat retour";
  setTimeout(() => { c.textContent = avant[0]; c.className = avant[1]; }, 2600);
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
$("propre").addEventListener("click", () => {
  const r = plus.copierLienPropre(fenetre);
  if (!r) return;
  retour(r.retire ? `Lien copié, ${r.retire} caractères de pistage retirés.` : "Lien copié : il était déjà propre.");
});
$("coffre").addEventListener("click", () => {
  plus.basculerCoffre(fenetre);
  fermer();
});
$("panique").addEventListener("click", () => {
  if (!$("panique").classList.contains("arme")) {
    $("panique").classList.add("arme");
    $("panique-texte").innerHTML = "Confirmer<small>cliquez encore</small>";
    minuteurPanique = setTimeout(desarmer, 3000);
    return;
  }
  desarmer();
  fermer();
  plus.panique(fenetre).catch(console.error);
});
$("reglages").addEventListener("click", () => ouvrirProtection(""));
$("profil").addEventListener("click", () => ouvrirProtection(""));

// appelé par le bouton à chaque ouverture du panneau
window.cigaleRafraichir = () => rafraichir().catch(console.error);
window.cigaleRafraichir();
