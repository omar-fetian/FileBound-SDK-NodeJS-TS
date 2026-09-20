import type { AuthStrategy, LoginResult } from "./strategy.js";

export class GuidSessionStrategy implements AuthStrategy {
  private guid: string | null = null;
  private expiresAt = 0;
  private inflightLogin: Promise<string> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
    private readonly ttlMs = 23 * 60 * 60 * 1000,
  ) {}

  async apply(url: string) {
    const guid = await this.ensureGuid();
    const sep = url.includes("?") ? "&" : "?";
    return { url: `${url}${sep}guid=${guid}`, headers: {} };
  }

  /** Ensure we have a valid GUID; returns info about it. */
  async login(): Promise<LoginResult> {
    const guid = await this.ensureGuid();
    return { mode: "guid", guid, expiresAt: new Date(this.expiresAt) };
  }

  /**
   * FileBound has no server-side logout. We simply forget the cached
   * GUID locally; the next request will trigger a fresh login.
   */
  logout(): void {
    this.guid = null;
    this.expiresAt = 0;
  }

  isAuthenticated(): boolean {
    return this.hasFreshGuid();
  }

  // ----- internals --------------------------------------------------------

  private hasFreshGuid(): boolean {
    return this.guid !== null && Date.now() < this.expiresAt;
  }

  private async ensureGuid(): Promise<string> {
    if (this.hasFreshGuid()) return this.guid as string;

    if (!this.inflightLogin) {
      this.inflightLogin = this.performLogin().finally(() => {
        this.inflightLogin = null;
      });
    }
    return this.inflightLogin;
  }

  private async performLogin(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!res.ok) {
      throw new Error(
        `FileBound login failed: HTTP ${res.status} ${res.statusText}`,
      );
    }

    const guid = (await res.json()) as string;
    if (typeof guid !== "string" || guid.length === 0) {
      throw new Error("FileBound login returned an unexpected response body.");
    }

    this.guid = guid;
    this.expiresAt = Date.now() + this.ttlMs;
    return guid;
  }
}
