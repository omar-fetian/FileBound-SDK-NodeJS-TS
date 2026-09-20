/**
 * Transport = the thing that actually speaks HTTP.
 *
 * For now it only handles timeouts. Later we'll layer on
 * retries, request/response hooks, and error mapping.
 */
export interface TransportOptions {
  timeoutMs?: number;
  /** Override fetch for testing. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class Transport {
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: TransportOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /**
   * Perform a raw request and return the Response.
   * Callers who want JSON should use `json()` instead.
   */
  async request(
    method: string,
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(url, {
        ...init,
        method,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Perform a request and parse the body as JSON.
   * Throws on non-2xx responses.
   */
  async json<T>(
    method: string,
    url: string,
    init: RequestInit = {},
  ): Promise<T> {
    const res = await this.request(method, url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
      );
    }
    return (await res.json()) as T;
  }
}
