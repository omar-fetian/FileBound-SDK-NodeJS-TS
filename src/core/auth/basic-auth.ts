import type { AuthStrategy, LoginResult } from "./strategy.js";

export class BasicAuthStrategy implements AuthStrategy {
  private readonly header: string;

  constructor(username: string, password: string) {
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    this.header = `Basic ${encoded}`;
  }

  async apply(url: string) {
    return { url, headers: { Authorization: this.header } };
  }

  async login(): Promise<LoginResult> {
    // Basic auth has no login endpoint - credentials go on every request.
    // There is nothing to do here. If you want to verify them eagerly,
    // call a cheap authenticated endpoint like GET /version yourself.
    return { mode: "basic" };
  }

  logout(): void {
    // Nothing to forget - Basic auth is stateless.
    // (Worth knowing: this means "logout" is a no-op in Basic mode.)
  }

  isAuthenticated(): boolean {
    // We always *have* credentials. Whether the server accepts them is
    // only known once we send a request.
    return true;
  }
}
