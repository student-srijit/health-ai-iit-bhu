import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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

const services = [
  { name: "web", command: "npm", args: ["--prefix", "apps/web", "run", "dev"] },
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
      "8001",
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
      "8002",
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
      "8003",
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
      "8004",
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
    env: process.env,
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
