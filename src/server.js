import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { config, PLANS } from './config.js';
import { db, newId, getAudit, auditsThisMonth } from './db.js';
import {
  sessionMiddleware, requireUser, sameOrigin, rateLimit, createUser, verifyPassword,
  hashPassword, startSession, endSession, validEmail,
} from './auth.js';
import { createAudit, resumePending, runDueMonitors, queueDepth, shotDir } from './queue.js';
import { normalizeUrl, TargetError } from './scanner/ssrf.js';
import { getBrowser, closeBrowser } from './scanner/collect.js';
import { billingEnabled, createCheckout, createPortal, handleWebhook, stripe } from './billing.js';
import { sendMail } from './mailer.js';
import * as V from './views.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// En-têtes de sécurité (on applique ce que l'on recommande).
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  res.set({
    'Content-Security-Policy': `default-src 'self'; img-src 'self' data:; style-src 'self' 'nonce-${res.locals.nonce}'; script-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://checkout.stripe.com https://billing.stripe.com; object-src 'none'`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (config.production) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Webhook Stripe : corps brut requis pour vérifier la signature.
app.post('/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  if (!stripe || !config.stripe.webhookSecret) return res.status(503).send('Paiement non configuré');
  try {
    await handleWebhook(req.body, req.headers['stripe-signature']);
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook]', err.message);
    res.status(400).send('Signature invalide');
  }
});

