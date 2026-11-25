// La Cigale 1.6 : petits outils du quotidien.
// Copie d'adresse propre (Ctrl+Maj+C), palette de commandes (Ctrl+K), mini-lecteur, petite fenêtre
// rapide (Ctrl+Alt+N), notes, gestes de souris, aperçu des liens (Alt+clic), retouches par site.
// Chargé par plus.sys.mjs : installer() une fois, puis fenetre(win) pour chaque fenêtre.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
  setInterval: "resource://gre/modules/Timer.sys.mjs",
  clearInterval: "resource://gre/modules/Timer.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

const P = Services.prefs;
const HTML = "http://www.w3.org/1999/xhtml";
const DOSSIER = "chrome://browser/content/cigale/outils/";
const systeme = () => Services.scriptSecurityManager.getSystemPrincipal();
const plus = () => ChromeUtils.importESModule("chrome://browser/content/cigale/plus.sys.mjs");
const cigale = () => ChromeUtils.importESModule("chrome://browser/content/cigale/cigale.sys.mjs");

function html(doc, nom, attributs = {}, ...enfants) {
  const e = doc.createElementNS(HTML, nom);
  for (const [k, v] of Object.entries(attributs)) {
    if (k == "texte") e.textContent = v;
    else e.setAttribute(k, v);
  }
  e.append(...enfants);
  return e;
}

function raccourci(win, id, touche, modificateurs, action) {
  const doc = win.document;
  const commande = doc.createXULElement("command");
  commande.id = "cigale-cmd-" + id;
  commande.addEventListener("command", () => { try { action(); } catch (e) { console.error("La Cigale : " + id, e); } });
  doc.getElementById("mainCommandSet").append(commande);
  // la touche d'origine laisse la place (Ctrl+K cherchait sur le web : Ctrl+E le fait toujours)
  const memesModifs = (m) => (m || "").split(/[,\s]+/).filter(Boolean).sort().join(",");
  for (const k of doc.querySelectorAll("key")) {
    if ((k.getAttribute("key") || "").toLowerCase() == touche.toLowerCase()
        && memesModifs(k.getAttribute("modifiers")) == memesModifs(modificateurs)) k.remove();
  }
  const cle = doc.createXULElement("key");
  cle.id = "cigale-touche-" + id;
  if (touche.length == 1) cle.setAttribute("key", touche);
  else cle.setAttribute("keycode", touche);
  cle.setAttribute("modifiers", modificateurs);
  cle.setAttribute("command", commande.id);
  cle.setAttribute("reserved", "true");
  doc.getElementById("mainKeyset").append(cle);
}

// ---------- Bulle de confirmation ----------

export function bulle(win, texte, ancre) {
  const doc = win.document;
  let panneau = doc.getElementById("cigale-bulle");
  if (!panneau) {
    panneau = doc.createXULElement("panel");
    panneau.id = "cigale-bulle";
    panneau.setAttribute("noautofocus", "true");
    panneau.setAttribute("consumeoutsideclicks", "never");
    panneau.setAttribute("level", "top");
    panneau.append(html(doc, "div", { class: "cigale-bulle-texte" }));
    doc.getElementById("mainPopupSet").append(panneau);
  }
  panneau.querySelector(".cigale-bulle-texte").textContent = texte;
  const cible = ancre || doc.getElementById("urlbar-input-container") || doc.getElementById("urlbar");
  if (panneau.state != "closed") panneau.hidePopup();
  panneau.openPopup(cible, "after_start", 12, 4);
  lazy.clearTimeout(panneau.cigaleMinuteur);
  panneau.cigaleMinuteur = lazy.setTimeout(() => panneau.hidePopup(), 1600);
}

// ---------- 1. Copier l'adresse propre ----------

function copierAdresse(win) {
  const r = plus().copierLienPropre(win);
  if (!r) { bulle(win, "Rien à copier sur cette page"); return; }
  bulle(win, r.retire ? "Lien copié, sans pistage" : "Lien copié");
}

// ---------- 2. Palette de commandes ----------

const THEMES = {
  sombre: "firefox-compact-dark@mozilla.org",
  clair: "firefox-compact-light@mozilla.org",
  olive: "firefox-alpenglow@mozilla.org",
};
function theme(nom) {
  const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
  AddonManager.getAddonByID(THEMES[nom]).then((t) => t && t.enable()).catch(console.error);
}

