import type {
  BriefPointer,
  Checkpoint,
  ClaimPointer,
  CoordinationContext,
  DecisionPointer,
  EventPointer,
  LedgerEvent,
  LedgerPointer,
  PresencePointer,
  TaskEntry,
  TokenAssessment,
  TokenUsage
} from "@suka/protocol";
import { createEmptyState, type LocalProject, type SukaCleanupResult, type SukaState } from "./state.js";

export interface SukaStore {
  getState(): SukaState;
  upsertPresence(pointer: PresencePointer): void;
  upsertClaim(pointer: ClaimPointer): void;
  releaseClaim(id: string): boolean;
  cleanup(context: CoordinationContext): SukaCleanupResult;
  appendEvent(pointer: EventPointer): void;
  upsertDecision(pointer: DecisionPointer): void;
  upsertBrief(pointer: BriefPointer): void;
  appendLedger(pointer: LedgerPointer): void;
  upsertLedgerTask(task: TaskEntry): void;
  upsertLedgerTokenUsage(tokenUsage: TokenUsage): void;
  upsertLedgerTokenAssessment(assessment: TokenAssessment): void;
  appendLedgerEvent(event: LedgerEvent): void;
  upsertLedgerCheckpoint(checkpoint: Checkpoint): void;
  upsertProject(project: LocalProject): void;
  removeProject(id: string): LocalProject | undefined;
  setActiveProject(id: string | undefined): boolean;
  expire(now: Date): void;
}

export class MemorySukaStore implements SukaStore {
  readonly #state: SukaState;

