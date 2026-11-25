"use strict";
// about:assistant : page privilégiée. Le moteur et les téléchargements sont dans assistant.sys.mjs.

const A = ChromeUtils.importESModule("chrome://browser/content/cigale/assistant/assistant.sys.mjs");
const $ = (id) => document.getElementById(id);
const fenetre = window.browsingContext.topChromeWindow;
// ouvert dans le panneau à droite de la page : l'assistant suit l'onglet affiché
const PANNEAU = new URLSearchParams(location.search).has("panneau");
if (PANNEAU) document.documentElement.classList.add("panneau");

const SYSTEME = "Tu es La Cigale : une cigale, l'assistante du navigateur La Cigale. Tu le sais et tu l'assumes avec un brin d'humour " +
  "(le chant, l'été, la fourmi de La Fontaine), sans en faire trop. Tu fonctionnes entièrement sur l'ordinateur de l'utilisateur : " +
  "rien de ce qu'il écrit ne quitte sa machine. Réponds dans la langue de l'utilisateur (le français par défaut), " +
  "directement et franchement, sans sermon ni avertissement inutile. Mets en forme avec du Markdown simple : " +
  "titres courts (###), listes, **gras**. Quand on te fournit le contenu d'une page, appuie-toi dessus et dis-le si l'information n'y est pas. " +
  "Réponds avec des phrases complètes et utiles, jamais par un seul mot. Le navigateur te donne ci-dessous la date, l'heure et ce que " +
  "l'utilisateur a choisi de partager : sers-t'en. Si une information n'y est pas (actualité, météo, ce que tu ne sais pas), " +
  "dis-le franchement au lieu de l'inventer.";
const LIMITE_PAGE = 8000; // caractères de page envoyés au modèle : au-delà, la lecture devient trop longue sur un ordinateur ordinaire

let conversation = [];      // messages envoyés au modèle (hors système)
let pageJointe = "";        // adresse de la page déjà fournie au modèle dans cette conversation
let affichage = [];         // ce qui est montré dans le fil (pour l'historique) : { role, texte, piece }
let idConversation = "";    // identifiant de la conversation gardée (historique facultatif)
let enCours = null;         // AbortController de la réponse en cours
let choixInstallation = "leger";

const octets = (n) => n >= 1e9 ? (n / 1e9).toFixed(1).replace(".", ",") + " Go" : Math.max(1, Math.round(n / 1e6)) + " Mo";

// ---------- affichage de l'état ----------

let etatCourant = {};
async function rafraichir() {
  const e = await A.etat();
  etatCourant = e;
  const pret = e.moteur && !!e.modele;
  const reglagesOuverts = !$("reglages").hidden;
  if (!reglagesOuverts) {
    $("installation").hidden = pret && !e.telechargement;
    $("discussion").hidden = !pret || !!e.telechargement;
  }
  $("ouvrir-reglages").hidden = !pret;
  $("modele").hidden = !pret || Object.values(e.installes).filter(Boolean).length < 2;

  const statut = $("statut");
  statut.classList.toggle("marche", e.enMarche);
  statut.classList.toggle("attente", e.demarrage || !!e.telechargement);
  $("statut-texte").textContent = e.telechargement ? "Téléchargement" : e.demarrage ? "Démarrage du moteur…"
    : e.enMarche ? "Local · en marche" : pret ? "Local · en veille" : "Local";
  $("statut").title = $("statut-texte").textContent;

  if (!e.plateforme) {
    $("installer").disabled = true;
    montrerErreur("L'assistant n'est disponible que sur Windows et Linux 64 bits.");
  }
  dessinerChoix(e);
  if (pret) dessinerSelecteurModele(e);
  if (reglagesOuverts) dessinerReglages(e);

  const t = e.telechargement;
  $("progression").hidden = !t;
  $("annuler").hidden = !t;
  $("installer").disabled = !!t || !e.plateforme;
  if (t) {
    const part = t.total ? t.recu / t.total : 0;
    $("barre-plein").style.width = (part * 100).toFixed(1) + "%";
    $("progression-texte").textContent = t.etape == "calibrage" ? "Réglage pour cet ordinateur (processeur ou carte graphique, une minute environ)…"
      : t.etape == "extraction" ? "Installation du moteur…"
      : `${t.etape == "moteur" ? "Moteur llama.cpp" : "Modèle"} : ${octets(t.recu)} sur ${octets(t.total)} (${Math.floor(part * 100)} %)`;
  }
}

