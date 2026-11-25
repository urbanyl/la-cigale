// La Cigale 1.4 : fonctions intégrées au navigateur (anonymat, sécurité, confort).
// Chargé par cigale.cfg : ChromeUtils.importESModule("chrome://browser/content/cigale/plus.sys.mjs").installer().

import * as cigale from "chrome://browser/content/cigale/cigale.sys.mjs";
import * as bilan from "chrome://browser/content/cigale/bilan.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  Downloads: "resource://gre/modules/Downloads.sys.mjs",
  ForgetAboutSite: "resource://gre/modules/ForgetAboutSite.sys.mjs",
  ContextualIdentityService: "resource://gre/modules/ContextualIdentityService.sys.mjs",
  setInterval: "resource://gre/modules/Timer.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

const P = Services.prefs;
const ICONE = "chrome://browser/content/cigale/bouton.png";

// ---------- outils ----------

function base(hote) {
  if (!hote) return "";
  try {
    return Services.eTLD.getBaseDomainFromHost(hote);
  } catch {
    return hote;
  }
}

function hoteDe(uri) {
  try {
    return uri && /^https?$/.test(uri.scheme) ? uri.host : "";
  } catch {
    return "";
  }
}

function lireListe(nom) {
  try {
    const v = JSON.parse(P.getStringPref(nom, "[]"));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function barre(win, browser, id, texte, boutons = [], priorite = "PRIORITY_WARNING_MEDIUM") {
  try {
    const boite = browser ? win.gBrowser.getNotificationBox(browser) : win.gNotificationBox;
    const ancienne = boite.getNotificationWithValue(id);
    if (ancienne) boite.removeNotification(ancienne);
    return boite.appendNotification(id, { label: texte, image: ICONE, priority: boite[priorite] }, boutons);
  } catch (e) {
    console.error(e);
    return null;
  }
}

function fenetres() {
  return [...Services.wm.getEnumerator("navigator:browser")].filter((w) => !w.closed && w.gBrowser);
}

// Sites conservés (about:cigale) : on leur fait déjà confiance
function sitesConserves() {
  const l = new Set();
  try {
    for (const p of Services.perms.all) {
      if (p.type == "cookie" && p.capability == Services.perms.ALLOW_ACTION) {
        const h = hoteDe(p.principal.URI);
        if (h) l.add(base(h));
      }
    }
  } catch {}
  return l;
}

// ---------- 13. Liens nettoyés à la copie ----------

const PISTEURS = /^(utm_\w+|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|igsh|yclid|twclid|ttclid|_hsenc|_hsmi|mkt_tok|oly_anon_id|oly_enc_id|vero_id|wickedid|ref_src|ref_url|spm|si|s_kwcid|ef_id|_ga|_gl|trk|trkcampaign|sc_cid|cmpid|xtor)$/i;

export function nettoyerURL(texte) {
  let u;
  try {
    u = new URL(texte.trim());
  } catch {
    return texte;
  }
  if (!/^https?:$/.test(u.protocol)) return texte;
  for (const cle of [...u.searchParams.keys()]) if (PISTEURS.test(cle)) u.searchParams.delete(cle);
  // Amazon : /nom-du-produit/dp/ASIN/ref=…?… devient /dp/ASIN
  if (/(^|\.)amazon\.[a-z.]+$/.test(u.hostname)) {
    const m = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    if (m) return `${u.origin}/dp/${m[1]}`;
  }
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(u.hostname)) u.searchParams.delete("pp");
  let s = u.toString();
  if (!u.search && s.endsWith("?")) s = s.slice(0, -1);
  return s;
}

function copier(texte) {
  Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(texte);
}

// ---------- 6. Détecteur de sosies ----------

const SENSIBLES = [
  "google.com", "gmail.com", "youtube.com", "microsoft.com", "live.com", "outlook.com", "office.com", "apple.com",
  "icloud.com", "amazon.fr", "amazon.com", "paypal.com", "facebook.com", "instagram.com", "whatsapp.com",
  "twitter.com", "x.com", "linkedin.com", "netflix.com", "spotify.com", "github.com", "discord.com", "steampowered.com",
  "steamcommunity.com", "leboncoin.fr", "vinted.fr", "cdiscount.com", "fnac.com", "laposte.fr", "laposte.net",
  "orange.fr", "free.fr", "sfr.fr", "bouyguestelecom.fr", "impots.gouv.fr", "ameli.fr", "caf.fr", "franceconnect.gouv.fr",
  "service-public.fr", "ants.gouv.fr", "credit-agricole.fr", "societegenerale.fr", "bnpparibas.net", "mabanque.bnpparibas",
  "lcl.fr", "labanquepostale.fr", "caisse-epargne.fr", "banquepopulaire.fr", "creditmutuel.fr", "cic.fr", "boursorama.com",
  "boursobank.com", "fortuneo.fr", "hellobank.fr", "revolut.com", "n26.com", "qonto.com", "lydia-app.com", "binance.com",
  "coinbase.com", "kraken.com", "ledger.com", "doctolib.fr", "edf.fr", "engie.fr", "sncf-connect.com", "airbnb.fr",
  "booking.com", "ebay.fr", "ebay.com", "dropbox.com", "proton.me", "protonmail.com", "seyra.website", "wikipedia.org",
];

const CONFUSABLES = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ԁ": "d", "ɡ": "g",
  "ӏ": "l", "һ": "h", "ѕ": "s", "ԛ": "q", "ԝ": "w", "ν": "v", "ο": "o", "α": "a", "ı": "i", "0": "o", "1": "l",
  "3": "e", "5": "s", "7": "t", "ł": "l", "ø": "o", "é": "e", "è": "e", "à": "a", "ç": "c", "í": "i", "ó": "o", "ú": "u",
};

function squelette(nom) {
  let s = nom.toLowerCase().normalize("NFKC");
  s = [...s].map((c) => CONFUSABLES[c] ?? c).join("");
  return s.replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d").replace(/[-_.]/g, "").replace(/l/g, "i");
}

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

function nomSansSuffixe(domaine) {
  try {
    const suffixe = Services.eTLD.getPublicSuffixFromHost(domaine);
    return domaine.slice(0, -(suffixe.length + 1));
  } catch {
    return domaine.split(".")[0];
  }
}

const idn = Cc["@mozilla.org/network/idn-service;1"].getService(Ci.nsIIDNService);

// Renvoie le site imité, ou "" si l'adresse ne ressemble à aucun site sensible
export function sosieDe(hote) {
  if (!hote) return "";
  const b = base(hote);
  let lisible = b;
  try {
    lisible = idn.convertToDisplayIDN(b);
  } catch {}
  try {
    if (b.startsWith("xn--") || b.includes(".xn--")) lisible = idn.convertACEtoUTF8(b);
  } catch {}
  const connus = new Set([...SENSIBLES, ...sitesConserves()]);
  if (connus.has(b)) return "";
  const nom = nomSansSuffixe(lisible);
  const sq = squelette(nom);
  for (const vrai of connus) {
    const nomVrai = nomSansSuffixe(vrai);
    if (nom == nomVrai) continue; // même nom, autre pays (google.de) : normal
    if (sq == squelette(nomVrai)) return vrai;
    if (nomVrai.length >= 5 && distance(nom, nomVrai) == 1) return vrai;
    // paypal-securite.com, amazon-remboursement.fr
    if (nomVrai.length >= 5 && new RegExp(`(^|[-.])${nomVrai}([-.]|$)`).test(nom)) return vrai;
  }
  return "";
}

