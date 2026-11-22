// Retour : page précédente s'il y en a une, sinon la page d'accueil.
// about:apropos ne peut pas ouvrir le fichier d'accueil lui-même : il note la demande dans
// son adresse (#ouvrir=accueil) et La Cigale charge l'accueil dans cet onglet.
document.getElementById("retour").addEventListener("click", (e) => {
  e.preventDefault();
  const adresse = location.href;
  if (history.length > 1) history.back();
  setTimeout(() => {
    if (location.href == adresse) history.replaceState(null, "", "#ouvrir=accueil");
  }, 400);
});
