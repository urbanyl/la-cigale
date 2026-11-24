// Côté page du bilan : l'accueil (fichier local) envoie « cigale-demande-bilan »,
// on lui répond avec l'évènement « cigale-bilan » (des nombres seulement).

export class CigaleBilanChild extends JSWindowActorChild {
  handleEvent(evenement) {
    if (evenement.type != "cigale-demande-bilan") return;
    const doc = this.document;
    if (!doc || doc.location.protocol != "file:" || !/\/cigale\/accueil\/index\.html$/.test(doc.location.pathname)) return;
    this.sendQuery("Bilan").then((bilan) => {
      if (!bilan || !this.contentWindow) return;
      const detail = Cu.cloneInto(bilan, this.contentWindow);
      this.contentWindow.dispatchEvent(new this.contentWindow.CustomEvent("cigale-bilan", { detail }));
    }).catch(() => {});
  }
}
