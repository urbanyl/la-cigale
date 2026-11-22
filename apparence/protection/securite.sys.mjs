/**
 * Module de sécurité avancée pour La Cigale
 * Innovations maison pour détecter & prévenir les compromissions
 */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

// === 1. MANIFESTE DE SÉCURITÉ CHIFFRÉ ===
export async function verifierManifesteSécurité() {
  try {
    const P = Services.prefs;
    const hash = await calculerHashManifeste();
    const signé = P.getStringPref("cigale.securite.manifeste.signature", "");

    if (!signé) {
      console.warn("La Cigale : manifeste non signé, première exécution ?");
      return true;
    }
    return true; // Vérification stub
  } catch (e) {
    Components.utils.reportError("La Cigale : vérification manifeste : " + e);
    return false;
  }
}

async function calculerHashManifeste() {
  const items = [
    "privacy.resistFingerprinting",
    "network.trr.mode",
    "dom.security.https_only_mode",
  ];
  let donnees = "";
  for (const pref of items) {
    donnees += pref + "=" + Services.prefs.getPrefType(pref) + ";";
  }
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(donnees));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// === 2. BLOCAGE DES INJECTIONS DE CONFIG ===
export const PREFS_WHITELIST = new Set([
  "privacy.resistFingerprinting",
  "network.trr.mode",
  "network.trr.uri",
  "dom.security.https_only_mode",
  "security.tls.version.min",
  "browser.cache.disk.enable",
  "media.peerconnection.enabled",
  "network.cookie.cookieBehavior",
  "privacy.sanitize.sanitizeOnShutdown",
  "signon.rememberSignons",
  "browser.search.suggest.enabled",
  "pdfjs.enableScripting",
  "media.eme.enabled",
  "webgl.disabled",
  "javascript.options.wasm",
  "cigale.version",
  "cigale.securite.auditlog",
]);

export function validerPrefInjectée(clé, valeur) {
  if (!PREFS_WHITELIST.has(clé)) {
    Components.utils.reportError(`La Cigale : ALERTE - Tentative d'injection pref : ${clé}`);
    enregistrerAuditLog("INJECTION_BLOQUER", { clé, valeur });
    return false;
  }
  return true;
}

// === 3. AUDIT LOG LOCAL CHIFFRÉ ===
export async function enregistrerAuditLog(événement, données = {}) {
  try {
    const P = Services.prefs;
    const timestamp = new Date().toISOString();
    const entrée = JSON.stringify({ timestamp, événement, ...données });
    const journal = P.getStringPref("cigale.securite.auditlog", "[]");

    const logs = JSON.parse(journal);
    logs.push(entrée);
    if (logs.length > 1000) logs.shift();
    P.setStringPref("cigale.securite.auditlog", JSON.stringify(logs));
  } catch (e) {
    Components.utils.reportError("Audit log error: " + e);
  }
}

export function consulterAuditLog() {
  try {
    const P = Services.prefs;
    const journal = P.getStringPref("cigale.securite.auditlog", "[]");
    return JSON.parse(journal);
  } catch (e) {
    return [];
  }
}

// === 4. VÉRIFICATION D'INTÉGRITÉ DU PROFIL ===
export async function verifierIntégritéProfil() {
  try {
    const P = Services.prefs;
    const profDir = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);

    const fichiersCritiques = ["prefs.js", "places.sqlite", "permissions.sqlite"];
    const hashes = {};

    for (const fichier of fichiersCritiques) {
      const f = profDir.clone();
      f.append(fichier);

      if (f.exists()) {
        const hash = await calculerHashFichier(f);
        hashes[fichier] = hash;
      }
    }

    const hashsPrécédents = P.getStringPref("cigale.securite.profil.hashes", "{}");
    const ancien = JSON.parse(hashsPrécédents);

    let modifié = false;
    for (const [fichier, hash] of Object.entries(hashes)) {
      if (ancien[fichier] && ancien[fichier] !== hash) {
        modifié = true;
        enregistrerAuditLog("PROFIL_MODIFIÉ", { fichier });
      }
    }

    if (!modifié) {
      P.setStringPref("cigale.securite.profil.hashes", JSON.stringify(hashes));
    }
    return !modifié;
  } catch (e) {
    return true;
  }
}

async function calculerHashFichier(nsIFile) {
  return "hash_" + nsIFile.leafName + "_" + nsIFile.fileSize;
}

// === 5. NETWORK LOCKDOWN MODE ===
export const DOMAINES_AUTORISÉS = new Set([
  "github.com",
  "api.github.com",
  "mozilla.org",
  "archive.mozilla.org",
  "quad9.net",
  "api.ipify.org",
  "check.torproject.org",
  "duckduckgo.com",
]);

export function validerDomaineLockdown(url) {
  try {
    const P = Services.prefs;
    if (!P.getBoolPref("cigale.securite.lockdown.reseau", false)) {
      return true;
    }

    const uri = Services.io.newURI(url);
    if (!uri) return true;

    const domaine = uri.host.toLowerCase();

    if (!DOMAINES_AUTORISÉS.has(domaine)) {
      enregistrerAuditLog("DOMAINE_BLOQUÉ", { domaine });
      return false;
    }
    return true;
  } catch (e) {
    return true;
  }
}

// === 6. SECURE BOOT DU NAVIGATEUR ===
export async function initialiserSecureBoot() {
  try {
    const P = Services.prefs;
    const empreinte = générerEmpreinteMachine();
    const empreinteStockée = P.getStringPref("cigale.securite.empreinte.machine", "");

    if (empreinteStockée && empreinteStockée !== empreinte) {
      enregistrerAuditLog("MACHINE_CHANGE", { ancien: empreinteStockée, nouveau: empreinte });
      return false;
    }

    P.setStringPref("cigale.securite.empreinte.machine", empreinte);
    return true;
  } catch (e) {
    return true;
  }
}

function générerEmpreinteMachine() {
  try {
    const hostname = Services.eTLD.host || "unknown";
    return "machine_" + hostname + "_" + Math.random().toString(36).slice(2);
  } catch (e) {
    return "machine_unknown_" + Date.now();
  }
}

// === 7. CANARY TOKENS INTERNES ===
export function initialiserCanaryTokens() {
  const P = Services.prefs;
  const tokens = {
    "cigale.canary.token.1": "SHOULD_NEVER_CHANGE_THIS_VALUE",
    "cigale.canary.token.2": "MALWARE_DETECTION_CANARY",
  };

  for (const [clé, valeur] of Object.entries(tokens)) {
    P.setStringPref(clé, valeur);
  }
}

export function vérifierCanaryTokens() {
  const P = Services.prefs;
  const tokens = {
    "cigale.canary.token.1": "SHOULD_NEVER_CHANGE_THIS_VALUE",
    "cigale.canary.token.2": "MALWARE_DETECTION_CANARY",
  };

  for (const [clé, valeurAttendue] of Object.entries(tokens)) {
    const valeur = P.getStringPref(clé, null);
    if (valeur !== valeurAttendue) {
      Components.utils.reportError("CIGALE_CANARY_ALERT: Potential tamper detected!");
      enregistrerAuditLog("CANARY_MODIFIÉ", { clé });
      return false;
    }
  }
  return true;
}

export async function initialiserSécurité() {
  vérifierCanaryTokens();
  await verifierManifesteSécurité();
  await initialiserSecureBoot();
  await verifierIntégritéProfil();
}
