// Assistant IA local de La Cigale.
// Le moteur (llama.cpp) et le modèle ne sont téléchargés que si l'utilisateur active l'assistant :
// l'installeur n'en contient rien. Tout est rangé dans le profil (cigale-assistant/), le serveur
// n'écoute que sur 127.0.0.1 avec une clé tirée au hasard à chaque démarrage, et rien d'autre
// ne sort de la machine une fois les fichiers en place.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  Subprocess: "resource://gre/modules/Subprocess.sys.mjs",
});
const { setTimeout, clearTimeout } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
const { FileUtils } = ChromeUtils.importESModule("resource://gre/modules/FileUtils.sys.mjs");

const PREF_MODELE = "cigale.assistant.modele";
const PREF_CALCUL = "cigale.assistant.calcul"; // "gpu" ou "cpu", choisi par un court essai après l'installation
const P = Services.prefs;
const WINDOWS = Services.appinfo.OS == "WINNT";

// Versions fixées : une mise à jour de l'assistant passe par une nouvelle version de La Cigale.
const MOTEUR_VERSION = "b12621";
const MOTEURS = {
  WINNT: {
    url: `https://github.com/ggml-org/llama.cpp/releases/download/${MOTEUR_VERSION}/llama-${MOTEUR_VERSION}-bin-win-vulkan-x64.zip`,
    sha256: "38c58fe8b3eb5bfb892d02e9b67349a1ee8eb5d1bf81c0fb4894a2d7ebaf1e4d",
    taille: 38871144,
    archive: "zip",
  },
  Linux: {
    url: `https://github.com/ggml-org/llama.cpp/releases/download/${MOTEUR_VERSION}/llama-${MOTEUR_VERSION}-bin-ubuntu-vulkan-x64.tar.gz`,
    sha256: "9ebb8b43a6d76cc9f7bde23328cc223be413b38994e2a49a59c64759b90e3c6b",
    taille: 36899887,
    archive: "tar",
  },
};

export const MODELES = [
  {
    id: "leger",
    nom: "Léger",
    detail: "Gemma 3 4B, version sans filtre (abliterated)",
    conseil: "Pour la plupart des ordinateurs, 8 Go de mémoire suffisent.",
    fichier: "gemma-3-4b-it-abliterated.q4_k_m.gguf",
    url: "https://huggingface.co/mlabonne/gemma-3-4b-it-abliterated-GGUF/resolve/main/gemma-3-4b-it-abliterated.q4_k_m.gguf",
    sha256: "99dc4abe5d344e1033f09e6a2c1f4e3d39093dd1f007b9d3254d8c2ef94950e1",
    taille: 2489894016,
    licence: "Conditions d'utilisation de Gemma",
    licenceUrl: "https://ai.google.dev/gemma/terms",
  },
  {
    id: "fort",
    nom: "Puissant",
    detail: "Llama 3.1 8B, version sans filtre (abliterated)",
    conseil: "Plus juste, plus lent : 16 Go de mémoire ou une carte graphique recommandés.",
    fichier: "Meta-Llama-3.1-8B-Instruct-abliterated-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-abliterated-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-abliterated-Q4_K_M.gguf",
    sha256: "c6be866583f7bddb437b8ccd988fc499c98f1846934a1f3d48de7777313057cb",
    taille: 4920734720,
    licence: "Licence communautaire Llama 3.1",
    licenceUrl: "https://www.llama.com/llama3_1/license/",
  },
  {
    id: "reflechi",
    nom: "Réfléchi",
    detail: "Qwen3 4B, version sans filtre (abliterated), qui réfléchit avant de répondre",
    conseil: "Montre sa vraie réflexion pas à pas (elle est en anglais, la réponse en français). Plus lent, 8 Go de mémoire suffisent.",
    fichier: "mlabonne_Qwen3-4B-abliterated-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/mlabonne_Qwen3-4B-abliterated-GGUF/resolve/main/mlabonne_Qwen3-4B-abliterated-Q4_K_M.gguf",
    sha256: "004f7b8f59ccd5fa42258c52aa2087b89524cced84e955b9c8b115035ca073b2",
    taille: 2497280544,
    licence: "Apache 2.0",
    licenceUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    reflechit: true,
  },
];