function actions(win) {
  const g = win.gBrowser;
  return [
    ["Copier l'adresse sans pistage", "Ctrl+Maj+C", () => copierAdresse(win)],
    ["Petite fenêtre rapide", "Ctrl+Alt+N", () => fenetreRapide(win)],
    ["Notes", "", () => basculerNotes(win)],
    ["Ajouter la page aux notes", "", () => ajouterAuxNotes(win, "", g.selectedBrowser)],
    ["Fenêtre Tor", "", () => cigale().ouvrirFenetreTor(win).catch(console.error)],
    ["Oublier ce site", "", () => cigale().oublierSite(win).catch(console.error)],
    ["Nouvelle identité", "", () => plus().nouvelleIdentite(win).catch(console.error)],
    ["Panique : tout fermer et effacer", "Ctrl+Maj+F12", () => plus().panique(win).catch(console.error)],
    ["Mettre ce site au coffre (ou l'en sortir)", "", () => plus().basculerCoffre(win)],
    ["Thème sombre", "", () => theme("sombre")],
    ["Thème clair", "", () => theme("clair")],
    ["Thème olive", "", () => theme("olive")],
    ["Retouches : page en sombre", "", () => retoucher(win, { couleurs: "sombre" })],
    ["Retouches : page en sépia", "", () => retoucher(win, { couleurs: "sepia" })],
    ["Retouches : police lisible", "", () => retoucher(win, { police: "lisible" })],
    ["Retouches : tout remettre comme avant", "", () => retoucher(win, null)],
    ["Mode lecture", "F9", () => win.document.getElementById("reader-mode-button")?.click()],
    ["Assistant IA local", "", () => win.switchToTabHavingURI("about:assistant", true)],
    ["Assistant : résumer cette page", "", () => assistant(win, "resumer", g.selectedTab)],
    ["Assistant : analyser les liens de la page", "", () => assistant(win, "liens", g.selectedTab)],
    ["Protection et profils", "", () => win.switchToTabHavingURI("about:cigale", true)],
    ["Qui vous suivait", "", () => win.switchToTabHavingURI("about:cigale#bilan", true, { ignoreFragment: "whenComparingAndReplace" })],
    ["Paramètres", "", () => win.openPreferences()],
    ["Effacement à la fermeture", "", () => win.openPreferences("panePrivacy")],
    ["Nouvel onglet", "Ctrl+T", () => win.BrowserCommands.openTab()],
    ["Nouvelle fenêtre privée", "Ctrl+Maj+P", () => win.OpenBrowserWindow({ private: true })],
    ["Rouvrir l'onglet fermé", "Ctrl+Maj+T", () => win.SessionStore.undoCloseTab(win, 0)],
    ["Épingler ou désépingler l'onglet", "", () => g.selectedTab.pinned ? g.unpinTab(g.selectedTab) : g.pinTab(g.selectedTab)],
    ["Dupliquer l'onglet", "", () => g.selectedTab = g.duplicateTab(g.selectedTab)],
    ["Capture d'écran", "Ctrl+Maj+S", () => win.document.getElementById("Browser:Screenshot")?.doCommand()],
    ["Téléchargements", "Ctrl+Maj+Y", () => win.DownloadsPanel?.showDownloadsHistory?.() ?? win.BrowserCommands?.downloadsUI?.()],
    ["Historique", "Ctrl+H", () => win.SidebarController.toggle("viewHistorySidebar")],
    ["Favoris", "Ctrl+B", () => win.SidebarController.toggle("viewBookmarksSidebar")],
    ["Sudoku", "", () => win.openTrustedLinkIn("about:sudoku", "tab")],
  ].map(([titre, touche, faire]) => ({ type: "action", titre, detail: touche, faire }));
}

const normaliser = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function correspond(texte, mots) {
  const t = normaliser(texte);
  return mots.every((m) => t.includes(m));
}

async function chercherHistorique(requete, limite) {
  const db = await lazy.PlacesUtils.promiseDBConnection();
  const motif = "%" + requete.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const lignes = await db.executeCached(
    `SELECT h.url, h.title, (SELECT count(*) FROM moz_bookmarks b WHERE b.fk = h.id) AS favori
       FROM moz_places h
      WHERE (h.url LIKE :m ESCAPE '\\' OR h.title LIKE :m ESCAPE '\\')
        AND h.hidden = 0 AND (h.visit_count > 0 OR favori > 0)
        AND h.url NOT LIKE 'place:%'
      ORDER BY favori DESC, h.frecency DESC LIMIT :n`, { m: motif, n: limite });
  return lignes.map((l) => ({ url: l.getResultByName("url"), titre: l.getResultByName("title"), favori: l.getResultByName("favori") > 0 }));
}

function ouvrirPalette(win) {
  const doc = win.document;
  let panneau = doc.getElementById("cigale-palette");
  if (!panneau) panneau = construirePalette(win);
  if (panneau.state == "open") { panneau.hidePopup(); return; }
  panneau.toggleAttribute("olive", P.getStringPref("extensions.activeThemeID", "") == "firefox-alpenglow@mozilla.org");
  const champ = panneau.querySelector("input");
  champ.value = "";
  panneau.cigaleRemplir("");
  const largeur = Math.min(640, win.innerWidth - 48);
  panneau.querySelector(".cigale-palette-boite").style.width = largeur + "px";
  panneau.openPopup(doc.getElementById("browser") || doc.documentElement, "overlap",
    Math.round((win.innerWidth - largeur) / 2), 90);
  lazy.setTimeout(() => champ.focus(), 0);
}

