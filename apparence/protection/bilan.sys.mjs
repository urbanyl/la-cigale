// La Cigale 1.5 : bilan de protection.
// Compte, page par page, ce que La Cigale a bloqué (traqueurs, empreintes, cookies tiers,
// requêtes uBlock, liens nettoyés) et quelles entreprises étaient derrière.
// Seuls des nombres sont gardés, jamais l'adresse des sites que vous visitez.
// Fichier : <profil>/cigale-bilan.json, 90 jours au plus.

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
});

const WPL = Ci.nsIWebProgressListener;
const f = (n) => WPL[n] || 0;
const PISTAGE = f("STATE_BLOCKED_TRACKING_CONTENT") | f("STATE_BLOCKED_SOCIALTRACKING_CONTENT") |
  f("STATE_BLOCKED_FINGERPRINTING_CONTENT") | f("STATE_BLOCKED_CRYPTOMINING_CONTENT") |
  f("STATE_COOKIES_BLOCKED_TRACKER") | f("STATE_COOKIES_BLOCKED_SOCIALTRACKER");
export const EMPREINTE = f("STATE_BLOCKED_FINGERPRINTING_CONTENT") | f("STATE_REPLACED_FINGERPRINTING_CONTENT") |
  f("STATE_ALLOWED_CANVAS_FINGERPRINTING") | f("STATE_ALLOWED_FONT_FINGERPRINTING");
const COOKIES = f("STATE_COOKIES_BLOCKED_FOREIGN") | f("STATE_COOKIES_BLOCKED_TRACKER") |
  f("STATE_COOKIES_BLOCKED_SOCIALTRACKER") | f("STATE_COOKIES_PARTITIONED_FOREIGN");

// Domaines de pistage connus et l'entreprise qui les exploite
const ENTREPRISES = {
  Google: ["google-analytics.com", "googletagmanager.com", "googletagservices.com", "doubleclick.net",
    "googlesyndication.com", "googleadservices.com", "google.com", "gstatic.com", "googleapis.com", "youtube.com",
    "ytimg.com", "2mdn.net", "app-measurement.com", "googlevideo.com", "youtube-nocookie.com", "admob.com"],
  Meta: ["facebook.net", "facebook.com", "fbcdn.net", "instagram.com", "whatsapp.net", "fb.com"],
  Amazon: ["amazon-adsystem.com", "amazon.com", "assoc-amazon.com", "media-amazon.com", "amazontrust.com"],
  Microsoft: ["bing.com", "clarity.ms", "msn.com", "linkedin.com", "licdn.com", "microsoft.com", "live.com", "bat.bing.com"],
  "X (Twitter)": ["twitter.com", "twimg.com", "ads-twitter.com", "t.co", "x.com"],
  TikTok: ["tiktok.com", "tiktokcdn.com", "byteoversea.com", "ttwstatic.com", "analytics.tiktok.com"],
  Criteo: ["criteo.com", "criteo.net"],
  Adobe: ["omtrdc.net", "demdex.net", "everesttech.net", "adobedtm.com", "2o7.net", "typekit.net"],
  Oracle: ["bluekai.com", "addthis.com", "moatads.com", "grapeshot.co.uk"],
  Yandex: ["yandex.ru", "yandex.net", "mc.yandex.ru", "yastatic.net"],
  Taboola: ["taboola.com", "taboolasyndication.com"],
  Outbrain: ["outbrain.com", "outbrainimg.com"],
  "The Trade Desk": ["adsrvr.org"],
  Xandr: ["adnxs.com", "adnxs-simple.com"],
  Hotjar: ["hotjar.com", "hotjar.io"],
  Pinterest: ["pinterest.com", "pinimg.com"],
  Snap: ["snapchat.com", "sc-static.net"],
  Quantcast: ["quantserve.com", "quantcount.com", "quantcast.com"],
  Comscore: ["scorecardresearch.com", "comscore.com"],
  "AT Internet": ["xiti.com", "ati-host.net", "aticdn.net"],
  Smart: ["smartadserver.com", "sascdn.com"],
  PubMatic: ["pubmatic.com"],
  Magnite: ["rubiconproject.com", "magnite.com"],
  OpenX: ["openx.net"],
  "Index Exchange": ["casalemedia.com", "indexww.com"],
  Teads: ["teads.tv", "teads.com"],
  Sharethrough: ["sharethrough.com"],
  LiveRamp: ["rlcdn.com", "pippio.com"],
  Lotame: ["crwdcntrl.net"],
  Mediarithmics: ["mediarithmics.com"],
  Didomi: ["didomi.io", "privacy-center.org"],
  Segment: ["segment.com", "segment.io"],
  Mixpanel: ["mixpanel.com"],
  Amplitude: ["amplitude.com"],
  Hubspot: ["hubspot.com", "hs-analytics.net", "hs-scripts.com", "hsforms.net", "hscollectedforms.net"],
  Salesforce: ["krxd.net", "exacttarget.com", "pardot.com", "evergage.com"],
  "New Relic": ["nr-data.net", "newrelic.com"],
  Cloudflare: ["cloudflareinsights.com"],
  Optimizely: ["optimizely.com"],
  Yahoo: ["yahoo.com", "yimg.com", "advertising.com", "adtechus.com"],
  Reddit: ["reddit.com", "redditstatic.com", "redditmedia.com"],
  Disqus: ["disqus.com", "disquscdn.com"],
};
const PAR_DOMAINE = new Map();
for (const [nom, domaines] of Object.entries(ENTREPRISES)) for (const d of domaines) PAR_DOMAINE.set(d, nom);