const dossier = () => PathUtils.join(PathUtils.profileDir, "cigale-assistant");
const dossierMoteur = () => PathUtils.join(dossier(), "moteur-" + MOTEUR_VERSION);
const cheminModele = (m) => PathUtils.join(dossier(), "modeles", m.fichier);

// ---------- état ----------

let serveur = null;       // { processus, port, cle, modele }
let demarrage = null;     // promesse de démarrage en cours
let minuterieRepos = 0;
let telechargement = null; // { controleur, etape, recu, total }
const ecouteurs = new Set();
const REPOS_MS = 15 * 60 * 1000; // le serveur s'arrête après 15 minutes sans question (mémoire rendue)

function prevenir() {
  for (const f of ecouteurs) { try { f(); } catch (e) { console.error(e); } }
}
export function surveiller(f) {
  ecouteurs.add(f);
  return () => ecouteurs.delete(f);
}

async function existe(chemin) {
  try { return await IOUtils.exists(chemin); } catch { return false; }
}

async function executableMoteur() {
  const nom = WINDOWS ? "llama-server.exe" : "llama-server";
  const direct = PathUtils.join(dossierMoteur(), nom);
  if (await existe(direct)) return direct;
  // l'archive Linux range les fichiers dans un sous-dossier
  const pile = [dossierMoteur()];
  while (pile.length) {
    const d = pile.pop();
    let enfants = [];
    try { enfants = await IOUtils.getChildren(d); } catch { continue; }
    for (const e of enfants) {
      if (PathUtils.filename(e) == nom) return e;
      try { if ((await IOUtils.stat(e)).type == "directory") pile.push(e); } catch {}
    }
  }
  return null;
}

export function nomModele(id) {
  const m = MODELES.find((x) => x.id == id);
  return m ? m.detail.split(",")[0] : "";
}

export async function etat() {
  const installes = {};
  for (const m of MODELES) installes[m.id] = await existe(cheminModele(m));
  const choisi = P.getStringPref(PREF_MODELE, "");
  return {
    plateforme: !!MOTEURS[Services.appinfo.OS],
    moteur: !!(await executableMoteur()),
    installes,
    modele: installes[choisi] ? choisi : MODELES.find((m) => installes[m.id])?.id || "",
    enMarche: !!serveur,
    demarrage: !!demarrage,
    telechargement: telechargement && { etape: telechargement.etape, recu: telechargement.recu, total: telechargement.total },
  };
}

export async function estPret() {
  const e = await etat();
  return e.moteur && !!e.modele;
}

// ---------- téléchargement vérifié ----------

function hex(binaire) {
  return [...binaire].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}