  constructor(initialState: SukaState = createEmptyState()) {
    this.#state = {
      presence: [...initialState.presence],
      claims: [...initialState.claims],
      events: [...initialState.events],
      decisions: [...initialState.decisions],
      briefs: [...initialState.briefs],
      ledger: [...initialState.ledger],
      ledger_tasks: [...initialState.ledger_tasks],
      ledger_token_usage: [...initialState.ledger_token_usage],
      ledger_token_assessments: [...initialState.ledger_token_assessments],
      ledger_events: [...initialState.ledger_events],
      ledger_checkpoints: [...initialState.ledger_checkpoints],
      projects: [...initialState.projects],
      ...(initialState.active_project_id === undefined ? {} : { active_project_id: initialState.active_project_id })
    };
  }

  getState(): SukaState {
    return {
      presence: [...this.#state.presence],
      claims: [...this.#state.claims],
      events: [...this.#state.events],
      decisions: [...this.#state.decisions],
      briefs: [...this.#state.briefs],
      ledger: [...this.#state.ledger],
      ledger_tasks: [...this.#state.ledger_tasks],
      ledger_token_usage: [...this.#state.ledger_token_usage],
      ledger_token_assessments: [...this.#state.ledger_token_assessments],
      ledger_events: [...this.#state.ledger_events],
      ledger_checkpoints: [...this.#state.ledger_checkpoints],
      projects: [...this.#state.projects],
      ...(this.#state.active_project_id === undefined ? {} : { active_project_id: this.#state.active_project_id })
    };
  }

  upsertPresence(pointer: PresencePointer): void {
    this.#state.presence = upsertById(this.#state.presence, pointer);
  }

  upsertClaim(pointer: ClaimPointer): void {
    this.#state.claims = upsertById(this.#state.claims, pointer);
  }

  releaseClaim(id: string): boolean {
    const initialLength = this.#state.claims.length;
    this.#state.claims = this.#state.claims.filter((claim) => claim.id !== id);
    return this.#state.claims.length !== initialLength;
  }

  cleanup(context: CoordinationContext): SukaCleanupResult {
    const before = this.getState();
    const removedTaskIds = new Set(
      this.#state.ledger_tasks
        .filter((task) => matchesLedgerContext(task, context))
        .map((task) => task.task_id)
    );
    this.#state.presence = this.#state.presence.filter((presence) => !matchesContext(presence, context));
    this.#state.claims = this.#state.claims.filter((claim) => !matchesContext(claim, context));
    this.#state.events = this.#state.events.filter((event) => !matchesContext(event, context));
    this.#state.decisions = this.#state.decisions.filter((decision) => !matchesContext(decision, context));
    this.#state.briefs = this.#state.briefs.filter((brief) => !matchesContext(brief, context));
    this.#state.ledger = this.#state.ledger.filter((entry) => !matchesContext(entry, context));
    this.#state.ledger_tasks = this.#state.ledger_tasks.filter((task) => !matchesLedgerContext(task, context));
    this.#state.ledger_token_usage = this.#state.ledger_token_usage.filter((tokenUsage) => !removedTaskIds.has(tokenUsage.task_id));
    this.#state.ledger_token_assessments = this.#state.ledger_token_assessments.filter(
      (assessment) => !removedTaskIds.has(assessment.task_id)
    );
    this.#state.ledger_events = this.#state.ledger_events.filter((event) => !matchesLedgerContext(event, context));
    this.#state.ledger_checkpoints = this.#state.ledger_checkpoints.filter((checkpoint) => !matchesLedgerContext(checkpoint, context));
    const after = this.getState();

    return {
      context,
      removed: {
        presence: before.presence.length - after.presence.length,
        claims: before.claims.length - after.claims.length,
        events: before.events.length - after.events.length,
        decisions: before.decisions.length - after.decisions.length,
        briefs: before.briefs.length - after.briefs.length,
        ledger: before.ledger.length - after.ledger.length,
        ledger_tasks: before.ledger_tasks.length - after.ledger_tasks.length,
        ledger_token_usage: before.ledger_token_usage.length - after.ledger_token_usage.length,
        ledger_token_assessments: before.ledger_token_assessments.length - after.ledger_token_assessments.length,
        ledger_events: before.ledger_events.length - after.ledger_events.length,
        ledger_checkpoints: before.ledger_checkpoints.length - after.ledger_checkpoints.length
      },
      state: after
    };
  }

  appendEvent(pointer: EventPointer): void {
    this.#state.events = [...this.#state.events, pointer];
  }

  upsertDecision(pointer: DecisionPointer): void {
    this.#state.decisions = upsertById(this.#state.decisions, pointer);
  }

  upsertBrief(pointer: BriefPointer): void {
    this.#state.briefs = upsertById(this.#state.briefs, pointer);
  }

  appendLedger(pointer: LedgerPointer): void {
    this.#state.ledger = [...this.#state.ledger, pointer];
  }

  upsertLedgerTask(task: TaskEntry): void {
    this.#state.ledger_tasks = upsertByKey(this.#state.ledger_tasks, task, "task_id");
  }

  upsertLedgerTokenUsage(tokenUsage: TokenUsage): void {
    this.#state.ledger_token_usage = upsertByKey(this.#state.ledger_token_usage, tokenUsage, "task_id");
  }

  upsertLedgerTokenAssessment(assessment: TokenAssessment): void {
    this.#state.ledger_token_assessments = upsertByKey(this.#state.ledger_token_assessments, assessment, "task_id");
  }

  appendLedgerEvent(event: LedgerEvent): void {
    this.#state.ledger_events = [...this.#state.ledger_events, event];
  }

  upsertLedgerCheckpoint(checkpoint: Checkpoint): void {
    this.#state.ledger_checkpoints = upsertByKey(this.#state.ledger_checkpoints, checkpoint, "checkpoint_id");
  }

  upsertProject(project: LocalProject): void {
    this.#state.projects = upsertById(this.#state.projects, project);
  }

  removeProject(id: string): LocalProject | undefined {
    const project = this.#state.projects.find((item) => item.id === id);
    if (project === undefined) {
      return undefined;
    }

    this.#state.projects = this.#state.projects.filter((item) => item.id !== id);
    if (this.#state.active_project_id === id) {
      const fallback = this.#state.projects[0];
      if (fallback === undefined) {
        delete this.#state.active_project_id;
      } else {
        this.#state.active_project_id = fallback.id;
      }
    }
    return project;
  }

  setActiveProject(id: string | undefined): boolean {
    if (id !== undefined && !this.#state.projects.some((project) => project.id === id)) {
      return false;
    }
    const previous = this.#state.active_project_id;
    if (id === undefined) {
      delete this.#state.active_project_id;
    } else {
      this.#state.active_project_id = id;
    }
    return this.#state.active_project_id !== previous;
  }

  expire(now: Date): void {
    const timestamp = now.getTime();
    this.#state.presence = this.#state.presence.filter((presence) => Date.parse(presence.expires_at) > timestamp);
    this.#state.claims = this.#state.claims.filter((claim) => Date.parse(claim.expires_at) > timestamp);
  }
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) {
    return [...items, item];
  }

  const next = [...items];
  next[index] = item;
  return next;
}

function upsertByKey<T, K extends keyof T>(items: T[], item: T, key: K): T[] {
  const index = items.findIndex((candidate) => candidate[key] === item[key]);
  if (index === -1) {
    return [...items, item];
  }

  const next = [...items];
  next[index] = item;
  return next;
}

function matchesContext(item: CoordinationContext, context: CoordinationContext): boolean {
  const keys = ["workspace_id", "repo_id", "session_id"] as const;
  return keys.some((key) => context[key] !== undefined) && keys.every((key) => {
    const expected = context[key];
    return expected === undefined || item[key] === expected;
  });
}

function matchesLedgerContext(
  item: { repo_id?: string; session_id?: string; workspace_id?: string },
  context: CoordinationContext
): boolean {
  const keys = ["workspace_id", "repo_id", "session_id"] as const;
  return keys.some((key) => context[key] !== undefined) && keys.every((key) => {
    const expected = context[key];
    return expected === undefined || item[key] === undefined || item[key] === expected;
  });
}
