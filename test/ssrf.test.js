import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, normalizeUrl, isPublicHost, TargetError } from '../src/scanner/ssrf.js';

test('adresses privées reconnues', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '::ffff:7f00:1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '93.184.216.34', '2606:4700::1111']) assert.equal(isPrivateIp(ip), false, ip);
});

test('normalisation et refus des URL dangereuses', () => {
  assert.equal(normalizeUrl('exemple.fr').href, 'https://exemple.fr/');
  assert.equal(normalizeUrl('  http://Exemple.fr/page#x ').href, 'http://exemple.fr/page');
  for (const bad of ['', 'file:///etc/passwd', 'javascript:alert(1)', 'http://user:pw@exemple.fr', 'http://exemple.fr:8080', 'http://localhost', 'ftp://exemple.fr']) {
    assert.throws(() => normalizeUrl(bad), TargetError, bad);
  }
});

test('hôtes internes refusés sans résolution DNS', async () => {
  assert.equal(await isPublicHost('127.0.0.1'), false);
  assert.equal(await isPublicHost('169.254.169.254'), false);
  assert.equal(await isPublicHost('intranet.local'), false);
  assert.equal(await isPublicHost('[::1]'), false);
});
