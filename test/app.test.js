import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'auditeo-test-'));
process.env.STRIPE_SECRET_KEY = 'sk_test_factice';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_factice';
process.env.STRIPE_PRICE_PRO = 'price_pro';
process.env.STRIPE_PRICE_AGENCY = 'price_agency';

const { db } = await import('../src/db.js');
const auth = await import('../src/auth.js');
const billing = await import('../src/billing.js');

test('mots de passe : hachage scrypt et vérification', () => {
  const h = auth.hashPassword('correct horse battery');
  assert.ok(h.startsWith('scrypt$'));
  assert.equal(auth.verifyPassword('correct horse battery', h), true);
  assert.equal(auth.verifyPassword('mauvais', h), false);
  assert.equal(auth.verifyPassword('x', 'n-importe-quoi'), false);
});

test('limiteur de débit', () => {
  assert.equal(auth.rateLimit('t1', 2, 60_000), true);
  assert.equal(auth.rateLimit('t1', 2, 60_000), true);
  assert.equal(auth.rateLimit('t1', 2, 60_000), false);
});

test('abonnement Stripe : activation, changement de plan, résiliation', () => {
  const user = auth.createUser('Client@Agence.fr', 'motdepasse-solide', 'Agence');
  assert.equal(user.email, 'client@agence.fr');
  const sub = (status, price) => ({ id: 'sub_1', status, customer: 'cus_1', metadata: { user_id: String(user.id) }, items: { data: [{ price: { id: price } }] } });
  const plan = () => db.prepare('SELECT plan, stripe_customer_id c, stripe_sub_id s FROM users WHERE id = ?').get(user.id);

  assert.equal(billing.applySubscription(sub('active', 'price_pro')), true);
  assert.deepEqual({ ...plan() }, { plan: 'pro', c: 'cus_1', s: 'sub_1' });
  billing.applySubscription({ ...sub('active', 'price_agency'), metadata: {} }); // retrouvé par identifiant client
  assert.equal(plan().plan, 'agency');
  billing.applySubscription(sub('canceled', 'price_agency'));
  assert.deepEqual({ ...plan() }, { plan: 'free', c: 'cus_1', s: null });
  assert.equal(billing.applySubscription({ ...sub('active', 'price_pro'), customer: 'cus_inconnu', metadata: {} }), false);
});

test('webhook Stripe : signature vérifiée', async () => {
  const user = auth.createUser('w@agence.fr', 'motdepasse-solide');
  const payload = JSON.stringify({
    id: 'evt_1', object: 'event', type: 'customer.subscription.updated',
    data: { object: { id: 'sub_9', status: 'active', customer: 'cus_9', metadata: { user_id: String(user.id) }, items: { data: [{ price: { id: 'price_pro' } }] } } },
  });
  const header = billing.stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_factice' });
  assert.equal(await billing.handleWebhook(Buffer.from(payload), header), 'customer.subscription.updated');
  assert.equal(db.prepare('SELECT plan FROM users WHERE id = ?').get(user.id).plan, 'pro');
  await assert.rejects(() => billing.handleWebhook(Buffer.from(payload), 't=1,v1=faux'));
});