// ---------- 7. Mode « site inconnu » ----------

export function sitesDeConfiance() {
  return new Set(lireListe("cigale.inconnu.confiance"));
}

export function faireConfiance(domaine) {
  const l = sitesDeConfiance();
  l.add(domaine);
  P.setStringPref("cigale.inconnu.confiance", JSON.stringify([...l].sort()));
}

export function retirerConfiance(domaine) {
  const l = sitesDeConfiance();
  l.delete(domaine);
  P.setStringPref("cigale.inconnu.confiance", JSON.stringify([...l].sort()));
}

function estInconnu(hote) {
  if (!hote || !P.getBoolPref("cigale.inconnu.actif", false)) return false;
  const b = base(hote);
  return !sitesDeConfiance().has(b) && !sitesConserves().has(b);
}

// ---------- 2. Nouvelle identité ----------

export async function nouvelleIdentite(win, { confirmer = true, message = "Nouvelle identité : tout est effacé." } = {}) {
  const ok = !confirmer || Services.prompt.confirm(win, "Nouvelle identité",
    "Fermer tous les onglets, effacer cookies, cache et historique, et changer de proxy si vous en utilisez un ?\n\n" +
    "Les sites ne pourront pas relier ce que vous ferez ensuite à ce que vous avez fait avant.");
  if (!ok) return false;

  const F = Ci.nsIClearDataService;
  let drapeaux = 0;
  for (const n of ["CLEAR_COOKIES", "CLEAR_ALL_CACHES", "CLEAR_DOM_STORAGES", "CLEAR_HISTORY", "CLEAR_SESSION_HISTORY",
                   "CLEAR_AUTH_TOKENS", "CLEAR_AUTH_CACHE", "CLEAR_FORMDATA", "CLEAR_DOWNLOADS", "CLEAR_MEDIA_DEVICES",
                   "CLEAR_STORAGE_ACCESS", "CLEAR_CLIENT_AUTH_REMEMBER_SERVICE", "CLEAR_EME"]) {
    if (F[n]) drapeaux |= F[n];
  }

  // les sites conservés gardent leurs cookies, comme à la fermeture
  const accueil = P.getStringPref("browser.startup.homepage", "about:home").split("|")[0];
  for (const w of fenetres()) {
    if (w != win) w.close();
  }
  const g = win.gBrowser;
  const nouvel = g.addTrustedTab(accueil);
  g.removeAllTabsBut(nouvel);

  await new Promise((r) => Services.clearData.deleteData(drapeaux, r));

  let proxy = "";
  const liste = cigale.listeProxys();
  const actif = cigale.proxyActif();
  if (actif >= 0 && liste.length > 1) {
    const autres = liste.map((_, i) => i).filter((i) => i != actif && cigale.santeProxys.get(i)?.ok !== false);
    if (autres.length) {
      const i = autres[Math.floor(Math.random() * autres.length)];
      cigale.choisirProxy(i);
      proxy = ` Nouveau proxy : n° ${i + 1}.`;
    }
  }
  barre(win, null, "cigale-identite", message + proxy, [], "PRIORITY_INFO_MEDIUM");
  return true;
}

// ---------- 12. Profils rapides ----------

const PROFILS = [
  ["Travail", "briefcase", "blue"],
  ["Perso", "fingerprint", "green"],
  ["Banque", "dollar", "red"],
];

export function creerProfils() {
  P.setBoolPref("privacy.userContext.enabled", true);
  P.setBoolPref("privacy.userContext.ui.enabled", true);
  const existants = new Set(lazy.ContextualIdentityService.getPublicIdentities().map((i) =>
    i.name || lazy.ContextualIdentityService.getUserContextLabel(i.userContextId)));
  let crees = 0;
  for (const [nom, icone, couleur] of PROFILS) {
    if (!existants.has(nom)) {
      lazy.ContextualIdentityService.create(nom, icone, couleur);
      crees++;
    }
  }
  return crees;
}

export function profilsActifs() {
  if (!P.getBoolPref("privacy.userContext.enabled", false)) return false;
  const noms = new Set(lazy.ContextualIdentityService.getPublicIdentities().map((i) => i.name));
  return PROFILS.every(([n]) => noms.has(n));
}

