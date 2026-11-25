"use strict";

// about:sudoku : sudoku hors ligne. Grilles générées sur place, solution unique.
const $ = (id) => document.getElementById(id);

const NIVEAUX = {
  facile: { nom: "Facile", indices: 40, suivant: "moyen" },
  moyen: { nom: "Moyen", indices: 32, suivant: "difficile" },
  difficile: { nom: "Difficile", indices: 27, suivant: "expert" },
  expert: { nom: "Expert", indices: 22, suivant: null },
};
const AIDES_MAX = 3;
const CLE_PARTIE = "partie";
const CLE_RECORDS = "records";

// ---------- géométrie ----------
const LIGNE = [], COLONNE = [], BLOC = [];
for (let i = 0; i < 81; i++) {
  LIGNE[i] = Math.floor(i / 9);
  COLONNE[i] = i % 9;
  BLOC[i] = Math.floor(LIGNE[i] / 3) * 3 + Math.floor(COLONNE[i] / 3);
}
const UNITES = [];
for (let k = 0; k < 9; k++) {
  UNITES.push([...Array(81).keys()].filter((i) => LIGNE[i] == k));
  UNITES.push([...Array(81).keys()].filter((i) => COLONNE[i] == k));
  UNITES.push([...Array(81).keys()].filter((i) => BLOC[i] == k));
}
const VOISINS = [...Array(81).keys()].map((i) =>
  [...Array(81).keys()].filter((j) => j != i && (LIGNE[j] == LIGNE[i] || COLONNE[j] == COLONNE[i] || BLOC[j] == BLOC[i])));

function melanger(t) {
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}
function nbBits(m) { let n = 0; while (m) { m &= m - 1; n++; } return n; }

// ---------- résolution (compte les solutions jusqu'à « limite ») ----------
function resoudre(g, limite = 1, hasard = false) {
  const lig = new Array(9).fill(0), col = new Array(9).fill(0), blo = new Array(9).fill(0);
  const vides = [];
  for (let i = 0; i < 81; i++) {
    if (g[i]) {
      const b = 1 << g[i];
      lig[LIGNE[i]] |= b; col[COLONNE[i]] |= b; blo[BLOC[i]] |= b;
    } else vides.push(i);
  }
  let n = 0;
  const rec = () => {
    let meilleur = -1, masque = 0, compte = 10;
    for (const i of vides) {
      if (g[i]) continue;
      const m = ~(lig[LIGNE[i]] | col[COLONNE[i]] | blo[BLOC[i]]) & 0x3fe;
      const c = nbBits(m);
      if (c < compte) {
        compte = c; meilleur = i; masque = m;
        if (c <= 1) break;
      }
    }
    if (meilleur < 0) { n++; return n >= limite; }
    if (compte == 0) return false;
    const chiffres = [];
    for (let d = 1; d <= 9; d++) if (masque & (1 << d)) chiffres.push(d);
    if (hasard) melanger(chiffres);
    const L = LIGNE[meilleur], C = COLONNE[meilleur], B = BLOC[meilleur];
    for (const d of chiffres) {
      const b = 1 << d;
      g[meilleur] = d; lig[L] |= b; col[C] |= b; blo[B] |= b;
      if (rec()) return true;
      g[meilleur] = 0; lig[L] &= ~b; col[C] &= ~b; blo[B] &= ~b;
    }
    return false;
  };
  rec();
  return n;
}

function generer(niveau) {
  const solution = new Array(81).fill(0);
  resoudre(solution, 1, true);
  const g = solution.slice();
  let restants = 81;
  const cible = NIVEAUX[niveau].indices;
  // d'abord par paires symétriques (grille plus belle), puis case par case si besoin
  for (const i of melanger([...Array(41).keys()])) {
    if (restants <= cible) break;
    const j = 80 - i;
    const a = g[i], b = g[j];
    g[i] = 0; g[j] = 0;
    if (resoudre(g.slice(), 2) == 1) restants -= i == j ? 1 : 2;
    else { g[i] = a; g[j] = b; }
  }
  for (const i of melanger([...Array(81).keys()])) {
    if (restants <= cible) break;
    if (!g[i]) continue;
    const a = g[i];
    g[i] = 0;
    if (resoudre(g.slice(), 2) == 1) restants--;
    else g[i] = a;
  }
  return { donnees: g, solution };
}