function construirePalette(win) {
  const doc = win.document;
  const g = win.gBrowser;
  const panneau = doc.createXULElement("panel");
  panneau.id = "cigale-palette";
  panneau.setAttribute("level", "top");
  panneau.setAttribute("noautofocus", "true");
  const champ = html(doc, "input", { type: "text", placeholder: "Où va-t-on ?", spellcheck: "false", "aria-label": "Chercher un onglet, un site, un favori ou une action" });
  const symbole = html(doc, "img", { class: "cigale-palette-symbole", src: "chrome://browser/content/cigale/bouton-barre.svg", alt: "" });
  const ligne = html(doc, "div", { class: "cigale-palette-ligne" }, symbole, champ);
  const liste = html(doc, "ul", { class: "cigale-palette-liste", role: "listbox", hidden: "true" });
  panneau.append(html(doc, "div", { class: "cigale-palette-boite" }, ligne, liste));
  doc.getElementById("mainPopupSet").append(panneau);

  let resultats = [];
  let choisi = 0;
  let tour = 0;

  const afficher = () => {
    liste.hidden = !resultats.length;
    liste.replaceChildren(...resultats.map((r, i) => {
      const titre = html(doc, "span", { class: "cigale-palette-titre", texte: r.titre || r.url });
      const detail = html(doc, "span", { class: "cigale-palette-detail", texte: r.detail || "" });
      const type = html(doc, "span", { class: "cigale-palette-type", texte: { onglet: "Onglet", historique: "Historique", favori: "Favori", action: "Action", web: "Web" }[r.type] });
      const li = html(doc, "li", { role: "option", "aria-selected": i == choisi ? "true" : "false" }, titre, detail, type);
      li.addEventListener("mousemove", () => { if (choisi != i) { choisi = i; afficher(); } });
      li.addEventListener("click", () => lancer(i));
      return li;
    }));
    liste.children[choisi]?.scrollIntoView({ block: "nearest" });
  };

  panneau.cigaleRemplir = async (requete) => {
    const n = ++tour;
    const mots = normaliser(requete).split(/\s+/).filter(Boolean);
    const onglets = [];
    for (const w of Services.wm.getEnumerator("navigator:browser")) {
      if (lazy.PrivateBrowsingUtils.isWindowPrivate(w) != lazy.PrivateBrowsingUtils.isWindowPrivate(win)) continue;
      for (const t of w.gBrowser.tabs) {
        if (t == g.selectedTab) continue;
        const url = t.linkedBrowser.currentURI?.spec || "";
        if (!mots.length || correspond(t.label + " " + url, mots)) onglets.push({ type: "onglet", titre: t.label, detail: url.replace(/^https?:\/\/(www\.)?/, ""), onglet: t, fenetre: w });
      }
    }
    const lesActions = actions(win).filter((a) => !mots.length || correspond(a.titre, mots));
    let places = [];
    if (requete.trim().length >= 2) {
      try { places = await chercherHistorique(requete.trim(), 12); } catch (e) { console.error(e); }
    }
    if (n != tour) return;
    const dejaOuverts = new Set(onglets.map((o) => o.onglet.linkedBrowser.currentURI?.spec));
    const sites = places.filter((p) => !dejaOuverts.has(p.url))
      .map((p) => ({ type: p.favori ? "favori" : "historique", titre: p.titre || p.url, detail: p.url.replace(/^https?:\/\/(www\.)?/, ""), url: p.url }));
    // sans texte, seule la barre s'affiche
    resultats = mots.length ? [...lesActions.slice(0, 4), ...onglets.slice(0, 6), ...sites.slice(0, 8)] : [];
    if (mots.length) resultats.push({ type: "web", titre: `Chercher « ${requete.trim()} »`, detail: "sur le web", requete: requete.trim() });
    choisi = 0;
    afficher();
  };

  const lancer = (i) => {
    const r = resultats[i];
    if (!r) return;
    panneau.hidePopup();
    if (r.type == "onglet") {
      r.fenetre.gBrowser.selectedTab = r.onglet;
      r.fenetre.focus();
    } else if (r.type == "action") {
      lazy.setTimeout(() => r.faire(), 0);
    } else if (r.type == "web") {
      win.BrowserSearch?.loadSearchFromContext?.(r.requete, false, systeme(), null)
        ?? win.openTrustedLinkIn("https://duckduckgo.com/?q=" + encodeURIComponent(r.requete), "tab");
    } else {
      const vide = g.selectedBrowser.currentURI?.spec;
      win.openTrustedLinkIn(r.url, win.isBlankPageURL?.(vide) ? "current" : "tab");
    }
  };

  champ.addEventListener("input", () => panneau.cigaleRemplir(champ.value));
  champ.addEventListener("keydown", (e) => {
    if (e.key == "ArrowDown" || (e.key == "Tab" && !e.shiftKey)) { choisi = Math.min(resultats.length - 1, choisi + 1); afficher(); e.preventDefault(); }
    else if (e.key == "ArrowUp" || (e.key == "Tab" && e.shiftKey)) { choisi = Math.max(0, choisi - 1); afficher(); e.preventDefault(); }
    else if (e.key == "Enter") { lancer(choisi); e.preventDefault(); }
    else if (e.key == "Escape") { panneau.hidePopup(); e.preventDefault(); }
  });
  return panneau;
}

