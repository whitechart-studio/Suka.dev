export interface SukaApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    issues?: unknown[];
  };
}

export class SukaApiClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: SukaApiClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#fetch = options.fetch ?? fetch;
  }

  async getState(): Promise<unknown> {
    return this.#request("GET", "/api/state");
  }

  async publishPointer(pointer: unknown): Promise<unknown> {
    return this.#request("POST", "/api/pointers", pointer);
  }

  async checkConflicts(subject: unknown): Promise<unknown> {
    return this.#request("POST", "/api/conflicts/check", subject);
  }

  async releaseClaim(id: string): Promise<unknown> {
    return this.#request("DELETE", `/api/claims/${encodeURIComponent(id)}`);
  }

  async #request(method: string, path: string, body?: unknown): Promise<unknown> {
    const init: RequestInit = {
      method
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = {
        "content-type": "application/json"
      };
    }

    const response = await this.#fetch(`${this.#baseUrl}${path}`, init);
    const payload = await response.json() as ApiResponse<unknown>;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Suka API request failed with status ${response.status}.`);
    }

    return payload.data;
  }
}
