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

export function empreinte(motDePasse, sel) {
  const encodeur = new TextEncoder();
  let bloc = encodeur.encode(sel + ":" + motDePasse);
  const hache = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
  for (let i = 0; i < 60000; i++) {
    hache.init(Ci.nsICryptoHash.SHA256);
    hache.update(bloc, bloc.length);
    bloc = Uint8Array.from(hache.finish(false), (c) => c.charCodeAt(0));
  }
  return hex(bloc);
}

export function verrouActif() {
  return prefs.getStringPref("cigale.verrou.empreinte", "") != "";
}

export function verifierMotDePasse(motDePasse) {
  const sel = prefs.getStringPref("cigale.verrou.sel", "");
  return verrouActif() && empreinte(motDePasse, sel) == prefs.getStringPref("cigale.verrou.empreinte");
}

export function definirMotDePasse(motDePasse) {
  if (!motDePasse) {
    prefs.clearUserPref("cigale.verrou.sel");
    prefs.clearUserPref("cigale.verrou.empreinte");
    return;
  }
  const alea = Cc["@mozilla.org/security/random-generator;1"].getService(Ci.nsIRandomGenerator);
  const sel = hex(alea.generateRandomBytes(16));
  prefs.setStringPref("cigale.verrou.sel", sel);
  prefs.setStringPref("cigale.verrou.empreinte", empreinte(motDePasse, sel));
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