// ---------- 3. Mini-lecteur ----------
// Quand l'onglet qui joue un son ou une vidéo n'est plus devant vous, une petite commande reste dans la barre.

const ICONES = {
  lecture: "M5 3.5v9l7-4.5z",
  pause: "M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z",
  suivant: "M3.5 3.5v9l6-4.5zM10.5 3.5h2v9h-2z",
};
function icone(doc, nom) {
  const SVG = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  const chemin = doc.createElementNS(SVG, "path");
  chemin.setAttribute("d", ICONES[nom]);
  chemin.setAttribute("fill", "currentColor");
  svg.append(chemin);
  return html(doc, "span", { class: "cigale-lecteur-icone" }, svg);
}

function lecteur(win) {
  const doc = win.document;
  const g = win.gBrowser;
  const boite = html(doc, "div", { id: "cigale-lecteur", hidden: "true", role: "group", "aria-label": "Mini-lecteur" });
  const bouton = html(doc, "button", { class: "cigale-lecteur-bouton", title: "Lecture ou pause" });
  const suivant = html(doc, "button", { class: "cigale-lecteur-bouton", title: "Piste suivante" }, icone(doc, "suivant"));
  const titre = html(doc, "button", { class: "cigale-lecteur-titre", title: "Revenir à l'onglet" });
  boite.append(bouton, titre, suivant);
  const ancre = doc.getElementById("urlbar-container");
  if (!ancre) return;
  ancre.after(boite);

  let onglet = null;
  let garde = null;   // mis en pause depuis le mini-lecteur : il reste là pour reprendre
  const controleur = (t) => t?.linkedBrowser?.browsingContext?.mediaController;
  const trouver = () => {
    // l'onglet qui joue en ce moment, sinon celui qu'on suivait s'il a encore un média actif
    const joue = g.tabs.find((t) => t != g.selectedTab && t.hasAttribute("soundplaying"));
    if (joue) return joue;
    if (onglet && onglet != g.selectedTab && g.tabs.includes(onglet) && (controleur(onglet)?.isActive || onglet == garde)) return onglet;
    return null;
  };
  const maj = () => {
    if (!P.getBoolPref("cigale.lecteur.actif", true)) { boite.hidden = true; return; }
    onglet = trouver();
    boite.hidden = !onglet;
    if (!onglet) return;
    const c = controleur(onglet);
    const enCours = c ? c.isPlaying : onglet.hasAttribute("soundplaying");
    bouton.replaceChildren(icone(doc, enCours ? "pause" : "lecture"));
    bouton.title = enCours ? "Pause" : "Lecture";
    let nom = onglet.label;
    try { const m = c?.getMetadata?.(); if (m?.title) nom = m.artist ? `${m.title} · ${m.artist}` : m.title; } catch {}
    titre.textContent = nom;
    titre.title = "Revenir à l'onglet : " + onglet.label;
    suivant.hidden = !c?.supportedKeys?.includes?.("nexttrack");
  };
  bouton.addEventListener("click", () => {
    const c = controleur(onglet);
    if (!c) return;
    if (c.isPlaying) { c.pause(); garde = onglet; } else { c.play(); garde = null; }
    lazy.setTimeout(maj, 250);
  });
  suivant.addEventListener("click", () => { controleur(onglet)?.nextTrack(); lazy.setTimeout(maj, 600); });
  titre.addEventListener("click", () => { if (onglet) { garde = null; g.selectedTab = onglet; } });
  for (const ev of ["TabSelect", "TabClose", "TabAttrModified"]) g.tabContainer.addEventListener(ev, () => lazy.setTimeout(maj, 0));
  const minuteur = lazy.setInterval(() => { if (!boite.hidden || onglet) maj(); }, 2000);
  win.addEventListener("unload", () => lazy.clearInterval(minuteur), { once: true });
}

// ---------- 4. Petite fenêtre rapide ----------

export function fenetreRapide(win) {
  const largeur = 860, hauteur = 600;
  const x = Math.round(win.screenX + (win.outerWidth - largeur) / 2);
  const y = Math.round(win.screenY + (win.outerHeight - hauteur) / 3);
  const adresse = win.BROWSER_NEW_TAB_URL || "about:home";
  const args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  const chaine = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
  chaine.data = adresse;
  args.appendElement(chaine);
  const options = `chrome,dialog=no,all,width=${largeur},height=${hauteur},left=${x},top=${y}`;
  const rapide = Services.ww.openWindow(win, AppConstantsURL(), "_blank", options, args);
  rapide.cigaleRapide = true;
  rapide.addEventListener("load", () => {
    rapide.document.documentElement.setAttribute("cigale-rapide", "true");
    // l'anti-empreinte agrandit les nouvelles fenêtres : on remet la petite taille
    lazy.setTimeout(() => { try { rapide.resizeTo(largeur, hauteur); rapide.moveTo(x, y); } catch {} }, 50);
  }, { once: true });
  return rapide;
}
function AppConstantsURL() {
  return Services.prefs.getStringPref("browser.chromeURL", "chrome://browser/content/browser.xhtml");
}

