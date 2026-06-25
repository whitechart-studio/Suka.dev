import {
  DECISION_CONFIDENCE_LEVELS,
  DECISION_STATUSES,
  EVENT_TYPES,
  LEDGER_CHECKPOINT_KINDS,
  LEDGER_CHECKPOINT_STATUSES,
  LEDGER_EVENT_SEVERITIES,
  LEDGER_EVENT_TYPES,
  LEDGER_TASK_STATUSES,
  LEDGER_TASK_TYPES,
  LEDGER_TOKEN_ASSESSORS,
  LEDGER_TOKEN_CONFIDENCE_LEVELS,
  LEDGER_TOKEN_CURRENCIES,
  LEDGER_TOKEN_MEASUREMENT_SOURCES,
  LEDGER_TOKEN_PROVIDERS,
  LEDGER_TOKEN_VALUE_CATEGORIES,
  POINTER_TYPES,
  PRESENCE_STATUSES
} from "./constants.js";
import type {
  BriefPointer,
  Checkpoint,
  ClaimKind,
  ClaimPointer,
  DecisionPointer,
  EventPointer,
  LedgerEvent,
  LedgerPointer,
  LedgerBudgetPolicy,
  LedgerPrivacyDefaults,
  Pointer,
  PointerScope,
  PresenceSourceKind,
  PresencePointer,
  TaskEntry,
  TokenAssessment,
  TokenUsage,
  ValidationIssue,
  ValidationResult
} from "./types.js";

type MutableIssueList = ValidationIssue[];
const CLAIM_KINDS = ["soft_claim", "blocked_scope"] as const satisfies readonly ClaimKind[];
const PRESENCE_SOURCE_KINDS = ["manual", "detected"] as const satisfies readonly PresenceSourceKind[];
const LEDGER_BUDGET_SCOPES = ["session", "task"] as const;

export function validatePointer(value: unknown): ValidationResult<Pointer> {
  const issues: MutableIssueList = [];

  if (!isRecord(value)) {
    return fail([
      {
        code: "invalid_type",
        path: "$",
        message: "Pointer must be an object."
      }
    ]);
  }

  requireEnum(value, "type", POINTER_TYPES, issues);
  if (issues.length > 0) {
    return fail(issues);
  }

  switch (value.type) {
    case "presence":
      return validatePresencePointer(value);
    case "claim":
      return validateClaimPointer(value);
    case "event":
      return validateEventPointer(value);
    case "decision":
      return validateDecisionPointer(value);
    case "brief":
      return validateBriefPointer(value);
    case "ledger":
      return validateLedgerPointer(value);
    default:
      return fail([
        {
          code: "invalid_value",
          path: "type",
          message: "Unsupported pointer type."
        }
      ]);
  }
}

export function validatePresencePointer(value: unknown): ValidationResult<PresencePointer> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "id", issues);
  optionalContext(value, issues);
  requireLiteral(value, "type", "presence", issues);
  requireString(value, "agent_id", issues);
  optionalString(value, "user_id", issues);
  requireString(value, "tool", issues);
  optionalPresenceSource(value, issues);
  requireString(value, "repo", issues);
  optionalString(value, "branch", issues);
  optionalString(value, "task", issues);
  requireEnum(value, "status", PRESENCE_STATUSES, issues);
  requireStringArray(value, "current_files", issues);
  requireTimestamp(value, "last_seen", issues);
  requireTimestamp(value, "expires_at", issues);

  return issues.length === 0 ? ok(value as unknown as PresencePointer) : fail(issues);
}

export function validateClaimPointer(value: unknown): ValidationResult<ClaimPointer> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "id", issues);
  optionalContext(value, issues);
  requireLiteral(value, "type", "claim", issues);
  requireString(value, "agent_id", issues);
  requireScope(value, "scope", issues);
  requireString(value, "reason", issues);
  requireEnum(value, "kind", CLAIM_KINDS, issues);
  requireTimestamp(value, "created_at", issues);
  requireTimestamp(value, "expires_at", issues);

  return issues.length === 0 ? ok(value as unknown as ClaimPointer) : fail(issues);
}

export function validateEventPointer(value: unknown): ValidationResult<EventPointer> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "id", issues);
  optionalContext(value, issues);
  requireLiteral(value, "type", "event", issues);
  requireEnum(value, "event_type", EVENT_TYPES, issues);
  requireString(value, "summary", issues);
  requireStringArray(value, "affected_paths", issues);
  requireStringArray(value, "affected_apis", issues);
  requireStringArray(value, "affected_tables", issues);
  requireStringArray(value, "affected_env", issues);
  requireString(value, "agent_id", issues);
  requireTimestamp(value, "created_at", issues);

  return issues.length === 0 ? ok(value as unknown as EventPointer) : fail(issues);
}

