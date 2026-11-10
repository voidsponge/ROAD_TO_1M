// Transforme un "snapshot" brut (collecté par collect.js) en constats notés.
// Fonction pure : aucun accès réseau, entièrement testable.
import { classifyCookie, matchTracker, matchService } from './trackers.js';

export const PILLARS = {
  rgpd: { id: 'rgpd', name: 'RGPD & cookies', weight: 35 },
  a11y: { id: 'a11y', name: 'Accessibilité', weight: 25 },
  legal: { id: 'legal', name: 'Mentions légales', weight: 20 },
  security: { id: 'security', name: 'Sécurité', weight: 20 },
};

const PENALTY = { critical: 30, major: 15, minor: 5, info: 0, ok: 0 };
const SEVERITY_ORDER = { critical: 0, major: 1, minor: 2, info: 3, ok: 4 };

export function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

const uniq = (arr) => [...new Set(arr)];
const list = (arr, max = 8) => {
  const u = uniq(arr);
  return u.slice(0, max).join(', ') + (u.length > max ? ` et ${u.length - max} autre(s)` : '');
};
const findLink = (links, re) => links.find((l) => re.test(l.text) || re.test(decodeURIComponentSafe(l.href)));
function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch { return s; } }

const RE = {
  legal: /mentions?[\s\-_]*l[ée]gales?|informations?[\s\-_]*l[ée]gales?|legal[\s\-_]*notice|\bimpressum\b|\/legal\b/i,
  privacy: /confidentialit[ée]|donn[ée]es[\s\-_]*personnelles|vie[\s\-_]*priv[ée]e|privacy|\brgpd\b|protection[\s\-_]*des[\s\-_]*donn[ée]es/i,
  cgv: /\bcgv\b|conditions[\s\-_]*g[ée]n[ée]rales[\s\-_]*(de[\s\-_]*)?vente|conditions[\s\-_]*de[\s\-_]*vente|terms[\s\-_]*(of[\s\-_]*)?(sale|service)/i,
  a11y: /accessibilit[ée]/i,
  cookies: /cookies?|traceurs|consentement/i,
};

