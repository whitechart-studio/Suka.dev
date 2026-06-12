import type { ClaimPointer, PointerScope } from "@suka/protocol";
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

  for (const claim of input.active_claims) {
    warnings.push(...checkClaim(input.subject, claim));
  }

  return warnings.sort(compareSeverity);
}

function checkClaim(subject: ConflictSubject, claim: ClaimPointer): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];

  const subjectPaths = subject.paths?.map(normalizeRepoPath) ?? [];
  const claimPaths = claim.scope.paths?.map(normalizeRepoPath) ?? [];
  const sameFileMatches = subjectPaths.filter((path) => claimPaths.includes(path));

  if (sameFileMatches.length > 0) {
    warnings.push(
      warning("high", "same_file", `Active claim touches the same file: ${sameFileMatches[0]}.`, {
        paths: sameFileMatches
      }, claim, subject)
    );
  } else {
    const overlappingPaths = subjectPaths.filter((path) =>
      claimPaths.some((pattern) => pathsOverlap(pattern, path) || pathsOverlap(path, pattern))
    );
    if (overlappingPaths.length > 0) {
      warnings.push(
        warning("medium", "path_overlap", `Active claim overlaps ${overlappingPaths[0]}.`, {
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
  return [
    warning(severity, reason, `Active claim overlaps ${label}: ${matches[0]}.`, {
      [scopeKey]: matches
    }, claim, subject)
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