export function validateDecisionPointer(value: unknown): ValidationResult<DecisionPointer> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "id", issues);
  optionalContext(value, issues);
  requireLiteral(value, "type", "decision", issues);
  requireString(value, "title", issues);
  requireString(value, "body", issues);
  requireScope(value, "scope", issues);
  requireEnum(value, "status", DECISION_STATUSES, issues);
  requireEnum(value, "confidence", DECISION_CONFIDENCE_LEVELS, issues);
  requireStringArray(value, "evidence", issues);
  requireString(value, "created_by", issues);
  optionalString(value, "approved_by", issues);
  requireTimestamp(value, "created_at", issues);
  optionalTimestamp(value, "updated_at", issues);

  if (value.status === "accepted" && Array.isArray(value.evidence) && value.evidence.length === 0) {
    issues.push({
      code: "invalid_value",
      path: "evidence",
      message: "Accepted decisions require at least one evidence reference."
    });
  }

  return issues.length === 0 ? ok(value as unknown as DecisionPointer) : fail(issues);
}

export function validateBriefPointer(value: unknown): ValidationResult<BriefPointer> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "id", issues);
  optionalContext(value, issues);
  requireLiteral(value, "type", "brief", issues);
  requireString(value, "agent_id", issues);
  requireString(value, "summary", issues);
  requireStringArray(value, "changed_files", issues);
  requireStringArray(value, "decisions_made", issues);
  requireStringArray(value, "assumptions", issues);
  requireStringArray(value, "skipped_work", issues);
  requireStringArray(value, "risks", issues);
  requireStringArray(value, "blockers", issues);
  requireString(value, "next_action", issues);
  requireStringArray(value, "related_claims", issues);
  requireStringArray(value, "related_sessions", issues);
  optionalString(value, "worktree", issues);
  requireTimestamp(value, "created_at", issues);

  return issues.length === 0 ? ok(value as unknown as BriefPointer) : fail(issues);
}

export function validateLedgerPointer(value: unknown): ValidationResult<LedgerPointer> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "id", issues);
  requireString(value, "workspace_id", issues);
  requireString(value, "repo_id", issues);
  requireString(value, "session_id", issues);
  requireLiteral(value, "type", "ledger", issues);
  requireString(value, "agent_id", issues);
  requireEnum(value, "event_type", EVENT_TYPES, issues);
  requireString(value, "summary", issues);
  requireStringArray(value, "affected_paths", issues);
  requireString(value, "branch", issues);
  requireString(value, "worktree", issues);
  optionalStringArray(value, "evidence", issues);
  optionalLedgerDiffStat(value, issues);
  optionalLedgerTokenUsage(value, issues);
  requireTimestamp(value, "created_at", issues);

  return issues.length === 0 ? ok(value as unknown as LedgerPointer) : fail(issues);
}

export function validateTaskEntry(value: unknown): ValidationResult<TaskEntry> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "task_id", issues);
  requireString(value, "session_id", issues);
  requireString(value, "repo_id", issues);
  optionalNonEmptyString(value, "workspace_id", issues);
  requireString(value, "title", issues);
  requireString(value, "intent_summary", issues);
  requireEnum(value, "task_type", LEDGER_TASK_TYPES, issues);
  requireEnum(value, "status", LEDGER_TASK_STATUSES, issues);
  requireTimestamp(value, "started_at", issues);
  optionalTimestamp(value, "completed_at", issues);
  requireStringArray(value, "related_issue_ids", issues);
  requireStringArray(value, "related_claim_ids", issues);
  requireStringArray(value, "related_checkpoint_ids", issues);

  return issues.length === 0 ? ok(value as unknown as TaskEntry) : fail(issues);
}

