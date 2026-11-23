// Côté page (processus de contenu) des fonctions de La Cigale 1.4 :
// bouclier de formulaires et lecture des empreintes SHA-256 publiées sur la page.

function base(hote) {
  try {
    return Services.eTLD.getBaseDomainFromHost(hote);
  } catch {
    return hote;
  }
}

export class CigalePlusChild extends JSWindowActorChild {
  handleEvent(evenement) {
    if (evenement.type != "submit") return;
    if (!Services.prefs.getBoolPref("cigale.formulaires.bouclier", true)) return;
    const formulaire = evenement.target;
    if (!formulaire || formulaire.localName != "form" || formulaire.cigaleAccepte) return;

    const sensibles = [...formulaire.elements].filter(
      (c) => c.value && (c.type == "password" || c.type == "email" || /mail|login|user|identifiant/i.test(c.name || ""))
    );
    if (!sensibles.length) return;

    let cible;
    try {
      cible = new URL(formulaire.action || this.document.location.href, this.document.location.href);
    } catch {
      return;
    }
    const page = this.document.location;
    const raisons = [];
    if (cible.protocol == "http:") raisons.push("non chiffre");
    if (/^https?:$/.test(cible.protocol) && base(cible.hostname) != base(page.hostname)) raisons.push("autre site");
    if (!raisons.length) return;

    evenement.preventDefault();
    evenement.stopImmediatePropagation();
    const motDePasse = sensibles.some((c) => c.type == "password");
    this.sendQuery("Formulaire", { raisons, cible: cible.hostname, page: page.hostname, motDePasse })
      .then((ok) => {
        if (!ok) return;
        formulaire.cigaleAccepte = true;
        formulaire.submit();
      })
      .catch(() => {});
  }

  receiveMessage(message) {
    if (message.name == "Empreintes") {
      const texte = (this.document.body?.innerText || "").slice(0, 2_000_000);
      return [...new Set((texte.match(/\b[a-f0-9]{64}\b/gi) || []).map((h) => h.toLowerCase()))].slice(0, 500);
    }
    return null;
  }
}
