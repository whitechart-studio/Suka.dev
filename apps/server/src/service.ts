import { checkConflicts, type ConflictSubject, type ConflictWarning } from "@suka/conflict-engine";
import {
  type BriefPointer,
  type Checkpoint,
  type ClaimPointer,
  type DecisionPointer,
  type EventPointer,
  type LedgerEvent,
  type LedgerPointer,
  type LedgerBudgetPolicy,
  type LedgerPrivacyDefaults,
  type Pointer,
  type PresencePointer,
  type TaskEntry,
  type TokenEfficiencyRollup,
  type TokenAssessment,
  type TokenUsage,
  type CoordinationContext,
  type ValidationResult,
  validateCheckpoint,
  validateLedgerBudgetPolicy,
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
  listLedgerTokenEfficiencyRollups(filters?: LedgerRecordFilters, budgetPolicy?: LedgerBudgetPolicy): TokenEfficiencyRollup[];
  getLedgerGovernance(): { privacy_defaults: LedgerPrivacyDefaults };
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
  issue_id?: string;
}

export const DEFAULT_LEDGER_PRIVACY_DEFAULTS: LedgerPrivacyDefaults = {
  publish_file_paths: true,
  publish_diff_content: false,
  publish_terminal_logs: false,
  publish_prompt_text: false,
  retention_days: 7
};

export class LedgerBudgetPolicyError extends Error {
  readonly code = "invalid_ledger_budget";

  constructor(message = "Ledger budget policy validation failed.") {
    super(message);
    this.name = "LedgerBudgetPolicyError";
  }
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

    listLedgerTokenEfficiencyRollups(filters = {}, budgetPolicy) {
      if (budgetPolicy !== undefined) {
        const result = validateLedgerBudgetPolicy(budgetPolicy);
        if (!result.ok) {
          throw new LedgerBudgetPolicyError();
        }
      }
      return [buildTokenEfficiencyRollup(filters, store.getState(), budgetPolicy)];
    },

