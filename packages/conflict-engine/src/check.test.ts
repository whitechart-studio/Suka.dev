import test from "node:test";
import assert from "node:assert/strict";
import type { ClaimPointer } from "@suka/protocol";
import { checkConflicts, normalizeRepoPath } from "./index.js";

const claim: ClaimPointer = {
  type: "claim",
  id: "ptr_claim_01",
  agent_id: "codex-trent-01",
  scope: {
    paths: ["src/billing/**"],
    apis: ["POST /api/payments"],
    tables: ["billing_events"]
  },
  reason: "Implementing payment webhook flow",
  kind: "soft_claim",
  created_at: "2026-06-12T10:00:00.000Z",
  expires_at: "2026-06-12T10:45:00.000Z"
};

test("normalizes Windows and POSIX paths to repo-relative slash paths", () => {
  assert.equal(normalizeRepoPath("C:\\repo\\src\\billing\\webhook.ts"), "repo/src/billing/webhook.ts");
  assert.equal(normalizeRepoPath("./src//billing/webhook.ts"), "src/billing/webhook.ts");
});

test("detects path overlap against a soft claim", () => {
  const warnings = checkConflicts({
    subject: {
      agent_id: "cursor-maya-01",
      paths: ["src/billing/invoice.ts"]
    },
    active_claims: [claim]
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.severity, "medium");
  assert.equal(warnings[0]?.reason, "path_overlap");
});

test("detects API overlap as high severity", () => {
  const warnings = checkConflicts({
    subject: {
      agent_id: "cursor-maya-01",
      apis: ["POST /api/payments"]
    },
    active_claims: [claim]
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.severity, "high");
  assert.equal(warnings[0]?.reason, "api_overlap");
});