function equiperFenetreRapide(win) {
  if (!win.cigaleRapide) return;
  const doc = win.document;
  doc.documentElement.setAttribute("cigale-rapide", "true");
  // bouton « Ouvrir dans la fenêtre principale »
  const bouton = doc.createXULElement("toolbarbutton");
  bouton.id = "cigale-rapide-agrandir";
  bouton.className = "toolbarbutton-1";
  bouton.setAttribute("label", "Ouvrir dans la fenêtre principale");
  bouton.setAttribute("tooltiptext", "Ouvrir dans la fenêtre principale");
  bouton.addEventListener("command", () => {
    const principale = [...Services.wm.getEnumerator("navigator:browser")].reverse()
      .find((w) => w != win && !w.cigaleRapide && !w.closed && w.toolbar.visible);
    if (!principale) { win.openTrustedLinkIn(win.gBrowser.currentURI.spec, "window"); win.close(); return; }
    const t = principale.gBrowser.adoptTab(win.gBrowser.selectedTab);
    if (t) principale.gBrowser.selectedTab = t;
    principale.focus();
    if (!win.closed) win.close();
  });
  const barre = doc.getElementById("nav-bar-customization-target") || doc.getElementById("nav-bar");
  barre?.append(bouton);
  // Échap sur une page vide ferme la petite fenêtre
  win.addEventListener("keydown", (e) => {
    if (e.key == "Escape" && !e.defaultPrevented && win.isBlankPageURL?.(win.gBrowser.currentURI?.spec) && doc.activeElement == doc.body) win.close();
  });
}

// ---------- 5. Notes ----------

function cheminNotes() {
  return PathUtils.join(PathUtils.profileDir, "cigale-notes.txt");
}
export async function lireNotes() {
  try { return await IOUtils.readUTF8(cheminNotes()); } catch { return ""; }
}
export async function ecrireNotes(texte) {
  await IOUtils.writeUTF8(cheminNotes(), texte, { tmpPath: cheminNotes() + ".tmp" });
  for (const w of Services.wm.getEnumerator("navigator:browser")) {
    try { w.document.getElementById("cigale-notes-cadre")?.contentWindow?.cigaleRecharger?.(texte); } catch {}
  }
}

async function ajouterAuxNotes(win, texte, browser) {
  const titre = browser?.contentTitle || "";
  const adresse = browser?.currentURI?.spec || "";
  const source = /^https?:/.test(adresse) ? `${titre ? titre + " — " : ""}${plus().nettoyerURL(adresse)}` : titre;
  const morceau = (texte ? texte.trim().split("\n").map((l) => "> " + l).join("\n") + "\n" : "") + (source ? "— " + source + "\n" : "");
  if (!morceau.trim()) return;
  const avant = await lireNotes();
  await ecrireNotes((avant && !avant.endsWith("\n\n") ? avant.replace(/\n?$/, "\n\n") : avant) + morceau);
  if (!win.document.getElementById("cigale-notes") || win.document.getElementById("cigale-notes").hidden) basculerNotes(win);
  bulle(win, "Ajouté aux notes");
}

export function basculerNotes(win) {
  const doc = win.document;
  let boite = doc.getElementById("cigale-notes");
  if (boite) {
    const cache = !boite.hidden;
    boite.hidden = cache;
    doc.getElementById("cigale-notes-separateur").hidden = cache;
    if (!cache) lazy.setTimeout(() => doc.getElementById("cigale-notes-cadre")?.contentWindow?.cigaleFocus?.(), 50);
    return;
  }
  const separateur = doc.createXULElement("splitter");
  separateur.id = "cigale-notes-separateur";
  separateur.setAttribute("resizebefore", "sibling");
  separateur.setAttribute("resizeafter", "sibling");
  boite = doc.createXULElement("vbox");
  boite.id = "cigale-notes";
  boite.style.cssText = "width: 340px; min-width: 240px; max-width: 50vw;";
  const cadre = html(doc, "iframe", { id: "cigale-notes-cadre", src: DOSSIER + "notes.html", flex: "1" });
  cadre.style.cssText = "border: 0; flex: 1; width: 100%;";
  boite.append(cadre);
  doc.getElementById("browser").append(separateur, boite);
}

function notesBarreLaterale(win) {
  const sc = win.SidebarController;
  if (!sc?.toolsAndExtensions || sc.toolsAndExtensions.has("cigale-notes")) return;
  sc.toolsAndExtensions.set("cigale-notes", {
    commandID: "cigale-notes", view: "cigale-notes", name: "cigale-notes",
    iconUrl: DOSSIER + "notes.svg", tooltiptext: "Notes", disabled: false,
  });
  for (const nom of ["toggle", "recordIconClick"]) {
    const orig = sc[nom].bind(sc);
    sc[nom] = (id, ...r) => id == "cigale-notes" ? (nom == "toggle" ? basculerNotes(win) : undefined) : orig(id, ...r);
  }
  // Seyra reste le dernier bouton de la barre latérale, quel que soit l'ordre d'installation
  const seyra = sc.toolsAndExtensions.get("cigale-seyra");
  if (seyra) {
    sc.toolsAndExtensions.delete("cigale-seyra");
    sc.toolsAndExtensions.set("cigale-seyra", seyra);
  }
  win.dispatchEvent(new win.CustomEvent("SidebarItemAdded"));
}

