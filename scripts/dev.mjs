import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

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

function checkDependencies(env) {
  if (
    Number(process.versions.node.split(".")[0]) < 22 ||
    (process.versions.node.startsWith("22.") &&
      Number(process.versions.node.split(".")[1]) < 12)
  )
    throw new Error(
      "Node.js 22.12+ is required. Install a supported Node.js version.",
    );
  const uv = spawnSync("uv", ["--version"], { env, encoding: "utf8" });
  if (uv.error || uv.status !== 0)
    throw new Error(
      "uv is missing from PATH. Install uv, then run uv sync --project backend --locked.",
    );
  if (!existsSync(path.join(root, "node_modules/vite/bin/vite.js")))
    throw new Error(
      "Frontend dependencies are missing. Run npm ci in the repository root.",
    );
  if (!existsSync(path.join(root, "backend/.venv")))
    throw new Error(
      "Backend environment is missing. Run uv sync --project backend --locked.",
    );
  const imports = spawnSync(
    "uv",
    [
      "run",
      "--project",
      "backend",
      "--no-sync",
      "--offline",
      "python",
      "-c",
      "import fastapi, uvicorn, langchain, langgraph; from studio.main import app",
    ],
    { cwd: root, env, encoding: "utf8", timeout: 15000 },
  );
  if (imports.error || imports.status !== 0)
    throw new Error(
      `Backend dependencies could not load. Run uv sync --project backend --locked.\n${imports.stderr || imports.error?.message || ""}`,
    );
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

  function signalGroup(child, signal) {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") log(`Shutdown warning: ${error.message}`);
    }
  }

  function shutdown(code) {
    if (stopping) return stopping;
    abort.abort();
    stopping = (async () => {
      log("Stopping development services…");
      if (process.platform === "win32") {
        await Promise.all(
          children
            .filter((child) => child.pid)
            .map(
              (child) =>
                new Promise((resolve) => {
                  const killer = spawn(
                    "taskkill",
                    ["/PID", String(child.pid), "/T", "/F"],
                    { stdio: "ignore" },
                  );
                  killer.once("error", resolve);
                  killer.once("exit", resolve);
                }),
            ),
        );
      } else {
        for (const child of children) signalGroup(child, "SIGTERM");
        // Wait for groups, not just parents: uvicorn's reload worker is a grandchild.
        const deadline = Date.now() + 3000;
        while (
          Date.now() < deadline &&
          children.some((child) => {
            try {
              process.kill(-child.pid, 0);
              return true;
            } catch {
              return false;
            }
          })
        )
          await delay(75);
        for (const child of children) signalGroup(child, "SIGKILL");
      }
      process.exitCode = code;
    })();
    return stopping;
  }

  process.once("SIGINT", () => {
    void shutdown(0);
  });
  process.once("SIGTERM", () => {
    void shutdown(0);
  });

  function startService(label, command, args, cwd) {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    children.push(child);
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
    checkDependencies(env);
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
    );
    startService(
      "ui",
      process.execPath,
      [path.join(root, "node_modules/vite/bin/vite.js")],
      path.join(root, "apps/studio"),
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
