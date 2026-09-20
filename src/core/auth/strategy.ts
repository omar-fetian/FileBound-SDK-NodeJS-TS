/**
 * What every auth mode returns from `login()`.
 * `guid` is only present in GUID mode.
 */
export interface LoginResult {
  mode: "basic" | "guid";
  /** GUID string, only set in guid mode. */
  guid?: string;
  /** When the GUID stops being valid. Only set in guid mode. */
  expiresAt?: Date;
}

/**
 * The shape every authentication mode must follow.
 */
export interface AuthStrategy {
  /** Return the URL + headers that should be sent for this request. */
  apply(url: string): Promise<{
    url: string;
    headers: Record<string, string>;
  }>;

  /** Ensure we have a usable session. Reuses a cached one if valid. */
  login(): Promise<LoginResult>;

  /** Forget any cached credentials. */
  logout(): void;

  /** Are we ready to make authenticated requests without a login round-trip? */
  isAuthenticated(): boolean;
}