function dessinerChoix(e) {
  const boite = $("choix-modeles");
  boite.textContent = "";
  for (const m of A.MODELES) {
    const carte = document.createElement("button");
    carte.type = "button";
    carte.className = "modele";
    carte.setAttribute("role", "radio");
    carte.setAttribute("aria-checked", String(m.id == choixInstallation));
    const nom = document.createElement("div");
    nom.className = "nom";
    nom.append(m.nom);
    const taille = document.createElement("span");
    taille.textContent = octets(m.taille);
    nom.append(taille);
    const detail = document.createElement("p");
    detail.className = "detail";
    detail.textContent = m.detail;
    const conseil = document.createElement("p");
    conseil.className = "conseil";
    conseil.textContent = m.conseil;
    const licence = document.createElement("p");
    licence.className = "licence";
    licence.textContent = "Licence : " + m.licence;
    carte.append(nom, detail, conseil, licence);
    if (e.installes[m.id]) {
      const deja = document.createElement("p");
      deja.className = "deja";
      deja.textContent = "Déjà téléchargé";
      carte.append(deja);
    }
    carte.addEventListener("click", () => { choixInstallation = m.id; rafraichir(); });
    boite.append(carte);
  }
  const m = A.MODELES.find((x) => x.id == choixInstallation);
  const reste = (e.moteur ? 0 : 39e6) + (e.installes[m.id] ? 0 : m.taille);
  $("taille-totale").textContent = reste ? "À télécharger : " + octets(reste) : "Déjà sur cet ordinateur";
}

function dessinerSelecteurModele(e) {
  const choix = $("modele");
  choix.textContent = "";
  for (const m of A.MODELES) {
    if (!e.installes[m.id]) continue;
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = `${m.nom} · ${m.detail.split(",")[0]}`;
    o.selected = m.id == e.modele;
    choix.append(o);
  }
}

async function dessinerReglages(e) {
  const liste = $("liste-modeles");
  liste.textContent = "";
  for (const m of A.MODELES) {
    const ligne = document.createElement("div");
    ligne.className = "ligne-modele";
    const texte = document.createElement("div");
    texte.className = "texte";
    const titre = document.createElement("b");
    titre.textContent = `${m.nom} · ${m.detail}`;
    const petit = document.createElement("small");
    petit.textContent = `${octets(m.taille)} · ${m.licence}` + (e.modele == m.id ? " · utilisé" : "");
    texte.append(titre, petit);
    ligne.append(texte);
    if (e.installes[m.id]) {
      if (e.modele != m.id) {
        const utiliser = document.createElement("button");
        utiliser.textContent = "Utiliser";
        utiliser.addEventListener("click", () => A.choisirModele(m.id));
        ligne.append(utiliser);
      }
      const suppr = document.createElement("button");
      suppr.className = "danger";
      suppr.textContent = "Supprimer";
      suppr.addEventListener("click", async () => {
        await A.supprimerModele(m.id);
        if (!(await A.estPret())) fermerReglages();
      });
      ligne.append(suppr);
    } else {
      const telecharger = document.createElement("button");
      telecharger.textContent = "Télécharger (" + octets(m.taille) + ")";
      telecharger.disabled = !!e.telechargement;
      telecharger.addEventListener("click", () => {
        choixInstallation = m.id;
        fermerReglages();
        installer();
      });
      ligne.append(telecharger);
    }
    liste.append(ligne);
  }
  $("espace-utilise").textContent = octets(await A.espaceUtilise());
  $("apropos").value = A.aPropos();
  $("historique-actif").checked = A.historiqueActif();
  for (const nom of A.CONTEXTE) $("contexte-" + nom).checked = A.contexteAutorise(nom);
}

function montrerErreur(texte) {
  const p = $("erreur-installation");
  p.hidden = !texte;
  p.textContent = texte || "";
}

async function installer() {
  montrerErreur("");
  try {
    await A.installer(choixInstallation);
  } catch (e) {
    montrerErreur(e.name == "AbortError" ? "Téléchargement annulé." : "Échec : " + (e.message || e));
  }
  rafraichir();
}

