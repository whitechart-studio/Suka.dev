import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSukaService } from "./index.js";

test("registers local projects from folder metadata", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-"));
  try {
    const repoDir = join(tempDir, "Suka Project");
    mkdirSync(repoDir);
    execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });
    execFileSync("git", ["remote", "add", "origin", "git@github.com:whitechart-studio/Suka.dev.git"], { cwd: repoDir });

    const service = createSukaService();
    const project = service.registerProject({
      now: new Date("2026-06-18T10:00:00.000Z"),
      path: repoDir
    });

    assert.equal(project.name, "Suka Project");
    assert.equal(project.repo, "whitechart-studio/Suka.dev");
    assert.equal(project.repo_id, "whitechart-studio-suka-dev");
    assert.equal(project.workspace_id, "local-whitechart-studio-suka-dev");
    assert.equal(project.created_at, "2026-06-18T10:00:00.000Z");
    assert.equal(service.listProjects().length, 1);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("deduplicates registered projects by normalized repo root", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-"));
  try {
    const repoDir = join(tempDir, "repo");
    const nestedDir = join(repoDir, "apps", "server");
    mkdirSync(nestedDir, { recursive: true });
    execFileSync("git", ["init"], { cwd: repoDir, stdio: "ignore" });

    const service = createSukaService();
    const first = service.registerProject({
      now: new Date("2026-06-18T10:00:00.000Z"),
      path: repoDir
    });
    const second = service.registerProject({
      now: new Date("2026-06-18T10:05:00.000Z"),
      path: nestedDir
    });

    assert.equal(first.id, second.id);
    assert.equal(service.listProjects().length, 1);
    assert.equal(service.listProjects()[0]?.created_at, "2026-06-18T10:00:00.000Z");
    assert.equal(service.listProjects()[0]?.updated_at, "2026-06-18T10:05:00.000Z");
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

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

test("checks recent events for stale-context warnings", () => {
  const service = createSukaService();
  service.publish({
    type: "event",
    id: "ptr_event_api_change",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    event_type: "api_contract_changed",
    summary: "Payment API contract changed",
    affected_paths: [],
    affected_apis: ["POST /api/payments"],
    affected_tables: [],
    affected_env: [],
    agent_id: "codex-trent-01",
    created_at: "2026-06-12T10:05:00.000Z"
  });

  const warnings = service.checkConflicts({
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "cursor-maya-01",
    apis: ["POST /api/payments"],
    since: "2026-06-12T10:00:00.000Z"
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.reason, "recent_api_change");
  assert.deepEqual(warnings[0]?.pointers, ["ptr_event_api_change"]);
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
    type: "brief",
    id: "ptr_brief_session_a",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "codex-trent-01",
    summary: "Session A cleanup should include briefs.",
    changed_files: ["src/billing/webhook.ts"],
    decisions_made: ["Keep cleanup scoped to the active session."],
    assumptions: [],
    skipped_work: [],
    risks: [],
    blockers: [],
    next_action: "Continue session B work.",
    related_claims: ["ptr_claim_session_a"],
    related_sessions: ["session-a"],
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
    decisions: 1,
    briefs: 1
  });
  assert.deepEqual(result.state.claims.map((claim) => claim.id), ["ptr_claim_session_b"]);
  assert.deepEqual(result.state.briefs, []);
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
