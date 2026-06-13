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
    const message = await nextJsonMessage(socket) as { data: { id: string; type: string }; type: string };

    assert.equal(createResponse.status, 201);
    assert.equal(message.type, "pointer.published");
    assert.equal(message.data.type, "claim");
    assert.equal(message.data.id, "ptr_claim_01");
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
    const pointerMessage = await nextJsonMessage(socket) as { type: string };
    assert.equal(createResponse.status, 201);
    assert.equal(pointerMessage.type, "pointer.published");

    const expireResponse = await postJson(`${running.url}/api/expire`, {
      now: "2026-06-12T10:02:00.000Z"
    });
    const message = await nextJsonMessage(socket) as { data: { claims: unknown[] }; type: string };

    assert.equal(expireResponse.status, 200);
    assert.equal(message.type, "state.expired");
    assert.deepEqual(message.data.claims, []);
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
    const pointerMessage = await nextJsonMessage(socket) as { type: string };
    assert.equal(createResponse.status, 201);
    assert.equal(pointerMessage.type, "pointer.published");

    const releaseResponse = await fetch(`${running.url}/api/claims/ptr_claim_01`, {
      method: "DELETE"
    });
    const message = await nextJsonMessage(socket) as { data: { id: string }; type: string };

    assert.equal(releaseResponse.status, 200);
    assert.equal(message.type, "claim.released");
    assert.deepEqual(message.data, { id: "ptr_claim_01" });
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
