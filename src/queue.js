// File d'audits en mémoire : quelques navigateurs en parallèle, pas plus.
import path from 'node:path';
import { db, newId, getAudit } from './db.js';
import { config, PLANS } from './config.js';
import { scanSite, TargetError } from './scanner/collect.js';
import { sendMail } from './mailer.js';

const pending = [];
let running = 0;
export const shotDir = path.join(config.dataDir, 'shots');

export function createAudit({ url, userId = null, source = 'web', monitorId = null }) {
  const id = newId(9);
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* validé en amont */ }
  db.prepare('INSERT INTO audits (id, user_id, url, host, source, monitor_id) VALUES (?,?,?,?,?,?)').run(id, userId, url, host, source, monitorId);
  enqueue(id);
  return id;
}

export function enqueue(id) { pending.push(id); pump(); }
export const queueDepth = () => pending.length + running;

function pump() {
  while (running < config.scanConcurrency && pending.length) {
    const id = pending.shift();
    running++;
    run(id).catch((e) => console.error('[queue]', e)).finally(() => { running--; pump(); });
  }
}

async function run(id) {
  const audit = db.prepare('SELECT * FROM audits WHERE id = ?').get(id);
  if (!audit || audit.status === 'done') return;
  db.prepare("UPDATE audits SET status = 'running' WHERE id = ?").run(id);
  try {
    const result = await scanSite(audit.url, { shotDir, shotName: `${id}.jpg` });
    db.prepare("UPDATE audits SET status = 'done', score = ?, result = ?, host = ? WHERE id = ?").run(result.score, JSON.stringify(result), result.host, id);
    await afterDone(getAudit(id));
  } catch (e) {
    const msg = e instanceof TargetError ? e.message : 'Une erreur technique est survenue pendant l’audit. Réessayez dans quelques minutes.';
    if (!(e instanceof TargetError)) console.error('[scan]', audit.url, e);
    db.prepare("UPDATE audits SET status = 'error', error = ? WHERE id = ?").run(msg, id);
  }
}

async function afterDone(audit) {
  if (audit.source === 'monitor' && audit.monitor_id) {
    const m = db.prepare('SELECT * FROM monitors WHERE id = ?').get(audit.monitor_id);
    if (!m) return;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(m.user_id);
    db.prepare('UPDATE monitors SET last_audit_id = ?, last_score = ? WHERE id = ?').run(audit.id, audit.score, m.id);
    if (user && m.last_score !== null && audit.score <= m.last_score - 5) {
      await sendMail({
        to: user.email,
        subject: `[${config.brand}] ${m.host} : la note de conformité a baissé (${m.last_score} → ${audit.score})`,
        text: `Bonjour,\n\nLe site ${m.host} que vous surveillez est passé de ${m.last_score}/100 à ${audit.score}/100.\n\nRapport : ${config.baseUrl}/r/${audit.id}\n\n— ${config.brand}`,
      });
    }
  }
  if (audit.source === 'widget' && audit.user_id) {
    const lead = db.prepare('SELECT * FROM leads WHERE audit_id = ?').get(audit.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(audit.user_id);
    if (lead && user) {
      await sendMail({
        to: user.email,
        subject: `[${config.brand}] Nouveau prospect : ${audit.host} (${audit.score}/100)`,
        text: `Bonjour,\n\nUn visiteur de votre site vient de demander un audit.\n\nSite : ${audit.url}\nE-mail : ${lead.email}\nNote : ${audit.score}/100\n\nRapport : ${config.baseUrl}/r/${audit.id}\n\n— ${config.brand}`,
      });
    }
  }
}

// Au démarrage : reprend les audits interrompus.
export function resumePending() {
  const rows = db.prepare("SELECT id FROM audits WHERE status IN ('queued','running') AND created_at >= datetime('now','-1 day')").all();
  for (const r of rows) enqueue(r.id);
  db.prepare("UPDATE audits SET status = 'error', error = 'Audit interrompu.' WHERE status IN ('queued','running') AND created_at < datetime('now','-1 day')").run();
}

// Surveillance : relance chaque site suivi tous les 30 jours.
const MONTH = 30 * 24 * 3600 * 1000;
export function runDueMonitors() {
  const due = db.prepare('SELECT m.*, u.plan FROM monitors m JOIN users u ON u.id = m.user_id WHERE m.next_run <= ?').all(Date.now());
  for (const m of due) {
    db.prepare('UPDATE monitors SET next_run = ? WHERE id = ?').run(Date.now() + MONTH, m.id);
    if ((PLANS[m.plan] || PLANS.free).monitors > 0) createAudit({ url: m.url, userId: m.user_id, source: 'monitor', monitorId: m.id });
  }
}
