import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import { resolve } from "node:path";

export type DetectedAgentTool = "codex" | "claude-code";

export interface DetectedLocalAgent {
  agent_id: string;
  branch?: string;
  command: string;
  confidence: "high" | "medium";
  current_files: string[];
  cwd: string;
  detection_source: "process-cwd";
  pid: number;
  status: "detected";
  tool: DetectedAgentTool;
}

export interface LocalAgentDetectionReport {
  agents: DetectedLocalAgent[];
  branch?: string;
  changed_files: string[];
  generated_at: string;
  repo_root: string;
  warnings: string[];
}

export interface ProcessRow {
  args: string;
  command: string;
  pid: number;
}

export interface DetectLocalAgentsOptions {
  now?: Date;
  repoRoot?: string;
  branch?: string;
  changedFiles?: string[];
  processRows?: ProcessRow[];
  cwdForPid?: (pid: number) => string | undefined;
}

export function detectLocalAgents(options: DetectLocalAgentsOptions = {}): LocalAgentDetectionReport {
  const repoRoot = resolve(options.repoRoot ?? gitOutput(["rev-parse", "--show-toplevel"]) ?? process.cwd());
  const branch = options.branch ?? gitOutput(["branch", "--show-current"]);
  const changedFiles = options.changedFiles ?? detectChangedFiles();
  const warnings: string[] = [];
  const processRows = options.processRows ?? readProcessRows(warnings);
  const cwdForPid = options.cwdForPid ?? ((pid: number) => readProcessCwd(pid, warnings));

  const agents = processRows
    .map((row) => toAgentCandidate(row, repoRoot, branch, changedFiles, cwdForPid))
    .filter((agent): agent is DetectedLocalAgent => agent !== undefined)
    .sort((left, right) => left.tool.localeCompare(right.tool) || left.pid - right.pid);

  return {
    agents: dedupeAgents(agents),
    changed_files: changedFiles,
    generated_at: (options.now ?? new Date()).toISOString(),
    repo_root: repoRoot,
    warnings,
    ...(branch === undefined ? {} : { branch })
  };
}

function toAgentCandidate(
  row: ProcessRow,
  repoRoot: string,
  branch: string | undefined,
  changedFiles: string[],
  cwdForPid: (pid: number) => string | undefined
): DetectedLocalAgent | undefined {
  const tool = detectTool(row);
  if (tool === undefined) {
    return undefined;
  }

  const cwd = cwdForPid(row.pid);
  if (cwd === undefined || resolve(cwd) !== repoRoot) {
    return undefined;
  }

  return {
    agent_id: `${tool}-pid-${row.pid}`,
    command: row.command,
    confidence: "high",
    current_files: changedFiles,
    cwd,
    detection_source: "process-cwd",
    pid: row.pid,
    status: "detected",
    tool,
    ...(branch === undefined ? {} : { branch })
  };
}

function detectTool(row: ProcessRow): DetectedAgentTool | undefined {
  const raw = `${row.command} ${row.args}`.toLowerCase();
  if (raw.includes("claude-code") || raw.includes("/claude.app/") || raw.includes("/claude.app ")) {
    return "claude-code";
  }
  if (raw.includes("codex sandbox") || raw.includes("/codex.app/") || raw.includes("/resources/codex ")) {
    return "codex";
  }
  return undefined;
}

function dedupeAgents(agents: DetectedLocalAgent[]): DetectedLocalAgent[] {
  const byToolAndCwd = new Map<string, DetectedLocalAgent>();
  for (const agent of agents) {
    const key = `${agent.tool}:${agent.cwd}`;
    const current = byToolAndCwd.get(key);
    if (current === undefined || agent.pid > current.pid) {
      byToolAndCwd.set(key, agent);
    }
  }
  return [...byToolAndCwd.values()].sort((left, right) => left.tool.localeCompare(right.tool));
}

function readProcessRows(warnings: string[]): ProcessRow[] {
  if (platform() === "win32") {
    warnings.push("Local agent process detection is not implemented for Windows yet.");
    return [];
  }

  try {
    return parseProcessList(execFileSync("ps", ["-axo", "pid=,comm=,args="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }));
  } catch (error) {
    warnings.push(`Could not inspect local processes: ${error instanceof Error ? error.message : "unknown error"}.`);
    return [];
  }
}

export function parseProcessList(output: string): ProcessRow[] {
  return output
    .split("\n")
    .map((line) => line.trimStart())
    .filter((line) => line.length > 0)
    .map(parseProcessLine)
    .filter((row): row is ProcessRow => row !== undefined && Number.isInteger(row.pid));
}

function parseProcessLine(line: string): ProcessRow | undefined {
  const pidEnd = findWhitespaceIndex(line, 0);
  if (pidEnd <= 0) return undefined;

  const pidText = line.slice(0, pidEnd);
  if (!isDigits(pidText)) return undefined;

  const commandStart = findNonWhitespaceIndex(line, pidEnd);
  if (commandStart === -1) return undefined;

  const commandEnd = findWhitespaceIndex(line, commandStart);
  const command = commandEnd === -1 ? line.slice(commandStart) : line.slice(commandStart, commandEnd);
  const argsStart = commandEnd === -1 ? -1 : findNonWhitespaceIndex(line, commandEnd);

  return {
    args: argsStart === -1 ? "" : line.slice(argsStart),
    command,
    pid: Number.parseInt(pidText, 10)
  };
}

function findWhitespaceIndex(value: string, start: number): number {
  for (let index = start; index < value.length; index += 1) {
    if (isWhitespace(value.charCodeAt(index))) {
      return index;
    }
  }
  return -1;
}

function findNonWhitespaceIndex(value: string, start: number): number {
  for (let index = start; index < value.length; index += 1) {
    if (!isWhitespace(value.charCodeAt(index))) {
      return index;
    }
  }
  return -1;
}

function isDigits(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) return false;
  }
  return value.length > 0;
}

function isWhitespace(code: number): boolean {
  return code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32;
}

function readProcessCwd(pid: number, warnings: string[]): string | undefined {
  try {
    const output = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return output
      .split("\n")
      .find((line) => line.startsWith("n"))
      ?.slice(1);
  } catch {
    warnings.push(`Could not read cwd for process ${pid}.`);
    return undefined;
  }
}

function detectChangedFiles(): string[] {
  const output = gitOutput(["status", "--short"]);
  if (output === undefined) return [];
  return output
    .split("\n")
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0 && !line.includes(" -> "))
    .slice(0, 20);
}

function gitOutput(args: string[]): string | undefined {
  try {
    const output = execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
}
