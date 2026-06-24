import test from "node:test";
import assert from "node:assert/strict";
import type { LedgerPointer, TeamConnectionSummary } from "./index.js";
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

test("accepts detected presence source metadata", () => {
  const result = validatePointer({
    type: "presence",
    id: "ptr_detected_presence_01",
    agent_id: "codex-pid-101",
    tool: "codex",
    source: {
      kind: "detected",
      detector: "process-cwd",
      pid: 101,
      cwd: "/repo/suka",
      detected_at: "2026-06-18T06:00:00.000Z"
    },
    repo: "whitechart-studio/Suka.dev",
    branch: "main",
    status: "online",
    current_files: ["packages/cli/src/commands.ts"],
    last_seen: "2026-06-18T06:00:00.000Z",
    expires_at: "2026-06-18T06:01:00.000Z"
  });

  assert.equal(result.ok, true);
});

test("rejects invalid detected presence source metadata", () => {
  const result = validatePointer({
    type: "presence",
    id: "ptr_detected_presence_invalid",
    agent_id: "codex-pid-101",
    tool: "codex",
    source: {
      kind: "detected",
      pid: "101",
      detected_at: "not-a-date"
    },
    repo: "whitechart-studio/Suka.dev",
    status: "online",
    current_files: [],
    last_seen: "2026-06-18T06:00:00.000Z",
    expires_at: "2026-06-18T06:01:00.000Z"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "source.detector" && issue.code === "missing_field"));
    assert.ok(result.issues.some((issue) => issue.path === "source.pid" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "source.detected_at" && issue.code === "invalid_timestamp"));
  }
});

test("reports nested source kind validation path", () => {
  const result = validatePointer({
    type: "presence",
    id: "ptr_detected_presence_invalid_kind",
    agent_id: "codex-pid-101",
    tool: "codex",
    source: {
      kind: "automatic",
      detector: "process-cwd"
    },
    repo: "whitechart-studio/Suka.dev",
    status: "online",
    current_files: [],
    last_seen: "2026-06-18T06:00:00.000Z",
    expires_at: "2026-06-18T06:01:00.000Z"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "source.kind" && issue.code === "invalid_value"));
  }
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

test("accepts blocked scope ownership boundaries", () => {
  const result = validatePointer({
    type: "claim",
    id: "ptr_blocked_scope_01",
    agent_id: "codex-trent-01",
    scope: {
      paths: ["apps/server/src/**"]
    },
    reason: "Do not edit server routing during refactor",
    kind: "blocked_scope",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T10:45:00.000Z"
  });

  assert.equal(result.ok, true);
});

test("rejects unknown claim kinds", () => {
  const result = validatePointer({
    type: "claim",
    id: "ptr_claim_unknown_kind",
    agent_id: "codex-trent-01",
    scope: {
      paths: ["apps/server/src/**"]
    },
    reason: "Invalid claim kind",
    kind: "exclusive_lock",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T10:45:00.000Z"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "kind" && issue.code === "invalid_value"));
  }
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
      current_files: ["apps/server/src/team.ts"],
      last_seen: "2026-06-12T09:59:59.000Z",
      repo_id: "repo-a",
      session_id: "session-a",
      status: "editing",
      tool: "codex",
      source: {
        kind: "detected",
        detector: "process-cwd"
      },
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

test("accepts a valid coding ledger pointer", () => {
  const pointer = {
    type: "ledger",
    id: "ptr_ledger_01",
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a",
    agent_id: "codex-trent-01",
    event_type: "file_modified",
    summary: "Agent updated dashboard activity count semantics.",
    affected_paths: ["apps/dashboard/src/main.tsx"],
    branch: "RS/activity-count-polish-bundle",
    worktree: "/worktrees/suka/activity-count-polish",
    evidence: ["pr:157", "commit:b71d1ff"],
    diff_stat: {
      files_changed: 1,
      additions: 52,
      deletions: 31
    },
    token_usage: {
      input_tokens: 1200,
      output_tokens: 480,
      total_tokens: 1680,
      estimated_cost_usd: 0.03,
      model: "gpt-5"
    },
    created_at: "2026-06-24T09:00:00.000Z"
  } satisfies LedgerPointer;

  const result = validatePointer(pointer);

  assert.equal(result.ok, true);
});

test("rejects malformed coding ledger pointers", () => {
  const result = validatePointer({
    type: "ledger",
    id: "ptr_ledger_invalid",
    workspace_id: "",
    repo_id: 123,
    agent_id: "",
    event_type: "unknown_event",
    summary: "",
    affected_paths: "apps/dashboard/src/main.tsx",
    branch: "",
    worktree: "",
    evidence: ["pr:157", 157],
    diff_stat: {
      files_changed: -1,
      additions: "52",
      deletions: 31
    },
    token_usage: {
      output_tokens: -10,
      total_tokens: 1.5,
      estimated_cost_usd: -0.01,
      model: ""
    },
    created_at: "not-a-date"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "workspace_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "repo_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "session_id" && issue.code === "missing_field"));
    assert.ok(result.issues.some((issue) => issue.path === "event_type" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "affected_paths" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "evidence" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "diff_stat.files_changed" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "diff_stat.additions" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "token_usage.input_tokens" && issue.code === "missing_field"));
    assert.ok(result.issues.some((issue) => issue.path === "token_usage.output_tokens" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "token_usage.total_tokens" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "token_usage.estimated_cost_usd" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "token_usage.model" && issue.code === "invalid_type"));
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
