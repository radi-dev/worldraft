// Unit-test guard, not an OS firewall. Local fixture servers are allowed.
import net from 'node:net';
import dns from 'node:dns';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';

export function assertLocalHost(host = 'localhost') {
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(String(host)))
    throw new Error(`Offline unit test blocked external host: ${host}`);
}

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const first = normalized[0];
  if (typeof first === 'object' && first !== null) {
    if (!first.path) assertLocalHost(first.host ?? 'localhost');
  } else if (typeof first === 'number') {
    assertLocalHost(typeof normalized[1] === 'string' ? normalized[1] : 'localhost');
  }
  return connect.apply(this, args);
};

const lookup = dns.lookup;
dns.lookup = function (host, ...args) { assertLocalHost(host); return lookup.call(this, host, ...args); };
const promiseLookup = dns.promises.lookup;
dns.promises.lookup = async function (host, ...args) { assertLocalHost(host); return promiseLookup.call(this, host, ...args); };
for (const method of Object.keys(dns).filter(name => name.startsWith('resolve') || name === 'reverse')) {
  if (typeof dns[method] === 'function') dns[method] = () => { throw new Error('Offline unit test blocked DNS query'); };
  if (typeof dns.promises[method] === 'function') dns.promises[method] = async () => { throw new Error('Offline unit test blocked DNS query'); };
}
dgram.Socket.prototype.send = function () { throw new Error('Offline unit test blocked UDP send'); };
const fetchOnline = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url = new URL(input instanceof Request ? input.url : input);
  assertLocalHost(url.hostname);
  return fetchOnline(input, init);
};
syncBuiltinESMExports();