function ouvrirReglages() {
  $("installation").hidden = true;
  $("discussion").hidden = true;
  $("reglages").hidden = false;
  rafraichir();
}
function fermerReglages() {
  $("reglages").hidden = true;
  rafraichir();
}

// ---------- onglets ----------

function onglets() {
  return [...(fenetre?.gBrowser?.tabs || [])].filter((t) => /^https?:/.test(t.linkedBrowser?.currentURI?.spec || ""));
}

let ongletsConnus = [];
function remplirOnglets(prefere) {
  const choix = $("onglet");
  const avant = prefere || ongletsConnus[choix.selectedIndex];
  ongletsConnus = onglets();
  choix.textContent = "";
  if (!ongletsConnus.length) {
    const o = document.createElement("option");
    o.textContent = "Aucune page web ouverte";
    choix.append(o);
  }
  // dans le panneau : l'onglet affiché ; sinon le dernier onglet web consulté avant celui-ci
  const affiche = PANNEAU && ongletsConnus.includes(fenetre.gBrowser.selectedTab) ? fenetre.gBrowser.selectedTab : null;
  const parDefaut = affiche || (avant && ongletsConnus.includes(avant) ? avant
    : [...ongletsConnus].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0]);
  for (const t of ongletsConnus) {
    const o = document.createElement("option");
    const titre = t.label || t.linkedBrowser.currentURI.spec;
    o.textContent = titre.length > 70 ? titre.slice(0, 68) + "…" : titre;
    o.selected = t == parDefaut;
    choix.append(o);
  }
  const aucun = !ongletsConnus.length;
  for (const id of ["resumer", "liens", "selection", "joindre"]) $(id).disabled = aucun;
  if (aucun) $("joindre").checked = false;
}

function ongletChoisi() {
  return ongletsConnus[$("onglet").selectedIndex] || null;
}

async function lirePage(onglet = ongletChoisi()) {
  if (!onglet) throw new Error("Choisissez d'abord une page web ouverte.");
  return A.contenu(onglet.linkedBrowser);
}

function etapesPage(page) {
  const coupe = page.texte.length > LIMITE_PAGE;
  return [`Page lue : « ${page.titre || page.adresse} »`,
    `Texte retenu : ${Math.min(page.texte.length, LIMITE_PAGE)} caractères` + (coupe ? ` sur ${page.texte.length} (début de la page)` : "")];
}

function extraitPage(page) {
  const coupe = page.texte.length > LIMITE_PAGE;
  return `Titre : ${page.titre}\nAdresse : ${page.adresse}\n\nContenu de la page${coupe ? " (début seulement, la page est longue)" : ""} :\n"""\n${page.texte.slice(0, LIMITE_PAGE)}\n"""`;
}

// ---------- rendu Markdown (sans HTML : tout passe par textContent) ----------

function enLigne(parent, texte) {
  const motif = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let pos = 0;
  for (const m of texte.matchAll(motif)) {
    if (m.index > pos) parent.append(texte.slice(pos, m.index));
    const t = m[0];
    let el;
    if (t.startsWith("**")) { el = document.createElement("strong"); el.textContent = t.slice(2, -2); }
    else if (t.startsWith("`")) { el = document.createElement("code"); el.textContent = t.slice(1, -1); }
    else { el = document.createElement("em"); el.textContent = t.slice(1, -1); }
    parent.append(el);
    pos = m.index + t.length;
  }
  if (pos < texte.length) parent.append(texte.slice(pos));
}

function markdown(boite, texte) {
  boite.textContent = "";
  const lignes = texte.split("\n");
  let liste = null;
  let para = null;
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    if (l.trim().startsWith("```")) {
      const code = [];
      i++;
      while (i < lignes.length && !lignes[i].trim().startsWith("```")) code.push(lignes[i++]);
      const pre = document.createElement("pre");
      const c = document.createElement("code");
      c.textContent = code.join("\n");
      pre.append(c);
      boite.append(pre);
      liste = para = null;
      continue;
    }
    const titre = l.match(/^#{1,6}\s+(.*)/);
    const puce = l.match(/^\s*[-*•]\s+(.*)/);
    const numero = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (titre) {
      const h = document.createElement("h3");
      enLigne(h, titre[1]);
      boite.append(h);
      liste = para = null;
    } else if (puce || numero) {
      const type = puce ? "ul" : "ol";
      if (!liste || liste.localName != type) { liste = document.createElement(type); boite.append(liste); }
      const li = document.createElement("li");
      enLigne(li, (puce || numero)[1]);
      liste.append(li);
      para = null;
    } else if (!l.trim()) {
      liste = para = null;
    } else {
      if (!para) { para = document.createElement("p"); boite.append(para); } else para.append(document.createElement("br"));
      enLigne(para, l);
      liste = null;
    }
  }
}

