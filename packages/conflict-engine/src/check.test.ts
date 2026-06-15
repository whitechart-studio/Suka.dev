import test from "node:test";
import assert from "node:assert/strict";
import type { ClaimPointer, EventPointer, PresencePointer } from "@suka/protocol";
import { checkConflicts, normalizeRepoPath } from "./index.js";

const claim: ClaimPointer = {
  type: "claim",
  id: "ptr_claim_01",
  agent_id: "codex-trent-01",
  scope: {
    paths: ["src/billing/**"],
    apis: ["POST /api/payments"],
    tables: ["billing_events"]
  },
  reason: "Implementing payment webhook flow",
  kind: "soft_claim",
  created_at: "2026-06-12T10:00:00.000Z",
  expires_at: "2026-06-12T10:45:00.000Z"
};

test("normalizes Windows and POSIX paths to repo-relative slash paths", () => {
  assert.equal(normalizeRepoPath("C:\\repo\\src\\billing\\webhook.ts"), "repo/src/billing/webhook.ts");
  assert.equal(normalizeRepoPath("./src//billing/webhook.ts"), "src/billing/webhook.ts");
});

test("detects path overlap against a soft claim", () => {
  const warnings = checkConflicts({
    subject: {
      agent_id: "cursor-maya-01",
      paths: ["src/billing/invoice.ts"]
    },
    active_claims: [claim]
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.severity, "medium");
  assert.equal(warnings[0]?.reason, "path_overlap");
});

test("detects blocked scope as high severity do-not-touch guidance", () => {
  const blockedClaim: ClaimPointer = {
    ...claim,
    id: "ptr_blocked_scope_01",
    kind: "blocked_scope",
    reason: "Keep billing untouched while the webhook migration is in progress"
  };
  const warnings = checkConflicts({
    subject: {
      agent_id: "cursor-maya-01",
      paths: ["src/billing/invoice.ts"]
    },
    active_claims: [blockedClaim]
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.severity, "high");
  assert.equal(warnings[0]?.reason, "blocked_scope");
  assert.match(warnings[0]?.message ?? "", /Do-not-touch scope blocked by codex-trent-01/);
});

test("detects API overlap as high severity", () => {
  const warnings = checkConflicts({
    subject: {
      agent_id: "cursor-maya-01",
      apis: ["POST /api/payments"]
    },
    active_claims: [claim]
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.severity, "high");
  assert.equal(warnings[0]?.reason, "api_overlap");
});

test("filters claims by workspace and session context when provided", () => {
  const matchingClaim: ClaimPointer = {
    ...claim,
    id: "ptr_claim_matching",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a"
  };
  const unrelatedClaim: ClaimPointer = {
    ...claim,
    id: "ptr_claim_unrelated",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-b"
  };
  const legacyClaim: ClaimPointer = {
    ...claim,
    id: "ptr_claim_legacy"
  };

  const warnings = checkConflicts({
    subject: {
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "cursor-maya-01",
      apis: ["POST /api/payments"]
    },
    active_claims: [matchingClaim, unrelatedClaim, legacyClaim]
  });

  assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0]?.pointers, ["ptr_claim_matching"]);
});

test("filters claims by partial coordination context when provided", () => {
  const matchingClaim: ClaimPointer = {
    ...claim,
    id: "ptr_claim_workspace_match",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a"
  };
  const matchingOtherSessionClaim: ClaimPointer = {
    ...claim,
    id: "ptr_claim_workspace_match_other_session",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-b"
  };
  const unrelatedWorkspaceClaim: ClaimPointer = {
    ...claim,
    id: "ptr_claim_workspace_unrelated",
    workspace_id: "workspace-b",
    repo_id: "repo-a",
    session_id: "session-a"
  };

  const workspaceWarnings = checkConflicts({
    subject: {
      workspace_id: "workspace-a",
      agent_id: "cursor-maya-01",
      apis: ["POST /api/payments"]
    },
    active_claims: [matchingClaim, matchingOtherSessionClaim, unrelatedWorkspaceClaim]
  });

  assert.equal(workspaceWarnings.length, 2);
  assert.deepEqual(workspaceWarnings.map((warning) => warning.pointers[0]), [
    "ptr_claim_workspace_match",
    "ptr_claim_workspace_match_other_session"
  ]);

  const repoWarnings = checkConflicts({
    subject: {
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      agent_id: "cursor-maya-01",
      apis: ["POST /api/payments"]
    },
    active_claims: [matchingClaim, matchingOtherSessionClaim, unrelatedWorkspaceClaim]
  });

  assert.equal(repoWarnings.length, 2);
  assert.deepEqual(repoWarnings.map((warning) => warning.pointers[0]), [
    "ptr_claim_workspace_match",
    "ptr_claim_workspace_match_other_session"
  ]);
});

test("keeps legacy unscoped conflict checks global", () => {
  const scopedClaim: ClaimPointer = {
    ...claim,
    id: "ptr_claim_scoped",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a"
  };

  const warnings = checkConflicts({
    subject: {
      agent_id: "cursor-maya-01",
      apis: ["POST /api/payments"]
    },
    active_claims: [scopedClaim]
  });

  assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0]?.pointers, ["ptr_claim_scoped"]);
});

