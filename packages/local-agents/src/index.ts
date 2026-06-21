import { execFileSync } from "node:child_process";
import { readlinkSync } from "node:fs";
import { platform } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";

export type DetectedAgentTool = "codex" | "claude-code";
export type DetectionSource = "process-cwd" | "args-cwd";

export interface DetectedLocalAgent {
  agent_id: string;
  branch?: string;
  command: string;
  confidence: "high" | "medium";
  current_files: string[];
  cwd: string;
  detection_source: DetectionSource;
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
  cwd?: string;
  pid: number;
}

export interface DetectLocalAgentsOptions {
  now?: Date;
  platform?: NodeJS.Platform;
  repoRoot?: string;
  branch?: string;
  changedFiles?: string[];
  processRows?: ProcessRow[];
  cwdForPid?: (pid: number) => string | undefined;
}

interface ProcessDiscoveryAdapter {
  name: string;
  readProcessRows: (warnings: string[]) => ProcessRow[];
}

export function detectLocalAgents(options: DetectLocalAgentsOptions = {}): LocalAgentDetectionReport {
  const repoRoot = resolve(options.repoRoot ?? gitOutput(["rev-parse", "--show-toplevel"]) ?? process.cwd());
  const branch = options.branch ?? gitOutput(["branch", "--show-current"], repoRoot);
  const changedFiles = options.changedFiles ?? detectChangedFiles(repoRoot);
  const warnings: string[] = [];
  const processRows = options.processRows ?? readProcessRows(warnings, options.platform ?? platform());
  const cwdForPid = options.cwdForPid ?? ((pid: number) => readProcessCwd(pid, warnings, options.platform ?? platform()));

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

  const processCwd = row.cwd ?? cwdForPid(row.pid);
  const argsCwd = processCwd === undefined ? inferCwdFromArgs(row.args) : undefined;
  const cwd = processCwd ?? argsCwd;
  if (cwd === undefined || !isInsidePath(repoRoot, cwd)) {
    return undefined;
  }

  return {
    agent_id: `${tool}-pid-${row.pid}`,
    command: row.command,
    confidence: processCwd === undefined ? "medium" : "high",
    current_files: changedFiles,
    cwd,
    detection_source: processCwd === undefined ? "args-cwd" : "process-cwd",
    pid: row.pid,
    status: "detected",
    tool,
    ...(branch === undefined ? {} : { branch })
  };
}

function detectTool(row: ProcessRow): DetectedAgentTool | undefined {
  const raw = `${row.command} ${row.args}`.toLowerCase();
  const commandBase = pathBaseName(row.command);
  if (
    commandBase === "claude-code" ||
    commandBase === "claude-code.exe" ||
    raw.includes("claude-code") ||
    raw.includes("/claude.app/") ||
    raw.includes("/claude.app ")
  ) {
    return "claude-code";
  }
  if (
    commandBase === "codex" ||
    commandBase === "codex.exe" ||
    raw.startsWith("codex ") ||
    raw.includes(" codex ") ||
    raw.includes("codex sandbox") ||
    raw.includes("/codex.app/") ||
    raw.includes("/resources/codex ")
  ) {
    return "codex";
  }
  return undefined;
}

