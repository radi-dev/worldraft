// Tests own fresh subprocesses; never discovers or signals another running studio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { assertPortFree } from './dev.mjs';

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function start(extraEnv = {}) {
  const apiPort = await freePort();
  let uiPort = await freePort();
  while (uiPort === apiPort) uiPort = await freePort();
  const child = spawn(process.execPath, ['scripts/dev.mjs'], {
    env: { ...process.env, API_PORT: String(apiPort), UI_PORT: String(uiPort), ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = once(child, 'exit');
  async function until(text) {
    const deadline = Date.now() + 20000;
    while (!output.includes(text)) {
      assert.ok(child.exitCode === null, output);
      assert.ok(Date.now() < deadline, `Missing ${text}:\n${output}`);
      await delay(100);
    }
  }
  async function stop() {
    child.kill('SIGINT');
    const result = await Promise.race([exited, delay(8000).then(() => { throw new Error(`Shutdown timeout:\n${output}`); })]);
    await assertPortFree(apiPort); await assertPortFree(uiPort);
    return result;
  }
  return { apiPort, uiPort, until, stop, output: () => output };
}

test('real services become ready before one browser request; SIGINT releases both ports', { skip: process.platform === 'win32' }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'worldraft-launcher-'));
  const browser = path.join(dir, 'browser.mjs');
  const logFile = path.join(dir, 'opened.txt');
  await writeFile(browser, '#!/usr/bin/env node\nimport { appendFileSync } from "node:fs";\nconst r = await fetch(process.argv[2]+"/api/health"); if (!r.ok) process.exit(1); appendFileSync(process.env.BROWSER_LOG, process.argv[2]+"\\n");\n');
  await chmod(browser, 0o755);
  const run = await start({ BROWSER: browser, BROWSER_LOG: logFile, NO_OPEN: '0' });
  try {
    await run.until('Browser open requested once.');
    const response = await fetch(`http://127.0.0.1:${run.uiPort}/api/health`);
    assert.equal((await response.json()).status, 'ok');
    assert.equal(await readFile(logFile, 'utf8'), `http://127.0.0.1:${run.uiPort}\n`);
  } finally {
    const [code] = await run.stop();
    assert.equal(code, 0, run.output());
    await rm(dir, { recursive: true });
  }
});

test('browser launch failure leaves both services working', async () => {
  const run = await start({ BROWSER: '/nonexistent/worldraft-browser', NO_OPEN: '0' });
  try {
    await run.until('Could not open browser:');
    assert.match(run.output(), /manually/);
    assert.equal((await fetch(`http://127.0.0.1:${run.uiPort}/api/health`)).status, 200);
  } finally { await run.stop(); }
});

test('an owned API process exiting stops the UI sibling', { skip: process.platform === 'win32' }, async () => {
  const run = await start({ NO_OPEN: '1' });
  try {
    await run.until('Ready —');
    const match = run.output().match(/Started reloader process \[(\d+)\]/);
    assert.ok(match, run.output());
    // This PID comes only from the fresh process spawned by this test.
    process.kill(Number(match[1]), 'SIGTERM');
    await run.until('api exited unexpectedly');
  } finally {
    const [code] = await run.stop();
    assert.equal(code, 1, run.output());
  }
});