export function ouvrirDansProfil(win, nom, url) {
  const id = lazy.ContextualIdentityService.getPublicIdentities().find((i) => i.name == nom)?.userContextId;
  if (!id) return;
  const t = win.gBrowser.addTab(url || P.getStringPref("browser.startup.homepage", "about:home").split("|")[0], {
    userContextId: id,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  win.gBrowser.selectedTab = t;
}

// ---------- 8. Téléchargements vérifiés ----------

const EXECUTABLES = /\.(exe|msi|msix|bat|cmd|com|scr|ps1|vbs|js|jar|hta|lnk|appimage|run|sh|deb|rpm|dmg|pkg|apk)$/i;

async function sha256Fichier(chemin) {
  const h = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
  h.init(h.SHA256);
  const taille = (await IOUtils.stat(chemin)).size;
  const bloc = 8 * 1024 * 1024;
  for (let pos = 0; pos < taille; pos += bloc) {
    const octets = await IOUtils.read(chemin, { offset: pos, maxBytes: Math.min(bloc, taille - pos) });
    h.update(octets, octets.length);
  }
  return [...h.finish(false)].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}

async function empreintesPubliees(domaines) {
  const toutes = new Set();
  for (const w of fenetres()) {
    for (const b of w.gBrowser.browsers) {
      if (!domaines.has(base(hoteDe(b.currentURI)))) continue;
      try {
        const acteur = b.browsingContext?.currentWindowGlobal?.getActor("CigalePlus");
        for (const e of (await acteur?.sendQuery("Empreintes")) || []) toutes.add(e);
      } catch {}
    }
  }
  return toutes;
}

const telechargementsVus = new WeakSet();
async function verifierTelechargement(d) {
  if (!P.getBoolPref("cigale.telechargements.verifier", true)) return;
  const win = Services.wm.getMostRecentWindow("navigator:browser");
  if (!win) return;
  const nom = PathUtils.filename(d.target.path);
  let source = "";
  let referent = "";
  try { source = new URL(d.source.url).hostname; } catch {}
  try { referent = new URL(d.source.referrerInfo?.originalReferrer?.spec || "").hostname; } catch {}
  const domaines = new Set([base(source), base(referent)].filter(Boolean));
  const publiees = await empreintesPubliees(domaines);
  const executable = EXECUTABLES.test(nom);

  if (publiees.size) {
    const empreinte = await sha256Fichier(d.target.path);
    if (publiees.has(empreinte)) {
      barre(win, null, "cigale-telechargement", `${nom} : empreinte SHA-256 vérifiée, identique à celle publiée par le site.`, [], "PRIORITY_INFO_MEDIUM");
    } else {
      barre(win, null, "cigale-telechargement",
        `Attention : ${nom} ne correspond à aucune empreinte SHA-256 publiée sur la page. Le fichier a pu être modifié ; ne l'ouvrez pas.`,
        [], "PRIORITY_CRITICAL_MEDIUM");
    }
    return;
  }
  const site = base(referent) || base(source);
  if (executable && site && !sitesDeConfiance().has(site) && !sitesConserves().has(site)) {
    barre(win, null, "cigale-telechargement",
      `${nom} est un programme venant de ${site}. N'ouvrez que des programmes de sites que vous connaissez.`,
      [{ label: "Faire confiance à " + site, callback: () => faireConfiance(site) }]);
  }
}

// ---------- 5. Rapport de page ----------

export function rapportCertificat(browser) {
  try {
    const cert = browser.securityUI?.secInfo?.serverCert;
    if (!cert) return null;
    const debut = cert.validity.notBefore / 1000;
    return {
      jours: Math.floor((Date.now() - debut) / 86400000),
      emetteur: cert.issuerOrganization || cert.issuerCommonName || "",
    };
  } catch {
    return null;
  }
}

// ---------- 9. Panneau latéral (Seyra) ----------

// Logo de Seyra (son favicon, 64 px), embarqué : rien n'est demandé au réseau pour l'afficher.
const ICONE_SEYRA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAATcElEQVR42s2beZRdVZXGf/uce99979WQOSEBBINKAINATINtuiGgaJSlIl1pHLEVUFarTds2iquhiDSuVnTRgtAKIoSZREaRgEElRgGFkBFEEjKAmUiqUuOb7j1n9x/3vRqSSlkDQ+5ad72qV3WH/Z29vz2cvYXX7FBhEYbnUBaIr30745s6oaTxMSaOjzfYozSuTBe1U0RpxBEJIJ4YpVNdsttIuMl485fE2FW5IFi7+ieyte9TTj5Zg2XLcCD6Wry1vGaCzxdX+2b6t/XtvlSeh/PvF+dOEM80Y3LpKzsPSYx4D17T7zwIFsECFvGgLgaftAp2jYp9LBBZsvbm6NnaM5qa1C5ejB8tEKMDYJHaHsGbNXhLlo9SiT9PHJ8W2HxE4qFSROMY8epSABDxioD0vL4H8aKooqDiQTzGSChis4gJ0Uo3wJ8w2ZtNYu9ae4fs6QWiF/w3BgBVYXF11Zs1OKSez0g5vlDEHisOtNgFiUuMR8RjUBHpJ2yfle/7WT3FVz9VFcWrogYNjK1DTIQm5ZeR8Mfi7Y9TIFRoRvqa3usHQJNaqohPvUo/IK5yudXMbMplKBa8qCiKEYdUV7Iq9EgAqH5HFQyvqqgaE1kbNOBdZbMR+99rbgtuTPnht8GyZXOT1w+Aqsq/5Todl8TJlXj5giQOCt1OVEScmB6BnfIaA9Dzd1DFqzMmCkxQj2ryqCThV9fcLS8OlxuGDkCzBiyQZNKPKnMs5qcGe6R2tvlUUGPEg7g+Ar+uANSuU6+o2nCsFe/3eOxX190V3AZq+txh0MMMjeXVskCSyf9XPM9YsxTvjvTdbQliDGIMb9YhYkSMdXGb8744zlhz67GfiL/bC7fKKAHodXETf1ppJsper+VCVitFh5iAA+QQjFUfa1JpdWKCi2aeXbrzbR98MQJRmtWM0ARUaMayQJIJN5W/Y4LMxexpd+Iw4kVq6i5O6f35DTaBmoL3VXTvkzA7MXBJ8ZfF9txZGx6h0ueKYWhAVfjxC0uXSpS52Hd0JAgGEeFAPsQEcakltkHuw7kxxdtRoAmzP3MwgxHemNvKX5AoWuA7OxMRtXCAC99DDRJWQThr5tndP2SxuJNPxg4NgEWLLAskGbeo8h4TmOu00OVF/aDCC2ANBCb9NHKAgFBujY2t+8rMpu7zly2TpKlJ7eAcoCpchow5jkbK5RXGy3TpLjnxYntsve/pwXrFx9BVTD+tQmSEnFECwHjwDtS9QRygfYVSRQIvko3VRCeuu0vW0LTIsni+G1gDFmNYIF7j4g8kG03XUjFBxO4PZSvQXVECC2cdm+Gi92U556QMM6YYFGjpVnZ3KYWKon205I3TEBF1CSKSFdd146zzNWyqEfw+GlCN8uoeiE+1mF9LRyERp4FJaiveXwMCn676uyYbfnxmnqMm9+LkPGzY5Vi1xfH0SwkrNzk273R0dCt4yBolGwiBgNGqhvjXQwPS31V9EmQnBj4uXrR2cf7KvgmU9HF5wjRs/aTSnwzhcdLd7cSJHQgA48DF0BjC786tZ1qjIfG9D7Z7MYvzsPFVx5otjj+9mLBqY8LmnY62ztRVRhZyobxuAICqSKgY20ks71x7X35rKrv4NJhpftyyYG6S/2XyaTHZ42jtcDCI6hvYU1bOPSFiWqMhdhDa/s9UTc/a/7/9IMvbD7KcdWIGr7Bpp2PNZsczf0lYuSFh03aH6v4DE5He+43EFLxWXGAnjnF0fxPky01NahYvBgEVFHiOML+xtNJqcJQUiioJRhwMpAGBQmuncsNH8nzq2BCv+666kqp1baGEXgHMXjzgPVz7iyLfuaPIhHrBJf01wCuoU6IgvY+vEqf6oWpAlRAxYDKF0NUds/JeeZlmFcNvsYhobmvyYclmj9Zy0YOYoWRRVgZ2jq5qDsb0d4+BTc+9SdAYOOPvIvKRkLj+vskr5DIwtl5o61J2tytdBSVx6T2HHpmIKN7ZoK4usYUvAnry45iAU0hx9O58TDDqOltfbfjjxoSnNiRs2unY3a5UYggExuRgcoPhsEmGdxxsmT7F8taphjNOyvDzZWXG1QnOp0AYgXKs/ODL9RgRnlwbs3p9woZXHLtaPfmsEJihmYeoGJ90geqnj/20XrHsNukOEPHR0uJ0EuZSKMjQMsT9FYrSF35gdYVrHiuz7pWEcjmNBYLqjdWl6qwuVeOMgbF5wzvfYslHQpQRfB/Vthb2dMCdS8vc8M0GTjkhBODVVs/jK2K+e0s33QUIgyGAIBjvSj7IjDvUlwunAQ8GAEbshyQfRhQ6E5BhZ3laXXkjcOlDJa5aWqLOKnUZoTFMbbV/MlRFuWrH5Vj5w3MxAtRFkoJTMycH4xqEJU9V+PXTFU6ZlUEVJo83zH9/xKTxhvMu7yAMZMh8iFhR/JnAgyZdOT2d1PZkpGpvBH74eJnvLS0xuUGoiwSvkPiUE/Y+E5ee3qdc0pAX6rOy31W0Bm5+uJSG2ia9znmYOytkxuEBxbIylMqEKMa7bhHVf5x1vuYNT7SNV+/fTbkCOjL1Dy1sbvV8/zclJtdLj5A191UjQduXDKuCSNX9V6vkAx7OQ11WWL0+4a+v+pREJb1egfp8H7MZQhFFXRng8KSteHyQLeVnIv4g4jIjTXUFuHdNhT1FZUpeSOL0OwFiB3sKacBjqxyAS3OBjIHIChmb/s27/YNgDHSXlG27PIdMNmnMIP3d69C5Sp0JslY1OSnwcJzJREKp4gA7UgJc8Yoj7MPGIqn6j6sTzvn7iBnTLA0RFMuwq92zbbdn/TbHxu2OnS2eJIFsAPmMYG1q+z1RX03TAmHyeHmNdnQU75NZAUaOGu3dVGF3t2L7AGAEOsrK1Z/K87ETMvu9dk+X8tyWhOVrY5atSXhhS+o58iFEgWCqJrJ9l+ez87IcPtXi/egqEwKimoAwI8C56aTlPRnNHTO2vyqKpOrcXdaU9Hxq93ur9bh6Yc4xIXOOCfnGfFixPuGhJyr8bk3M9l2eYkXJhvCZeVkuP78OX40ujYDTlEBH8L6CjxEJpgUYpqSx5+j21w4bb1i2vndlvEImgNufqPDJkyLCKukNpD2+T84w+8iA2UcGlGPYuM3RVVQmjxUOO8gOmI6POE1WDxqPMxhprMI6KkN47/SgJ+avxfcNOeHJDQm3/qGMMb2eYaBQXapsX3NvUQhHHWaZPSPoEV4VOgvK16/uYu4FbfzmmUrPs0bCASJkDF6jQdOwIQZCHzgy5NAxhlLSH4QxOeHb9xZZv8NjTX+Wr8UPNd9ei+1rucLNS0qcdmE7Tf/VwaZtDhG4/GcFbn2kxAubE25fUmZ0b20wrwWfVhIYnxfOOTFDe1F7bF0VgiDlgS/d2EV3WfupvRFYtyXhohu7OefKTh58spK6NoGfLSnxtWu7+eurnqVPV7jlkRIAy1dViII0yDptdtj7oBEeBiEebbG3trIXzIk4aoqhu9IblXkHjTlh1WbH128tYKru0Qg8+myFMy7r4JbHyjy2MuaL/9vFyvUpH920pMykMYbGOiGXFXJR+o4XfDzHOw6zLDivjk98MJsKMUImBMUI0pm+7cgbDaSqUY1Z4btn5invxamxg0kNwt1/qHD1wyVCCzvbPN+4uQAIE8cIExtTf/fshvTiYlnTwGe3Z9pEwyffn0WBz34oy2PXjOVLZ+VGufiCV58YTfxujN2rqjACVaqS3KlHBnztfRG7OrVflShxMKFRuOKeIutedqze7Nja4qnLQpxUawgCR0xNL7rkM3mOOTxg3kkZbr+0kUMmm57iSI1fatHg8EFQFTEYk2kPsGzGyMkjQcBrf1IzkgryrXk51r3iWLo2ZkJeSKq+21YJ7pI7CjS9Jy2NiaS5wY4Wz/uOzzBnZogqfHROho/OyfRzl7XQt+YpwgBaO5SNWx1RRoYBhChiBdhhwPxlpNFffUZ6GNtVk5laLfCaT+Z56yRDe0F7CiTOw5i88MQLMbs7PXNnBmxr8XQUlNNnZbjmy3UEtjc56guySG/CZEwqfEe38q1ru2hp92SCYWiCqorJgOr6AJFVxMmwMkFViAJ4ZH3MEeOEoybbfWqCkxoMd1/QwEeu6qS7qATSW9+zVlj+fMzCf2/gd+tixjcYTjwy6FdUqTmnGsCqvYHUpm2OXyyvcN9vy2zZ7mjIy4AxxmAOEBHE2pWBDYLVWim1EoTjcbEOJcr2miYtd6yucN+aCjMmGGYfHDDzIMvh4w0NkeC9UijDOw4yPLU+IQykp1qcy8CLWz2VBOa9e181HwhwEVi+OuaOR0v8flXMnnalLiup8MNskRLBqCvjffBUUJwj23K/Kq0hypxCOfZDzQhVoTESfKKs3e5YscUhDjJAKII4pVxWclbIZwTv9o044kRxXnpKXwMJ73268tc/UOTS6wtkQ8hnhYljU8GHs/I9BGgiwbsdzvkVQXVb5NcSyino8IjQVQPIWulLqnuAWq0r5wOp1gB7hTcGSiU4eKph4hiTfi+D1BhNGv7e8GCJMfVCLgNJknqVkTguVby1OeOl+OQL9zS0mPSlol9QqvjqPqAOt8OqVvpK9iJC5/sTkzFpLbCzpHzutDQCd9qbOe5NYrXfN21ztHcpmYAqXY2uDoAYQe0DaSSoKoVTWUPiV5DN02e74W8ete2wvtviphrK1mL6vvsCxbKydY/ylQ9lmf/eqOdvxYr2XNfXrdZ+XP9XR6Gsr0F3gqoxoXVxV5sl9zBAwONY5kqijyY3ijWz0zeQITFpYwRt3dBaUAKFEAgRREGStPztEogrKbEcPdVy0blZzpiVoa1bWfJMhfufrPDyTse73hpwxb/kmdBgcL66t1BF4PnNbr8EOcy1dzZsDHxSvGfVYtnV1KQ24BQcQHaCvauyrdQsmeggyhU/2P5AYNKt70tOz3LiwZYnNjte3OnY0uLZ06mUK2kNMGsMk+sNx73FMm9myKzpAZtf9TTfVeDhZyq8vMMTmrTyc8/yCi9tddzyjQamjk9BqLm9F192hHZUOU+V6sR4V3SIXpd2A9SWuro1Xv/LysViw+/Q2pEYJ8Fge4Ntncr8o0NuOiu/T9xfSVJ1zWd6l+xXa2JufrzM8udiSiWlPhKyVcZRB6GBPR3K26Zabru4gUMmpSCUKsoHv9bOjhZPFPQa6PB2h0HVuyAzzvqkeP/anzecSbMaFohPMW7CoyphJrxOi+WtEkZ2MC5wHsZkhfv/HPPQC/E+JfK6KHV9L+5wXPFgkdmXtHP21V38Zl1MNkwTn0zQWwBRTcltbL2wcbvjE5d38tI2hzWws1XZ2TrMSG+g1Rcj3lcSa+ovG7hFRtUi4hruK39OwsxN0tLuRI3dX4OE8WmPgPXKxadkmX9shgl1QndZWb4h4a4/lvn9Cwnt3Up9IOSCdNVcMniLTGCgo1M5dJLhinPreHxFzE0Pl2jMp6n1iBok8EmQmRi4pPu6dYvr/3WABok+XSJN+Iaflx8zJjpV2tud8cYOBIC4tLtDY6WzoBxcb5iSFzoKysu7PDilMSOE1e0thtEjFAClCsQVxQrkMtWUbyQNEl692EgQ2ZaN6t719HT2sOAyYIHft0foORQRFRudj6t0EGYE9fq3NkPH54WOkvLnHY6dHcqYvDA2Lz2ucriq63xaUG3IC/lIRuP3VUW8sTkRCb709K3S0vQ8UhN+XwAWiGeR2o6Py0sKF0guZ5DBhxFqQyCBTUmvZtvDD1EHqBYPsl02xKQvCbPjA+9KP1hzd/ahgYYrZLBGybF3FL9ng+x/aktHbJRwoDa5A65VVtOyv6pLgmhC4JPi0hmanwcwUBu9/K2JkPG3VO4yQfjP2tqWGDXBgQ+AgLrEZsYGqskqE2Xnrl5Ie60pamitsiJKE55mNa3Z8LO+HD9kGscGqj7hAD9UfRxkxgbA88b5M1YvlLbm5oGFH7xZWqqqMl8q4zvCf9I4vsc0jg1QTVDVA1J4fBJG40LgWQmD01cvrtva1KR2wSCzRDKkASlJhw+m3OCvEsy/aWcnEnsn2qeF9s00Aa8eQW00wWpSedREmbNXL5S2vvNNI58YEVE0baXbeZ690Lv4AjK5gmTrLerfbG1QVZ9IEBkTjrHeJd9f6zIfXr1Q2mhWwxDG6WQkA5JTf6InUPY/MmLeo51dSJIk4rHi0vG4N0ID0FQDbTQeTeItirlw3Z3h/YBUU0cd2s4QwyglzxfHIrXbvyjPbo/MyaruIpOJWkx+bJAWGTRB1b+uC453qGLDsVaCfIKLr7PZzOx1d4b306RpTVlEX9/ByWomBTDlKj08qPj/MHF8jrFRA8UiWi558arijYhiRqcBqgpe1GMIrQka8ElBxeTuEWv/Z+1CWbH3POMbNDrbf2b40O/pEVrxn7cuPlvITBcvUCpCXAavrmoOgqaNagMDoIoXFe9RRI1iRTJIkMcg+LjYIoT3Ily/7tbMM72Cj3yGePRbw81qOAapATHlSq3LFzhVK/HHcMk/SOKOMCaXDlQmMepiJHGpTfdogiCa9miKWAyZNKBxFfC6DbFPAQ8h2SXPL5QdPc+the9v7vR4HyDAsEB6gqWpzZrPVeLjJfEnkbhZeGaIl2maVMYZyIiadLrPK+J8goTtorID1fWGYKV3+hQN2RUvXCst9J0aP7r/iP5ojv8HjOiNIYQGpy0AAAAASUVORK5CYII=";
const ICONE_IDENTITE = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fbfbfe" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 11.5-4.2"/><path d="M21 13a4 4 0 1 0-1.2 2.9"/><path d="M21 10v3h-3"/></svg>');

// Bouton Seyra dans la barre latérale verticale (à côté de l'historique, des favoris…) :
// il ouvre le même panneau que le bouton de la barre d'outils.
function seyraBarreLaterale(win) {
  const sc = win.SidebarController;
  if (!sc?.toolsAndExtensions || sc.toolsAndExtensions.has("cigale-seyra")) return;
  sc.toolsAndExtensions.set("cigale-seyra", {
    commandID: "cigale-seyra", view: "cigale-seyra", name: "cigale-seyra",
    iconUrl: ICONE_SEYRA, tooltiptext: "Seyra", disabled: false,
  });
  for (const nom of ["toggle", "recordIconClick"]) {
    const orig = sc[nom].bind(sc);
    sc[nom] = (id, ...r) => id == "cigale-seyra" ? (nom == "toggle" ? basculerPanneau(win) : undefined) : orig(id, ...r);
  }
  win.dispatchEvent(new win.CustomEvent("SidebarItemAdded"));
}

export function basculerPanneau(win) {
  const doc = win.document;
  let boite = doc.getElementById("cigale-panneau");
  if (boite) {
    const cache = !boite.hidden;
    boite.hidden = cache;
    doc.getElementById("cigale-panneau-separateur").hidden = cache;
    return;
  }
  const adresse = P.getStringPref("cigale.panneau.adresse", "https://seyra.website/");
  const separateur = doc.createXULElement("splitter");
  separateur.id = "cigale-panneau-separateur";
  separateur.setAttribute("resizebefore", "sibling");
  separateur.setAttribute("resizeafter", "sibling");
  boite = doc.createXULElement("vbox");
  boite.id = "cigale-panneau";
  boite.style.cssText = "width: 400px; min-width: 280px; max-width: 60vw;";
  const entete = doc.createXULElement("hbox");
  entete.setAttribute("align", "center");
  entete.style.cssText = "padding: 4px 8px; gap: 6px; border-bottom: 1px solid var(--chrome-content-separator-color, #0002);";
  const titre = doc.createXULElement("label");
  titre.setAttribute("flex", "1");
  titre.style.cssText = "font-weight: 600; margin: 0;";
  titre.setAttribute("value", new URL(adresse).hostname.replace(/^www\./, ""));
  const ouvrir = doc.createXULElement("toolbarbutton");
  ouvrir.setAttribute("label", "Onglet");
  ouvrir.setAttribute("tooltiptext", "Ouvrir dans un onglet");
  ouvrir.addEventListener("command", () => win.openTrustedLinkIn(adresse, "tab"));
  const fermer = doc.createXULElement("toolbarbutton");
  fermer.setAttribute("label", "×");
  fermer.setAttribute("tooltiptext", "Fermer le panneau");
  fermer.addEventListener("command", () => basculerPanneau(win));
  entete.append(titre, ouvrir, fermer);

  const navigateur = doc.createXULElement("browser");
  for (const [k, v] of Object.entries({
    type: "content", remote: "true", maychangeremoteness: "true", flex: "1",
    disableglobalhistory: "true", messagemanagergroup: "browsers", autocompletepopup: "PopupAutoComplete",
  })) navigateur.setAttribute(k, v);
  boite.append(entete, navigateur);
  doc.getElementById("browser").append(separateur, boite);
  navigateur.fixupAndLoadURIString(adresse, { triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({}) });
}

// ---------- 10. Veille et onglets éphémères ----------

function veille() {
  const minutes = P.getIntPref("cigale.veille.minutes", 30);
  const ephemeres = P.getIntPref("cigale.ephemere.minutes", 15);
  const maintenant = Date.now();
  for (const w of fenetres()) {
    const g = w.gBrowser;
    for (const t of [...g.tabs]) {
      if (t.selected || t.pinned || t.soundPlaying || t.closing) continue;
      const inactif = maintenant - (t.lastAccessed || maintenant);
      if (t.hasAttribute("cigale-ephemere") && ephemeres > 0 && inactif > ephemeres * 60000) {
        g.removeTab(t);
        continue;
      }
      if (minutes > 0 && t.linkedPanel && inactif > minutes * 60000 && hoteDe(t.linkedBrowser.currentURI)) {
        try { g.discardBrowser(t); } catch {}
      }
    }
  }
}

async function effacerEphemere(onglet) {
  const domaine = base(hoteDe(onglet.linkedBrowser.currentURI));
  if (!domaine || sitesConserves().has(domaine)) return;
  for (const w of fenetres()) {
    for (const t of w.gBrowser.tabs) {
      if (t != onglet && !t.closing && base(hoteDe(t.linkedBrowser.currentURI)) == domaine) return; // encore ouvert ailleurs
    }
  }
  await lazy.ForgetAboutSite.removeDataFromBaseDomain(domaine).catch(() => {});
}

export function ouvrirEphemere(win, url) {
  const g = win.gBrowser;
  const t = g.addTrustedTab(url || P.getStringPref("browser.startup.homepage", "about:home").split("|")[0]);
  t.setAttribute("cigale-ephemere", "true");
  g.selectedTab = t;
}

// ---------- 14. Bouton panique (1.5) ----------
// Tout fermer et tout effacer d'un coup, sans question : bouton rouge du panneau cigale ou Ctrl+Maj+F12.

export function panique(win) {
  // l'assistant local s'arrête aussi : sa mémoire de conversation disparaît avec lui
  try {
    const A = ChromeUtils.importESModule("chrome://browser/content/cigale/assistant/assistant.sys.mjs");
    A.arreter();
    A.effacerConversations().catch(console.error);
  } catch {}
  return nouvelleIdentite(win, { confirmer: false, message: "Panique : onglets fermés, cookies, cache et historique effacés." });
}

// ---------- 15. Copier le lien propre (1.5) ----------

export function copierLienPropre(win) {
  const adresse = win.gBrowser.currentURI?.spec || "";
  if (!/^https?:/.test(adresse)) return null;
  const propre = nettoyerURL(adresse);
  copier(propre);
  if (propre != adresse) bilan.lienNettoye().catch(() => {});
  return { propre, retire: Math.max(0, adresse.length - propre.length) };
}

// ---------- 16. Coffres : un site, ses propres cookies (1.5) ----------
// Un site « au coffre » s'ouvre toujours dans son conteneur à lui (cookies, stockage et connexion
// séparés du reste) ; l'onglet porte la couleur de son coffre.

const SITES_SENSIBLES = [
  "credit-agricole.fr", "societegenerale.fr", "bnpparibas.net", "mabanque.bnpparibas", "lcl.fr", "labanquepostale.fr",
  "caisse-epargne.fr", "banquepopulaire.fr", "creditmutuel.fr", "cic.fr", "boursorama.com", "boursobank.com",
  "fortuneo.fr", "hellobank.fr", "revolut.com", "n26.com", "qonto.com", "paypal.com", "impots.gouv.fr", "ameli.fr",
  "caf.fr", "franceconnect.gouv.fr", "ants.gouv.fr", "doctolib.fr",
];
const COULEURS_COFFRE = ["turquoise", "green", "yellow", "orange", "pink", "purple", "blue", "red"];

export function coffres() {
  const l = new Set(lireListe("cigale.coffres"));
  if (P.getBoolPref("cigale.coffres.sensibles", false)) for (const d of SITES_SENSIBLES) l.add(d);
  for (const d of lireListe("cigale.coffres.retires")) l.delete(d);
  return l;
}

export function estAuCoffre(hote) {
  return !!hote && coffres().has(base(hote));
}

function identiteCoffre(domaine, creer) {
  const CIS = lazy.ContextualIdentityService;
  const nom = "Coffre " + domaine;
  let i = CIS.getPublicIdentities().find((x) => x.name == nom);
  if (!i && creer) {
    let h = 0;
    for (const c of domaine) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    i = CIS.create(nom, "fence", COULEURS_COFFRE[h % COULEURS_COFFRE.length]);
  }
  return i?.userContextId || 0;
}

const deplaces = new WeakSet();

function ouvrirAuCoffre(win, onglet, adresse) {
  const domaine = base(hoteDe(Services.io.newURI(adresse)));
  const id = identiteCoffre(domaine, true);
  if (!id) return;
  const g = win.gBrowser;
  const nouvel = g.addTab(adresse, {
    userContextId: id,
    index: onglet._tPos + 1,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  deplaces.add(nouvel.linkedBrowser);
  if (onglet.selected) g.selectedTab = nouvel;
  // l'ancien onglet n'avait rien d'autre à montrer : on le ferme
  const reste = hoteDe(onglet.linkedBrowser.currentURI);
  if (!reste || base(reste) == domaine) g.removeTab(onglet);
}

function verifierCoffre(win, browser, uri) {
  if (!P.getBoolPref("privacy.userContext.enabled", false)) return false;
  if (lazy.PrivateBrowsingUtils.isWindowPrivate(win) || deplaces.has(browser)) return false;
  const hote = hoteDe(uri);
  if (!estAuCoffre(hote)) return false;
  const onglet = win.gBrowser.getTabForBrowser(browser);
  if (!onglet) return false;
  const id = identiteCoffre(base(hote), false);
  if (id && onglet.userContextId == id) return false;
  browser.stop();
  lazy.setTimeout(() => ouvrirAuCoffre(win, onglet, uri.spec), 0);
  return true;
}

// Mettre le site ouvert au coffre (ou l'en sortir). Renvoie l'état après le changement.
export function basculerCoffre(win) {
  const g = win.gBrowser;
  const hote = hoteDe(g.currentURI);
  if (!hote) return false;
  const domaine = base(hote);
  const liste = new Set(lireListe("cigale.coffres"));
  const retires = new Set(lireListe("cigale.coffres.retires"));
  const sauver = () => {
    P.setStringPref("cigale.coffres", JSON.stringify([...liste].sort()));
    P.setStringPref("cigale.coffres.retires", JSON.stringify([...retires].sort()));
  };
  if (estAuCoffre(hote)) {
    liste.delete(domaine);
    if (SITES_SENSIBLES.includes(domaine)) retires.add(domaine);
    sauver();
    barre(win, null, "cigale-coffre", `${domaine} n'est plus au coffre : il s'ouvrira de nouveau dans un onglet ordinaire.`, [], "PRIORITY_INFO_MEDIUM");
    return false;
  }
  liste.add(domaine);
  retires.delete(domaine);
  sauver();
  if (!P.getBoolPref("privacy.userContext.enabled", false)) P.setBoolPref("privacy.userContext.enabled", true);
  const onglet = g.selectedTab;
  if (!lazy.PrivateBrowsingUtils.isWindowPrivate(win) && onglet.userContextId != identiteCoffre(domaine, true)) {
    ouvrirAuCoffre(win, onglet, g.currentURI.spec);
  }
  barre(win, null, "cigale-coffre",
    `${domaine} est au coffre : ses cookies et sa connexion restent à part. Vous devrez peut-être vous reconnecter une fois.`,
    [], "PRIORITY_INFO_MEDIUM");
  return true;
}

// ---------- par fenêtre ----------

const refusLecture = new Set();

function installerFenetre(win) {
  if (win.cigalePlus || !win.gBrowser) return;
  win.cigalePlus = true;
  try { seyraBarreLaterale(win); } catch (e) { console.error("La Cigale : barre latérale", e); }
  try { bilan.suivre(win); } catch (e) { console.error("La Cigale : bilan", e); }
  try { ChromeUtils.importESModule("chrome://browser/content/cigale/outils/outils.sys.mjs").fenetre(win); }
  catch (e) { console.error("La Cigale : outils", e); }
  const doc = win.document;
  const g = win.gBrowser;

  // Ctrl+Maj+F12 : panique
  try {
    const commande = doc.createXULElement("command");
    commande.id = "cigale-cmd-panique";
    commande.addEventListener("command", () => panique(win).catch(console.error));
    doc.getElementById("mainCommandSet").append(commande);
    const touche = doc.createXULElement("key");
    touche.id = "cigale-touche-panique";
    touche.setAttribute("keycode", "VK_F12");
    touche.setAttribute("modifiers", "accel,shift");
    touche.setAttribute("command", "cigale-cmd-panique");
    doc.getElementById("mainKeyset").append(touche);
  } catch (e) {
    console.error("La Cigale : raccourci panique", e);
  }

  // menu contextuel des liens : via Tor, en onglet éphémère, dans un profil
  const menu = doc.getElementById("contentAreaContextMenu");
  if (menu) {
    const sep = doc.createXULElement("menuseparator");
    sep.id = "cigale-sep-lien";
    const tor = doc.createXULElement("menuitem");
    tor.id = "cigale-lien-tor";
    tor.setAttribute("label", "Ouvrir le lien via Tor");
    tor.addEventListener("command", () => cigale.ouvrirFenetreTor(win, win.gContextMenu?.linkURL).catch(console.error));
    const eph = doc.createXULElement("menuitem");
    eph.id = "cigale-lien-ephemere";
    eph.setAttribute("label", "Ouvrir dans un onglet éphémère");
    eph.addEventListener("command", () => ouvrirEphemere(win, win.gContextMenu?.linkURL));
    const propre = doc.createXULElement("menuitem");
    propre.id = "cigale-lien-propre";
    propre.setAttribute("label", "Copier le lien sans pistage");
    propre.addEventListener("command", () => {
      const lien = win.gContextMenu?.linkURL;
      if (!lien) return;
      const net = nettoyerURL(lien);
      if (net != lien) bilan.lienNettoye().catch(() => {});
      copier(net);
    });
    const ref = doc.getElementById("context-openlinkincontainertab") || doc.getElementById("context-openlinkprivate");
    if (ref) ref.after(sep, tor, eph, propre);
    else menu.append(sep, tor, eph, propre);
    menu.addEventListener("popupshowing", (e) => {
      if (e.target != menu) return;
      const lien = !!win.gContextMenu?.onLink && /^https?:/.test(win.gContextMenu?.linkURL || "");
      for (const el of [sep, tor, eph, propre]) el.hidden = !lien;
    });
    // 13. « Copier le lien » donne un lien sans pisteurs
    doc.addEventListener("command", (e) => {
      if (!P.getBoolPref("cigale.copie.nettoyer", true)) return;
      if (e.target.id == "context-copylink" && win.gContextMenu?.linkURL) {
        const propre = nettoyerURL(win.gContextMenu.linkURL);
        if (propre != win.gContextMenu.linkURL) bilan.lienNettoye().catch(() => {});
        lazy.setTimeout(() => copier(propre), 30);
      }
    }, true);
  }

  // barre d'adresse : copie de l'adresse entière nettoyée
  const champ = win.gURLBar?.inputField;
  champ?.addEventListener("copy", () => {
    if (!P.getBoolPref("cigale.copie.nettoyer", true)) return;
    if (champ.selectionStart != 0 || champ.selectionEnd != champ.value.length) return;
    if (win.gURLBar.valueIsTyped) return;
    const adresse = g.currentURI?.spec;
    if (!adresse || !/^https?:/.test(adresse)) return;
    const propre = nettoyerURL(adresse);
    if (propre != adresse) {
      bilan.lienNettoye().catch(() => {});
      lazy.setTimeout(() => copier(propre), 30);
    }
  });

  // menu des onglets : rendre éphémère
  const menuOnglet = doc.getElementById("tabContextMenu");
  if (menuOnglet) {
    const item = doc.createXULElement("menuitem");
    item.id = "cigale-onglet-ephemere";
    item.setAttribute("type", "checkbox");
    item.setAttribute("label", "Onglet éphémère (effacé à la fermeture)");
    item.addEventListener("command", () => {
      const t = win.TabContextMenu.contextTab;
      if (t.hasAttribute("cigale-ephemere")) t.removeAttribute("cigale-ephemere");
      else t.setAttribute("cigale-ephemere", "true");
    });
    menuOnglet.addEventListener("popupshowing", (e) => {
      if (e.target != menuOnglet) return;
      item.setAttribute("checked", win.TabContextMenu.contextTab?.hasAttribute("cigale-ephemere") ? "true" : "false");
    });
    const ref = doc.getElementById("context_pinTab");
    ref ? ref.before(item) : menuOnglet.append(item);
  }
  g.tabContainer.addEventListener("TabClose", (e) => {
    if (e.target.hasAttribute("cigale-ephemere")) effacerEphemere(e.target).catch(() => {});
  });

  // navigation : sosies, site inconnu, lecture
  const precedent = new WeakMap();
  g.addTabsProgressListener({
    onStateChange(browser, webProgress, request, flags) {
      if (!webProgress?.isTopLevel || !(flags & Ci.nsIWebProgressListener.STATE_IS_DOCUMENT)) return;
      if (flags & Ci.nsIWebProgressListener.STATE_START) {
        // 16. site au coffre : il s'ouvre dans son conteneur
        try { if (verifierCoffre(win, browser, request.QueryInterface(Ci.nsIChannel).URI)) return; } catch {}
        // 7. JavaScript coupé avant le chargement d'un site inconnu
        let hote = "";
        try { hote = hoteDe(request.QueryInterface(Ci.nsIChannel).URI); } catch {}
        if (hote) {
          try { browser.browsingContext.allowJavascript = !estInconnu(hote); } catch {}
        }
      }
      if (flags & Ci.nsIWebProgressListener.STATE_STOP && P.getBoolPref("cigale.lecture.auto", false)) {
        // 11. lecture épurée automatique sur les articles
        lazy.setTimeout(() => {
          const adresse = browser.currentURI?.spec || "";
          if (!browser.isArticle || !/^https?:/.test(adresse) || refusLecture.has(adresse)) return;
          browser.fixupAndLoadURIString("about:reader?url=" + encodeURIComponent(adresse),
            { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
        }, 1200);
      }
    },
    onLocationChange(browser, webProgress, request, uri) {
      if (!webProgress?.isTopLevel) return;
      const avant = precedent.get(browser) || "";
      precedent.set(browser, uri.spec);
      if (avant.startsWith("about:reader?url=")) {
        try { refusLecture.add(decodeURIComponent(avant.slice(17))); } catch {}
      }
      if (verifierCoffre(win, browser, uri)) return;
      const hote = hoteDe(uri);
      const boite = g.getNotificationBox(browser);
      for (const id of ["cigale-sosie", "cigale-inconnu"]) {
        const n = boite.getNotificationWithValue(id);
        if (n) boite.removeNotification(n);
      }
      if (!hote) return;
      if (P.getBoolPref("cigale.sosies.actif", true)) {
        const vrai = sosieDe(hote);
        if (vrai) {
          barre(win, browser, "cigale-sosie",
            `Prudence : ${hote} ressemble à ${vrai} sans être ce site. C'est une technique courante d'hameçonnage.`,
            [{ label: "Aller sur " + vrai, callback: () => { browser.fixupAndLoadURIString("https://" + vrai, { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); } },
             { label: "Je sais ce que je fais", callback: () => { faireConfiance(base(hote)); } }],
            "PRIORITY_CRITICAL_MEDIUM");
          return;
        }
      }
      if (estInconnu(hote)) {
        const domaine = base(hote);
        barre(win, browser, "cigale-inconnu",
          `Site inconnu : JavaScript est coupé sur ${domaine} tant que vous ne lui faites pas confiance.`,
          [{ label: "Faire confiance", callback: () => { faireConfiance(domaine); browser.browsingContext.allowJavascript = true; browser.reload(); } }],
          "PRIORITY_INFO_HIGH");
      }
    },
  });
}

// ---------- démarrage ----------

let installe = false;

export function installer() {
  if (installe) return;
  installe = true;
  try { bilan.installer(); } catch (e) { console.error("La Cigale : bilan", e); }
  try {
    ChromeUtils.importESModule("chrome://browser/content/cigale/sudoku/jeu.sys.mjs").installer();
  } catch (e) { console.error("La Cigale : sudoku", e); }
  try {
    ChromeUtils.importESModule("chrome://browser/content/cigale/outils/outils.sys.mjs").installer();
  } catch (e) { console.error("La Cigale : outils", e); }

  try {
    ChromeUtils.registerWindowActor("CigalePlus", {
      parent: { esModuleURI: "chrome://browser/content/cigale/plus.sys.mjs" },
      child: {
        esModuleURI: "chrome://browser/content/cigale/plus-enfant.sys.mjs",
        events: { submit: { capture: true, mozSystemGroup: true } },
      },
      allFrames: true,
      matches: ["http://*/*", "https://*/*"],
      messageManagerGroups: ["browsers"],
    });
  } catch (e) {
    console.error("La Cigale : acteur", e);
  }

  Services.obs.addObserver((win) => {
    try { installerFenetre(win); } catch (e) { console.error("La Cigale : fenêtre", e); }
  }, "browser-delayed-startup-finished");

  lazy.setInterval(() => { try { veille(); } catch (e) { console.error(e); } }, 60000);

  lazy.Downloads.getList(lazy.Downloads.ALL).then((liste) => liste.addView({
    onDownloadChanged(d) {
      if (!d.succeeded || telechargementsVus.has(d)) return;
      telechargementsVus.add(d);
      verifierTelechargement(d).catch(console.error);
    },
  })).catch(console.error);

  // boutons de la barre d'outils
  try {
    let CustomizableUI;
    for (const url of ["moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs",
                       "resource:///modules/CustomizableUI.sys.mjs"]) {
      try { ({ CustomizableUI } = ChromeUtils.importESModule(url)); break; } catch {}
    }
    CustomizableUI.createWidget({
      id: "cigale-identite-button",
      label: "Nouvelle identité",
      tooltiptext: "Tout effacer et changer de proxy : les sites ne peuvent plus vous relier à avant",
      defaultArea: CustomizableUI.AREA_NAVBAR,
      onCreated: (n) => n.setAttribute("image", ICONE_IDENTITE),
      onCommand: (e) => nouvelleIdentite(e.target.ownerGlobal).catch(console.error),
    });
    CustomizableUI.createWidget({
      id: "cigale-panneau-button",
      label: "Panneau Seyra",
      tooltiptext: "Afficher ou masquer Seyra sur le côté",
      onCreated: (n) => n.setAttribute("image", ICONE_SEYRA),
      onCommand: (e) => basculerPanneau(e.target.ownerGlobal),
    });
    // Une seule fois par profil : Seyra quitte la barre d'outils (il est dans la barre latérale)
    // et le bouton de la barre latérale passe tout à gauche, au-dessus de la colonne d'icônes.
    if (!P.getBoolPref("cigale.barre.rangee", false)) {
      CustomizableUI.removeWidgetFromArea("cigale-panneau-button");
      CustomizableUI.addWidgetToArea("sidebar-button", CustomizableUI.AREA_NAVBAR, 0);
      P.setBoolPref("cigale.barre.rangee", true);
    }
    const css = `
      #cigale-identite-button { list-style-image: url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="context-fill" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 11.5-4.2"/><path d="M21 13a4 4 0 1 0-1.2 2.9"/><path d="M21 10v3h-3"/></svg>')}"); }
      #cigale-panneau-button { list-style-image: url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="context-fill" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/><path d="M17.5 9h1M17.5 12h1"/></svg>')}"); }
      #cigale-identite-button, #cigale-panneau-button { -moz-context-properties: fill; fill: currentColor; }
      .tabbrowser-tab[cigale-ephemere] .tab-background { outline: 1.5px dashed #a9b89a; outline-offset: -2px; }
      .tabbrowser-tab[cigale-ephemere] .tab-label { font-style: italic; }`;
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
    const uri = Services.io.newURI("data:text/css;charset=utf-8," + encodeURIComponent(css));
    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
  } catch (e) {
    console.error("La Cigale : boutons 1.4", e);
  }
}

// ---------- 4. Bouclier de formulaires (côté navigateur) ----------

export class CigalePlusParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name != "Formulaire") return null;
    const { raisons, cible, page, motDePasse } = message.data;
    const win = this.browsingContext.topChromeWindow;
    const quoi = motDePasse ? "votre mot de passe" : "votre identifiant ou adresse e-mail";
    const pourquoi = [];
    if (raisons.includes("non chiffre")) pourquoi.push("l'envoi n'est pas chiffré : n'importe qui sur le réseau peut le lire");
    if (raisons.includes("autre site")) pourquoi.push(`il part vers ${cible}, un autre site que ${page}`);
    const bouton = Services.prompt.confirmEx(win, "Bouclier de formulaires",
      `Ce formulaire envoie ${quoi}, et ${pourquoi.join(" ; ")}.\n\nL'envoyer quand même ?`,
      Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
      Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_IS_STRING + Services.prompt.BUTTON_POS_1_DEFAULT,
      "Envoyer quand même", "Ne pas envoyer", null, null, {});
    return bouton == 0;
  }
}
