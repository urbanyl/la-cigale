"use strict";

const MOTEURS = {
  qwant: "https://www.qwant.com/?q=",
  ddg: "https://duckduckgo.com/?q=",
  startpage: "https://www.startpage.com/sp/search?language=francais&query=",
  lilo: "https://search.lilo.org/?q=",
  wikipedia: "https://fr.wikipedia.org/w/index.php?search=",
};

const RACCOURCIS_DEFAUT = [
  { nom: "Wikipédia", url: "https://fr.wikipedia.org" },
  { nom: "OpenStreetMap", url: "https://www.openstreetmap.org" },
  { nom: "Service-Public", url: "https://www.service-public.fr" },
  { nom: "Météo-France", url: "https://meteofrance.com" },
  { nom: "France Culture", url: "https://www.radiofrance.fr/franceculture" },
  { nom: "Framasoft", url: "https://framasoft.org" },
];

// Le stockage local peut être indisponible : la page doit fonctionner sans.
const stockage = {
  lire(cle, defaut) {
    try {
      const v = localStorage.getItem("cigale." + cle);
      return v === null ? defaut : JSON.parse(v);
    } catch {
      return defaut;
    }
  },
  ecrire(cle, valeur) {
    try { localStorage.setItem("cigale." + cle, JSON.stringify(valeur)); } catch { /* ignoré */ }
  },
};

// Horloge et salutation
const $ = (id) => document.getElementById(id);

function rafraichirHeure() {
  const maintenant = new Date();
  const h = maintenant.getHours();
  $("heure").textContent = maintenant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  $("heure").dateTime = maintenant.toISOString();
  $("date").textContent = maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("salut").textContent = h >= 18 || h < 5 ? "Bonsoir" : "Bonjour";
}
rafraichirHeure();
setInterval(rafraichirHeure, 10_000);

// Recherche
const champ = $("q");

// Sélecteur de moteur sur mesure (motif « listbox » accessible au clavier)
const moteur = {
  bouton: $("moteur-bouton"),
  liste: $("moteur-liste"),
  options: [...document.querySelectorAll("#moteur-liste [role=option]")],
  valeur: null,
  actif: 0,

  choisir(valeur) {
    if (!MOTEURS[valeur]) valeur = "ddg";
    this.valeur = valeur;
    this.options.forEach((o, i) => {
      const choisi = o.dataset.valeur === valeur;
      o.setAttribute("aria-selected", choisi);
      o.id = "moteur-option-" + i;
      if (choisi) {
        this.actif = i;
        $("moteur-nom").textContent = o.textContent;
      }
    });
    stockage.ecrire("moteur", valeur);
  },
  surligner(i) {
    this.actif = (i + this.options.length) % this.options.length;
    this.options.forEach((o, j) => o.classList.toggle("actif", j === this.actif));
    this.liste.setAttribute("aria-activedescendant", this.options[this.actif].id);
  },
  ouvrir() {
    this.liste.hidden = false;
    this.bouton.setAttribute("aria-expanded", "true");
    this.surligner(this.options.findIndex((o) => o.dataset.valeur === this.valeur));
    this.liste.focus();
  },
  fermer(rendreFocus = true) {
    if (this.liste.hidden) return;
    this.liste.hidden = true;
    this.bouton.setAttribute("aria-expanded", "false");
    if (rendreFocus) this.bouton.focus();
  },
};

moteur.choisir(stockage.lire("moteur", "ddg"));
moteur.bouton.addEventListener("click", () => (moteur.liste.hidden ? moteur.ouvrir() : moteur.fermer()));
moteur.bouton.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); moteur.ouvrir(); }
});
moteur.options.forEach((o, i) => {
  o.addEventListener("mousemove", () => moteur.surligner(i));
  o.addEventListener("click", () => { moteur.choisir(o.dataset.valeur); moteur.fermer(false); champ.focus(); });
});
moteur.liste.addEventListener("keydown", (e) => {
  const touches = {
    ArrowDown: () => moteur.surligner(moteur.actif + 1),
    ArrowUp: () => moteur.surligner(moteur.actif - 1),
    Home: () => moteur.surligner(0),
    End: () => moteur.surligner(moteur.options.length - 1),
    Enter: () => { moteur.choisir(moteur.options[moteur.actif].dataset.valeur); moteur.fermer(false); champ.focus(); },
    " ": () => touches.Enter(),
    Escape: () => moteur.fermer(),
    Tab: () => moteur.fermer(false),
  };
  if (touches[e.key]) {
    if (e.key !== "Tab") e.preventDefault();
    touches[e.key]();
  }
});
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".moteur")) moteur.fermer(false);
});

