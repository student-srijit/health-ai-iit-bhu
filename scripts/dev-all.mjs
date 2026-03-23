import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const localVenvPython = path.join(
  process.cwd(),
  ".venv",
  "Scripts",
  "python.exe",
);
const parentVenvPython = path.join(
  process.cwd(),
  "..",
  ".venv",
  "Scripts",
  "python.exe",
);
const pythonExe =
  process.env.PYTHON_EXE ||
  (existsSync(localVenvPython)
    ? localVenvPython
    : existsSync(parentVenvPython)
      ? parentVenvPython
      : "python");

function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return isValidPort(parsed) ? parsed : fallback;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "0.0.0.0");
  });
}

async function findFreePort(preferredPort) {
  for (let candidate = preferredPort; candidate <= 65535; candidate += 1) {
    // Sequential probing guarantees no silent fallback to a hardcoded alternate port.
    // It picks the first actually available port from the requested starting point.
    // This keeps behavior deterministic while handling stale listeners cleanly.
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No free port found starting at ${preferredPort}`);
}

const preferredPorts = {
  depression: parsePort(process.env.DEPRESSION_PORT, 8001),
  ppg: parsePort(process.env.PPG_PORT, 8002),
  orchestrator: parsePort(process.env.ORCHESTRATOR_PORT, 8003),
  kineticare: parsePort(process.env.KINETICARE_PORT, 8004),
};

const servicePorts = {
  depression: await findFreePort(preferredPorts.depression),
  ppg: await findFreePort(preferredPorts.ppg),
  orchestrator: await findFreePort(preferredPorts.orchestrator),
  kineticare: await findFreePort(preferredPorts.kineticare),
};

const webEnv = {
  ...process.env,
  DEPRESSION_SERVICE_URL: `http://127.0.0.1:${servicePorts.depression}`,
  PPG_SERVICE_URL: `http://127.0.0.1:${servicePorts.ppg}`,
  ORCHESTRATOR_SERVICE_URL: `http://127.0.0.1:${servicePorts.orchestrator}`,
  KINETICARE_SERVICE_URL: `http://127.0.0.1:${servicePorts.kineticare}`,
};

console.log(
  `[dev-all] Using ports depression=${servicePorts.depression}, ppg=${servicePorts.ppg}, orchestrator=${servicePorts.orchestrator}, kineticare=${servicePorts.kineticare}`,
);

const services = [
  {
    name: "web",
    command: "npm",
    args: ["--prefix", "apps/web", "run", "dev"],
    env: webEnv,
  },
  {
    name: "depression",
    command: pythonExe,
    args: [
      "-m",
      "uvicorn",
      "depression_service.main:app",
      "--app-dir",
      "services/depression-service/src",
      "--host",
      "0.0.0.0",
      "--port",
      String(servicePorts.depression),
    ],
  },
  {
    name: "ppg",
    command: pythonExe,
    args: [
      "-m",
      "uvicorn",
      "ppg_service.main:app",
      "--app-dir",
      "services/ppg-service/src",
      "--host",
      "0.0.0.0",
      "--port",
      String(servicePorts.ppg),
    ],
  },
  {
    name: "orchestrator",
    command: pythonExe,
    args: [
      "-m",
      "uvicorn",
      "orchestrator_service.main:app",
      "--app-dir",
      "services/orchestrator-service/src",
      "--host",
      "0.0.0.0",
      "--port",
      String(servicePorts.orchestrator),
    ],
  },
  {
    name: "kineticare",
    command: pythonExe,
    args: [
      "-m",
      "uvicorn",
      "kineticare_service.main:app",
      "--app-dir",
      "services/kineticare-service/src",
      "--host",
      "0.0.0.0",
      "--port",
      String(servicePorts.kineticare),
    ],
  },
];

const children = [];
let shuttingDown = false;

const prefix = (name, text) => `[${name}] ${text}`;

function startService(service) {
  const child = spawn(service.command, service.args, {
    cwd: process.cwd(),
    shell: true,
    env: service.env || process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(prefix(service.name, data.toString()));
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(prefix(service.name, data.toString()));
  });

  child.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(
        prefix(
          service.name,
          `exited with code ${code}. Stopping all services.\n`,
        ),
      );
      shutdown(1);
    }
  });

  children.push(child);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, 1200);
}

for (const service of services) {
  startService(service);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