function analyzeRgpd(s, out) {
  const P = 'rgpd';
  const cookies = s.cookies.map((c) => ({ ...c, ...classifyCookie(c.name) }));
  const consentCookies = cookies.filter((c) => c.consent === true);
  const maybeCookies = cookies.filter((c) => c.consent === 'maybe');
  const unknownCookies = cookies.filter((c) => c.consent === null);

  const trackerHits = new Map();
  const serviceHits = new Map();
  for (const r of s.requests) {
    const t = matchTracker(r.url);
    if (t) { trackerHits.set(t.name, t); continue; }
    const sv = matchService(r.url);
    if (sv && r.thirdParty) serviceHits.set(sv.id, sv);
  }
  const hardTrackers = [...trackerHits.values()].filter((t) => t.consent === true);
  const hasTracking = consentCookies.length > 0 || hardTrackers.length > 0;

  if (consentCookies.length) {
    out.push({
      id: 'rgpd-cookies-before-consent', pillar: P, severity: 'critical',
      title: `${consentCookies.length} cookie(s) de suivi déposé(s) avant tout consentement`,
      detail: `Dès l’arrivée sur la page, sans qu’aucun choix n’ait été exprimé, le site dépose : ${list(consentCookies.map((c) => `${c.name} (${c.vendor})`))}.`,
      law: 'Art. 82 loi Informatique et Libertés · lignes directrices CNIL « cookies et autres traceurs ». Sanctions CNIL jusqu’à 20 M€ ou 4 % du CA.',
      fix: 'Bloquer le chargement de ces scripts tant que le visiteur n’a pas cliqué sur « Accepter », via une plateforme de gestion du consentement correctement configurée.',
    });
  }
  if (hardTrackers.length) {
    out.push({
      id: 'rgpd-trackers-before-consent', pillar: P, severity: 'major',
      title: `${hardTrackers.length} service(s) de suivi contacté(s) avant consentement`,
      detail: `Des requêtes partent vers ${list(hardTrackers.map((t) => `${t.name} (${t.cat.toLowerCase()})`))} dès le chargement : l’adresse IP et la page consultée sont transmises à ces tiers.`,
      law: 'Art. 82 loi Informatique et Libertés · art. 6 et 44 RGPD (transferts hors UE le cas échéant).',
      fix: 'Conditionner ces balises au consentement (déclencheurs de consentement dans le gestionnaire de balises, ou chargement différé par la CMP).',
    });
  }
  if (hasTracking && !s.banner.detected) {
    out.push({
      id: 'rgpd-no-banner', pillar: P, severity: 'major',
      title: 'Aucun bandeau de consentement détecté',
      detail: 'Le site utilise des traceurs soumis à consentement mais aucun bandeau permettant d’accepter ou de refuser n’a été détecté à l’arrivée.',
      law: 'Art. 82 loi Informatique et Libertés · recommandation CNIL du 17 septembre 2020.',
      fix: 'Installer une plateforme de gestion du consentement (Axeptio, tarteaucitron, Didomi…) et y rattacher tous les traceurs.',
    });
  }
  if (s.banner.detected && s.banner.hasAccept && !s.banner.hasRefuse) {
    out.push({
      id: 'rgpd-no-refuse', pillar: P, severity: 'major',
      title: 'Refuser les cookies n’est pas aussi simple qu’accepter',
      detail: `Le bandeau${s.banner.cmp ? ` (${s.banner.cmp})` : ''} propose un bouton d’acceptation mais aucun bouton « Tout refuser » ou « Continuer sans accepter » au même niveau.`,
      law: 'Recommandation CNIL du 17 septembre 2020 — plusieurs sanctions prononcées sur ce seul motif.',
      fix: 'Ajouter un bouton « Tout refuser » de même visibilité que « Tout accepter » dès le premier écran du bandeau.',
    });
  }
  const services = [...serviceHits.values()].filter((x) => x.id !== 'gtm');
  if (services.length) {
    out.push({
      id: 'rgpd-third-party-services', pillar: P, severity: 'minor',
      title: `${services.length} service(s) tiers chargé(s) sans accord préalable`,
      detail: `${list(services.map((x) => x.name))}. Chaque chargement transmet l’adresse IP du visiteur au fournisseur.`,
      law: 'Art. 5 et 6 RGPD (minimisation, base légale).',
      fix: 'Héberger les polices en local ; n’afficher vidéos et cartes qu’après un clic du visiteur (façade « cliquer pour charger »).',
    });
  }
  if (maybeCookies.length || [...trackerHits.values()].some((t) => t.consent === 'maybe')) {
    out.push({
      id: 'rgpd-audience-exempt', pillar: P, severity: 'info',
      title: 'Mesure d’audience potentiellement exemptée — configuration à vérifier',
      detail: 'Un outil de mesure d’audience exemptable (Matomo, Piano Analytics) est détecté. Il n’est dispensé de consentement que s’il est configuré selon les critères de la CNIL (anonymisation, durée limitée, pas de recoupement).',
      law: 'CNIL — solutions de mesure d’audience exemptées de consentement.',
      fix: 'Vérifier la configuration d’exemption et la mentionner dans la politique de confidentialité.',
    });
  }
  if (unknownCookies.length) {
    out.push({
      id: 'rgpd-unknown-cookies', pillar: P, severity: 'info',
      title: `${unknownCookies.length} cookie(s) à qualifier`,
      detail: `Finalité non reconnue automatiquement : ${list(unknownCookies.map((c) => c.name))}. À classer (nécessaire ou soumis à consentement).`,
      law: 'Art. 30 RGPD (documentation des traitements).',
      fix: 'Documenter la finalité de chaque cookie dans la politique cookies.',
    });
  }
  const privacy = findLink(s.links, RE.privacy);
  if (!privacy) {
    out.push({
      id: 'rgpd-no-privacy-policy', pillar: P, severity: 'major',
      title: 'Politique de confidentialité introuvable',
      detail: 'Aucun lien vers une politique de confidentialité ou de protection des données n’a été trouvé sur la page.',
      law: 'Art. 12 à 14 RGPD (obligation d’information).',
      fix: 'Publier une politique de confidentialité et la lier depuis le pied de page de toutes les pages.',
    });
  }
  const bareForms = s.forms.filter((f) => f.collectsPersonalData && !f.hasNotice);
  if (bareForms.length) {
    out.push({
      id: 'rgpd-form-notice', pillar: P, severity: 'minor',
      title: `${bareForms.length} formulaire(s) sans mention d’information`,
      detail: 'Un formulaire collecte des données personnelles (e-mail, téléphone…) sans mention visible sur leur utilisation ni lien vers la politique de confidentialité.',
      law: 'Art. 13 RGPD.',
      fix: 'Ajouter sous le formulaire une mention courte : finalité, durée de conservation, lien vers la politique de confidentialité.',
    });
  }
  if (s.banner.detected && !findLink(s.links, /cookies?|traceurs|consentement|pr[ée]f[ée]rences/i) && !s.banner.persistentControl) {
    out.push({
      id: 'rgpd-no-withdraw', pillar: P, severity: 'minor',
      title: 'Aucun accès permanent à la gestion des cookies',
      detail: 'Aucun lien ou bouton permanent ne semble permettre de revenir sur son choix une fois le bandeau fermé.',
      law: 'Art. 7.3 RGPD — le retrait du consentement doit être aussi simple que son octroi.',
      fix: 'Ajouter un lien « Gérer mes cookies » dans le pied de page.',
    });
  }
  if (!hasTracking) {
    out.push({
      id: 'rgpd-ok-no-tracking', pillar: P, severity: 'ok',
      title: 'Aucun traceur soumis à consentement déposé à l’arrivée',
      detail: s.banner.detected ? `Le bandeau${s.banner.cmp ? ` (${s.banner.cmp})` : ''} semble bloquer correctement les traceurs avant le choix du visiteur.` : 'Aucun cookie ni service de suivi soumis à consentement n’a été détecté au chargement.',
    });
  }
  if (privacy) out.push({ id: 'rgpd-ok-privacy', pillar: P, severity: 'ok', title: 'Politique de confidentialité accessible', detail: `Lien détecté : « ${privacy.text.slice(0, 80) || privacy.href} ».` });
  return { cookies, hasTracking };
}

