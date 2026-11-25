"use strict";
// Bloc-notes du panneau latéral : un fichier texte dans le profil (cigale-notes.txt).
const outils = ChromeUtils.importESModule("chrome://browser/content/cigale/outils/outils.sys.mjs");
const texte = document.getElementById("texte");
const etat = document.getElementById("etat");
const fenetre = window.browsingContext.topChromeWindow;

document.documentElement.classList.toggle("olive",
  Services.prefs.getStringPref("extensions.activeThemeID", "") == "firefox-alpenglow@mozilla.org");

let minuteur = 0;
let dernier = "";
function enregistrer() {
  clearTimeout(minuteur);
  if (texte.value == dernier) return;
  dernier = texte.value;
  outils.ecrireNotes(texte.value).then(() => {
    etat.textContent = "Enregistré";
    setTimeout(() => { if (etat.textContent == "Enregistré") etat.textContent = ""; }, 1500);
  }).catch((e) => { etat.textContent = "Erreur d'enregistrement"; console.error(e); });
}
texte.addEventListener("input", () => { clearTimeout(minuteur); minuteur = setTimeout(enregistrer, 400); });
texte.addEventListener("blur", enregistrer);
window.addEventListener("unload", enregistrer);

// appelé quand une autre fenêtre (ou « Ajouter aux notes ») change le fichier
window.cigaleRecharger = (contenu) => {
  if (contenu == texte.value) return;
  dernier = contenu;
  texte.value = contenu;
  texte.scrollTop = texte.scrollHeight;
};
window.cigaleFocus = () => texte.focus();

outils.lireNotes().then((contenu) => {
  if (texte.value && texte.value != contenu) return;
  dernier = contenu;
  texte.value = contenu;
  texte.scrollTop = texte.scrollHeight;
  texte.focus();
});

document.getElementById("copier").addEventListener("click", () => {
  Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(texte.value);
  etat.textContent = "Copié";
});
document.getElementById("fermer").addEventListener("click", () => { enregistrer(); outils.basculerNotes(fenetre); });
