"use strict";

// Home page greetings: a new one each time the browser or a tab opens.
// Some depend on the time of day, the others work at any hour.
const SALUTATIONS = {
  matin: [
    "Good morning", "Sleep well?", "Morning", "Coffee first?", "Rise and shine", "A fine day begins",
    "Ready to start the day?", "The sun is up", "Have a good morning", "Easy wake-up?", "Ready for today?",
    "A new day, a blank page", "Early start today", "Good start to the day", "Hello, early bird",
    "First coffee, first tab", "The day is yours", "Shall we begin?", "Fresh and ready?", "Morning, morning",
  ],
  apresmidi: [
    "Good afternoon", "Had lunch?", "The nap can wait", "Shall we carry on?", "One more push", "Making progress?",
    "Well-deserved break?", "The afternoon is yours", "Afternoon slump?", "Picking up where we left off",
    "Nice weather outside?", "The cicada sings in the sun", "Keep going, the day flies by", "Tea, perhaps?",
    "Almost the end of the day", "Hello again", "Still here?", "Keeping the pace", "Past noon already", "A little longer",
  ],
  soir: [
    "Good evening", "Have a nice evening", "End of the day", "Time to relax?", "The day is done", "Quiet evening?",
    "Movie tonight?", "The cicada sings at dusk", "The sun is setting", "Evening, evening",
    "Time to breathe", "Home safe?", "The calm of the evening", "Anything nice tonight?", "Easy does it tonight",
    "The moon is rising", "One last look around?", "Have a lovely evening", "Well-earned rest", "Slippers and browsing?",
  ],
  nuit: [
    "Good night", "Still up?", "The stars are out", "Night owl", "Sleepless night?", "It's getting late",
    "The cicadas are asleep", "Hush, everyone's asleep", "Can't sleep?", "Night browsing", "Creature of the night",
    "Sleep on it", "One last tab before bed?", "Past midnight", "Quiet, at night",
  ],
  toujours: [
    "How are you?", "Shall we?", "Hi again", "Hi", "Hello", "Hey there", "Good to see you again", "What's new?",
    "Where to today?", "What are we looking for?", "Ready to browse", "Let's go", "Here we go", "On our way",
    "Where to start?", "Something on your mind?", "Welcome", "Welcome back", "Nice to see you", "All good?",
    "The web awaits", "Discreetly yours", "Seen by no one", "In all discretion", "Nothing leaves this place",
    "Your data stays here", "Calm, no trackers", "No trackers, as always", "Incognito, almost",
    "The cicada keeps watch", "Nobody follows you here", "Browse light", "Your move", "A search?",
    "Feeling curious today?", "Shall we explore?", "Into the unknown", "Let curiosity lead", "Happy browsing",
    "Want to learn something?", "A question in mind?", "What shall we discover?", "The web, in peace", "Away from prying eyes",
    "What brings you here?", "What are we working on?", "I'm listening", "An idea to dig into?", "Tell me everything",
    "Just a quick look, promise?", "New tab, new ideas", "This way for curiosity", "Pick up again?", "So, that project?",
  ],
};

