"use strict";

// about:bienvenue : premier lancement en trois étapes (apparence, protection, raccourcis).
const $ = (id) => document.getElementById(id);
const P = Services.prefs;
const fenetre = window.browsingContext.topChromeWindow;
const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");

// Mêmes profils que about:cigale (seulement des defaultPref : ce qui est verrouillé ne bouge pas)
const PROFILS = {
  confort: { "javascript.enabled": true, "javascript.options.wasm": true, "privacy.resistFingerprinting.letterboxing": false,
    "privacy.spoof_english": 1, "privacy.clearOnShutdown_v2.cookiesAndStorage": false },
  standard: { "javascript.enabled": true, "javascript.options.wasm": true, "privacy.resistFingerprinting.letterboxing": false,
    "privacy.spoof_english": 2, "privacy.clearOnShutdown_v2.cookiesAndStorage": true },
  renforce: { "javascript.enabled": false, "javascript.options.wasm": false, "privacy.resistFingerprinting.letterboxing": true,
    "privacy.spoof_english": 2, "privacy.clearOnShutdown_v2.cookiesAndStorage": true },
};

const SITES = [
  ["Wikipédia", "https://fr.wikipedia.org", "encyclopédie"],
  ["OpenStreetMap", "https://www.openstreetmap.org", "cartes libres"],
  ["Seyra", "https://seyra.website", "recherche"],
  ["Météo-France", "https://meteofrance.com", "météo"],
  ["France Culture", "https://www.radiofrance.fr/franceculture", "radio"],
  ["Framasoft", "https://framasoft.org", "outils libres"],
  ["Proton Mail", "https://mail.proton.me", "messagerie chiffrée"],
  ["Le Monde", "https://www.lemonde.fr", "actualités"],
  ["YouTube", "https://www.youtube.com", "vidéos"],
  ["Leboncoin", "https://www.leboncoin.fr", "petites annonces"],
  ["Doctolib", "https://www.doctolib.fr", "santé"],
  ["Impots.gouv", "https://www.impots.gouv.fr", "impôts"],
  ["Ameli", "https://www.ameli.fr", "assurance maladie"],
  ["GitHub", "https://github.com", "code"],
  ["Reddit", "https://www.reddit.com", "forums"],
  ["Spotify", "https://open.spotify.com", "musique"],
];
const choisis = new Set(SITES.slice(0, 6).map(([, url]) => url));

let etape = 0;
const ETAPES = [...document.querySelectorAll(".etape")];

function olive() {
  document.documentElement.classList.toggle("olive",
    P.getStringPref("extensions.activeThemeID", "") == "firefox-alpenglow@mozilla.org");
}

function cocher(groupe, attribut, valeur) {
  for (const b of $(groupe).querySelectorAll("[role=radio]")) b.setAttribute("aria-checked", String(b.dataset[attribut] == valeur));
}

function afficher() {
  ETAPES.forEach((s, i) => { s.hidden = i != etape; });
  [...$("etapes").children].forEach((li, i) => { li.className = i < etape ? "faite" : i == etape ? "actuelle" : ""; });
  $("precedent").disabled = etape == 0;
  $("suivant").textContent = etape == ETAPES.length - 1 ? "Ouvrir La Cigale" : "Continuer";
  $("compte").textContent = etape == 2 ? `${choisis.size} raccourci${choisis.size > 1 ? "s" : ""} choisi${choisis.size > 1 ? "s" : ""}` : "";
  cocher("themes", "theme", P.getStringPref("extensions.activeThemeID", "firefox-compact-dark@mozilla.org"));
  cocher("profils", "profil", P.getStringPref("cigale.profil", "standard"));
  $("coffres-sensibles").checked = P.getBoolPref("cigale.coffres.sensibles", false);
  olive();
}

// 1. Apparence : appliquée tout de suite à tout le navigateur
$("themes").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-theme]");
  if (!b) return;
  cocher("themes", "theme", b.dataset.theme);
  const theme = await AddonManager.getAddonByID(b.dataset.theme);
  await theme?.enable();
  afficher();
});

// 2. Protection
$("profils").addEventListener("click", (e) => {
  const b = e.target.closest("[data-profil]");
  if (!b) return;
  const nom = b.dataset.profil;
  if (nom == "renforce" && !confirm("Avec JavaScript coupé, la plupart des messageries, banques et sites de vidéo ne marcheront plus. Continuer ?")) return;
  for (const [p, v] of Object.entries(PROFILS[nom])) {
    if (P.prefIsLocked(p)) continue;
    if (typeof v == "boolean") P.setBoolPref(p, v);
    else P.setIntPref(p, v);
  }
  P.setStringPref("cigale.profil", nom);
  afficher();
});
$("coffres-sensibles").addEventListener("change", (e) => {
  P.setBoolPref("cigale.coffres.sensibles", e.target.checked);
  if (e.target.checked) P.setBoolPref("privacy.userContext.enabled", true);
});

// 3. Raccourcis
function tuiles() {
  $("tuiles").replaceChildren(...SITES.map(([nom, url, quoi]) => {
    const b = document.createElement("button");
    b.className = "tuile";
    b.setAttribute("aria-pressed", String(choisis.has(url)));
    const l = document.createElement("span");
    l.className = "lettre";
    l.textContent = nom[0];
    const t = document.createElement("span");
    const n = document.createElement("b");
    n.textContent = nom;
    const s = document.createElement("small");
    s.textContent = quoi;
    t.append(n, s);
    b.append(l, t);
    b.addEventListener("click", () => {
      if (choisis.has(url)) choisis.delete(url);
      else if (choisis.size < 12) choisis.add(url);
      tuiles();
      afficher();
    });
    return b;
  }));
}

$("precedent").addEventListener("click", () => { if (etape > 0) { etape--; afficher(); } });
$("suivant").addEventListener("click", () => {
  if (etape < ETAPES.length - 1) {
    etape++;
    afficher();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  P.setBoolPref("cigale.bienvenue.vue", true);
  const liste = SITES.filter(([, url]) => choisis.has(url)).map(([nom, url]) => ({ nom, url }));
  const accueil = P.getStringPref("browser.startup.homepage", "about:home").split("|")[0];
  const adresse = accueil.startsWith("file:") && liste.length
    ? accueil + (accueil.includes("#") ? "&" : "#") + "raccourcis=" + encodeURIComponent(JSON.stringify(liste))
    : accueil;
  fenetre.openTrustedLinkIn(adresse, "current");
});

tuiles();
afficher();