function baseDe(hote) {
  try { return Services.eTLD.getBaseDomainFromHost(hote); } catch { return hote; }
}

export function entrepriseDe(origine) {
  let hote = "";
  try { hote = new URL(origine).hostname; } catch { return ""; }
  if (!hote) return "";
  const b = baseDe(hote);
  return PAR_DOMAINE.get(hote) || PAR_DOMAINE.get(b) || b;
}

// ---------- fichier ----------

let donnees = null;
let chargement = null;
let minuteurEcriture = null;
const chemin = () => PathUtils.join(PathUtils.profileDir, "cigale-bilan.json");

function charger() {
  if (donnees) return Promise.resolve(donnees);
  chargement ??= IOUtils.readJSON(chemin()).catch(() => null).then((d) => {
    donnees = d && typeof d == "object" && d.jours ? d : { debut: Date.now(), jours: {} };
    return donnees;
  });
  return chargement;
}

function enregistrerBientot() {
  if (minuteurEcriture) return;
  minuteurEcriture = lazy.setTimeout(enregistrerMaintenant, 4000);
}

function enregistrerMaintenant() {
  if (minuteurEcriture) lazy.clearTimeout(minuteurEcriture);
  minuteurEcriture = null;
  if (!donnees) return Promise.resolve();
  // on ne garde que 90 jours
  const limite = cleJour(new Date(Date.now() - 90 * 86400000));
  for (const j of Object.keys(donnees.jours)) if (j < limite) delete donnees.jours[j];
  return IOUtils.writeJSON(chemin(), donnees, { tmpPath: chemin() + ".tmp" }).catch(console.error);
}