    getLedgerGovernance() {
      return {
        privacy_defaults: DEFAULT_LEDGER_PRIVACY_DEFAULTS
      };
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

function buildTokenEfficiencyRollup(
  filters: LedgerRecordFilters,
  state: SukaState,
  budgetPolicy: LedgerBudgetPolicy | undefined
): TokenEfficiencyRollup {
  const tasks = state.ledger_tasks.filter((task) => matchesLedgerFilters(task, filters));
  const taskIds = new Set(tasks.map((task) => task.task_id));
  const tokenUsage = state.ledger_token_usage.filter((usage) => matchesTaskLinkedRecord(usage.task_id, taskIds, filters));
  const usageTaskIds = new Set(tokenUsage.map((usage) => usage.task_id));
  const assessments = state.ledger_token_assessments.filter((assessment) => usageTaskIds.has(assessment.task_id));
  const assessmentByTaskId = new Map(assessments.map((assessment) => [assessment.task_id, assessment]));
  const assessedTaskIds = tokenUsage
    .map((usage) => usage.task_id)
    .filter((taskId) => assessmentByTaskId.has(taskId));
  const unassessedTaskIds = tokenUsage
    .map((usage) => usage.task_id)
    .filter((taskId) => !assessmentByTaskId.has(taskId));
  const totals = {
    discarded_tokens: 0,
    estimated_cost: 0,
    input_tokens: 0,
    output_tokens: 0,
    rework_tokens: 0,
    total_tokens: 0,
    unassessed_tokens: 0,
    unknown_tokens: 0,
    useful_tokens: 0
  };

  for (const usage of tokenUsage) {
    totals.input_tokens += usage.input_tokens;
    totals.output_tokens += usage.output_tokens;
    totals.total_tokens += usage.total_tokens;
    totals.estimated_cost += usage.estimated_cost ?? 0;
    const assessment = assessmentByTaskId.get(usage.task_id);
    if (assessment === undefined) {
      totals.unassessed_tokens += usage.total_tokens;
      continue;
    }
    if (isUsefulTokenCategory(assessment.value_category)) {
      totals.useful_tokens += usage.total_tokens;
      continue;
    }
    if (assessment.value_category === "rework") {
      totals.rework_tokens += usage.total_tokens;
      continue;
    }
    if (assessment.value_category === "discarded") {
      totals.discarded_tokens += usage.total_tokens;
      continue;
    }
    totals.unknown_tokens += usage.total_tokens;
  }

  const rollup: TokenEfficiencyRollup = {
    scope: tokenEfficiencyScope(filters),
    related_task_ids: uniqueStrings(tokenUsage.map((usage) => usage.task_id)),
    assessed_task_ids: uniqueStrings(assessedTaskIds),
    unassessed_task_ids: uniqueStrings(unassessedTaskIds),
    totals
  };
  if (totals.total_tokens > 0) {
    rollup.useful_token_ratio = totals.useful_tokens / totals.total_tokens;
  }
  if (budgetPolicy !== undefined) {
    rollup.budget = buildBudgetStatus(totals.total_tokens, budgetPolicy);
  }
  return rollup;
}

function tokenEfficiencyScope(filters: LedgerRecordFilters): TokenEfficiencyRollup["scope"] {
  const scope: TokenEfficiencyRollup["scope"] = {};
  if (filters.workspace_id !== undefined) scope.workspace_id = filters.workspace_id;
  if (filters.repo_id !== undefined) scope.repo_id = filters.repo_id;
  if (filters.session_id !== undefined) scope.session_id = filters.session_id;
  if (filters.task_id !== undefined) scope.task_id = filters.task_id;
  if (filters.checkpoint_id !== undefined) scope.checkpoint_id = filters.checkpoint_id;
  if (filters.issue_id !== undefined) scope.issue_id = filters.issue_id;
  return scope;
}

function buildBudgetStatus(usedTokens: number, policy: LedgerBudgetPolicy): NonNullable<TokenEfficiencyRollup["budget"]> {
  const level = usedTokens >= policy.hard_limit_tokens ? "exceeded" :
    usedTokens >= policy.warning_threshold_tokens ? "warning" :
    "ok";
  return {
    hard_limit_tokens: policy.hard_limit_tokens,
    level,
    remaining_tokens: Math.max(policy.hard_limit_tokens - usedTokens, 0),
    used_tokens: usedTokens,
    utilization_ratio: policy.hard_limit_tokens === 0 ? 0 : usedTokens / policy.hard_limit_tokens,
    warning_threshold_tokens: policy.warning_threshold_tokens
  };
}

function isUsefulTokenCategory(category: TokenAssessment["value_category"]): boolean {
  return category === "delivery" ||
    category === "planning" ||
    category === "review" ||
    category === "handoff";
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
  item: {
    repo_id?: string;
    session_id?: string;
    workspace_id?: string;
    task_id?: string;
    related_checkpoint_ids?: string[];
    related_issue_ids?: string[];
  },
  filters: LedgerRecordFilters
): boolean {
  return (filters.workspace_id === undefined || item.workspace_id === undefined || item.workspace_id === filters.workspace_id) &&
    (filters.repo_id === undefined || item.repo_id === filters.repo_id) &&
    (filters.session_id === undefined || item.session_id === filters.session_id) &&
    (filters.task_id === undefined || item.task_id === filters.task_id) &&
    (filters.checkpoint_id === undefined || item.related_checkpoint_ids?.includes(filters.checkpoint_id) === true) &&
    (filters.issue_id === undefined || readRelatedIssueIds(item).includes(filters.issue_id));
}

function hasLedgerFilter(filters: LedgerRecordFilters): boolean {
  return filters.workspace_id !== undefined ||
    filters.repo_id !== undefined ||
    filters.session_id !== undefined ||
    filters.task_id !== undefined ||
    filters.checkpoint_id !== undefined ||
    filters.issue_id !== undefined;
}

function matchesCheckpointFilters(checkpoint: Checkpoint, filters: LedgerRecordFilters): boolean {
  return (filters.repo_id === undefined || checkpoint.repo_id === filters.repo_id) &&
    (filters.issue_id === undefined || checkpoint.related_issue_ids.includes(filters.issue_id));
}

function readRelatedIssueIds(item: { related_issue_ids?: string[] }): string[] {
  return item.related_issue_ids ?? [];
}
