import assert from "node:assert/strict";
import { test } from "node:test";
import net from "node:net";
import http from "node:http";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import {
  readConfig,
  assertPortFree,
  waitForReady,
  openBrowser,
} from "./dev.mjs";

test("missing uv gives install instructions before launching services", () => {
  const result = spawnSync(process.execPath, ["scripts/dev.mjs", "--no-open"], {
    env: { ...process.env, PATH: "/nonexistent/worldraft-tools" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /uv is missing from PATH/);
  assert.match(result.stderr, /docs\.astral\.sh\/uv/);
});

test("configuration rejects invalid and shared ports; respects no-open", () => {
  assert.equal(readConfig({}, ["--no-open"]).open, false);
  assert.equal(readConfig({ NO_OPEN: "1" }, []).open, false);
  assert.equal(readConfig({}, []).uiPort, 5173);
  assert.throws(() => readConfig({ API_PORT: "bad" }, []), /integer/);
  assert.throws(() => readConfig({ UI_PORT: "8000" }, []), /different/);
  assert.throws(() => readConfig({}, ["--typo"]), /Unknown option/);
});

test("occupied port reports an error without stopping its owner", async () => {
  const owner = net.createServer();
  owner.listen(0, "127.0.0.1");
  await once(owner, "listening");
  try {
    await assert.rejects(assertPortFree(owner.address().port), /occupied/);
    assert.ok(owner.listening);
  } finally {
    owner.close();
    await once(owner, "close");
  }
});

test("readiness waits for actual successful response and supports timeout", async () => {
  let ready = false;
  const server = http.createServer((_req, res) => {
    res.writeHead(ready ? 200 : 503);
    res.end("fixture");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    await assert.rejects(
      waitForReady(url, 100, new AbortController().signal),
      /timed out/,
    );
    ready = true;
    await waitForReady(url, 1000, new AbortController().signal);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(waitForReady(url, 1000, controller.signal), {
      name: "AbortError",
    });
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
});

test("missing browser executable produces a recoverable error", async () => {
  await assert.rejects(
    openBrowser("http://127.0.0.1:5173", {
      ...process.env,
      BROWSER: "/nonexistent/worldraft-browser",
    }),
    /ENOENT/,
  );
});

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { REGISTRY_FILE, isAlive, reclaimOrphans, writeRegistry, clearRegistry, ignoredDotenvVariables } from "./dev.mjs";

test(".env entries meant for the launcher are detected, nothing else is", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "worldraft-env-"));
  try {
    assert.deepEqual(ignoredDotenvVariables(root), [], "no file, no warning");
    await writeFile(
      path.join(root, ".env"),
      "# comment\nWORLDRAFT_PORT=8010\nAPI_PORT=8010\nexport UI_PORT = 5180\n  NO_OPEN=1\nNOT_API_PORT=1\n",
    );
    assert.deepEqual(ignoredDotenvVariables(root), ["API_PORT", "UI_PORT", "NO_OPEN"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function idleChild() {
  // A real process we own, in its own group like a launcher child would be.
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
    detached: process.platform !== "win32",
  });
  child.unref();
  return child;
}

test("orphan registry: reclaims only verified children of a dead launcher", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "worldraft-reg-"));
  const ours = idleChild();
  const notOurs = idleChild(); // a recycled PID running something else
  try {
    await mkdir(path.join(root, ".worldraft"), { recursive: true });
    await writeFile(
      path.join(root, REGISTRY_FILE),
      JSON.stringify({
        launcherPid: 2 ** 22 - 1, // certainly not alive
        services: [
          { label: "api", pid: ours.pid, marker: "uvicorn studio.main:app" },
          { label: "ui", pid: notOurs.pid, marker: "vite.js" },
          { label: "gone", pid: 2 ** 22 - 2, marker: "anything" },
        ],
      }),
    );
    const commandLine = (pid) => (pid === ours.pid ? "python uvicorn studio.main:app --port 1" : "unrelated-program");
    const logs = [];
    const reclaimed = await reclaimOrphans(root, { log: (m) => logs.push(m), commandLine });
    assert.deepEqual(reclaimed, ["api"]);
    assert.equal(isAlive(ours.pid), false, "our orphan was stopped");
    assert.equal(isAlive(notOurs.pid), true, "the unrelated process was left alone");
    assert.equal(existsSync(path.join(root, REGISTRY_FILE)), false, "registry removed");
    assert.match(logs.join("\n"), /orphaned \[api\].*previous session/);
  } finally {
    for (const child of [ours, notOurs]) if (isAlive(child.pid)) process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGKILL");
    await rm(root, { recursive: true, force: true });
  }
});

test("orphan registry: refuses to run beside a live launcher; tolerates garbage", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "worldraft-reg-"));
  try {
    writeRegistry(root, []);
    const written = JSON.parse(await readFile(path.join(root, REGISTRY_FILE), "utf8"));
    assert.equal(written.launcherPid, process.pid);
    // A registry owned by a different, still-running launcher (use our parent).
    await writeFile(path.join(root, REGISTRY_FILE), JSON.stringify({ launcherPid: process.ppid, services: [] }));
    await assert.rejects(reclaimOrphans(root, { log() {} }), /Another development session/);
    clearRegistry(root);
    assert.equal(existsSync(path.join(root, REGISTRY_FILE)), false);
    await writeFile(path.join(root, REGISTRY_FILE), "{not json");
    assert.deepEqual(await reclaimOrphans(root, { log() {} }), []);
    assert.equal(existsSync(path.join(root, REGISTRY_FILE)), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