app.use('/static', express.static(path.join(config.root, 'public'), {
  maxAge: config.production ? '1h' : 0,
  setHeaders: (res, file) => { if (file.endsWith('widget.js')) res.set({ 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' }); },
}));
app.use('/shots', express.static(shotDir, { maxAge: '7d' }));
app.use(express.urlencoded({ extended: false, limit: '400kb' }));
app.use(express.json({ limit: '20kb' }));
app.use(sessionMiddleware);

const html = (res, page, status = 200) => res.status(status).type('html').send(page);
const cors = (res) => res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
const planOf = (user) => PLANS[user.plan] || PLANS.free;

// ---------- API publique (widget) : CORS ouvert, pas de cookie ----------
app.options('/api/*', (_req, res) => cors(res).sendStatus(204));

app.get('/api/audits/:id/status', (req, res) => {
  cors(res);
  const a = db.prepare('SELECT id, status, score, error FROM audits WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Audit introuvable.' });
  res.set('Cache-Control', 'no-store').json({ status: a.status, score: a.score, error: a.status === 'error' ? a.error : null, reportUrl: `${config.baseUrl}/r/${a.id}` });
});

app.post('/api/widget/:key/audit', (req, res) => {
  cors(res);
  const owner = db.prepare('SELECT * FROM users WHERE widget_key = ?').get(req.params.key);
  if (!owner) return res.status(404).json({ error: 'Widget inconnu.' });
  if (!planOf(owner).whiteLabel) return res.status(402).json({ error: 'Ce formulaire est momentanément indisponible.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!validEmail(email)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  let url;
  try { url = normalizeUrl(req.body.url); } catch (err) { return res.status(400).json({ error: err.message }); }
  if (!rateLimit(`widget:${req.ip}`, 5, 3600_000)) return res.status(429).json({ error: 'Trop de demandes. Réessayez dans une heure.' });
  if (auditsThisMonth(owner.id) >= planOf(owner).audits || queueDepth() > 40) return res.status(429).json({ error: 'Service momentanément indisponible. Réessayez plus tard.' });
  const id = createAudit({ url: url.href, userId: owner.id, source: 'widget' });
  db.prepare('INSERT INTO leads (user_id, email, url, audit_id) VALUES (?,?,?,?)').run(owner.id, email, url.href, id);
  res.json({ id, statusUrl: `${config.baseUrl}/api/audits/${id}/status`, reportUrl: `${config.baseUrl}/r/${id}` });
});

// ---------- Tout le reste : même origine obligatoire pour les écritures ----------
app.use(sameOrigin);

app.get('/', (req, res) => html(res, V.homePage({ user: req.user, error: req.query.e })));
app.get('/healthz', (_req, res) => res.json({ ok: true, queue: queueDepth() }));
app.get('/robots.txt', (_req, res) => res.type('text').send(`User-agent: *\nDisallow: /r/\nDisallow: /compte/\nDisallow: /tableau-de-bord\nSitemap: ${config.baseUrl}/sitemap.xml\n`));
app.get('/sitemap.xml', (_req, res) => res.type('xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/mentions-legales', '/confidentialite', '/cgv', '/accessibilite'].map((p) => `<url><loc>${config.baseUrl}${p}</loc></url>`).join('')}</urlset>`));
for (const kind of ['mentions-legales', 'confidentialite', 'cgv', 'accessibilite']) {
  app.get('/' + kind, (req, res) => html(res, V.legalPage(kind, req.user)));
}

// ---------- Audits ----------
app.post('/audit', (req, res) => {
  const back = (msg) => res.redirect((req.user ? '/tableau-de-bord' : '/') + '?e=' + encodeURIComponent(msg));
  let url;
  try { url = normalizeUrl(req.body.url); } catch (err) { return back(err instanceof TargetError ? err.message : 'Adresse invalide.'); }
  if (queueDepth() > 40) return back('Beaucoup d’audits sont en cours. Réessayez dans une minute.');
  if (req.user) {
    const plan = planOf(req.user);
    if (auditsThisMonth(req.user.id) >= plan.audits) return back(`Quota mensuel atteint (${plan.audits} audits). Passez au plan supérieur pour continuer.`);
    return res.redirect('/r/' + createAudit({ url: url.href, userId: req.user.id, source: 'dashboard' }));
  }
  if (!rateLimit(`anon:${req.ip}`, config.anonDailyScans, 24 * 3600_000)) {
    return back(`Limite de ${config.anonDailyScans} audits gratuits par jour atteinte. Créez un compte gratuit pour continuer.`);
  }
  res.redirect('/r/' + createAudit({ url: url.href }));
});

app.get('/r/:id', (req, res) => {
  const audit = getAudit(req.params.id);
  if (!audit) return html(res, V.errorPage({ status: 404, message: 'Ce rapport n’existe pas ou a été supprimé.', user: req.user }), 404);
  const owner = audit.user_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(audit.user_id) : null;
  res.set('Cache-Control', 'no-store');
  html(res, V.reportPage({ audit, owner, viewer: req.user, nonce: res.locals.nonce, print: req.query.print === '1' }));
});

const pdfDir = path.join(config.dataDir, 'pdf');
app.get('/r/:id/pdf', async (req, res, next) => {
  try {
    const audit = getAudit(req.params.id);
    if (!audit || audit.status !== 'done') return html(res, V.errorPage({ status: 404, message: 'Rapport indisponible.', user: req.user }), 404);
    const owner = audit.user_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(audit.user_id) : null;
    if (!owner || !planOf(owner).whiteLabel) return res.redirect('/r/' + audit.id);
    if (!rateLimit(`pdf:${req.ip}`, 30, 3600_000)) return res.status(429).send('Trop de demandes.');
    fs.mkdirSync(pdfDir, { recursive: true });
    const file = path.join(pdfDir, `${audit.id}.pdf`);
    const browser = await getBrowser();
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${config.port}/r/${audit.id}?print=1`, { waitUntil: 'networkidle', timeout: 20_000 });
      await page.pdf({ path: file, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
    } finally { await ctx.close(); }
    res.download(file, `audit-conformite-${audit.host}.pdf`);
  } catch (err) { next(err); }
});

app.post('/audit/:id/supprimer', requireUser, (req, res) => {
  const r = db.prepare('DELETE FROM audits WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (r.changes) for (const f of [path.join(shotDir, `${req.params.id}.jpg`), path.join(pdfDir, `${req.params.id}.pdf`)]) fs.rm(f, { force: true }, () => {});
  res.redirect('/tableau-de-bord?ok=' + encodeURIComponent('Audit supprimé.'));
});

// ---------- Comptes ----------
app.get('/inscription', (req, res) => req.user ? res.redirect('/tableau-de-bord') : html(res, V.authPage({ mode: 'signup', audit: req.query.audit || '', plan: req.query.plan || '' })));
app.post('/inscription', (req, res) => {
  const { email = '', password = '', agency = '', audit = '', plan = '' } = req.body;
  const fail = (error) => html(res, V.authPage({ mode: 'signup', error, values: { email, agency }, audit, plan }), 400);
  if (!rateLimit(`signup:${req.ip}`, 5, 3600_000)) return fail('Trop de tentatives. Réessayez plus tard.');
  if (!validEmail(email.trim())) return fail('Adresse e-mail invalide.');
  if (password.length < 10 || password.length > 200) return fail('Le mot de passe doit contenir au moins 10 caractères.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase().trim())) return fail('Un compte existe déjà avec cette adresse. Connectez-vous.');
  const user = createUser(email, password, agency);
  if (audit) db.prepare('UPDATE audits SET user_id = ? WHERE id = ? AND user_id IS NULL').run(user.id, String(audit));
  startSession(res, user.id);
  sendMail({ to: user.email, subject: `Bienvenue sur ${config.brand}`, text: `Bonjour,\n\nVotre compte ${config.brand} est créé. Vous disposez de ${PLANS.free.audits} audits gratuits par mois.\n\nTableau de bord : ${config.baseUrl}/tableau-de-bord\n\n— ${config.brand}` });
  res.redirect(PLANS[plan] && plan !== 'free' ? '/compte/abonnement' : audit ? '/r/' + encodeURIComponent(audit) : '/tableau-de-bord');
});

const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[\w\-./?=&%]*$/.test(n) ? n : '/tableau-de-bord');
app.get('/connexion', (req, res) => req.user ? res.redirect('/tableau-de-bord') : html(res, V.authPage({ mode: 'login', next: req.query.next || '' })));
app.post('/connexion', (req, res) => {
  const { email = '', password = '', next = '' } = req.body;
  const fail = (error) => html(res, V.authPage({ mode: 'login', error, values: { email }, next }), 400);
  if (!rateLimit(`login:${req.ip}`, 15, 900_000)) return fail('Trop de tentatives. Réessayez dans un quart d’heure.');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !verifyPassword(password, user.pass_hash)) return fail('E-mail ou mot de passe incorrect.');
  startSession(res, user.id);
  res.redirect(safeNext(next));
});
app.post('/deconnexion', (req, res) => { endSession(req, res); res.redirect('/'); });

app.get('/mot-de-passe-oublie', (req, res) => html(res, V.forgotPage({ sent: req.query.ok === '1' })));
app.post('/mot-de-passe-oublie', (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (rateLimit(`forgot:${req.ip}`, 5, 3600_000)) {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) {
      const token = newId(32);
      db.prepare('INSERT INTO reset_tokens (token, user_id, expires_at) VALUES (?,?,?)').run(token, user.id, Date.now() + 3600_000);
      sendMail({ to: user.email, subject: `[${config.brand}] Réinitialisation de votre mot de passe`, text: `Bonjour,\n\nPour choisir un nouveau mot de passe (lien valable 1 heure) :\n${config.baseUrl}/reinitialiser?token=${token}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.\n\n— ${config.brand}` });
    }
  }
  res.redirect('/mot-de-passe-oublie?ok=1');
});
app.get('/reinitialiser', (req, res) => html(res, V.resetPage({ token: String(req.query.token || '') })));
app.post('/reinitialiser', (req, res) => {
  const { token = '', password = '' } = req.body;
  const row = db.prepare('SELECT * FROM reset_tokens WHERE token = ? AND expires_at > ?').get(String(token), Date.now());
  if (!row) return html(res, V.resetPage({ token: '', error: 'Lien invalide ou expiré. Refaites une demande.' }), 400);
  if (password.length < 10 || password.length > 200) return html(res, V.resetPage({ token, error: 'Le mot de passe doit contenir au moins 10 caractères.' }), 400);
  db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(password), row.user_id);
  db.prepare('DELETE FROM reset_tokens WHERE user_id = ?').run(row.user_id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  startSession(res, row.user_id);
  res.redirect('/tableau-de-bord?ok=' + encodeURIComponent('Mot de passe mis à jour.'));
});

