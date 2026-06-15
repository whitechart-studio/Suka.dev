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
      "packages/server/src/http.ts",
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
    paths: ["packages/server/src/http.ts"],
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
      "packages/server/src/http.ts",
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
