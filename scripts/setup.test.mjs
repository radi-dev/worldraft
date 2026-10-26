// Offline unit tests for scripts/setup.mjs. They never install anything: the
// install paths are exercised against fake dependency sets in a temp directory.
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DEPENDENCY_SETS,
  TOOLS,
  dependencyStatus,
  ensureDependencies,
  hashInputs,
  parseMinimumVersion,
  readStamp,
  satisfiesMinimum,
  writeStamp,
} from "./setup.mjs";

test("engine ranges parse and compare like package.json engines", () => {
  assert.deepEqual(parseMinimumVersion(">=22.12.0"), [22, 12, 0]);
  assert.deepEqual(parseMinimumVersion("^22.12"), [22, 12, 0]);
  assert.deepEqual(parseMinimumVersion("22.x"), [22, 0, 0]);
  assert.equal(satisfiesMinimum("v22.12.0", [22, 12, 0]), true);
  assert.equal(satisfiesMinimum("22.21.0", [22, 12, 0]), true);
  assert.equal(satisfiesMinimum("24.0.0", [22, 12, 0]), true);
  assert.equal(satisfiesMinimum("22.11.9", [22, 12, 0]), false);
  assert.equal(satisfiesMinimum("20.19.0", [22, 12, 0]), false);
});

test("Node check reads the requirement from package.json engines", () => {
  const node = TOOLS.find((tool) => tool.name === "Node.js");
  assert.match(node.check({ root: path.resolve("."), env: process.env }), /requires >=22/);
});

test("missing uv reports an install hint instead of launching anything", () => {
  const result = spawnSync(process.execPath, ["scripts/setup.mjs", "--check"], {
    env: { ...process.env, PATH: "/nonexistent/worldraft-tools" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /uv is missing from PATH/);
  assert.match(result.stderr, /docs\.astral\.sh\/uv/);
});

test("unknown options are rejected", () => {
  const result = spawnSync(process.execPath, ["scripts/setup.mjs", "--typo"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option/);
});

test("dependency sets declare the contract the orchestrator relies on", () => {
  for (const set of DEPENDENCY_SETS) {
    assert.ok(set.name && set.stamp && set.fix, set.name);
    assert.ok(Array.isArray(set.inputs) && set.inputs.length, set.name);
    assert.equal(typeof set.verify, "function", set.name);
    assert.equal(typeof set.install, "function", set.name);
  }
});

test("stamp hash changes with lockfile content, not with timestamps", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "worldraft-setup-"));
  try {
    await writeFile(path.join(root, "lock"), "a");
    const first = hashInputs(root, ["lock"], { platform: "x" });
    assert.equal(first, hashInputs(root, ["lock"], { platform: "x" }));
    await writeFile(path.join(root, "lock"), "b");
    assert.notEqual(first, hashInputs(root, ["lock"], { platform: "x" }));
    await writeFile(path.join(root, "lock"), "a");
    assert.notEqual(first, hashInputs(root, ["lock"], { platform: "y" }));
    assert.notEqual(first, hashInputs(root, ["lock", "missing"], { platform: "x" }));
    writeStamp(root, "deep/dir/stamp.json", { hash: first });
    assert.equal(readStamp(root, "deep/dir/stamp.json").hash, first);
    assert.equal(readStamp(root, "nope.json"), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function fakeSet(root, { verifyResult = () => true } = {}) {
  const calls = [];
  return {
    calls,
    set: {
      name: "fake",
      inputs: ["lock"],
      stamp: "out/stamp.json",
      fix: "fake-install",
      verify: () => verifyResult(),
      async install() {
        calls.push("install");
        await mkdir(path.join(root, "out"), { recursive: true });
      },
    },
  };
}

test("lockfile-driven install: installs once, skips while unchanged, reinstalls on change", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "worldraft-setup-"));
  try {
    await writeFile(path.join(root, "lock"), "v1");
    const { set, calls } = fakeSet(root);
    const saved = DEPENDENCY_SETS.splice(0, DEPENDENCY_SETS.length, set);
    try {
      assert.equal(dependencyStatus(set, { root }).state, "stale");
      await ensureDependencies({ root, install: true });
      assert.deepEqual(calls, ["install"]);
      assert.equal(dependencyStatus(set, { root }).state, "ready");

      await ensureDependencies({ root, install: true });
      assert.deepEqual(calls, ["install"], "no reinstall while lockfile unchanged");

      await writeFile(path.join(root, "lock"), "v2");
      await assert.rejects(
        ensureDependencies({ root, install: false }),
        /Dependencies not ready: fake/,
      );
      assert.deepEqual(calls, ["install"], "--check never installs");

      await ensureDependencies({ root, install: true });
      assert.deepEqual(calls, ["install", "install"]);

      await ensureDependencies({ root, install: true, force: true });
      assert.deepEqual(calls, ["install", "install", "install"]);
    } finally {
      DEPENDENCY_SETS.splice(0, DEPENDENCY_SETS.length, ...saved);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a stamp does not mask a broken install; a failed verification is an error", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "worldraft-setup-"));
  try {
    await writeFile(path.join(root, "lock"), "v1");
    let healthy = true;
    const { set, calls } = fakeSet(root, { verifyResult: () => healthy });
    const saved = DEPENDENCY_SETS.splice(0, DEPENDENCY_SETS.length, set);
    try {
      await ensureDependencies({ root, install: true });
      healthy = false; // e.g. someone deleted node_modules/vite
      assert.equal(dependencyStatus(set, { root }).state, "broken");
      await assert.rejects(
        ensureDependencies({ root, install: true }),
        /failed verification.*fake-install/,
      );
      assert.deepEqual(calls, ["install", "install"]);
    } finally {
      DEPENDENCY_SETS.splice(0, DEPENDENCY_SETS.length, ...saved);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
