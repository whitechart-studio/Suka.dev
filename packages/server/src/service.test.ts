import test from "node:test";
import assert from "node:assert/strict";
import { createSukaService } from "./index.js";

test("publishes valid claims and checks conflicts", () => {
  const service = createSukaService();
  const result = service.publish({
    type: "claim",
    id: "ptr_claim_01",
    agent_id: "codex-trent-01",
    scope: {
      paths: ["src/billing/**"]
    },
    reason: "Implementing Stripe webhook handling",
    kind: "soft_claim",
    created_at: "2026-06-12T10:00:00.000Z",
    expires_at: "2026-06-12T11:00:00.000Z"
  });

  assert.equal(result.ok, true);
  assert.equal(service.getState().claims.length, 1);

  const warnings = service.checkConflicts({
    agent_id: "cursor-maya-01",
    paths: ["src/billing/invoice.ts"]
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.reason, "path_overlap");
});

test("rejects invalid pointers before persistence", () => {
  const service = createSukaService();
  const result = service.publish({
    type: "event",
    id: "ptr_event_01",
    event_type: "unknown",
    summary: "Invalid event",
    affected_paths: [],
    affected_apis: [],
    affected_tables: [],
    affected_env: [],
    agent_id: "codex-trent-01",
    created_at: "2026-06-12T10:00:00.000Z"
  });

  assert.equal(result.ok, false);
  assert.equal(service.getState().events.length, 0);
});

test("expires stale presence and claims idempotently", () => {
  const service = createSukaService();
  service.publish({
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

  service.expire(new Date("2026-06-12T10:02:00.000Z"));
  service.expire(new Date("2026-06-12T10:02:00.000Z"));

  assert.equal(service.getState().presence.length, 0);
});

