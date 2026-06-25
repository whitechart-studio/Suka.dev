import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import type { LocalAgentDetectionReport } from "@suka/local-agents";
import { createSukaHttpServer, createSukaService, FileSukaStore, isAllowedRealtimeOrigin, listen, ProjectTrackingWorker } from "./index.js";

test("GET /api/state returns the current state", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await fetch(`${running.url}/api/state`);
    const body = await response.json() as { data: { claims: unknown[] } };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.claims, []);
  } finally {
    await running.close();
  }
});

test("GET /api/team returns the current team summary", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const createResponse = await postJson(`${running.url}/api/pointers`, {
      type: "presence",
      id: "ptr_presence_team",
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "codex-trent-01",
      tool: "codex",
      repo: "whitechart-studio/Suka.dev",
      status: "editing",
      current_files: ["apps/server/src/http.ts"],
      last_seen: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    const response = await fetch(`${running.url}/api/team`);
    const body = await response.json() as {
      data: {
        active_agents: number;
        mode: string;
        workspaces: Array<{ workspace_id: string; repo_ids: string[]; session_ids: string[] }>;
      };
    };

    assert.equal(createResponse.status, 201);
    assert.equal(response.status, 200);
    assert.equal(body.data.mode, "scoped");
    assert.equal(body.data.active_agents, 1);
    assert.equal(body.data.workspaces[0]?.workspace_id, "workspace-a");
    assert.deepEqual(body.data.workspaces[0]?.repo_ids, ["repo-a"]);
    assert.deepEqual(body.data.workspaces[0]?.session_ids, ["session-a"]);
  } finally {
    await running.close();
  }
});

test("project API registers, lists, and activates local folders", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-api-"));
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const projectDir = join(tempDir, "project");
    mkdirSync(projectDir);
    const normalizedProjectDir = realpathSync(projectDir);

    const createResponse = await postJson(`${running.url}/api/projects`, {
      path: projectDir
    });
    const createBody = await createResponse.json() as {
      data: {
        id: string;
        name: string;
        path: string;
        repo_root: string;
      };
    };

    assert.equal(createResponse.status, 201);
    assert.equal(createBody.data.name, "project");
    assert.equal(createBody.data.path, normalizedProjectDir);
    assert.equal(createBody.data.repo_root, normalizedProjectDir);

    const listResponse = await fetch(`${running.url}/api/projects`);
    const listBody = await listResponse.json() as { data: Array<{ id: string }> };
    assert.equal(listResponse.status, 200);
    assert.deepEqual(listBody.data.map((project) => project.id), [createBody.data.id]);

    const activateResponse = await postJson(`${running.url}/api/projects/${encodeURIComponent(createBody.data.id)}/activate`, {});
    const activateBody = await activateResponse.json() as { data: { id: string } };
    assert.equal(activateResponse.status, 200);
    assert.equal(activateBody.data.id, createBody.data.id);

    const activeResponse = await fetch(`${running.url}/api/projects/active`);
    const activeBody = await activeResponse.json() as { data: { id: string } | null };
    assert.equal(activeResponse.status, 200);
    assert.equal(activeBody.data?.id, createBody.data.id);
  } finally {
    await running.close();
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("GET /api/repo-map uses the active project folder", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-map-api-"));
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const parentRepoDir = join(tempDir, "parent-repo");
    const projectDir = join(parentRepoDir, "Quorexx");
    mkdirSync(join(parentRepoDir, "apps", "dashboard", "src"), { recursive: true });
    mkdirSync(join(projectDir, "src"), { recursive: true });
    execFileSync("git", ["init"], { cwd: parentRepoDir, stdio: "ignore" });
    writeFileSync(join(parentRepoDir, "apps", "dashboard", "src", "index.ts"), "export const dashboard = true;\n");
    writeFileSync(join(projectDir, "src", "index.ts"), "export const app = true;\n");

    const createResponse = await postJson(`${running.url}/api/projects`, {
      path: projectDir
    });
    const createBody = await createResponse.json() as {
      data: {
        id: string;
      };
    };
    await postJson(`${running.url}/api/projects/${encodeURIComponent(createBody.data.id)}/activate`, {});

    const response = await fetch(`${running.url}/api/repo-map`);
    const body = await response.json() as {
      data: {
        domains: Array<{ path: string }>;
        root: string;
      };
    };

    assert.equal(createResponse.status, 201);
    assert.equal(response.status, 200);
    assert.equal(body.data.root, "Quorexx");
    assert.ok(body.data.domains.some((domain) => domain.path === "src"));
    assert.ok(!body.data.domains.some((domain) => domain.path === "apps/dashboard"));
  } finally {
    await running.close();
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("project API suggests the server launch folder", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await fetch(`${running.url}/api/projects/default`);
    const body = await response.json() as {
      data: {
        name: string;
        path: string;
        repo_root: string;
      };
    };
    const launchFolder = realpathSync(process.cwd());
    const repoRoot = realpathSync(join(process.cwd(), "../.."));

    assert.equal(response.status, 200);
    assert.equal(body.data.path, launchFolder);
    assert.equal(body.data.repo_root, repoRoot);
    assert.ok(body.data.name.length > 0);
  } finally {
    await running.close();
  }
});

