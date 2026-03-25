type ServiceKey = "web" | "depression" | "ppg" | "orchestrator" | "kineticare" | "blood" | "nervous";

type ServiceMap = Record<ServiceKey, string>;

type MongoConfig = {
  uri: string;
  dbName: string;
};

const defaults: ServiceMap = {
  web: "http://127.0.0.1:3000",
  depression: "http://127.0.0.1:8001",
  ppg: "http://127.0.0.1:8002",
  orchestrator: "http://127.0.0.1:8003",
  kineticare: "http://127.0.0.1:8004",
  blood: "http://127.0.0.1:8005",
  nervous: "http://127.0.0.1:8006",
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
    blood: sanitizeBaseUrl(process.env.BLOOD_SERVICE_URL ?? "", defaults.blood),
    nervous: sanitizeBaseUrl(process.env.NERVOUS_SERVICE_URL ?? "", defaults.nervous),
  };
}

export function getServiceUrl(service: ServiceKey, path: string): string {
  const base = getServiceBaseUrls()[service];
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getMongoConfig(): MongoConfig {
  const uri = (process.env.MONGODB_URI ?? "").trim();
  const dbName = (process.env.MONGODB_DB_NAME ?? "health_ai").trim();

  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  return {
    uri,
    dbName: dbName || "health_ai",
  };
}