export function validateTokenUsage(value: unknown): ValidationResult<TokenUsage> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "task_id", issues);
  requireEnum(value, "provider", LEDGER_TOKEN_PROVIDERS, issues);
  optionalNonEmptyString(value, "model", issues);
  requireNonNegativeInteger(value, "input_tokens", issues);
  requireNonNegativeInteger(value, "output_tokens", issues);
  optionalNonNegativeInteger(value, "cached_input_tokens", issues);
  optionalNonNegativeInteger(value, "reasoning_tokens", issues);
  optionalNonNegativeInteger(value, "tool_call_tokens", issues);
  requireNonNegativeInteger(value, "total_tokens", issues);
  optionalNonNegativeNumber(value, "estimated_cost", issues);
  optionalEnum(value, "currency", LEDGER_TOKEN_CURRENCIES, issues);
  requireEnum(value, "measurement_source", LEDGER_TOKEN_MEASUREMENT_SOURCES, issues);

  return issues.length === 0 ? ok(value as unknown as TokenUsage) : fail(issues);
}

export function validateTokenAssessment(value: unknown): ValidationResult<TokenAssessment> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "task_id", issues);
  requireEnum(value, "value_category", LEDGER_TOKEN_VALUE_CATEGORIES, issues);
  optionalIntegerRange(value, "usefulness_score", 0, 100, issues);
  requireEnum(value, "assessed_by", LEDGER_TOKEN_ASSESSORS, issues);
  requireEnum(value, "confidence", LEDGER_TOKEN_CONFIDENCE_LEVELS, issues);
  optionalNonEmptyString(value, "reason", issues);

  return issues.length === 0 ? ok(value as unknown as TokenAssessment) : fail(issues);
}

export function validateLedgerEvent(value: unknown): ValidationResult<LedgerEvent> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "event_id", issues);
  optionalNonEmptyString(value, "task_id", issues);
  requireString(value, "session_id", issues);
  requireString(value, "repo_id", issues);
  requireEnum(value, "event_type", LEDGER_EVENT_TYPES, issues);
  requireTimestamp(value, "timestamp", issues);
  requireString(value, "summary", issues);
  requireEnum(value, "severity", LEDGER_EVENT_SEVERITIES, issues);
  requireStringArray(value, "affected_paths", issues);
  optionalRecord(value, "metadata", issues);

  return issues.length === 0 ? ok(value as unknown as LedgerEvent) : fail(issues);
}

export function validateCheckpoint(value: unknown): ValidationResult<Checkpoint> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireString(value, "checkpoint_id", issues);
  requireString(value, "repo_id", issues);
  requireEnum(value, "kind", LEDGER_CHECKPOINT_KINDS, issues);
  optionalNonEmptyString(value, "external_id", issues);
  requireString(value, "title", issues);
  requireEnum(value, "status", LEDGER_CHECKPOINT_STATUSES, issues);
  requireTimestamp(value, "created_at", issues);
  optionalTimestamp(value, "completed_at", issues);
  requireStringArray(value, "related_task_ids", issues);
  requireStringArray(value, "related_issue_ids", issues);
  requireStringArray(value, "related_session_ids", issues);
  requireString(value, "summary", issues);

  return issues.length === 0 ? ok(value as unknown as Checkpoint) : fail(issues);
}

export function validateLedgerPrivacyDefaults(value: unknown): ValidationResult<LedgerPrivacyDefaults> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireBoolean(value, "publish_file_paths", issues);
  requireBoolean(value, "publish_diff_content", issues);
  requireBoolean(value, "publish_terminal_logs", issues);
  requireBoolean(value, "publish_prompt_text", issues);
  requireNonNegativeInteger(value, "retention_days", issues);

  return issues.length === 0 ? ok(value as unknown as LedgerPrivacyDefaults) : fail(issues);
}

export function validateLedgerBudgetPolicy(value: unknown): ValidationResult<LedgerBudgetPolicy> {
  const issues: MutableIssueList = [];
  if (!isRecord(value)) {
    return failObject();
  }

  requireEnum(value, "scope", LEDGER_BUDGET_SCOPES, issues);
  requireNonNegativeInteger(value, "warning_threshold_tokens", issues);
  requireNonNegativeInteger(value, "hard_limit_tokens", issues);

  if (
    Number.isInteger(value.warning_threshold_tokens) &&
    Number.isInteger(value.hard_limit_tokens) &&
    Number(value.warning_threshold_tokens) > Number(value.hard_limit_tokens)
  ) {
    issues.push({
      code: "invalid_value",
      path: "warning_threshold_tokens",
      message: "warning_threshold_tokens cannot exceed hard_limit_tokens."
    });
  }

  return issues.length === 0 ? ok(value as unknown as LedgerBudgetPolicy) : fail(issues);
}

