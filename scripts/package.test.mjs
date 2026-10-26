// Offline unit tests for scripts/package.mjs: staging only, no build, no zip.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RELEASE_CONTENTS, stageRelease } from "./package.mjs";

async function fakeRepo(root) {
  const files = {
    "apps/studio/dist/index.html": "<title>ui</title>",
    "apps/studio/dist/assets/app.js": "js",
    "backend/pyproject.toml": "[project]",
    "backend/uv.lock": "lock",
    "backend/.python-version": "3.12",
    "backend/src/studio/main.py": "app",
    "backend/src/studio/__pycache__/main.cpython-312.pyc": "bytecode",
    "backend/src/studio/stray.pyc": "bytecode",
    "backend/tests/test_x.py": "tests are not shipped",
    "start.sh": "sh",
    "start.cmd": "cmd",
    "LICENSE": "MIT",
    "docs/getting-started.md": "# Hi",
    "node_modules/x/index.js": "never shipped",
    ".env": "SECRET=never shipped",
    ".env.example": "WORLDRAFT_PORT=8000",
  };
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.join(root, path.dirname(file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
}

test("release contains exactly what a user needs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "worldraft-pkg-"));
  try {
    await fakeRepo(root);
    const out = path.join(root, "release/worldraft-9.9.9");
    const files = stageRelease({ root, outDir: out, version: "9.9.9", commit: "abc123" });
    assert.deepEqual(files, [
      ".env.example",
      "LICENSE",
      "README.md",
      "apps/studio/dist/assets/app.js",
      "apps/studio/dist/index.html",
      "backend/.python-version",
      "backend/pyproject.toml",
      "backend/src/studio/main.py",
      "backend/uv.lock",
      "release.json",
      "start.cmd",
      "start.sh",
    ]);
    assert.equal(await readFile(path.join(out, "README.md"), "utf8"), "# Hi");
    const meta = JSON.parse(await readFile(path.join(out, "release.json"), "utf8"));
    assert.equal(meta.version, "9.9.9");
    assert.equal(meta.commit, "abc123");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("packaging refuses to run without a built UI", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "worldraft-pkg-"));
  try {
    await fakeRepo(root);
    await rm(path.join(root, "apps/studio/dist"), { recursive: true });
    assert.throws(
      () => stageRelease({ root, outDir: path.join(root, "release/x"), version: "0" }),
      /apps\/studio\/dist.*npm run build/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("every required release item exists in the real repository (except the build output)", () => {
  for (const item of RELEASE_CONTENTS) {
    if (item.from.endsWith("dist")) continue;
    assert.ok(item.required, item.from);
  }
});
