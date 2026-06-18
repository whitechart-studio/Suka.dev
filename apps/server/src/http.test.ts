import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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
