import test from "node:test";
import assert from "node:assert/strict";
import type {
  Checkpoint,
  LedgerEvent,
  LedgerBudgetPolicy,
  LedgerPointer,
  LedgerPrivacyDefaults,
  TaskEntry,
  TeamConnectionSummary,
  TokenAssessment,
  TokenUsage
} from "./index.js";
import {
  validateCheckpoint,
  validateLedgerBudgetPolicy,
  validateLedgerEvent,
  validateLedgerPrivacyDefaults,
  validatePointer,
  validateTaskEntry,
  validateTokenAssessment,
  validateTokenUsage
} from "./index.js";

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

test("accepts valid ledger task entries", () => {
  const task = {
    task_id: "task_01",
    session_id: "session-a",
    repo_id: "repo-a",
    workspace_id: "workspace-a",
    title: "Fix landing guide overlap",
    intent_summary: "Move dashboard docs into the landing guide and keep the canvas clean.",
    task_type: "implementation",
    status: "completed",
    started_at: "2026-06-24T18:00:00.000Z",
    completed_at: "2026-06-24T18:40:00.000Z",
    related_issue_ids: ["165"],
    related_claim_ids: ["claim_dashboard_landing"],
    related_checkpoint_ids: ["checkpoint_pr_165"]
  } satisfies TaskEntry;

  const result = validateTaskEntry(task);

  assert.equal(result.ok, true);
});

test("rejects malformed ledger task entries", () => {
  const result = validateTaskEntry({
    task_id: "",
    session_id: 123,
    repo_id: "",
    workspace_id: "",
    title: "",
    intent_summary: "",
    task_type: "build",
    status: "done",
    started_at: "not-a-date",
    completed_at: 123,
    related_issue_ids: "165",
    related_claim_ids: ["claim-a", 10],
    related_checkpoint_ids: []
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "task_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "session_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "repo_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "workspace_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "task_type" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "status" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "started_at" && issue.code === "invalid_timestamp"));
    assert.ok(result.issues.some((issue) => issue.path === "completed_at" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "related_issue_ids" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "related_claim_ids" && issue.code === "invalid_type"));
  }
});

test("accepts valid ledger token usage", () => {
  const usage = {
    task_id: "task_01",
    provider: "openai",
    model: "gpt-5",
    input_tokens: 2300,
    output_tokens: 4100,
    cached_input_tokens: 900,
    reasoning_tokens: 700,
    tool_call_tokens: 300,
    total_tokens: 6400,
    estimated_cost: 0.18,
    currency: "USD",
    measurement_source: "api"
  } satisfies TokenUsage;

  const result = validateTokenUsage(usage);

  assert.equal(result.ok, true);
});