// ---------- fil de discussion ----------

function defiler() {
  const fil = $("fil");
  fil.scrollTop = fil.scrollHeight;
}

function bulleUtilisateur(texte, piece, restauration = false) {
  $("vide").hidden = true;
  if (!restauration) affichage.push({ role: "user", texte, piece: piece || "" });
  const b = document.createElement("div");
  b.className = "message utilisateur";
  b.textContent = texte;
  if (piece) {
    const p = document.createElement("span");
    p.className = "piece";
    p.textContent = piece;
    b.append(p);
  }
  $("fil").append(b);
  defiler();
}

// Pendant l'attente : une phrase qui change, et (au clic) le détail de ce que fait l'assistant.
const PHRASES = {
  lecture: ["La Cigale lit la page…", "La Cigale parcourt le texte…", "La Cigale repère l'essentiel…", "La Cigale souligne les passages importants…"],
  pensee: ["La Cigale réfléchit…", "La Cigale rassemble ses idées…", "La Cigale cherche les bons mots…", "La Cigale pèse le pour et le contre…", "La Cigale fredonne en réfléchissant…"],
  ecriture: ["La Cigale écrit…"],
};

function bulleAssistant(etapesInitiales = [], lecture = false) {
  $("vide").hidden = true;
  const b = document.createElement("div");
  b.className = "message assistant";
  const tete = document.createElement("button");
  tete.type = "button";
  tete.className = "pensee en-cours";
  tete.setAttribute("aria-expanded", "false");
  const pastille = document.createElement("img");
  pastille.className = "pastille";
  pastille.src = "chrome://browser/content/cigale/bouton.png";
  pastille.alt = "";
  const phrase = document.createElement("span");
  phrase.className = "phrase";
  const chrono = document.createElement("span");
  chrono.className = "chrono";
  const fleche = document.createElement("span");
  fleche.className = "fleche";
  tete.append(pastille, phrase, chrono, fleche);
  const etapes = document.createElement("ol");
  etapes.className = "etapes";
  etapes.hidden = true;
  const reponse = document.createElement("div");
  reponse.className = "reponse";
  tete.addEventListener("click", () => {
    etapes.hidden = !etapes.hidden;
    tete.setAttribute("aria-expanded", String(!etapes.hidden));
  });
  b.append(tete, etapes, reponse);
  $("fil").append(b);

  const debut = Date.now();
  const secondes = () => Math.round((Date.now() - debut) / 1000);
  let mode = lecture ? "lecture" : "pensee";
  let i = 0;
  let pourcent = "";
  const ajouter = (texte) => {
    const li = document.createElement("li");
    li.textContent = texte;
    etapes.append(li);
    defiler();
    return li;
  };
  const dire = () => {
    const liste = PHRASES[mode];
    phrase.textContent = liste[i % liste.length] + pourcent;
    chrono.textContent = secondes() + " s";
  };
  for (const e of etapesInitiales) ajouter(e);
  dire();
  const minuterie = setInterval(() => { i++; dire(); }, 2400);
  const horloge = setInterval(() => { chrono.textContent = secondes() + " s"; }, 1000);
  let ligneLecture = null;
  let reflexion = null;
  defiler();

  return {
    reponse,
    // vraie réflexion du modèle (modèle « Réfléchi ») : elle s'écrit au fur et à mesure dans le détail
    reflechit(bout) {
      if (!reflexion) {
        mode = "pensee";
        pourcent = "";
        ajouter(`Réflexion du modèle (après ${secondes()} s) :`);
        const li = document.createElement("li");
        li.className = "reflexion";
        etapes.append(li);
        reflexion = li;
      }
      reflexion.textContent += bout;
      if (!etapes.hidden) defiler();
    },
    etape(nom) {
      if (nom == "demarrage") ajouter("Réveil du moteur local");
      if (nom == "envoi") ajouter(`Modèle : ${A.nomModele(etatCourant.modele)}, sur cet ordinateur`);
    },
    progres(p) {
      if (!p?.total) return;
      const fait = Math.min(p.total, (p.processed || 0) + (p.cache || 0));
      pourcent = " " + Math.floor((fait / p.total) * 100) + " %";
      if (!ligneLecture) ligneLecture = ajouter("");
      ligneLecture.textContent = `Lecture du texte : ${fait} sur ${p.total} jetons` + (p.cache ? ` (dont ${p.cache} déjà lus)` : "");
      dire();
    },
    ecrit() {
      if (mode == "ecriture") return;
      mode = "ecriture";
      pourcent = "";
      ajouter(`Rédaction de la réponse (après ${secondes()} s)`);
      dire();
    },
    fin(texte, arrete) {
      clearInterval(minuterie);
      clearInterval(horloge);
      const mots = texte.split(/\s+/).filter(Boolean).length;
      ajouter(arrete ? `Arrêté après ${secondes()} s` : `Terminé en ${secondes()} s · ${mots} mots`);
      tete.classList.remove("en-cours");
      phrase.textContent = arrete ? "Réflexion arrêtée" : "Réflexion de La Cigale";
      chrono.textContent = secondes() + " s";
    },
  };
}

