import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  validatePointer,
  validateCheckpoint,
  validateLedgerEvent,
  validateTaskEntry,
  validateTokenAssessment,
  validateTokenUsage,
  type BriefPointer,
  type Checkpoint,
  type ClaimPointer,
  type CoordinationContext,
  type DecisionPointer,
  type EventPointer,
  type LedgerEvent,
  type LedgerPointer,
  type PresencePointer,
  type TaskEntry,
  type TokenAssessment,
  type TokenUsage
} from "@suka/protocol";
import { MemorySukaStore, type SukaStore } from "./memory-store.js";
import { createEmptyState, type LocalProject, type SukaCleanupResult, type SukaState } from "./state.js";

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

  upsertBrief(pointer: BriefPointer): void {
    this.#store.upsertBrief(pointer);
    this.#persist();
  }

  appendLedger(pointer: LedgerPointer): void {
    this.#store.appendLedger(pointer);
    this.#persist();
  }

  upsertLedgerTask(task: TaskEntry): void {
    this.#store.upsertLedgerTask(task);
    this.#persist();
  }

  upsertLedgerTokenUsage(tokenUsage: TokenUsage): void {
    this.#store.upsertLedgerTokenUsage(tokenUsage);
    this.#persist();
  }

  upsertLedgerTokenAssessment(assessment: TokenAssessment): void {
    this.#store.upsertLedgerTokenAssessment(assessment);
    this.#persist();
  }

  appendLedgerEvent(event: LedgerEvent): void {
    this.#store.appendLedgerEvent(event);
    this.#persist();
  }

  upsertLedgerCheckpoint(checkpoint: Checkpoint): void {
    this.#store.upsertLedgerCheckpoint(checkpoint);
    this.#persist();
  }

  upsertProject(project: LocalProject): void {
    this.#store.upsertProject(project);
    this.#persist();
  }

  removeProject(id: string): LocalProject | undefined {
    const project = this.#store.removeProject(id);
    if (project !== undefined) {
      this.#persist();
    }
    return project;
  }

  setActiveProject(id: string | undefined): boolean {
    const changed = this.#store.setActiveProject(id);
    if (changed) {
      this.#persist();
    }
    return changed;
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
  return result.removed.presence > 0 ||
    result.removed.claims > 0 ||
    result.removed.events > 0 ||
    result.removed.decisions > 0 ||
    result.removed.briefs > 0 ||
    result.removed.ledger > 0 ||
    result.removed.ledger_tasks > 0 ||
    result.removed.ledger_token_usage > 0 ||
    result.removed.ledger_token_assessments > 0 ||
    result.removed.ledger_events > 0 ||
    result.removed.ledger_checkpoints > 0;
}

function loadState(path: string): SukaState {
  if (!existsSync(path)) {
    return createEmptyState();
  }

  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<SukaState>;

  const state: SukaState = {
    presence: Array.isArray(parsed.presence) ? parsed.presence : [],
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
    events: Array.isArray(parsed.events) ? parsed.events : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    briefs: Array.isArray(parsed.briefs) ? parsed.briefs : [],
    ledger: Array.isArray(parsed.ledger) ? parsed.ledger.filter(isValidLedgerPointer) : [],
    ledger_tasks: Array.isArray(parsed.ledger_tasks) ? parsed.ledger_tasks.filter(isValidTaskEntry) : [],
    ledger_token_usage: Array.isArray(parsed.ledger_token_usage) ? parsed.ledger_token_usage.filter(isValidTokenUsage) : [],
    ledger_token_assessments: Array.isArray(parsed.ledger_token_assessments) ?
      parsed.ledger_token_assessments.filter(isValidTokenAssessment) :
      [],
    ledger_events: Array.isArray(parsed.ledger_events) ? parsed.ledger_events.filter(isValidLedgerEvent) : [],
    ledger_checkpoints: Array.isArray(parsed.ledger_checkpoints) ?
      parsed.ledger_checkpoints.filter(isValidCheckpoint) :
      [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : []
  };

  if (typeof parsed.active_project_id === "string" && state.projects.some((project) => project.id === parsed.active_project_id)) {
    state.active_project_id = parsed.active_project_id;
  }

  return state;
}

function isValidLedgerPointer(value: unknown): value is LedgerPointer {
  const result = validatePointer(value);
  return result.ok && result.value.type === "ledger";
}

function isValidTaskEntry(value: unknown): value is TaskEntry {
  return validateTaskEntry(value).ok;
}

function isValidTokenUsage(value: unknown): value is TokenUsage {
  return validateTokenUsage(value).ok;
}

function isValidTokenAssessment(value: unknown): value is TokenAssessment {
  return validateTokenAssessment(value).ok;
}

function isValidLedgerEvent(value: unknown): value is LedgerEvent {
  return validateLedgerEvent(value).ok;
}

function isValidCheckpoint(value: unknown): value is Checkpoint {
  return validateCheckpoint(value).ok;
}
