import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ClaimPointer, CoordinationContext, DecisionPointer, EventPointer, PresencePointer } from "@suka/protocol";
import { MemorySukaStore, type SukaStore } from "./memory-store.js";
import { createEmptyState, type SukaCleanupResult, type SukaState } from "./state.js";

export class FileSukaStore implements SukaStore {
  readonly #path: string;
  readonly #store: MemorySukaStore;

  constructor(path: string) {
    this.#path = path;
    this.#store = new MemorySukaStore(loadState(path));
  }

  getState(): SukaState {
    return this.#store.getState();
  }

  upsertPresence(pointer: PresencePointer): void {
    this.#store.upsertPresence(pointer);
    this.#persist();
  }

  upsertClaim(pointer: ClaimPointer): void {
    this.#store.upsertClaim(pointer);
    this.#persist();
  }

  releaseClaim(id: string): boolean {
    const released = this.#store.releaseClaim(id);
    if (released) {
      this.#persist();
    }
    return released;
  }

  cleanup(context: CoordinationContext): SukaCleanupResult {
    const result = this.#store.cleanup(context);
    if (hasRemovedPointers(result)) {
      this.#persist();
    }
    return result;
  }

  appendEvent(pointer: EventPointer): void {
    this.#store.appendEvent(pointer);
    this.#persist();
  }

  upsertDecision(pointer: DecisionPointer): void {
    this.#store.upsertDecision(pointer);
    this.#persist();
  }

  expire(now: Date): void {
    const before = this.#store.getState();
    this.#store.expire(now);
    const after = this.#store.getState();

    if (before.presence.length !== after.presence.length || before.claims.length !== after.claims.length) {
      this.#persist();
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#path), { recursive: true });
    const tempPath = `${this.#path}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(this.#store.getState(), null, 2)}\n`, "utf8");
    renameSync(tempPath, this.#path);
  }
}

function hasRemovedPointers(result: SukaCleanupResult): boolean {
  return result.removed.presence > 0 || result.removed.claims > 0 || result.removed.events > 0 || result.removed.decisions > 0;
}

function loadState(path: string): SukaState {
  if (!existsSync(path)) {
    return createEmptyState();
  }

  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<SukaState>;

  return {
    presence: Array.isArray(parsed.presence) ? parsed.presence : [],
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
    events: Array.isArray(parsed.events) ? parsed.events : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : []
  };
}