function actionsMessage(bulle, texte) {
  const barre = document.createElement("div");
  barre.className = "actions-message";
  const copier = document.createElement("button");
  copier.className = "discret";
  copier.textContent = "Copier";
  copier.addEventListener("click", () => {
    Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(texte);
    copier.textContent = "Copié";
    setTimeout(() => (copier.textContent = "Copier"), 1500);
  });
  barre.append(copier);
  bulle.append(barre);
}

function occupe(oui) {
  $("envoyer").hidden = oui;
  $("stop").hidden = !oui;
  for (const id of ["resumer", "liens", "selection", "effacer", "modele"]) $(id).disabled = oui;
}

// Envoie `contenu` au modèle (avec l'historique) et affiche la réponse en continu.
async function repondre(contenu, options = {}, etapes = [], lecture = false) {
  conversation.push({ role: "user", content: contenu });
  const vue = bulleAssistant(etapes, lecture);
  const bulle = vue.reponse;
  enCours = new AbortController();
  occupe(true);
  let texte = "";
  let dernier = 0;
  try {
    const consignes = SYSTEME + "\n\nContexte fourni par le navigateur (à jour) :\n" + (await A.contexte(fenetre));
    texte = await A.discuter([{ role: "system", content: consignes }, ...conversation], (bout) => {
      texte += bout;
      vue.ecrit();
      if (Date.now() - dernier > 60) {
        dernier = Date.now();
        markdown(bulle, texte);
        defiler();
      }
    }, enCours.signal, { ...options, etape: (n) => vue.etape(n), progres: (p) => vue.progres(p), reflexion: (b) => vue.reflechit(b) });
    markdown(bulle, texte);
    vue.fin(texte, false);
    conversation.push({ role: "assistant", content: texte });
    actionsMessage(bulle.parentNode, texte);
    affichage.push({ role: "assistant", texte });
    garderConversation();
  } catch (e) {
    vue.fin(texte, true);
    if (e.name == "AbortError") {
      if (texte) { markdown(bulle, texte); conversation.push({ role: "assistant", content: texte }); }
      else conversation.pop();
    } else {
      conversation.pop();
      bulle.classList.add("erreur-message");
      bulle.textContent = e.message || String(e);
    }
  } finally {
    enCours = null;
    occupe(false);
    defiler();
    rafraichir();
  }
}

function erreurDansLeFil(message) {
  const b = document.createElement("div");
  b.className = "message assistant erreur-message";
  b.textContent = message;
  $("fil").append(b);
  defiler();
}

async function envoyerQuestion(question) {
  question = question.trim();
  if (!question || enCours) return;
  let contenu = question;
  let piece = "";
  if ($("joindre").checked) {
    try {
      const page = await lirePage();
      if (pageJointe != page.adresse) {
        contenu = `${question}\n\n${extraitPage(page)}`;
        pageJointe = page.adresse;
      }
      piece = "Avec la page : " + (page.titre || page.adresse);
    } catch (e) {
      bulleUtilisateur(question);
      return erreurDansLeFil(e.message);
    }
  }
  bulleUtilisateur(question, piece);
  await repondre(contenu, {}, piece ? [piece] : [], !!piece);
}

