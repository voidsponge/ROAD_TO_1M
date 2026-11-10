import Stripe from 'stripe';
import { config, PLANS } from './config.js';
import { db } from './db.js';

export const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
export const billingEnabled = () => !!(stripe && config.stripe.prices.pro && config.stripe.prices.agency);

const planForPrice = (priceId) => Object.keys(config.stripe.prices).find((k) => config.stripe.prices[k] === priceId) || null;

export async function createCheckout(user, plan) {
  if (!billingEnabled() || !PLANS[plan] || plan === 'free') throw new Error('Paiement indisponible.');
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: config.stripe.prices[plan], quantity: 1 }],
    ...(user.stripe_customer_id ? { customer: user.stripe_customer_id } : { customer_email: user.email }),
    client_reference_id: String(user.id),
    subscription_data: { metadata: { user_id: String(user.id) } },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    ...(user.stripe_customer_id ? { customer_update: { name: 'auto', address: 'auto' } } : {}),
    locale: 'fr',
    success_url: `${config.baseUrl}/compte/abonnement?ok=1`,
    cancel_url: `${config.baseUrl}/compte/abonnement`,
  });
  return session.url;
}

export async function createPortal(user) {
  if (!stripe || !user.stripe_customer_id) throw new Error('Aucun abonnement.');
  const session = await stripe.billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${config.baseUrl}/compte/abonnement` });
  return session.url;
}

// Applique l'état d'un abonnement Stripe au compte utilisateur.
export function applySubscription(sub) {
  const active = ['active', 'trialing', 'past_due'].includes(sub.status);
  const priceId = sub.items && sub.items.data[0] && sub.items.data[0].price ? sub.items.data[0].price.id : null;
  const plan = active ? planForPrice(priceId) || 'free' : 'free';
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer && sub.customer.id;
  const userId = sub.metadata && sub.metadata.user_id ? Number(sub.metadata.user_id) : null;
  let user = customerId ? db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(customerId) : null;
  if (!user && userId) user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  db.prepare('UPDATE users SET plan = ?, stripe_customer_id = ?, stripe_sub_id = ? WHERE id = ?').run(plan, customerId, active ? sub.id : null, user.id);
  return true;
}

export async function handleWebhook(rawBody, signature) {
  const event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      if (s.mode === 'subscription' && s.client_reference_id) {
        db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(s.customer, Number(s.client_reference_id));
        if (s.subscription) applySubscription(await stripe.subscriptions.retrieve(s.subscription));
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      applySubscription(event.data.object);
      break;
    default:
  }
  return event.type;
}
