import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { detectLocalAgents, parseProcessList, parseWindowsProcessList, type ProcessRow } from "./index.js";

const repoRoot = resolve("fixtures", "suka repo");

test("parseProcessList extracts pid command and args", () => {
  const rows = parseProcessList(`
    84943 node /Volumes/Codex Installer/Codex.app/Contents/Resources/node --working-dir ${repoRoot}
    83019 claude /Users/getitrent/Library/Application Support/Claude/claude-code/2.1.170/claude.app/Contents/MacOS/claude --model claude-sonnet
  `);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    args: `/Volumes/Codex Installer/Codex.app/Contents/Resources/node --working-dir ${repoRoot}`,
    command: "node",
    pid: 84943
  });
  assert.equal(rows[1]?.pid, 83019);
  assert.equal(rows[1]?.command, "claude");
});

test("parseProcessList handles Linux ps samples", () => {
  const rows = parseProcessList(`
      1021 /usr/bin/codex codex --working-dir ${repoRoot} sandbox
      2048 /usr/bin/node node /opt/claude-code/claude --cwd ${repoRoot}
  `);

  assert.deepEqual(rows.map((row) => row.pid), [1021, 2048]);
  assert.equal(rows[0]?.command, "/usr/bin/codex");
  assert.equal(rows[1]?.args, `node /opt/claude-code/claude --cwd ${repoRoot}`);
});

test("parseWindowsProcessList handles PowerShell JSON samples", () => {
  const rows = parseWindowsProcessList(JSON.stringify([{
    CommandLine: `"C:\\Program Files\\Codex\\codex.exe" --working-dir "${repoRoot}"`,
    ExecutablePath: "C:\\Program Files\\Codex\\codex.exe",
    ProcessId: 3200
  }, {
    CommandLine: "claude-code --cwd C:\\work\\other",
    ExecutablePath: null,
    ProcessId: 3300
  }]));

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    args: `"C:\\Program Files\\Codex\\codex.exe" --working-dir "${repoRoot}"`,
    command: "C:\\Program Files\\Codex\\codex.exe",
    pid: 3200
  });
  assert.equal(rows[1]?.command, "claude-code");
});

test("detectLocalAgents returns Codex and Claude processes in the current repo", () => {
  const processRows: ProcessRow[] = [
    {
      args: `--working-dir ${repoRoot}`,
      command: "/opt/homebrew/bin/codex",
      pid: 84942
    },
    {
      args: "/Users/getitrent/Library/Application Support/Claude/claude-code/2.1.170/claude.app/Contents/MacOS/claude --model claude-sonnet",
      command: "claude",
      pid: 83019
    },
    {
      args: "/Applications/Visual Studio Code.app/Contents/MacOS/Electron",
      command: "Code",
      pid: 96330
    }
  ];

  const report = detectLocalAgents({
    branch: "RS/local-agent-detect",
    changedFiles: ["packages/cli/src/agents.ts"],
    cwdForPid: (pid) => pid === 96330 ? "/tmp/other" : repoRoot,
    now: new Date("2026-06-17T05:00:00.000Z"),
    processRows,
    repoRoot
  });

  assert.equal(report.repo_root, repoRoot);
  assert.equal(report.branch, "RS/local-agent-detect");
  assert.deepEqual(report.changed_files, ["packages/cli/src/agents.ts"]);
  assert.deepEqual(report.agents.map((agent) => agent.tool), ["claude-code", "codex"]);
  assert.deepEqual(report.agents.map((agent) => agent.agent_id), ["claude-code-pid-83019", "codex-pid-84942"]);
  assert.equal(report.agents[0]?.detection_source, "process-cwd");
});

test("detectLocalAgents ignores matching tools outside the current repo", () => {
  const report = detectLocalAgents({
    cwdForPid: () => resolve("fixtures", "other repo"),
    processRows: [{
      args: `/Volumes/Codex Installer/Codex.app/Contents/Resources/codex sandbox --working-dir ${repoRoot}`,
      command: "codex",
      pid: 84942
    }],
    repoRoot
  });

  assert.deepEqual(report.agents, []);
});

test("detectLocalAgents falls back to command-line cwd when platform cwd is unavailable", () => {
  const report = detectLocalAgents({
    branch: "main",
    changedFiles: [],
    cwdForPid: () => undefined,
    platform: "win32",
    processRows: [{
      args: `"C:\\Program Files\\Codex\\codex.exe" --working-dir "${repoRoot}"`,
      command: "C:\\Program Files\\Codex\\codex.exe",
      pid: 3200
    }],
    repoRoot
  });

  assert.equal(report.agents.length, 1);
  assert.equal(report.agents[0]?.tool, "codex");
  assert.equal(report.agents[0]?.cwd, repoRoot);
});

test("detectLocalAgents reports unsupported platform states without throwing", () => {
  const report = detectLocalAgents({
    platform: "freebsd",
    repoRoot
  });

  assert.deepEqual(report.agents, []);
  assert.match(report.warnings.join("\n"), /not implemented for freebsd/);
});
