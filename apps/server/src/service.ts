import { checkConflicts, type ConflictSubject, type ConflictWarning } from "@suka/conflict-engine";
import {
  type BriefPointer,
  type Checkpoint,
  type ClaimPointer,
  type DecisionPointer,
  type EventPointer,
  type LedgerEvent,
  type LedgerPointer,
  type Pointer,
  type PresencePointer,
  type TaskEntry,
  type TokenAssessment,
  type TokenUsage,
  type CoordinationContext,
  type ValidationResult,
  validateCheckpoint,
  validateLedgerEvent,
  validatePointer,
  validateTaskEntry,
  validateTokenAssessment,
  validateTokenUsage
} from "@suka/protocol";
import { MemorySukaStore, type SukaStore } from "./memory-store.js";
import { buildLocalProjectFromMetadata, inspectLocalProject, type LocalProjectInput } from "./projects.js";
import type { LocalProject, SukaState } from "./state.js";
import { buildTeamSummary } from "./team.js";

export interface SukaService {
  getState(): SukaState;
  getTeamSummary(): ReturnType<typeof buildTeamSummary>;
  listLedger(): LedgerPointer[];
  listLedgerTasks(filters?: LedgerRecordFilters): TaskEntry[];
  listLedgerTokenUsage(filters?: LedgerRecordFilters): TokenUsage[];
  listLedgerTokenAssessments(filters?: LedgerRecordFilters): TokenAssessment[];
  listLedgerEvents(filters?: LedgerRecordFilters): LedgerEvent[];
  listLedgerCheckpoints(filters?: LedgerRecordFilters): Checkpoint[];
  listLedgerCheckpointSummaries(filters?: LedgerRecordFilters): LedgerCheckpointSummary[];
  listProjects(): LocalProject[];
  getActiveProject(): LocalProject | undefined;
  registerProject(input: LocalProjectInput): LocalProject;
  activateProject(id: string): LocalProject | undefined;
  removeProject(id: string): LocalProject | undefined;
  publish(pointer: unknown): ValidationResult<Pointer>;
  recordLedgerTask(task: unknown): ValidationResult<TaskEntry>;
  recordLedgerTokenUsage(tokenUsage: unknown): ValidationResult<TokenUsage>;
  recordLedgerTokenAssessment(assessment: unknown): ValidationResult<TokenAssessment>;
  recordLedgerEvent(event: unknown): ValidationResult<LedgerEvent>;
  recordLedgerCheckpoint(checkpoint: unknown): ValidationResult<Checkpoint>;
  checkConflicts(subject: ConflictSubject): ConflictWarning[];
  releaseClaim(id: string): boolean;
  cleanup(context: CoordinationContext): ReturnType<SukaStore["cleanup"]>;
  expire(now?: Date): void;
}

export interface LedgerRecordFilters extends CoordinationContext {
  task_id?: string;
  checkpoint_id?: string;
}

export interface LedgerCheckpointSummary {
  checkpoint: Checkpoint;
  related_task_ids: string[];
  related_issue_ids: string[];
  related_session_ids: string[];
  affected_paths: string[];
  event_ids: string[];
  token_usage: TokenUsage[];
  token_assessments: TokenAssessment[];
  totals: {
    estimated_cost: number;
    events: number;
    input_tokens: number;
    output_tokens: number;
    tasks: number;
    total_tokens: number;
  };
}

