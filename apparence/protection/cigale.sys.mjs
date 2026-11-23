// Fonctions partagées entre cigale.cfg (boutons, démarrage) et about:cigale.
// Chargé avec ChromeUtils.importESModule("chrome://browser/content/cigale/cigale.sys.mjs").

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ForgetAboutSite: "resource://gre/modules/ForgetAboutSite.sys.mjs",
});

const prefs = Services.prefs;

function notifier(win, id, texte, duree = 6000) {
  try {
    const boite = win.gNotificationBox;
    boite.removeNotification(boite.getNotificationWithValue(id));
    const n = boite.appendNotification(id, { label: texte, priority: boite.PRIORITY_INFO_LOW });
    if (duree) win.setTimeout(() => boite.removeNotification(n), duree);
  } catch (e) {
    console.error(e);
  }
}

function domaineDe(uri) {
  if (!uri || !/^https?$/.test(uri.scheme)) return null;
  try {
    return Services.eTLD.getBaseDomain(uri);
  } catch {
    return uri.host || null;
  }
}

// --- Oublier ce site ---

export async function oublierSite(win) {
  const gBrowser = win.gBrowser;
  const domaine = domaineDe(gBrowser.selectedBrowser.currentURI);
  if (!domaine) {
    notifier(win, "cigale-oubli", "Cette page n'est pas un site web : rien à oublier.");
    return;
  }
  const ok = Services.prompt.confirm(win, "Oublier ce site",
    `Effacer tout ce que La Cigale garde sur ${domaine} : cookies, cache, historique, ` +
    `autorisations et connexion ? Ses onglets seront fermés.`);
  if (!ok) return;

  const accueil = prefs.getStringPref("browser.startup.homepage", "about:home").split("|")[0];
  for (const onglet of [...gBrowser.tabs]) {
    if (domaineDe(onglet.linkedBrowser.currentURI) != domaine) continue;
    if (gBrowser.tabs.length == 1) {
      win.openTrustedLinkIn(accueil, "current");
    } else {
      gBrowser.removeTab(onglet);
    }
  }
  await new Promise((r) => win.setTimeout(r, 300));
  await lazy.ForgetAboutSite.removeDataFromBaseDomain(domaine);
  notifier(win, "cigale-oubli", `${domaine} est oublié : plus aucune donnée de ce site sur cet ordinateur.`);
}

// --- Fenêtre Tor ---

// Le port répond-il ? (Tor Browser écoute sur 9150, le service tor sur 9050.)
function portOuvert(port) {
  return new Promise((resolve) => {
    let fini = false;
    const sts = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
    const transport = sts.createTransport([], "127.0.0.1", port, null, null);
    const fin = (ok) => {
      if (fini) return;
      fini = true;
      try { transport.close(0); } catch {}
      resolve(ok);
    };
    const sortie = transport.openOutputStream(0, 0, 0).QueryInterface(Ci.nsIAsyncOutputStream);
    sortie.asyncWait({
      onOutputStreamReady() {
        // si la connexion a échoué, le transport n'est plus vivant
        fin(transport.isAlive());
      },
    }, 0, 0, Services.tm.mainThread);
    // garder une référence au minuteur, sinon il peut être ramassé avant de sonner
    const minuteur = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    minuteurs.add(minuteur);
    minuteur.initWithCallback(() => { minuteurs.delete(minuteur); fin(false); }, 1500, Ci.nsITimer.TYPE_ONE_SHOT);
  });
}
const minuteurs = new Set();

export async function portTor() {
  for (const port of [9150, 9050]) {
    if (await portOuvert(port)) return port;
  }
  return 0;
}

export function estFenetreTor() {
  return prefs.getBoolPref("cigale.tor", false);
}