// Lines tied to the exact hour, the day of the week and the date.
// When there are some, they come first half of the time.
function salutationsPrecises(h, { minute = -1, jour = -1, quantieme = 0, mois = 0 } = {}) {
  const semaine = jour >= 1 && jour <= 5;
  const weekend = jour == 0 || jour == 6;
  const p = [];
  const ajouter = (condition, ...phrases) => { if (condition) p.push(...phrases); };

  ajouter(h >= 1 && h < 4, "Sleep, does that ring a bell?", `${h} in the morning, really`,
    "The web never sleeps, and apparently neither do you", "Even the servers are yawning", "Nothing good happens after 2 a.m., they say");
  ajouter(h == 4, "Up early, are we?", "Even the baker is still asleep", "4 a.m., seriously?", "Up before the birds");
  ajouter(h == 5, "Early riser, or not in bed yet?", "The alarm hasn't even rung, has it?", "Up early, are we?",
    "The cicadas aren't awake yet");
  ajouter(h == 6, "First coffee brewing?", "The sun is barely trying", "Early start, hats off", "House still asleep?");
  ajouter(h == 7 && semaine, "Off to work, boss", "Checking the weather before heading out?", "The train can wait two minutes",
    "Keys, phone, wallet?");
  ajouter(h == 8 && semaine, "Off to work, boss", "The day starts for real", "Email can wait five minutes", "Shall we get to it?");
  ajouter(h >= 9 && h < 11, "First coffee already a memory?", "Right in the groove", "Brain warmed up, full speed ahead");
  ajouter(h == 11, "Lunch break is in sight", "Thinking about food already?", "One more hour until lunch",
    "Stomach starting to talk?");
  ajouter(h == 12 || h == 13, "Enjoy your meal", "Lunch at the desk?", "Lunch break, the real one", "Need a recipe for lunch?");
  ajouter(h == 14, "The famous 2 p.m. slump", "Digestion, the eternal struggle", "Heavy eyelids?", "Coffee to keep going?");
  ajouter(h == 15 || h == 16, "Snack time?", "Four o'clock, the sacred snack hour", "The home stretch", "A little more focus");
  ajouter((h == 17 || h == 18) && semaine, "Almost done for the day", "Heading home soon?", "The day is winding down",
    "Office emptying out?");
  ajouter(h == 19 || h == 20, "What's for dinner tonight?", "Dinner soon?", "A recipe for tonight?", "Drinks, maybe?");
  ajouter(h == 21 || h == 22, "One episode, just one", "The couch is calling", "Series night?", "Time to unwind?");
  ajouter(h == 23, "Tomorrow exists too, you know", "One last tab, promise?", "Bedtime might be a good idea");
  ajouter(h == 0, "Past midnight, no judgement", "Tomorrow has already begun", "One last tab, promise?");

  ajouter(minute == 0 && h == 12, "Noon on the dot");
  ajouter(minute == 0 && h == 0, "Midnight on the dot");
  ajouter(minute == 0 && h != 0 && h != 12, `${h} o'clock on the dot`);

  ajouter(jour == 1 && h >= 5 && h < 12, "Monday morning, chin up", "Easy does it on Mondays", "Weekend went too fast?");
  ajouter(jour == 3 && h >= 9 && h < 18, "Wednesday, halfway there");
  ajouter(jour == 4 && h >= 9 && h < 18, "Thursday, Friday is getting closer");
  ajouter(jour == 5 && h >= 12 && h < 19, "Friday, the weekend is in sight", "Just a few hours until the weekend",
    "Friday afternoon, easing off?");
  ajouter(jour == 5 && h >= 19, "Friday night at last", "The weekend starts now");
  ajouter(weekend && h >= 5 && h < 12, "No alarm today?", "Nice lie-in?", "The weekend, at last", "Brunch in sight?");
  ajouter(jour == 6 && h >= 12 && h < 19, "Saturday, anything goes", "A quiet Saturday?");
  ajouter(jour == 0 && h >= 18, "Sunday evening, Monday is coming", "Enjoying the last hours of the weekend");

  ajouter(quantieme == 1 && mois == 1, "Happy New Year", "New year, new tabs");
  ajouter(quantieme == 31 && mois == 12, "Last day of the year", "Ending the year in style?");
  ajouter(quantieme == 24 && mois == 12, "Christmas Eve, presents ready?");
  ajouter(quantieme == 25 && mois == 12, "Merry Christmas");
  ajouter(quantieme == 1 && mois == 4, "Watch out for pranks today");
  ajouter(quantieme == 13 && jour == 5, "Friday the 13th, careful now");
  ajouter(quantieme == 21 && mois == 6, "Summer solstice, cicada season");
  ajouter(quantieme == 1 && h >= 5 && h < 12, "New month, fresh start");
  return p;
}

function salutationDuMoment(heure, details) {
  const moment = heure >= 5 && heure < 12 ? "matin" : heure >= 12 && heure < 18 ? "apresmidi"
    : heure >= 18 && heure < 23 ? "soir" : "nuit";
  const precises = salutationsPrecises(heure, details);
  const liste = precises.length && Math.random() < 0.5 ? precises : SALUTATIONS[moment].concat(SALUTATIONS.toujours);
  let derniere = "";
  try { derniere = sessionStorage.getItem("cigale.salut") || localStorage.getItem("cigale.salut") || ""; } catch { /* ignored */ }
  let choix;
  do { choix = liste[Math.floor(Math.random() * liste.length)]; } while (choix === derniere && liste.length > 1);
  try { localStorage.setItem("cigale.salut", choix); } catch { /* ignored */ }
  return choix;
}
