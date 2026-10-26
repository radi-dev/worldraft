// Assemble a user-mode release: built UI + backend source + lockfile + start
// wrappers. One platform-independent zip; uv installs per-platform wheels on
// the user's machine. Run by CI on tags, or manually with `npm run package`.
//
// Zero npm dependencies (same rule as setup.mjs).

import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// What a user needs and nothing else. Directories are copied recursively.
// Extend this list when a new runtime asset appears (see docs/setup.md).
export const RELEASE_CONTENTS = [
  { from: "apps/studio/dist", required: true }, // built UI (npm run build)
  { from: "backend/pyproject.toml", required: true },
  { from: "backend/uv.lock", required: true },
  { from: "backend/.python-version", required: true },
  { from: "backend/src", required: true, exclude: /(^|[\\/])(__pycache__|\.pytest_cache)([\\/]|$)|\.py[cod]$/ },
  { from: "start.sh", required: true },
  { from: "start.cmd", required: true },
  { from: "LICENSE", required: true },
  { from: "docs/getting-started.md", to: "README.md", required: true },
  { from: ".env.example", required: true }, // template for user settings; never .env itself
];

function copyFiltered(source, destination, exclude) {
  cpSync(source, destination, {
    recursive: true,
    filter: (file) => !(exclude && exclude.test(path.relative(source, file))),
  });
}

export function stageRelease({ root = ROOT, outDir, version, commit = "unknown" }) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const item of RELEASE_CONTENTS) {
    const source = path.join(root, item.from);
    if (!existsSync(source)) {
      if (item.required)
        throw new Error(
          `Missing ${item.from}. ${item.from.endsWith("dist") ? "Run npm run build first." : ""}`.trim(),
        );
      continue;
    }
    const destination = path.join(outDir, item.to ?? item.from);
    mkdirSync(path.dirname(destination), { recursive: true });
    if (statSync(source).isDirectory()) copyFiltered(source, destination, item.exclude);
    else cpSync(source, destination);
  }
  writeFileSync(
    path.join(outDir, "release.json"),
    JSON.stringify({ name: "worldraft", version, commit, builtAt: new Date().toISOString() }, null, 2) + "\n",
  );
  return listFiles(outDir);
}

export function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed (exit ${code}).`)),
    );
  });
}

async function zipDirectory(parentDir, folderName, zipPath) {
  rmSync(zipPath, { force: true });
  if (process.platform === "win32") {
    // bsdtar ships with Windows 10+ and writes zip when asked for .zip output.
    await run("tar", ["-a", "-c", "-f", zipPath, folderName], parentDir);
  } else {
    const probe = spawnSync("zip", ["-v"], { encoding: "utf8" });
    if (probe.error) {
      console.log(`[package] "zip" is not installed; the folder ${folderName} is ready but was not archived.`);
      return false;
    }
    await run("zip", ["-qr", zipPath, folderName], parentDir);
  }
  return true;
}

function gitCommit(root) {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

export async function main(argv = process.argv.slice(2)) {
  const known = ["--no-build", "--help"];
  const unknown = argv.filter((arg) => !known.includes(arg));
  if (unknown.length) throw new Error(`Unknown option: ${unknown.join(", ")}. Use --no-build or --help.`);
  if (argv.includes("--help")) {
    console.log("npm run package [-- --no-build]\nBuilds the UI (unless --no-build), stages release/worldraft-<version>/ and zips it.");
    return;
  }
  const version = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  const log = (message) => console.log(`[package] ${message}`);
  if (!argv.includes("--no-build")) {
    log("Building the UI ...");
    await run(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build"], path.join(ROOT, "apps/studio"));
  }
  const folderName = `worldraft-${version}`;
  const releaseDir = path.join(ROOT, "release");
  const outDir = path.join(releaseDir, folderName);
  const files = stageRelease({ outDir, version, commit: gitCommit(ROOT) });
  log(`Staged ${files.length} files in release/${folderName}`);
  const zipPath = path.join(releaseDir, `${folderName}.zip`);
  if (await zipDirectory(releaseDir, folderName, zipPath)) log(`Wrote release/${folderName}.zip`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`[package] ${error.message}`);
    process.exitCode = 1;
  });
}
