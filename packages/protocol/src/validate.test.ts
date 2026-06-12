import test from "node:test";
import assert from "node:assert/strict";
import { validatePointer } from "./index.js";

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

