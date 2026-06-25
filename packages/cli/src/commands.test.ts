import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

test("team prints connected workspace summary", async () => {
  const output: string[] = [];
  const result = await runCli({
    argv: ["team", "--server", "http://suka.test"],
    env: {},
    fetch: async (url, init) => {
      assert.equal(String(url), "http://suka.test/api/team");
      assert.equal(init?.method, "GET");
      return jsonResponse(200, {
        active_agents: 1,
        generated_at: "2026-06-12T10:00:00.000Z",
        members: [
          {
            agent_id: "codex-01",
            current_files: ["packages/cli/src/commands.ts"],
            last_seen: "2026-06-12T10:00:00.000Z",
            source: {
              kind: "detected",
              detector: "process-cwd"
            },
            status: "editing",
            task: "Build team CLI",
            tool: "codex",
            workspace_id: "workspace-demo"
          }
        ],
        mode: "scoped",
        workspaces: [
          {
            active_agents: 1,
            claims: 2,
            decisions: 1,
            events: 3,
            repo_ids: ["suka-dev"],
            session_ids: ["session-live"],
            workspace_id: "workspace-demo"
          }
        ]
      });
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(output.join(""), /Suka team/);
  assert.match(output.join(""), /workspace-demo/);
  assert.match(output.join(""), /codex-01 codex editing Build team CLI/);
  assert.match(output.join(""), /source: detected via process-cwd/);
  assert.match(output.join(""), /packages\/cli\/src\/commands.ts/);
});

test("team supports json output", async () => {
  const output: string[] = [];
  const result = await runCli({
    argv: ["team", "--server", "http://suka.test", "--json"],
    env: {},
    fetch: async () => jsonResponse(200, {
      active_agents: 0,
      generated_at: "2026-06-12T10:00:00.000Z",
      members: [],
      mode: "local",
      workspaces: []
    }),
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(output.join(""), /"active_agents": 0/);
});

test("agents detect exits successfully with a local report", async () => {
  const output: string[] = [];
  const result = await runCli({
    argv: ["agents", "detect", "--json"],
    env: {},
    fetch: fakeFetch({}),
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.equal(typeof JSON.parse(output.join("")).repo_root, "string");
});

test("agents detect publishes detected presence when requested", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "agents",
      "detect",
      "--publish",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-local",
      "--repo-id",
      "repo-local",
      "--session",
      "session-local",
      "--ttl",
      "60",
      "--json"
    ],
    detectLocalAgents: () => ({
      agents: [{
        agent_id: "codex-pid-101",
        branch: "RS/agents-watch",
        command: "/opt/homebrew/bin/codex",
        confidence: "high",
        current_files: ["packages/cli/src/commands.ts"],
        cwd: "/repo/suka",
        detection_source: "process-cwd",
        pid: 101,
        status: "detected",
        tool: "codex"
      }],
      branch: "RS/agents-watch",
      changed_files: ["packages/cli/src/commands.ts"],
      generated_at: "2026-06-18T06:00:00.000Z",
      repo_root: "/repo/suka",
      warnings: []
    }),
    env: {},
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    },
    now: new Date("2026-06-18T06:00:00.000Z")
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://suka.test/api/pointers");
  const body = JSON.parse(String(requests[0]?.init?.body)) as {
    agent_id: string;
    branch: string;
    current_files: string[];
    expires_at: string;
    last_seen: string;
    repo_id: string;
    session_id: string;
    source: {
      cwd: string;
      detected_at: string;
      detector: string;
      kind: string;
      pid: number;
    };
    status: string;
    task: string;
    tool: string;
    type: string;
    workspace_id: string;
  };
  assert.equal(body.type, "presence");
  assert.equal(body.agent_id, "codex-pid-101");
  assert.equal(body.tool, "codex");
  assert.deepEqual(body.source, {
    cwd: "/repo/suka",
    detected_at: "2026-06-18T06:00:00.000Z",
    detector: "process-cwd",
    kind: "detected",
    pid: 101
  });
  assert.equal(body.branch, "RS/agents-watch");
  assert.equal(body.status, "online");
  assert.equal(body.task, "Detected codex in /repo/suka");
  assert.deepEqual(body.current_files, ["packages/cli/src/commands.ts"]);
  assert.equal(body.workspace_id, "workspace-local");
  assert.equal(body.repo_id, "repo-local");
  assert.equal(body.session_id, "session-local");
  assert.equal(body.last_seen, "2026-06-18T06:00:00.000Z");
  assert.equal(body.expires_at, "2026-06-18T06:01:00.000Z");
  assert.equal(JSON.parse(output.join("")).published_presence, 1);
});

test("agents watch republishes detected presence until aborted", async () => {
  const controller = new AbortController();
  const requests: Array<{ init?: RequestInit }> = [];
  const output: string[] = [];
  const result = await runCli({
    argv: ["agents", "watch", "--server", "http://suka.test", "--interval", "15", "--ttl", "45"],
    detectLocalAgents: () => ({
      agents: [{
        agent_id: "claude-code-pid-202",
        branch: "main",
        command: "claude",
        confidence: "high",
        current_files: [],
        cwd: "/repo/suka",
        detection_source: "process-cwd",
        pid: 202,
        status: "detected",
        tool: "claude-code"
      }],
      branch: "main",
      changed_files: [],
      generated_at: "2026-06-18T06:00:00.000Z",
      repo_root: "/repo/suka",
      warnings: []
    }),
    env: {},
    fetch: async (_url, init) => {
      const request: { init?: RequestInit } = {};
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      if (requests.length === 2) {
        controller.abort();
      }
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    },
    now: new Date("2026-06-18T06:00:00.000Z"),
    signal: controller.signal,
    sleep: async () => undefined
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests.length, 2);
  assert.match(output.join(""), /Watching local agents every 15s/);
  assert.match(output.join(""), /Agent watch stopped/);
});

test("agents detect reports unavailable detector states without publishing", async () => {
  const requests: unknown[] = [];
  const output: string[] = [];
  const result = await runCli({
    argv: ["agents", "detect", "--publish", "--server", "http://suka.test"],
    detectLocalAgents: () => ({
      agents: [],
      changed_files: [],
      generated_at: "2026-06-18T06:00:00.000Z",
      repo_root: "/repo/suka",
      warnings: ["Local agent process detection is not implemented for Windows yet."]
    }),
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(201, {});
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    },
    now: new Date("2026-06-18T06:00:00.000Z")
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests.length, 0);
  assert.match(output.join(""), /none detected/);
  assert.match(output.join(""), /not implemented for Windows/);
});

test("doctor reports config warnings and reachable APIs", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-cli-doctor-"));
  const originalCwd = process.cwd();
  const output: string[] = [];
  const requests: string[] = [];
  try {
    process.chdir(tempDir);
    const result = await runCli({
      argv: ["doctor", "--server", "http://suka.test"],
      env: {},
      fetch: async (url, init) => {
        requests.push(String(url));
        assert.equal(init?.method, "GET");
        return jsonResponse(200, {});
      },
      io: {
        stdout: { write: (value: string) => output.push(value) },
        stderr: { write: () => undefined }
      }
    });

    assert.equal(result.exitCode, 0);
    assert.deepEqual(requests, ["http://suka.test/api/state", "http://suka.test/api/team"]);
    assert.match(output.join(""), /Suka doctor/);
    assert.match(output.join(""), /warn project config/);
    assert.match(output.join(""), /ok state endpoint/);
    assert.match(output.join(""), /ok team endpoint/);
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("doctor exits nonzero when APIs are unreachable", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-cli-doctor-fail-"));
  const originalCwd = process.cwd();
  const output: string[] = [];
  try {
    process.chdir(tempDir);
    const result = await runCli({
      argv: ["doctor", "--server", "http://suka.test"],
      env: {},
      fetch: async () => {
        throw new Error("connection refused");
      },
      io: {
        stdout: { write: (value: string) => output.push(value) },
        stderr: { write: () => undefined }
      }
    });

    assert.equal(result.exitCode, 1);
    assert.match(output.join(""), /fail state endpoint: connection refused/);
    assert.match(output.join(""), /fail team endpoint: connection refused/);
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("session start prints shared agent environment", async () => {
  const output: string[] = [];
  const requests: string[] = [];
  const result = await runCli({
    argv: [
      "session",
      "start",
      "--server",
      "http://suka.test",
      "--repo",
      "whitechart-studio/Suka.dev",
      "--agent",
      "codex-local",
      "--tool",
      "codex"
    ],
    env: {},
    now: new Date("2026-06-14T10:20:30.000Z"),
    fetch: async (url, init) => {
      requests.push(String(url));
      assert.equal(init?.method, "GET");
      return jsonResponse(200, {});
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(requests, ["http://suka.test/api/state", "http://suka.test/api/team"]);
  assert.match(output.join(""), /Suka session/);
  assert.match(output.join(""), /export SUKA_SERVER_URL='http:\/\/suka.test'/);
  assert.match(output.join(""), /export SUKA_WORKSPACE_ID='local-whitechart-studio-suka-dev'/);
  assert.match(output.join(""), /export SUKA_REPO_ID='whitechart-studio-suka-dev'/);
  assert.match(output.join(""), /export SUKA_SESSION_ID='session-20260614102030'/);
  assert.match(output.join(""), /export SUKA_SESSION_STARTED_AT='2026-06-14T10:20:30.000Z'/);
  assert.match(output.join(""), /export SUKA_AGENT_ID='codex-local'/);
  assert.match(output.join(""), /export SUKA_AGENT_TOOL='codex'/);
});

test("session start supports explicit context and json output", async () => {
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "session",
      "start",
      "--server",
      "http://suka.test",
      "--repo",
      "suka",
      "--workspace",
      "workspace-demo",
      "--repo-id",
      "repo-demo",
      "--session",
      "session-live",
      "--json"
    ],
    env: {
      SUKA_AGENT_ID: "claude-local",
      SUKA_AGENT_TOOL: "claude-code"
    },
    now: new Date("2026-06-14T10:20:30.000Z"),
    fetch: fakeFetch({}),
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(output.join("")) as {
    env: Record<string, string>;
  };
  assert.equal(body.env.SUKA_WORKSPACE_ID, "workspace-demo");
  assert.equal(body.env.SUKA_REPO_ID, "repo-demo");
  assert.equal(body.env.SUKA_SESSION_ID, "session-live");
  assert.equal(body.env.SUKA_SESSION_STARTED_AT, "2026-06-14T10:20:30.000Z");
  assert.equal(body.env.SUKA_AGENT_ID, "claude-local");
  assert.equal(body.env.SUKA_AGENT_TOOL, "claude-code");
});

test("session start writes env exports to a file", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-cli-session-env-"));
  const originalCwd = process.cwd();
  try {
    process.chdir(tempDir);
    const result = await runCli({
      argv: [
        "session",
        "start",
        "--server",
        "http://suka.test",
        "--repo",
        "whitechart-studio/Suka.dev",
        "--agent",
        "codex-local",
        "--tool",
        "codex",
        "--env-file",
        ".suka/session.env"
      ],
      env: {},
      now: new Date("2026-06-14T10:20:30.000Z"),
      fetch: fakeFetch({}),
      io: silentIo()
    });

    assert.equal(result.exitCode, 0);
    const envFile = readFileSync(join(tempDir, ".suka", "session.env"), "utf8");
    assert.match(envFile, /export SUKA_SERVER_URL='http:\/\/suka.test'/);
    assert.match(envFile, /export SUKA_WORKSPACE_ID='local-whitechart-studio-suka-dev'/);
    assert.match(envFile, /export SUKA_REPO_ID='whitechart-studio-suka-dev'/);
    assert.match(envFile, /export SUKA_SESSION_ID='session-20260614102030'/);
    assert.match(envFile, /export SUKA_SESSION_STARTED_AT='2026-06-14T10:20:30.000Z'/);
    assert.match(envFile, /export SUKA_AGENT_ID='codex-local'/);
    assert.match(envFile, /export SUKA_AGENT_TOOL='codex'/);
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("session start fails when server health checks fail", async () => {
  const output: string[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: ["session", "start", "--server", "http://suka.test", "--repo", "suka"],
    env: {},
    fetch: async () => {
      throw new Error("connection refused");
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.deepEqual(output, []);
  assert.match(errors.join(""), /Cannot start Suka session/);
  assert.match(errors.join(""), /connection refused/);
});

test("session join publishes scoped presence", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const result = await runCli({
    argv: [
      "session",
      "join",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-demo",
      "--repo-id",
      "repo-demo",
      "--session",
      "session-live",
      "--agent",
      "codex-local",
      "--tool",
      "codex",
      "--repo",
      "suka",
      "--status",
      "editing",
      "--task",
      "Implement session join",
      "--file",
      "packages/cli/src/commands.ts"
    ],
    env: {},
    now: new Date("2026-06-14T10:30:00.000Z"),
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
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
  const body = JSON.parse(String(requests[0]?.init?.body)) as {
    agent_id: string;
    current_files: string[];
    repo_id: string;
    session_id: string;
    status: string;
    task: string;
    tool: string;
    type: string;
    workspace_id: string;
  };
  assert.equal(body.type, "presence");
  assert.equal(body.workspace_id, "workspace-demo");
  assert.equal(body.repo_id, "repo-demo");
  assert.equal(body.session_id, "session-live");
  assert.equal(body.agent_id, "codex-local");
  assert.equal(body.tool, "codex");
  assert.equal(body.status, "editing");
  assert.equal(body.task, "Implement session join");
  assert.deepEqual(body.current_files, ["packages/cli/src/commands.ts"]);
});

test("session join requires complete session context", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: ["session", "join", "--server", "http://suka.test", "--workspace", "workspace-demo"],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(201, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests.length, 0);
  assert.match(errors.join(""), /session join requires workspace, repo, and session context/);
});

test("session status filters team members by session context", async () => {
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "session",
      "status",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-demo",
      "--repo-id",
      "repo-demo",
      "--session",
      "session-live"
    ],
    env: {},
    fetch: async (url, init) => {
      assert.equal(String(url), "http://suka.test/api/team");
      assert.equal(init?.method, "GET");
      return jsonResponse(200, {
        active_agents: 2,
        generated_at: "2026-06-14T10:35:00.000Z",
        members: [
          {
            agent_id: "codex-local",
            current_files: ["packages/cli/src/commands.ts"],
            last_seen: "2026-06-14T10:35:00.000Z",
            repo_id: "repo-demo",
            session_id: "session-live",
            status: "editing",
            task: "Build status",
            tool: "codex",
            workspace_id: "workspace-demo"
          },
          {
            agent_id: "other-agent",
            current_files: [],
            last_seen: "2026-06-14T10:35:00.000Z",
            repo_id: "repo-demo",
            session_id: "other-session",
            status: "online",
            tool: "terminal",
            workspace_id: "workspace-demo"
          }
        ],
        mode: "scoped",
        workspaces: []
      });
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(output.join(""), /Suka session status/);
  assert.match(output.join(""), /active agents: 1/);
  assert.match(output.join(""), /codex-local codex editing Build status/);
  assert.doesNotMatch(output.join(""), /other-agent/);
});

test("session status supports json output", async () => {
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "session",
      "status",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-demo",
      "--repo-id",
      "repo-demo",
      "--session",
      "session-live",
      "--json"
    ],
    env: {},
    fetch: fakeFetch({
      active_agents: 0,
      generated_at: "2026-06-14T10:35:00.000Z",
      members: [],
      mode: "scoped",
      workspaces: []
    }),
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(output.join("")) as { members: unknown[]; session_id: string };
  assert.equal(body.session_id, "session-live");
  assert.deepEqual(body.members, []);
});

test("session status requires complete session context", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: ["session", "status", "--server", "http://suka.test", "--session", "session-live"],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(200, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests.length, 0);
  assert.match(errors.join(""), /session status requires workspace, repo, and session context/);
});

test("session end cleans only the scoped session", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "session",
      "end",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-demo",
      "--repo-id",
      "repo-demo",
      "--session",
      "session-live"
    ],
    env: {},
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(200, {
        removed: {
          claims: 1,
          decisions: 0,
          events: 2,
          presence: 1
        }
      });
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/cleanup");
  assert.equal(requests[0]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
    repo_id: "repo-demo",
    session_id: "session-live",
    workspace_id: "workspace-demo"
  });
  assert.match(output.join(""), /"presence": 1/);
});

test("session end requires complete session context", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: ["session", "end", "--server", "http://suka.test", "--workspace", "workspace-demo"],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(200, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests.length, 0);
  assert.match(errors.join(""), /session end requires workspace, repo, and session context/);
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

test("block publishes a blocked scope claim pointer", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await runCli({
    argv: ["block", "src/billing/**", "--server", "http://suka.test", "--agent", "codex-01", "--reason", "Keep billing isolated"],
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
  const body = JSON.parse(String(requests[0]?.init?.body)) as { kind: string; reason: string; scope: { paths: string[] } };
  assert.equal(body.kind, "blocked_scope");
  assert.equal(body.reason, "Keep billing isolated");
  assert.deepEqual(body.scope.paths, ["src/billing/**"]);
});

test("claim supports blocked ownership boundaries", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await runCli({
    argv: ["claim", "src/api/**", "--block", "--server", "http://suka.test", "--agent", "codex-01"],
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
  const body = JSON.parse(String(requests[0]?.init?.body)) as { kind: string; reason: string };
  assert.equal(body.kind, "blocked_scope");
  assert.equal(body.reason, "Do not touch src/api/**");
});

test("presence publishes an agent heartbeat with repeated files", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await runCli({
    argv: [
      "presence",
      "--server",
      "http://suka.test",
      "--agent",
      "codex-01",
      "--tool",
      "codex",
      "--repo",
      "suka",
      "--branch",
      "main",
      "--status",
      "editing",
      "--task",
      "Build presence publishing",
      "--file",
      "packages/cli/src/commands.ts",
      "--file",
      "packages/cli/src/commands.test.ts"
    ],
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
  const body = JSON.parse(String(requests[0]?.init?.body)) as {
    agent_id: string;
    branch: string;
    current_files: string[];
    expires_at: string;
    last_seen: string;
    repo: string;
    status: string;
    task: string;
    tool: string;
    type: string;
  };
  assert.equal(body.type, "presence");
  assert.equal(body.agent_id, "codex-01");
  assert.equal(body.tool, "codex");
  assert.equal(body.repo, "suka");
  assert.equal(body.branch, "main");
  assert.equal(body.status, "editing");
  assert.equal(body.task, "Build presence publishing");
  assert.deepEqual(body.current_files, ["packages/cli/src/commands.ts", "packages/cli/src/commands.test.ts"]);
  assert.equal(body.last_seen, "2026-06-12T10:00:00.000Z");
  assert.equal(body.expires_at, "2026-06-12T10:02:00.000Z");
});

test("presence uses environment defaults for agent identity and tool", async () => {
  const requests: Array<{ init?: RequestInit }> = [];
  const result = await runCli({
    argv: ["presence", "--server", "http://suka.test", "--repo", "suka"],
    env: {
      SUKA_AGENT_ID: "cursor-01",
      SUKA_AGENT_TOOL: "cursor"
    },
    now: new Date("2026-06-12T10:00:00.000Z"),
    fetch: async (_url, init) => {
      const request: { init?: RequestInit } = {};
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(String(requests[0]?.init?.body)) as { agent_id: string; tool: string };
  assert.equal(body.agent_id, "cursor-01");
  assert.equal(body.tool, "cursor");
});

test("presence includes workspace context from config and session environment", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-cli-context-"));
  const originalCwd = process.cwd();
  const requests: Array<{ init?: RequestInit }> = [];
  try {
    process.chdir(tempDir);
    await runCli({
      argv: ["init", "--repo", "whitechart-studio/Suka.dev", "--server", "http://suka.test"],
      env: {},
      fetch: fakeFetch({}),
      io: silentIo()
    });

    const result = await runCli({
      argv: ["presence", "--server", "http://suka.test", "--agent", "codex-01", "--repo", "Suka.dev"],
      env: {
        SUKA_SESSION_ID: "session-live"
      },
      now: new Date("2026-06-12T10:00:00.000Z"),
      fetch: async (_url, init) => {
        const request: { init?: RequestInit } = {};
        if (init !== undefined) {
          request.init = init;
        }
        requests.push(request);
        return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
      },
      io: silentIo()
    });

    assert.equal(result.exitCode, 0);
    const body = JSON.parse(String(requests[0]?.init?.body)) as {
      repo_id: string;
      session_id: string;
      workspace_id: string;
    };
    assert.equal(body.workspace_id, "local-whitechart-studio-suka-dev");
    assert.equal(body.repo_id, "whitechart-studio-suka-dev");
    assert.equal(body.session_id, "session-live");
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("presence context flags override config and environment defaults", async () => {
  const requests: Array<{ init?: RequestInit }> = [];
  const result = await runCli({
    argv: [
      "presence",
      "--server",
      "http://suka.test",
      "--repo",
      "suka",
      "--workspace",
      "workspace-flag",
      "--repo-id",
      "repo-flag",
      "--session",
      "session-flag"
    ],
    env: {
      SUKA_WORKSPACE_ID: "workspace-env",
      SUKA_REPO_ID: "repo-env",
      SUKA_SESSION_ID: "session-env"
    },
    now: new Date("2026-06-12T10:00:00.000Z"),
    fetch: async (_url, init) => {
      const request: { init?: RequestInit } = {};
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(String(requests[0]?.init?.body)) as {
    repo_id: string;
    session_id: string;
    workspace_id: string;
  };
  assert.equal(body.workspace_id, "workspace-flag");
  assert.equal(body.repo_id, "repo-flag");
  assert.equal(body.session_id, "session-flag");
});

test("presence watch stops cleanly when aborted", async () => {
  const controller = new AbortController();
  const requests: Array<{ init?: RequestInit }> = [];
  const output: string[] = [];
  const result = await runCli({
    argv: ["presence", "--server", "http://suka.test", "--repo", "suka", "--watch", "--interval", "15"],
    env: {
      SUKA_AGENT_ID: "codex-watch",
      SUKA_AGENT_TOOL: "codex"
    },
    now: new Date("2026-06-12T10:00:00.000Z"),
    fetch: async (_url, init) => {
      const request: { init?: RequestInit } = {};
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      if (requests.length === 2) {
        controller.abort();
      }
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    },
    signal: controller.signal,
    sleep: async () => undefined
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests.length, 2);
  assert.match(output.join(""), /Publishing presence every 15s/);
  assert.match(output.join(""), /Presence watch stopped/);
});

test("presence rejects unsafe watch interval and ttl values", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const intervalResult = await runCli({
    argv: ["presence", "--server", "http://suka.test", "--watch", "--interval", "0"],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(201, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(intervalResult.exitCode, 1);
  assert.match(errors.join(""), /--interval must be at least 1 second/);
  assert.equal(requests.length, 0);

  errors.length = 0;
  const ttlResult = await runCli({
    argv: ["presence", "--server", "http://suka.test", "--ttl", "0"],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(201, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(ttlResult.exitCode, 1);
  assert.match(errors.join(""), /--ttl must be at least 1 second/);
  assert.equal(requests.length, 0);
});

test("decision publishes accepted decision memory", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const result = await runCli({
    argv: [
      "decision",
      "Webhook handlers must be idempotent",
      "--server",
      "http://suka.test",
      "--body",
      "Payment webhook handlers must tolerate duplicate delivery.",
      "--path",
      "src/billing/**",
      "--evidence",
      "docs/payments.md",
      "--agent",
      "codex-01",
      "--approved-by",
      "trent"
    ],
    env: {},
    now: new Date("2026-06-12T10:00:00.000Z"),
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/decisions");
  const body = JSON.parse(String(requests[0]?.init?.body)) as {
    approved_by: string;
    created_by: string;
    evidence: string[];
    scope: { paths: string[] };
    status: string;
    title: string;
    type: string;
  };
  assert.equal(body.type, "decision");
  assert.equal(body.title, "Webhook handlers must be idempotent");
  assert.equal(body.status, "accepted");
  assert.equal(body.created_by, "codex-01");
  assert.equal(body.approved_by, "trent");
  assert.deepEqual(body.scope.paths, ["src/billing/**"]);
  assert.deepEqual(body.evidence, ["docs/payments.md"]);
});

test("decision rejects accepted decision without evidence before publishing", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: [
      "decision",
      "Webhook handlers must be idempotent",
      "--server",
      "http://suka.test",
      "--body",
      "Payment webhook handlers must tolerate duplicate delivery.",
      "--path",
      "src/billing/**"
    ],
    env: {},
    now: new Date("2026-06-12T10:00:00.000Z"),
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(201, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests.length, 0);
  assert.match(errors.join(""), /accepted decisions require/);
});

test("decisions lists shared decision memory", async () => {
  const output: string[] = [];
  const result = await runCli({
    argv: ["decisions", "--server", "http://suka.test"],
    env: {},
    fetch: async (url, init) => {
      assert.equal(String(url), "http://suka.test/api/decisions");
      assert.equal(init?.method, "GET");
      return jsonResponse(200, [
        {
          type: "decision",
          id: "ptr_decision_01",
          title: "Webhook handlers must be idempotent"
        }
      ]);
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(output.join(""), /ptr_decision_01/);
});

test("brief write publishes a session handoff", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const result = await runCli({
    argv: [
      "brief",
      "write",
      "Dashboard focus handoff",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-a",
      "--repo-id",
      "repo-a",
      "--session",
      "session-a",
      "--changed",
      "apps/dashboard/src/main.tsx",
      "--decision",
      "Keep session selection local",
      "--assumption",
      "Server state remains source of truth",
      "--skipped",
      "Hosted persistence",
      "--risk",
      "Stale browser state",
      "--blocker",
      "None",
      "--next",
      "Add Current Truth panel",
      "--related-claim",
      "claim_dashboard",
      "--related-session",
      "session-a",
      "--worktree",
      "codex/dashboard-session-focus",
      "--agent",
      "codex-01"
    ],
    env: {},
    now: new Date("2026-06-12T10:00:00.000Z"),
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/briefs");
  const body = JSON.parse(String(requests[0]?.init?.body)) as {
    agent_id: string;
    assumptions: string[];
    changed_files: string[];
    decisions_made: string[];
    next_action: string;
    related_claims: string[];
    related_sessions: string[];
    risks: string[];
    skipped_work: string[];
    summary: string;
    type: string;
    worktree: string;
  };
  assert.equal(body.type, "brief");
  assert.equal(body.summary, "Dashboard focus handoff");
  assert.equal(body.agent_id, "codex-01");
  assert.equal(body.next_action, "Add Current Truth panel");
  assert.deepEqual(body.changed_files, ["apps/dashboard/src/main.tsx"]);
  assert.deepEqual(body.decisions_made, ["Keep session selection local"]);
  assert.deepEqual(body.assumptions, ["Server state remains source of truth"]);
  assert.deepEqual(body.skipped_work, ["Hosted persistence"]);
  assert.deepEqual(body.risks, ["Stale browser state"]);
  assert.deepEqual(body.related_claims, ["claim_dashboard"]);
  assert.deepEqual(body.related_sessions, ["session-a"]);
  assert.equal(body.worktree, "codex/dashboard-session-focus");
});

test("brief write requires a next action before publishing", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: ["brief", "write", "Dashboard focus handoff", "--server", "http://suka.test"],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(201, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests.length, 0);
  assert.match(errors.join(""), /brief write requires --next/);
});

test("brief read filters by current session context", async () => {
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "brief",
      "read",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-a",
      "--repo-id",
      "repo-a",
      "--session",
      "current"
    ],
    env: {
      SUKA_SESSION_ID: "session-a"
    },
    fetch: async (url, init) => {
      assert.equal(String(url), "http://suka.test/api/briefs");
      assert.equal(init?.method, "GET");
      return jsonResponse(200, [
        {
          type: "brief",
          id: "ptr_brief_session_a",
          workspace_id: "workspace-a",
          repo_id: "repo-a",
          session_id: "session-a",
          summary: "Keep this brief"
        },
        {
          type: "brief",
          id: "ptr_brief_session_b",
          workspace_id: "workspace-a",
          repo_id: "repo-a",
          session_id: "session-b",
          summary: "Filter this brief"
        }
      ]);
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(output.join(""), /ptr_brief_session_a/);
  assert.doesNotMatch(output.join(""), /ptr_brief_session_b/);
});

test("ledger task start records a prompt work unit", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const result = await runCli({
    argv: [
      "ledger",
      "task",
      "start",
      "Implement ledger CLI",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-a",
      "--repo-id",
      "repo-a",
      "--session",
      "session-a",
      "--summary",
      "Add task token event and checkpoint commands.",
      "--type",
      "implementation",
      "--issue-id",
      "171",
      "--claim-id",
      "claim_cli",
      "--checkpoint-id",
      "checkpoint_pr_179"
    ],
    env: {},
    now: new Date("2026-06-25T10:00:00.000Z"),
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/ledger/tasks");
  assert.equal(requests[0]?.init?.method, "POST");
  const body = JSON.parse(String(requests[0]?.init?.body)) as {
    intent_summary: string;
    related_checkpoint_ids: string[];
    related_claim_ids: string[];
    related_issue_ids: string[];
    repo_id: string;
    session_id: string;
    started_at: string;
    status: string;
    task_id: string;
    task_type: string;
    title: string;
    workspace_id: string;
  };
  assert.match(body.task_id, /^task_/);
  assert.equal(body.title, "Implement ledger CLI");
  assert.equal(body.intent_summary, "Add task token event and checkpoint commands.");
  assert.equal(body.task_type, "implementation");
  assert.equal(body.status, "active");
  assert.equal(body.workspace_id, "workspace-a");
  assert.equal(body.repo_id, "repo-a");
  assert.equal(body.session_id, "session-a");
  assert.equal(body.started_at, "2026-06-25T10:00:00.000Z");
  assert.deepEqual(body.related_issue_ids, ["171"]);
  assert.deepEqual(body.related_claim_ids, ["claim_cli"]);
  assert.deepEqual(body.related_checkpoint_ids, ["checkpoint_pr_179"]);
});

test("ledger task start requires summary and session context", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const missingSummary = await runCli({
    argv: ["ledger", "task", "start", "Implement ledger CLI", "--server", "http://suka.test"],
    env: {
      SUKA_REPO_ID: "repo-a",
      SUKA_SESSION_ID: "session-a"
    },
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(201, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(missingSummary.exitCode, 1);
  assert.match(errors.join(""), /ledger task start requires --summary/);
  assert.equal(requests.length, 0);

  errors.length = 0;
  const missingContext = await runCli({
    argv: [
      "ledger",
      "task",
      "start",
      "Implement ledger CLI",
      "--server",
      "http://suka.test",
      "--summary",
      "Add commands."
    ],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(201, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(missingContext.exitCode, 1);
  assert.match(errors.join(""), /ledger task start requires --repo-id and --session context/);
  assert.equal(requests.length, 0);
});

test("ledger task finish updates an existing task", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const result = await runCli({
    argv: [
      "ledger",
      "task",
      "finish",
      "task_cli_01",
      "--server",
      "http://suka.test",
      "--checkpoint-id",
      "checkpoint_pr_179"
    ],
    env: {},
    now: new Date("2026-06-25T11:00:00.000Z"),
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      if (init?.method === "GET") {
        return jsonResponse(200, [{
          intent_summary: "Add ledger commands.",
          related_checkpoint_ids: [],
          related_claim_ids: [],
          related_issue_ids: ["171"],
          repo_id: "repo-a",
          session_id: "session-a",
          started_at: "2026-06-25T10:00:00.000Z",
          status: "active",
          task_id: "task_cli_01",
          task_type: "implementation",
          title: "Implement ledger CLI",
          workspace_id: "workspace-a"
        }]);
      }
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/ledger/tasks?task_id=task_cli_01");
  assert.equal(requests[1]?.url, "http://suka.test/api/ledger/tasks");
  const body = JSON.parse(String(requests[1]?.init?.body)) as {
    completed_at: string;
    related_checkpoint_ids: string[];
    status: string;
    task_id: string;
  };
  assert.equal(body.task_id, "task_cli_01");
  assert.equal(body.status, "completed");
  assert.equal(body.completed_at, "2026-06-25T11:00:00.000Z");
  assert.deepEqual(body.related_checkpoint_ids, ["checkpoint_pr_179"]);
});

test("ledger token commands record usage and assessment", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const usageResult = await runCli({
    argv: [
      "ledger",
      "token",
      "record",
      "task_cli_01",
      "--server",
      "http://suka.test",
      "--provider",
      "openai",
      "--model",
      "gpt-5",
      "--input",
      "1200",
      "--output",
      "400",
      "--cached-input",
      "80",
      "--reasoning",
      "60",
      "--tool-call",
      "20",
      "--cost",
      "0.42",
      "--currency",
      "USD",
      "--source",
      "api"
    ],
    env: {},
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(usageResult.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/ledger/token-usage");
  const usage = JSON.parse(String(requests[0]?.init?.body)) as {
    cached_input_tokens: number;
    estimated_cost: number;
    input_tokens: number;
    measurement_source: string;
    output_tokens: number;
    provider: string;
    reasoning_tokens: number;
    task_id: string;
    tool_call_tokens: number;
    total_tokens: number;
  };
  assert.equal(usage.task_id, "task_cli_01");
  assert.equal(usage.provider, "openai");
  assert.equal(usage.input_tokens, 1200);
  assert.equal(usage.output_tokens, 400);
  assert.equal(usage.cached_input_tokens, 80);
  assert.equal(usage.reasoning_tokens, 60);
  assert.equal(usage.tool_call_tokens, 20);
  assert.equal(usage.total_tokens, 1600);
  assert.equal(usage.estimated_cost, 0.42);
  assert.equal(usage.measurement_source, "api");

  const assessmentResult = await runCli({
    argv: [
      "ledger",
      "token",
      "assess",
      "task_cli_01",
      "--server",
      "http://suka.test",
      "--category",
      "delivery",
      "--score",
      "86",
      "--by",
      "user",
      "--confidence",
      "high",
      "--reason",
      "Useful implementation output."
    ],
    env: {},
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(assessmentResult.exitCode, 0);
  assert.equal(requests[1]?.url, "http://suka.test/api/ledger/token-assessments");
  const assessment = JSON.parse(String(requests[1]?.init?.body)) as {
    confidence: string;
    reason: string;
    task_id: string;
    usefulness_score: number;
    value_category: string;
  };
  assert.equal(assessment.task_id, "task_cli_01");
  assert.equal(assessment.value_category, "delivery");
  assert.equal(assessment.usefulness_score, 86);
  assert.equal(assessment.confidence, "high");
  assert.equal(assessment.reason, "Useful implementation output.");
});

test("ledger token record validates required token counts before publishing", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: ["ledger", "token", "record", "task_cli_01", "--server", "http://suka.test", "--input", "100"],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(201, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests.length, 0);
  assert.match(errors.join(""), /--output is required/);
});

test("ledger event and checkpoint commands write reviewable evidence", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const eventResult = await runCli({
    argv: [
      "ledger",
      "event",
      "write",
      "file_changed",
      "CLI command file changed",
      "--server",
      "http://suka.test",
      "--repo-id",
      "repo-a",
      "--session",
      "session-a",
      "--task-id",
      "task_cli_01",
      "--path",
      "packages/cli/src/commands.ts",
      "--severity",
      "info"
    ],
    env: {},
    now: new Date("2026-06-25T10:30:00.000Z"),
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(eventResult.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/ledger/events");
  const event = JSON.parse(String(requests[0]?.init?.body)) as {
    affected_paths: string[];
    event_id: string;
    event_type: string;
    repo_id: string;
    session_id: string;
    severity: string;
    summary: string;
    task_id: string;
    timestamp: string;
  };
  assert.match(event.event_id, /^ledger-event_/);
  assert.equal(event.event_type, "file_changed");
  assert.equal(event.summary, "CLI command file changed");
  assert.equal(event.repo_id, "repo-a");
  assert.equal(event.session_id, "session-a");
  assert.equal(event.task_id, "task_cli_01");
  assert.equal(event.timestamp, "2026-06-25T10:30:00.000Z");
  assert.equal(event.severity, "info");
  assert.deepEqual(event.affected_paths, ["packages/cli/src/commands.ts"]);

  const checkpointResult = await runCli({
    argv: [
      "ledger",
      "checkpoint",
      "pr",
      "179",
      "Ledger CLI workflow",
      "--server",
      "http://suka.test",
      "--repo-id",
      "repo-a",
      "--session",
      "session-a",
      "--task-id",
      "task_cli_01",
      "--issue-id",
      "171",
      "--summary",
      "Adds ledger commands for developer workflows."
    ],
    env: {},
    now: new Date("2026-06-25T11:00:00.000Z"),
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(201, JSON.parse(String(init?.body)) as unknown);
    },
    io: silentIo()
  });

  assert.equal(checkpointResult.exitCode, 0);
  assert.equal(requests[1]?.url, "http://suka.test/api/ledger/checkpoints");
  const checkpoint = JSON.parse(String(requests[1]?.init?.body)) as {
    checkpoint_id: string;
    external_id: string;
    kind: string;
    related_issue_ids: string[];
    related_session_ids: string[];
    related_task_ids: string[];
    repo_id: string;
    status: string;
    summary: string;
    title: string;
  };
  assert.match(checkpoint.checkpoint_id, /^checkpoint_/);
  assert.equal(checkpoint.kind, "pr");
  assert.equal(checkpoint.external_id, "179");
  assert.equal(checkpoint.title, "Ledger CLI workflow");
  assert.equal(checkpoint.status, "open");
  assert.equal(checkpoint.repo_id, "repo-a");
  assert.deepEqual(checkpoint.related_task_ids, ["task_cli_01"]);
  assert.deepEqual(checkpoint.related_issue_ids, ["171"]);
  assert.deepEqual(checkpoint.related_session_ids, ["session-a"]);
  assert.equal(checkpoint.summary, "Adds ledger commands for developer workflows.");
});

test("ledger read commands pass structured filters to the local server", async () => {
  const requests: string[] = [];
  const result = await runCli({
    argv: [
      "ledger",
      "task",
      "read",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-a",
      "--repo-id",
      "repo-a",
      "--session",
      "session-a",
      "--task-id",
      "task_cli_01",
      "--checkpoint-id",
      "checkpoint_pr_179"
    ],
    env: {},
    fetch: async (url, init) => {
      requests.push(String(url));
      assert.equal(init?.method, "GET");
      return jsonResponse(200, []);
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  assert.equal(
    requests[0],
    "http://suka.test/api/ledger/tasks?workspace_id=workspace-a&repo_id=repo-a&session_id=session-a&task_id=task_cli_01&checkpoint_id=checkpoint_pr_179"
  );
});

test("ledger checkpoint summary reads checkpoint rollups", async () => {
  const requests: string[] = [];
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "ledger",
      "checkpoint",
      "summary",
      "--server",
      "http://suka.test",
      "--repo-id",
      "repo-a",
      "--task-id",
      "task_cli_01",
      "--checkpoint-id",
      "checkpoint_pr_179"
    ],
    env: {},
    fetch: async (url, init) => {
      requests.push(String(url));
      assert.equal(init?.method, "GET");
      return jsonResponse(200, [{
        checkpoint: {
          checkpoint_id: "checkpoint_pr_179"
        },
        related_task_ids: ["task_cli_01"],
        totals: {
          total_tokens: 1600
        }
      }]);
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.equal(
    requests[0],
    "http://suka.test/api/ledger/checkpoint-summaries?repo_id=repo-a&task_id=task_cli_01&checkpoint_id=checkpoint_pr_179"
  );
  assert.match(output.join(""), /checkpoint_pr_179/);
  assert.match(output.join(""), /1600/);
});

test("ledger token efficiency reads rollups with budget policy", async () => {
  const requests: string[] = [];
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "ledger",
      "token",
      "efficiency",
      "--server",
      "http://suka.test",
      "--repo-id",
      "repo-a",
      "--issue-id",
      "173",
      "--budget-scope",
      "session",
      "--warning-threshold",
      "1000",
      "--hard-limit",
      "1400"
    ],
    env: {},
    fetch: async (url, init) => {
      requests.push(String(url));
      assert.equal(init?.method, "GET");
      return jsonResponse(200, [{
        related_task_ids: ["task_delivery"],
        totals: {
          total_tokens: 1200,
          useful_tokens: 900
        },
        useful_token_ratio: 0.75
      }]);
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.equal(
    requests[0],
    "http://suka.test/api/ledger/token-efficiency?repo_id=repo-a&issue_id=173&budget_scope=session&warning_threshold_tokens=1000&hard_limit_tokens=1400"
  );
  assert.match(output.join(""), /task_delivery/);
  assert.match(output.join(""), /0.75/);
});

test("ledger token efficiency requires complete budget flags", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: [
      "ledger",
      "token",
      "efficiency",
      "--server",
      "http://suka.test",
      "--budget-scope",
      "session",
      "--warning-threshold",
      "1000"
    ],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(200, []);
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests.length, 0);
  assert.match(errors.join(""), /budget requires --budget-scope, --warning-threshold, and --hard-limit/);
});

test("ledger governance reads privacy defaults", async () => {
  const requests: string[] = [];
  const output: string[] = [];
  const result = await runCli({
    argv: ["ledger", "governance", "--server", "http://suka.test"],
    env: {},
    fetch: async (url, init) => {
      requests.push(String(url));
      assert.equal(init?.method, "GET");
      return jsonResponse(200, {
        privacy_defaults: {
          publish_file_paths: true,
          publish_diff_content: false,
          publish_terminal_logs: false,
          publish_prompt_text: false,
          retention_days: 7
        }
      });
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests[0], "http://suka.test/api/ledger/governance");
  assert.match(output.join(""), /publish_prompt_text/);
  assert.match(output.join(""), /false/);
});

test("remind reports missing shared-truth updates for changed files", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "remind",
      "--server",
      "http://suka.test",
      "--path",
      "package.json,apps/server/src/schema.ts",
      "--workspace",
      "workspace-a",
      "--repo-id",
      "repo-a",
      "--session",
      "session-a"
    ],
    env: {
      SUKA_SESSION_ID: "session-a"
    },
    now: new Date("2026-06-12T10:00:00.000Z"),
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      if (String(url).endsWith("/api/state")) {
        return jsonResponse(200, {
          briefs: [],
          events: []
        });
      }
      return jsonResponse(200, [{ reason: "path_overlap" }]);
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests[0]?.url, "http://suka.test/api/state");
  assert.equal(requests[1]?.url, "http://suka.test/api/conflicts/check");
  assert.match(output.join(""), /Write a handoff brief/);
  assert.match(output.join(""), /Publish shared contract change/);
  assert.match(output.join(""), /Resolve conflict warnings/);
});

test("remind passes when changed files already have shared truth", async () => {
  const output: string[] = [];
  const result = await runCli({
    argv: [
      "remind",
      "--server",
      "http://suka.test",
      "--path",
      "packages/cli/src/commands.ts",
      "--workspace",
      "workspace-a",
      "--repo-id",
      "repo-a",
      "--session",
      "session-a"
    ],
    env: {
      SUKA_SESSION_ID: "session-a"
    },
    fetch: async (url) => {
      if (String(url).endsWith("/api/state")) {
        return jsonResponse(200, {
          briefs: [{
            changed_files: ["packages/cli/src/commands.ts"],
            repo_id: "repo-a",
            session_id: "session-a",
            workspace_id: "workspace-a"
          }],
          events: []
        });
      }
      return jsonResponse(200, []);
    },
    io: {
      stdout: { write: (value: string) => output.push(value) },
      stderr: { write: () => undefined }
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(output.join(""), /shared truth looks current/);
});

test("conflicts includes workspace context from environment", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const result = await runCli({
    argv: [
      "conflicts",
      "--server",
      "http://suka.test",
      "--agent",
      "codex-01",
      "--path",
      "apps/server/src/http.ts",
      "--since-session-start"
    ],
    env: {
      SUKA_WORKSPACE_ID: "workspace-a",
      SUKA_REPO_ID: "repo-a",
      SUKA_SESSION_ID: "session-a",
      SUKA_SESSION_STARTED_AT: "2026-06-12T10:00:00.000Z"
    },
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(200, []);
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/conflicts/check");
  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
    agent_id: "codex-01",
    apis: [],
    domains: [],
    env: [],
    paths: ["apps/server/src/http.ts"],
    repo_id: "repo-a",
    session_id: "session-a",
    since: "2026-06-12T10:00:00.000Z",
    tables: [],
    workspace_id: "workspace-a"
  });
});

test("conflicts requires session start timestamp when requested", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: [
      "conflicts",
      "--server",
      "http://suka.test",
      "--path",
      "apps/server/src/http.ts",
      "--since-session-start"
    ],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(200, []);
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests.length, 0);
  assert.match(errors.join(""), /SUKA_SESSION_STARTED_AT/);
});

test("cleanup posts scoped cleanup context", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const result = await runCli({
    argv: [
      "cleanup",
      "--server",
      "http://suka.test",
      "--workspace",
      "workspace-a",
      "--repo",
      "repo-a",
      "--session",
      "session-a"
    ],
    env: {},
    fetch: async (url, init) => {
      const request: { init?: RequestInit; url: string } = { url: String(url) };
      if (init !== undefined) {
        request.init = init;
      }
      requests.push(request);
      return jsonResponse(200, {
        removed: {
          presence: 1,
          claims: 1,
          events: 0,
          decisions: 0
        }
      });
    },
    io: silentIo()
  });

  assert.equal(result.exitCode, 0);
  assert.equal(requests[0]?.url, "http://suka.test/api/cleanup");
  assert.equal(requests[0]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
    workspace_id: "workspace-a",
    repo_id: "repo-a",
    session_id: "session-a"
  });
});

test("cleanup requires at least one scope flag", async () => {
  const requests: unknown[] = [];
  const errors: string[] = [];
  const result = await runCli({
    argv: ["cleanup", "--server", "http://suka.test"],
    env: {},
    fetch: async (url, init) => {
      requests.push({ init, url });
      return jsonResponse(200, {});
    },
    io: {
      stdout: { write: () => undefined },
      stderr: { write: (value: string) => errors.push(value) }
    }
  });

  assert.equal(result.exitCode, 1);
  assert.equal(requests.length, 0);
  assert.match(errors.join(""), /cleanup requires at least one scope flag/);
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
