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

export interface LedgerRecordFilters {
  checkpoint_id?: string;
  repo_id?: string;
  session_id?: string;
  task_id?: string;
  workspace_id?: string;
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

  async getTeam(): Promise<unknown> {
    return this.#request("GET", "/api/team");
  }

  async publishPointer(pointer: unknown): Promise<unknown> {
    return this.#request("POST", "/api/pointers", pointer);
  }

  async listDecisions(): Promise<unknown> {
    return this.#request("GET", "/api/decisions");
  }

  async createDecision(decision: unknown): Promise<unknown> {
    return this.#request("POST", "/api/decisions", decision);
  }

  async listBriefs(): Promise<unknown> {
    return this.#request("GET", "/api/briefs");
  }

  async createBrief(brief: unknown): Promise<unknown> {
    return this.#request("POST", "/api/briefs", brief);
  }

  async listLedgerTasks(filters?: LedgerRecordFilters): Promise<unknown> {
    return this.#request("GET", withQuery("/api/ledger/tasks", filters));
  }

  async createLedgerTask(task: unknown): Promise<unknown> {
    return this.#request("POST", "/api/ledger/tasks", task);
  }

  async listLedgerTokenUsage(filters?: LedgerRecordFilters): Promise<unknown> {
    return this.#request("GET", withQuery("/api/ledger/token-usage", filters));
  }

  async createLedgerTokenUsage(tokenUsage: unknown): Promise<unknown> {
    return this.#request("POST", "/api/ledger/token-usage", tokenUsage);
  }

  async listLedgerTokenAssessments(filters?: LedgerRecordFilters): Promise<unknown> {
    return this.#request("GET", withQuery("/api/ledger/token-assessments", filters));
  }

  async createLedgerTokenAssessment(assessment: unknown): Promise<unknown> {
    return this.#request("POST", "/api/ledger/token-assessments", assessment);
  }

  async listLedgerEvents(filters?: LedgerRecordFilters): Promise<unknown> {
    return this.#request("GET", withQuery("/api/ledger/events", filters));
  }

  async createLedgerEvent(event: unknown): Promise<unknown> {
    return this.#request("POST", "/api/ledger/events", event);
  }

  async listLedgerCheckpoints(filters?: LedgerRecordFilters): Promise<unknown> {
    return this.#request("GET", withQuery("/api/ledger/checkpoints", filters));
  }

  async createLedgerCheckpoint(checkpoint: unknown): Promise<unknown> {
    return this.#request("POST", "/api/ledger/checkpoints", checkpoint);
  }

  async checkConflicts(subject: unknown): Promise<unknown> {
    return this.#request("POST", "/api/conflicts/check", subject);
  }

  async releaseClaim(id: string): Promise<unknown> {
    return this.#request("DELETE", `/api/claims/${encodeURIComponent(id)}`);
  }

  async cleanup(context: unknown): Promise<unknown> {
    return this.#request("POST", "/api/cleanup", context);
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

function withQuery(path: string, filters: LedgerRecordFilters | undefined): string {
  if (filters === undefined) {
    return path;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query.length === 0 ? path : `${path}?${query}`;
}