function optionalPresenceSource(record: Record<string, unknown>, issues: MutableIssueList): void {
  const value = record.source;
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    issues.push({
      code: "invalid_type",
      path: "source",
      message: "source must be an object when provided."
    });
    return;
  }

  requireEnum(value, "kind", PRESENCE_SOURCE_KINDS, issues, "source.kind");
  optionalNonEmptyString(value, "detector", issues, "source.detector");
  optionalPositiveInteger(value, "pid", issues, "source.pid");
  optionalNonEmptyString(value, "cwd", issues, "source.cwd");
  optionalTimestamp(value, "detected_at", issues, "source.detected_at");

  if (value.kind === "detected" && value.detector === undefined) {
    issues.push({
      code: "missing_field",
      path: "source.detector",
      message: "source.detector is required for detected presence."
    });
  }
}

function optionalLedgerDiffStat(record: Record<string, unknown>, issues: MutableIssueList): void {
  const value = record.diff_stat;
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    issues.push({
      code: "invalid_type",
      path: "diff_stat",
      message: "diff_stat must be an object when provided."
    });
    return;
  }

  requireNonNegativeInteger(value, "files_changed", issues, "diff_stat.files_changed");
  requireNonNegativeInteger(value, "additions", issues, "diff_stat.additions");
  requireNonNegativeInteger(value, "deletions", issues, "diff_stat.deletions");
}

function optionalLedgerTokenUsage(record: Record<string, unknown>, issues: MutableIssueList): void {
  const value = record.token_usage;
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    issues.push({
      code: "invalid_type",
      path: "token_usage",
      message: "token_usage must be an object when provided."
    });
    return;
  }

  requireNonNegativeInteger(value, "input_tokens", issues, "token_usage.input_tokens");
  requireNonNegativeInteger(value, "output_tokens", issues, "token_usage.output_tokens");
  optionalNonNegativeInteger(value, "total_tokens", issues, "token_usage.total_tokens");
  optionalNonNegativeNumber(value, "estimated_cost_usd", issues, "token_usage.estimated_cost_usd");
  optionalNonEmptyString(value, "model", issues, "token_usage.model");
}

function requireScope(record: Record<string, unknown>, key: string, issues: MutableIssueList): void {
  const value = record[key];
  if (!isRecord(value)) {
    issues.push({
      code: value === undefined ? "missing_field" : "invalid_type",
      path: key,
      message: `${key} must be an object.`
    });
    return;
  }

  for (const scopeKey of ["paths", "apis", "domains", "tables", "env"] as const) {
    if (value[scopeKey] !== undefined && !isStringArray(value[scopeKey])) {
      issues.push({
        code: "invalid_type",
        path: `${key}.${scopeKey}`,
        message: `${key}.${scopeKey} must be an array of strings.`
      });
    }
  }

  if (!hasAnyScope(value as PointerScope)) {
    issues.push({
      code: "empty_scope",
      path: key,
      message: `${key} must include at least one paths, apis, domains, tables, or env value.`
    });
  }
}

export function hasAnyScope(scope: PointerScope): boolean {
  return [scope.paths, scope.apis, scope.domains, scope.tables, scope.env].some(
    (items) => Array.isArray(items) && items.length > 0
  );
}

function optionalContext(record: Record<string, unknown>, issues: MutableIssueList): void {
  optionalNonEmptyString(record, "workspace_id", issues);
  optionalNonEmptyString(record, "repo_id", issues);
  optionalNonEmptyString(record, "session_id", issues);
}

function requireString(record: Record<string, unknown>, key: string, issues: MutableIssueList): void {
  if (typeof record[key] !== "string" || record[key].length === 0) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_type",
      path: key,
      message: `${key} must be a non-empty string.`
    });
  }
}

function optionalString(record: Record<string, unknown>, key: string, issues: MutableIssueList): void {
  if (record[key] !== undefined && typeof record[key] !== "string") {
    issues.push({
      code: "invalid_type",
      path: key,
      message: `${key} must be a string when provided.`
    });
  }
}

function optionalNonEmptyString(record: Record<string, unknown>, key: string, issues: MutableIssueList, path = key): void {
  if (record[key] !== undefined && (typeof record[key] !== "string" || record[key].length === 0)) {
    issues.push({
      code: "invalid_type",
      path,
      message: `${path} must be a non-empty string when provided.`
    });
  }
}

function optionalPositiveInteger(record: Record<string, unknown>, key: string, issues: MutableIssueList, path = key): void {
  if (record[key] !== undefined && (!Number.isInteger(record[key]) || Number(record[key]) <= 0)) {
    issues.push({
      code: "invalid_type",
      path,
      message: `${path} must be a positive integer when provided.`
    });
  }
}

