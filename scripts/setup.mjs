// Developer-mode environment setup: verify tools, install locked dependencies.
//
// Zero npm dependencies on purpose: this file must run before `npm ci` has ever
// happened. It never installs Node.js, Python or uv itself; it reports what is
// missing and how to install it, then stops. Installs are lockfile-driven: each
// dependency set records a hash of its inputs (lockfiles, manifests, platform)
// after a successful install, and is skipped while that hash is unchanged.
//
// Extending: see docs/setup.md. Most additions are a new entry in TOOLS or
// DEPENDENCY_SETS below; the wrappers and the dev launcher need no changes.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const STAMP_VERSION = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseMinimumVersion(range) {
  // Accepts the subset of semver ranges used in package.json "engines":
  // ">=22.12.0", ">=22.12", "22.x", "^22.12.0", "22". Returns [major, minor, patch].
  const match = String(range).match(/(\d+)(?:\.(\d+|x))?(?:\.(\d+|x))?/);
  if (!match) throw new Error(`Cannot parse version requirement "${range}".`);
  return [Number(match[1]), Number(match[2]) || 0, Number(match[3]) || 0];
}

export function satisfiesMinimum(version, minimum) {
  const actual = String(version)
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number(part) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((actual[i] ?? 0) > minimum[i]) return true;
    if ((actual[i] ?? 0) < minimum[i]) return false;
  }
  return true;
}

export function hashInputs(root, files, extra = {}) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ STAMP_VERSION, ...extra }));
  for (const file of files) {
    const full = path.join(root, file);
    hash.update(`\n--- ${file}\n`);
    if (existsSync(full)) hash.update(readFileSync(full));
    else hash.update("<missing>");
  }
  return hash.digest("hex");
}

export function readStamp(root, stampFile) {
  try {
    return JSON.parse(readFileSync(path.join(root, stampFile), "utf8"));
  } catch {
    return null;
  }
}

export function writeStamp(root, stampFile, data) {
  const full = path.join(root, stampFile);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(
    full,
    JSON.stringify({ ...data, writtenAt: new Date().toISOString() }, null, 2),
  );
}

function npmInvocation(args) {
  // Prefer running npm's CLI through the current Node binary: no shell, no PATH
  // lookup, and identical behaviour on Windows (where `npm` is a .cmd file).
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    path.join(
      path.dirname(process.execPath),
      "../lib/node_modules/npm/bin/npm-cli.js",
    ),
  ].filter(Boolean);
  const cli = candidates.find((file) => /npm-cli\.js$/.test(file) && existsSync(file));
  if (cli) return { command: process.execPath, args: [cli, ...args], shell: false };
  // Fallback: arguments are constants from this file, never user input.
  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args,
    shell: process.platform === "win32",
  };
}

function runStreaming({ command, args, shell = false }, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${path.basename(command)} ${args.filter((a) => !a.endsWith("npm-cli.js")).join(" ")} failed (${signal ?? `exit code ${code}`}).`,
            ),
          ),
    );
  });
}

function platformInfo() {
  return { platform: process.platform, arch: process.arch };
}

// ---------------------------------------------------------------------------
// TOOLS: things the user must install themselves. Each check returns a short
// version string on success or throws an Error whose message says how to fix it.
// ---------------------------------------------------------------------------

const UV_INSTALL_HINT = {
  win32:
    "Install uv: winget install --id=astral-sh.uv -e  (or see https://docs.astral.sh/uv/getting-started/installation/)",
  darwin:
    "Install uv: brew install uv  (or see https://docs.astral.sh/uv/getting-started/installation/)",
  linux:
    "Install uv: see https://docs.astral.sh/uv/getting-started/installation/ (pipx install uv also works)",
};

export const TOOLS = [
  {
    name: "Node.js",
    check({ root }) {
      const engines = JSON.parse(
        readFileSync(path.join(root, "package.json"), "utf8"),
      ).engines?.node;
      const minimum = parseMinimumVersion(engines ?? ">=22.12.0");
      if (!satisfiesMinimum(process.versions.node, minimum))
        throw new Error(
          `Node.js ${minimum.join(".")}+ is required; this is ${process.versions.node}. Install the current Node.js 22 LTS from https://nodejs.org/ (see .nvmrc).`,
        );
      return `v${process.versions.node} (requires ${engines ?? ">=22.12.0"})`;
    },
  },
  {
    name: "uv",
    check({ env }) {
      const result = spawnSync("uv", ["--version"], { env, encoding: "utf8" });
      if (result.error || result.status !== 0)
        throw new Error(
          `uv is missing from PATH. ${UV_INSTALL_HINT[process.platform] ?? UV_INSTALL_HINT.linux} Then open a new terminal and retry.`,
        );
      return result.stdout.trim().replace(/^uv\s+/, "v");
    },
  },
];

