type ServiceKey = "web" | "depression" | "ppg" | "orchestrator" | "kineticare";

type ServiceMap = Record<ServiceKey, string>;

const defaults: ServiceMap = {
  web: "http://127.0.0.1:3000",
  depression: "http://127.0.0.1:8001",
  ppg: "http://127.0.0.1:8002",
  orchestrator: "http://127.0.0.1:8003",
  kineticare: "http://127.0.0.1:8004",
};

function sanitizeBaseUrl(value: string, fallback: string): string {
  const v = (value || "").trim();
  if (!v) {
    return fallback;
  }
  return v.endsWith("/") ? v.slice(0, -1) : v;
}

export function getServiceBaseUrls(): ServiceMap {
  return {
    web: sanitizeBaseUrl(process.env.WEB_SERVICE_URL ?? "", defaults.web),
    depression: sanitizeBaseUrl(process.env.DEPRESSION_SERVICE_URL ?? "", defaults.depression),
    ppg: sanitizeBaseUrl(process.env.PPG_SERVICE_URL ?? "", defaults.ppg),
    orchestrator: sanitizeBaseUrl(process.env.ORCHESTRATOR_SERVICE_URL ?? "", defaults.orchestrator),
    kineticare: sanitizeBaseUrl(process.env.KINETICARE_SERVICE_URL ?? "", defaults.kineticare),
  };
}

export function getServiceUrl(service: ServiceKey, path: string): string {
  const base = getServiceBaseUrls()[service];
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