function requireBoolean(record: Record<string, unknown>, key: string, issues: MutableIssueList, path = key): void {
  if (typeof record[key] !== "boolean") {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_type",
      path,
      message: `${path} must be a boolean.`
    });
  }
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string, issues: MutableIssueList, path = key): void {
  if (!Number.isInteger(record[key]) || Number(record[key]) < 0) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_type",
      path,
      message: `${path} must be a non-negative integer.`
    });
  }
}

function optionalNonNegativeInteger(record: Record<string, unknown>, key: string, issues: MutableIssueList, path = key): void {
  if (record[key] !== undefined && (!Number.isInteger(record[key]) || Number(record[key]) < 0)) {
    issues.push({
      code: "invalid_type",
      path,
      message: `${path} must be a non-negative integer when provided.`
    });
  }
}

function optionalNonNegativeNumber(record: Record<string, unknown>, key: string, issues: MutableIssueList, path = key): void {
  if (record[key] !== undefined && (typeof record[key] !== "number" || !Number.isFinite(record[key]) || record[key] < 0)) {
    issues.push({
      code: "invalid_type",
      path,
      message: `${path} must be a non-negative number when provided.`
    });
  }
}

function optionalIntegerRange(
  record: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  issues: MutableIssueList,
  path = key
): void {
  const value = record[key];
  if (value === undefined) {
    return;
  }
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    issues.push({
      code: "invalid_type",
      path,
      message: `${path} must be an integer between ${min} and ${max} when provided.`
    });
  }
}

function requireStringArray(record: Record<string, unknown>, key: string, issues: MutableIssueList): void {
  if (!isStringArray(record[key])) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_type",
      path: key,
      message: `${key} must be an array of strings.`
    });
  }
}

function optionalStringArray(record: Record<string, unknown>, key: string, issues: MutableIssueList): void {
  if (record[key] !== undefined && !isStringArray(record[key])) {
    issues.push({
      code: "invalid_type",
      path: key,
      message: `${key} must be an array of strings when provided.`
    });
  }
}

function optionalRecord(record: Record<string, unknown>, key: string, issues: MutableIssueList, path = key): void {
  if (record[key] !== undefined && !isRecord(record[key])) {
    issues.push({
      code: "invalid_type",
      path,
      message: `${path} must be an object when provided.`
    });
  }
}

function requireEnum<T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  allowed: T,
  issues: MutableIssueList,
  issuePath = key
): void {
  if (typeof record[key] !== "string" || !allowed.includes(record[key])) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_value",
      path: issuePath,
      message: `${issuePath} must be one of: ${allowed.join(", ")}.`
    });
  }
}

function optionalEnum<T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  allowed: T,
  issues: MutableIssueList,
  issuePath = key
): void {
  if (record[key] !== undefined && (typeof record[key] !== "string" || !allowed.includes(record[key]))) {
    issues.push({
      code: "invalid_value",
      path: issuePath,
      message: `${issuePath} must be one of: ${allowed.join(", ")} when provided.`
    });
  }
}

function requireLiteral(
  record: Record<string, unknown>,
  key: string,
  expected: string,
  issues: MutableIssueList
): void {
  if (record[key] !== expected) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_value",
      path: key,
      message: `${key} must be ${expected}.`
    });
  }
}

function requireTimestamp(record: Record<string, unknown>, key: string, issues: MutableIssueList): void {
  requireString(record, key, issues);
  if (typeof record[key] === "string" && Number.isNaN(Date.parse(record[key]))) {
    issues.push({
      code: "invalid_timestamp",
      path: key,
      message: `${key} must be a valid ISO timestamp.`
    });
  }
}

function optionalTimestamp(record: Record<string, unknown>, key: string, issues: MutableIssueList, path = key): void {
  if (record[key] === undefined) {
    return;
  }
  if (typeof record[key] !== "string") {
    issues.push({
      code: "invalid_type",
      path,
      message: `${path} must be a string when provided.`
    });
    return;
  }
  if (Number.isNaN(Date.parse(record[key]))) {
    issues.push({
      code: "invalid_timestamp",
      path,
      message: `${path} must be a valid ISO timestamp when provided.`
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function fail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

function failObject<T>(): ValidationResult<T> {
  return fail([
    {
      code: "invalid_type",
      path: "$",
      message: "Value must be an object."
    }
  ]);
}