export function createSukaService(store: SukaStore = new MemorySukaStore()): SukaService {
  return {
    getState() {
      return store.getState();
    },

    getTeamSummary() {
      return buildTeamSummary(store.getState());
    },

    listLedger() {
      return store.getState().ledger;
    },

    listLedgerTasks(filters = {}) {
      return store.getState().ledger_tasks.filter((task) => matchesLedgerFilters(task, filters));
    },

    listLedgerTokenUsage(filters = {}) {
      const taskIds = taskIdsForFilters(store.getState().ledger_tasks, filters);
      return store.getState().ledger_token_usage.filter((tokenUsage) => matchesTaskLinkedRecord(tokenUsage.task_id, taskIds, filters));
    },

    listLedgerTokenAssessments(filters = {}) {
      const taskIds = taskIdsForFilters(store.getState().ledger_tasks, filters);
      return store.getState().ledger_token_assessments.filter((assessment) => {
        return matchesTaskLinkedRecord(assessment.task_id, taskIds, filters);
      });
    },

    listLedgerEvents(filters = {}) {
      return store.getState().ledger_events.filter((event) => matchesLedgerFilters(event, filters));
    },

    listLedgerCheckpoints(filters = {}) {
      return store.getState().ledger_checkpoints.filter((checkpoint) => {
        return matchesCheckpointFilters(checkpoint, filters) &&
          (filters.checkpoint_id === undefined || checkpoint.checkpoint_id === filters.checkpoint_id) &&
          (filters.task_id === undefined || checkpoint.related_task_ids.includes(filters.task_id)) &&
          (filters.session_id === undefined || checkpoint.related_session_ids.includes(filters.session_id));
      });
    },

    listLedgerCheckpointSummaries(filters = {}) {
      const state = store.getState();
      return state.ledger_checkpoints
        .filter((checkpoint) => {
          return matchesCheckpointFilters(checkpoint, filters) &&
            (filters.checkpoint_id === undefined || checkpoint.checkpoint_id === filters.checkpoint_id) &&
            (filters.session_id === undefined || checkpoint.related_session_ids.includes(filters.session_id));
        })
        .map((checkpoint) => buildCheckpointSummary(checkpoint, state))
        .filter((summary) => {
          return (filters.task_id === undefined || summary.related_task_ids.includes(filters.task_id)) &&
            (filters.session_id === undefined || summary.related_session_ids.includes(filters.session_id));
        });
    },

    listProjects() {
      return store.getState().projects;
    },

    getActiveProject() {
      const state = store.getState();
      return state.projects.find((project) => project.id === state.active_project_id);
    },

    registerProject(input: LocalProjectInput) {
      const state = store.getState();
      const metadata = inspectLocalProject(input);
      const existing = state.projects.find((project) => project.path === metadata.path);
      const project = buildLocalProjectFromMetadata(metadata, input, existing);
      store.upsertProject(project);
      return project;
    },

    activateProject(id: string) {
      const state = store.getState();
      const project = state.projects.find((item) => item.id === id);
      if (project === undefined) {
        return undefined;
      }
      const timestamp = new Date().toISOString();
      const updated = {
        ...project,
        last_opened_at: timestamp,
        updated_at: timestamp
      };
      store.upsertProject(updated);
      const changed = store.setActiveProject(id);
      if (!changed && store.getState().active_project_id !== id) {
        return undefined;
      }
      return updated;
    },

    removeProject(id: string) {
      const project = store.getState().projects.find((item) => item.id === id);
      if (project === undefined) {
        return undefined;
      }

      store.cleanup({
        repo_id: project.repo_id,
        session_id: projectTrackingSessionId(project),
        workspace_id: project.workspace_id
      });
      return store.removeProject(id);
    },

    publish(pointer: unknown) {
      const result = validatePointer(pointer);
      if (!result.ok) {
        return result;
      }

      persistPointer(store, result.value);
      return result;
    },

    recordLedgerTask(task: unknown) {
      const result = validateTaskEntry(task);
      if (!result.ok) {
        return result;
      }

      store.upsertLedgerTask(result.value);
      return result;
    },

    recordLedgerTokenUsage(tokenUsage: unknown) {
      const result = validateTokenUsage(tokenUsage);
      if (!result.ok) {
        return result;
      }

      store.upsertLedgerTokenUsage(result.value);
      return result;
    },

    recordLedgerTokenAssessment(assessment: unknown) {
      const result = validateTokenAssessment(assessment);
      if (!result.ok) {
        return result;
      }

      store.upsertLedgerTokenAssessment(result.value);
      return result;
    },

    recordLedgerEvent(event: unknown) {
      const result = validateLedgerEvent(event);
      if (!result.ok) {
        return result;
      }

      store.appendLedgerEvent(result.value);
      return result;
    },

    recordLedgerCheckpoint(checkpoint: unknown) {
      const result = validateCheckpoint(checkpoint);
      if (!result.ok) {
        return result;
      }

      store.upsertLedgerCheckpoint(result.value);
      return result;
    },

    checkConflicts(subject: ConflictSubject) {
      const state = store.getState();
      return checkConflicts({
        subject,
        active_claims: state.claims,
        active_presence: state.presence,
        recent_events: state.events
      });
    },

    releaseClaim(id: string) {
      return store.releaseClaim(id);
    },

    cleanup(context: CoordinationContext) {
      return store.cleanup(context);
    },

    expire(now = new Date()) {
      store.expire(now);
    }
  };
}

