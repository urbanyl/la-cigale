// La Cigale 1.4 : fonctions intégrées au navigateur (anonymat, sécurité, confort).
// Chargé par cigale.cfg : ChromeUtils.importESModule("chrome://browser/content/cigale/plus.sys.mjs").installer().

import * as cigale from "chrome://browser/content/cigale/cigale.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  Downloads: "resource://gre/modules/Downloads.sys.mjs",
  ForgetAboutSite: "resource://gre/modules/ForgetAboutSite.sys.mjs",
  ContextualIdentityService: "resource://gre/modules/ContextualIdentityService.sys.mjs",
  setInterval: "resource://gre/modules/Timer.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
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

export async function nouvelleIdentite(win) {
  const ok = Services.prompt.confirm(win, "Nouvelle identité",
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
  barre(win, null, "cigale-identite", "Nouvelle identité : tout est effacé." + proxy, [], "PRIORITY_INFO_MEDIUM");
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

// ---------- par fenêtre ----------

const refusLecture = new Set();

function installerFenetre(win) {
  if (win.cigalePlus || !win.gBrowser) return;
  win.cigalePlus = true;
  const doc = win.document;
  const g = win.gBrowser;

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
    const ref = doc.getElementById("context-openlinkincontainertab") || doc.getElementById("context-openlinkprivate");
    if (ref) ref.after(sep, tor, eph);
    else menu.append(sep, tor, eph);
    menu.addEventListener("popupshowing", (e) => {
      if (e.target != menu) return;
      const lien = !!win.gContextMenu?.onLink && /^https?:/.test(win.gContextMenu?.linkURL || "");
      for (const el of [sep, tor, eph]) el.hidden = !lien;
    });
    // 13. « Copier le lien » donne un lien sans pisteurs
    doc.addEventListener("command", (e) => {
      if (!P.getBoolPref("cigale.copie.nettoyer", true)) return;
      if (e.target.id == "context-copylink" && win.gContextMenu?.linkURL) {
        const propre = nettoyerURL(win.gContextMenu.linkURL);
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
    if (propre != adresse) lazy.setTimeout(() => copier(propre), 30);
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
      onCommand: (e) => nouvelleIdentite(e.target.ownerGlobal).catch(console.error),
    });
    CustomizableUI.createWidget({
      id: "cigale-panneau-button",
      label: "Panneau Seyra",
      tooltiptext: "Afficher ou masquer Seyra sur le côté",
      defaultArea: CustomizableUI.AREA_NAVBAR,
      onCommand: (e) => basculerPanneau(e.target.ownerGlobal),
    });
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
