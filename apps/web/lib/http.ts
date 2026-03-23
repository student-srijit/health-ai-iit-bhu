type FetchJsonOptions = {
  method?: "GET" | "POST";
  payload?: unknown;
  timeoutMs?: number;
  retries?: number;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const {
    method = "GET",
    payload,
    timeoutMs = 15000,
    retries = 1,
  } = options;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP_${res.status}`);
      }

      return (await res.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("unknown_error");
      if (attempt >= retries) {
        break;
      }
      await wait(200 * Math.pow(2, attempt));
    } finally {
      clearTimeout(timer);
    }

    attempt += 1;
  }

  throw lastError ?? new Error("request_failed");
}