export async function ouvrirFenetreTor(win, adresse = "") {
  if (adresse && !/^https?:\/\//i.test(adresse)) adresse = "";
  if (estFenetreTor()) {
    if (adresse) win.openTrustedLinkIn(adresse, "window");
    else win.OpenBrowserWindow();
    return true;
  }
  const port = await portTor();
  if (!port) {
    Services.prompt.alert(win, "Tor n'est pas lancé",
      "La fenêtre Tor a besoin que Tor tourne sur cet ordinateur.\n\n" +
      "• Le plus simple : installez Tor Browser (torproject.org) et laissez-le ouvert.\n" +
      "• Sous Linux, vous pouvez aussi installer le service : sudo apt install tor\n\n" +
      "Recommencez ensuite.");
    return false;
  }
  const dossier = Services.dirsvc.get("ProfD", Ci.nsIFile).parent;
  dossier.append("profil-tor");
  if (!dossier.exists()) dossier.create(Ci.nsIFile.DIRECTORY_TYPE, 0o700);
  await IOUtils.writeUTF8(PathUtils.join(dossier.path, "user.js"),
    `user_pref("network.proxy.socks_port", ${port});\n`);

  const exe = Services.dirsvc.get("XREExeF", Ci.nsIFile);
  const args = ["-profile", dossier.path];
  if (Services.appinfo.OS == "Linux") args.unshift("--name", "la-cigale-tor", "--class", "LaCigaleTor");
  if (adresse) args.push("-new-tab", adresse);
  const processus = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
  processus.init(exe);
  processus.runw(false, args, args.length);
  return true;
}

// --- Verrou au démarrage ---
// Ce n'est pas un chiffrement : le verrou empêche seulement d'ouvrir La Cigale sans le mot de passe.

function hex(octets) {
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}

const ITERATIONS_VERROU = 60000;
const VERSION_VERROU = 2;
const hacheSha256 = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);

function sha256(octets) {
  hacheSha256.init(Ci.nsICryptoHash.SHA256);
  hacheSha256.update(octets, octets.length);
  return Uint8Array.from(hacheSha256.finish(false), (c) => c.charCodeAt(0));
}

function concatener(a, b) {
  const sortie = new Uint8Array(a.length + b.length);
  sortie.set(a);
  sortie.set(b, a.length);
  return sortie;
}

// HMAC-SHA256 (RFC 2104).
function hmacSha256(cle, donnees) {
  const tailleBloc = 64;
  const k = cle.length > tailleBloc ? sha256(cle) : cle;
  const rembourrage = new Uint8Array(tailleBloc);
  rembourrage.set(k);
  const interieur = new Uint8Array(tailleBloc);
  const exterieur = new Uint8Array(tailleBloc);
  for (let i = 0; i < tailleBloc; i++) {
    interieur[i] = rembourrage[i] ^ 0x36;
    exterieur[i] = rembourrage[i] ^ 0x5c;
  }
  return sha256(concatener(exterieur, sha256(concatener(interieur, donnees))));
}

// PBKDF2-HMAC-SHA256, une sortie de 32 octets (RFC 8018).
function pbkdf2(motDePasse, sel, iterations) {
  const encodeur = new TextEncoder();
  const m = encodeur.encode(motDePasse);
  const s = encodeur.encode(sel);
  const bloc = new Uint8Array(s.length + 4);
  bloc.set(s);
  bloc[s.length + 3] = 1;
  let u = hmacSha256(m, bloc);
  const t = u.slice();
  for (let i = 1; i < iterations; i++) {
    u = hmacSha256(m, u);
    for (let j = 0; j < t.length; j++) t[j] ^= u[j];
  }
  return hex(t);
}

// Ancienne dérivation (1.3.2 et avant), conservée pour migrer les verrous existants.
function empreinteLegacy(motDePasse, sel) {
  const encodeur = new TextEncoder();
  let bloc = encodeur.encode(sel + ":" + motDePasse);
  for (let i = 0; i < 60000; i++) {
    hacheSha256.init(Ci.nsICryptoHash.SHA256);
    hacheSha256.update(bloc, bloc.length);
    bloc = Uint8Array.from(hacheSha256.finish(false), (c) => c.charCodeAt(0));
  }
  return hex(bloc);
}

