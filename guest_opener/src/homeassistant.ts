const TIMEOUT_MS = 10_000;

export type EntityState = { entity_id: string; state: string; attributes: Record<string, unknown> };

/** Minimal client for the Home Assistant REST API (inside an add-on via the Supervisor proxy). */
export class HomeAssistant {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get configured(): boolean {
    return !!this.baseUrl && !!this.token;
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
    if (!this.configured) throw new Error("Home Assistant connection not configured");
    const res = await this.fetchImpl(`${this.baseUrl}/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HA ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res;
  }

  async callService(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    await this.request("POST", `/services/${domain}/${service}`, data);
  }

  async getState(entityId: string): Promise<EntityState> {
    return (await this.request("GET", `/states/${entityId}`)).json() as Promise<EntityState>;
  }
}
