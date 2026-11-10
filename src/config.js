// Configuration centralisée, lue depuis l'environnement.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

export const config = {
  root,
  brand: env.BRAND_NAME || 'Auditeo',
  port: int(env.PORT, 3000),
  baseUrl: (env.BASE_URL || `http://localhost:${int(env.PORT, 3000)}`).replace(/\/$/, ''),
  dataDir: env.DATA_DIR || path.join(root, 'data'),
  production: env.NODE_ENV === 'production',
  scanConcurrency: int(env.SCAN_CONCURRENCY, 2),
  anonDailyScans: int(env.ANON_DAILY_SCANS, 3),
  // Uniquement pour les tests locaux : autorise l'audit d'adresses privées.
  allowPrivateTargets: env.ALLOW_PRIVATE_TARGETS === '1',
  contactEmail: env.CONTACT_EMAIL || 'contact@example.com',
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    prices: { pro: env.STRIPE_PRICE_PRO || '', agency: env.STRIPE_PRICE_AGENCY || '' },
  },
  smtp: {
    host: env.SMTP_HOST || '',
    port: int(env.SMTP_PORT, 587),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || '',
  },
};

export const PLANS = {
  free: { id: 'free', name: 'Découverte', price: 0, audits: 5, monitors: 0, whiteLabel: false },
  pro: { id: 'pro', name: 'Pro', price: 39, audits: 150, monitors: 10, whiteLabel: true },
  agency: { id: 'agency', name: 'Agence', price: 89, audits: 600, monitors: 50, whiteLabel: true },
};
