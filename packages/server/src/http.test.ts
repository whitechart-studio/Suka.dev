import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { createSukaHttpServer, isAllowedRealtimeOrigin, listen } from "./index.js";

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
      current_files: ["packages/server/src/http.ts"],
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
    assert.ok(body.data.domains.some((domain) => domain.path === "packages/server"));
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