// ---------- stockage ----------
// Une page about: ordinaire n'a pas de stockage local : La Cigale garde la partie et les records
// (jeu.sys.mjs). Sans réponse, le jeu marche quand même, sans mémoire.
const stock = {};
function lire(cle) { return stock[cle] ?? null; }
function ecrire(cle, valeur) {
  stock[cle] = valeur;
  document.dispatchEvent(new CustomEvent("cigale-sudoku-sauver", { bubbles: true, detail: JSON.stringify({ cle, valeur }) }));
}

// ---------- état ----------
let etat = null;        // { niveau, donnees, solution, valeurs, notes, temps, aides, aidees, fini }
let choisie = -1;       // case sélectionnée
let surligne = 0;       // chiffre mis en avant quand aucune case n'est choisie
let modeNotes = false;
let enPause = false;
let historique = [];

function nouvellePartie(niveau) {
  const { donnees, solution } = generer(niveau);
  etat = {
    niveau, donnees, solution, valeurs: donnees.slice(), notes: new Array(81).fill(0),
    temps: 0, aides: AIDES_MAX, aidees: [], fini: false,
  };
  historique = [];
  choisie = -1;
  surligne = 0;
  enPause = false;
  ecrire(CLE_PARTIE, etat);
  rendre();
  // petite cascade d'entrée
  cases.forEach((c, i) => {
    if (!etat.donnees[i]) return;
    c.classList.remove("pose");
    void c.offsetWidth;
    c.querySelector(".chiffre").style.animationDelay = `${(LIGNE[i] + COLONNE[i]) * 18}ms`;
    c.classList.add("pose");
  });
}

function verrouillee(i) { return !!etat.donnees[i] || etat.aidees.includes(i); }

function conflits() {
  const v = etat.valeurs, s = new Set();
  for (let i = 0; i < 81; i++) {
    if (!v[i]) continue;
    for (const j of VOISINS[i]) if (v[j] == v[i]) { s.add(i); break; }
  }
  return s;
}

// ---------- affichage ----------
const grille = $("grille");
const cases = [];
for (let i = 0; i < 81; i++) {
  const c = document.createElement("div");
  c.className = "case" + (COLONNE[i] == 2 || COLONNE[i] == 5 ? " d3" : "") + (LIGNE[i] == 2 || LIGNE[i] == 5 ? " l3" : "");
  c.setAttribute("role", "gridcell");
  c.dataset.i = i;
  const chiffre = document.createElement("span");
  chiffre.className = "chiffre";
  const notes = document.createElement("div");
  notes.className = "notes-case";
  for (let d = 1; d <= 9; d++) notes.append(document.createElement("span"));
  c.append(chiffre, notes);
  c.addEventListener("mousedown", (e) => { e.preventDefault(); choisir(i); });
  grille.append(c);
  cases.push(c);
}

const pave = $("pave");
const touches = [];
for (let d = 1; d <= 9; d++) {
  const t = document.createElement("button");
  t.className = "touche";
  const b = document.createElement("b");
  b.textContent = d;
  const s = document.createElement("small");
  t.append(b, s);
  t.addEventListener("click", () => jouer(d));
  pave.append(t);
  touches.push(t);
}