function egalConstant(a, b) {
  if (typeof a != "string" || typeof b != "string" || a.length != b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export function verrouActif() {
  return prefs.getStringPref("cigale.verrou.empreinte", "") != "";
}

export function verifierMotDePasse(motDePasse) {
  const sel = prefs.getStringPref("cigale.verrou.sel", "");
  const stocke = prefs.getStringPref("cigale.verrou.empreinte", "");
  if (!stocke) return false;
  const version = prefs.getIntPref("cigale.verrou.version", 1);
  if (version >= VERSION_VERROU) {
    return egalConstant(pbkdf2(motDePasse, sel, ITERATIONS_VERROU), stocke);
  }
  if (egalConstant(empreinteLegacy(motDePasse, sel), stocke)) {
    definirMotDePasse(motDePasse);
    return true;
  }
  return false;
}

export function definirMotDePasse(motDePasse) {
  if (!motDePasse) {
    prefs.clearUserPref("cigale.verrou.sel");
    prefs.clearUserPref("cigale.verrou.empreinte");
    prefs.clearUserPref("cigale.verrou.version");
    return;
  }
  const alea = Cc["@mozilla.org/security/random-generator;1"].getService(Ci.nsIRandomGenerator);
  const sel = hex(alea.generateRandomBytes(16));
  prefs.setStringPref("cigale.verrou.sel", sel);
  prefs.setStringPref("cigale.verrou.empreinte", pbkdf2(motDePasse, sel, ITERATIONS_VERROU));
  prefs.setIntPref("cigale.verrou.version", VERSION_VERROU);
  Services.prefs.savePrefFile(null);
}

// Au démarrage, avant la première fenêtre : trois essais, sinon on quitte.
export function demanderMotDePasse() {
  if (!verrouActif()) return;
  for (let essai = 0; essai < 3; essai++) {
    const saisie = { value: "" };
    const texte = essai == 0
      ? "La Cigale est verrouillée. Entrez votre mot de passe :"
      : "Mot de passe incorrect. Réessayez :";
    const ok = Services.prompt.promptPassword(null, "La Cigale", texte, saisie);
    if (!ok) break;
    if (verifierMotDePasse(saisie.value)) return;
  }
  Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
}

// Adresse IP vue par les sites (IPv4 et IPv6), sans cookies ni référent
export async function adressesPubliques() {
  const lire = async (url) => {
    try {
      const r = await fetch(url, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
      return r.ok ? (await r.json()).ip : null;
    } catch {
      return null;
    }
  };
  const [v4, v6] = await Promise.all([lire("https://api.ipify.org?format=json"), lire("https://api64.ipify.org?format=json")]);
  return { v4, v6: v6 && v6.includes(":") ? v6 : null };
}

// --- Proxy personnel ---
// La liste vient de l'utilisateur (ip:port:identifiant:mot de passe, une par ligne) et reste
// dans son profil. Un filtre de canal choisit, pour chaque connexion, le proxy à utiliser :
// règle du site, sinon rotation, sinon le proxy coché. Les autres proxys de la liste servent de
// relais si le premier ne répond pas. Coupe-circuit : jamais de repli sur la connexion directe.
const PREF_LISTE = "cigale.proxy.liste";
const PREF_ACTIF = "cigale.proxy.actif";
const PREF_ROTATION = "cigale.proxy.rotation";
const PREF_MINUTES = "cigale.proxy.minutes";
const PREF_REGLES = "cigale.proxy.regles";
const PREF_COUPE = "cigale.proxy.coupe-circuit";
const PREF_ALERTES = "cigale.proxy.alertes";

function lireJSON(nom) {
  try {
    const v = JSON.parse(prefs.getStringPref(nom, "[]"));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function listeProxys() {
  return lireJSON(PREF_LISTE);
}

export function lireListeProxys(texte) {
  const liste = [];
  for (const ligne of String(texte).split(/\r?\n/)) {
    const t = ligne.trim().replace(/^(https?|socks5?):\/\//, "");
    if (!t || t.startsWith("#")) continue;
    const [hote, portTexte, utilisateur = "", ...reste] = t.split(":");
    const port = parseInt(portTexte, 10);
    if (!hote || !(port > 0 && port < 65536)) continue;
    liste.push({ hote, port, utilisateur, motDePasse: reste.join(":") });
  }
  return liste;
}

export function proxyActif() {
  return prefs.getIntPref(PREF_ACTIF, -1);
}

export function choisirProxy(i) {
  prefs.setIntPref(PREF_ACTIF, i);
}

export function enregistrerProxys(liste) {
  santeProxys.clear();
  prefs.setStringPref(PREF_LISTE, JSON.stringify(liste));
  if (proxyActif() >= liste.length) choisirProxy(-1);
  // les règles qui visaient un proxy disparu repassent en « proxy automatique »
  enregistrerRegles(reglesProxy().map((r) => (typeof r.cible == "number" && r.cible >= liste.length ? { ...r, cible: "auto" } : r)));
}

// fixe | demarrage | minutes | site
export function rotation() {
  return prefs.getStringPref(PREF_ROTATION, "fixe");
}
export function definirRotation(mode) {
  prefs.setStringPref(PREF_ROTATION, mode);
}
export function minutesRotation() {
  return Math.max(1, prefs.getIntPref(PREF_MINUTES, 10));
}
export function definirMinutesRotation(n) {
  prefs.setIntPref(PREF_MINUTES, Math.max(1, Math.min(1440, n | 0)));
}

// règles par site : [{ domaine: "banque.fr", cible: "direct" | "auto" | indice }]
export function reglesProxy() {
  return lireJSON(PREF_REGLES);
}
export function enregistrerRegles(regles) {
  prefs.setStringPref(PREF_REGLES, JSON.stringify(regles));
}

export function coupeCircuit() {
  return prefs.getBoolPref(PREF_COUPE, true);
}
export function definirCoupeCircuit(v) {
  prefs.setBoolPref(PREF_COUPE, !!v);
}
export function alertesFuite() {
  return prefs.getBoolPref(PREF_ALERTES, true);
}
export function definirAlertesFuite(v) {
  prefs.setBoolPref(PREF_ALERTES, !!v);
}

// santé : indice -> { ok, ms, ip }, rempli par testerProxys()
export const santeProxys = new Map();

function enLigne(i) {
  const s = santeProxys.get(i);
  return !s || s.ok;
}
function indicesEnLigne(n) {
  const t = [];
  for (let i = 0; i < n; i++) if (enLigne(i)) t.push(i);
  return t.length ? t : [...Array(n).keys()];
}
function hacher(texte) {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function baseDe(hote) {
  try {
    return Services.eTLD.getBaseDomainFromHost(hote);
  } catch {
    return hote;
  }
}
function nettoyerDomaine(d) {
  return String(d || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/[/:].*$/, "").replace(/^\*?\./, "");
}
export { nettoyerDomaine };

const LOCAUX = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SONDES = new Set(["api.ipify.org", "api64.ipify.org"]);
let filtreProxy = null;
let cache = null;

function etat() {
  if (!cache) {
    cache = {
      liste: listeProxys(),
      regles: reglesProxy().map((r) => ({ ...r, domaine: nettoyerDomaine(r.domaine) })).filter((r) => r.domaine),
      actif: proxyActif(),
      rotation: rotation(),
      coupe: coupeCircuit(),
    };
  }
  return cache;
}

// indice du proxy pour cet hôte, -1 pour la connexion directe
function indicePour(hote) {
  const { liste, regles, actif, rotation: mode } = etat();
  if (!liste.length) return -1;
  const regle = regles.find((r) => hote == r.domaine || hote.endsWith("." + r.domaine));
  if (regle) {
    if (regle.cible == "direct") return -1;
    if (typeof regle.cible == "number" && liste[regle.cible]) return regle.cible;
  }
  const parSite = (mode == "site" && actif >= 0) || (regle && regle.cible == "auto" && actif < 0);
  if (actif < 0 && !parSite) return -1;
  if (parSite) {
    const t = indicesEnLigne(liste.length);
    return t[hacher(baseDe(hote)) % t.length];
  }
  return actif;
}

function infoProxy(pps, p, relais) {
  return p.utilisateur
    ? pps.newProxyInfoWithAuth("socks", p.hote, p.port, p.utilisateur, p.motDePasse, "", "",
        Ci.nsIProxyInfo.TRANSPARENT_PROXY_RESOLVES_HOST, 30, relais)
    : pps.newProxyInfo("http", p.hote, p.port, "", "", 0, 30, relais);
}

// proxy i, puis les autres proxys en ligne comme relais ; la connexion directe en dernier
// seulement si le coupe-circuit est désactivé
function chaine(pps, i, avecRelais) {
  const { liste, coupe } = etat();
  const ordre = avecRelais ? [i, ...indicesEnLigne(liste.length).filter((j) => j != i)] : [i];
  let suivant = !avecRelais || coupe ? null : pps.newProxyInfo("direct", "", -1, "", "", 0, 0, null);
  for (const j of ordre.reverse()) suivant = infoProxy(pps, liste[j], suivant);
  return suivant;
}

export function installerFiltreProxy() {
  if (filtreProxy || estFenetreTor()) return;
  const pps = Cc["@mozilla.org/network/protocol-proxy-service;1"].getService(Ci.nsIProtocolProxyService);
  const oublier = () => {
    cache = null;
  };
  for (const nom of [PREF_LISTE, PREF_REGLES, PREF_ROTATION, PREF_COUPE]) prefs.addObserver(nom, oublier);
  prefs.addObserver(PREF_ACTIF, () => {
    oublier();
    planifierVerificationFuite();
  });

  filtreProxy = {
    QueryInterface: ChromeUtils.generateQI(["nsIProtocolProxyChannelFilter"]),
    applyFilter(canal, defaut, rappel) {
      let hote = "";
      let requete = "";
      try {
        hote = canal.URI.host;
        requete = canal.URI.query || "";
      } catch {}
      const { liste } = etat();
      // sondes internes : test d'un proxy précis, ou de la connexion directe
      if (SONDES.has(hote)) {
        const m = /(?:^|&)cigale_test=(\w+)/.exec(requete);
        if (m) {
          const i = parseInt(m[1], 10);
          rappel.onProxyFilterResult(m[1] == "direct" || !liste[i] ? defaut : chaine(pps, i, false));
          return;
        }
      }
      const i = LOCAUX.has(hote) ? -1 : indicePour(hote);
      rappel.onProxyFilterResult(i < 0 ? defaut : chaine(pps, i, true));
    },
  };
  pps.registerChannelFilter(filtreProxy, 0);
  demarrerRotation();
}

function choisirAutre(liste) {
  const t = indicesEnLigne(liste.length);
  if (t.length < 2) return t[0] ?? -1;
  const actuel = proxyActif();
  const autres = t.filter((i) => i != actuel);
  return autres[Math.floor(Math.random() * autres.length)];
}

let minuterieRotation = null;
let derniereRotation = Date.now();
function demarrerRotation() {
  const { setInterval, setTimeout } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
  const liste = listeProxys();
  if (rotation() == "demarrage" && proxyActif() >= 0 && liste.length > 1) choisirProxy(choisirAutre(liste));
  if (minuterieRotation) return;
  minuterieRotation = setInterval(() => {
    const l = listeProxys();
    if (rotation() != "minutes" || proxyActif() < 0 || l.length < 2) return;
    if (Date.now() - derniereRotation < minutesRotation() * 60000) return;
    derniereRotation = Date.now();
    choisirProxy(choisirAutre(l));
  }, 30000);
  // santé de la liste : au démarrage puis toutes les 15 minutes, si un proxy sert
  const sante = () => {
    if (listeProxys().length && (proxyActif() >= 0 || reglesProxy().length)) testerProxys().catch(() => {});
  };
  setTimeout(sante, 20000);
  setInterval(sante, 15 * 60000);
}

async function sonde(url, ms = 8000) {
  const controle = new AbortController();
  const { setTimeout, clearTimeout } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
  const minuterie = setTimeout(() => controle.abort(), ms);
  try {
    const r = await fetch(url, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: controle.signal });
    return r.ok ? (await r.json()).ip || null : null;
  } catch {
    return null;
  } finally {
    clearTimeout(minuterie);
  }
}

// teste chaque proxy de la liste ; rappel(i, etat) à chaque résultat
export async function testerProxys(rappel) {
  const liste = listeProxys();
  await Promise.all(
    liste.map(async (_, i) => {
      const debut = Date.now();
      const ip = await sonde(`https://api.ipify.org/?format=json&cigale_test=${i}`);
      const resultat = { ok: !!ip, ms: Date.now() - debut, ip };
      santeProxys.set(i, resultat);
      rappel?.(i, resultat);
    })
  );
  cache = null;
  return santeProxys;
}

// --- Alerte de fuite : vérifie l'adresse vue par les sites après chaque changement de proxy ---
let verificationPrevue = null;
function planifierVerificationFuite() {
  if (!alertesFuite()) return;
  const { setTimeout, clearTimeout } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
  clearTimeout(verificationPrevue);
  verificationPrevue = setTimeout(() => verifierFuite().catch(() => {}), 2500);
}

export async function verifierFuite() {
  if (proxyActif() < 0) return { etat: "direct" };
  const [reelle4, reelle6, vue4, vue6] = await Promise.all([
    sonde("https://api.ipify.org/?format=json&cigale_test=direct"),
    sonde("https://api64.ipify.org/?format=json&cigale_test=direct"),
    sonde("https://api.ipify.org/?format=json"),
    sonde("https://api64.ipify.org/?format=json"),
  ]);
  const reelles = new Set([reelle4, reelle6].filter(Boolean));
  const vues = [vue4, vue6].filter(Boolean);
  let resultat;
  if (vues.some((ip) => reelles.has(ip))) {
    resultat = { etat: "fuite", ip: vues.find((ip) => reelles.has(ip)) };
    alerterFenetres(`Fuite : les sites voient votre vraie adresse IP (${resultat.ip}). Vérifiez la page Adresse IP.`, true);
  } else if (!vues.length) {
    resultat = { etat: "coupe" };
    if (coupeCircuit()) alerterFenetres("Aucun proxy ne répond : coupe-circuit actif, les pages sont bloquées pour protéger votre adresse.", false);
  } else {
    resultat = { etat: "ok", ip: vues.join(" et ") };
  }
  Services.obs.notifyObservers(null, "cigale-proxy-fuite", JSON.stringify(resultat));
  return resultat;
}

function alerterFenetres(texte, grave) {
  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    try {
      const boite = win.gNotificationBox;
      boite.removeNotification(boite.getNotificationWithValue("cigale-fuite"));
      boite.appendNotification("cigale-fuite", {
        label: texte,
        priority: grave ? boite.PRIORITY_CRITICAL_MEDIUM : boite.PRIORITY_WARNING_MEDIUM,
      });
    } catch (e) {
      console.error(e);
    }
  }
}
