import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, grade } from '../src/scanner/analyze.js';
import { classifyCookie, matchTracker } from '../src/scanner/trackers.js';

const base = (over = {}) => ({
  inputUrl: 'https://exemple.fr/', finalUrl: 'https://exemple.fr/', status: 200, https: true,
  headers: {
    'strict-transport-security': 'max-age=31536000', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin',
  },
  title: 'Exemple', lang: 'fr', text: 'Accessibilité : partiellement conforme',
  links: [
    { text: 'Mentions légales', href: 'https://exemple.fr/mentions-legales' },
    { text: 'Politique de confidentialité', href: 'https://exemple.fr/confidentialite' },
  ],
  forms: [], generator: '', ecommerce: false,
  banner: { detected: false, cmp: null, hasAccept: false, hasRefuse: false, persistentControl: false },
  cookies: [], requests: [], axe: { violations: [], error: null },
  legalPage: { url: 'https://exemple.fr/mentions-legales', text: 'Éditeur : Exemple SAS, SIRET 123 456 789 00012, RCS Paris. Directeur de la publication : A. Martin. Hébergeur : OVH, 2 rue Kellermann, Roubaix. Contact : contact@exemple.fr. '.repeat(4) },
  httpRedirect: 'https', securityTxt: true, mixedContent: [], totalBytes: 1000, loadMs: 500,
  scannedAt: '2026-11-10T10:00:00.000Z', ...over,
});
const ids = (r) => r.findings.map((f) => f.id);

test('un site exemplaire obtient 100 et le niveau A', () => {
  const r = analyze(base());
  assert.equal(r.score, 100);
  assert.equal(r.grade, 'A');
  assert.equal(r.counts.critical + r.counts.major + r.counts.minor, 0);
});

test('cookies de suivi avant consentement = constat critique', () => {
  const r = analyze(base({
    cookies: [{ name: '_ga', domain: '.exemple.fr', secure: true, httpOnly: false }, { name: '_fbp', domain: '.exemple.fr', secure: true, httpOnly: false }],
    requests: [{ url: 'https://www.google-analytics.com/g/collect?v=2', host: 'www.google-analytics.com', thirdParty: true }],
  }));
  assert.ok(ids(r).includes('rgpd-cookies-before-consent'));
  assert.ok(ids(r).includes('rgpd-trackers-before-consent'));
  assert.ok(ids(r).includes('rgpd-no-banner'));
  assert.equal(r.findings[0].severity, 'critical');
  assert.equal(r.pillars.rgpd.score, 40);
});

test('bandeau sans bouton refuser', () => {
  const r = analyze(base({ banner: { detected: true, cmp: 'Axeptio', hasAccept: true, hasRefuse: false, persistentControl: true } }));
  assert.ok(ids(r).includes('rgpd-no-refuse'));
  assert.ok(!ids(r).includes('rgpd-no-banner'));
});

test('Google Tag Manager seul n’est pas un manquement', () => {
  const r = analyze(base({ requests: [{ url: 'https://www.googletagmanager.com/gtm.js?id=GTM-X', host: 'www.googletagmanager.com', thirdParty: true }] }));
  assert.equal(r.pillars.rgpd.score, 100);
});

test('mentions légales absentes, incomplètes ou illisibles', () => {
  assert.ok(ids(analyze(base({ links: [], legalPage: null }))).includes('legal-missing'));
  const incomplete = analyze(base({ legalPage: { url: 'x', text: 'Bienvenue sur notre site. Nous sommes une belle entreprise. '.repeat(20) } }));
  assert.ok(ids(incomplete).includes('legal-incomplete-major'));
  const captcha = analyze(base({ legalPage: { url: 'x', text: 'Entrez les caractères du CAPTCHA' } }));
  assert.ok(ids(captcha).includes('legal-unread'));
  assert.equal(captcha.pillars.legal.score, 100);
});

test('boutique en ligne sans CGV', () => {
  assert.ok(ids(analyze(base({ ecommerce: true }))).includes('legal-no-cgv'));
});

test('sécurité : HTTP, en-têtes et fuite de version', () => {
  const r = analyze(base({ https: false, finalUrl: 'http://exemple.fr/', headers: { server: 'Apache/2.4.41', 'x-powered-by': 'PHP/7.4.3' } }));
  assert.ok(ids(r).includes('sec-no-https'));
  assert.ok(ids(r).includes('sec-version-leak'));
  assert.ok(r.pillars.security.score < 60);
});

test('accessibilité : pondération par gravité axe', () => {
  const v = (id, impact) => ({ id, impact, help: id, description: '', nodes: 2, sample: '<a>', wcag: ['1.4.3'] });
  const r = analyze(base({ axe: { error: null, violations: [v('color-contrast', 'serious'), v('image-alt', 'critical')] } }));
  assert.equal(r.pillars.a11y.score, 100 - 7 - 12);
});

test('classification des cookies et des traceurs', () => {
  assert.equal(classifyCookie('_ga_ABC123').consent, true);
  assert.equal(classifyCookie('PHPSESSID').consent, false);
  assert.equal(classifyCookie('axeptio_cookies').consent, false);
  assert.equal(classifyCookie('_pk_id.1.abcd').consent, 'maybe');
  assert.equal(classifyCookie('truc_inconnu').consent, null);
  assert.equal(matchTracker('https://connect.facebook.net/fr_FR/fbevents.js').name, 'Meta (Facebook) Pixel');
  assert.equal(matchTracker('https://exemple.fr/app.js'), null);
});

test('niveaux', () => {
  assert.deepEqual([95, 80, 65, 45, 10].map(grade), ['A', 'B', 'C', 'D', 'E']);
});
