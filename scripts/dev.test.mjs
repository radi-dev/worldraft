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

test("missing uv gives setup instructions before launching services", () => {
  const result = spawnSync(process.execPath, ["scripts/dev.mjs", "--no-open"], {
    env: { ...process.env, PATH: "/nonexistent/worldraft-tools" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /uv is missing from PATH/);
  assert.match(result.stderr, /uv sync --project backend --locked/);
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