function analyzeLegal(s, out, ctx) {
  const P = 'legal';
  const legal = findLink(s.links, RE.legal);
  if (!legal && !s.legalPage) {
    out.push({
      id: 'legal-missing', pillar: P, severity: 'critical',
      title: 'Mentions légales introuvables',
      detail: 'Aucun lien « Mentions légales » n’a été trouvé sur la page d’accueil.',
      law: 'Art. 1-1 de la loi pour la confiance dans l’économie numérique (LCEN) — jusqu’à 1 an d’emprisonnement et 75 000 € d’amende (375 000 € pour une société).',
      fix: 'Créer une page « Mentions légales » accessible depuis toutes les pages (pied de page).',
    });
  } else if (s.legalPage && s.legalPage.text.length > 400 && !/captcha/i.test(s.legalPage.text.slice(0, 300))) {
    const t = s.legalPage.text;
    const missing = [];
    const hasId = /\b\d{3}[\s. ]?\d{3}[\s. ]?\d{3}([\s. ]?\d{5})?\b/.test(t) && /siren|siret|rcs|r\.c\.s|immatricul|répertoire des métiers|rna\b|w\d{9}/i.test(t);
    if (!hasId) missing.push({ k: 'numéro d’immatriculation (SIREN/SIRET, RCS ou RNA — obligatoire pour toute entreprise immatriculée)', sev: 'major' });
    if (!/h[ée]berg/i.test(t)) missing.push({ k: 'identité et coordonnées de l’hébergeur', sev: 'major' });
    if (!/direct(eur|rice)\s+(de\s+(la\s+)?)?publication|responsable\s+(de\s+(la\s+)?)?(publication|r[ée]daction)|[ée]diteur/i.test(t)) missing.push({ k: 'directeur de la publication / éditeur', sev: 'minor' });
    if (!/[\w.+-]+@[\w-]+\.[\w.-]+|\b0[1-9]([\s.-]?\d{2}){4}\b|\+33[\s.-]?[1-9]([\s.-]?\d{2}){4}/.test(t)) missing.push({ k: 'moyen de contact (e-mail ou téléphone)', sev: 'minor' });
    const major = missing.filter((m) => m.sev === 'major');
    const minor = missing.filter((m) => m.sev === 'minor');
    if (major.length) {
      out.push({
        id: 'legal-incomplete-major', pillar: P, severity: 'major',
        title: 'Mentions légales incomplètes : informations obligatoires absentes',
        detail: `Non trouvé sur la page de mentions légales : ${major.map((m) => m.k).join(' ; ')}.`,
        law: 'Art. 1-1 LCEN · art. R123-237 code de commerce.',
        fix: 'Compléter la page avec la dénomination, la forme juridique, l’adresse, le numéro d’immatriculation et les coordonnées de l’hébergeur.',
      });
    }
    if (minor.length) {
      out.push({
        id: 'legal-incomplete-minor', pillar: P, severity: 'minor',
        title: 'Mentions légales à compléter',
        detail: `Non trouvé : ${minor.map((m) => m.k).join(' ; ')}.`,
        law: 'Art. 1-1 LCEN.',
        fix: 'Ajouter ces informations à la page de mentions légales.',
      });
    }
    if (!missing.length) out.push({ id: 'legal-ok', pillar: P, severity: 'ok', title: 'Mentions légales présentes et complètes', detail: 'Immatriculation, hébergeur, responsable de publication et contact détectés.' });
  } else {
    out.push({ id: 'legal-unread', pillar: P, severity: 'info', title: 'Mentions légales présentes — contenu non vérifié', detail: 'Le lien existe mais la page n’a pas pu être analysée automatiquement.' });
  }

  if (s.ecommerce) {
    if (!findLink(s.links, RE.cgv)) {
      out.push({
        id: 'legal-no-cgv', pillar: P, severity: 'major',
        title: 'Conditions générales de vente introuvables',
        detail: 'Le site vend en ligne mais aucun lien vers des CGV n’a été trouvé sur la page d’accueil.',
        law: 'Art. L111-1 et L221-5 code de la consommation · art. L441-1 code de commerce. Amende jusqu’à 15 000 € (75 000 € pour une société).',
        fix: 'Publier des CGV (prix, livraison, rétractation, garanties, médiateur de la consommation) et les lier depuis le pied de page.',
      });
    } else out.push({ id: 'legal-ok-cgv', pillar: P, severity: 'ok', title: 'Conditions générales de vente accessibles', detail: 'Lien vers les CGV détecté.' });
  }
  ctx.legalLink = legal;
}

