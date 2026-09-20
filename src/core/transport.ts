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
   *
   * Throws on non-2xx responses. Returns `undefined` for 204 No Content
   * and for 2xx responses with an empty body - many FileBound "action"
   * endpoints (addComment, delete, group, ...) return nothing.
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

    // 204 always has no body.
    if (res.status === 204) return undefined as T;

    // Some 2xx responses have an empty body too. Read text first, and
    // only JSON.parse when there's something to parse.
    const text = await res.text();
    if (text.length === 0) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `Expected JSON from ${method} ${url}, got: ${text.slice(0, 200)}`,
      );
    }
  }

  /**
   * Perform a request and return the body as raw bytes (Buffer).
   * Use for endpoints that return binary data, not JSON.
   */
  async bytes(
    method: string,
    url: string,
    init: RequestInit = {},
  ): Promise<Buffer> {
    const res = await this.request(method, url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
      );
    }
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  }

  /**
   * Send a multipart/form-data request and parse the response as JSON.
   *
   * CRITICAL: do NOT set Content-Type manually. fetch will set it,
   * including the multipart boundary. If you set it yourself, the
   * boundary is missing and the server cannot parse the form.
   */
  async multipart<T>(
    method: string,
    url: string,
    form: FormData,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url, {
        method,
        body: form,
        headers, // any auth headers we need, but NOT Content-Type
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
        );
      }

      if (res.status === 204) return undefined as T;
      const text = await res.text();
      if (text.length === 0) return undefined as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
