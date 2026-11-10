// Garde anti-SSRF : le scanner charge des URL fournies par des inconnus,
// il ne doit jamais pouvoir atteindre le réseau interne.
import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from '../config.js';

export class TargetError extends Error {}

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    if (v.startsWith('::ffff:')) return true; // forme hexadécimale d'une IPv4 mappée
    return /^(fc|fd|fe[89ab]|ff)/.test(v) || v.startsWith('64:ff9b:') || v.startsWith('2001:db8:');
  }
  return true;
}

export function normalizeUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new TargetError('Adresse du site manquante.');
  if (raw.length > 2000) throw new TargetError('Adresse trop longue.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
  let url;
  try { url = new URL(raw); } catch { throw new TargetError('Adresse du site invalide.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new TargetError('Seules les adresses http(s) sont acceptées.');
  if (url.username || url.password) throw new TargetError('Les adresses avec identifiants ne sont pas acceptées.');
  if (!config.allowPrivateTargets) {
    if (url.port && !['80', '443'].includes(url.port)) throw new TargetError('Port non standard refusé.');
    if (!url.hostname.includes('.')) throw new TargetError('Nom de domaine invalide.');
  }
  url.hash = '';
  return url;
}

const cache = new Map(); // hostname -> { ok, at }
const TTL = 60_000;

export async function isPublicHost(hostname) {
  if (config.allowPrivateTargets) return true;
  const host = hostname.replace(/^\[|\]$/g, '');
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL) return hit.ok;
  let ok = false;
  try {
    if (net.isIP(host)) ok = !isPrivateIp(host);
    else if (/(^|\.)(localhost|local|internal|lan|home|corp)$/i.test(host)) ok = false;
    else {
      const addrs = await dns.lookup(host, { all: true });
      ok = addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
    }
  } catch { ok = false; }
  if (cache.size > 5000) cache.clear();
  cache.set(host, { ok, at: Date.now() });
  return ok;
}

export async function assertPublicUrl(input) {
  const url = normalizeUrl(input);
  if (!(await isPublicHost(url.hostname))) {
    throw new TargetError('Ce site est introuvable ou n’est pas accessible publiquement.');
  }
  return url;
}
