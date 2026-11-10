import crypto from 'node:crypto';
import { db, newId } from './db.js';
import { config } from './config.js';

const COOKIE = 'sid';
const WEEK = 7 * 24 * 3600 * 1000;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);

export function createUser(email, password, agencyName = '') {
  const info = db.prepare('INSERT INTO users (email, pass_hash, agency_name, widget_key) VALUES (?,?,?,?)')
    .run(email.toLowerCase().trim(), hashPassword(password), agencyName.trim().slice(0, 80), newId(12));
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function startSession(res, userId) {
  const token = newId(32);
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, Date.now() + 4 * WEEK);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: 4 * WEEK, path: '/' });
}
export function endSession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE, { path: '/' });
}

export function sessionMiddleware(req, _res, next) {
  req.user = null;
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) {
    const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?').get(token, Date.now());
    if (row) req.user = row;
  }
  next();
}
export function requireUser(req, res, next) {
  if (!req.user) return res.redirect('/connexion?next=' + encodeURIComponent(req.originalUrl));
  next();
}

// Protection CSRF : les requêtes qui modifient l'état doivent venir de notre origine.
export function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : '');
  const allowed = [config.baseUrl, `${req.protocol}://${req.headers.host}`];
  if (!origin || !allowed.includes(origin)) return res.status(403).send('Requête refusée (origine invalide).');
  next();
}

// Limiteur de débit en mémoire (fenêtre glissante simple).
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(key, arr); return false; }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 20000) for (const [k, v] of buckets) if (!v.some((t) => now - t < 24 * 3600 * 1000)) buckets.delete(k);
  return true;
}