// ---------- 6. Retouches par site ----------
// { "exemple.fr": { couleurs: "sombre" | "sepia", police: "lisible" | "serif", masquer: ["sélecteur", …] } }

const PREF_RETOUCHES = "cigale.retouches";
export function retouches() {
  try { return JSON.parse(P.getStringPref(PREF_RETOUCHES, "{}")) || {}; } catch { return {}; }
}
function domaineDe(uri) {
  try { return Services.eTLD.getBaseDomain(uri); } catch { try { return uri.host; } catch { return ""; } }
}
export function retoucher(win, changement, browser = win.gBrowser.selectedBrowser) {
  const domaine = domaineDe(browser.currentURI);
  if (!domaine || !/^https?$/.test(browser.currentURI.scheme)) { bulle(win, "Les retouches marchent sur les sites web"); return; }
  const toutes = retouches();
  if (changement === null) delete toutes[domaine];
  else {
    const r = toutes[domaine] || {};
    for (const [k, v] of Object.entries(changement)) {
      if (k == "masquer") r.masquer = [...new Set([...(r.masquer || []), v])].slice(-50);
      else if (r[k] == v) delete r[k];   // la même retouche une deuxième fois l'enlève
      else r[k] = v;
    }
    if (Object.keys(r).length) toutes[domaine] = r; else delete toutes[domaine];
  }
  P.setStringPref(PREF_RETOUCHES, JSON.stringify(toutes));
  bulle(win, changement === null ? `Retouches retirées sur ${domaine}` : `Retouche gardée pour ${domaine}`);
}

// ---------- 7. Aperçu des liens ----------

export function apercu(win, adresse) {
  if (!/^https?:/.test(adresse || "")) return;
  const doc = win.document;
  let fond = doc.getElementById("cigale-apercu");
  if (!fond) {
    fond = html(doc, "div", { id: "cigale-apercu", hidden: "true" });
    const carte = html(doc, "div", { class: "cigale-apercu-carte" });
    const entete = html(doc, "div", { class: "cigale-apercu-entete" });
    const titre = html(doc, "span", { class: "cigale-apercu-titre" });
    const ouvrir = html(doc, "button", { class: "cigale-apercu-bouton", texte: "Ouvrir dans un onglet" });
    const fermer = html(doc, "button", { class: "cigale-apercu-bouton", texte: "Fermer", title: "Fermer (Échap)" });
    entete.append(titre, ouvrir, fermer);
    const navigateur = doc.createXULElement("browser");
    for (const [k, v] of Object.entries({
      type: "content", remote: "true", maychangeremoteness: "true", flex: "1", class: "cigale-apercu-page",
      messagemanagergroup: "browsers", autocompletepopup: "PopupAutoComplete",
    })) navigateur.setAttribute(k, v);
    carte.append(entete, navigateur);
    fond.append(carte);
    const zone = doc.getElementById("tabbrowser-tabbox") || doc.getElementById("browser");
    zone.append(fond);
    const masquer = () => {
      fond.hidden = true;
      try { navigateur.loadURI(Services.io.newURI("about:blank"), { triggeringPrincipal: systeme() }); } catch {}
      win.gBrowser.selectedBrowser.focus();
    };
    fond.cigaleFermer = masquer;
    fermer.addEventListener("click", masquer);
    fond.addEventListener("click", (e) => { if (e.target == fond) masquer(); });
    ouvrir.addEventListener("click", () => {
      const a = navigateur.currentURI?.spec || fond.cigaleAdresse;
      masquer();
      win.gBrowser.selectedTab = win.gBrowser.addTab(a, { triggeringPrincipal: systeme(), relatedToCurrent: true });
    });
    win.addEventListener("keydown", (e) => { if (e.key == "Escape" && !fond.hidden) { masquer(); e.preventDefault(); } }, true);
    navigateur.addEventListener("pagetitlechanged", () => { titre.textContent = navigateur.contentTitle || navigateur.currentURI?.spec; });
    fond.cigaleTitre = titre;
    fond.cigaleNavigateur = navigateur;
  }
  fond.cigaleAdresse = adresse;
  fond.cigaleTitre.textContent = adresse.replace(/^https?:\/\/(www\.)?/, "");
  fond.hidden = false;
  const navigateur = fond.cigaleNavigateur;
  // même conteneur et même mode privé que l'onglet d'origine
  const attributs = win.gBrowser.selectedBrowser.browsingContext?.originAttributes || {};
  navigateur.fixupAndLoadURIString(adresse, {
    triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal(attributs),
  });
  navigateur.focus();
}

// ---------- 8. Gestes de souris (côté navigateur) ----------

