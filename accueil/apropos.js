// about:apropos ne connaît pas l'adresse de la page d'accueil : on revient simplement en arrière
document.getElementById("retour").addEventListener("click", (e) => {
  e.preventDefault();
  history.back();
});
