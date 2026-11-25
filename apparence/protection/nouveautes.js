"use strict";

// about:nouveautes : présentation de la version, montrée une fois après une mise à jour.
const $ = (id) => document.getElementById(id);
const P = Services.prefs;
const fenetre = window.browsingContext.topChromeWindow;
const A = ChromeUtils.importESModule("chrome://browser/content/cigale/assistant/assistant.sys.mjs");

document.documentElement.classList.toggle("olive",
  P.getStringPref("extensions.activeThemeID", "") == "firefox-alpenglow@mozilla.org");
const version = P.getStringPref("cigale.version", "");
if (version) $("version").textContent = version.split(".").slice(0, 2).join(".");

const accueil = () => P.getStringPref("browser.startup.homepage", "about:home").split("|")[0];

$("ouvrir-assistant").addEventListener("click", () => fenetre.switchToTabHavingURI("about:assistant", true));
$("ouvrir-panneau-ia").addEventListener("click", () => {
  const outils = ChromeUtils.importESModule("chrome://browser/content/cigale/outils/outils.sys.mjs");
  const boite = fenetre.document.getElementById("cigale-assistant-panneau");
  if (!boite || boite.hidden) outils.basculerAssistant(fenetre);
});
$("voir-accueil").addEventListener("click", () => fenetre.openTrustedLinkIn(accueil(), "tab"));

// 06 : historique des conversations, désactivé d'origine
function majHistorique() {
  const actif = A.historiqueActif();
  $("historique").textContent = actif ? "Conversations gardées : activé" : "Garder mes conversations";
  $("historique").classList.toggle("plein", actif);
}
$("historique").addEventListener("click", async () => {
  await A.activerHistorique(!A.historiqueActif());
  majHistorique();
});
majHistorique();