async function resumer(onglet) {
  if (enCours) return;
  let page;
  try { page = await lirePage(onglet); } catch (e) { return erreurDansLeFil(e.message); }
  if (page.texte.length < 80) return erreurDansLeFil("Cette page ne contient presque pas de texte à résumer.");
  bulleUtilisateur("Résume cette page.", page.titre || page.adresse);
  pageJointe = page.adresse;
  await repondre(`Résume cette page. Commence par l'essentiel en deux phrases, puis les points clés en liste. Termine par ce qui manque ou paraît douteux, s'il y a lieu.\n\n${extraitPage(page)}`, { temperature: 0.3 }, etapesPage(page), true);
}

async function expliquerSelection(onglet) {
  if (enCours) return;
  let page;
  try { page = await lirePage(onglet); } catch (e) { return erreurDansLeFil(e.message); }
  if (!page.selection) return erreurDansLeFil("Sélectionnez d'abord un passage dans la page, puis recommencez.");
  bulleUtilisateur("Explique ce passage.", `« ${page.selection.slice(0, 160)}${page.selection.length > 160 ? "…" : ""} »`);
  await repondre(`Explique simplement ce passage, tiré de la page « ${page.titre} » (${page.adresse}) :\n"""\n${page.selection}\n"""`, { temperature: 0.4 }, [`Passage sélectionné : ${page.selection.length} caractères`], true);
}

function rapportLiens(page, a) {
  $("vide").hidden = true;
  const r = document.createElement("div");
  r.className = "rapport";
  const h = document.createElement("h3");
  h.textContent = "Liens de « " + (page.titre || page.adresse) + " »";
  const chiffres = document.createElement("div");
  chiffres.className = "chiffres";
  for (const [n, libelle] of [[a.total, "liens"], [a.domaines.length, "sites différents"], [a.total - a.internes, "vers d'autres sites"], [a.alertes.length, "à surveiller"]]) {
    const d = document.createElement("div");
    const b = document.createElement("b");
    b.textContent = n;
    const s = document.createElement("span");
    s.textContent = libelle;
    d.append(b, s);
    chiffres.append(d);
  }
  r.append(h, chiffres);
  if (a.alertes.length) {
    const t = document.createElement("table");
    for (const al of a.alertes.slice(0, 40)) {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      td1.textContent = al.texte ? `${al.texte} (${al.hote})` : al.hote;
      td1.title = al.adresse;
      const td2 = document.createElement("td");
      td2.className = "raison";
      td2.textContent = al.raisons.join(" · ");
      tr.append(td1, td2);
      t.append(tr);
    }
    r.append(t);
  } else {
    const p = document.createElement("p");
    p.className = "gris";
    p.textContent = "Aucun lien suspect selon les règles locales (raccourcisseurs, pistage, redirections, http, punycode, texte trompeur).";
    r.append(p);
  }
  const det = document.createElement("details");
  const sum = document.createElement("summary");
  sum.textContent = "Tous les sites liés";
  const dom = document.createElement("div");
  dom.className = "domaines";
  for (const d of a.domaines) {
    const x = document.createElement("div");
    x.textContent = `${d.domaine} · ${d.nombre}${d.externe ? "" : " (ce site)"}`;
    dom.append(x);
  }
  det.append(sum, dom);
  r.append(det);
  $("fil").append(r);
  defiler();
}

async function analyserLiens(onglet) {
  if (enCours) return;
  let page;
  try { page = await lirePage(onglet); } catch (e) { return erreurDansLeFil(e.message); }
  const a = A.analyserLiens(page);
  bulleUtilisateur("Analyse les liens de cette page.", page.titre || page.adresse);
  rapportLiens(page, a);
  if (!a.total) return;
  const resume = {
    page: page.adresse,
    liens: a.total,
    sites: a.domaines.slice(0, 15).map((d) => `${d.domaine} (${d.nombre}${d.externe ? "" : ", ce site"})`),
    alertes: a.alertes.slice(0, 25).map((x) => `${x.hote} « ${x.texte} » : ${x.raisons.join(" ; ")}`),
  };
  await repondre("Voici l'analyse automatique des liens d'une page web (faite localement par La Cigale). " +
    "Explique en quelques points ce qu'il faut en retenir : qui la page relie, quels liens éviter ou nettoyer et pourquoi. " +
    "N'invente pas de liens qui ne sont pas dans la liste.\n\n" + JSON.stringify(resume, null, 1), { temperature: 0.3 },
    [`Liens lus sur la page : ${a.total}`, `Règles locales appliquées : ${a.alertes.length} lien(s) à surveiller`], true);
}

