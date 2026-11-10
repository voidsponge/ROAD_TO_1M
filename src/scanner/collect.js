// Charge une page dans Chromium sans interagir avec elle (comme un visiteur qui
// n'a encore rien accepté) et collecte tout ce qui est nécessaire à l'analyse.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { assertPublicUrl, isPublicHost, TargetError } from './ssrf.js';
import { CMPS } from './trackers.js';
import { analyze } from './analyze.js';

const require = createRequire(import.meta.url);
let axeFr = { rules: {} };
try { axeFr = require('axe-core/locales/fr.json'); } catch { /* libellés anglais par défaut */ }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const NAV_TIMEOUT = 30_000;

let browserPromise = null;
export async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] }).then((b) => {
      b.on('disconnected', () => { browserPromise = null; });
      return b;
    }).catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}
export async function closeBrowser() {
  if (browserPromise) { const b = await browserPromise.catch(() => null); browserPromise = null; if (b) await b.close().catch(() => {}); }
}

const siteOf = (host) => host.split('.').slice(-2).join('.');
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${label}`)), ms))]);

// Exécuté dans la page : parcourt aussi les shadow DOM ouverts.
function pageProbe() {
  const all = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); }
  };
  walk(document);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && parseFloat(st.opacity || '1') > 0.05;
  };
  const txt = (el) => (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
  const bannerHint = /cookie|consent|traceur|cmp|gdpr|rgpd|tarteaucitron|axeptio|didomi|onetrust|privacy/i;
  const strong = /tout accepter|accepter et fermer|accepter (les|tous les) cookies|continuer sans accepter|tout refuser|refuser (les|tous les) cookies|accept all|reject all|param[ée]trer les cookies|personnaliser mes choix/i;
  const inBanner = (el) => {
    let n = el;
    for (let i = 0; i < 7 && n; i++) {
      const sig = `${n.id || ''} ${typeof n.className === 'string' ? n.className : ''}`;
      if (bannerHint.test(sig)) return true;
      const t = n.innerText || '';
      if (t.length < 3000 && /cookies?|traceurs/i.test(t)) return true;
      n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
    }
    return false;
  };
  const links = [];
  const bannerButtons = [];
  const forms = [];
  for (const el of all) {
    const tag = el.tagName;
    if (tag === 'A' && el.href && /^https?:/i.test(el.href)) links.push({ text: txt(el).slice(0, 120), href: el.href });
    if ((tag === 'BUTTON' || tag === 'A' || el.getAttribute('role') === 'button' || (tag === 'INPUT' && /button|submit/.test(el.type))) && visible(el)) {
      const t = txt(el);
      if (t && t.length <= 60 && (inBanner(el) || strong.test(t))) bannerButtons.push(t);
    }
    if (tag === 'FORM') {
      const personal = el.querySelector('input[type=email],input[type=tel],input[name*=mail i],input[name*=phone i],input[name*=tel i],input[name*=nom i],textarea');
      const isSearch = el.getAttribute('role') === 'search' || !!el.querySelector('input[type=search]');
      const isLogin = !!el.querySelector('input[type=password]');
      const around = ((el.innerText || '') + ' ' + ((el.parentElement && el.parentElement.innerText) || '')).slice(0, 6000);
      forms.push({
        collectsPersonalData: !!personal && !isSearch && !isLogin,
        hasNotice: /confidentialit|donn[ée]es personnelles|rgpd|vie priv|privacy|d[ée]sinscri|protection des donn/i.test(around),
      });
    }
  }
  const gen = document.querySelector('meta[name=generator]');
  const html = document.documentElement.outerHTML.slice(0, 1_500_000);
  return {
    title: document.title.slice(0, 200),
    lang: document.documentElement.getAttribute('lang') || '',
    links: links.slice(0, 1500),
    bannerButtons: bannerButtons.slice(0, 60),
    forms,
    generator: gen ? (gen.getAttribute('content') || '').slice(0, 100) : '',
    text: (document.body ? document.body.innerText : '').slice(0, 60_000),
    html,
  };
}

const ACCEPT = /accepte|accepter|j.accepte|tout accepter|ok pour moi|d.accord|autoriser|accept|agree|allow|compris|^ok$/i;
const REFUSE = /refuse|refuser|tout refuser|continuer sans accepter|rejeter|non merci|decline|reject|deny|interdire|n[ée]cessaires? uniquement|essentiels? uniquement|only necessary/i;
const ECOMMERCE = /ajouter au panier|add to cart|mon panier|votre panier|woocommerce|cdn\.shopify\.com|prestashop|\/cart\b|\/panier\b|magento|product-price|"@type"\s*:\s*"Product"/i;

async function probeHttp(url) {
  // La version http:// redirige-t-elle vers https:// ?
  try {
    const httpUrl = new URL(url.href);
    httpUrl.protocol = 'http:';
    httpUrl.port = '';
    if (!(await isPublicHost(httpUrl.hostname))) return 'unknown';
    const r = await fetch(httpUrl, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'user-agent': UA } });
    const loc = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400) return /^https:/i.test(loc) ? 'https' : 'other';
    return 'none';
  } catch { return 'unknown'; }
}

async function probeSecurityTxt(url) {
  try {
    const r = await fetch(new URL('/.well-known/security.txt', url.origin), { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { 'user-agent': UA } });
    if (r.status !== 200) return false;
    const t = (await r.text()).slice(0, 2000);
    return /contact:/i.test(t);
  } catch { return null; }
}

export async function collect(inputUrl, { shotDir, shotName } = {}) {
  const url = await assertPublicUrl(inputUrl);
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: UA, locale: 'fr-FR', timezoneId: 'Europe/Paris',
    viewport: { width: 1366, height: 850 }, ignoreHTTPSErrors: false,
    extraHTTPHeaders: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.5' },
  });
  context.setDefaultTimeout(15_000);
  const requests = [];
  const mixed = new Set();
  let totalBytes = 0;
  try {
    await context.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (!['http:', 'https:'].includes(u.protocol)) return route.continue();
      if (!(await isPublicHost(u.hostname))) return route.abort('blockedbyclient');
      return route.continue();
    });
    const page = await context.newPage();
    let pageHost = url.hostname;
    page.on('request', (req) => {
      try {
        const u = new URL(req.url());
        if (!['http:', 'https:'].includes(u.protocol)) return;
        requests.push({ url: req.url().slice(0, 500), host: u.hostname, type: req.resourceType(), thirdParty: siteOf(u.hostname) !== siteOf(pageHost) });
        if (u.protocol === 'http:' && page.url().startsWith('https:') && req.resourceType() !== 'document') mixed.add(u.origin + u.pathname.slice(0, 80));
      } catch { /* ignore */ }
    });
    page.on('requestfinished', async (req) => {
      try { const sz = await req.sizes(); totalBytes += sz.responseBodySize + sz.responseHeadersSize; } catch { /* ignore */ }
    });
    page.on('dialog', (d) => d.dismiss().catch(() => {}));

    const t0 = Date.now();
    let response;
    try {
      response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    } catch (e) {
      const m = String(e.message || e);
      if (/ERR_NAME_NOT_RESOLVED/.test(m)) throw new TargetError('Nom de domaine introuvable.');
      if (/ERR_CERT|SSL/.test(m)) throw new TargetError('Le certificat HTTPS du site est invalide : le site est inaccessible de façon sécurisée.');
      if (/Timeout|ERR_TIMED_OUT/i.test(m)) throw new TargetError('Le site met trop de temps à répondre.');
      if (/ERR_CONNECTION|ERR_ADDRESS|blockedbyclient|ERR_BLOCKED/i.test(m)) throw new TargetError('Impossible de se connecter à ce site.');
      throw new TargetError('Le site n’a pas pu être chargé.');
    }
    if (!response) throw new TargetError('Le site n’a renvoyé aucune réponse.');
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
    const loadMs = Date.now() - t0;
    await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => {});
    await page.waitForTimeout(2500); // laisse le temps au bandeau et aux balises différées
    pageHost = new URL(page.url()).hostname;
    for (const r of requests) r.thirdParty = siteOf(r.host) !== siteOf(pageHost);

    const status = response.status();
    const headers = response.headers();
    const finalUrl = page.url();
    if (status >= 400 && status !== 403 && status !== 401) throw new TargetError(`Le site répond avec une erreur (code ${status}).`);

    // Sonde DOM (page principale + iframes pour les bandeaux en iframe)
    const probe = await page.evaluate(pageProbe);
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        const sub = await withTimeout(frame.evaluate(pageProbe), 3000, 'frame');
        probe.bannerButtons.push(...sub.bannerButtons);
        if (/consent|cookie|cmp|privacy/i.test(frame.url())) probe.html += ' ' + frame.url();
      } catch { /* iframe inaccessible */ }
    }
    if (status === 403 || status === 401 || /just a moment|attention required|access denied|captcha/i.test(probe.title) && probe.text.length < 1500) {
      throw new TargetError('Le site bloque les visites automatisées (protection anti-robot) : audit impossible.');
    }

    const haystack = probe.html + ' ' + requests.map((r) => r.url).join(' ');
    const cmp = CMPS.find((c) => c.re.test(haystack));
    const hasAccept = probe.bannerButtons.some((t) => ACCEPT.test(t) && !REFUSE.test(t));
    const hasRefuse = probe.bannerButtons.some((t) => REFUSE.test(t));
    const banner = {
      detected: hasAccept || hasRefuse || (!!cmp && probe.bannerButtons.length > 0),
      cmp: cmp ? cmp.name : null, hasAccept, hasRefuse,
      persistentControl: /tarteaucitronManager|axeptio_overlay|didomi-notice|ot-sdk-btn|cky-btn-revisit|cmplz-manage-consent|cookie-settings|cookies?-preferences/i.test(probe.html),
    };

    let screenshot = null;
    if (shotDir && shotName) {
      try {
        fs.mkdirSync(shotDir, { recursive: true });
        await page.screenshot({ path: path.join(shotDir, shotName), type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: 1366, height: 850 } });
        screenshot = shotName;
      } catch { /* capture facultative */ }
    }

    // Accessibilité (axe-core)
    const axe = { violations: [], error: null };
    try {
      const res = await withTimeout(new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze(), 25_000, 'axe');
      axe.violations = res.violations.map((v) => {
        const fr = axeFr.rules[v.id] || {};
        return {
          id: v.id, impact: v.impact || 'minor',
          help: fr.help || v.help, description: fr.description || v.description,
          nodes: v.nodes.length,
          sample: v.nodes[0] ? String(v.nodes[0].html || '').replace(/\s+/g, ' ').slice(0, 140) : '',
          wcag: v.tags.filter((t) => /^wcag\d{3,4}$/.test(t)).map((t) => t.slice(4).split('').join('.')),
        };
      });
    } catch (e) { axe.error = String(e.message || e).slice(0, 200); }

    const cookies = (await context.cookies()).map((c) => ({
      name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
      thirdParty: siteOf(c.domain.replace(/^\./, '')) !== siteOf(pageHost),
    }));

    // Page de mentions légales (même site uniquement)
    let legalPage = null;
    const legalRe = /mentions?[\s\-_]*l[ée]gales?|informations?[\s\-_]*l[ée]gales?|legal[\s\-_]*notice|\bimpressum\b|\/legal\b/i;
    const cand = probe.links.find((l) => legalRe.test(l.text)) || probe.links.find((l) => { try { return legalRe.test(decodeURIComponent(l.href)); } catch { return false; } });
    if (cand) {
      try {
        const lu = new URL(cand.href);
        if (siteOf(lu.hostname) === siteOf(pageHost)) {
          const lp = await context.newPage();
          await lp.goto(lu.href, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          await lp.waitForTimeout(800);
          const text = await lp.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 80_000));
          legalPage = { url: lu.href, text };
          await lp.close();
        }
      } catch { legalPage = { url: cand.href, text: '' }; }
    }

    const [httpRedirect, securityTxt] = await Promise.all([
      finalUrl.startsWith('https:') ? probeHttp(new URL(finalUrl)) : Promise.resolve('n/a'),
      probeSecurityTxt(new URL(finalUrl)),
    ]);

    return {
      inputUrl: url.href, finalUrl, status, https: finalUrl.startsWith('https:'), headers,
      title: probe.title, lang: probe.lang, links: probe.links, forms: probe.forms,
      generator: probe.generator, text: probe.text, banner,
      ecommerce: ECOMMERCE.test(probe.html),
      cookies, requests, axe, legalPage, httpRedirect, securityTxt,
      mixedContent: [...mixed], totalBytes, loadMs, screenshot,
      scannedAt: new Date().toISOString(),
    };
  } finally {
    await context.close().catch(() => {});
  }
}

export async function scanSite(inputUrl, opts) {
  const snapshot = await collect(inputUrl, opts);
  return analyze(snapshot);
}

export { TargetError };