function geste(win, browser, sens) {
  const g = win.gBrowser;
  const tab = g.getTabForBrowser(browser);
  // dans l'aperçu d'un lien, seuls retour et avancer ont un sens
  if (!tab && sens != "gauche" && sens != "droite") return;
  const noms = { gauche: "Retour", droite: "Avancer", bas: "Fermer l'onglet", haut: "Nouvel onglet", "bas-droite": "Fermer l'onglet", "haut-gauche": "Rouvrir l'onglet fermé" };
  switch (sens) {
    case "gauche": if (browser.canGoBack) browser.goBack(); break;
    case "droite": if (browser.canGoForward) browser.goForward(); break;
    case "bas": g.removeTab(tab, { animate: true }); break;
    case "haut": win.BrowserCommands.openTab(); break;
    case "haut-gauche": win.SessionStore.undoCloseTab(win, 0); break;
    default: return;
  }
  if (!win.closed) bulle(win, noms[sens]);
}

// ---------- installation ----------

let installe = false;
export function installer() {
  if (installe) return;
  installe = true;
  ChromeUtils.registerWindowActor("CigaleOutils", {
    parent: { esModuleURI: DOSSIER + "outils.sys.mjs" },
    child: {
      esModuleURI: DOSSIER + "outils-enfant.sys.mjs",
      events: {
        DOMWindowCreated: {},
        DOMContentLoaded: {},
        pageshow: { mozSystemGroup: true },
        mousedown: { capture: true },
        contextmenu: { capture: true },
        click: { capture: true },
      },
    },
    matches: ["http://*/*", "https://*/*"],
    messageManagerGroups: ["browsers"],
  });
  // les pages ouvertes se mettent à jour quand une retouche change
  P.addObserver(PREF_RETOUCHES, () => {
    for (const w of Services.wm.getEnumerator("navigator:browser")) {
      const browsers = [...w.gBrowser.browsers];
      const ap = w.document.getElementById("cigale-apercu")?.cigaleNavigateur;
      if (ap) browsers.push(ap);
      for (const b of browsers) {
        try { b.browsingContext?.currentWindowGlobal?.getActor("CigaleOutils")?.sendAsyncMessage("Retouches"); } catch {}
      }
    }
  });
}

