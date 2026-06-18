import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
