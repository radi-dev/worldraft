import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { ensureEnvironment } from "./setup.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const log = (message) => console.log(`[dev] ${message}`);

export function readConfig(env = process.env, args = process.argv.slice(2)) {
  const unknown = args.filter((arg) => !["--no-open", "--help"].includes(arg));
  if (unknown.length)
    throw new Error(
      `Unknown option: ${unknown.join(", ")}. Use --no-open or --help.`,
    );
  function integer(name, fallback, min, max) {
    const raw = env[name] ?? String(fallback);
    const value = Number(raw);
    if (
      !/^\d+$/.test(raw) ||
      !Number.isInteger(value) ||
      value < min ||
      value > max
    )
      throw new Error(`${name} must be an integer from ${min} to ${max}.`);
    return value;
  }
  const apiPort = integer("API_PORT", 8000, 1024, 65535);
  const uiPort = integer("UI_PORT", 5173, 1024, 65535);
  if (apiPort === uiPort)
    throw new Error("API_PORT and UI_PORT must be different.");
  return {
    apiPort,
    uiPort,
    timeoutMs: integer("DEV_STARTUP_TIMEOUT_MS", 30000, 1000, 300000),
    open: !args.includes("--no-open") && env.NO_OPEN !== "1",
    apiUrl: `http://127.0.0.1:${apiPort}`,
    uiUrl: `http://127.0.0.1:${uiPort}`,
  };
}

export const LAUNCHER_VARIABLES = ["API_PORT", "UI_PORT", "NO_OPEN", "DEV_STARTUP_TIMEOUT_MS", "BROWSER"];

export function ignoredDotenvVariables(root) {
  // The launcher reads its variables from the environment only (see
  // .env.example). Warn when a .env file tries to set them, so the split is
  // visible instead of silent. This does not parse values or load anything.
  const file = path.join(root, ".env");
  if (!existsSync(file)) return [];
  const names = new Set();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/);
    if (match && LAUNCHER_VARIABLES.includes(match[1])) names.add(match[1]);
  }
  return [...names];
}

export function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) =>
      reject(
        new Error(
          error.code === "EADDRINUSE"
            ? `Port ${port} is occupied. Stop its owner or set API_PORT/UI_PORT to free ports. No process was killed.`
            : `Cannot bind 127.0.0.1:${port}: ${error.message}`,
        ),
      ),
    );
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      server.close(resolve),
    );
  });
}

export async function waitForReady(url, timeoutMs, signal, check = () => true) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
      });
      if (response.ok && (await check(response))) return;
    } catch (error) {
      if (signal.aborted) throw error;
    }
    await delay(150, undefined, { signal });
  }
  throw new Error(
    `Startup timed out waiting for ${url}. Inspect the labelled service logs; adjust DEV_STARTUP_TIMEOUT_MS if needed.`,
  );
}

export async function openBrowser(url, env = process.env) {
  let command, args;
  if (env.BROWSER) {
    command = env.BROWSER;
    args = [url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else if (process.platform === "win32") {
    command = "rundll32.exe";
    args = ["url.dll,FileProtocolHandler", url];
  } else {
    command = "xdg-open";
    args = [url];
  }
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore", env });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Browser launcher timed out."));
    }, 5000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve()
        : reject(new Error(`Browser launcher exited with code ${code}.`));
    });
  });
}


// ---------------------------------------------------------------------------
// Process-tree helpers and the orphan registry.
//
// Children run in their own process groups (POSIX) so the whole tree can be
// signalled. The cost: a terminal hang-up (closed tab, IDE "kill terminal")
// reaches only this launcher. So the launcher (a) handles SIGHUP and repeated
// Ctrl+C, (b) kills the groups from an `exit` guard, and (c) records its
// services in .worldraft/dev-services.json so the next launch can reclaim any
// verified orphans instead of failing on an occupied port.
// ---------------------------------------------------------------------------

export const REGISTRY_FILE = ".worldraft/dev-services.json";

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

