import type { ClaimPointer, EventPointer, PointerScope, PresencePointer } from "@suka/protocol";
import { normalizeRepoPath, pathsOverlap } from "./path.js";
import type {
  ConflictCheckInput,
  ConflictReason,
  ConflictSeverity,
  ConflictSubject,
  ConflictWarning
} from "./types.js";

export function checkConflicts(input: ConflictCheckInput): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];

  for (const claim of input.active_claims.filter((claim) => matchesContext(input.subject, claim))) {
    warnings.push(...checkClaim(input.subject, claim));
  }

  const subjectPresence = latestPresenceForSubject(input.subject, input.active_presence ?? []);
  for (const event of (input.recent_events ?? []).filter((event) => matchesContext(input.subject, event))) {
    warnings.push(...checkEvent(input.subject, event, subjectPresence));
  }

  return warnings.sort(compareSeverity);
}

function matchesContext(subject: ConflictSubject, pointer: ClaimPointer | EventPointer | PresencePointer): boolean {
  const contextKeys = ["workspace_id", "repo_id", "session_id"] as const;
  const scopedKeys = contextKeys.filter((key) => subject[key] !== undefined);
  if (scopedKeys.length === 0) {
    return true;
  }

  return scopedKeys.every((key) => pointer[key] === subject[key]);
}

function checkClaim(subject: ConflictSubject, claim: ClaimPointer): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];

  const subjectPaths = subject.paths?.map(normalizeRepoPath) ?? [];
  const claimPaths = claim.scope.paths?.map(normalizeRepoPath) ?? [];
  const sameFileMatches = subjectPaths.filter((path) => claimPaths.includes(path));

  if (sameFileMatches.length > 0) {
    warnings.push(
      warning(claimSeverity(claim, "high"), claimReason(claim, "same_file"), claimMessage(claim, `Active claim touches the same file: ${sameFileMatches[0]}.`), {
        paths: sameFileMatches
      }, claim, subject)
    );
  } else {
    const overlappingPaths = subjectPaths.filter((path) =>
      claimPaths.some((pattern) => pathsOverlap(pattern, path) || pathsOverlap(path, pattern))
    );
    if (overlappingPaths.length > 0) {
      warnings.push(
        warning(claimSeverity(claim, "medium"), claimReason(claim, "path_overlap"), claimMessage(claim, `Active claim overlaps ${overlappingPaths[0]}.`), {
          paths: overlappingPaths
        }, claim, subject)
      );
    }
  }

  warnings.push(...overlapWarnings("high", "api_overlap", "API", subject.apis, claim.scope.apis, claim, subject));
  warnings.push(
    ...overlapWarnings("high", "table_overlap", "database table", subject.tables, claim.scope.tables, claim, subject)
  );
  warnings.push(...overlapWarnings("high", "env_overlap", "environment variable", subject.env, claim.scope.env, claim, subject));
  warnings.push(...overlapWarnings("low", "domain_overlap", "domain", subject.domains, claim.scope.domains, claim, subject));

  return warnings;
}

function checkEvent(
  subject: ConflictSubject,
  event: EventPointer,
  subjectPresence: PresencePointer | undefined
): ConflictWarning[] {
  if (event.agent_id === subject.agent_id) {
    return [];
  }

  const threshold = eventThreshold(subject, subjectPresence);
  if (threshold !== undefined && Date.parse(event.created_at) <= threshold) {
    return [];
  }

  const warnings: ConflictWarning[] = [];
  const subjectPaths = subject.paths?.map(normalizeRepoPath) ?? [];
  const eventPaths = event.affected_paths.map(normalizeRepoPath);
  const overlappingPaths = subjectPaths.filter((path) =>
    eventPaths.some((eventPath) => pathsOverlap(eventPath, path) || pathsOverlap(path, eventPath))
  );
  if (overlappingPaths.length > 0) {
    const firstPath = overlappingPaths[0] as string;
    warnings.push(eventWarning("medium", "recent_file_change", recentEventMessage("file", event, firstPath), {
      paths: overlappingPaths
    }, event, subject));
  }

  warnings.push(...recentOverlapWarnings("high", "recent_api_change", "API", subject.apis, event.affected_apis, event, subject));
  warnings.push(
    ...recentOverlapWarnings("high", "recent_table_change", "database table", subject.tables, event.affected_tables, event, subject)
  );
  warnings.push(...recentOverlapWarnings("high", "recent_env_change", "environment variable", subject.env, event.affected_env, event, subject));

  return warnings;
}

