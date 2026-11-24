"use strict";

// about:nouveautes : présentation de la version, montrée une fois après une mise à jour.
const $ = (id) => document.getElementById(id);
const P = Services.prefs;
const fenetre = window.browsingContext.topChromeWindow;
const plus = ChromeUtils.importESModule("chrome://browser/content/cigale/plus.sys.mjs");
const bilan = ChromeUtils.importESModule("chrome://browser/content/cigale/bilan.sys.mjs");

document.documentElement.classList.toggle("olive",
  P.getStringPref("extensions.activeThemeID", "") == "firefox-alpenglow@mozilla.org");
const version = P.getStringPref("cigale.version", "");
if (version) $("version").textContent = version.split(".").slice(0, 2).join(".");

const accueil = () => P.getStringPref("browser.startup.homepage", "about:home").split("|")[0];

// 01 : le vrai bilan de l'utilisateur dans l'aperçu
bilan.resume(7).then((b) => {
  $("apercu-total").textContent = new Intl.NumberFormat("fr-FR").format(b.bloques);
  const max = Math.max(1, ...b.parJour.map((j) => j.bloques));
  $("apercu-barres").replaceChildren(...b.parJour.map((j) => {
    const i = document.createElement("i");
    i.style.height = Math.max(6, Math.round((j.bloques / max) * 100)) + "%";
    return i;
  }));
  if (b.entreprises.length >= 2) {
    const premier = b.entreprises[0][1];
    $("apercu-classement").replaceChildren(...b.entreprises.slice(0, 4).map(([nom, n]) => {
      const li = document.createElement("li");
      const s = document.createElement("span");
      s.textContent = nom;
      const i = document.createElement("i");
      i.style.width = Math.max(4, Math.round((n / premier) * 100)) + "%";
      li.append(s, i);
      return li;
    }));
  }
}).catch(console.error);

$("voir-accueil").addEventListener("click", () => fenetre.openTrustedLinkIn(accueil(), "tab"));
$("voir-classement").addEventListener("click", () => fenetre.switchToTabHavingURI("about:cigale#bilan", true));
$("revoir-bienvenue").addEventListener("click", () => fenetre.openTrustedLinkIn("about:bienvenue", "current"));
$("ouvrir-panneau").addEventListener("click", () => {
  const bouton = fenetre.document.getElementById("cigale-protection-button");
  try {
    fenetre.PanelUI.showSubView("PanelUI-cigale", bouton);
  } catch (e) {
    console.error(e);
  }
});

// 04 : essai du nettoyage en direct
function essayer() {
  const brut = $("essai-lien").value.trim();
  const propre = brut ? plus.nettoyerURL(brut) : "";
  $("essai-propre").textContent = propre || "Collez un lien au-dessus";
  const retire = brut.length - propre.length;
  $("essai-retire").textContent = !brut ? "" : retire > 0 ? `${retire} caractères de pistage retirés` : "Ce lien était déjà propre.";
}
$("essai-lien").addEventListener("input", essayer);
essayer();

// 06 : coffres pour les sites sensibles
function majCoffres() {
  const actif = P.getBoolPref("cigale.coffres.sensibles", false);
  $("coffres-sensibles").textContent = actif ? "Banques et impôts au coffre : activé" : "Mettre mes banques et impôts au coffre";
  $("coffres-sensibles").classList.toggle("plein", actif);
}
$("coffres-sensibles").addEventListener("click", () => {
  const actif = !P.getBoolPref("cigale.coffres.sensibles", false);
  P.setBoolPref("cigale.coffres.sensibles", actif);
  if (actif) P.setBoolPref("privacy.userContext.enabled", true);
  majCoffres();
});
majCoffres();