function persistPointer(store: SukaStore, pointer: Pointer): void {
  switch (pointer.type) {
    case "presence":
      store.upsertPresence(pointer as PresencePointer);
      return;
    case "claim":
      store.upsertClaim(pointer as ClaimPointer);
      return;
    case "event":
      store.appendEvent(pointer as EventPointer);
      return;
    case "decision":
      store.upsertDecision(pointer as DecisionPointer);
      return;
    case "brief":
      store.upsertBrief(pointer as BriefPointer);
      return;
    case "ledger":
      store.appendLedger(pointer as LedgerPointer);
      return;
  }
}

function projectTrackingSessionId(project: LocalProject): string {
  return `project-tracking-${project.id}`;
}

function taskIdsForFilters(tasks: TaskEntry[], filters: LedgerRecordFilters): Set<string> {
  return new Set(tasks.filter((task) => matchesLedgerFilters(task, filters)).map((task) => task.task_id));
}

function buildCheckpointSummary(checkpoint: Checkpoint, state: SukaState): LedgerCheckpointSummary {
  const tasks = state.ledger_tasks.filter((task) =>
    checkpoint.related_task_ids.includes(task.task_id) || task.related_checkpoint_ids.includes(checkpoint.checkpoint_id)
  );
  const taskIds = uniqueStrings([...checkpoint.related_task_ids, ...tasks.map((task) => task.task_id)]);
  const events = state.ledger_events.filter((event) => event.task_id !== undefined && taskIds.includes(event.task_id));
  const tokenUsage = state.ledger_token_usage.filter((usage) => taskIds.includes(usage.task_id));
  const tokenAssessments = state.ledger_token_assessments.filter((assessment) => taskIds.includes(assessment.task_id));

  return {
    checkpoint,
    related_task_ids: taskIds,
    related_issue_ids: uniqueStrings([
      ...checkpoint.related_issue_ids,
      ...tasks.flatMap((task) => task.related_issue_ids)
    ]),
    related_session_ids: uniqueStrings([
      ...checkpoint.related_session_ids,
      ...tasks.map((task) => task.session_id),
      ...events.map((event) => event.session_id)
    ]),
    affected_paths: uniqueStrings(events.flatMap((event) => event.affected_paths)),
    event_ids: events.map((event) => event.event_id),
    token_usage: tokenUsage,
    token_assessments: tokenAssessments,
    totals: {
      estimated_cost: tokenUsage.reduce((total, usage) => total + (usage.estimated_cost ?? 0), 0),
      events: events.length,
      input_tokens: tokenUsage.reduce((total, usage) => total + usage.input_tokens, 0),
      output_tokens: tokenUsage.reduce((total, usage) => total + usage.output_tokens, 0),
      tasks: tasks.length,
      total_tokens: tokenUsage.reduce((total, usage) => total + usage.total_tokens, 0)
    }
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function matchesTaskLinkedRecord(taskId: string, taskIds: Set<string>, filters: LedgerRecordFilters): boolean {
  if (filters.task_id !== undefined) {
    return taskId === filters.task_id;
  }
  if (hasLedgerFilter(filters)) {
    return taskIds.has(taskId);
  }
  return true;
}

function matchesLedgerFilters(
  item: { repo_id?: string; session_id?: string; workspace_id?: string; task_id?: string; related_checkpoint_ids?: string[] },
  filters: LedgerRecordFilters
): boolean {
  return (filters.workspace_id === undefined || item.workspace_id === undefined || item.workspace_id === filters.workspace_id) &&
    (filters.repo_id === undefined || item.repo_id === filters.repo_id) &&
    (filters.session_id === undefined || item.session_id === filters.session_id) &&
    (filters.task_id === undefined || item.task_id === filters.task_id) &&
    (filters.checkpoint_id === undefined || item.related_checkpoint_ids?.includes(filters.checkpoint_id) === true);
}

function hasLedgerFilter(filters: LedgerRecordFilters): boolean {
  return filters.workspace_id !== undefined ||
    filters.repo_id !== undefined ||
    filters.session_id !== undefined ||
    filters.task_id !== undefined ||
    filters.checkpoint_id !== undefined;
}

function matchesCheckpointFilters(checkpoint: Checkpoint, filters: LedgerRecordFilters): boolean {
  return filters.repo_id === undefined || checkpoint.repo_id === filters.repo_id;
}
