"use strict";

// Salutations de l'accueil : une nouvelle à chaque ouverture du navigateur ou d'un onglet.
// Certaines dépendent du moment de la journée, les autres vont à toute heure.
const SALUTATIONS = {
  matin: [
    "Bonjour", "Bien dormi ?", "Bon matin", "Café d'abord ?", "Debout, la cigale", "Belle journée qui commence",
    "On attaque la journée ?", "Le soleil est levé", "Bonne matinée", "Réveil en douceur ?", "Prêt pour aujourd'hui ?",
    "Un nouveau jour, une page blanche", "Matinal, aujourd'hui", "Bon début de journée", "Salut, lève-tôt",
    "Premier café, premier onglet", "La journée vous appartient", "On démarre ?", "Frais et dispo ?", "Bonjour, bonjour",
  ],
  apresmidi: [
    "Bon après-midi", "Bien mangé ?", "La sieste attendra", "On continue ?", "Encore un effort", "Ça avance ?",
    "Pause bien méritée ?", "L'après-midi est à vous", "Petit coup de mou ?", "On reprend où on en était",
    "Il fait beau dehors ?", "La cigale chante en plein soleil", "Courage, la journée file", "Un thé, peut-être ?",
    "Bonne fin de journée bientôt", "Rebonjour", "Toujours là ?", "On garde le rythme", "Midi passé déjà", "Encore un peu",
  ],
  soir: [
    "Bonsoir", "Bonne soirée", "Fin de journée", "On se détend ?", "La journée est faite", "Soirée tranquille ?",
    "Un film ce soir ?", "La cigale chante au crépuscule", "Le soleil se couche", "Bonsoir, bonsoir",
    "Il est temps de souffler", "Bien rentré ?", "Le calme du soir", "Quoi de beau ce soir ?", "Doucement le soir",
    "La lune se lève", "Un dernier tour ?", "Belle soirée à vous", "Repos bien mérité", "Pantoufles et navigation ?",
  ],
  nuit: [
    "Bonne nuit", "Encore debout ?", "Les étoiles sont sorties", "Couche-tard", "Nuit blanche ?", "Il se fait tard",
    "Les cigales dorment", "Chut, tout le monde dort", "Insomnie ?", "Navigation nocturne", "Oiseau de nuit",
    "La nuit porte conseil", "Dernier onglet avant de dormir ?", "Minuit passé", "Au calme, de nuit",
  ],
  toujours: [
    "Comment ça va ?", "On y va ?", "Re-bonjour", "Salut", "Hello", "Coucou", "Content de vous revoir", "Quoi de neuf ?",
    "Où va-t-on aujourd'hui ?", "Que cherche-t-on ?", "Prêt à naviguer", "Allons-y", "C'est parti", "En route",
    "Par où commencer ?", "Une idée en tête ?", "Bienvenue", "Bon retour", "Ravi de vous voir", "Tout roule ?",
    "La toile vous attend", "Discrètement vôtre", "Ni vu ni connu", "En toute discrétion", "Rien ne sort d'ici",
    "Vos données restent ici", "Tranquille, sans traqueurs", "Sans pisteurs, comme toujours", "Incognito, ou presque",
    "La cigale veille", "Ici, on ne vous suit pas", "Naviguez léger", "À vous de jouer", "Une recherche ?",
    "Curieux aujourd'hui ?", "On explore ?", "Cap sur l'inconnu", "Que la curiosité vous guide", "Bonne navigation",
    "Envie d'apprendre un truc ?", "Une question en tête ?", "On découvre quoi ?", "Le web, en paix", "À l'abri des regards",
  ],
};

function salutationDuMoment(heure) {
  const moment = heure >= 5 && heure < 12 ? "matin" : heure >= 12 && heure < 18 ? "apresmidi"
    : heure >= 18 && heure < 23 ? "soir" : "nuit";
  const liste = SALUTATIONS[moment].concat(SALUTATIONS.toujours);
  // jamais deux fois la même d'affilée
  let derniere = "";
  try { derniere = sessionStorage.getItem("cigale.salut") || localStorage.getItem("cigale.salut") || ""; } catch { /* ignoré */ }
  let choix;
  do { choix = liste[Math.floor(Math.random() * liste.length)]; } while (choix === derniere && liste.length > 1);
  try { localStorage.setItem("cigale.salut", choix); } catch { /* ignoré */ }
  return choix;
}
