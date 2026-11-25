// Côté page des petits outils de La Cigale : gestes de souris, Alt+clic pour l'aperçu d'un lien,
// retouches par site (couleurs, police, éléments masqués).

const SEUIL = 40;          // pixels avant qu'un clic droit devienne un geste
const POLICES = {
  lisible: 'Inter, "Segoe UI Variable", "Segoe UI", Cantarell, system-ui, sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
};

function feuille(r) {
  if (!r) return "";
  let css = "";
  if (r.couleurs == "sombre") {
    css += `html { filter: invert(0.92) hue-rotate(180deg) !important; background: #fff !important; }
      img, video, picture, canvas, iframe, embed, object, svg image, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }\n`;
  } else if (r.couleurs == "sepia") {
    css += `html { filter: sepia(0.45) brightness(0.97) !important; }\n`;
  }
  if (POLICES[r.police]) {
    css += `:where(body, p, li, dd, dt, td, th, blockquote, figcaption, label, h1, h2, h3, h4, h5, h6, article, section, main, a, em, strong, input, textarea, button, select)
      { font-family: ${POLICES[r.police]} !important; }\n`;
  }
  for (const sel of r.masquer || []) {
    if (typeof sel == "string" && sel.length < 600 && !/[{}]/.test(sel)) css += `${sel} { display: none !important; }\n`;
  }
  return css;
}

// un sélecteur assez précis pour retrouver l'élément à la prochaine visite
function selecteur(el) {
  const echapper = (s) => CSS.escape(s);
  const morceaux = [];
  let e = el;
  while (e && e.nodeType == 1 && e.localName != "html" && e.localName != "body" && morceaux.length < 6) {
    if (e.id && !/\d{3,}/.test(e.id)) { morceaux.unshift("#" + echapper(e.id)); break; }
    let m = e.localName;
    const classes = [...e.classList].filter((c) => !/\d{3,}|^(active|hover|focus|open|is-|js-)/.test(c)).slice(0, 2);
    if (classes.length) m += classes.map((c) => "." + echapper(c)).join("");
    const freres = e.parentElement ? [...e.parentElement.children].filter((f) => f.localName == e.localName) : [];
    if (freres.length > 1 && !classes.length) m += `:nth-of-type(${freres.indexOf(e) + 1})`;
    morceaux.unshift(m);
    e = e.parentElement;
  }
  const sel = morceaux.join(" > ");
  try { return el.ownerDocument.querySelector(sel) == el ? sel : sel; } catch { return ""; }
}

export class CigaleOutilsChild extends JSWindowActorChild {
  constructor() {
    super();
    this.geste = null;
    this.feuilleChargee = null;
    this.cibleMenu = null;
  }

  receiveMessage(message) {
    if (message.name == "Retouches") this.appliquer(true);
    else if (message.name == "Contenu") {
      // lu seulement à la demande de l'assistant local (about:assistant), jamais envoyé ailleurs
      const doc = this.document;
      const racine = doc.querySelector("article, main, [role=main]") || doc.body;
      const nettoyer = (t) => (t || "").replace(/[ \t ]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
      let texte = nettoyer(racine?.innerText);
      if (texte.length < 400 && racine != doc.body) texte = nettoyer(doc.body?.innerText);
      const liens = [];
      for (const a of doc.querySelectorAll("a[href]")) {
        if (!/^https?:/.test(a.href)) continue;
        liens.push({ adresse: a.href, texte: nettoyer(a.innerText || a.title || a.getAttribute("aria-label")).slice(0, 100) });
        if (liens.length >= 600) break;
      }
      return {
        titre: doc.title,
        adresse: doc.URL,
        langue: doc.documentElement.lang || "",
        texte: texte.slice(0, 60000),
        liens,
        selection: (this.contentWindow.getSelection()?.toString() || "").trim().slice(0, 12000),
      };
    } else if (message.name == "Selecteur") {
      const el = this.cibleMenu;
      if (!el || !el.isConnected) return "";
      // on remonte au bloc visible qui contient l'élément cliqué (une image seule, un lien, un bandeau…)
      let bloc = el.nodeType == 1 ? el : el.parentElement;
      while (bloc && bloc.parentElement && bloc.parentElement.localName != "body") {
        const r = bloc.getBoundingClientRect();
        if (r.width * r.height > 2500) break;
        bloc = bloc.parentElement;
      }
      return bloc ? selecteur(bloc) : "";
    }
    return null;
  }

  async appliquer(force = false) {
    const win = this.contentWindow;
    if (!win || win.top != win) return;
    if (!force && this.feuilleChargee !== null) return;
    let r = null;
    try { r = await this.sendQuery("Retouches"); } catch { return; }
    const css = feuille(r);
    const utils = win.windowUtils;
    if (this.feuilleChargee) {
      try { utils.removeSheetUsingURIString(this.feuilleChargee, utils.AUTHOR_SHEET); } catch {}
      this.feuilleChargee = "";
    }
    if (css) {
      this.feuilleChargee = "data:text/css;charset=utf-8," + encodeURIComponent(css);
      try { utils.loadSheetUsingURIString(this.feuilleChargee, utils.AUTHOR_SHEET); } catch (e) { console.error(e); }
    } else {
      this.feuilleChargee = "";
    }
  }

  handleEvent(e) {
    switch (e.type) {
      case "DOMWindowCreated":
      case "DOMContentLoaded":
      case "pageshow":
        this.appliquer();
        return;
      case "mousedown":
        if (e.button == 2 && Services.prefs.getBoolPref("cigale.gestes.actif", true)) this.debutGeste(e);
        return;
      case "contextmenu":
        this.cibleMenu = e.composedTarget || e.target;
        if (Date.now() - (this.gesteFait || 0) < 800) {
          // un geste vient d'avoir lieu : pas de menu
          e.preventDefault();
          e.stopImmediatePropagation();
          this.gesteFait = 0;
        }
        return;
      case "click":
        if (e.button == 0 && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey
            && Services.prefs.getBoolPref("cigale.apercu.actif", true)) {
          const lien = (e.composedTarget || e.target)?.closest?.("a[href]");
          if (lien && /^https?:/.test(lien.href)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.sendAsyncMessage("Apercu", { adresse: lien.href });
          }
        }
        return;
    }
  }

  debutGeste(e) {
    const win = this.contentWindow;
    this.finGeste();
    const g = { x: e.screenX, y: e.screenY, sens: "", trace: [] };
    const bouger = (m) => {
      const dx = m.screenX - g.x, dy = m.screenY - g.y;
      if (Math.hypot(dx, dy) < SEUIL) return;
      const sens = Math.abs(dx) > Math.abs(dy) * 1.6 ? (dx < 0 ? "gauche" : "droite")
        : Math.abs(dy) > Math.abs(dx) * 1.6 ? (dy < 0 ? "haut" : "bas")
        : (dy < 0 && dx < 0 ? "haut-gauche" : "");
      g.sens = sens;
    };
    const relacher = (m) => {
      if (m.button != 2) return;
      if (g.sens) {
        this.gesteFait = Date.now();
        this.sendAsyncMessage("Geste", { sens: g.sens });
      }
      this.finGeste();
    };
    win.addEventListener("mousemove", bouger, true);
    win.addEventListener("mouseup", relacher, true);
    g.retirer = () => {
      try { win.removeEventListener("mousemove", bouger, true); win.removeEventListener("mouseup", relacher, true); } catch {}
    };
    this.geste = g;
  }

  finGeste() {
    this.geste?.retirer?.();
    this.geste = null;
  }

  didDestroy() {
    this.finGeste();
  }
}
