"use strict";

// about:nouveautes : présentation de la version, montrée une fois après une mise à jour.
const $ = (id) => document.getElementById(id);
const P = Services.prefs;
const fenetre = window.browsingContext.topChromeWindow;

document.documentElement.classList.toggle("olive",
  P.getStringPref("extensions.activeThemeID", "") == "firefox-alpenglow@mozilla.org");
const version = P.getStringPref("cigale.version", "");
if (version) $("version").textContent = version.split(".").slice(0, 2).join(".");

const accueil = () => P.getStringPref("browser.startup.homepage", "about:home").split("|")[0];

$("voir-accueil").addEventListener("click", () => fenetre.openTrustedLinkIn(accueil(), "tab"));
$("ouvrir-protection").addEventListener("click", () => fenetre.switchToTabHavingURI("about:cigale", true));
