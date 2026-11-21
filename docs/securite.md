# Sécurité et anonymat dans La Cigale

La Cigale privilégie l'anonymat et la sécurité, quitte à sacrifier du confort.
Ce document explique ce qui est protégé, ce qui ne l'est pas, et comment assouplir
un réglage en connaissance de cause.

## Ce que La Cigale protège

| Menace | Protection | Réglages clés |
|---|---|---|
| Collecte par l'éditeur | Télémétrie, études, rapports de plantage, *privacy-preserving attribution* : tout est coupé et verrouillé. Le programme de mise à jour et le rapporteur de plantage sont supprimés du paquet. | `toolkit.telemetry.*`, `datareporting.*` |
| Empreinte numérique | `resistFingerprinting` (le mécanisme de Tor Browser) : fuseau UTC, polices, canvas, horloges. WebGL et WebGPU sont coupés. | `privacy.resistFingerprinting` |
| Pistage entre sites | Protection renforcée « stricte », cookies et cache isolés par site, retrait des paramètres de pistage des URL, Global Privacy Control, uBlock Origin. | `network.cookie.cookieBehavior = 5` |
| Fuite d'IP locale | WebRTC désactivé. | `media.peerconnection.enabled` |
| Espionnage DNS | DNS chiffré obligatoire (Quad9, Suisse), sans retour au DNS du FAI. | `network.trr.mode = 3` |
| Interception réseau | HTTPS imposé, TLS 1.2 minimum, pas de 0-RTT, OCSP obligatoire, CRLite. | `dom.security.https_only_mode` |
| Traces locales | Cache en mémoire seulement ; historique, cookies et formulaires effacés à la fermeture ; mots de passe non enregistrés. | `privacy.sanitize.sanitizeOnShutdown` |
| Hameçonnage | Domaines internationalisés affichés en punycode ; liste locale de navigation sûre. | `network.IDN_show_punycode` |
| Logiciels tiers | Les extensions injectées par d'autres programmes sont refusées. | `extensions.enabledScopes = 5` |

## Ce que La Cigale ne fait PAS

- **Elle ne masque pas votre adresse IP.** Les sites voient votre IP publique.
  Utilisez un VPN de confiance ou, pour un anonymat fort, **Tor Browser**.
- **Elle n'est pas Tor Browser.** Sur le réseau Tor, des milliers de personnes ont
  exactement la même empreinte que vous. Avec La Cigale, la population de référence
  est plus petite.
- **Elle ne vous protège pas de vous-même.** Se connecter à un compte vous identifie,
  quel que soit le navigateur.

## Compromis assumés

| Réglage | Effet visible | Pour assouplir (`about:config`) |
|---|---|---|
| Langue annoncée en anglais | Certains sites s'affichent en anglais. | `privacy.spoof_english` → `1`, `intl.accept_languages` → `fr-FR, fr, en-US, en` |
| Fuseau horaire UTC | Les heures affichées par les sites peuvent être décalées. | Inhérent à `resistFingerprinting` (verrouillé). |
| Pages en mode clair | `resistFingerprinting` force le thème clair dans les pages. | Inhérent à `resistFingerprinting`. |
| WebRTC coupé | Pas de visio dans le navigateur (Jitsi, Meet…). | Réglage verrouillé : utilisez une application dédiée. |
| WebGL coupé | Cartes 3D et certains jeux ne fonctionnent pas. | Réglage verrouillé. |
| DNS strict (mode 3) | Les portails Wi-Fi captifs (hôtels, gares) peuvent échouer. | `network.trr.mode` → `2` le temps de la connexion. |
| Tout effacé à la fermeture | Il faut se reconnecter aux sites à chaque lancement. | Paramètres → Vie privée → Cookies → **Gérer les exceptions** |
| OCSP obligatoire | Rarement, un site légitime est refusé si le serveur OCSP est en panne. | Réglage verrouillé. |
| DRM désactivés | Netflix, Disney+, Spotify Web ne fonctionnent pas. | Réglage verrouillé. |

## Chaîne de construction

Les scripts de build ne font confiance qu'à Mozilla :

1. version ESR lue sur `product-details.mozilla.org` ;
2. binaire téléchargé sur `archive.mozilla.org` (HTTPS) ;
3. **SHA-512** comparé au fichier `SHA512SUMS` de Mozilla ;
4. sous Linux, **signature GPG** de `SHA512SUMS` vérifiée contre la clé de publication
   de Mozilla (`14F2 6682 D091 6CDD 81E3 7B6D 61B7 B526 D98F 0353`) ;
5. sous Windows, **signature Authenticode** « Mozilla Corporation » vérifiée.

Aucun binaire tiers n'est téléchargé automatiquement (rcedit et Inno Setup sont optionnels
et installés par vous-même).

## Mises à jour

Le programme de mise à jour de Firefox est retiré : il réinstallerait la marque Firefox.
**Reconstruisez La Cigale à chaque nouvelle version ESR** (environ toutes les 4 semaines,
avec les correctifs de sécurité). C'est une contrainte importante : un navigateur
non mis à jour est un navigateur vulnérable.