test("rejects invalid ledger token usage", () => {
  const result = validateTokenUsage({
    task_id: "",
    provider: "other-ai",
    model: "",
    input_tokens: -1,
    output_tokens: 1.5,
    cached_input_tokens: -10,
    reasoning_tokens: "700",
    tool_call_tokens: -2,
    total_tokens: -1,
    estimated_cost: -0.01,
    currency: "EUR",
    measurement_source: "logs"
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "task_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "provider" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "model" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "input_tokens" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "output_tokens" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "cached_input_tokens" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "reasoning_tokens" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "tool_call_tokens" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "total_tokens" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "estimated_cost" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "currency" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "measurement_source" && issue.code === "invalid_value"));
  }
});

test("accepts valid ledger token assessments", () => {
  const assessment = {
    task_id: "task_01",
    value_category: "delivery",
    usefulness_score: 82,
    assessed_by: "rule",
    confidence: "medium",
    reason: "Task produced a merged PR with passing validation."
  } satisfies TokenAssessment;

  const result = validateTokenAssessment(assessment);

  assert.equal(result.ok, true);
});

test("rejects invalid ledger token assessments", () => {
  const result = validateTokenAssessment({
    task_id: "",
    value_category: "waste",
    usefulness_score: 101,
    assessed_by: "manager",
    confidence: "certain",
    reason: ""
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "task_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "value_category" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "usefulness_score" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "assessed_by" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "confidence" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "reason" && issue.code === "invalid_type"));
  }
});

test("accepts valid ledger events", () => {
  const event = {
    event_id: "event_01",
    task_id: "task_01",
    session_id: "session-a",
    repo_id: "repo-a",
    event_type: "file_changed",
    timestamp: "2026-06-24T18:20:00.000Z",
    summary: "Updated landing guide CTA layout.",
    severity: "info",
    affected_paths: ["apps/dashboard/src/main.tsx"],
    metadata: {
      change_kind: "modified"
    }
  } satisfies LedgerEvent;

  const result = validateLedgerEvent(event);

  assert.equal(result.ok, true);
});

test("rejects invalid ledger events", () => {
  const result = validateLedgerEvent({
    event_id: "",
    task_id: "",
    session_id: "",
    repo_id: 123,
    event_type: "file_modified",
    timestamp: "not-a-date",
    summary: "",
    severity: "debug",
    affected_paths: ["apps/dashboard/src/main.tsx", 10],
    metadata: []
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "event_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "task_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "session_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "repo_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "event_type" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "timestamp" && issue.code === "invalid_timestamp"));
    assert.ok(result.issues.some((issue) => issue.path === "summary" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "severity" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "affected_paths" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "metadata" && issue.code === "invalid_type"));
  }
});

test("accepts valid ledger checkpoints", () => {
  const checkpoint = {
    checkpoint_id: "checkpoint_pr_165",
    repo_id: "repo-a",
    kind: "pr",
    external_id: "165",
    title: "Move docs to landing page",
    status: "merged",
    created_at: "2026-06-24T18:30:00.000Z",
    completed_at: "2026-06-24T19:20:00.000Z",
    related_task_ids: ["task_01", "task_02"],
    related_issue_ids: ["165"],
    related_session_ids: ["session-a"],
    summary: "Landing guide moved docs out of the dashboard top bar."
  } satisfies Checkpoint;

  const result = validateCheckpoint(checkpoint);

  assert.equal(result.ok, true);
});

test("rejects invalid ledger checkpoints", () => {
  const result = validateCheckpoint({
    checkpoint_id: "",
    repo_id: "",
    kind: "pull_request",
    external_id: "",
    title: "",
    status: "done",
    created_at: "not-a-date",
    completed_at: 123,
    related_task_ids: "task_01",
    related_issue_ids: ["165", 165],
    related_session_ids: [],
    summary: ""
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "checkpoint_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "repo_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "kind" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "external_id" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "title" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "status" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "created_at" && issue.code === "invalid_timestamp"));
    assert.ok(result.issues.some((issue) => issue.path === "completed_at" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "related_task_ids" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "related_issue_ids" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "summary" && issue.code === "invalid_type"));
  }
});

test("accepts metadata-only ledger privacy defaults", () => {
  const defaults = {
    publish_file_paths: true,
    publish_diff_content: false,
    publish_terminal_logs: false,
    publish_prompt_text: false,
    retention_days: 7
  } satisfies LedgerPrivacyDefaults;

  const result = validateLedgerPrivacyDefaults(defaults);

  assert.equal(result.ok, true);
});

test("rejects malformed ledger privacy defaults", () => {
  const result = validateLedgerPrivacyDefaults({
    publish_file_paths: "yes",
    publish_diff_content: false,
    publish_terminal_logs: 0,
    publish_prompt_text: false,
    retention_days: -1
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "publish_file_paths" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "publish_terminal_logs" && issue.code === "invalid_type"));
    assert.ok(result.issues.some((issue) => issue.path === "retention_days" && issue.code === "invalid_type"));
  }
});

test("accepts ledger budget policies", () => {
  const policy = {
    scope: "session",
    warning_threshold_tokens: 8000,
    hard_limit_tokens: 10000
  } satisfies LedgerBudgetPolicy;

  const result = validateLedgerBudgetPolicy(policy);

  assert.equal(result.ok, true);
});

test("rejects malformed ledger budget policies", () => {
  const result = validateLedgerBudgetPolicy({
    scope: "project",
    warning_threshold_tokens: 12000,
    hard_limit_tokens: 10000
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "scope" && issue.code === "invalid_value"));
    assert.ok(result.issues.some((issue) => issue.path === "warning_threshold_tokens" && issue.code === "invalid_value"));
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