// ---------------------------------------------------------------------------
// DEPENDENCY_SETS: things this script installs from lockfiles. `inputs` decide
// when a reinstall is needed; `verify` confirms an install is usable; `install`
// runs the locked installer with live output.
// ---------------------------------------------------------------------------

export const DEPENDENCY_SETS = [
  {
    name: "frontend (npm)",
    inputs: ["package.json", "package-lock.json", "apps/studio/package.json"],
    stamp: "node_modules/.worldraft-setup-stamp.json",
    extra: () => ({ ...platformInfo(), nodeMajor: process.versions.node.split(".")[0] }),
    verify({ root }) {
      return existsSync(path.join(root, "node_modules/vite/bin/vite.js"));
    },
    install({ root, env }) {
      return runStreaming(npmInvocation(["ci", "--no-audit", "--no-fund"]), {
        cwd: root,
        env,
      });
    },
    fix: "npm ci",
  },
  {
    name: "backend (uv)",
    inputs: ["backend/pyproject.toml", "backend/uv.lock", "backend/.python-version"],
    stamp: "backend/.venv/.worldraft-setup-stamp.json",
    extra: () => platformInfo(),
    verify({ root, env }) {
      if (!existsSync(path.join(root, "backend/.venv"))) return false;
      const result = spawnSync(
        "uv",
        [
          "run",
          "--project",
          "backend",
          "--no-sync",
          "--offline",
          "python",
          "-c",
          "from studio.main import app",
        ],
        { cwd: root, env, encoding: "utf8", timeout: 30000 },
      );
      return !result.error && result.status === 0;
    },
    install({ root, env }) {
      // uv may download a managed CPython into its own cache if no suitable
      // interpreter exists; it never modifies the system Python.
      return runStreaming(
        { command: "uv", args: ["sync", "--project", "backend", "--locked"] },
        { cwd: root, env },
      );
    },
    fix: "uv sync --project backend --locked",
  },
];

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export function checkTools({ root = ROOT, env = process.env, log = () => {} } = {}) {
  for (const tool of TOOLS) {
    const version = tool.check({ root, env });
    log(`OK       ${tool.name} ${version}`);
  }
}

export function dependencyStatus(set, { root = ROOT, env = process.env } = {}) {
  const expected = hashInputs(root, set.inputs, set.extra?.() ?? {});
  const stamp = readStamp(root, set.stamp);
  if (stamp?.hash !== expected) return { state: "stale", expected };
  if (!set.verify({ root, env })) return { state: "broken", expected };
  return { state: "ready", expected };
}

export async function ensureDependencies({
  root = ROOT,
  env = process.env,
  install = true,
  force = false,
  log = () => {},
} = {}) {
  const missing = [];
  for (const set of DEPENDENCY_SETS) {
    const status = force ? { state: "forced", expected: hashInputs(root, set.inputs, set.extra?.() ?? {}) } : dependencyStatus(set, { root, env });
    if (status.state === "ready") {
      log(`OK       ${set.name} matches lockfile`);
      continue;
    }
    if (!install) {
      log(`MISSING  ${set.name} (${status.state}) - run: ${set.fix}`);
      missing.push(set.name);
      continue;
    }
    log(`INSTALL  ${set.name} (${status.state}) ...`);
    await set.install({ root, env });
    if (!set.verify({ root, env }))
      throw new Error(
        `${set.name} installed but failed verification. Inspect the output above; try: ${set.fix}`,
      );
    writeStamp(root, set.stamp, { hash: status.expected, inputs: set.inputs });
    log(`OK       ${set.name} installed`);
  }
  if (missing.length)
    throw new Error(
      `Dependencies not ready: ${missing.join(", ")}. Run "npm run setup" to install them.`,
    );
}

export async function ensureEnvironment(options = {}) {
  checkTools(options);
  await ensureDependencies(options);
}

export async function main(argv = process.argv.slice(2)) {
  const known = ["--check", "--force", "--help"];
  const unknown = argv.filter((arg) => !known.includes(arg));
  if (unknown.length)
    throw new Error(`Unknown option: ${unknown.join(", ")}. Use --check, --force or --help.`);
  if (argv.includes("--help")) {
    console.log(
      [
        "npm run setup            verify tools, install missing/outdated dependencies",
        "npm run setup -- --check only report; install nothing (exit 1 if not ready)",
        "npm run setup -- --force reinstall every dependency set from its lockfile",
        "",
        "Never installs Node.js or uv. Needs internet only when a lockfile changed.",
      ].join("\n"),
    );
    return;
  }
  const log = (message) => console.log(`[setup] ${message}`);
  await ensureEnvironment({
    install: !argv.includes("--check"),
    force: argv.includes("--force"),
    log,
  });
  log(argv.includes("--check") ? "Environment ready." : "Setup complete. Next: npm run dev");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(`[setup] ${error.message}`);
    process.exitCode = 1;
  });
}
