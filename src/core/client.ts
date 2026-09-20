import type { AuthStrategy, LoginResult } from "./auth/strategy.js";
import { Transport, type TransportOptions } from "./transport.js";
import { BasicAuthStrategy } from "./auth/basic-auth.js";
import { GuidSessionStrategy } from "./auth/guid-session.js";
import { ProjectsResource } from "../resources/projects.js";
import { FilesResource } from "../resources/files.js";

export type AuthMode = "basic" | "guid";

export interface FileBoundClientOptions {
  /** Base site URL, e.g. "https://ofetian.filebound.com". No trailing slash needed. */
  baseUrl: string;
  username: string;
  password: string;
  /** "guid" (default) or "basic". */
  authMode?: AuthMode;
  /** Tune timeouts / inject a fake fetch in tests. */
  transport?: TransportOptions;
}

/**
 * FileBoundClient is the single entry point into the SDK.
 *
 * It owns:
 *   - one Transport    (how we speak HTTP)
 *   - one AuthStrategy (how we attach credentials)
 *
 * Everything else (projects, files, documents, ...) will be added later as
 * "resource" modules that receive a FileBoundClient and call `client.request()`.
 */
export class FileBoundClient {
  readonly baseUrl: string;
  readonly transport: Transport;
  readonly projects: ProjectsResource;
  readonly files: FilesResource;
  private readonly auth: AuthStrategy;

  constructor(opts: FileBoundClientOptions) {
    // Normalize: strip trailing slashes so we never produce "//api/...".
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.transport = new Transport(opts.transport);
    this.projects = new ProjectsResource(this);
    this.files = new FilesResource(this);

    const mode: AuthMode = opts.authMode ?? "guid";
    this.auth =
      mode === "basic"
        ? new BasicAuthStrategy(opts.username, opts.password)
        : new GuidSessionStrategy(this.baseUrl, opts.username, opts.password);
  }

  /**
   * The only method resources need. Builds the URL, applies auth,
   * sends the request, returns parsed JSON.
   */
  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    // `path` is expected to start with "/", e.g. "/projects" or "/documents/1".
    const url0 = `${this.baseUrl}/api${path}`;

    const { url, headers } = await this.auth.apply(url0);

    const init: RequestInit = { headers: { ...headers } };

    if (body !== undefined) {
      (init.headers as Record<string, string>)["Content-Type"] =
        "application/json";
      init.body = JSON.stringify(body);
    }

    return this.transport.json<T>(method, url, init);
  }

  // ---- Convenience methods -------------------------------------------------

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }
  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }
  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }
  delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  // ---- Authentication ------------------------------------------------------

  /**
   * Ensure the client has a usable session.
   * - GUID mode: logs in if there's no fresh GUID; otherwise returns the cached one.
   * - Basic mode: no-op (credentials are attached to every request anyway).
   *
   * You never *have* to call this - the first `request()` will log in lazily.
   * Call it explicitly when you want to verify credentials up front, or to
   * read the GUID (e.g. for logging).
   */
  login(): Promise<LoginResult> {
    return this.auth.login();
  }

  /**
   * Forget any cached credentials.
   * Note: FileBound has no server-side logout. In GUID mode this only
   * clears our local cache; the server-side session simply expires after 24h.
   */
  logout(): void {
    this.auth.logout();
  }

  /** True if we can make an authenticated request without a login round-trip. */
  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }
}