function cleJour(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function jour() {
  const j = cleJour();
  return (donnees.jours[j] ??= { pages: 0, traqueurs: 0, empreintes: 0, cookies: 0, ublock: 0, liens: 0, entreprises: {} });
}

// ---------- comptage ----------

// Résumé d'un journal de blocage (getContentBlockingLog) : ce que la page a tenté
export function analyserJournal(journal) {
  const traqueurs = new Set(), empreintes = new Set(), cookies = new Set();
  for (const [origine, evenements] of Object.entries(journal || {})) {
    for (const [etat, bloque] of evenements) {
      if ((etat & PISTAGE) && bloque) traqueurs.add(origine);
      if (etat & EMPREINTE) empreintes.add(origine);
      if (etat & COOKIES) cookies.add(origine);
    }
  }
  const entreprises = new Set([...traqueurs, ...empreintes].map(entrepriseDe).filter(Boolean));
  return { traqueurs: traqueurs.size, empreintes: empreintes.size, cookies: cookies.size, entreprises: [...entreprises] };
}

function ajouterPage(page) {
  if (!donnees || !page) return;
  const a = page.analyse || { traqueurs: 0, empreintes: 0, cookies: 0, entreprises: [] };
  const j = jour();
  j.pages++;
  j.traqueurs += a.traqueurs;
  j.empreintes += a.empreintes;
  j.cookies += a.cookies;
  j.ublock += page.ublock || 0;
  for (const e of a.entreprises) j.entreprises[e] = (j.entreprises[e] || 0) + 1;
  enregistrerBientot();
}

export async function lienNettoye() {
  await charger();
  jour().liens++;
  enregistrerBientot();
}

// Bilan des n derniers jours (7 par défaut), plus le total depuis le début
export async function resume(n = 7) {
  await charger();
  const total = { pages: 0, traqueurs: 0, empreintes: 0, cookies: 0, ublock: 0, liens: 0 };
  const parJour = [];
  const entreprises = {};
  for (let i = n - 1; i >= 0; i--) {
    const cle = cleJour(new Date(Date.now() - i * 86400000));
    const j = donnees.jours[cle];
    parJour.push({ jour: cle, bloques: j ? j.traqueurs + j.ublock + j.empreintes : 0 });
    if (!j) continue;
    for (const k of Object.keys(total)) total[k] += j[k] || 0;
    for (const [e, c] of Object.entries(j.entreprises || {})) entreprises[e] = (entreprises[e] || 0) + c;
  }
  let depuisToujours = 0;
  for (const j of Object.values(donnees.jours)) depuisToujours += j.traqueurs + j.ublock + j.empreintes;
  return {
    ...total,
    bloques: total.traqueurs + total.ublock + total.empreintes,
    depuisToujours,
    debut: donnees.debut,
    parJour,
    entreprises: Object.entries(entreprises).sort((a, b) => b[1] - a[1]),
  };
}

export async function effacer() {
  donnees = { debut: Date.now(), jours: {} };
  chargement = Promise.resolve(donnees);
  await enregistrerMaintenant();
}

// ---------- suivi des onglets ----------

async function badgeUblock(onglet) {
  try {
    const { ExtensionParent } = ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");
    const extension = WebExtensionPolicy.getByID("uBlock0@raymondhill.net")?.extension;
    return Number(ExtensionParent.apiManager.global.browserActionFor?.(extension)?.action?.getContextData(onglet)?.badgeText) || 0;
  } catch {
    return 0;
  }
}

// page en cours par navigateur : { analyse, ublock, minuteur }
const pages = new WeakMap();

function photographier(win, browser, delai = 1500) {
  const page = pages.get(browser);
  if (!page || page.minuteur) return;
  page.minuteur = lazy.setTimeout(async () => {
    page.minuteur = null;
    try {
      page.analyse = analyserJournal(JSON.parse(await browser.getContentBlockingLog()));
    } catch { /* page fermée */ }
    const onglet = win.gBrowser?.getTabForBrowser(browser);
    if (onglet) page.ublock = Math.max(page.ublock || 0, await badgeUblock(onglet));
  }, delai);
}

function terminer(browser) {
  const page = pages.get(browser);
  if (!page) return;
  pages.delete(browser);
  if (page.minuteur) lazy.clearTimeout(page.minuteur);
  ajouterPage(page);
}

const suivies = new WeakSet();

export function suivre(win) {
  if (suivies.has(win) || !win.gBrowser) return;
  suivies.add(win);
  charger();
  const g = win.gBrowser;
  g.addTabsProgressListener({
    onLocationChange(browser, webProgress, request, uri, drapeaux) {
      if (!webProgress?.isTopLevel || (drapeaux & WPL.LOCATION_CHANGE_SAME_DOCUMENT)) return;
      terminer(browser);
      if (/^https?$/.test(uri?.scheme)) {
        pages.set(browser, { analyse: null, ublock: 0, minuteur: null });
        photographier(win, browser, 2500);
      }
    },
    onContentBlockingEvent(browser) {
      photographier(win, browser);
    },
    onStateChange(browser, webProgress, request, drapeaux) {
      if (webProgress?.isTopLevel && (drapeaux & WPL.STATE_STOP) && (drapeaux & WPL.STATE_IS_NETWORK)) {
        photographier(win, browser, 2000);
      }
    },
  });
  g.tabContainer.addEventListener("TabClose", (e) => terminer(e.target.linkedBrowser));
  win.addEventListener("unload", () => {
    for (const t of g.tabs) terminer(t.linkedBrowser);
  }, { once: true });
}

let installe = false;
export function installer() {
  if (installe) return;
  installe = true;
  Services.obs.addObserver(() => {
    for (const w of Services.wm.getEnumerator("navigator:browser")) {
      for (const t of w.gBrowser?.tabs || []) terminer(t.linkedBrowser);
    }
    enregistrerMaintenant();
  }, "quit-application-granted");

  // L'accueil (fichier local) demande son bilan par un évènement ; l'acteur le lui renvoie.
  try {
    ChromeUtils.registerWindowActor("CigaleBilan", {
      parent: { esModuleURI: "chrome://browser/content/cigale/bilan.sys.mjs" },
      child: {
        esModuleURI: "chrome://browser/content/cigale/bilan-enfant.sys.mjs",
        events: { "cigale-demande-bilan": { wantUntrusted: true } },
      },
      matches: ["file:///*"],
      messageManagerGroups: ["browsers"],
    });
  } catch (e) {
    console.error("La Cigale : acteur du bilan", e);
  }
}

// Adresse exacte de la page d'accueil : seule elle reçoit le bilan
export function adresseAccueil() {
  const page = Services.dirsvc.get("GreD", Ci.nsIFile);
  page.append("cigale");
  page.append("accueil");
  page.append("index.html");
  return Services.io.newFileURI(page).spec;
}

export class CigaleBilanParent extends JSWindowActorParent {
  async receiveMessage(message) {
    if (message.name != "Bilan") return null;
    const adresse = this.browsingContext.currentURI?.spec?.split("#")[0];
    if (adresse != adresseAccueil()) return null;
    const r = await resume(7);
    // l'accueil n'a pas besoin de plus que les cinq premières entreprises
    return { ...r, entreprises: r.entreprises.slice(0, 5) };
  }
}
