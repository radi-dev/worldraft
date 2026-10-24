import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import dns from 'node:dns';

test('offline runner rejects external HTTP before making a request', async () => {
  await assert.rejects(fetch('https://example.invalid'), /blocked external host/);
});
test('offline runner rejects external TCP and DNS', () => {
  assert.throws(() => net.connect({ host: '203.0.113.1', port: 80 }), /blocked external host/);
  assert.throws(() => dns.lookup('example.invalid', () => {}), /blocked external host/);
});
