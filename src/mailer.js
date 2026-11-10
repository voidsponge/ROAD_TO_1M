import nodemailer from 'nodemailer';
import { config } from './config.js';

let transport = null;
if (config.smtp.host) {
  transport = nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}
export const mailEnabled = () => !!transport;

export async function sendMail({ to, subject, text }) {
  if (!transport) { console.log(`[mail non configuré] à ${to} — ${subject}\n${text}`); return false; }
  try {
    await transport.sendMail({ from: config.smtp.from || config.smtp.user, to, subject, text });
    return true;
  } catch (e) { console.error('[mail] échec', e.message); return false; }
}
