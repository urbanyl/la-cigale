// Sudoku hors ligne.
// 1. Page d'erreur réseau : elle n'a pas le droit d'ouvrir une page about: elle-même ; elle envoie
//    « cigale-sudoku » et l'acteur ouvre about:sudoku dans le même onglet.
// 2. about:sudoku : une page about: ordinaire n'a pas de stockage local ; la partie en cours et les
//    records passent par l'acteur et sont gardés dans les réglages (cigale.sudoku.*).

const CLES = { partie: "cigale.sudoku.partie", records: "cigale.sudoku.records" };
const TAILLE_MAX = 20000;

function surSudoku(adresse) { return adresse.startsWith("about:sudoku"); }

export class CigaleJeuChild extends JSWindowActorChild {
  handleEvent(evenement) {
    const adresse = this.document?.documentURI || "";
    if (evenement.type == "cigale-sudoku") {
      if (!adresse.startsWith("about:neterror?")) return;
      const u = new URLSearchParams(adresse.split("?")[1].split("#")[0]).get("u") || "";
      this.sendAsyncMessage("Jouer", { u });
      return;
    }
    if (!surSudoku(adresse)) return;
    if (evenement.type == "cigale-sudoku-sauver") {
      const texte = typeof evenement.detail == "string" ? evenement.detail : "";
      if (texte.length < TAILLE_MAX) this.sendAsyncMessage("Sauver", { texte });
    } else if (evenement.type == "cigale-sudoku-charger") {
      this.sendQuery("Charger").then((texte) => {
        const w = this.contentWindow;
        if (w) w.dispatchEvent(new w.CustomEvent("cigale-sudoku-donnees", { detail: String(texte || "{}") }));
      }).catch(() => {});
    }
  }
}

export class CigaleJeuParent extends JSWindowActorParent {
  receiveMessage(message) {
    // currentURI est l'adresse qui n'a pas chargé ; le document affiché, lui, est about:neterror
    const document = this.manager.documentURI?.spec || "";
    if (message.name == "Jouer") {
      const navigateur = this.browsingContext.top.embedderElement;
      if (!navigateur || !document.startsWith("about:neterror")) return null;
      let cible = "about:sudoku";
      try {
        const page = new URL(String(message.data?.u || ""));
        if (page.protocol == "http:" || page.protocol == "https:") cible += "#u=" + encodeURIComponent(page.href);
      } catch {}
      navigateur.loadURI(Services.io.newURI(cible), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
      return null;
    }
    if (!surSudoku(document)) return null;
    if (message.name == "Charger") {
      const donnees = {};
      for (const [cle, pref] of Object.entries(CLES)) {
        try { donnees[cle] = JSON.parse(Services.prefs.getStringPref(pref, "null")); } catch {}
      }
      return JSON.stringify(donnees);
    }
    if (message.name == "Sauver") {
      try {
        const { cle, valeur } = JSON.parse(String(message.data?.texte || ""));
        if (CLES[cle]) Services.prefs.setStringPref(CLES[cle], JSON.stringify(valeur));
      } catch {}
    }
    return null;
  }
}

let installe = false;
export function installer() {
  if (installe) return;
  installe = true;
  ChromeUtils.registerWindowActor("CigaleJeu", {
    parent: { esModuleURI: "chrome://browser/content/cigale/sudoku/jeu.sys.mjs" },
    child: {
      esModuleURI: "chrome://browser/content/cigale/sudoku/jeu.sys.mjs",
      events: {
        "cigale-sudoku": { wantUntrusted: true },
        "cigale-sudoku-sauver": { wantUntrusted: true },
        "cigale-sudoku-charger": { wantUntrusted: true },
      },
    },
    messageManagerGroups: ["browsers"],
  });
}
