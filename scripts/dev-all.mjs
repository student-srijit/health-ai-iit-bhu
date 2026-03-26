import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

// 1. Manually parse .env.local to ensure MONGODB_URI is passed to all child processes (Next.js & Python)
try {
  const envPath = path.join(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    const envFile = readFileSync(envPath, "utf8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          let value = valueParts.join("=").trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      }
    }
    console.log("[dev-all] Successfully loaded .env.local variables");
  }
} catch (err) {
  console.log("[dev-all] Warning: Could not read .env.local");
}

// 2. Bypass Python MacOS SSL Verification for HuggingFace downloads
process.env.CURL_CA_BUNDLE = "";
process.env.REQUESTS_CA_BUNDLE = "";

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
      : "python3");

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

async function findFreePort(preferredPort, reservedPorts = new Set()) {
  for (let candidate = preferredPort; candidate <= 65535; candidate += 1) {
    if (reservedPorts.has(candidate)) {
      continue;
    }
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
  blood: parsePort(process.env.BLOOD_PORT, 8005),
  nervous: parsePort(process.env.NERVOUS_PORT, 8006),
};

const reservedPorts = new Set();
const servicePorts = {};

for (const [serviceName, preferredPort] of Object.entries(preferredPorts)) {
  // Reserve each selected port so no two services bind the same address.
  // eslint-disable-next-line no-await-in-loop
  const selected = await findFreePort(preferredPort, reservedPorts);
  reservedPorts.add(selected);
  servicePorts[serviceName] = selected;
}

const webEnv = {
  ...process.env,
  DEPRESSION_SERVICE_URL: `http://127.0.0.1:${servicePorts.depression}`,
  PPG_SERVICE_URL: `http://127.0.0.1:${servicePorts.ppg}`,
  ORCHESTRATOR_SERVICE_URL: `http://127.0.0.1:${servicePorts.orchestrator}`,
  KINETICARE_SERVICE_URL: `http://127.0.0.1:${servicePorts.kineticare}`,
  BLOOD_SERVICE_URL: `http://127.0.0.1:${servicePorts.blood}`,
  NERVOUS_SERVICE_URL: `http://127.0.0.1:${servicePorts.nervous}`,
};

console.log(
  `[dev-all] Using ports depression=${servicePorts.depression}, ppg=${servicePorts.ppg}, orchestrator=${servicePorts.orchestrator}, kineticare=${servicePorts.kineticare}, blood=${servicePorts.blood}, nervous=${servicePorts.nervous}`,
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
  {
    name: "blood",
    command: pythonExe,
    args: [
      "-m",
      "uvicorn",
      "blood_service.main:app",
      "--app-dir",
      "services/blood-service/src",
      "--host",
      "0.0.0.0",
      "--port",
      String(servicePorts.blood),
    ],
  },
  {
    name: "nervous",
    command: pythonExe,
    args: [
      "-m",
      "uvicorn",
      "nervous_service.main:app",
      "--app-dir",
      "services/nervous-service/src",
      "--host",
      "0.0.0.0",
      "--port",
      String(servicePorts.nervous),
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