function format(s) {
  const m = Math.floor(s / 60), r = s % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

function rendre() {
  if (!etat) return;
  const v = etat.valeurs;
  const vise = choisie >= 0 ? v[choisie] : surligne;
  const mauvais = conflits();
  for (let i = 0; i < 81; i++) {
    const c = cases[i];
    const zone = choisie >= 0 && i != choisie &&
      (LIGNE[i] == LIGNE[choisie] || COLONNE[i] == COLONNE[choisie] || BLOC[i] == BLOC[choisie]);
    c.classList.toggle("donnee", !!etat.donnees[i]);
    c.classList.toggle("aidee", etat.aidees.includes(i));
    c.classList.toggle("saisie", !!v[i] && !verrouillee(i));
    c.classList.toggle("choisie", i == choisie);
    c.classList.toggle("zone", zone);
    c.classList.toggle("meme", !!vise && v[i] == vise && i != choisie);
    c.classList.toggle("conflit", mauvais.has(i) && !etat.donnees[i]);
    c.firstChild.textContent = v[i] || "";
    const n = v[i] ? 0 : etat.notes[i];
    [...c.lastChild.children].forEach((s, k) => {
      const d = k + 1;
      s.textContent = n & (1 << d) ? d : "";
      s.classList.toggle("allumee", !!vise && d == vise);
    });
    c.setAttribute("aria-label", `Ligne ${LIGNE[i] + 1}, colonne ${COLONNE[i] + 1}${v[i] ? ", " + v[i] : ", vide"}`);
  }
  for (let d = 1; d <= 9; d++) {
    const places = v.filter((x) => x == d).length;
    const t = touches[d - 1];
    t.lastChild.textContent = places >= 9 ? "" : `${9 - places} restant${9 - places > 1 ? "s" : ""}`;
    t.classList.toggle("fini", places >= 9);
    t.classList.toggle("actif", !!vise && vise == d);
  }
  pave.classList.toggle("notes", modeNotes);
  $("notes").setAttribute("aria-pressed", String(modeNotes));
  $("notes-etat").textContent = modeNotes ? "oui" : "non";
  $("indice-etat").textContent = etat.aides;
  $("indice").disabled = etat.aides <= 0 || etat.fini;
  $("annuler").disabled = !historique.length || etat.fini;
  for (const b of $("niveaux").children) b.setAttribute("aria-checked", String(b.dataset.niveau == etat.niveau));
  $("temps").textContent = format(etat.temps);
  const record = (lire(CLE_RECORDS) || {})[etat.niveau];
  $("record").textContent = record ? format(record) : "–";
  $("voile").hidden = !enPause && !etat.fini;
  $("voile-pause").hidden = !enPause || etat.fini;
  $("voile-victoire").hidden = !etat.fini;
}

// ---------- actions ----------
function choisir(i) {
  if (!etat || enPause || etat.fini) return;
  choisie = i;
  surligne = 0;
  rendre();
}

function animerPose(i) {
  const c = cases[i];
  c.firstChild.style.animationDelay = "";
  c.classList.remove("pose");
  void c.offsetWidth;
  c.classList.add("pose");
}

function vagues(i) {
  const v = etat.valeurs;
  for (const u of UNITES) {
    if (!u.includes(i)) continue;
    const vus = new Set(u.map((k) => v[k]));
    if (vus.has(0) || vus.size != 9) continue;
    u.forEach((k, rang) => {
      const c = cases[k];
      c.classList.remove("vague");
      void c.offsetWidth;
      c.style.animationDelay = `${rang * 35}ms`;
      c.classList.add("vague");
    });
  }
}

function jouer(d) {
  if (!etat || enPause || etat.fini) return;
  if (choisie < 0) {
    // aucune case choisie : le chiffre est mis en avant dans la grille
    surligne = surligne == d ? 0 : d;
    rendre();
    return;
  }
  const i = choisie;
  if (verrouillee(i)) {
    surligne = 0;
    rendre();
    return;
  }
  const v = etat.valeurs, notes = etat.notes;
  const changements = [[i, v[i], notes[i]]];
  if (modeNotes && d) {
    if (v[i]) return;
    notes[i] ^= 1 << d;
  } else {
    const nouveau = v[i] == d ? 0 : d;
    if (!nouveau && !v[i] && !notes[i]) return;
    v[i] = nouveau;
    if (!d) notes[i] = 0;
    if (nouveau) {
      const b = 1 << nouveau;
      for (const j of VOISINS[i]) {
        if (notes[j] & b) { changements.push([j, v[j], notes[j]]); notes[j] &= ~b; }
      }
    }
  }
  historique.push(changements);
  if (v[i] && !modeNotes) { animerPose(i); vagues(i); }
  apresCoup();
}

function apresCoup() {
  const v = etat.valeurs;
  if (!v.includes(0) && !conflits().size) gagner();
  ecrire(CLE_PARTIE, etat);
  rendre();
}

function annuler() {
  if (!etat || enPause || etat.fini) return;
  const changements = historique.pop();
  if (!changements) return;
  for (const [i, val, n] of changements.reverse()) {
    if (verrouillee(i)) continue;
    etat.valeurs[i] = val;
    etat.notes[i] = n;
  }
  choisie = changements[changements.length - 1][0];
  ecrire(CLE_PARTIE, etat);
  rendre();
}

function aider() {
  if (!etat || enPause || etat.fini || etat.aides <= 0) return;
  const v = etat.valeurs, sol = etat.solution;
  let i = choisie;
  if (i < 0 || verrouillee(i) || v[i] == sol[i]) {
    // la case choisie est déjà juste : une case vide ou fausse au hasard
    const possibles = [...Array(81).keys()].filter((k) => v[k] != sol[k]);
    if (!possibles.length) return;
    i = possibles[Math.floor(Math.random() * possibles.length)];
  }
  v[i] = sol[i];
  etat.notes[i] = 0;
  const b = 1 << sol[i];
  for (const j of VOISINS[i]) etat.notes[j] &= ~b;
  etat.aidees.push(i);
  etat.aides--;
  choisie = i;
  animerPose(i);
  vagues(i);
  apresCoup();
}

function gagner() {
  etat.fini = true;
  choisie = -1;
  const records = lire(CLE_RECORDS) || {};
  const ancien = records[etat.niveau];
  const neuf = !ancien || etat.temps < ancien;
  if (neuf) { records[etat.niveau] = etat.temps; ecrire(CLE_RECORDS, records); }
  const aides = AIDES_MAX - etat.aides;
  $("victoire-niveau").textContent = NIVEAUX[etat.niveau].nom;
  const texte = $("victoire-texte");
  texte.replaceChildren();
  if (neuf && ancien) {
    const r = document.createElement("span");
    r.className = "record-neuf";
    r.textContent = "Nouveau record";
    texte.append(r, document.createElement("br"));
  }
  const t = document.createElement("b");
  t.textContent = format(etat.temps);
  texte.append("Grille terminée en ", t,
    aides ? ` avec ${aides} indice${aides > 1 ? "s" : ""}.` : ", sans indice.");
  const suivant = NIVEAUX[etat.niveau].suivant;
  $("plus-dur").hidden = !suivant;
  if (suivant) $("plus-dur").textContent = `Passer en ${NIVEAUX[suivant].nom.toLowerCase()}`;
  // la grille entière ondule
  cases.forEach((c, k) => {
    c.classList.remove("vague");
    void c.offsetWidth;
    c.style.animationDelay = `${(LIGNE[k] + COLONNE[k]) * 30}ms`;
    c.classList.add("vague");
  });
  setTimeout(rendre, 650);
  etat.fini = true;
  ecrire(CLE_PARTIE, etat);
}

function enCours() {
  return !etat.fini && etat.valeurs.some((x, i) => x && !etat.donnees[i]);
}

function changerNiveau(niveau) {
  if (!etat) return;
  if (enCours() && !confirm("Commencer une nouvelle grille ? La partie en cours sera perdue.")) return;
  nouvellePartie(niveau);
}

function basculerPause(forcer) {
  if (!etat || etat.fini) return;
  enPause = forcer ?? !enPause;
  rendre();
}

// ---------- commandes ----------
$("niveaux").addEventListener("click", (e) => {
  const b = e.target.closest("[data-niveau]");
  if (b && b.dataset.niveau != etat.niveau) changerNiveau(b.dataset.niveau);
});
$("nouvelle").addEventListener("click", () => changerNiveau(etat.niveau));
$("rejouer").addEventListener("click", () => nouvellePartie(etat.niveau));
$("plus-dur").addEventListener("click", () => nouvellePartie(NIVEAUX[etat.niveau].suivant));
$("annuler").addEventListener("click", annuler);
$("effacer").addEventListener("click", () => jouer(0));
$("notes").addEventListener("click", () => { modeNotes = !modeNotes; rendre(); });
$("indice").addEventListener("click", aider);
$("pause").addEventListener("click", () => basculerPause());
$("reprendre").addEventListener("click", () => basculerPause(false));
for (const t of touches) t.addEventListener("mousedown", (e) => e.preventDefault());

const CHIFFRES = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6, Digit7: 7, Digit8: 8, Digit9: 9 };
document.addEventListener("keydown", (e) => {
  if (!etat || e.altKey || e.metaKey) return;
  const touche = e.key.toLowerCase();
  if ((e.ctrlKey && touche == "z")) { e.preventDefault(); annuler(); return; }
  if (e.ctrlKey) return;
  if (touche == "p" || (enPause && e.key == "Escape")) { e.preventDefault(); basculerPause(); return; }
  if (enPause || etat.fini) return;
  // chiffres de la rangée du haut (sans Maj sur un clavier AZERTY) ou du pavé numérique
  const d = CHIFFRES[e.code] || (/^[1-9]$/.test(e.key) ? Number(e.key) : 0);
  if (d) { e.preventDefault(); jouer(d); return; }
  if (["Backspace", "Delete"].includes(e.key) || e.code == "Digit0" || e.key == "0") { e.preventDefault(); jouer(0); return; }
  if (touche == "n") { modeNotes = !modeNotes; rendre(); return; }
  if (touche == "h") { aider(); return; }
  if (e.key == "Escape") { choisie = -1; surligne = 0; rendre(); return; }
  const fleches = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (fleches[e.key]) {
    e.preventDefault();
    if (choisie < 0) { choisir(40); return; }
    const l = LIGNE[choisie], c = COLONNE[choisie];
    const nl = e.key == "ArrowUp" ? (l + 8) % 9 : e.key == "ArrowDown" ? (l + 1) % 9 : l;
    const nc = e.key == "ArrowLeft" ? (c + 8) % 9 : e.key == "ArrowRight" ? (c + 1) % 9 : c;
    choisir(nl * 9 + nc);
  }
});
// clic hors de la grille et des commandes : plus de case choisie
document.addEventListener("mousedown", (e) => {
  if (!e.target.closest(".cadre, .cote, .niveaux, .retour")) { choisie = -1; surligne = 0; rendre(); }
});

