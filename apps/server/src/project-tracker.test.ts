import test from "node:test";
import assert from "node:assert/strict";
import type { LocalAgentDetectionReport } from "@suka/local-agents";
import { createSukaService, ProjectTrackingWorker } from "./index.js";

test("project tracker publishes detected presence for the active project", () => {
  const service = createSukaService();
  const project = service.registerProject({
    now: new Date("2026-06-18T10:00:00.000Z"),
    path: process.cwd()
  });
  service.activateProject(project.id);
  const worker = new ProjectTrackingWorker(service, {
    detectLocalAgents: () => detectionReport(project.repo_root),
    now: () => new Date("2026-06-18T10:05:00.000Z"),
    ttlSeconds: 30
  });

  const status = worker.start();
  const state = service.getState();
  const presence = state.presence[0];

  assert.equal(status.running, true);
  assert.equal(status.active_project_id, project.id);
  assert.equal(status.detected_agents, 1);
  assert.equal(status.published_presence, 1);
  assert.equal(state.presence.length, 1);
  assert.equal(presence?.workspace_id, project.workspace_id);
  assert.equal(presence?.repo_id, project.repo_id);
  assert.equal(presence?.session_id, `project-tracking-${project.id}`);
  assert.equal(presence?.source?.kind, "detected");
  assert.equal(presence?.source?.detector, "process-cwd");
  assert.equal(presence?.expires_at, "2026-06-18T10:05:30.000Z");
  worker.stop();
});

test("project tracker start is idempotent for the same active project", () => {
  const service = createSukaService();
  const project = service.registerProject({
    now: new Date("2026-06-18T10:00:00.000Z"),
    path: process.cwd()
  });
  service.activateProject(project.id);
  let detections = 0;
  const worker = new ProjectTrackingWorker(service, {
    detectLocalAgents: () => {
      detections += 1;
      return detectionReport(project.repo_root);
    },
    now: () => new Date("2026-06-18T10:05:00.000Z")
  });

  worker.start();
  worker.start();

  assert.equal(detections, 1);
  assert.equal(service.getState().presence.length, 1);
  worker.stop();
});

test("project tracker stop removes scoped tracked presence", () => {
  const service = createSukaService();
  const project = service.registerProject({
    now: new Date("2026-06-18T10:00:00.000Z"),
    path: process.cwd()
  });
  service.activateProject(project.id);
  const worker = new ProjectTrackingWorker(service, {
    detectLocalAgents: () => detectionReport(project.repo_root),
    now: () => new Date("2026-06-18T10:05:00.000Z")
  });

  worker.start();
  const status = worker.stop();

  assert.equal(status.running, false);
  assert.equal(service.getState().presence.length, 0);
});

test("project tracker keeps detection warnings visible in status", () => {
  const service = createSukaService();
  const project = service.registerProject({
    now: new Date("2026-06-18T10:00:00.000Z"),
    path: process.cwd()
  });
  service.activateProject(project.id);
  const worker = new ProjectTrackingWorker(service, {
    detectLocalAgents: () => ({
      agents: [],
      changed_files: [],
      generated_at: "2026-06-18T10:05:00.000Z",
      repo_root: project.repo_root,
      warnings: ["Could not read cwd for process 101; continuing with command-line cwd fallback."]
    })
  });

  const status = worker.start();

  assert.equal(status.detected_agents, 0);
  assert.deepEqual(status.warnings, ["Could not read cwd for process 101; continuing with command-line cwd fallback."]);
  worker.stop();
});

function detectionReport(repoRoot: string): LocalAgentDetectionReport {
  return {
    agents: [{
      agent_id: "codex-pid-101",
      branch: "main",
      command: "codex",
      confidence: "high",
      current_files: ["apps/server/src/project-tracker.ts"],
      cwd: repoRoot,
      detection_source: "process-cwd",
      pid: 101,
      status: "detected",
      tool: "codex"
    }],
    branch: "main",
    changed_files: ["apps/server/src/project-tracker.ts"],
    generated_at: "2026-06-18T10:05:00.000Z",
    repo_root: repoRoot,
    warnings: []
  };
}
