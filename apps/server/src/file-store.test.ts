import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { createSukaService, FileSukaStore } from "./index.js";

test("file store persists state across service instances", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-store-"));
  try {
    const dataFile = join(tempDir, "state.json");
    const first = createSukaService(new FileSukaStore(dataFile));

    const result = first.publish({
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Persist billing claim",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });

    assert.equal(result.ok, true);

    const second = createSukaService(new FileSukaStore(dataFile));
    assert.equal(second.getState().claims.length, 1);
    assert.equal(second.getState().claims[0]?.reason, "Persist billing claim");
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("file store persists valid ledger entries and ignores malformed ledger entries", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-store-"));
  try {
    const dataFile = join(tempDir, "state.json");
    const first = createSukaService(new FileSukaStore(dataFile));

    const result = first.publish({
      type: "ledger",
      id: "ptr_ledger_01",
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "codex-trent-01",
      event_type: "file_modified",
      summary: "Persist dashboard ledger entry.",
      affected_paths: ["apps/dashboard/src/main.tsx"],
      branch: "main",
      worktree: "/worktrees/suka/main",
      diff_stat: {
        files_changed: 1,
        additions: 3,
        deletions: 1
      },
      created_at: "2026-06-24T10:00:00.000Z"
    });

    assert.equal(result.ok, true);

    const persisted = new FileSukaStore(dataFile).getState();
    writeFileSync(dataFile, `${JSON.stringify({
      ...persisted,
      ledger: [
        ...persisted.ledger,
        {
          type: "ledger",
          id: "ptr_ledger_invalid",
          workspace_id: "",
          repo_id: "repo-a",
          session_id: "session-a",
          agent_id: "codex-trent-01",
          event_type: "file_modified",
          summary: "Invalid persisted ledger entry.",
          affected_paths: [],
          branch: "main",
          worktree: "/worktrees/suka/main",
          created_at: "not-a-date"
        }
      ]
    })}\n`, "utf8");

    const second = createSukaService(new FileSukaStore(dataFile));
    assert.deepEqual(second.listLedger().map((entry) => entry.id), ["ptr_ledger_01"]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("file store persists structured ledger records and ignores malformed persisted records", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-store-"));
  try {
    const dataFile = join(tempDir, "state.json");
    const first = createSukaService(new FileSukaStore(dataFile));

    assert.equal(first.recordLedgerTask({
      task_id: "task_ledger_01",
      session_id: "session-a",
      repo_id: "repo-a",
      workspace_id: "workspace-a",
      title: "Persist structured ledger records",
      intent_summary: "Store ledger MVP records across file-store restarts.",
      task_type: "implementation",
      status: "completed",
      started_at: "2026-06-25T06:00:00.000Z",
      completed_at: "2026-06-25T06:15:00.000Z",
      related_issue_ids: ["169"],
      related_claim_ids: [],
      related_checkpoint_ids: ["checkpoint_pr_177"]
    }).ok, true);
    assert.equal(first.recordLedgerTokenUsage({
      task_id: "task_ledger_01",
      provider: "openai",
      input_tokens: 100,
      output_tokens: 200,
      total_tokens: 300,
      estimated_cost: 0.01,
      currency: "USD",
      measurement_source: "api"
    }).ok, true);
    assert.equal(first.recordLedgerTokenAssessment({
      task_id: "task_ledger_01",
      value_category: "delivery",
      usefulness_score: 90,
      assessed_by: "rule",
      confidence: "medium"
    }).ok, true);
    assert.equal(first.recordLedgerEvent({
      event_id: "event_ledger_01",
      task_id: "task_ledger_01",
      session_id: "session-a",
      repo_id: "repo-a",
      event_type: "file_changed",
      timestamp: "2026-06-25T06:10:00.000Z",
      summary: "Persisted file touch metadata.",
      severity: "info",
      affected_paths: ["apps/server/src/file-store.ts"]
    }).ok, true);
    assert.equal(first.recordLedgerCheckpoint({
      checkpoint_id: "checkpoint_pr_177",
      repo_id: "repo-a",
      kind: "pr",
      external_id: "177",
      title: "Persist ledger records",
      status: "open",
      created_at: "2026-06-25T06:15:00.000Z",
      related_task_ids: ["task_ledger_01"],
      related_issue_ids: ["169"],
      related_session_ids: ["session-a"],
      summary: "Structured ledger data should survive restarts."
    }).ok, true);

    const persisted = new FileSukaStore(dataFile).getState();
    writeFileSync(dataFile, `${JSON.stringify({
      ...persisted,
      ledger_tasks: [
        ...persisted.ledger_tasks,
        {
          task_id: "",
          session_id: "session-a",
          repo_id: "repo-a",
          title: "Invalid",
          intent_summary: "Invalid",
          task_type: "implementation",
          status: "completed",
          started_at: "not-a-date",
          related_issue_ids: [],
          related_claim_ids: [],
          related_checkpoint_ids: []
        }
      ],
      ledger_token_usage: [
        ...persisted.ledger_token_usage,
        {
          task_id: "task_invalid",
          provider: "openai",
          input_tokens: -1,
          output_tokens: 1,
          total_tokens: 0,
          measurement_source: "api"
        }
      ],
      ledger_token_assessments: [
        ...persisted.ledger_token_assessments,
        {
          task_id: "task_invalid",
          value_category: "waste",
          assessed_by: "rule",
          confidence: "medium"
        }
      ],
      ledger_events: [
        ...persisted.ledger_events,
        {
          event_id: "event_invalid",
          session_id: "session-a",
          repo_id: "repo-a",
          event_type: "file_changed",
          timestamp: "not-a-date",
          summary: "Invalid",
          severity: "info",
          affected_paths: []
        }
      ],
      ledger_checkpoints: [
        ...persisted.ledger_checkpoints,
        {
          checkpoint_id: "checkpoint_invalid",
          repo_id: "repo-a",
          kind: "pull_request",
          title: "Invalid",
          status: "open",
          created_at: "2026-06-25T06:15:00.000Z",
          related_task_ids: [],
          related_issue_ids: [],
          related_session_ids: [],
          summary: "Invalid"
        }
      ]
    })}\n`, "utf8");

    const second = createSukaService(new FileSukaStore(dataFile));

    assert.deepEqual(second.listLedgerTasks().map((entry) => entry.task_id), ["task_ledger_01"]);
    assert.deepEqual(second.listLedgerTokenUsage().map((entry) => entry.total_tokens), [300]);
    assert.deepEqual(second.listLedgerTokenAssessments().map((entry) => entry.value_category), ["delivery"]);
    assert.deepEqual(second.listLedgerEvents().map((entry) => entry.event_id), ["event_ledger_01"]);
    assert.deepEqual(second.listLedgerCheckpoints().map((entry) => entry.checkpoint_id), ["checkpoint_pr_177"]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("file store persists registered projects and active project", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-store-"));
  try {
    const dataFile = join(tempDir, "state.json");
    const projectDir = join(tempDir, "project");
    mkdirSync(projectDir);
    const first = createSukaService(new FileSukaStore(dataFile));

    const project = first.registerProject({
      now: new Date("2026-06-18T10:00:00.000Z"),
      path: projectDir
    });
    assert.equal(first.activateProject(project.id)?.id, project.id);

    const second = createSukaService(new FileSukaStore(dataFile));
    assert.equal(second.listProjects().length, 1);
    assert.equal(second.getActiveProject()?.id, project.id);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("file store persists removed projects and active fallback", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-store-"));
  try {
    const dataFile = join(tempDir, "state.json");
    const first = createSukaService(new FileSukaStore(dataFile));
    const firstDir = join(tempDir, "first");
    const secondDir = join(tempDir, "second");
    mkdirSync(firstDir);
    mkdirSync(secondDir);

    const removedProject = first.registerProject({
      path: firstDir
    });
    const fallbackProject = first.registerProject({
      path: secondDir
    });
    first.activateProject(removedProject.id);
    first.removeProject(removedProject.id);

    const second = createSukaService(new FileSukaStore(dataFile));

    assert.deepEqual(second.listProjects().map((project) => project.id), [fallbackProject.id]);
    assert.equal(second.getActiveProject()?.id, fallbackProject.id);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("file store ignores active project ids that do not exist", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-store-"));
  try {
    const dataFile = join(tempDir, "state.json");
    writeFileSync(dataFile, `${JSON.stringify({ active_project_id: "missing", projects: [] })}\n`, "utf8");

    const service = createSukaService(new FileSukaStore(dataFile));
    assert.equal(service.getState().active_project_id, undefined);
    assert.equal(service.getActiveProject(), undefined);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("file store persists expiration changes", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-store-"));
  try {
    const dataFile = join(tempDir, "state.json");
    const first = createSukaService(new FileSukaStore(dataFile));

    first.publish({
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
    first.expire(new Date("2026-06-12T10:02:00.000Z"));

    const second = createSukaService(new FileSukaStore(dataFile));
    assert.equal(second.getState().presence.length, 0);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});