export function treeAlive(pid) {
  // POSIX: probe the process group; Windows: the parent only.
  return process.platform === "win32" ? isAlive(pid) : isAlive(-pid);
}

export function killTree(pid, signal = "SIGTERM") {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-pid, signal); // whole process group
    }
  } catch (error) {
    if (error.code !== "ESRCH") log(`Shutdown warning: ${error.message}`);
  }
}

export function commandLineOf(pid) {
  // Best effort, used only to confirm a recorded PID was not recycled by an
  // unrelated process before we signal it.
  if (!Number.isInteger(pid) || pid <= 0) return "";
  const result =
    process.platform === "win32"
      ? spawnSync(
          "powershell",
          ["-NoProfile", "-Command", `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`],
          { encoding: "utf8", timeout: 10000 },
        )
      : spawnSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8", timeout: 5000 });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function writeRegistry(root, services) {
  mkdirSync(path.join(root, path.dirname(REGISTRY_FILE)), { recursive: true });
  writeFileSync(
    path.join(root, REGISTRY_FILE),
    JSON.stringify({ launcherPid: process.pid, writtenAt: new Date().toISOString(), services }, null, 2),
  );
}

export function clearRegistry(root) {
  rmSync(path.join(root, REGISTRY_FILE), { force: true });
}

export async function reclaimOrphans(root, { log: emit = log, commandLine = commandLineOf } = {}) {
  const file = path.join(root, REGISTRY_FILE);
  if (!existsSync(file)) return [];
  let registry;
  try {
    registry = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    rmSync(file, { force: true });
    return [];
  }
  if (registry.launcherPid && registry.launcherPid !== process.pid && isAlive(registry.launcherPid)) {
    throw new Error(
      `Another development session appears to be running (launcher pid ${registry.launcherPid}). Stop it with Ctrl+C first, or delete ${REGISTRY_FILE} if that is stale.`,
    );
  }
  const reclaimed = [];
  for (const service of registry.services ?? []) {
    if (!Number.isInteger(service.pid) || !isAlive(service.pid)) continue;
    // Identity check: the PID must still run the command we started.
    if (!commandLine(service.pid).includes(service.marker)) continue;
    emit(`Stopping orphaned [${service.label}] from a previous session (pid ${service.pid}).`);
    killTree(service.pid, "SIGTERM");
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && isAlive(service.pid)) await delay(75);
    if (isAlive(service.pid)) killTree(service.pid, "SIGKILL");
    reclaimed.push(service.label);
  }
  rmSync(file, { force: true });
  if (reclaimed.length) await delay(300); // let the kernel release the sockets
  return reclaimed;
}

function pipeLabel(stream, label) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines)
      if (line.trim()) console.log(`[${label}] ${line}`);
  });
  stream.on("end", () => {
    if (buffer.trim()) console.log(`[${label}] ${buffer}`);
  });
}

