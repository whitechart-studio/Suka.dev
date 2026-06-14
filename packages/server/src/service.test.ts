import test from "node:test";
import assert from "node:assert/strict";
import { createSukaService } from "./index.js";

test("publishes valid claims and checks conflicts", () => {
  const service = createSukaService();
  const result = service.publish({
    type: "claim",
    id: "ptr_claim_01",
    agent_id: "codex-trent-01",
    scope: {
      paths: ["src/billing/**"]
    },
    reason: "Implementing Stripe webhook handling",
    kind: "soft_claim",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T11:00:00.000Z"
  });

  assert.equal(result.ok, true);
  assert.equal(service.getState().claims.length, 1);

  const warnings = service.checkConflicts({
    agent_id: "cursor-maya-01",
    paths: ["src/billing/invoice.ts"]
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.reason, "path_overlap");
});

test("checks conflicts only inside provided coordination context", () => {
  const service = createSukaService();
  service.publish({
    type: "claim",
    id: "ptr_claim_session_a",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "codex-trent-01",
    scope: {
      apis: ["POST /api/payments"]
    },
    reason: "Implementing session A payment flow",
    kind: "soft_claim",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T11:00:00.000Z"
  });
  service.publish({
    type: "claim",
    id: "ptr_claim_session_b",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-b",
    agent_id: "codex-trent-02",
    scope: {
      apis: ["POST /api/payments"]
    },
    reason: "Implementing session B payment flow",
    kind: "soft_claim",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T11:00:00.000Z"
  });

  const warnings = service.checkConflicts({
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "cursor-maya-01",
    apis: ["POST /api/payments"]
  });

  assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0]?.pointers, ["ptr_claim_session_a"]);
});

test("cleans up pointers only inside provided coordination context", () => {
  const service = createSukaService();
  service.publish({
    type: "presence",
    id: "ptr_presence_session_a",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "codex-trent-01",
    tool: "codex",
    repo: "whitechart-studio/Suka.dev",
    status: "editing",
    current_files: ["src/billing/webhook.ts"],
    last_seen: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T11:00:00.000Z"
  });
  service.publish({
    type: "claim",
    id: "ptr_claim_session_a",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "codex-trent-01",
    scope: {
      paths: ["src/billing/**"]
    },
    reason: "Implementing session A payment flow",
    kind: "soft_claim",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T11:00:00.000Z"
  });
  service.publish({
    type: "event",
    id: "ptr_event_session_a",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    event_type: "task_started",
    summary: "Start session A work",
    affected_paths: ["src/billing/webhook.ts"],
    affected_apis: [],
    affected_tables: [],
    affected_env: [],
    agent_id: "codex-trent-01",
    created_at: "2026-06-12T10:00:00.000Z"
  });
  service.publish({
    type: "decision",
    id: "ptr_decision_session_a",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    title: "Session A decision",
    body: "Session A should be cleanable.",
    scope: {
      paths: ["src/billing/**"]
    },
    status: "accepted",
    confidence: "high",
    evidence: ["ptr_event_session_a"],
    created_by: "codex-trent-01",
    created_at: "2026-06-12T10:00:00.000Z"
  });
  service.publish({
    type: "claim",
    id: "ptr_claim_session_b",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-b",
    agent_id: "codex-trent-02",
    scope: {
      paths: ["src/billing/**"]
    },
    reason: "Keep session B work",
    kind: "soft_claim",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T11:00:00.000Z"
  });

  const result = service.cleanup({
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a"
  });

  assert.deepEqual(result.removed, {
    presence: 1,
    claims: 1,
    events: 1,
    decisions: 1
  });
  assert.deepEqual(result.state.claims.map((claim) => claim.id), ["ptr_claim_session_b"]);
});

test("rejects invalid pointers before persistence", () => {
  const service = createSukaService();
  const result = service.publish({
    type: "event",
    id: "ptr_event_01",
    event_type: "unknown",
    summary: "Invalid event",
    affected_paths: [],
    affected_apis: [],
    affected_tables: [],
    affected_env: [],
    agent_id: "codex-trent-01",
    created_at: "2026-06-12T10:00:00.000Z"
  });

  assert.equal(result.ok, false);
  assert.equal(service.getState().events.length, 0);
});

test("expires stale presence and claims idempotently", () => {
  const service = createSukaService();
  service.publish({
    type: "presence",
    id: "ptr_presence_01",
    agent_id: "codex-trent-01",
    tool: "codex",
    repo: "whitechart-studio/Suka.dev",
    status: "editing",
    current_files: ["src/billing/webhook.ts"],
    last_seen: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T10:01:00.000Z"
  });

  service.expire(new Date("2026-06-12T10:02:00.000Z"));
  service.expire(new Date("2026-06-12T10:02:00.000Z"));

  assert.equal(service.getState().presence.length, 0);
});
