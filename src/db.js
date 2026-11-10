import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
// SQLite intégré à Node : aucune dépendance native à compiler.
export const db = new DatabaseSync(path.join(config.dataDir, 'app.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  agency_name TEXT NOT NULL DEFAULT '',
  logo TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#1d4ed8',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_sub_id TEXT,
  widget_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reset_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  score INTEGER,
  result TEXT,
  source TEXT NOT NULL DEFAULT 'web',
  monitor_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS audits_user ON audits(user_id, created_at);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  url TEXT NOT NULL,
  audit_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS monitors (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  last_audit_id TEXT,
  last_score INTEGER,
  next_run INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, url)
);
`);

export const newId = (bytes = 9) => crypto.randomBytes(bytes).toString('base64url');

export function auditsThisMonth(userId) {
  return db.prepare(`SELECT COUNT(*) n FROM audits WHERE user_id = ? AND source != 'monitor' AND created_at >= datetime('now','start of month')`).get(userId).n;
}

export function getAudit(id) {
  const a = db.prepare('SELECT * FROM audits WHERE id = ?').get(id);
  if (a && a.result) a.result = JSON.parse(a.result);
  return a;
}
