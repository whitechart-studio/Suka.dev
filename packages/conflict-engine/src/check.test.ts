import test from "node:test";
import assert from "node:assert/strict";
import type { ClaimPointer } from "@suka/protocol";
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
