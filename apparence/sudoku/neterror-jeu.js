"use strict";

// Page d'erreur réseau : « Jouer au sudoku » quand il n'y a pas de connexion.
(() => {
  const SANS_RESEAU = ["netOffline", "dnsNotFound", "connectionFailure", "netTimeout", "netReset",
    "netInterrupt", "proxyConnectFailure", "unknownProxyHost"];
  // location.search est vide sous about: : on lit l'adresse complète
  const parametres = new URLSearchParams((document.documentURI.split("?")[1] || "").split("#")[0]);
  if (!SANS_RESEAU.includes(parametres.get("e"))) return;
  const TEXTE = "Jouer au sudoku en attendant";

  // la page d'erreur ne peut pas ouvrir about:sudoku elle-même : le navigateur s'en charge (jeu.sys.mjs)
  const jouer = () => document.dispatchEvent(new CustomEvent("cigale-sudoku", { bubbles: true }));

  // La page d'erreur actuelle (net-error-card) se dessine après coup, dans son shadow DOM :
  // le bouton se place à côté de « Réessayer », et revient si la carte se redessine.
  const placer = () => {
    const carte = document.querySelector("net-error-card")?.shadowRoot;
    const reessayer = carte?.getElementById("tryAgainButton");
    if (reessayer) {
      if (carte.getElementById("cigaleSudoku")) return;
      const b = document.createElement("moz-button");
      b.id = "cigaleSudoku";
      b.setAttribute("label", TEXTE);
      b.addEventListener("click", jouer);
      reessayer.after(b);
      return;
    }
    // ancienne page d'erreur
    const conteneur = document.getElementById("netErrorButtonContainer");
    if (conteneur && !document.getElementById("cigaleSudoku")) {
      const b = document.createElement("button");
      b.id = "cigaleSudoku";
      b.textContent = TEXTE;
      b.addEventListener("click", jouer);
      conteneur.append(b);
    }
  };
  setInterval(placer, 400);
  document.addEventListener("DOMContentLoaded", placer);
})();
