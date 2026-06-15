import test from "node:test";
import assert from "node:assert/strict";
import type { TeamConnectionSummary } from "./index.js";
import { validatePointer } from "./index.js";

test("accepts a valid presence pointer", () => {
  const result = validatePointer({
    type: "presence",
    id: "ptr_01",
    agent_id: "codex-trent-01",
    user_id: "trent",
    tool: "codex",
    repo: "whitechart-studio/Suka.dev",
    branch: "main",
    task: "Build protocol package",
    status: "editing",
    current_files: ["packages/protocol/src/types.ts"],
    last_seen: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T10:02:00.000Z"
  });

  assert.equal(result.ok, true);
});

test("accepts optional coordination context on pointers", () => {
  const result = validatePointer({
    type: "claim",
    id: "ptr_context_01",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "codex-trent-01",
    scope: {
      apis: ["POST /api/payments"]
    },
    reason: "Working on isolated payment API changes",
    kind: "soft_claim",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T10:45:00.000Z"
  });

  assert.equal(result.ok, true);
});

test("rejects invalid coordination context field types", () => {
  const result = validatePointer({
    type: "claim",
    id: "ptr_context_invalid",
    workspace_id: 123,
    repo_id: "",
    agent_id: "codex-trent-01",
    scope: {
      apis: ["POST /api/payments"]
    },
    reason: "Working on isolated payment API changes",
    kind: "soft_claim",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T10:45:00.000Z"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "workspace_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "repo_id" && issue.code === "invalid_type"));
  }
});

test("documents the team connection summary contract", () => {
  const summary = {
    active_agents: 1,
    generated_at: "2026-06-12T10:00:00.000Z",
    members: [{
      agent_id: "codex-trent-01",
      current_files: ["packages/server/src/team.ts"],
      last_seen: "2026-06-12T09:59:59.000Z",
      repo_id: "repo-a",
      session_id: "session-a",
      status: "editing",
      tool: "codex",
      workspace_id: "workspace-a"
    }],
    mode: "scoped",
    workspaces: [{
      active_agents: 1,
      claims: 2,
      briefs: 0,
      decisions: 1,
      events: 3,
      repo_ids: ["repo-a"],
      session_ids: ["session-a"],
      workspace_id: "workspace-a"
    }]
  } satisfies TeamConnectionSummary;

  assert.equal(summary.mode, "scoped");
  assert.equal(summary.workspaces[0]?.workspace_id, "workspace-a");
  assert.equal(summary.members[0]?.agent_id, "codex-trent-01");
});

test("accepts a valid brief pointer", () => {
  const result = validatePointer({
    type: "brief",
    id: "ptr_brief_01",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "codex-trent-01",
    summary: "Dashboard session rooms are selectable and focused.",
    changed_files: ["apps/dashboard/src/main.tsx"],
    decisions_made: ["Keep session focus local to the dashboard view."],
    assumptions: ["Server state remains the source of truth."],
    skipped_work: ["No hosted persistence changes in this pass."],
    risks: ["Stale browser state may hide new rooms until reconnect."],
    blockers: [],
    next_action: "Add a dashboard Current Truth panel.",
    related_claims: ["claim_dashboard_focus"],
    related_sessions: ["session-a"],
    worktree: "codex/dashboard-session-focus",
    created_at: "2026-06-12T10:00:00.000Z"
  });

  assert.equal(result.ok, true);
});

test("rejects malformed brief pointers", () => {
  const result = validatePointer({
    type: "brief",
    id: "ptr_brief_invalid",
    agent_id: "codex-trent-01",
    summary: "",
    changed_files: "apps/dashboard/src/main.tsx",
    decisions_made: [],
    assumptions: [],
    skipped_work: [],
    risks: [],
    blockers: [],
    related_claims: [],
    related_sessions: [],
    created_at: "not-a-date"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "summary" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "changed_files" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "next_action" && issue.code === "missing_field"));
    assert.ok(result.issues.some((issue) => issue.path === "created_at" && issue.code === "invalid_timestamp"));
  }
});

test("rejects claims without scope", () => {
  const result = validatePointer({
    type: "claim",
    id: "ptr_02",
    agent_id: "codex-trent-01",
    scope: {},
    reason: "Working on billing",
    kind: "soft_claim",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T10:45:00.000Z"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.issues[0]?.code, "empty_scope");
  }
});

test("requires evidence for accepted decisions", () => {
  const result = validatePointer({
    type: "decision",
    id: "ptr_03",
    title: "Webhook handlers must be idempotent",
    body: "Payment webhook handlers must tolerate duplicate delivery.",
    scope: {
      paths: ["src/billing/**"]
    },
    status: "accepted",
    confidence: "high",
    evidence: [],
    created_by: "codex-trent-01",
    approved_by: "trent",
    created_at: "2026-06-12T10:00:00.000Z"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.issues.at(-1)?.path, "evidence");
  }
});