// ---------- Espace client ----------
app.get('/tableau-de-bord', requireUser, (req, res) => {
  const audits = db.prepare('SELECT id, url, host, status, score, error, source, created_at FROM audits WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 200').all(req.user.id);
  html(res, V.dashboardPage({ user: req.user, audits, used: auditsThisMonth(req.user.id), error: req.query.e, ok: req.query.ok }));
});

app.get('/compte/surveillance', requireUser, (req, res) => {
  const monitors = db.prepare('SELECT * FROM monitors WHERE user_id = ? ORDER BY host').all(req.user.id);
  html(res, V.monitorsPage({ user: req.user, monitors, error: req.query.e, ok: req.query.ok }));
});
app.post('/compte/surveillance', requireUser, (req, res) => {
  const back = (k, msg) => res.redirect(`/compte/surveillance?${k}=` + encodeURIComponent(msg));
  const plan = planOf(req.user);
  let url;
  try { url = normalizeUrl(req.body.url); } catch (err) { return back('e', err.message); }
  const count = db.prepare('SELECT COUNT(*) n FROM monitors WHERE user_id = ?').get(req.user.id).n;
  if (count >= plan.monitors) return back('e', `Limite de ${plan.monitors} sites surveillés atteinte pour votre plan.`);
  const host = url.hostname.replace(/^www\./, '');
  try {
    const info = db.prepare('INSERT INTO monitors (user_id, url, host, next_run) VALUES (?,?,?,?)').run(req.user.id, url.href, host, Date.now() + 30 * 24 * 3600_000);
    createAudit({ url: url.href, userId: req.user.id, source: 'monitor', monitorId: info.lastInsertRowid });
  } catch { return back('e', 'Ce site est déjà surveillé.'); }
  back('ok', `${host} est maintenant surveillé. Premier audit en cours.`);
});
app.post('/compte/surveillance/:id/supprimer', requireUser, (req, res) => {
  db.prepare('DELETE FROM monitors WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.redirect('/compte/surveillance?ok=' + encodeURIComponent('Site retiré de la surveillance.'));
});

const leadsOf = (userId) => db.prepare('SELECT l.*, a.score, a.host FROM leads l LEFT JOIN audits a ON a.id = l.audit_id WHERE l.user_id = ? ORDER BY l.created_at DESC, l.id DESC LIMIT 1000').all(userId);
app.get('/compte/widget', requireUser, (req, res) => html(res, V.widgetPage({ user: req.user, leads: leadsOf(req.user.id) })));
app.get('/compte/prospects.csv', requireUser, (req, res) => {
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const rows = leadsOf(req.user.id).map((l) => [l.created_at, l.email, l.url, l.score ?? '', l.audit_id ? `${config.baseUrl}/r/${l.audit_id}` : ''].map(cell).join(';'));
  res.attachment('prospects.csv').type('text/csv; charset=utf-8').send('﻿' + ['"date";"email";"site";"note";"rapport"', ...rows].join('\r\n'));
});

app.get('/compte/marque', requireUser, (req, res) => html(res, V.brandPage({ user: req.user, error: req.query.e, ok: req.query.ok })));
app.post('/compte/marque', requireUser, (req, res) => {
  const back = (k, msg) => res.redirect(`/compte/marque?${k}=` + encodeURIComponent(msg));
  const { agency = '', color = '', logo = '', cta_label = '', cta_url = '', remove_logo } = req.body;
  if (!/^#[0-9a-f]{6}$/i.test(color)) return back('e', 'Couleur invalide.');
  const link = cta_url.trim();
  if (link && !/^(https?:\/\/|mailto:)[^\s<>"']+$/i.test(link)) return back('e', 'Le lien du bouton doit commencer par https:// ou mailto:.');
  let newLogo = remove_logo ? '' : req.user.logo;
  if (logo) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo) || logo.length > 210_000) return back('e', 'Logo invalide ou trop lourd (150 Ko maximum, PNG, JPEG ou WebP).');
    newLogo = logo;
  }
  db.prepare('UPDATE users SET agency_name = ?, color = ?, logo = ?, cta_label = ?, cta_url = ? WHERE id = ?')
    .run(agency.trim().slice(0, 80), color, newLogo, cta_label.trim().slice(0, 60), link.slice(0, 300), req.user.id);
  fs.rm(pdfDir, { recursive: true, force: true }, () => {}); // les PDF en cache portent l'ancienne identité
  back('ok', 'Identité enregistrée.');
});

app.get('/compte/abonnement', requireUser, (req, res) => html(res, V.billingPage({ user: req.user, enabled: billingEnabled(), ok: req.query.ok === '1', error: req.query.e })));
app.post('/compte/abonnement/souscrire', requireUser, async (req, res) => {
  try { res.redirect(303, await createCheckout(req.user, String(req.body.plan))); }
  catch (err) { console.error('[checkout]', err.message); res.redirect('/compte/abonnement?e=' + encodeURIComponent('Le paiement est momentanément indisponible.')); }
});
app.post('/compte/abonnement/portail', requireUser, async (req, res) => {
  try { res.redirect(303, await createPortal(req.user)); }
  catch (err) { console.error('[portal]', err.message); res.redirect('/compte/abonnement?e=' + encodeURIComponent('Portail de facturation indisponible.')); }
});
app.post('/compte/supprimer', requireUser, async (req, res) => {
  try {
    if (stripe && req.user.stripe_sub_id) await stripe.subscriptions.cancel(req.user.stripe_sub_id);
  } catch (err) {
    console.error('[delete account] résiliation Stripe', err.message);
    return res.redirect('/compte/abonnement?e=' + encodeURIComponent('Impossible de résilier l’abonnement automatiquement. Résiliez-le d’abord via « Gérer mon abonnement ».'));
  }
  for (const a of db.prepare('SELECT id FROM audits WHERE user_id = ?').all(req.user.id)) {
    fs.rm(path.join(shotDir, `${a.id}.jpg`), { force: true }, () => {});
    fs.rm(path.join(pdfDir, `${a.id}.pdf`), { force: true }, () => {});
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  endSession(req, res);
  res.redirect('/');
});

// ---------- Erreurs ----------
app.use((req, res) => html(res, V.errorPage({ status: 404, message: 'Cette page n’existe pas.', user: req.user }), 404));
app.use((err, req, res, _next) => {
  if (err.type === 'entity.too.large') return html(res, V.errorPage({ status: 413, message: 'Fichier trop volumineux.', user: req.user }), 413);
  console.error('[erreur]', err);
  html(res, V.errorPage({ status: 500, message: 'Réessayez dans quelques instants.', user: req.user }), 500);
});

const server = app.listen(config.port, () => {
  console.log(`${config.brand} en écoute sur ${config.baseUrl} (port ${config.port})`);
  if (!billingEnabled()) console.log('· Stripe non configuré : les abonnements sont désactivés.');
  resumePending();
  runDueMonitors();
});
const hourly = setInterval(() => {
  runDueMonitors();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('DELETE FROM reset_tokens WHERE expires_at < ?').run(Date.now());
  // Les audits anonymes ne sont conservés que 30 jours.
  db.prepare("DELETE FROM audits WHERE user_id IS NULL AND created_at < datetime('now','-30 days')").run();
}, 3600_000);
hourly.unref();

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { server.close(); await closeBrowser(); process.exit(0); });
}