function versAdresse(texte) {
  if (/^https?:\/\//i.test(texte)) return texte;
  if (!/\s/.test(texte) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(texte)) return "https://" + texte;
  return null;
}

$("recherche").addEventListener("submit", (e) => {
  e.preventDefault();
  const texte = champ.value.trim();
  if (!texte) return;
  location.href = versAdresse(texte) ?? MOTEURS[moteur.valeur] + encodeURIComponent(texte);
});

// Raccourcis
let raccourcis = stockage.lire("raccourcis", RACCOURCIS_DEFAUT);
const liste = $("raccourcis");

function afficherRaccourcis() {
  liste.replaceChildren(
    ...raccourcis.map((r, i) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.index = i;
      li.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/x-cigale-index", String(i));
        li.classList.add("glisse");
      });
      li.addEventListener("dragend", () => li.classList.remove("glisse"));
      li.addEventListener("dragover", (e) => {
        if (!e.dataTransfer.types.includes("text/x-cigale-index")) return;
        e.preventDefault();
        li.classList.add("cible");
      });
      li.addEventListener("dragleave", () => li.classList.remove("cible"));
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        li.classList.remove("cible");
        deplacer(Number(e.dataTransfer.getData("text/x-cigale-index")), i);
      });
      const a = document.createElement("a");
      a.href = r.url;
      const pastille = document.createElement("span");
      pastille.className = "pastille";
      pastille.textContent = r.nom.trim().charAt(0).toUpperCase();
      const nom = document.createElement("span");
      nom.className = "nom";
      nom.textContent = r.nom;
      a.append(pastille, nom);

      const suppr = document.createElement("button");
      suppr.className = "supprimer";
      suppr.type = "button";
      suppr.textContent = "×";
      suppr.setAttribute("aria-label", `Retirer ${r.nom}`);
      suppr.addEventListener("click", () => {
        raccourcis.splice(i, 1);
        stockage.ecrire("raccourcis", raccourcis);
        afficherRaccourcis();
      });
      // Au clavier : flèches gauche/droite en mode édition
      const gauche = boutonDeplacement("←", `Déplacer ${r.nom} vers la gauche`, () => deplacer(i, i - 1));
      const droite = boutonDeplacement("→", `Déplacer ${r.nom} vers la droite`, () => deplacer(i, i + 1));
      const fleches = document.createElement("div");
      fleches.className = "fleches";
      fleches.append(gauche, droite);
      li.append(a, suppr, fleches);
      return li;
    })
  );
}
function boutonDeplacement(texte, libelle, action) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = texte;
  b.setAttribute("aria-label", libelle);
  b.addEventListener("click", action);
  return b;
}

function deplacer(de, vers) {
  if (vers < 0 || vers >= raccourcis.length || de === vers || Number.isNaN(de)) return;
  const [element] = raccourcis.splice(de, 1);
  raccourcis.splice(vers, 0, element);
  stockage.ecrire("raccourcis", raccourcis);
  afficherRaccourcis();
}

afficherRaccourcis();

$("modifier").addEventListener("click", () => {
  const actif = liste.classList.toggle("edition");
  $("ajout").hidden = !actif;
  $("modifier").textContent = actif ? "Terminé" : "Modifier";
});

$("ajout").addEventListener("submit", (e) => {
  e.preventDefault();
  const url = $("ajout-url").value.trim();
  if (!/^https?:\/\//i.test(url)) return;
  raccourcis.push({ nom: $("ajout-nom").value.trim(), url });
  stockage.ecrire("raccourcis", raccourcis);
  e.target.reset();
  afficherRaccourcis();
});

$("reinitialiser").addEventListener("click", () => {
  raccourcis = structuredClone(RACCOURCIS_DEFAUT);
  stockage.ecrire("raccourcis", raccourcis);
  afficherRaccourcis();
});

// Personnalisation
const REGLAGES_DEFAUT = { mode: "sombre", fond: "cigale", citation: true, horloge: true };
const reglages = { ...REGLAGES_DEFAUT, ...stockage.lire("reglages", {}) };
const sombreSysteme = matchMedia("(prefers-color-scheme: dark)");

function appliquerReglages() {
  const clair = reglages.mode === "clair" || (reglages.mode === "auto" && !sombreSysteme.matches);
  document.body.dataset.mode = clair ? "clair" : "sombre";
  document.body.dataset.fond = reglages.fond;
  $("symbole").src = clair ? "img/symbole-noir.webp" : "img/symbole-blanc.webp";
  $("citation").hidden = !reglages.citation;
  $("heure").hidden = !reglages.horloge;
  document.querySelectorAll(".choix input").forEach((entree) => {
    entree.checked = reglages[entree.name] === entree.value;
  });
  $("reglage-citation").checked = reglages.citation;
  $("reglage-horloge").checked = reglages.horloge;
}

function modifierReglage(cle, valeur) {
  reglages[cle] = valeur;
  stockage.ecrire("reglages", reglages);
  appliquerReglages();
}

document.querySelectorAll(".choix input").forEach((entree) =>
  entree.addEventListener("change", () => modifierReglage(entree.name, entree.value))
);
$("reglage-citation").addEventListener("change", (e) => modifierReglage("citation", e.target.checked));
$("reglage-horloge").addEventListener("change", (e) => modifierReglage("horloge", e.target.checked));
sombreSysteme.addEventListener("change", appliquerReglages);

const panneau = $("panneau");
$("personnaliser").addEventListener("click", () => panneau.showModal());
$("panneau-fermer").addEventListener("click", () => panneau.close());
panneau.addEventListener("click", (e) => { if (e.target === panneau) panneau.close(); });
panneau.addEventListener("close", () => $("personnaliser").focus());

// Citation du jour (liste locale, aucune requête réseau)
const [texteCitation, auteurCitation] = citationDuJour();
$("citation-texte").textContent = texteCitation;
$("citation-auteur").textContent = auteurCitation;

appliquerReglages();