function analyzeA11y(s, out) {
  const P = 'a11y';
  const sevMap = { critical: 'critical', serious: 'major', moderate: 'minor', minor: 'minor' };
  if (s.axe.error) {
    out.push({ id: 'a11y-unavailable', pillar: P, severity: 'info', title: 'Tests d’accessibilité automatiques indisponibles pour cette page', detail: 'La page n’a pas permis l’exécution des tests (protection anti-robot ou erreur de script).' });
  }
  for (const v of s.axe.violations) {
    out.push({
      id: 'a11y-' + v.id, pillar: P, severity: sevMap[v.impact] || 'minor', axeImpact: v.impact,
      title: v.help,
      detail: `${v.nodes} élément(s) concerné(s)${v.sample ? ` — exemple : ${v.sample}` : ''}.`,
      law: `RGAA 4.1 / WCAG 2.1${v.wcag.length ? ' — critère(s) ' + v.wcag.join(', ') : ''}. Obligation issue de la directive européenne sur l’accessibilité (art. L412-13 code de la consommation).`,
      fix: v.description,
    });
  }
  if (!findLink(s.links, RE.a11y) && !/accessibilit[ée]\s*:\s*(non|partiellement|totalement)\s+conforme/i.test(s.text)) {
    out.push({
      id: 'a11y-no-statement', pillar: P, severity: 'minor',
      title: 'Aucune déclaration d’accessibilité détectée',
      detail: 'Aucun lien « Accessibilité » ni mention de niveau de conformité n’apparaît sur la page.',
      law: 'Art. 47 loi du 11 février 2005 et arrêté du 9 octobre 2023 (information sur l’accessibilité des services).',
      fix: 'Publier une déclaration d’accessibilité et afficher la mention « Accessibilité : non / partiellement / totalement conforme ».',
    });
  }
  if (!s.axe.error && !s.axe.violations.length) out.push({ id: 'a11y-ok', pillar: P, severity: 'ok', title: 'Aucune erreur détectée par les tests automatiques', detail: 'Les tests automatiques ne couvrent qu’une partie des critères : un audit manuel reste nécessaire pour attester la conformité.' });
}