// ---------- historique (facultatif) ----------

function garderConversation() {
  if (!A.historiqueActif()) return;
  if (!idConversation) idConversation = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const premier = affichage.find((x) => x.role == "user");
  A.enregistrerConversation({
    id: idConversation,
    titre: (premier?.texte || "Conversation").slice(0, 80),
    date: Date.now(),
    conversation, affichage, pageJointe,
  }).then(() => { if (!$("liste-conversations").hidden) dessinerConversations(); }).catch(console.error);
}

async function dessinerConversations() {
  const boite = $("liste-conversations");
  boite.textContent = "";
  const liste = await A.conversations();
  if (!liste.length) {
    const p = document.createElement("p");
    p.className = "gris";
    p.textContent = "Aucune conversation gardée pour l'instant.";
    boite.append(p);
    return;
  }
  for (const c of liste) {
    const ligne = document.createElement("div");
    ligne.className = "ligne-conversation" + (c.id == idConversation ? " actuelle" : "");
    const ouvrir = document.createElement("button");
    ouvrir.type = "button";
    ouvrir.className = "discret";
    const titre = document.createElement("b");
    titre.textContent = c.titre;
    const date = document.createElement("small");
    date.textContent = new Date(c.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    ouvrir.append(titre, date);
    ouvrir.addEventListener("click", () => restaurer(c));
    const suppr = document.createElement("button");
    suppr.type = "button";
    suppr.className = "discret supprimer";
    suppr.textContent = "Supprimer";
    suppr.addEventListener("click", async () => {
      await A.supprimerConversation(c.id);
      if (c.id == idConversation) idConversation = "";
      dessinerConversations();
    });
    ligne.append(ouvrir, suppr);
    boite.append(ligne);
  }
}

function basculerConversations(montrer = $("liste-conversations").hidden) {
  $("liste-conversations").hidden = !montrer;
  $("historique").setAttribute("aria-expanded", String(montrer));
  if (montrer) dessinerConversations();
}

function restaurer(c) {
  if (enCours) return;
  nouvelleConversation();
  conversation = c.conversation || [];
  affichage = c.affichage || [];
  pageJointe = c.pageJointe || "";
  idConversation = c.id;
  for (const m of affichage) {
    if (m.role == "user") { bulleUtilisateur(m.texte, m.piece, true); continue; }
    const b = document.createElement("div");
    b.className = "message assistant";
    const reponse = document.createElement("div");
    reponse.className = "reponse";
    b.append(reponse);
    $("fil").append(b);
    markdown(reponse, m.texte);
    actionsMessage(b, m.texte);
  }
  // page entière : la liste reste dans la barre latérale ; panneau : on la referme
  if (PANNEAU) basculerConversations(false); else dessinerConversations();
  defiler();
}

function montrerHistorique() {
  const actif = A.historiqueActif();
  // page entière : les conversations sont toujours listées dans la barre latérale, sans bouton
  $("historique").hidden = !actif || !PANNEAU;
  $("pied-sans").hidden = actif;
  $("pied-avec").hidden = !actif;
  basculerConversations(actif && !PANNEAU);
}

function nouvelleConversation() {
  enCours?.abort();
  conversation = [];
  affichage = [];
  idConversation = "";
  pageJointe = "";
  for (const el of [...$("fil").children]) if (el.id != "vide") el.remove();
  $("vide").hidden = false;
  if (!$("liste-conversations").hidden) dessinerConversations();
}

// ---------- événements ----------

$("installer").addEventListener("click", installer);
$("annuler").addEventListener("click", () => A.annulerTelechargement());
$("ouvrir-reglages").addEventListener("click", ouvrirReglages);
$("fermer-reglages").addEventListener("click", fermerReglages);
$("tout-supprimer").addEventListener("click", async () => {
  const ok = Services.prompt.confirm(window, "Assistant", "Supprimer le moteur et tous les modèles téléchargés ?");
  if (!ok) return;
  nouvelleConversation();
  await A.toutSupprimer();
  fermerReglages();
});
$("modele").addEventListener("change", (e) => A.choisirModele(e.target.value));
$("apropos").addEventListener("change", (e) => A.definirAPropos(e.target.value));
for (const nom of A.CONTEXTE) $("contexte-" + nom).addEventListener("change", (e) => A.autoriserContexte(nom, e.target.checked));
$("personnaliser").addEventListener("click", ouvrirReglages);
$("resumer").addEventListener("click", () => resumer());
$("liens").addEventListener("click", () => analyserLiens());
$("selection").addEventListener("click", () => expliquerSelection());
$("effacer").addEventListener("click", nouvelleConversation);
$("historique").addEventListener("click", () => basculerConversations());
$("historique-actif").addEventListener("change", async (e) => {
  await A.activerHistorique(e.target.checked);
  if (e.target.checked && affichage.length) garderConversation();
  montrerHistorique();
});
$("effacer-conversations").addEventListener("click", async () => {
  if (!Services.prompt.confirm(window, "Assistant", "Effacer toutes les conversations gardées ?")) return;
  await A.effacerConversations();
  idConversation = "";
  if (!$("liste-conversations").hidden) dessinerConversations();
});
montrerHistorique();
$("montrer-page").addEventListener("click", () => {
  const ouvert = $("outils-page").hidden;
  $("outils-page").hidden = !ouvert;
  $("montrer-page").setAttribute("aria-expanded", String(ouvert));
  if (ouvert) remplirOnglets();
});
$("stop").addEventListener("click", () => enCours?.abort());
$("onglet").addEventListener("focus", () => remplirOnglets());
$("formulaire").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("question").value;
  $("question").value = "";
  ajusterSaisie();
  envoyerQuestion(q);
});
function ajusterSaisie() {
  const t = $("question");
  t.style.height = "auto";
  t.style.height = Math.min(220, t.scrollHeight) + "px";
}
$("question").addEventListener("input", ajusterSaisie);
$("question").addEventListener("keydown", (e) => {
  if (e.key == "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("formulaire").requestSubmit();
  }
});
for (const b of document.querySelectorAll("[data-suggestion], [data-action]")) {
  b.addEventListener("click", () => {
    if (b.dataset.action == "resumer") return resumer();
    if (b.dataset.action == "liens") return analyserLiens();
    envoyerQuestion(b.dataset.suggestion);
  });
}