function pathBaseName(value: string): string {
  const normalized = value.toLowerCase().replaceAll("\\", "/");
  return normalized.split("/").at(-1) ?? normalized;
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

function readProcessRows(warnings: string[], currentPlatform: NodeJS.Platform): ProcessRow[] {
  return adapterForPlatform(currentPlatform).readProcessRows(warnings);
}

function adapterForPlatform(currentPlatform: NodeJS.Platform): ProcessDiscoveryAdapter {
  if (currentPlatform === "win32") {
    return windowsAdapter;
  }
  if (currentPlatform === "linux") {
    return linuxAdapter;
  }
  if (currentPlatform === "darwin") {
    return macosAdapter;
  }
  return {
    name: currentPlatform,
    readProcessRows: (warnings) => {
      warnings.push(`Local agent process detection is not implemented for ${currentPlatform}.`);
      return [];
    }
  };
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

export function parseWindowsProcessList(output: string): ProcessRow[] {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const parsed = JSON.parse(trimmed) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows
    .map(parseWindowsProcess)
    .filter((row): row is ProcessRow => row !== undefined);
}

function parseWindowsProcess(value: unknown): ProcessRow | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const pid = Number(record.ProcessId ?? record.processId ?? record.pid);
  if (!Number.isInteger(pid)) {
    return undefined;
  }
  const commandLine = stringValue(record.CommandLine ?? record.commandLine) ?? "";
  const executablePath = stringValue(record.ExecutablePath ?? record.executablePath);
  const command = executablePath ?? firstCommandToken(commandLine);
  if (command === undefined) {
    return undefined;
  }
  return {
    args: commandLine,
    command,
    pid
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function firstCommandToken(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.startsWith("\"")) {
    const end = trimmed.indexOf("\"", 1);
    return end === -1 ? trimmed.slice(1) : trimmed.slice(1, end);
  }
  const end = findWhitespaceIndex(trimmed, 0);
  return end === -1 ? trimmed : trimmed.slice(0, end);
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

function readProcessCwd(pid: number, warnings: string[], currentPlatform: NodeJS.Platform): string | undefined {
  if (currentPlatform === "linux") {
    try {
      return readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      warnings.push(`Could not read cwd for process ${pid}; continuing with command-line cwd fallback.`);
      return undefined;
    }
  }
  if (currentPlatform === "win32") {
    warnings.push(`Windows does not expose cwd for process ${pid} without elevated inspection; continuing with command-line cwd fallback.`);
    return undefined;
  }
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
    warnings.push(`Could not read cwd for process ${pid}; continuing with command-line cwd fallback.`);
    return undefined;
  }
}

function inferCwdFromArgs(args: string): string | undefined {
  const patterns = [
    /(?:^|\s)--working-dir(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/u,
    /(?:^|\s)--cwd(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/u,
    /(?:^|\s)-C(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/u
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(args);
    const value = match?.[1] ?? match?.[2] ?? match?.[3];
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

const macosAdapter: ProcessDiscoveryAdapter = {
  name: "darwin",
  readProcessRows: (warnings) => readPsProcessRows(warnings)
};

const linuxAdapter: ProcessDiscoveryAdapter = {
  name: "linux",
  readProcessRows: (warnings) => readPsProcessRows(warnings)
};

const windowsAdapter: ProcessDiscoveryAdapter = {
  name: "win32",
  readProcessRows: (warnings) => {
    try {
      const output = execFileSync("powershell.exe", [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress"
      ], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      return parseWindowsProcessList(output);
    } catch (error) {
      warnings.push(`Could not inspect Windows processes: ${error instanceof Error ? error.message : "unknown error"}.`);
      return [];
    }
  }
};

function readPsProcessRows(warnings: string[]): ProcessRow[] {
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

function detectChangedFiles(repoRoot: string): string[] {
  const output = gitOutput(["status", "--short"], repoRoot);
  if (output === undefined) return [];
  return output
    .split("\n")
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0 && !line.includes(" -> ") && isPublicProjectPath(line))
    .slice(0, 20);
}

function isInsidePath(parent: string, child: string): boolean {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath.length === 0 || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function isPublicProjectPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === ".claude" || segment === ".agents" || segment === "node_modules")) {
    return false;
  }
  if (normalized === ".env" || normalized.startsWith(".env.")) {
    return false;
  }
  return !normalized.startsWith(".agent/skills/");
}

function gitOutput(args: string[], cwd?: string): string | undefined {
  try {
    const output = execFileSync("git", args, {
      ...(cwd === undefined ? {} : { cwd }),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
}
