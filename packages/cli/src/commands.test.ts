import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "./index.js";

test("status prints state summary", async () => {
  const output: string[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: ["status", "--server", "http://suka.test"],
    env: {},
    fetch: fakeFetch({
      presence: [],
      claims: [],
      events: [],
      decisions: []
    }),
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(output.join(""), /Suka state/);
  assert.deepEqual(errors, []);
});

test("claim publishes a claim pointer", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await runCli({
    argv: ["claim", "src/billing/**", "--server", "http://suka.test", "--agent", "codex-01", "--reason", "Billing work"],
    env: {},
    now: new Date("2026-06-12T10:00:00.000Z"),
    fetch: async (url, init) => {
      const request: { url: string; init?: RequestInit } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/pointers");
  assert.equal(requests[0]?.init?.method, "POST");
  const body = JSON.parse(String(requests[0]?.init?.body)) as { type: string; agent_id: string };
  assert.equal(body.type, "claim");
  assert.equal(body.agent_id, "codex-01");
});

test("unknown command exits with an error", async () => {
  const errors: string[] = [];
  const result = await runCli({
    argv: ["nope"],
    env: {},
    fetch: fakeFetch({}),
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.match(errors.join(""), /Unknown command/);
});

test("init creates repo config", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-cli-"));
  const originalCwd = process.cwd();
  const output: string[] = [];
  try {
    process.chdir(tempDir);
    const result = await runCli({
      argv: ["init", "--repo", "demo/repo"],
      env: {},
      fetch: fakeFetch({}),
      io: {
        stdout: { write: (value: string) => output.push(value) },
        stderr: { write: () => undefined }
      }
    });

    assert.equal(result.exitCode, 0);
    assert.match(output.join(""), /Initialized Suka config/);
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { force: true, recursive: true });
  }
});

function fakeFetch(data: unknown): typeof fetch {
  return async () => jsonResponse(200, data);
}

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    headers: {
      "content-type": "application/json"
    },
    status
  });
}

function silentIo() {
  return {
    stdout: { write: () => true },
    stderr: { write: () => true }
  };
}
