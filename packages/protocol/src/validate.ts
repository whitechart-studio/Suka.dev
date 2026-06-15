import {
  DECISION_CONFIDENCE_LEVELS,
  DECISION_STATUSES,
  EVENT_TYPES,
  POINTER_TYPES,
  PRESENCE_STATUSES
} from "./constants.js";
import type {
  BriefPointer,
  ClaimKind,
  ClaimPointer,
  DecisionPointer,
  EventPointer,
  Pointer,
  PointerScope,
  PresencePointer,
  ValidationIssue,
  ValidationResult
} from "./types.js";

type MutableIssueList = ValidationIssue[];
const CLAIM_KINDS = ["soft_claim", "blocked_scope"] as const satisfies readonly ClaimKind[];

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

function optionalNonEmptyString(record: Record<string, unknown>, key: string, issues: MutableIssueList): void {
  if (record[key] !== undefined && (typeof record[key] !== "string" || record[key].length === 0)) {
    issues.push({
      code: "invalid_type",
      path: key,
      message: `${key} must be a non-empty string when provided.`
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

function requireEnum<T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  allowed: T,
  issues: MutableIssueList
): void {
  if (typeof record[key] !== "string" || !allowed.includes(record[key])) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_value",
      path: key,
      message: `${key} must be one of: ${allowed.join(", ")}.`
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

function optionalTimestamp(record: Record<string, unknown>, key: string, issues: MutableIssueList): void {
  optionalString(record, key, issues);
  if (typeof record[key] === "string" && Number.isNaN(Date.parse(record[key]))) {
    issues.push({
      code: "invalid_timestamp",
      path: key,
      message: `${key} must be a valid ISO timestamp when provided.`
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
