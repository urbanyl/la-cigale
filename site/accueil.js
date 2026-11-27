// La Cigale : animations de la page d'accueil. Sans JavaScript, ou si le système demande
// moins de mouvement, la page reste complète et immobile.
(() => {
  const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const racine = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const borne = (v) => Math.min(1, Math.max(0, v));
  const ouverture = $(".ouverture");
  const fenetre = $(".fenetre");
  const themes = $(".themes");

  // Bouton principal : le bon fichier pour le système du visiteur
  const ua = navigator.userAgent;
  const systeme = /Mac OS X|Macintosh/.test(ua) && !/iPhone|iPad/.test(ua) ? "mac"
    : /Linux/.test(ua) && !/Android/.test(ua) ? "linux" : null;
  if (systeme) {
    for (const b of $$("[data-mac][data-linux]")) {
      b.href = b.dataset[systeme];
      const nom = b.querySelector(".pour");
      if (nom) nom.textContent = b.dataset[systeme + "Nom"];
    }
  }

  // Thèmes : boutons (toujours actifs, même sans animation)
  const pile = $(".pile");
  const boutons = $$(".choix button");
  const montrer = (i) => {
    $$("img", pile).forEach((img, j) => img.classList.toggle("actif", j == i));
    boutons.forEach((b, j) => { b.classList.toggle("actif", j == i); b.setAttribute("aria-pressed", j == i); });
  };
  boutons.forEach((b, i) => b.addEventListener("click", () => {
    if (calme || !themes || !racine.classList.contains("js")) return montrer(i);
    const r = themes.getBoundingClientRect();
    const course = themes.offsetHeight - innerHeight;
    scrollTo({ top: scrollY + r.top + course * ((i + 0.5) / boutons.length), behavior: "smooth" });
  }));

  if (calme || !("IntersectionObserver" in window)) return;
  racine.classList.add("js");

  // Titre lettre par lettre
  const titre = $(".titre");
  if (titre) {
    const texte = titre.textContent;
    titre.setAttribute("aria-label", texte);
    titre.textContent = "";
    [...texte].forEach((c, i) => {
      const s = document.createElement("span");
      s.className = "lettre";
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--i", i);
      s.textContent = c == " " ? " " : c;
      titre.append(s);
    });
    // une fois les lettres posées, on rend le texte d'un bloc pour que le reflet le traverse
    setTimeout(() => { titre.textContent = texte; titre.classList.add("pose"); }, 400 + texte.length * 45 + 1100);
  }

  // Apparitions
  const vue = new IntersectionObserver((entrees) => {
    for (const e of entrees) if (e.isIntersecting) { e.target.classList.add("vu"); vue.unobserve(e.target); }
  }, { rootMargin: "0px 0px -10% 0px" });
  $$(".monte").forEach((el) => vue.observe(el));

  // Déclaration : les mots s'allument au fil du défilement
  const declaration = $(".declaration");
  const mots = [];
  if (declaration) {
    const decouper = (noeud, olive) => {
      for (const enfant of [...noeud.childNodes]) {
        if (enfant.nodeType == 3) {
          const frag = document.createDocumentFragment();
          for (const morceau of enfant.textContent.split(/(\s+)/)) {
            if (!morceau) continue;
            if (/^\s+$/.test(morceau)) { frag.append(morceau); continue; }
            const s = document.createElement("span");
            s.className = "mot" + (olive ? " olive" : "");
            s.textContent = morceau;
            mots.push(s);
            frag.append(s);
          }
          enfant.replaceWith(frag);
        } else if (enfant.nodeType == 1) {
          decouper(enfant, olive || enfant.tagName == "STRONG");
        }
      }
    };
    decouper(declaration, false);
    $$("strong", declaration).forEach((s) => { s.style.fontWeight = "inherit"; });
  }

  // Chiffres qui comptent
  const compter = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (!e.isIntersecting) continue;
      compter.unobserve(e.target);
      const fin = Number(e.target.dataset.compte);
      const debut = performance.now();
      const duree = 1400;
      const pas = (t) => {
        const k = borne((t - debut) / duree);
        e.target.textContent = Math.round(fin * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    }
  }, { threshold: 0.6 });
  $$("[data-compte]").forEach((el) => { el.textContent = "0"; compter.observe(el); });

  // Panneau Protection : les interrupteurs s'allument un par un
  const panneau = $(".panneau");
  if (panneau) {
    const lignes = $$(".ligne", panneau);
    lignes.forEach((l) => l.classList.remove("on"));
    new IntersectionObserver((entrees, obs) => {
      if (!entrees[0].isIntersecting) return;
      obs.disconnect();
      lignes.forEach((l, i) => setTimeout(() => l.classList.add("on"), 350 + i * 260));
    }, { threshold: 0.5 }).observe(panneau);
  }

  // Lueur qui suit la souris sur les tuiles
  for (const t of $$(".tuile")) {
    t.addEventListener("pointermove", (e) => {
      const r = t.getBoundingClientRect();
      t.style.setProperty("--mx", e.clientX - r.left + "px");
      t.style.setProperty("--my", e.clientY - r.top + "px");
    });
  }

  // Défilement : fenêtre qui se redresse, thèmes, déclaration
  let attente = false;
  let dernierTheme = -1;
  const image = () => {
    attente = false;
    const h = innerHeight;
    if (ouverture) racine.style.setProperty("--p-ouv", borne(scrollY / (h * 0.9)).toFixed(3));
    if (fenetre) {
      const r = fenetre.getBoundingClientRect();
      racine.style.setProperty("--p-fen", borne((h - r.top) / (h * 0.75)).toFixed(3));
    }
    if (mots.length) {
      const r = declaration.getBoundingClientRect();
      const k = borne((h * 0.82 - r.top) / (r.height + h * 0.25));
      const n = Math.round(k * mots.length);
      mots.forEach((m, i) => m.classList.toggle("allume", i < n));
    }
    if (themes && boutons.length) {
      const r = themes.getBoundingClientRect();
      const k = borne(-r.top / (themes.offsetHeight - h));
      const i = Math.min(boutons.length - 1, Math.floor(k * boutons.length));
      if (i != dernierTheme) { dernierTheme = i; montrer(i); }
    }
  };
  const demander = () => { if (!attente) { attente = true; requestAnimationFrame(image); } };
  addEventListener("scroll", demander, { passive: true });
  addEventListener("resize", demander);
  image();
})();