export function fenetre(win) {
  if (win.cigaleOutils || !win.gBrowser) return;
  win.cigaleOutils = true;
  const doc = win.document;
  try { win.windowUtils.loadSheetUsingURIString(DOSSIER + "outils.css", win.windowUtils.AUTHOR_SHEET); } catch (e) { console.error(e); }

  try {
    // Ctrl+Maj+C copiait l'inspecteur des outils de développement : il reste sur F12 et Ctrl+Maj+I
    for (const id of ["key_inspector", "key_inspectorMac"]) doc.getElementById(id)?.remove();
    raccourci(win, "copier-adresse", "C", "accel,shift", () => copierAdresse(win));
    raccourci(win, "palette", "K", "accel", () => ouvrirPalette(win));
    raccourci(win, "rapide", "N", "accel,alt", () => fenetreRapide(win));
    // un jeu de touches modifié n'est relu qu'une fois remis en place
    const jeu = doc.getElementById("mainKeyset");
    jeu.parentNode.insertBefore(jeu, jeu.nextSibling);
  } catch (e) { console.error("La Cigale : raccourcis", e); }

  try { lecteur(win); } catch (e) { console.error("La Cigale : mini-lecteur", e); }
  try { notesBarreLaterale(win); } catch (e) { console.error("La Cigale : notes", e); }
  try { equiperFenetreRapide(win); } catch (e) { console.error("La Cigale : petite fenêtre", e); }

  // menu contextuel : notes, aperçu, retouches
  const menu = doc.getElementById("contentAreaContextMenu");
  if (menu) {
    const sep = doc.createXULElement("menuseparator");
    const note = doc.createXULElement("menuitem");
    note.id = "cigale-ajouter-note";
    note.setAttribute("label", "Ajouter aux notes");
    note.addEventListener("command", () => {
      const texte = win.gContextMenu?.selectionInfo?.fullText || win.gContextMenu?.textSelected || "";
      ajouterAuxNotes(win, texte, win.gContextMenu?.browser || win.gBrowser.selectedBrowser).catch(console.error);
    });
    const voir = doc.createXULElement("menuitem");
    voir.id = "cigale-apercu-lien";
    voir.setAttribute("label", "Aperçu du lien (Alt+clic)");
    voir.addEventListener("command", () => apercu(win, win.gContextMenu?.linkURL));

    const sous = doc.createXULElement("menu");
    sous.id = "cigale-retouches";
    sous.setAttribute("label", "Retouches pour ce site");
    const popup = doc.createXULElement("menupopup");
    const entree = (label, faire, id) => {
      const m = doc.createXULElement("menuitem");
      m.setAttribute("label", label);
      if (id) m.id = id;
      m.addEventListener("command", faire);
      popup.append(m);
      return m;
    };
    const cible = () => win.gContextMenu?.browser || win.gBrowser.selectedBrowser;
    const masquerElement = entree("Masquer cet élément", () => {
      const b = cible();
      b.browsingContext?.currentWindowGlobal?.getActor("CigaleOutils")?.sendQuery("Selecteur").then((sel) => {
        if (sel) retoucher(win, { masquer: sel }, b);
        else bulle(win, "Impossible de reconnaître cet élément");
      }).catch(console.error);
    }, "cigale-retouche-masquer");
    popup.append(doc.createXULElement("menuseparator"));
    const coches = {
      "couleurs:sombre": entree("Page en sombre", () => retoucher(win, { couleurs: "sombre" }, cible())),
      "couleurs:sepia": entree("Page en sépia", () => retoucher(win, { couleurs: "sepia" }, cible())),
      "police:lisible": entree("Police lisible", () => retoucher(win, { police: "lisible" }, cible())),
      "police:serif": entree("Police à empattements", () => retoucher(win, { police: "serif" }, cible())),
    };
    for (const m of Object.values(coches)) m.setAttribute("type", "checkbox");
    popup.append(doc.createXULElement("menuseparator"));
    const remettre = entree("Tout remettre comme avant", () => retoucher(win, null, cible()));
    sous.append(popup);

    // Assistant IA local : visible seulement une fois installé (about:assistant)
    const ia = doc.createXULElement("menu");
    ia.id = "cigale-assistant";
    ia.setAttribute("label", "Assistant IA");
    const iaPopup = doc.createXULElement("menupopup");
    const iaEntree = (label, action, id) => {
      const m = doc.createXULElement("menuitem");
      m.setAttribute("label", label);
      m.id = id;
      m.addEventListener("command", () => {
        const b = win.gContextMenu?.browser || win.gBrowser.selectedBrowser;
        assistant(win, action, win.gBrowser.getTabForBrowser(b));
      });
      iaPopup.append(m);
      return m;
    };
    iaEntree("Résumer cette page", "resumer", "cigale-assistant-resumer");
    iaEntree("Analyser les liens", "liens", "cigale-assistant-liens");
    const iaSelection = iaEntree("Expliquer la sélection", "selection", "cigale-assistant-selection");
    ia.append(iaPopup);

    const ref = doc.getElementById("context-sep-viewsource") || doc.getElementById("context-viewsource");
    if (ref) ref.before(sep, note, voir, sous, ia); else menu.append(sep, note, voir, sous, ia);

    menu.addEventListener("popupshowing", (e) => {
      if (e.target != menu) return;
      const cm = win.gContextMenu;
      const web = /^https?$/.test(cm?.browser?.currentURI?.scheme || "");
      note.hidden = !cm?.isTextSelected;
      voir.hidden = !(cm?.onLink && /^https?:/.test(cm?.linkURL || ""));
      sous.hidden = !web || cm?.onLink || cm?.isTextSelected || cm?.onTextInput;
      ia.hidden = !web || !P.getStringPref("cigale.assistant.modele", "") || cm?.onTextInput;
      iaSelection.hidden = !cm?.isTextSelected;
      sep.hidden = note.hidden && voir.hidden && sous.hidden && ia.hidden;
      if (!sous.hidden) {
        const r = retouches()[domaineDe(cm.browser.currentURI)] || {};
        for (const [cle, m] of Object.entries(coches)) {
          const [k, v] = cle.split(":");
          m.setAttribute("checked", r[k] == v ? "true" : "false");
        }
        remettre.disabled = !Object.keys(r).length;
        masquerElement.label = r.masquer?.length ? `Masquer cet élément (${r.masquer.length} déjà masqué${r.masquer.length > 1 ? "s" : ""})` : "Masquer cet élément";
      }
    });
  }
}

// Ouvre about:assistant et lui confie l'onglet à lire
function assistant(win, action, onglet) {
  const A = ChromeUtils.importESModule("chrome://browser/content/cigale/assistant/assistant.sys.mjs");
  if (onglet && /^https?:/.test(onglet.linkedBrowser?.currentURI?.spec || "")) A.deposerDemande({ action, onglet });
  const ouvert = [...win.gBrowser.tabs].find((t) => t.linkedBrowser.currentURI.spec == "about:assistant");
  if (ouvert) {
    // la page est déjà ouverte : elle prend la demande sans perdre la conversation
    win.gBrowser.selectedTab = ouvert;
    Services.obs.notifyObservers(null, "cigale-assistant-demande");
  } else {
    win.openTrustedLinkIn("about:assistant", "tab");
  }
}

// ---------- acteur côté navigateur ----------

export class CigaleOutilsParent extends JSWindowActorParent {
  receiveMessage(message) {
    const browser = this.browsingContext.top.embedderElement;
    const win = this.browsingContext.topChromeWindow || browser?.ownerDocument?.defaultView;
    if (!win?.gBrowser) return null;
    if (message.name == "Geste") {
      if (P.getBoolPref("cigale.gestes.actif", true)) geste(win, browser, message.data?.sens);
    } else if (message.name == "Apercu") {
      if (P.getBoolPref("cigale.apercu.actif", true)) apercu(win, message.data?.adresse);
    } else if (message.name == "Retouches") {
      return retouches()[domaineDe(this.manager.documentURI)] || null;
    }
    return null;
  }
}