function overlapWarnings(
  severity: ConflictSeverity,
  reason: ConflictReason,
  label: string,
  subjectValues: string[] | undefined,
  claimValues: string[] | undefined,
  claim: ClaimPointer,
  subject: ConflictSubject
): ConflictWarning[] {
  const subjectSet = new Set(subjectValues ?? []);
  const matches = (claimValues ?? []).filter((value) => subjectSet.has(value));
  if (matches.length === 0) {
    return [];
  }

  const scopeKey = scopeKeyForReason(reason);
  const warningReason = claimReason(claim, reason);
  return [
    warning(claimSeverity(claim, severity), warningReason, claimMessage(claim, `Active claim overlaps ${label}: ${matches[0]}.`), {
      [scopeKey]: matches
    }, claim, subject)
  ];
}

function claimSeverity(claim: ClaimPointer, severity: ConflictSeverity): ConflictSeverity {
  return claim.kind === "blocked_scope" ? "high" : severity;
}

function claimReason(claim: ClaimPointer, reason: ConflictReason): ConflictReason {
  return claim.kind === "blocked_scope" ? "blocked_scope" : reason;
}

function claimMessage(claim: ClaimPointer, message: string): string {
  return claim.kind === "blocked_scope" ? `Do-not-touch scope blocked by ${claim.agent_id}: ${claim.reason}.` : message;
}

function recentOverlapWarnings(
  severity: ConflictSeverity,
  reason: ConflictReason,
  label: string,
  subjectValues: string[] | undefined,
  eventValues: string[],
  event: EventPointer,
  subject: ConflictSubject
): ConflictWarning[] {
  const subjectSet = new Set(subjectValues ?? []);
  const matches = eventValues.filter((value) => subjectSet.has(value));
  if (matches.length === 0) {
    return [];
  }

  const scopeKey = scopeKeyForReason(reason);
  const firstMatch = matches[0] as string;
  return [
    eventWarning(severity, reason, recentEventMessage(label, event, firstMatch), {
      [scopeKey]: matches
    }, event, subject)
  ];
}

function warning(
  severity: ConflictSeverity,
  reason: ConflictReason,
  message: string,
  matched_scope: PointerScope,
  claim: ClaimPointer,
  subject: ConflictSubject
): ConflictWarning {
  return {
    severity,
    reason,
    message,
    matched_scope,
    pointers: [claim.id],
    subject
  };
}

function eventWarning(
  severity: ConflictSeverity,
  reason: ConflictReason,
  message: string,
  matched_scope: PointerScope,
  event: EventPointer,
  subject: ConflictSubject
): ConflictWarning {
  return {
    severity,
    reason,
    message,
    matched_scope,
    pointers: [event.id],
    subject
  };
}

function recentEventMessage(label: string, event: EventPointer, value: string): string {
  return `Recent ${label} change by ${event.agent_id}: ${value}.`;
}

function eventThreshold(subject: ConflictSubject, presence: PresencePointer | undefined): number | undefined {
  const timestamps = [subject.since, presence?.last_seen]
    .map((value) => value === undefined ? Number.NaN : Date.parse(value))
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) {
    return undefined;
  }
  return Math.max(...timestamps);
}

function latestPresenceForSubject(
  subject: ConflictSubject,
  presence: PresencePointer[]
): PresencePointer | undefined {
  if (subject.agent_id === undefined) {
    return undefined;
  }

  return presence
    .filter((item) => item.agent_id === subject.agent_id && matchesContext(subject, item))
    .sort((left, right) => Date.parse(right.last_seen) - Date.parse(left.last_seen))[0];
}

function scopeKeyForReason(reason: ConflictReason): keyof PointerScope {
  switch (reason) {
    case "api_overlap":
      return "apis";
    case "table_overlap":
      return "tables";
    case "env_overlap":
      return "env";
    case "domain_overlap":
      return "domains";
    case "recent_api_change":
      return "apis";
    case "recent_table_change":
      return "tables";
    case "recent_env_change":
      return "env";
    case "recent_file_change":
    case "blocked_scope":
    case "path_overlap":
    case "same_file":
      return "paths";
  }
}

function compareSeverity(left: ConflictWarning, right: ConflictWarning): number {
  return severityRank(right.severity) - severityRank(left.severity);
}

function severityRank(severity: ConflictSeverity): number {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}
