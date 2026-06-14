import test from "node:test";
import assert from "node:assert/strict";
import { buildTeamSummary, createEmptyState } from "./index.js";

test("builds local team summary from unscoped presence", () => {
  const summary = buildTeamSummary({
    ...createEmptyState(),
    presence: [{
      agent_id: "codex-local-01",
      current_files: ["packages/server/src/http.ts"],
      expires_at: "2099-06-12T11:00:00.000Z",
      id: "ptr_presence_local",
      last_seen: "2026-06-12T10:00:00.000Z",
      repo: "whitechart-studio/Suka.dev",
      status: "editing",
      tool: "codex",
      type: "presence"
    }]
  }, new Date("2026-06-12T10:00:00.000Z"));

  assert.equal(summary.mode, "local");
  assert.equal(summary.active_agents, 1);
  assert.equal(summary.workspaces[0]?.workspace_id, "local");
  assert.deepEqual(summary.workspaces[0]?.repo_ids, ["whitechart-studio/Suka.dev"]);
  assert.deepEqual(summary.workspaces[0]?.session_ids, ["local-session"]);
  assert.equal(summary.members[0]?.agent_id, "codex-local-01");
});

test("builds scoped team summary across workspaces and sessions", () => {
  const summary = buildTeamSummary({
    claims: [{
      agent_id: "codex-a",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z",
      id: "ptr_claim_a",
      kind: "soft_claim",
      reason: "Claim API work",
      repo_id: "repo-a",
      scope: {
        paths: ["packages/server/**"]
      },
      session_id: "session-a",
      type: "claim",
      workspace_id: "workspace-a"
    }],
    decisions: [],
    events: [{
      affected_apis: [],
      affected_env: [],
      affected_paths: ["packages/server/src/http.ts"],
      affected_tables: [],
      agent_id: "codex-a",
      created_at: "2026-06-12T10:05:00.000Z",
      event_type: "task_started",
      id: "ptr_event_a",
      repo_id: "repo-a",
      session_id: "session-a",
      summary: "Start API work",
      type: "event",
      workspace_id: "workspace-a"
    }],
    presence: [{
      agent_id: "codex-a",
      current_files: ["packages/server/src/http.ts"],
      expires_at: "2099-06-12T11:00:00.000Z",
      id: "ptr_presence_a",
      last_seen: "2026-06-12T10:10:00.000Z",
      repo: "whitechart-studio/Suka.dev",
      repo_id: "repo-a",
      session_id: "session-a",
      status: "editing",
      tool: "codex",
      type: "presence",
      workspace_id: "workspace-a"
    }, {
      agent_id: "claude-b",
      current_files: ["apps/dashboard/src/main.tsx"],
      expires_at: "2099-06-12T11:00:00.000Z",
      id: "ptr_presence_b",
      last_seen: "2026-06-12T10:09:00.000Z",
      repo: "whitechart-studio/Suka.dev",
      repo_id: "repo-b",
      session_id: "session-b",
      status: "reading",
      tool: "claude-code",
      type: "presence",
      workspace_id: "workspace-b"
    }]
  }, new Date("2026-06-12T10:15:00.000Z"));

  assert.equal(summary.mode, "scoped");
  assert.equal(summary.active_agents, 2);
  assert.deepEqual(summary.workspaces.map((workspace) => workspace.workspace_id), ["workspace-a", "workspace-b"]);
  assert.equal(summary.workspaces[0]?.active_agents, 1);
  assert.equal(summary.workspaces[0]?.claims, 1);
  assert.equal(summary.workspaces[0]?.events, 1);
  assert.deepEqual(summary.workspaces[0]?.repo_ids, ["repo-a"]);
  assert.deepEqual(summary.workspaces[0]?.session_ids, ["session-a"]);
  assert.deepEqual(summary.members.map((member) => member.agent_id), ["codex-a", "claude-b"]);
});
