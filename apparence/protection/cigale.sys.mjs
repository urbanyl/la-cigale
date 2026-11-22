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

export async function ouvrirFenetreTor(win) {
  if (estFenetreTor()) {
    win.OpenBrowserWindow();
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