function analyzeSecurity(s, out) {
  const P = 'security';
  const h = s.headers;
  const law32 = 'Art. 32 RGPD (sécurité des traitements) · recommandations ANSSI.';
  if (!s.https) {
    out.push({ id: 'sec-no-https', pillar: P, severity: 'critical', title: 'Le site n’est pas servi en HTTPS', detail: 'Les échanges entre le visiteur et le site circulent en clair et peuvent être interceptés ou modifiés.', law: law32, fix: 'Installer un certificat TLS (gratuit avec Let’s Encrypt) et rediriger tout le trafic vers HTTPS.' });
  } else {
    out.push({ id: 'sec-ok-https', pillar: P, severity: 'ok', title: 'Site servi en HTTPS', detail: 'La connexion est chiffrée.' });
    if (s.httpRedirect === 'none') out.push({ id: 'sec-no-redirect', pillar: P, severity: 'major', title: 'La version HTTP ne redirige pas vers HTTPS', detail: 'Le site reste consultable en clair via http://.', law: law32, fix: 'Mettre en place une redirection 301 de http:// vers https://.' });
    if (!h['strict-transport-security']) out.push({ id: 'sec-no-hsts', pillar: P, severity: 'minor', title: 'En-tête HSTS absent', detail: 'Sans Strict-Transport-Security, un attaquant peut forcer une première connexion non chiffrée.', law: law32, fix: 'Ajouter l’en-tête Strict-Transport-Security: max-age=31536000; includeSubDomains.' });
  }
  if (s.mixedContent.length) out.push({ id: 'sec-mixed', pillar: P, severity: 'major', title: `${s.mixedContent.length} ressource(s) chargée(s) en HTTP non chiffré`, detail: `Contenu mixte : ${list(s.mixedContent, 3)}.`, law: law32, fix: 'Charger toutes les ressources en https://.' });
  const csp = h['content-security-policy'] || '';
  if (!csp) out.push({ id: 'sec-no-csp', pillar: P, severity: 'minor', title: 'Aucune politique de sécurité du contenu (CSP)', detail: 'Sans Content-Security-Policy, le site est plus exposé à l’injection de scripts malveillants (XSS).', law: law32, fix: 'Définir un en-tête Content-Security-Policy adapté aux ressources réellement utilisées.' });
  if (!h['x-frame-options'] && !/frame-ancestors/i.test(csp)) out.push({ id: 'sec-no-frame', pillar: P, severity: 'minor', title: 'Protection contre le détournement de clic absente', detail: 'Le site peut être intégré dans une page tierce (clickjacking).', law: law32, fix: 'Ajouter X-Frame-Options: SAMEORIGIN ou la directive CSP frame-ancestors.' });
  if (!/nosniff/i.test(h['x-content-type-options'] || '')) out.push({ id: 'sec-no-nosniff', pillar: P, severity: 'minor', title: 'En-tête X-Content-Type-Options absent', detail: 'Le navigateur peut interpréter un fichier avec un type différent de celui déclaré.', law: law32, fix: 'Ajouter X-Content-Type-Options: nosniff.' });
  const leaks = [];
  if (/\d+\.\d+/.test(h.server || '')) leaks.push(`Server: ${h.server}`);
  if (h['x-powered-by']) leaks.push(`X-Powered-By: ${h['x-powered-by']}`);
  if (s.generator && /\d+\.\d+/.test(s.generator)) leaks.push(`generator: ${s.generator}`);
  if (leaks.length) out.push({ id: 'sec-version-leak', pillar: P, severity: 'minor', title: 'Versions logicielles exposées', detail: `Le site révèle sa pile technique (${list(leaks, 3)}), ce qui facilite le ciblage de failles connues.`, law: law32, fix: 'Masquer ces en-têtes et la balise generator ; maintenir les logiciels à jour.' });
  const weak = s.cookies.filter((c) => classifyCookie(c.name).vendor === 'Session' && (!c.secure || !c.httpOnly));
  if (weak.length) out.push({ id: 'sec-cookie-flags', pillar: P, severity: 'minor', title: 'Cookie de session insuffisamment protégé', detail: `${list(weak.map((c) => c.name))} : attribut ${weak.some((c) => !c.secure) ? 'Secure' : ''}${weak.some((c) => !c.secure) && weak.some((c) => !c.httpOnly) ? ' et ' : ''}${weak.some((c) => !c.httpOnly) ? 'HttpOnly' : ''} manquant.`, law: law32, fix: 'Définir les attributs Secure, HttpOnly et SameSite sur les cookies de session.' });
  if (!h['referrer-policy']) out.push({ id: 'sec-no-referrer', pillar: P, severity: 'info', title: 'En-tête Referrer-Policy non défini', detail: 'Le comportement par défaut du navigateur s’applique.', fix: 'Ajouter Referrer-Policy: strict-origin-when-cross-origin.' });
  if (s.securityTxt === false) out.push({ id: 'sec-no-securitytxt', pillar: P, severity: 'info', title: 'Pas de fichier security.txt', detail: 'Aucun point de contact publié pour le signalement de vulnérabilités.', fix: 'Publier /.well-known/security.txt (RFC 9116).' });
}