const arreterSurveillance = A.surveiller(() => rafraichir());
window.addEventListener("unload", () => { arreterSurveillance(); enCours?.abort(); });
const surOnglet = () => remplirOnglets(PANNEAU ? fenetre.gBrowser.selectedTab : undefined);
fenetre?.gBrowser?.tabContainer.addEventListener("TabSelect", surOnglet);
window.addEventListener("unload", () => fenetre?.gBrowser?.tabContainer.removeEventListener("TabSelect", surOnglet));
if (PANNEAU) $("joindre").checked = true;

// demande venue du clic droit (« Résumer avec l'assistant »…)
async function traiterDemande() {
  const d = A.prendreDemande();
  if (d?.onglet && (await A.estPret())) {
    remplirOnglets(d.onglet);
    $("outils-page").hidden = false;
    if (d.action == "resumer") resumer(d.onglet);
    else if (d.action == "liens") analyserLiens(d.onglet);
    else if (d.action == "selection") expliquerSelection(d.onglet);
  }
}
// (le panneau ne prend pas ces demandes : elles vont à l'onglet about:assistant)
const observateur = { observe: () => traiterDemande() };
if (!PANNEAU) {
  Services.obs.addObserver(observateur, "cigale-assistant-demande");
  window.addEventListener("unload", () => Services.obs.removeObserver(observateur, "cigale-assistant-demande"));
}
async function demarrerPage() {
  await rafraichir();
  remplirOnglets();
  if (!PANNEAU) await traiterDemande();
  if (await A.estPret()) $("question").focus();
}
demarrerPage();