// ---------- temps ----------
setInterval(() => {
  if (!etat || etat.fini || enPause || document.visibilityState != "visible") return;
  etat.temps++;
  $("temps").textContent = format(etat.temps);
  if (etat.temps % 5 == 0) ecrire(CLE_PARTIE, etat);
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState == "hidden" && etat && !etat.fini && enCours()) basculerPause(true);
});

// ---------- retour à la page qui n'a pas chargé ----------
const pageRatee = (() => {
  const u = (location.hash.match(/[#&]u=([^&]+)/) || [])[1];
  if (!u) return null;
  try {
    const url = new URL(decodeURIComponent(u));
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
})();
if (pageRatee) {
  $("retour").hidden = false;
  $("retour-lien").href = pageRatee;
  $("retour-lien").title = pageRatee;
  window.addEventListener("online", () => {
    $("retour").classList.add("revenue");
    $("retour-texte").textContent = "La connexion est revenue.";
    $("retour-lien").classList.add("plein");
    $("retour-lien").textContent = "Revenir à la page";
  });
} else {
  $("surtitre").textContent = "La Cigale";
}

// ---------- démarrage : reprend la partie en cours ----------
let demarre = false;
function demarrer(donnees) {
  if (demarre) return;
  demarre = true;
  if (donnees && typeof donnees == "object") Object.assign(stock, donnees);
  const sauvee = lire(CLE_PARTIE);
  if (sauvee && Array.isArray(sauvee.valeurs) && sauvee.valeurs.length == 81 && NIVEAUX[sauvee.niveau] && !sauvee.fini) {
    etat = sauvee;
    etat.aidees ||= [];
    rendre();
  } else {
    nouvellePartie(sauvee && NIVEAUX[sauvee.niveau] ? sauvee.niveau : "facile");
  }
}
window.addEventListener("cigale-sudoku-donnees", (e) => {
  let donnees = null;
  try { donnees = JSON.parse(e.detail); } catch {}
  demarrer(donnees);
});
document.dispatchEvent(new CustomEvent("cigale-sudoku-charger", { bubbles: true }));
setTimeout(() => demarrer(null), 700);