function scoreA11y(findings) {
  const w = { critical: 12, serious: 7, moderate: 3, minor: 1 };
  let s = 100;
  for (const f of findings) s -= f.axeImpact ? w[f.axeImpact] || 1 : PENALTY[f.severity];
  return Math.max(0, s);
}

export function analyze(snapshot) {
  const findings = [];
  const ctx = {};
  const { cookies } = analyzeRgpd(snapshot, findings);
  analyzeLegal(snapshot, findings, ctx);
  analyzeA11y(snapshot, findings);
  analyzeSecurity(snapshot, findings);

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const pillars = {};
  let total = 0;
  for (const p of Object.values(PILLARS)) {
    const own = findings.filter((f) => f.pillar === p.id);
    const score = p.id === 'a11y'
      ? scoreA11y(own)
      : Math.max(0, 100 - own.reduce((n, f) => n + PENALTY[f.severity], 0));
    pillars[p.id] = {
      ...p, score, grade: grade(score),
      counts: { critical: 0, major: 0, minor: 0, info: 0, ok: 0, ...countBy(own) },
    };
    total += score * p.weight;
  }
  const score = Math.round(total / 100);
  const counts = { critical: 0, major: 0, minor: 0, info: 0, ok: 0, ...countBy(findings) };
  return {
    version: 1,
    url: snapshot.finalUrl,
    host: safeHost(snapshot.finalUrl),
    title: snapshot.title,
    scannedAt: snapshot.scannedAt,
    score, grade: grade(score), counts, pillars, findings,
    cookies: cookies.map((c) => ({ name: c.name, domain: c.domain, vendor: c.vendor, consent: c.consent, thirdParty: c.thirdParty })),
    stats: {
      requests: snapshot.requests.length,
      thirdPartyHosts: uniq(snapshot.requests.filter((r) => r.thirdParty).map((r) => r.host)).length,
      bytes: snapshot.totalBytes, loadMs: snapshot.loadMs,
      cmp: snapshot.banner.cmp, ecommerce: snapshot.ecommerce,
    },
    screenshot: snapshot.screenshot || null,
  };
}

function countBy(arr) {
  const o = {};
  for (const f of arr) o[f.severity] = (o[f.severity] || 0) + 1;
  return o;
}
function safeHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }
