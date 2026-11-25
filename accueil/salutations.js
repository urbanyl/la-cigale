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
    "Qu'est-ce qui vous amène ?", "Sur quoi on travaille ?", "Je vous écoute", "Une idée à creuser ?", "Dites-moi tout",
    "Juste un coup d'œil, promis ?", "Onglet neuf, idées neuves", "Par ici la curiosité", "On reprend ?", "Alors, ce projet ?",
  ],
};

// Phrases calées sur l'heure exacte, le jour de la semaine et la date.
// Elles passent devant les autres une fois sur deux quand il y en a.
function salutationsPrecises(h, { minute = -1, jour = -1, quantieme = 0, mois = 0 } = {}) {
  const semaine = jour >= 1 && jour <= 5;
  const weekend = jour == 0 || jour == 6;
  const p = [];
  const ajouter = (condition, ...phrases) => { if (condition) p.push(...phrases); };

  // heure par heure
  ajouter(h >= 1 && h < 4, "Le sommeil, ça vous dit quelque chose ?", `${h} heure${h > 1 ? "s" : ""} du matin, quand même`,
    "Le web ne dort jamais, et vous non plus apparemment", "Même les serveurs bâillent", "Rien de bon n'arrive après 2 heures, dit-on");
  ajouter(h == 4, "Bah alors, on se lève tôt ?", "Même le boulanger dort encore", "4 heures du matin, sérieusement ?",
    "Debout avant les oiseaux");
  ajouter(h == 5, "Lève-tôt, ou pas encore couché ?", "Le réveil n'a même pas sonné, si ?", "Bah alors, on se lève tôt ?",
    "Les cigales ne sont pas encore réveillées");
  ajouter(h == 6, "Premier café en cours ?", "Le soleil fait à peine semblant", "Matinal, chapeau", "La maison dort encore ?");
  ajouter(h == 7 && semaine, "Au boulot, chef", "On regarde la météo avant de partir ?", "Le métro attendra deux minutes",
    "Clés, téléphone, portefeuille ?");
  ajouter(h == 8 && semaine, "Au boulot, chef", "La journée commence pour de vrai", "Les mails peuvent attendre cinq minutes",
    "On s'y met ?");
  ajouter(h >= 9 && h < 11, "Le premier café est déjà loin ?", "Pile dans le rythme", "Le cerveau est chaud, on fonce");
  ajouter(h == 11, "Ça sent bientôt la pause déj", "On pense déjà à manger ?", "Plus qu'une heure avant le déjeuner",
    "L'estomac commence à parler ?");
  ajouter(h == 12 || h == 13, "Bon appétit", "On mange devant l'écran ?", "Pause déj, la vraie", "Une idée de recette pour ce midi ?");
  ajouter(h == 14, "Le fameux coup de barre de 14 heures", "La digestion, ce combat", "Les paupières sont lourdes ?",
    "Un café pour tenir ?");
  ajouter(h == 15 || h == 16, "Un petit goûter ?", "Quatre heures, l'heure sacrée du goûter", "La dernière ligne droite",
    "Encore un peu de concentration");
  ajouter((h == 17 || h == 18) && semaine, "Bientôt la quille", "On rentre bientôt ?", "La journée tire à sa fin",
    "Le bureau se vide ?");
  ajouter(h == 19 || h == 20, "Qu'est-ce qu'on mange ce soir ?", "À table bientôt ?", "Une recette pour ce soir ?",
    "Apéro, peut-être ?");
  ajouter(h == 21 || h == 22, "Un épisode, juste un", "Le canapé vous appelle", "Soirée série ?", "On se pose ?");
  ajouter(h == 23, "Demain existe aussi, vous savez", "Encore un dernier onglet, promis ?", "Il serait temps d'y penser, au lit");
  ajouter(h == 0, "Minuit passé, on ne juge pas", "Le jour d'après a déjà commencé", "Encore un dernier onglet, promis ?");

  // la minute
  ajouter(minute == 0 && h == 12, "Midi pile");
  ajouter(minute == 0 && h == 0, "Minuit pile");
  ajouter(minute == 0 && h != 0 && h != 12, `${h} heure${h > 1 ? "s" : ""} pile`);

  // le jour de la semaine
  ajouter(jour == 1 && h >= 5 && h < 12, "Lundi matin, courage", "Le lundi, on y va doucement", "Le week-end a passé trop vite ?");
  ajouter(jour == 3 && h >= 9 && h < 18, "Mercredi, la moitié est faite");
  ajouter(jour == 4 && h >= 9 && h < 18, "Jeudi, le vendredi se rapproche");
  ajouter(jour == 5 && h >= 12 && h < 19, "Vendredi, le week-end est en vue", "Plus que quelques heures avant le week-end",
    "Vendredi après-midi, on lève le pied ?");
  ajouter(jour == 5 && h >= 19, "Enfin vendredi soir", "Le week-end commence maintenant");
  ajouter(weekend && h >= 5 && h < 12, "Pas de réveil aujourd'hui ?", "Grasse matinée réussie ?", "Le week-end, enfin",
    "Brunch en vue ?");
  ajouter(jour == 6 && h >= 12 && h < 19, "Samedi, tout est permis", "Un samedi tranquille ?");
  ajouter(jour == 0 && h >= 18, "Dimanche soir, lundi approche", "On profite des dernières heures du week-end");

  // quelques dates
  ajouter(quantieme == 1 && mois == 1, "Bonne année", "Nouvelle année, nouveaux onglets");
  ajouter(quantieme == 31 && mois == 12, "Dernier jour de l'année", "On finit l'année en beauté ?");
  ajouter(quantieme == 24 && mois == 12, "Veille de Noël, les cadeaux sont prêts ?");
  ajouter(quantieme == 25 && mois == 12, "Joyeux Noël");
  ajouter(quantieme == 1 && mois == 4, "Méfiez-vous des poissons aujourd'hui");
  ajouter(quantieme == 13 && jour == 5, "Vendredi 13, prudence");
  ajouter(quantieme == 21 && mois == 6, "Fête de la musique, et des cigales");
  ajouter(quantieme == 14 && mois == 7, "Bon 14 Juillet");
  ajouter(quantieme == 1 && h >= 5 && h < 12, "Nouveau mois, nouveau départ");
  return p;
}

function salutationDuMoment(heure, details) {
  const moment = heure >= 5 && heure < 12 ? "matin" : heure >= 12 && heure < 18 ? "apresmidi"
    : heure >= 18 && heure < 23 ? "soir" : "nuit";
  const precises = salutationsPrecises(heure, details);
  const liste = precises.length && Math.random() < 0.5 ? precises : SALUTATIONS[moment].concat(SALUTATIONS.toujours);
  // jamais deux fois la même d'affilée
  let derniere = "";
  try { derniere = sessionStorage.getItem("cigale.salut") || localStorage.getItem("cigale.salut") || ""; } catch { /* ignoré */ }
  let choix;
  do { choix = liste[Math.floor(Math.random() * liste.length)]; } while (choix === derniere && liste.length > 1);
  try { localStorage.setItem("cigale.salut", choix); } catch { /* ignoré */ }
  return choix;
}