export async function main() {
  if (process.argv.includes("--help")) {
    log(
      "npm run dev [-- --no-open]\nEnvironment: API_PORT, UI_PORT, NO_OPEN=1, DEV_STARTUP_TIMEOUT_MS, BROWSER (executable path).",
    );
    return;
  }
  const config = readConfig();
  const ignored = ignoredDotenvVariables(root);
  if (ignored.length)
    log(
      `Note: .env sets ${ignored.join(", ")}, which this launcher reads from the environment only; ignoring. Use e.g. \`${ignored[0]}=... npm run dev\`.`,
    );
  const env = {
    ...process.env,
    API_PORT: String(config.apiPort),
    UI_PORT: String(config.uiPort),
    PYTHONUNBUFFERED: "1",
    LANGSMITH_TRACING: "false",
    LANGCHAIN_TRACING_V2: "false",
  };
  const abort = new AbortController();
  const children = [];
  let stopping;

  let forced = false;

  function shutdown(code) {
    if (stopping) return stopping;
    abort.abort();
    stopping = (async () => {
      log("Stopping development services… (press Ctrl+C again to force)");
      for (const child of children) killTree(child.pid, "SIGTERM");
      if (process.platform !== "win32") {
        // Wait for whole groups, not just parents: uvicorn's reload worker is a grandchild.
        const deadline = Date.now() + 3000;
        while (!forced && Date.now() < deadline && children.some((child) => treeAlive(child.pid))) await delay(75);
        for (const child of children) killTree(child.pid, "SIGKILL");
      }
      clearRegistry(root);
      process.exitCode = code;
    })();
    return stopping;
  }

  function onSignal(signal) {
    if (stopping) {
      // Second Ctrl+C: stop waiting politely.
      forced = true;
      for (const child of children) killTree(child.pid, "SIGKILL");
      return;
    }
    log(`Received ${signal}.`);
    void shutdown(0);
  }
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("SIGHUP", onSignal); // terminal tab closed, IDE "kill terminal"
  process.on("exit", () => {
    // Last resort, synchronous: whatever ended this process, take the tree with it.
    for (const child of children) if (child.pid && treeAlive(child.pid)) killTree(child.pid, "SIGKILL");
    if (stopping) clearRegistry(root);
  });

  function startService(label, command, args, cwd, marker) {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    child.marker = marker;
    child.label = label;
    children.push(child);
    writeRegistry(
      root,
      children.map((c) => ({ label: c.label, pid: c.pid, marker: c.marker })),
    );
    pipeLabel(child.stdout, label);
    pipeLabel(child.stderr, label);
    child.once("error", (error) => {
      log(`${label} could not start: ${error.message}`);
      void shutdown(1);
    });
    child.once("exit", (code, signal) => {
      if (!stopping) {
        log(`${label} exited unexpectedly (${signal ?? code}).`);
        void shutdown(1);
      }
    });
  }

  try {
    // First launch installs from the lockfiles; later launches are offline no-ops.
    await ensureEnvironment({ env, install: true, log: (m) => log(`setup: ${m}`) });
    await reclaimOrphans(root);
    await Promise.all([
      assertPortFree(config.apiPort),
      assertPortFree(config.uiPort),
    ]);
    abort.signal.throwIfAborted();
    startService(
      "api",
      "uv",
      [
        "run",
        "--project",
        "backend",
        "--no-sync",
        "--offline",
        "uvicorn",
        "studio.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        String(config.apiPort),
        "--reload",
        "--reload-dir",
        "backend/src",
      ],
      root,
      "uvicorn studio.main:app",
    );
    startService(
      "ui",
      process.execPath,
      [path.join(root, "node_modules/vite/bin/vite.js")],
      path.join(root, "apps/studio"),
      path.join(root, "node_modules/vite/bin/vite.js"),
    );
    await Promise.all([
      waitForReady(
        `${config.apiUrl}/api/health`,
        config.timeoutMs,
        abort.signal,
        async (response) => {
          const data = await response.json();
          return (
            data.status === "ok" &&
            data.integrations?.langgraph === "placeholder_compiled"
          );
        },
      ),
      waitForReady(
        config.uiUrl,
        config.timeoutMs,
        abort.signal,
        async (response) => (await response.text()).includes("/src/main.tsx"),
      ),
    ]);
    // Check the real browser route too, including Vite's API proxy.
    await waitForReady(
      `${config.uiUrl}/api/health`,
      config.timeoutMs,
      abort.signal,
      async (response) => (await response.json()).status === "ok",
    );
    abort.signal.throwIfAborted();
    log(`Ready — ${config.uiUrl}`);
    log(`API — ${config.apiUrl}/api/health · Ctrl+C stops both services.`);
    if (config.open) {
      try {
        await openBrowser(config.uiUrl, env);
        log("Browser open requested once.");
      } catch (error) {
        log(
          `Could not open browser: ${error.message} Open ${config.uiUrl} manually.`,
        );
      }
    }
  } catch (error) {
    if (!stopping) {
      console.error(`[dev] ${error.message}`);
      await shutdown(1);
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(`[dev] ${error.message}`);
    process.exitCode = 1;
  });
}