test("warns when recent events overlap subject scope", () => {
  const event: EventPointer = {
    type: "event",
    id: "ptr_event_api_change",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    event_type: "api_contract_changed",
    summary: "Payment API contract changed",
    affected_paths: ["src/billing/routes.ts"],
    affected_apis: ["POST /api/payments"],
    affected_tables: [],
    affected_env: [],
    agent_id: "codex-trent-01",
    created_at: "2026-06-12T10:05:00.000Z"
  };

  const warnings = checkConflicts({
    subject: {
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "cursor-maya-01",
      apis: ["POST /api/payments"],
      paths: ["src/billing/routes.ts"]
    },
    active_claims: [],
    recent_events: [event]
  });

  assert.equal(warnings.length, 2);
  assert.deepEqual(warnings.map((warning) => warning.reason), ["recent_api_change", "recent_file_change"]);
  assert.deepEqual(warnings[0]?.pointers, ["ptr_event_api_change"]);
});

test("filters recent event warnings by context and agent", () => {
  const matchingEvent: EventPointer = {
    type: "event",
    id: "ptr_event_matching",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    event_type: "env_var_added",
    summary: "Payment env changed",
    affected_paths: [],
    affected_apis: [],
    affected_tables: [],
    affected_env: ["STRIPE_SECRET_KEY"],
    agent_id: "codex-trent-01",
    created_at: "2026-06-12T10:05:00.000Z"
  };
  const unrelatedSessionEvent: EventPointer = {
    ...matchingEvent,
    id: "ptr_event_unrelated_session",
    session_id: "session-b"
  };
  const sameAgentEvent: EventPointer = {
    ...matchingEvent,
    id: "ptr_event_same_agent",
    agent_id: "cursor-maya-01"
  };

  const warnings = checkConflicts({
    subject: {
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "cursor-maya-01",
      env: ["STRIPE_SECRET_KEY"]
    },
    active_claims: [],
    recent_events: [matchingEvent, unrelatedSessionEvent, sameAgentEvent]
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.reason, "recent_env_change");
  assert.deepEqual(warnings[0]?.pointers, ["ptr_event_matching"]);
});

test("warns only for events newer than subject presence or since timestamp", () => {
  const presence: PresencePointer = {
    type: "presence",
    id: "ptr_presence_subject",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "cursor-maya-01",
    tool: "cursor",
    repo: "Suka.dev",
    status: "editing",
    current_files: ["src/billing/webhook.ts"],
    last_seen: "2026-06-12T10:10:00.000Z",
    expires_at: "2026-06-12T10:20:00.000Z"
  };
  const staleEvent: EventPointer = {
    type: "event",
    id: "ptr_event_stale",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    event_type: "file_modified",
    summary: "Old webhook edit",
    affected_paths: ["src/billing/webhook.ts"],
    affected_apis: [],
    affected_tables: [],
    affected_env: [],
    agent_id: "codex-trent-01",
    created_at: "2026-06-12T10:09:00.000Z"
  };
  const freshEvent: EventPointer = {
    ...staleEvent,
    id: "ptr_event_fresh",
    summary: "New webhook edit",
    created_at: "2026-06-12T10:12:00.000Z"
  };

  const warnings = checkConflicts({
    subject: {
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "cursor-maya-01",
      paths: ["src/billing/webhook.ts"],
      since: "2026-06-12T10:00:00.000Z"
    },
    active_claims: [],
    active_presence: [presence],
    recent_events: [staleEvent, freshEvent]
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.reason, "recent_file_change");
  assert.deepEqual(warnings[0]?.pointers, ["ptr_event_fresh"]);
});