test("project API returns selected folder from injected picker", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-folder-picker-"));
  const normalizedTempDir = realpathSync(tempDir);
  const running = await listen({ port: 0 }, createSukaHttpServer({
    folderPicker: async () => ({ path: normalizedTempDir, selected: true })
  }));
  try {
    const response = await postJson(`${running.url}/api/projects/select-folder`, {});
    const body = await response.json() as { data: { path: string; selected: boolean } };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, {
      path: normalizedTempDir,
      selected: true
    });
  } finally {
    await running.close();
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("project API reports cancelled folder selection without failing", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer({
    folderPicker: async () => ({ reason: "Folder selection was cancelled.", selected: false })
  }));
  try {
    const response = await postJson(`${running.url}/api/projects/select-folder`, {});
    const body = await response.json() as { data: { reason: string; selected: boolean } };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, {
      reason: "Folder selection was cancelled.",
      selected: false
    });
  } finally {
    await running.close();
  }
});

test("project API persists active project with file-backed state", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-api-"));
  try {
    const dataFile = join(tempDir, "state.json");
    const projectDir = join(tempDir, "project");
    mkdirSync(projectDir);

    const first = await listen({ port: 0 }, createSukaHttpServer({
      service: createSukaService(new FileSukaStore(dataFile))
    }));
    let projectId = "";
    try {
      const createResponse = await postJson(`${first.url}/api/projects`, {
        path: projectDir
      });
      const createBody = await createResponse.json() as { data: { id: string } };
      projectId = createBody.data.id;

      const activateResponse = await postJson(`${first.url}/api/projects/${encodeURIComponent(projectId)}/activate`, {});
      assert.equal(createResponse.status, 201);
      assert.equal(activateResponse.status, 200);
    } finally {
      await first.close();
    }

    const second = await listen({ port: 0 }, createSukaHttpServer({
      service: createSukaService(new FileSukaStore(dataFile))
    }));
    try {
      const response = await fetch(`${second.url}/api/projects/active`);
      const body = await response.json() as { data: { id: string } | null };

      assert.equal(response.status, 200);
      assert.equal(body.data?.id, projectId);
    } finally {
      await second.close();
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("project API removes registered folders without deleting local files", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-delete-api-"));
  try {
    const firstDir = join(tempDir, "first");
    const secondDir = join(tempDir, "second");
    mkdirSync(firstDir);
    mkdirSync(secondDir);
    const service = createSukaService();
    const first = service.registerProject({
      path: firstDir
    });
    const second = service.registerProject({
      path: secondDir
    });
    service.activateProject(first.id);
    const tracker = new ProjectTrackingWorker(service, {
      detectLocalAgents: () => trackingDetectionReport(first.repo_root),
      now: () => new Date("2026-06-18T10:05:00.000Z")
    });
    const running = await listen({ port: 0 }, createSukaHttpServer({
      projectTracker: tracker,
      service
    }));
    try {
      const startResponse = await postJson(`${running.url}/api/projects/tracking/start`, {
        project_id: first.id
      });
      assert.equal(startResponse.status, 200);
      assert.equal(service.getState().presence.length, 1);

      const deleteResponse = await fetch(`${running.url}/api/projects/${encodeURIComponent(first.id)}`, {
        method: "DELETE"
      });
      const deleteBody = await deleteResponse.json() as {
        data: {
          active_project: { id: string } | null;
          project: { id: string };
          projects: Array<{ id: string }>;
        };
      };

      assert.equal(deleteResponse.status, 200);
      assert.equal(deleteBody.data.project.id, first.id);
      assert.deepEqual(deleteBody.data.projects.map((project) => project.id), [second.id]);
      assert.equal(deleteBody.data.active_project?.id, second.id);
      assert.equal(service.getState().presence.length, 0);
      assert.equal(tracker.status().running, false);
      assert.equal(existsSync(firstDir), true);
    } finally {
      await running.close();
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("project API returns client errors for invalid project paths", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-api-"));
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const missingPathResponse = await postJson(`${running.url}/api/projects`, {});
    const missingPathBody = await missingPathResponse.json() as { error: { code: string; message: string } };
    assert.equal(missingPathResponse.status, 400);
    assert.equal(missingPathBody.error.code, "invalid_body");
    assert.match(missingPathBody.error.message, /non-empty path/);

    const filePath = join(tempDir, "not-a-directory.txt");
    writeFileSync(filePath, "not a directory\n", "utf8");
    const fileResponse = await postJson(`${running.url}/api/projects`, {
      path: filePath
    });
    const fileBody = await fileResponse.json() as { error: { code: string; message: string } };
    assert.equal(fileResponse.status, 400);
    assert.equal(fileBody.error.code, "invalid_project_path");
    assert.match(fileBody.error.message, /directory/);
  } finally {
    await running.close();
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("project API returns not found when activating a missing project", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await postJson(`${running.url}/api/projects/missing/activate`, {});
    const body = await response.json() as { error: { code: string; message: string } };

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "project_not_found");
    assert.match(body.error.message, /not found/);
  } finally {
    await running.close();
  }
});

test("project API returns not found when removing a missing project", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await fetch(`${running.url}/api/projects/missing`, {
      method: "DELETE"
    });
    const body = await response.json() as { error: { code: string; message: string } };

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "project_not_found");
    assert.match(body.error.message, /not found/);
  } finally {
    await running.close();
  }
});

test("project tracking API starts, reports, and stops active project tracking", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-tracking-"));
  try {
    const projectDir = join(tempDir, "project");
    mkdirSync(projectDir);
    const service = createSukaService();
    const project = service.registerProject({
      path: projectDir
    });
    service.activateProject(project.id);
    let detections = 0;
    const tracker = new ProjectTrackingWorker(service, {
      detectLocalAgents: () => {
        detections += 1;
        return trackingDetectionReport(project.repo_root);
      },
      now: () => new Date("2026-06-18T10:05:00.000Z")
    });
    const running = await listen({ port: 0 }, createSukaHttpServer({
      projectTracker: tracker,
      service
    }));
    try {
      const startResponse = await postJson(`${running.url}/api/projects/tracking/start`, {});
      const startBody = await startResponse.json() as { data: { active_project_id: string; detected_agents: number; running: boolean } };
      assert.equal(startResponse.status, 200);
      assert.equal(startBody.data.running, true);
      assert.equal(startBody.data.active_project_id, project.id);
      assert.equal(startBody.data.detected_agents, 1);

      const secondStartResponse = await postJson(`${running.url}/api/projects/tracking/start`, {});
      assert.equal(secondStartResponse.status, 200);
      assert.equal(detections, 1);

      const statusResponse = await fetch(`${running.url}/api/projects/tracking`);
      const statusBody = await statusResponse.json() as { data: { published_presence: number; running: boolean } };
      assert.equal(statusResponse.status, 200);
      assert.equal(statusBody.data.running, true);
      assert.equal(statusBody.data.published_presence, 1);
      assert.equal(service.getState().presence[0]?.repo_id, project.repo_id);

      const stopResponse = await postJson(`${running.url}/api/projects/tracking/stop`, {});
      const stopBody = await stopResponse.json() as { data: { running: boolean } };
      assert.equal(stopResponse.status, 200);
      assert.equal(stopBody.data.running, false);
      assert.equal(service.getState().presence.length, 0);
    } finally {
      await running.close();
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("project tracking API reports detector warnings", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-tracking-"));
  try {
    const projectDir = join(tempDir, "project");
    mkdirSync(projectDir);
    const service = createSukaService();
    const project = service.registerProject({
      path: projectDir
    });
    service.activateProject(project.id);
    const tracker = new ProjectTrackingWorker(service, {
      detectLocalAgents: () => ({
        agents: [],
        changed_files: [],
        generated_at: "2026-06-18T10:05:00.000Z",
        repo_root: project.repo_root,
        warnings: ["Could not inspect local processes: unavailable."]
      })
    });
    const running = await listen({ port: 0 }, createSukaHttpServer({
      projectTracker: tracker,
      service
    }));
    try {
      const response = await postJson(`${running.url}/api/projects/tracking/start`, {});
      const body = await response.json() as { data: { warnings: string[] } };

      assert.equal(response.status, 200);
      assert.deepEqual(body.data.warnings, ["Could not inspect local processes: unavailable."]);
    } finally {
      tracker.stop();
      await running.close();
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("project tracking worker stops when the HTTP server closes", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-project-tracking-"));
  try {
    const projectDir = join(tempDir, "project");
    mkdirSync(projectDir);
    const service = createSukaService();
    const project = service.registerProject({
      path: projectDir
    });
    service.activateProject(project.id);
    const tracker = new ProjectTrackingWorker(service, {
      detectLocalAgents: () => trackingDetectionReport(project.repo_root),
      now: () => new Date("2026-06-18T10:05:00.000Z")
    });
    const running = await listen({ port: 0 }, createSukaHttpServer({
      projectTracker: tracker,
      service
    }));

    await postJson(`${running.url}/api/projects/tracking/start`, {});
    assert.equal(tracker.status().running, true);

    await running.close();
    assert.equal(tracker.status().running, false);
    assert.equal(service.getState().presence.length, 0);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("GET /api/repo-map returns repository domains", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await fetch(`${running.url}/api/repo-map`);
    const body = await response.json() as {
      data: {
        domains: Array<{ id: string; path: string }>;
        edges: unknown[];
      };
    };

    assert.equal(response.status, 200);
    assert.ok(body.data.domains.some((domain) => domain.path === "apps/dashboard"));
    assert.ok(body.data.domains.some((domain) => domain.path === "apps/server"));
    assert.ok(body.data.edges.length > 0);
  } finally {
    await running.close();
  }
});

test("GET / returns the dashboard shell", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await fetch(`${running.url}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    assert.match(body, /Suka Operations Canvas/);
  } finally {
    await running.close();
  }
});

test("GET /vendor/lucide.min.js returns the local icon bundle", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await fetch(`${running.url}/vendor/lucide.min.js`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/javascript/);
    assert.match(body, /createIcons/);
  } finally {
    await running.close();
  }
});

test("GET /api/realtime sends bootstrap state over WebSocket", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  const socket = new WebSocket(`${running.url.replace("http://", "ws://")}/api/realtime`);
  try {
    const message = await nextJsonMessage(socket) as { data: { claims: unknown[] }; type: string };

    assert.equal(message.type, "state.bootstrap");
    assert.deepEqual(message.data.claims, []);
  } finally {
    socket.close();
    await running.close();
  }
});

test("POST /api/pointers broadcasts pointer updates over WebSocket", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  const socket = new WebSocket(`${running.url.replace("http://", "ws://")}/api/realtime`);
  try {
    const bootstrap = await nextJsonMessage(socket) as { type: string };
    assert.equal(bootstrap.type, "state.bootstrap");

    const messagesPromise = nextJsonMessages(socket, 2);
    const createResponse = await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Implement Stripe webhook handling",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    const [message, teamMessage] = await messagesPromise as [
      { data: { id: string; type: string }; type: string },
      { data: { active_agents: number }; type: string }
    ];

    assert.equal(createResponse.status, 201);
    assert.equal(message.type, "pointer.published");
    assert.equal(message.data.type, "claim");
    assert.equal(message.data.id, "ptr_claim_01");
    assert.equal(teamMessage.type, "team.updated");
  } finally {
    socket.close();
    await running.close();
  }
});

test("POST /api/ledger broadcasts ledger pointer updates over WebSocket", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  const socket = new WebSocket(`${running.url.replace("http://", "ws://")}/api/realtime`);
  try {
    const bootstrap = await nextJsonMessage(socket) as { type: string };
    assert.equal(bootstrap.type, "state.bootstrap");

    const messagesPromise = nextJsonMessages(socket, 2);
    const createResponse = await postJson(`${running.url}/api/ledger`, {
      id: "ptr_ledger_01",
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "codex-trent-01",
      event_type: "file_modified",
      summary: "Ledger update should broadcast.",
      affected_paths: ["apps/dashboard/src/main.tsx"],
      branch: "main",
      worktree: "/worktrees/suka/main",
      created_at: "2026-06-24T10:00:00.000Z"
    });
    const [message, teamMessage] = await messagesPromise as [
      { data: { id: string; type: string }; type: string },
      { data: { active_agents: number }; type: string }
    ];

    assert.equal(createResponse.status, 201);
    assert.equal(message.type, "pointer.published");
    assert.equal(message.data.type, "ledger");
    assert.equal(message.data.id, "ptr_ledger_01");
    assert.equal(teamMessage.type, "team.updated");
  } finally {
    socket.close();
    await running.close();
  }
});

test("POST /api/expire broadcasts expired state over WebSocket", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  const socket = new WebSocket(`${running.url.replace("http://", "ws://")}/api/realtime`);
  try {
    const bootstrap = await nextJsonMessage(socket) as { type: string };
    assert.equal(bootstrap.type, "state.bootstrap");

    const createMessagesPromise = nextJsonMessages(socket, 2);
    const createResponse = await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Implement Stripe webhook handling",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2026-06-12T10:01:00.000Z"
    });
    const [pointerMessage, createTeamMessage] = await createMessagesPromise as [{ type: string }, { type: string }];
    assert.equal(createResponse.status, 201);
    assert.equal(pointerMessage.type, "pointer.published");
    assert.equal(createTeamMessage.type, "team.updated");

    const expireMessagesPromise = nextJsonMessages(socket, 2);
    const expireResponse = await postJson(`${running.url}/api/expire`, {
      now: "2026-06-12T10:02:00.000Z"
    });
    const [message, expireTeamMessage] = await expireMessagesPromise as [
      { data: { claims: unknown[] }; type: string },
      { type: string }
    ];

    assert.equal(expireResponse.status, 200);
    assert.equal(message.type, "state.expired");
    assert.deepEqual(message.data.claims, []);
    assert.equal(expireTeamMessage.type, "team.updated");
  } finally {
    socket.close();
    await running.close();
  }
});

test("DELETE /api/claims/:id broadcasts claim release over WebSocket", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  const socket = new WebSocket(`${running.url.replace("http://", "ws://")}/api/realtime`);
  try {
    const bootstrap = await nextJsonMessage(socket) as { type: string };
    assert.equal(bootstrap.type, "state.bootstrap");

    const createMessagesPromise = nextJsonMessages(socket, 2);
    const createResponse = await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Implement Stripe webhook handling",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    const [pointerMessage, createTeamMessage] = await createMessagesPromise as [{ type: string }, { type: string }];
    assert.equal(createResponse.status, 201);
    assert.equal(pointerMessage.type, "pointer.published");
    assert.equal(createTeamMessage.type, "team.updated");

    const releaseMessagesPromise = nextJsonMessages(socket, 2);
    const releaseResponse = await fetch(`${running.url}/api/claims/ptr_claim_01`, {
      method: "DELETE"
    });
    const [message, releaseTeamMessage] = await releaseMessagesPromise as [
      { data: { id: string }; type: string },
      { type: string }
    ];

    assert.equal(releaseResponse.status, 200);
    assert.equal(message.type, "claim.released");
    assert.deepEqual(message.data, { id: "ptr_claim_01" });
    assert.equal(releaseTeamMessage.type, "team.updated");
  } finally {
    socket.close();
    await running.close();
  }
});

test("POST /api/cleanup removes scoped state and broadcasts cleaned state", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  const socket = new WebSocket(`${running.url.replace("http://", "ws://")}/api/realtime`);
  try {
    const bootstrap = await nextJsonMessage(socket) as { type: string };
    assert.equal(bootstrap.type, "state.bootstrap");

    const createMessagesPromise = nextJsonMessages(socket, 2);
    await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_session_a",
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Clean session A work",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    const [pointerMessage, createTeamMessage] = await createMessagesPromise as [{ type: string }, { type: string }];
    assert.equal(pointerMessage.type, "pointer.published");
    assert.equal(createTeamMessage.type, "team.updated");

    const secondCreateMessagesPromise = nextJsonMessages(socket, 2);
    await postJson(`${running.url}/api/pointers`, {
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
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    const [secondPointerMessage, secondTeamMessage] = await secondCreateMessagesPromise as [{ type: string }, { type: string }];
    assert.equal(secondPointerMessage.type, "pointer.published");
    assert.equal(secondTeamMessage.type, "team.updated");

    const cleanupMessagesPromise = nextJsonMessages(socket, 2);
    const response = await postJson(`${running.url}/api/cleanup`, {
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a"
    });
    const body = await response.json() as { data: { removed: { claims: number }; state: { claims: Array<{ id: string }> } } };
    const [message, cleanupTeamMessage] = await cleanupMessagesPromise as [
      { data: { claims: Array<{ id: string }> }; type: string },
      { type: string }
    ];

    assert.equal(response.status, 200);
    assert.equal(body.data.removed.claims, 1);
    assert.deepEqual(body.data.state.claims.map((claim) => claim.id), ["ptr_claim_session_b"]);
    assert.equal(message.type, "state.cleaned");
    assert.deepEqual(message.data.claims.map((claim) => claim.id), ["ptr_claim_session_b"]);
    assert.equal(cleanupTeamMessage.type, "team.updated");
  } finally {
    socket.close();
    await running.close();
  }
});

test("realtime origin validation allows local clients and rejects remote browser origins", () => {
  assert.equal(isAllowedRealtimeOrigin(undefined, "127.0.0.1:4366"), true);
  assert.equal(isAllowedRealtimeOrigin("http://127.0.0.1:4366", "127.0.0.1:4366"), true);
  assert.equal(isAllowedRealtimeOrigin("http://localhost:4366", "127.0.0.1:4366"), true);
  assert.equal(isAllowedRealtimeOrigin("http://192.168.1.10:4366", "192.168.1.10:4366"), true);
  assert.equal(isAllowedRealtimeOrigin("http://192.168.1.20:4366", "192.168.1.10:4366"), false);
  assert.equal(isAllowedRealtimeOrigin("https://example.com", "127.0.0.1:4366"), false);
  assert.equal(isAllowedRealtimeOrigin("not a url", "127.0.0.1:4366"), false);
});

test("POST /api/cleanup rejects empty cleanup context", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await postJson(`${running.url}/api/cleanup`, {});
    const body = await response.json() as { error: { code: string; message: string } };

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "invalid_body");
    assert.match(body.error.message, /requires at least one context field/);
  } finally {
    await running.close();
  }
});

test("POST /api/pointers validates and stores pointers", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const createResponse = await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Implement Stripe webhook handling",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });

    assert.equal(createResponse.status, 201);

    const stateResponse = await fetch(`${running.url}/api/state`);
    const state = await stateResponse.json() as { data: { claims: unknown[] } };

    assert.equal(state.data.claims.length, 1);
  } finally {
    await running.close();
  }
});

test("POST /api/decisions stores accepted decision memory", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const createResponse = await postJson(`${running.url}/api/decisions`, {
      id: "ptr_decision_01",
      title: "Webhook handlers must be idempotent",
      body: "Payment webhook handlers must tolerate duplicate delivery.",
      scope: {
        paths: ["src/billing/**"]
      },
      status: "accepted",
      confidence: "high",
      evidence: ["docs/payments.md"],
      created_by: "codex-trent-01",
      approved_by: "trent",
      created_at: "2026-06-12T10:00:00.000Z"
    });
    const body = await createResponse.json() as { data: { id: string; type: string } };

    assert.equal(createResponse.status, 201);
    assert.equal(body.data.type, "decision");
    assert.equal(body.data.id, "ptr_decision_01");

    const listResponse = await fetch(`${running.url}/api/decisions`);
    const listBody = await listResponse.json() as { data: Array<{ id: string }> };

    assert.equal(listResponse.status, 200);
    assert.deepEqual(listBody.data.map((decision) => decision.id), ["ptr_decision_01"]);
  } finally {
    await running.close();
  }
});

test("POST /api/decisions rejects accepted decisions without evidence", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await postJson(`${running.url}/api/decisions`, {
      id: "ptr_decision_01",
      title: "Webhook handlers must be idempotent",
      body: "Payment webhook handlers must tolerate duplicate delivery.",
      scope: {
        paths: ["src/billing/**"]
      },
      status: "accepted",
      confidence: "high",
      evidence: [],
      created_by: "codex-trent-01",
      created_at: "2026-06-12T10:00:00.000Z"
    });
    const body = await response.json() as { error: { issues: Array<{ path: string }> } };

    assert.equal(response.status, 400);
    assert.equal(body.error.issues.at(-1)?.path, "evidence");
  } finally {
    await running.close();
  }
});

test("POST /api/decisions rejects non-decision pointers without persisting them", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await postJson(`${running.url}/api/decisions`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Implement Stripe webhook handling",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    const stateResponse = await fetch(`${running.url}/api/state`);
    const state = await stateResponse.json() as { data: { claims: unknown[]; decisions: unknown[] } };

    assert.equal(response.status, 400);
    assert.equal(state.data.claims.length, 0);
    assert.equal(state.data.decisions.length, 0);
  } finally {
    await running.close();
  }
});

test("POST /api/briefs stores session handoff briefs", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const createResponse = await postJson(`${running.url}/api/briefs`, {
      id: "ptr_brief_01",
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "codex-trent-01",
      summary: "Dashboard focus handoff",
      changed_files: ["apps/dashboard/src/main.tsx"],
      decisions_made: ["Keep session selection local"],
      assumptions: ["Server state remains source of truth"],
      skipped_work: ["Hosted persistence"],
      risks: ["Stale browser state"],
      blockers: [],
      next_action: "Add Current Truth panel",
      related_claims: ["claim_dashboard"],
      related_sessions: ["session-a"],
      created_at: "2026-06-12T10:00:00.000Z"
    });
    const body = await createResponse.json() as { data: { id: string; type: string } };

    assert.equal(createResponse.status, 201);
    assert.equal(body.data.type, "brief");
    assert.equal(body.data.id, "ptr_brief_01");

    const listResponse = await fetch(`${running.url}/api/briefs`);
    const listBody = await listResponse.json() as { data: Array<{ id: string }> };

    assert.equal(listResponse.status, 200);
    assert.deepEqual(listBody.data.map((brief) => brief.id), ["ptr_brief_01"]);
  } finally {
    await running.close();
  }
});

test("POST /api/briefs rejects non-brief pointers without persisting them", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await postJson(`${running.url}/api/briefs`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Implement Stripe webhook handling",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    const stateResponse = await fetch(`${running.url}/api/state`);
    const state = await stateResponse.json() as { data: { briefs: unknown[]; claims: unknown[] } };

    assert.equal(response.status, 400);
    assert.equal(state.data.briefs.length, 0);
    assert.equal(state.data.claims.length, 0);
  } finally {
    await running.close();
  }
});

test("POST /api/ledger stores append-only ledger entries", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const createResponse = await postJson(`${running.url}/api/ledger`, {
      id: "ptr_ledger_01",
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "codex-trent-01",
      event_type: "file_modified",
      summary: "Dashboard ledger feed became durable.",
      affected_paths: ["apps/dashboard/src/main.tsx"],
      branch: "main",
      worktree: "/worktrees/suka/main",
      evidence: ["issue:145"],
      token_usage: {
        input_tokens: 100,
        output_tokens: 40
      },
      created_at: "2026-06-24T10:00:00.000Z"
    });
    const body = await createResponse.json() as { data: { id: string; type: string } };

    assert.equal(createResponse.status, 201);
    assert.equal(body.data.type, "ledger");
    assert.equal(body.data.id, "ptr_ledger_01");

    const listResponse = await fetch(`${running.url}/api/ledger`);
    const listBody = await listResponse.json() as { data: Array<{ id: string }> };

    assert.equal(listResponse.status, 200);
    assert.deepEqual(listBody.data.map((entry) => entry.id), ["ptr_ledger_01"]);
  } finally {
    await running.close();
  }
});

test("ledger MVP API stores and filters structured ledger records", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const taskResponse = await postJson(`${running.url}/api/ledger/tasks`, {
      task_id: "task_api_01",
      session_id: "session-a",
      repo_id: "repo-a",
      workspace_id: "workspace-a",
      title: "Expose ledger API",
      intent_summary: "Add HTTP routes for structured ledger records.",
      task_type: "implementation",
      status: "completed",
      started_at: "2026-06-25T07:00:00.000Z",
      related_issue_ids: ["170"],
      related_claim_ids: [],
      related_checkpoint_ids: ["checkpoint_pr_178"]
    });
    await postJson(`${running.url}/api/ledger/tasks`, {
      task_id: "task_api_other",
      session_id: "session-b",
      repo_id: "repo-b",
      title: "Other repo task",
      intent_summary: "This task should not appear in repo-a filtered reads.",
      task_type: "planning",
      status: "active",
      started_at: "2026-06-25T07:05:00.000Z",
      related_issue_ids: [],
      related_claim_ids: [],
      related_checkpoint_ids: []
    });
    const tokenUsageResponse = await postJson(`${running.url}/api/ledger/token-usage`, {
      task_id: "task_api_01",
      provider: "openai",
      model: "gpt-5",
      input_tokens: 2300,
      output_tokens: 4100,
      total_tokens: 6400,
      estimated_cost: 0.18,
      currency: "USD",
      measurement_source: "api"
    });
    const assessmentResponse = await postJson(`${running.url}/api/ledger/token-assessments`, {
      task_id: "task_api_01",
      value_category: "delivery",
      usefulness_score: 88,
      assessed_by: "rule",
      confidence: "medium",
      reason: "API routes were added with tests."
    });
    const eventResponse = await postJson(`${running.url}/api/ledger/events`, {
      event_id: "event_api_01",
      task_id: "task_api_01",
      session_id: "session-a",
      repo_id: "repo-a",
      event_type: "file_changed",
      timestamp: "2026-06-25T07:10:00.000Z",
      summary: "Added ledger API routes.",
      severity: "info",
      affected_paths: ["apps/server/src/http.ts"]
    });
    const checkpointResponse = await postJson(`${running.url}/api/ledger/checkpoints`, {
      checkpoint_id: "checkpoint_pr_178",
      repo_id: "repo-a",
      kind: "pr",
      external_id: "178",
      title: "Expose ledger API",
      status: "open",
      created_at: "2026-06-25T07:20:00.000Z",
      related_task_ids: ["task_api_01"],
      related_issue_ids: ["170"],
      related_session_ids: ["session-a"],
      summary: "HTTP routes expose structured ledger records."
    });

    assert.equal(taskResponse.status, 201);
    assert.equal(tokenUsageResponse.status, 201);
    assert.equal(assessmentResponse.status, 201);
    assert.equal(eventResponse.status, 201);
    assert.equal(checkpointResponse.status, 201);

    const tasksResponse = await fetch(`${running.url}/api/ledger/tasks?repo_id=repo-a`);
    const tasksBody = await tasksResponse.json() as { data: Array<{ task_id: string }> };
    const tokenUsageListResponse = await fetch(`${running.url}/api/ledger/token-usage?repo_id=repo-a`);
    const tokenUsageListBody = await tokenUsageListResponse.json() as { data: Array<{ total_tokens: number }> };
    const assessmentsResponse = await fetch(`${running.url}/api/ledger/token-assessments?task_id=task_api_01`);
    const assessmentsBody = await assessmentsResponse.json() as { data: Array<{ value_category: string }> };
    const eventsResponse = await fetch(`${running.url}/api/ledger/events?session_id=session-a`);
    const eventsBody = await eventsResponse.json() as { data: Array<{ event_id: string }> };
    const checkpointsResponse = await fetch(`${running.url}/api/ledger/checkpoints?task_id=task_api_01`);
    const checkpointsBody = await checkpointsResponse.json() as { data: Array<{ checkpoint_id: string }> };
    const stateResponse = await fetch(`${running.url}/api/state`);
    const stateBody = await stateResponse.json() as { data: { ledger_tasks: Array<{ task_id: string }> } };

    assert.deepEqual(tasksBody.data.map((entry) => entry.task_id), ["task_api_01"]);
    assert.deepEqual(tokenUsageListBody.data.map((entry) => entry.total_tokens), [6400]);
    assert.deepEqual(assessmentsBody.data.map((entry) => entry.value_category), ["delivery"]);
    assert.deepEqual(eventsBody.data.map((entry) => entry.event_id), ["event_api_01"]);
    assert.deepEqual(checkpointsBody.data.map((entry) => entry.checkpoint_id), ["checkpoint_pr_178"]);
    assert.deepEqual(stateBody.data.ledger_tasks.map((entry) => entry.task_id), ["task_api_01", "task_api_other"]);
  } finally {
    await running.close();
  }
});

test("ledger MVP API returns validation errors without persisting malformed records", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const taskResponse = await postJson(`${running.url}/api/ledger/tasks`, {
      task_id: "",
      session_id: "session-a",
      repo_id: "repo-a",
      title: "Invalid task",
      intent_summary: "Invalid task",
      task_type: "implementation",
      status: "completed",
      started_at: "not-a-date",
      related_issue_ids: [],
      related_claim_ids: [],
      related_checkpoint_ids: []
    });
    const tokenUsageResponse = await postJson(`${running.url}/api/ledger/token-usage`, {
      task_id: "task_invalid",
      provider: "openai",
      input_tokens: -1,
      output_tokens: 1,
      total_tokens: 0,
      measurement_source: "api"
    });
    const eventResponse = await postJson(`${running.url}/api/ledger/events`, {
      event_id: "event_invalid",
      session_id: "session-a",
      repo_id: "repo-a",
      event_type: "file_changed",
      timestamp: "not-a-date",
      summary: "Invalid event",
      severity: "info",
      affected_paths: []
    });
    const assessmentResponse = await postJson(`${running.url}/api/ledger/token-assessments`, {
      task_id: "task_invalid",
      value_category: "waste",
      assessed_by: "rule",
      confidence: "medium"
    });
    const checkpointResponse = await postJson(`${running.url}/api/ledger/checkpoints`, {
      checkpoint_id: "checkpoint_invalid",
      repo_id: "repo-a",
      kind: "pull_request",
      title: "Invalid checkpoint",
      status: "open",
      created_at: "2026-06-25T07:20:00.000Z",
      related_task_ids: [],
      related_issue_ids: [],
      related_session_ids: [],
      summary: "Invalid checkpoint"
    });
    const taskBody = await taskResponse.json() as { error: { code: string; issues: Array<{ path: string }> } };
    const tokenUsageBody = await tokenUsageResponse.json() as { error: { issues: Array<{ path: string }> } };
    const eventBody = await eventResponse.json() as { error: { issues: Array<{ path: string }> } };
    const assessmentBody = await assessmentResponse.json() as { error: { issues: Array<{ path: string }> } };
    const checkpointBody = await checkpointResponse.json() as { error: { issues: Array<{ path: string }> } };
    const stateResponse = await fetch(`${running.url}/api/state`);
    const stateBody = await stateResponse.json() as {
      data: {
        ledger_checkpoints: unknown[];
        ledger_events: unknown[];
        ledger_tasks: unknown[];
        ledger_token_assessments: unknown[];
        ledger_token_usage: unknown[];
      };
    };

    assert.equal(taskResponse.status, 400);
    assert.equal(taskBody.error.code, "validation_failed");
    assert.ok(taskBody.error.issues.some((issue) => issue.path === "task_id"));
    assert.equal(tokenUsageResponse.status, 400);
    assert.ok(tokenUsageBody.error.issues.some((issue) => issue.path === "input_tokens"));
    assert.equal(eventResponse.status, 400);
    assert.ok(eventBody.error.issues.some((issue) => issue.path === "timestamp"));
    assert.equal(assessmentResponse.status, 400);
    assert.ok(assessmentBody.error.issues.some((issue) => issue.path === "value_category"));
    assert.equal(checkpointResponse.status, 400);
    assert.ok(checkpointBody.error.issues.some((issue) => issue.path === "kind"));
    assert.equal(stateBody.data.ledger_tasks.length, 0);
    assert.equal(stateBody.data.ledger_token_usage.length, 0);
    assert.equal(stateBody.data.ledger_token_assessments.length, 0);
    assert.equal(stateBody.data.ledger_events.length, 0);
    assert.equal(stateBody.data.ledger_checkpoints.length, 0);
  } finally {
    await running.close();
  }
});

test("POST /api/ledger rejects non-ledger pointers without persisting them", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await postJson(`${running.url}/api/ledger`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Implement Stripe webhook handling",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    const stateResponse = await fetch(`${running.url}/api/state`);
    const state = await stateResponse.json() as { data: { claims: unknown[]; ledger: unknown[] } };

    assert.equal(response.status, 400);
    assert.equal(state.data.claims.length, 0);
    assert.equal(state.data.ledger.length, 0);
  } finally {
    await running.close();
  }
});

test("POST /api/pointers returns validation issues for invalid pointers", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    const response = await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {},
      reason: "Invalid empty scope",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    const body = await response.json() as { error: { issues: Array<{ code: string }> } };

    assert.equal(response.status, 400);
    assert.equal(body.error.issues[0]?.code, "empty_scope");
  } finally {
    await running.close();
  }
});

test("POST /api/pointers returns client error and structured log for invalid JSON", async () => {
  const logs: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = [];
  const running = await listen({ port: 0 }, createSukaHttpServer({
    logger: {
      log(level, message, fields) {
        const entry: { level: string; message: string; fields?: Record<string, unknown> } = { level, message };
        if (fields !== undefined) {
          entry.fields = fields;
        }
        logs.push(entry);
      }
    }
  }));
  try {
    const response = await fetch(`${running.url}/api/pointers`, {
      body: "{",
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json() as { error: { code: string; message: string } };

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "invalid_json");
    assert.match(body.error.message, /valid JSON/);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.level, "error");
    assert.equal(logs[0]?.message, "request failed");
    assert.equal(logs[0]?.fields?.error_code, "invalid_json");
    assert.equal(logs[0]?.fields?.method, "POST");
    assert.equal(logs[0]?.fields?.path, "/api/pointers");
  } finally {
    await running.close();
  }
});

test("POST /api/conflicts/check returns claim conflicts", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Implement Stripe webhook handling",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });

    const response = await postJson(`${running.url}/api/conflicts/check`, {
      agent_id: "cursor-maya-01",
      paths: ["src/billing/invoice.ts"]
    });
    const body = await response.json() as { data: Array<{ reason: string }> };

    assert.equal(response.status, 200);
    assert.equal(body.data[0]?.reason, "path_overlap");
  } finally {
    await running.close();
  }
});

test("POST /api/conflicts/check filters conflicts by coordination context", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_session_a",
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "codex-trent-01",
      scope: {
        apis: ["POST /api/payments"]
      },
      reason: "Implement session A payment flow",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });
    await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_session_b",
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-b",
      agent_id: "codex-trent-02",
      scope: {
        apis: ["POST /api/payments"]
      },
      reason: "Implement session B payment flow",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });

    const response = await postJson(`${running.url}/api/conflicts/check`, {
      workspace_id: "workspace-a",
      repo_id: "repo-a",
      session_id: "session-a",
      agent_id: "cursor-maya-01",
      apis: ["POST /api/payments"]
    });
    const body = await response.json() as { data: Array<{ pointers: string[]; reason: string }> };

    assert.equal(response.status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0]?.reason, "api_overlap");
    assert.deepEqual(body.data[0]?.pointers, ["ptr_claim_session_a"]);
  } finally {
    await running.close();
  }
});

test("DELETE /api/claims/:id releases claims", async () => {
  const running = await listen({ port: 0 }, createSukaHttpServer());
  try {
    await postJson(`${running.url}/api/pointers`, {
      type: "claim",
      id: "ptr_claim_01",
      agent_id: "codex-trent-01",
      scope: {
        paths: ["src/billing/**"]
      },
      reason: "Implement Stripe webhook handling",
      kind: "soft_claim",
      created_at: "2026-06-12T10:00:00.000Z",
      expires_at: "2099-06-12T11:00:00.000Z"
    });

    const response = await fetch(`${running.url}/api/claims/ptr_claim_01`, {
      method: "DELETE"
    });
    const stateResponse = await fetch(`${running.url}/api/state`);
    const state = await stateResponse.json() as { data: { claims: unknown[] } };

    assert.equal(response.status, 200);
    assert.equal(state.data.claims.length, 0);
  } finally {
    await running.close();
  }
});

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });
}

async function nextJsonMessage(socket: WebSocket): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("error", onError);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error("Timed out waiting for WebSocket message."));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onMessage = (data: WebSocket.RawData) => {
      cleanup();
      try {
        resolve(JSON.parse(data.toString()) as unknown);
      } catch (error) {
        reject(error);
      }
    };
    const timer = setTimeout(onTimeout, 2000);

    socket.once("message", onMessage);
    socket.once("error", onError);
  });
}

async function nextJsonMessages(socket: WebSocket, count: number): Promise<unknown[]> {
  return await new Promise((resolve, reject) => {
    const messages: unknown[] = [];
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("message", onMessage);
      socket.off("error", onError);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error("Timed out waiting for WebSocket messages."));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onMessage = (data: WebSocket.RawData) => {
      try {
        messages.push(JSON.parse(data.toString()) as unknown);
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }

      if (messages.length === count) {
        cleanup();
        resolve(messages);
      }
    };
    const timer = setTimeout(onTimeout, 2000);

    socket.on("message", onMessage);
    socket.once("error", onError);
  });
}

function trackingDetectionReport(repoRoot: string): LocalAgentDetectionReport {
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