async function telecharger(url, destination, sha256, taille, etape) {
  const partiel = destination + ".part";
  await IOUtils.makeDirectory(PathUtils.parent(destination), { createAncestors: true });
  await IOUtils.remove(partiel, { ignoreAbsent: true });
  const empreinte = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
  empreinte.init(Ci.nsICryptoHash.SHA256);
  telechargement.etape = etape;
  telechargement.recu = 0;
  telechargement.total = taille;
  prevenir();
  const reponse = await fetch(url, { signal: telechargement.controleur.signal, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
  if (!reponse.ok) throw new Error(`Téléchargement refusé (${reponse.status})`);
  const lecteur = reponse.body.getReader();
  let tampon = [];
  let enAttente = 0;
  let dernier = 0;
  const vider = async () => {
    if (!enAttente) return;
    const bloc = new Uint8Array(enAttente);
    let pos = 0;
    for (const b of tampon) { bloc.set(b, pos); pos += b.length; }
    tampon = [];
    enAttente = 0;
    await IOUtils.write(partiel, bloc, { mode: "appendOrCreate" });
  };
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    empreinte.update(value, value.length);
    tampon.push(value);
    enAttente += value.length;
    telechargement.recu += value.length;
    if (enAttente >= 8 * 1024 * 1024) await vider();
    if (Date.now() - dernier > 250) { dernier = Date.now(); prevenir(); }
  }
  await vider();
  const obtenu = hex(empreinte.finish(false));
  if (obtenu != sha256) {
    await IOUtils.remove(partiel, { ignoreAbsent: true });
    throw new Error("Le fichier reçu ne correspond pas à l'empreinte attendue : il a été supprimé.");
  }
  await IOUtils.move(partiel, destination);
}

async function extraire(archive, cible, type) {
  await IOUtils.remove(cible, { recursive: true, ignoreAbsent: true });
  await IOUtils.makeDirectory(cible, { createAncestors: true });
  if (type == "zip") {
    const lecteur = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    lecteur.open(new FileUtils.File(archive));
    try {
      for (const nom of lecteur.findEntries(null)) {
        if (nom.endsWith("/") || nom.includes("..")) continue;
        const sortie = PathUtils.join(cible, ...nom.split("/"));
        await IOUtils.makeDirectory(PathUtils.parent(sortie), { createAncestors: true });
        lecteur.extract(nom, new FileUtils.File(sortie));
      }
    } finally {
      lecteur.close();
    }
  } else {
    const tar = await lazy.Subprocess.pathSearch("tar");
    const p = await lazy.Subprocess.call({ command: tar, arguments: ["-xzf", archive, "-C", cible] });
    vidanger(p);
    const { exitCode } = await p.wait();
    if (exitCode) throw new Error("Extraction impossible (tar " + exitCode + ")");
  }
}

// Court essai des deux façons de calculer (carte graphique, processeur) : sur beaucoup de PC portables,
// la puce graphique intégrée est plus lente que le processeur. On garde la plus rapide.
async function calibrer(modele) {
  const exe = await executableMoteur();
  const banc = exe && PathUtils.join(PathUtils.parent(exe), WINDOWS ? "llama-bench.exe" : "llama-bench");
  if (!banc || !(await existe(banc))) return;
  try {
    const p = await lazy.Subprocess.call({
      command: banc,
      arguments: ["-m", cheminModele(modele), "-p", "256", "-n", "16", "-r", "1", "-fa", "0", "-ngl", "0,99", "-o", "json"],
      workdir: PathUtils.parent(banc),
    });
    let sortie = "";
    for (let morceau; (morceau = await p.stdout.readString());) sortie += morceau;
    await p.wait();
    const mesures = JSON.parse(sortie.slice(sortie.indexOf("[")));
    const duree = (ngl) => {
      const lecture = mesures.find((m) => m.n_gpu_layers == ngl && m.n_prompt > 0)?.avg_ts;
      const ecriture = mesures.find((m) => m.n_gpu_layers == ngl && m.n_gen > 0)?.avg_ts;
      return lecture && ecriture ? 2000 / lecture + 300 / ecriture : Infinity;
    };
    P.setStringPref(PREF_CALCUL, duree(99) < duree(0) ? "gpu" : "cpu");
  } catch (e) {
    console.error("La Cigale : calibrage de l'assistant", e);
  }
}

// Télécharge ce qui manque (moteur puis modèle) et choisit le modèle.
export async function installer(idModele) {
  const modele = MODELES.find((m) => m.id == idModele);
  const moteur = MOTEURS[Services.appinfo.OS];
  if (!modele || !moteur) throw new Error("Assistant indisponible sur ce système.");
  if (telechargement) throw new Error("Un téléchargement est déjà en cours.");
  telechargement = { controleur: new AbortController(), etape: "", recu: 0, total: 0 };
  try {
    if (!(await executableMoteur())) {
      const archive = PathUtils.join(dossier(), "moteur." + (moteur.archive == "zip" ? "zip" : "tar.gz"));
      await telecharger(moteur.url, archive, moteur.sha256, moteur.taille, "moteur");
      telechargement.etape = "extraction";
      prevenir();
      await extraire(archive, dossierMoteur(), moteur.archive);
      await IOUtils.remove(archive, { ignoreAbsent: true });
      if (!(await executableMoteur())) throw new Error("Le moteur n'a pas été trouvé dans l'archive.");
    }
    if (!(await existe(cheminModele(modele)))) {
      await telecharger(modele.url, cheminModele(modele), modele.sha256, modele.taille, "modele");
    }
    P.setStringPref(PREF_MODELE, modele.id);
    if (!P.getStringPref(PREF_CALCUL, "")) {
      telechargement.etape = "calibrage";
      prevenir();
      await calibrer(modele);
    }
  } finally {
    telechargement = null;
    prevenir();
  }
}

export function annulerTelechargement() {
  telechargement?.controleur.abort();
}

export async function choisirModele(id) {
  if (!MODELES.some((m) => m.id == id)) return;
  P.setStringPref(PREF_MODELE, id);
  if (serveur && serveur.modele != id) await arreter();
  prevenir();
}

export async function supprimerModele(id) {
  const m = MODELES.find((x) => x.id == id);
  if (!m) return;
  if (serveur?.modele == id) await arreter();
  await IOUtils.remove(cheminModele(m), { ignoreAbsent: true });
  prevenir();
}

export async function toutSupprimer() {
  annulerTelechargement();
  await arreter();
  await IOUtils.remove(dossier(), { recursive: true, ignoreAbsent: true });
  P.clearUserPref(PREF_MODELE);
  P.clearUserPref(PREF_CALCUL);
  prevenir();
}

export async function espaceUtilise() {
  let total = 0;
  const pile = [dossier()];
  while (pile.length) {
    const d = pile.pop();
    let enfants = [];
    try { enfants = await IOUtils.getChildren(d); } catch { continue; }
    for (const e of enfants) {
      try {
        const s = await IOUtils.stat(e);
        if (s.type == "directory") pile.push(e); else total += s.size;
      } catch {}
    }
  }
  return total;
}

// ---------- serveur local ----------

function vidanger(processus) {
  // la sortie doit être lue, sinon le processus finit par se bloquer
  (async () => {
    try { while (await processus.stdout.readString()); } catch {}
  })();
}

function aleatoire(octets) {
  const a = new Uint8Array(octets);
  const g = Cc["@mozilla.org/security/random-generator;1"].getService(Ci.nsIRandomGenerator);
  a.set(g.generateRandomBytes(octets));
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function reveiller() {
  if (minuterieRepos) clearTimeout(minuterieRepos);
  minuterieRepos = setTimeout(() => arreter().catch(console.error), REPOS_MS);
}

export async function demarrer() {
  if (serveur) { reveiller(); return serveur; }
  if (demarrage) return demarrage;
  demarrage = (async () => {
    const e = await etat();
    const modele = MODELES.find((m) => m.id == e.modele);
    const exe = await executableMoteur();
    if (!exe || !modele) throw new Error("L'assistant n'est pas encore installé.");
    let derniereErreur = null;
    for (let essai = 0; essai < 3; essai++) {
      const port = 20000 + Math.floor(Math.random() * 40000);
      const cle = aleatoire(24);
      const processus = await lazy.Subprocess.call({
        command: exe,
        arguments: [
          "-m", cheminModele(modele), "--host", "127.0.0.1", "--port", String(port), "--api-key", cle,
          "-c", "16384", "--parallel", "1", "-fa", "off", "--no-webui", "--offline", "--log-disable",
          ...(P.getStringPref(PREF_CALCUL, "") == "cpu" ? ["-ngl", "0"] : []),
          // modèle qui réfléchit : sa réflexion arrive à part (reasoning_content), bornée en longueur
          ...(modele.reflechit ? ["--reasoning-format", "deepseek", "--reasoning-budget", "1024"] : ["--reasoning", "off"]),
        ],
        workdir: PathUtils.parent(exe),
        environment: { LLAMA_ARG_UI: null, HF_TOKEN: null },
        environmentAppend: true,
      });
      vidanger(processus);
      const fin = processus.wait().then(() => true);
      const debut = Date.now();
      let pret = false;
      let mort = false;
      fin.then(() => { mort = true; });
      while (!pret && !mort && Date.now() - debut < 180000) {
        await new Promise((r) => setTimeout(r, 400));
        try {
          const r = await fetch(`http://127.0.0.1:${port}/health`, { headers: { Authorization: "Bearer " + cle }, cache: "no-store" });
          pret = r.ok;
        } catch {}
      }
      if (pret) {
        serveur = { processus, port, cle, modele: modele.id };
        fin.then(() => {
          if (serveur?.processus == processus) { serveur = null; prevenir(); }
        });
        reveiller();
        return serveur;
      }
      try { processus.kill(); } catch {}
      derniereErreur = new Error(mort ? "Le moteur s'est arrêté au démarrage (mémoire insuffisante ?)." : "Le moteur ne répond pas.");
      if (!mort) break;
    }
    throw derniereErreur;
  })();
  prevenir();
  try {
    return await demarrage;
  } finally {
    demarrage = null;
    prevenir();
  }
}

export async function arreter() {
  if (minuterieRepos) { clearTimeout(minuterieRepos); minuterieRepos = 0; }
  const s = serveur;
  serveur = null;
  if (s) {
    try { s.processus.kill(); } catch {}
    prevenir();
  }
}

Services.obs.addObserver(() => { arreter(); }, "quit-application");

// ---------- historique des conversations (facultatif, désactivé par défaut) ----------
// Gardé seulement dans le profil (cigale-assistant/conversations.json), 50 au plus.
// Le bouton panique et « Tout supprimer » l'effacent.

const PREF_HISTORIQUE = "cigale.assistant.historique";
const MAX_CONVERSATIONS = 50;
const fichierConversations = () => PathUtils.join(dossier(), "conversations.json");

export function historiqueActif() { return P.getBoolPref(PREF_HISTORIQUE, false); }
export async function activerHistorique(oui) {
  P.setBoolPref(PREF_HISTORIQUE, !!oui);
  if (!oui) await effacerConversations();
}
export async function conversations() {
  if (!historiqueActif()) return [];
  try {
    const liste = JSON.parse(await IOUtils.readUTF8(fichierConversations()));
    return Array.isArray(liste) ? liste : [];
  } catch { return []; }
}
async function ecrireConversations(liste) {
  await IOUtils.makeDirectory(dossier(), { ignoreExisting: true });
  await IOUtils.writeUTF8(fichierConversations(), JSON.stringify(liste), { tmpPath: fichierConversations() + ".tmp" });
}
export async function enregistrerConversation(c) {
  if (!historiqueActif() || !c?.id) return;
  const liste = (await conversations()).filter((x) => x.id != c.id);
  liste.unshift(c);
  await ecrireConversations(liste.slice(0, MAX_CONVERSATIONS));
}
export async function supprimerConversation(id) {
  await ecrireConversations((await conversations()).filter((x) => x.id != id));
}
export async function effacerConversations() {
  await IOUtils.remove(fichierConversations(), { ignoreAbsent: true });
}

// Réponse en continu. `morceau(texte)` reçoit chaque bout de texte ; renvoie le texte complet.
// Le modèle « Réfléchi » pense longuement (et en anglais, quoi qu'on lui demande) : on lui demande d'être bref.
const CONSIGNE_REFLEXION = "Réfléchis brièvement et seulement sur ce qui aide à répondre.";

export async function discuter(messages, morceau, signal, options = {}) {
  if (!serveur) options.etape?.("demarrage");
  const s = await demarrer();
  options.etape?.("envoi");
  reveiller();
  const reflechit = !!MODELES.find((m) => m.id == s.modele)?.reflechit;
  if (reflechit && !options.sansReflexion && messages[0]?.role == "system") {
    messages = [{ role: "system", content: messages[0].content + "\n\n" + CONSIGNE_REFLEXION }, ...messages.slice(1)];
  }
  const reponse = await fetch(`http://127.0.0.1:${s.port}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.cle },
    body: JSON.stringify({
      messages, stream: true, return_progress: true, cache_prompt: true,
      ...(options.sansReflexion ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      temperature: options.temperature ?? (reflechit ? 0.6 : 0.7),
      max_tokens: (options.max ?? 1500) + (reflechit && !options.sansReflexion ? 1024 : 0),
    }),
    signal,
    cache: "no-store",
  });
  if (!reponse.ok) {
    let detail = "";
    try { detail = (await reponse.json())?.error?.message || ""; } catch {}
    throw new Error(/context|exceed/i.test(detail) ? "Le texte est trop long pour le modèle." : "Le moteur a refusé la demande. " + detail);
  }
  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let reste = "";
  let complet = "";
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    reste += decodeur.decode(value, { stream: true });
    const lignes = reste.split("\n");
    reste = lignes.pop();
    for (const l of lignes) {
      if (!l.startsWith("data:")) continue;
      const donnees = l.slice(5).trim();
      if (donnees == "[DONE]") continue;
      try {
        const d = JSON.parse(donnees);
        // avancement de la lecture du texte par le modèle (avant le premier mot de la réponse)
        if (d.prompt_progress && options.progres) options.progres(d.prompt_progress);
        const delta = d.choices?.[0]?.delta || {};
        if (delta.reasoning_content) options.reflexion?.(delta.reasoning_content);
        const bout = delta.content;
        if (bout) { complet += bout; morceau(bout); }
      } catch {}
    }
  }
  reveiller();
  return complet;
}

// ---------- contexte : ce que La Cigale sait (seulement ce que l'utilisateur a autorisé) ----------

export const CONTEXTE = ["onglets", "notes", "favoris", "historique"];
const prefContexte = (nom) => "cigale.assistant.contexte." + nom;
export function contexteAutorise(nom) { return P.getBoolPref(prefContexte(nom), false); }
export function autoriserContexte(nom, oui) { P.setBoolPref(prefContexte(nom), !!oui); }
export function aPropos() { return P.getStringPref("cigale.assistant.apropos", ""); }
export function definirAPropos(texte) { P.setStringPref("cigale.assistant.apropos", String(texte || "").slice(0, 2000)); }

const coupe = (t, n) => (t || "").length > n ? t.slice(0, n) + "…" : t || "";

// Texte ajouté aux consignes du modèle à chaque question (rien n'est envoyé ailleurs).
export async function contexte(fenetre) {
  const maintenant = new Date();
  const langue = Services.locale.appLocaleAsBCP47 || "fr";
  const lignes = [
    "Date et heure actuelles : " + maintenant.toLocaleString(langue, { dateStyle: "full", timeStyle: "short" }) +
      " (fuseau " + Intl.DateTimeFormat().resolvedOptions().timeZone + ")",
    "Navigateur : La Cigale " + P.getStringPref("cigale.version", "") + ", basé sur Firefox " + Services.appinfo.version +
      ", sur " + (WINDOWS ? "Windows" : Services.appinfo.OS),
    "Langue du navigateur : " + langue,
  ];
  const moi = aPropos().trim();
  if (moi) lignes.push("Ce que l'utilisateur a écrit sur lui-même : " + moi);
  try {
    if (contexteAutorise("onglets") && fenetre?.gBrowser) {
      const liste = [...fenetre.gBrowser.tabs]
        .map((t) => ({ titre: t.label, adresse: t.linkedBrowser?.currentURI?.spec || "", actif: t == fenetre.gBrowser.selectedTab }))
        .filter((t) => /^https?:/.test(t.adresse)).slice(0, 25)
        .map((t) => `- ${coupe(t.titre, 90)} (${coupe(t.adresse, 120)})`);
      if (liste.length) lignes.push("Onglets ouverts :\n" + liste.join("\n"));
    }
  } catch (e) { console.error(e); }
  try {
    if (contexteAutorise("notes")) {
      const notes = await IOUtils.readUTF8(PathUtils.join(PathUtils.profileDir, "cigale-notes.txt")).catch(() => "");
      if (notes.trim()) lignes.push("Notes de l'utilisateur (extrait) :\n" + coupe(notes.trim(), 2500));
    }
  } catch (e) { console.error(e); }
  try {
    if (contexteAutorise("favoris") || contexteAutorise("historique")) {
      const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
      if (contexteAutorise("favoris")) {
        const favoris = await PlacesUtils.bookmarks.getRecent(15);
        const l = favoris.filter((f) => f.url).map((f) => `- ${coupe(f.title, 80)} (${coupe(f.url.href, 100)})`);
        if (l.length) lignes.push("Favoris récents :\n" + l.join("\n"));
      }
      if (contexteAutorise("historique")) {
        const db = await PlacesUtils.promiseDBConnection();
        const rangs = await db.execute(
          "SELECT title, url FROM moz_places WHERE last_visit_date IS NOT NULL AND url LIKE 'http%' ORDER BY last_visit_date DESC LIMIT 20");
        const l = rangs.map((r) => `- ${coupe(r.getResultByName("title") || "", 80)} (${coupe(r.getResultByName("url"), 100)})`);
        if (l.length) lignes.push("Pages visitées récemment :\n" + l.join("\n"));
      }
    }
  } catch (e) { console.error(e); }
  return lignes.join("\n");
}

// ---------- contenu des onglets ----------

export async function contenu(browser) {
  const acteur = browser?.browsingContext?.currentWindowGlobal?.getActor("CigaleOutils");
  if (!acteur) throw new Error("Cette page ne peut pas être lue (page interne ou pas encore chargée).");
  return acteur.sendQuery("Contenu");
}

// ---------- traduction locale d'une page ----------
// Les textes partent par petits paquets au modèle local ; rien ne sort de l'ordinateur.

export function langueCible() {
  const code = Services.locale.appLocaleAsBCP47 || "fr";
  let nom = code;
  try { nom = new Intl.DisplayNames([code], { type: "language" }).of(code.split("-")[0]); } catch {}
  return { code, nom };
}

async function traduirePaquet(textes, cible, signal) {
  const consignes = `Tu es un traducteur. On te donne un tableau JSON de textes tirés d'une page web. ` +
    `Traduis chaque texte en ${cible}, fidèlement et naturellement, sans rien ajouter ni expliquer. ` +
    `Garde tels quels les nombres, les noms propres, les noms scientifiques et la ponctuation. Si un texte est déjà en ${cible}, recopie-le tel quel. ` +
    `Réponds uniquement avec un tableau JSON de chaînes, de même longueur (${textes.length}) et dans le même ordre.`;
  const sortie = await discuter([{ role: "system", content: consignes }, { role: "user", content: JSON.stringify(textes) }],
    () => {}, signal, { temperature: 0.2, max: Math.min(3000, 200 + Math.ceil(JSON.stringify(textes).length / 2)), sansReflexion: true });
  const debut = sortie.indexOf("["), fin = sortie.lastIndexOf("]");
  let liste = null;
  try { liste = JSON.parse(sortie.slice(debut, fin + 1)); } catch {}
  return Array.isArray(liste) && liste.length == textes.length && liste.every((x) => typeof x == "string") ? liste : null;
}

// `avancer(fait, total)` après chaque paquet ; s'arrête avec `signal`.
export async function traduirePage(browser, { signal, avancer } = {}) {
  const acteur = browser?.browsingContext?.currentWindowGlobal?.getActor("CigaleOutils");
  if (!acteur) throw new Error("Cette page ne peut pas être traduite (page interne ou pas encore chargée).");
  const { textes } = await acteur.sendQuery("TraduireLire");
  const cible = langueCible().nom;
  const paquets = [];
  let courant = [], taille = 0;
  textes.forEach((t, i) => {
    if (courant.length && (courant.length >= 24 || taille + t.length > 1400)) { paquets.push(courant); courant = []; taille = 0; }
    courant.push(i);
    taille += t.length;
  });
  if (courant.length) paquets.push(courant);
  let fait = 0;
  avancer?.(0, textes.length);
  const traiter = async (indices, profondeur = 0) => {
    const resultat = await traduirePaquet(indices.map((i) => textes[i]), cible, signal);
    if (resultat) {
      await acteur.sendQuery("TraduireEcrire", indices.map((i, k) => [i, resultat[k]]));
    } else if (indices.length > 1 && profondeur < 3) {
      // réponse mal formée : on recommence en deux moitiés
      const milieu = Math.ceil(indices.length / 2);
      await traiter(indices.slice(0, milieu), profondeur + 1);
      await traiter(indices.slice(milieu), profondeur + 1);
      return;
    }
    fait += indices.length;
    avancer?.(fait, textes.length);
  };
  for (const p of paquets) {
    if (signal?.aborted) break;
    await traiter(p);
  }
  return { total: textes.length, fait };
}

export async function pageOriginale(browser) {
  const acteur = browser?.browsingContext?.currentWindowGlobal?.getActor("CigaleOutils");
  if (acteur) await acteur.sendQuery("TraduireOriginal");
}

// Demande transmise par le menu contextuel avant l'ouverture de about:assistant
let demande = null;
export function deposerDemande(d) { demande = d; }
export function prendreDemande() { const d = demande; demande = null; return d; }

// ---------- analyse des liens (règles locales, avant le modèle) ----------

const RACCOURCISSEURS = new Set(["bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "t.ly", "lnkd.in", "s.id", "tiny.cc"]);
const PISTAGE = /(^|\.)(doubleclick\.net|googlesyndication\.com|googleadservices\.com|google-analytics\.com|googletagmanager\.com|facebook\.net|scorecardresearch\.com|adnxs\.com|criteo\.(com|net)|taboola\.com|outbrain\.com|hotjar\.com|amazon-adsystem\.com|adsrvr\.org|quantserve\.com|mathtag\.com|rubiconproject\.com|pubmatic\.com|bing\.com\/aclk|clickserve|tracking|tracker)/i;
const PARAMS_PISTAGE = /^(utm_[a-z]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_eid|mc_cid|igshid|yclid|_hsenc|_hsmi|oly_[a-z]+|vero_id|ttclid|twclid|li_fat_id|s_cid|ref_src)$/i;
const REDIRECTIONS = /^(l\.facebook\.com|lm\.facebook\.com|l\.instagram\.com|out\.reddit\.com|away\.vk\.com|www\.google\.[a-z.]+\/url|href\.li|click\.[^/]+|links?\.[^/]+|redirect\.[^/]+|r\.[^/]+)$/i;

function base(hote) {
  const p = hote.split(".");
  try { return Services.eTLD.getBaseDomainFromHost(hote); } catch { return p.slice(-2).join("."); }
}

export function analyserLiens(page) {
  let siteBase = "";
  try { siteBase = base(new URL(page.adresse).hostname); } catch {}
  const domaines = new Map();
  const alertes = [];
  const vus = new Set();
  for (const l of page.liens || []) {
    let u;
    try { u = new URL(l.adresse); } catch { continue; }
    const hote = u.hostname.replace(/^www\./, "");
    const b = base(u.hostname);
    const d = domaines.get(b) || { domaine: b, nombre: 0, externe: b != siteBase };
    d.nombre++;
    domaines.set(b, d);
    const raisons = [];
    if (u.protocol == "http:") raisons.push("lien non chiffré (http)");
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) || u.hostname.includes(":")) raisons.push("adresse IP au lieu d'un nom de site");
    if (u.hostname.split(".").some((x) => x.startsWith("xn--"))) raisons.push("nom de domaine en caractères spéciaux (punycode) : peut imiter un autre site");
    if (RACCOURCISSEURS.has(hote)) raisons.push("lien raccourci : la vraie destination est cachée");
    if (PISTAGE.test(u.hostname + u.pathname)) raisons.push("domaine connu pour la publicité ou le pistage");
    if (REDIRECTIONS.test(hote) || [...u.searchParams.values()].some((v) => /^https?:\/\//i.test(v))) raisons.push("passe par une redirection qui enregistre le clic");
    const params = [...u.searchParams.keys()].filter((k) => PARAMS_PISTAGE.test(k));
    if (params.length) raisons.push("paramètres de pistage : " + params.join(", "));
    const texte = (l.texte || "").trim();
    const domaineTexte = texte.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i)?.[1]?.toLowerCase().replace(/^www\./, "");
    if (domaineTexte && !hote.endsWith(domaineTexte) && !domaineTexte.endsWith(base(u.hostname))) raisons.push(`le texte affiche « ${domaineTexte} » mais le lien mène à ${hote}`);
    if (raisons.length) {
      const cle = u.origin + u.pathname + raisons.join();
      if (vus.has(cle)) continue;
      vus.add(cle);
      alertes.push({ adresse: l.adresse, texte: texte.slice(0, 80), hote, raisons });
    }
  }
  const liste = [...domaines.values()].sort((a, b) => b.nombre - a.nombre);
  return {
    total: (page.liens || []).length,
    internes: liste.filter((d) => !d.externe).reduce((s, d) => s + d.nombre, 0),
    domaines: liste,
    alertes,
  };
}
