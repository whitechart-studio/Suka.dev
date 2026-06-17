import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { FileSukaStore, createSukaHttpServer, createSukaService, listen } from "@suka/server";
import {
  hasAnyScope,
  type CoordinationContext,
  type DecisionConfidence,
  type DecisionStatus,
  type EventType,
  type PresenceStatus
} from "@suka/protocol";
import { findConfigPath, initProject, loadConfig, resolveProjectPath } from "./config.js";
import { createPointerId } from "./ids.js";
import { detectLocalAgents, type LocalAgentDetectionReport } from "./agents.js";
import { SukaApiClient } from "./client.js";
import {
  formatDoctor,
  formatEnvExports,
  formatJson,
  formatSessionStart,
  formatSessionStatus,
  formatState,
  formatTeam,
  formatTruthReminders,
  helpText,
  type DoctorCheck,
  type DoctorReport,
  type SessionStartReport,
  type SessionStatusReport,
  type TruthReminder,
  type TruthReminderReport
} from "./format.js";
import { parseArgv, readCsvFlag, readNumberFlag, readStringFlag } from "./parse.js";
import type { CliContext, CliResult } from "./types.js";

const DEFAULT_SERVER_URL = "http://127.0.0.1:4366";
const DEFAULT_PRESENCE_TTL_SECONDS = 120;
const DEFAULT_PRESENCE_HEARTBEAT_SECONDS = 15;

export async function runCli(context: CliContext): Promise<CliResult> {
  const parsed = parseArgv(context.argv);
  const config = loadConfig(process.cwd());
  const serverUrl = readStringFlag(parsed.flags, "server") ?? context.env.SUKA_SERVER_URL ?? config?.server_url ?? DEFAULT_SERVER_URL;
  const clientOptions: ConstructorParameters<typeof SukaApiClient>[0] = {
    baseUrl: serverUrl
  };
  if (context.fetch !== undefined) {
    clientOptions.fetch = context.fetch;
  }
  const client = new SukaApiClient(clientOptions);
  const now = context.now ?? new Date();

  try {
    switch (parsed.command) {
      case "help":
      case "--help":
      case "-h":
        context.io.stdout.write(helpText());
        return { exitCode: 0 };

      case "serve":
        return await serveCommand(context, parsed.flags, config);

      case "doctor":
        return await doctorCommand(context, client, parsed.flags, config, serverUrl);

      case "session":
        return await sessionCommand(context, client, parsed.args, parsed.flags, config, serverUrl, now);

      case "init": {
        const initOptions: Parameters<typeof initProject>[0] = {
          cwd: process.cwd()
        };
        const dataFile = readStringFlag(parsed.flags, "data-file");
        const repo = readStringFlag(parsed.flags, "repo");
        const initServerUrl = readStringFlag(parsed.flags, "server");
        if (dataFile !== undefined) {
          initOptions.dataFile = dataFile;
        }
        if (repo !== undefined) {
          initOptions.repo = repo;
        }
        if (initServerUrl !== undefined) {
          initOptions.serverUrl = initServerUrl;
        }
        const result = initProject(initOptions);
        context.io.stdout.write(`Initialized Suka config at ${result.configPath}\n`);
        context.io.stdout.write(formatJson(result.config));
        return { exitCode: 0 };
      }

      case "status": {
        const state = await client.getState();
        context.io.stdout.write(parsed.flags.json === true ? formatJson(state) : formatState(state));
        return { exitCode: 0 };
      }

      case "team": {
        const team = await client.getTeam();
        context.io.stdout.write(parsed.flags.json === true ? formatJson(team) : formatTeam(team));
        return { exitCode: 0 };
      }

      case "agents":
        return agentsCommand(context, parsed.args, parsed.flags, now);

      case "remind":
        return await remindCommand(context, client, parsed.flags, config, now);

      case "claim":
      case "block": {
        const path = parsed.args[0];
        if (path === undefined) {
          throw new Error(`${parsed.command} requires a path argument.`);
        }

        const ttlMinutes = readNumberFlag(parsed.flags, "ttl", 45);
        const kind = parsed.command === "block" || parsed.flags.block === true ? "blocked_scope" : "soft_claim";
        const pointer = {
          type: "claim",
          id: createPointerId("claim", now),
          ...coordinationContext(parsed.flags, config, context.env),
          agent_id: readStringFlag(parsed.flags, "agent") ?? defaultAgentId(context.env),
          scope: {
            paths: [path]
          },
          reason: readStringFlag(parsed.flags, "reason") ?? (kind === "blocked_scope" ? `Do not touch ${path}` : `Claim ${path}`),
          kind,
          created_at: now.toISOString(),
          expires_at: new Date(now.getTime() + ttlMinutes * 60_000).toISOString()
        };
        const result = await client.publishPointer(pointer);
        context.io.stdout.write(formatJson(result));
        return { exitCode: 0 };
      }

      case "presence":
        return await presenceCommand(context, client, parsed.flags, config, now);

      case "event": {
        const eventType = parsed.args[0];
        const summary = parsed.args.slice(1).join(" ");
        if (eventType === undefined || summary.length === 0) {
          throw new Error("event requires an event type and summary.");
        }

        const pointer = {
          type: "event",
          id: createPointerId("event", now),
          ...coordinationContext(parsed.flags, config, context.env),
          event_type: eventType as EventType,
          summary,
          affected_paths: readCsvFlag(parsed.flags, "path"),
          affected_apis: readCsvFlag(parsed.flags, "api"),
          affected_tables: readCsvFlag(parsed.flags, "table"),
          affected_env: readCsvFlag(parsed.flags, "env"),
          agent_id: readStringFlag(parsed.flags, "agent") ?? defaultAgentId(context.env),
          created_at: now.toISOString()
        };
        const result = await client.publishPointer(pointer);
        context.io.stdout.write(formatJson(result));
        return { exitCode: 0 };
      }

      case "decision":
        return await decisionCommand(context, client, parsed.args, parsed.flags, config, now);

      case "decisions": {
        const result = await client.listDecisions();
        context.io.stdout.write(formatJson(result));
        return { exitCode: 0 };
      }

      case "brief":
        return await briefCommand(context, client, parsed.args, parsed.flags, config, now);

      case "conflicts": {
        const result = await client.checkConflicts({
          ...coordinationContext(parsed.flags, config, context.env),
          agent_id: readStringFlag(parsed.flags, "agent") ?? defaultAgentId(context.env),
          paths: conflictPathsFromFlags(parsed.flags),
          apis: readCsvFlag(parsed.flags, "api"),
          tables: readCsvFlag(parsed.flags, "table"),
          env: readCsvFlag(parsed.flags, "env"),
          domains: readCsvFlag(parsed.flags, "domain"),
          ...conflictSinceContext(parsed.flags, context.env)
        });
        context.io.stdout.write(formatJson(result));
        return { exitCode: 0 };
      }

      case "release": {
        const claimId = parsed.args[0];
        if (claimId === undefined) {
          throw new Error("release requires a claim id.");
        }
        const result = await client.releaseClaim(claimId);
        context.io.stdout.write(formatJson(result));
        return { exitCode: 0 };
      }

      case "cleanup": {
        const cleanupContext = {
          workspace_id: readStringFlag(parsed.flags, "workspace"),
          repo_id: readStringFlag(parsed.flags, "repo"),
          session_id: readStringFlag(parsed.flags, "session")
        };
        if (
          cleanupContext.workspace_id === undefined &&
          cleanupContext.repo_id === undefined &&
          cleanupContext.session_id === undefined
        ) {
          throw new Error("cleanup requires at least one scope flag: --workspace, --repo, or --session.");
        }
        const result = await client.cleanup(cleanupContext);
        context.io.stdout.write(formatJson(result));
        return { exitCode: 0 };
      }

      default:
        throw new Error(`Unknown command: ${parsed.command}`);
    }
  } catch (error) {
    context.io.stderr.write(`${error instanceof Error ? error.message : "Unexpected CLI error."}\n`);
    return { exitCode: 1 };
  }
}

function agentsCommand(
  context: CliContext,
  args: string[],
  flags: Parameters<typeof readStringFlag>[0],
  now: Date
): CliResult {
  const action = args[0];
  if (action !== "detect") {
    throw new Error("agents requires a supported action: detect.");
  }

  const report = detectLocalAgents({ now });
  context.io.stdout.write(flags.json === true ? formatJson(report) : formatLocalAgentDetection(report));
  return { exitCode: 0 };
}

function formatLocalAgentDetection(report: LocalAgentDetectionReport): string {
  const lines = [
    "Suka local agents",
    `repo: ${report.repo_root}`,
    `branch: ${report.branch ?? "unknown"}`,
    `changed files: ${report.changed_files.length}`
  ];

  if (report.agents.length === 0) {
    lines.push("agents: none detected");
  } else {
    lines.push(`agents: ${report.agents.length}`);
    for (const agent of report.agents) {
      lines.push(`- ${agent.agent_id} ${agent.tool} pid=${agent.pid} cwd=${agent.cwd}`);
      if (agent.current_files.length > 0) {
        lines.push(`  files: ${agent.current_files.join(", ")}`);
      }
    }
  }

  for (const warning of report.warnings) {
    lines.push(`warn: ${warning}`);
  }

  return `${lines.join("\n")}\n`;
}

async function briefCommand(
  context: CliContext,
  client: SukaApiClient,
  args: string[],
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>,
  now: Date
): Promise<CliResult> {
  const action = args[0];
  if (action === "write") {
    return await briefWriteCommand(context, client, args.slice(1), flags, config, now);
  }
  if (action === "read") {
    return await briefReadCommand(context, client, flags, config);
  }

  throw new Error("brief requires a supported action: write or read.");
}

async function remindCommand(
  context: CliContext,
  client: SukaApiClient,
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>,
  now: Date
): Promise<CliResult> {
  const changedFiles = reminderChangedFiles(flags);
  const reminders: TruthReminder[] = [];
  const scopedContext = coordinationContext(flags, config, context.env);
  const state = await client.getState();
  const briefs = readPointerArray(state, "briefs").filter((brief) => matchesContextFilter(brief, scopedContext));
  const events = readPointerArray(state, "events").filter((event) => matchesContextFilter(event, scopedContext));
  const conflictWarnings = changedFiles.length === 0
    ? []
    : await client.checkConflicts({
      ...scopedContext,
      agent_id: readStringFlag(flags, "agent") ?? defaultAgentId(context.env),
      paths: changedFiles,
      ...conflictSinceContext(flags, context.env)
    });
  const warningCount = Array.isArray(conflictWarnings) ? conflictWarnings.length : 0;

  if (context.env.SUKA_SESSION_ID === undefined) {
    reminders.push({
      action: "run `suka session start` and export the printed environment",
      level: "warn",
      paths: [],
      reason: "session context is not set, so handoffs and cleanup cannot target the current work session",
      title: "Start a coordinated session"
    });
  }

  if (changedFiles.length > 0 && !hasBriefForFiles(briefs, changedFiles)) {
    reminders.push({
      action: "run `suka brief write \"<summary>\" --changed --next \"<next action>\"`",
      level: "warn",
      paths: changedFiles,
      reason: "repo changes are not represented in a recent session brief",
      title: "Write a handoff brief"
    });
  }

  const criticalFiles = changedFiles.filter(isSharedTruthCriticalPath);
  if (criticalFiles.length > 0 && !hasEventForFiles(events, criticalFiles)) {
    reminders.push({
      action: "run `suka event updated \"<what changed>\" --path <file>` for shared contracts",
      level: "warn",
      paths: criticalFiles,
      reason: "schema, dependency, workflow, or environment-adjacent files changed without a matching event pointer",
      title: "Publish shared contract change"
    });
  }

  if (warningCount > 0) {
    reminders.push({
      action: "run `suka conflicts --changed --since-session-start` and review warnings before continuing",
      level: "warn",
      paths: changedFiles,
      reason: `${warningCount} conflict warning${warningCount === 1 ? "" : "s"} matched the changed files`,
      title: "Resolve conflict warnings"
    });
  }

  const report: TruthReminderReport = {
    changed_files: changedFiles,
    conflict_warnings: warningCount,
    generated_at: now.toISOString(),
    reminders
  };
  context.io.stdout.write(flags.json === true ? formatJson(report) : formatTruthReminders(report));
  return { exitCode: reminders.some((reminder) => reminder.level === "warn") ? 1 : 0 };
}

async function briefWriteCommand(
  context: CliContext,
  client: SukaApiClient,
  args: string[],
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>,
  now: Date
): Promise<CliResult> {
  const summary = readStringFlag(flags, "summary") ?? args.join(" ").trim();
  const nextAction = readStringFlag(flags, "next");
  if (summary.length === 0) {
    throw new Error("brief write requires a summary.");
  }
  if (nextAction === undefined) {
    throw new Error("brief write requires --next.");
  }

  const brief = {
    type: "brief",
    id: createPointerId("brief", now),
    ...coordinationContext(flags, config, context.env),
    agent_id: readStringFlag(flags, "agent") ?? defaultAgentId(context.env),
    summary,
    changed_files: changedFilesFromFlag(flags),
    decisions_made: readCsvFlag(flags, "decision"),
    assumptions: readCsvFlag(flags, "assumption"),
    skipped_work: readCsvFlag(flags, "skipped"),
    risks: readCsvFlag(flags, "risk"),
    blockers: readCsvFlag(flags, "blocker"),
    next_action: nextAction,
    related_claims: readCsvFlag(flags, "related-claim"),
    related_sessions: readCsvFlag(flags, "related-session"),
    worktree: readStringFlag(flags, "worktree"),
    created_at: now.toISOString()
  };
  const result = await client.createBrief(brief);
  context.io.stdout.write(formatJson(result));
  return { exitCode: 0 };
}

async function briefReadCommand(
  context: CliContext,
  client: SukaApiClient,
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>
): Promise<CliResult> {
  const effectiveFlags = normalizeCurrentSessionFlag(flags, context.env);
  const filter = coordinationContext(effectiveFlags, config, context.env);
  const result = await client.listBriefs();
  const briefs = Array.isArray(result) ? result.filter((brief) => matchesContextFilter(brief, filter)) : result;
  context.io.stdout.write(formatJson(briefs));
  return { exitCode: 0 };
}

async function decisionCommand(
  context: CliContext,
  client: SukaApiClient,
  args: string[],
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>,
  now: Date
): Promise<CliResult> {
  const title = args.join(" ").trim();
  const body = readStringFlag(flags, "body");
  if (title.length === 0) {
    throw new Error("decision requires a title.");
  }
  if (body === undefined) {
    throw new Error("decision requires --body.");
  }

  const status = (readStringFlag(flags, "status") ?? "accepted") as DecisionStatus;
  const evidence = readCsvFlag(flags, "evidence");
  const scope = {
    paths: readCsvFlag(flags, "path"),
    apis: readCsvFlag(flags, "api"),
    domains: readCsvFlag(flags, "domain"),
    tables: readCsvFlag(flags, "table"),
    env: readCsvFlag(flags, "env")
  };

  if (!hasAnyScope(scope)) {
    throw new Error("decision requires at least one scope flag: --path, --api, --table, --env, or --domain.");
  }
  if (status === "accepted" && evidence.length === 0) {
    throw new Error("accepted decisions require at least one --evidence reference.");
  }

  const decision = {
    type: "decision",
    id: createPointerId("decision", now),
    ...coordinationContext(flags, config, context.env),
    title,
    body,
    scope,
    status,
    confidence: (readStringFlag(flags, "confidence") ?? "high") as DecisionConfidence,
    evidence,
    created_by: readStringFlag(flags, "agent") ?? defaultAgentId(context.env),
    approved_by: readStringFlag(flags, "approved-by"),
    created_at: now.toISOString()
  };
  const result = await client.createDecision(decision);
  context.io.stdout.write(formatJson(result));
  return { exitCode: 0 };
}

function normalizeCurrentSessionFlag(
  flags: Parameters<typeof readStringFlag>[0],
  env: NodeJS.ProcessEnv
): Parameters<typeof readStringFlag>[0] {
  if (readStringFlag(flags, "session") !== "current") {
    return flags;
  }
  if (env.SUKA_SESSION_ID === undefined) {
    throw new Error("brief read --session current requires SUKA_SESSION_ID.");
  }
  return {
    ...flags,
    session: env.SUKA_SESSION_ID
  };
}

function matchesContextFilter(value: unknown, context: CoordinationContext): boolean {
  const keys = ["workspace_id", "repo_id", "session_id"] as const;
  if (!isRecord(value)) {
    return false;
  }
  return keys.every((key) => context[key] === undefined || value[key] === context[key]);
}

function changedFilesFromFlag(flags: Parameters<typeof readStringFlag>[0]): string[] {
  return flags.changed === true ? detectChangedFiles() : readCsvFlag(flags, "changed");
}

function reminderChangedFiles(flags: Parameters<typeof readStringFlag>[0]): string[] {
  const explicitPaths = readCsvFlag(flags, "path");
  if (explicitPaths.length > 0) {
    return explicitPaths;
  }
  return detectChangedFiles();
}

function conflictPathsFromFlags(flags: Parameters<typeof readStringFlag>[0]): string[] {
  if (flags.changed === true) {
    return detectChangedFiles();
  }
  return readCsvFlag(flags, "path");
}

function readPointerArray(state: unknown, key: string): Record<string, unknown>[] {
  if (!isRecord(state) || !Array.isArray(state[key])) {
    return [];
  }
  return state[key].filter(isRecord);
}

function hasBriefForFiles(briefs: Record<string, unknown>[], files: string[]): boolean {
  return briefs.some((brief) => {
    const changedFiles = readStringArrayField(brief, "changed_files");
    return files.some((file) => changedFiles.some((changedFile) => pathsOverlapForReminder(file, changedFile)));
  });
}

function hasEventForFiles(events: Record<string, unknown>[], files: string[]): boolean {
  return events.some((event) => {
    const affectedPaths = readStringArrayField(event, "affected_paths");
    return files.some((file) => affectedPaths.some((affectedPath) => pathsOverlapForReminder(file, affectedPath)));
  });
}

function readStringArrayField(value: Record<string, unknown>, key: string): string[] {
  const field = value[key];
  return Array.isArray(field) ? field.filter((item): item is string => typeof item === "string") : [];
}

function pathsOverlapForReminder(left: string, right: string): boolean {
  const normalizedLeft = normalizeReminderPath(left);
  const normalizedRight = normalizeReminderPath(right);
  return normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(`${normalizedRight}/`) ||
    normalizedRight.startsWith(`${normalizedLeft}/`);
}

function normalizeReminderPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+/g, "/").replace(/\/$/, "");
}

function isSharedTruthCriticalPath(path: string): boolean {
  const normalized = normalizeReminderPath(path).toLowerCase();
  return normalized === "package.json" ||
    normalized.endsWith("/package.json") ||
    normalized.includes("package-lock.json") ||
    normalized.includes("pnpm-lock.yaml") ||
    normalized.includes("yarn.lock") ||
    normalized.includes("schema") ||
    normalized.includes("migration") ||
    normalized.includes(".github/workflows/") ||
    normalized.includes("dockerfile") ||
    normalized.includes(".env");
}

async function sessionCommand(
  context: CliContext,
  client: SukaApiClient,
  args: string[],
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>,
  serverUrl: string,
  now: Date
): Promise<CliResult> {
  const action = args[0];
  if (action === "start") {
    return await sessionStartCommand(context, client, flags, config, serverUrl, now);
  }

  if (action === "join") {
    const sessionContext = coordinationContext(flags, config, context.env);
    if (sessionContext.workspace_id === undefined || sessionContext.repo_id === undefined || sessionContext.session_id === undefined) {
      throw new Error("session join requires workspace, repo, and session context.");
    }
    return await presenceCommand(context, client, flags, config, now);
  }

  if (action === "status") {
    return await sessionStatusCommand(context, client, flags, config);
  }

  if (action === "end") {
    return await sessionEndCommand(context, client, flags, config);
  }

  throw new Error("session requires a supported action: start, join, status, or end.");
}

async function sessionStartCommand(
  context: CliContext,
  client: SukaApiClient,
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>,
  serverUrl: string,
  now: Date
): Promise<CliResult> {
  const checks: DoctorCheck[] = [];
  await addApiCheck(checks, "state endpoint", async () => {
    await client.getState();
  });
  await addApiCheck(checks, "team endpoint", async () => {
    await client.getTeam();
  });
  const failed = checks.find((check) => check.status === "fail");
  if (failed !== undefined) {
    throw new Error(`Cannot start Suka session: ${failed.name} ${failed.message}.`);
  }

  const repo = readStringFlag(flags, "repo") ?? config?.repo ?? detectGitRepoName();
  const repoId = readStringFlag(flags, "repo-id") ?? context.env.SUKA_REPO_ID ?? config?.platform.repo_id ?? slugId(repo);
  const workspaceId = readStringFlag(flags, "workspace") ?? context.env.SUKA_WORKSPACE_ID ?? config?.platform.workspace_id ?? `local-${repoId}`;
  const sessionId = readStringFlag(flags, "session") ?? context.env.SUKA_SESSION_ID ?? createSessionId(now);
  const agentId = readStringFlag(flags, "agent") ?? defaultAgentId(context.env);
  const tool = readStringFlag(flags, "tool") ?? detectAgentTool(context.env);
  const report: SessionStartReport = {
    agent_id: agentId,
    env: {
      SUKA_AGENT_ID: agentId,
      SUKA_AGENT_TOOL: tool,
      SUKA_REPO_ID: repoId,
      SUKA_SERVER_URL: serverUrl,
      SUKA_SESSION_STARTED_AT: now.toISOString(),
      SUKA_SESSION_ID: sessionId,
      SUKA_WORKSPACE_ID: workspaceId
    },
    repo,
    server_url: serverUrl
  };

  const envFile = readStringFlag(flags, "env-file");
  if (envFile !== undefined) {
    writeSessionEnvFile(envFile, report.env);
  }

  context.io.stdout.write(flags.json === true ? formatJson(report) : formatSessionStart(report));
  return { exitCode: 0 };
}

function writeSessionEnvFile(path: string, env: Record<string, string>): void {
  const destination = resolve(process.cwd(), path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${formatEnvExports(env).join("\n")}\n`, "utf8");
}

async function sessionStatusCommand(
  context: CliContext,
  client: SukaApiClient,
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>
): Promise<CliResult> {
  const sessionContext = coordinationContext(flags, config, context.env);
  if (sessionContext.workspace_id === undefined || sessionContext.repo_id === undefined || sessionContext.session_id === undefined) {
    throw new Error("session status requires workspace, repo, and session context.");
  }

  const team = await client.getTeam() as SessionTeamSummary;
  const report: SessionStatusReport = {
    members: (team.members ?? []).filter((member) =>
      member.workspace_id === sessionContext.workspace_id &&
      member.repo_id === sessionContext.repo_id &&
      member.session_id === sessionContext.session_id
    ),
    repo_id: sessionContext.repo_id,
    session_id: sessionContext.session_id,
    workspace_id: sessionContext.workspace_id
  };

  context.io.stdout.write(flags.json === true ? formatJson(report) : formatSessionStatus(report));
  return { exitCode: 0 };
}

async function sessionEndCommand(
  context: CliContext,
  client: SukaApiClient,
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>
): Promise<CliResult> {
  const sessionContext = coordinationContext(flags, config, context.env);
  if (sessionContext.workspace_id === undefined || sessionContext.repo_id === undefined || sessionContext.session_id === undefined) {
    throw new Error("session end requires workspace, repo, and session context.");
  }

  const result = await client.cleanup(sessionContext);
  context.io.stdout.write(formatJson(result));
  return { exitCode: 0 };
}

type SessionTeamSummary = {
  members?: SessionStatusReport["members"];
};

async function doctorCommand(
  context: CliContext,
  client: SukaApiClient,
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>,
  serverUrl: string
): Promise<CliResult> {
  const checks: DoctorCheck[] = [];
  const configPath = findConfigPath(process.cwd());
  const scopedContext = coordinationContext(flags, config, context.env);

  checks.push(configPath === undefined
    ? {
        message: "run `suka init` for stable workspace and repo defaults",
        name: "project config",
        status: "warn"
      }
    : {
        message: "found .suka/config.json",
        name: "project config",
        status: "ok"
      });

  checks.push(scopedContext.workspace_id === undefined || scopedContext.repo_id === undefined
    ? {
        message: "set workspace and repo context for multi-agent team views",
        name: "team context",
        status: "warn"
      }
    : {
        message: "workspace and repo context are set",
        name: "team context",
        status: "ok"
      });

  await addApiCheck(checks, "state endpoint", async () => {
    await client.getState();
  });
  await addApiCheck(checks, "team endpoint", async () => {
    await client.getTeam();
  });

  const report: DoctorReport = {
    checks,
    context: scopedContext,
    server_url: serverUrl
  };
  if (configPath !== undefined) {
    report.config_path = configPath;
  }

  context.io.stdout.write(flags.json === true ? formatJson(report) : formatDoctor(report));
  return {
    exitCode: checks.some((check) => check.status === "fail") ? 1 : 0
  };
}

async function addApiCheck(checks: DoctorCheck[], name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    checks.push({
      message: "reachable",
      name,
      status: "ok"
    });
  } catch (error) {
    checks.push({
      message: error instanceof Error ? error.message : "request failed",
      name,
      status: "fail"
    });
  }
}

async function serveCommand(
  context: CliContext,
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>
): Promise<CliResult> {
  const host = readStringFlag(flags, "host") ?? "127.0.0.1";
  const port = readNumberFlag(flags, "port", 4366);
  const dataFile = readStringFlag(flags, "data-file") ?? context.env.SUKA_DATA_FILE ?? config?.data_file;
  const server = dataFile === undefined
    ? createSukaHttpServer()
    : createSukaHttpServer({
        service: createSukaService(new FileSukaStore(resolveProjectPath(process.cwd(), dataFile)))
      });
  const running = await listen({ host, port }, server);
  context.io.stdout.write(`Suka server listening on ${running.url}\n`);
  if (dataFile !== undefined) {
    context.io.stdout.write(`Suka data file: ${dataFile}\n`);
  }

  await new Promise<void>((resolve) => {
    const close = () => {
      void running.close().finally(resolve);
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  });

  return { exitCode: 0 };
}

async function presenceCommand(
  context: CliContext,
  client: SukaApiClient,
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>,
  initialNow: Date
): Promise<CliResult> {
  const watch = flags.watch === true;
  const intervalSeconds = readNumberFlag(flags, "interval", DEFAULT_PRESENCE_HEARTBEAT_SECONDS);
  if (intervalSeconds < 1) {
    throw new Error("--interval must be at least 1 second.");
  }
  const publish = async (timestamp: Date): Promise<unknown> => {
    const pointer = buildPresencePointer({
      config,
      env: context.env,
      flags,
      now: timestamp
    });
    return await client.publishPointer(pointer);
  };

  const firstResult = await publish(initialNow);
  context.io.stdout.write(formatJson(firstResult));

  if (!watch) {
    return { exitCode: 0 };
  }

  context.io.stdout.write(`Publishing presence every ${intervalSeconds}s. Press Ctrl+C to stop.\n`);
  while (!isAborted(context.signal)) {
    await (context.sleep ?? sleep)(intervalSeconds * 1000, context.signal);
    if (isAborted(context.signal)) {
      break;
    }
    await publish(new Date());
  }
  context.io.stdout.write("Presence watch stopped.\n");
  return { exitCode: 0 };
}

function buildPresencePointer(options: {
  config: ReturnType<typeof loadConfig>;
  env: NodeJS.ProcessEnv;
  flags: Parameters<typeof readStringFlag>[0];
  now: Date;
}): Record<string, unknown> {
  const ttlSeconds = readNumberFlag(options.flags, "ttl", DEFAULT_PRESENCE_TTL_SECONDS);
  if (ttlSeconds < 1) {
    throw new Error("--ttl must be at least 1 second.");
  }
  const explicitFiles = readCsvFlag(options.flags, "file");
  return {
    type: "presence",
    id: createPointerId("presence", options.now),
    ...coordinationContext(options.flags, options.config, options.env),
    agent_id: readStringFlag(options.flags, "agent") ?? defaultAgentId(options.env),
    tool: readStringFlag(options.flags, "tool") ?? detectAgentTool(options.env),
    repo: readStringFlag(options.flags, "repo") ?? options.config?.repo ?? detectGitRepoName(),
    branch: readStringFlag(options.flags, "branch") ?? detectGitBranch(),
    task: readStringFlag(options.flags, "task"),
    status: (readStringFlag(options.flags, "status") ?? "online") as PresenceStatus,
    current_files: explicitFiles.length > 0 ? explicitFiles : detectChangedFiles(),
    last_seen: options.now.toISOString(),
    expires_at: new Date(options.now.getTime() + ttlSeconds * 1000).toISOString()
  };
}

function coordinationContext(
  flags: Parameters<typeof readStringFlag>[0],
  config: ReturnType<typeof loadConfig>,
  env: NodeJS.ProcessEnv
): CoordinationContext {
  const context: CoordinationContext = {};
  const workspaceId = readStringFlag(flags, "workspace") ?? env.SUKA_WORKSPACE_ID ?? config?.platform.workspace_id;
  const repoId = readStringFlag(flags, "repo-id") ?? env.SUKA_REPO_ID ?? config?.platform.repo_id;
  const sessionId = readStringFlag(flags, "session") ?? env.SUKA_SESSION_ID;

  if (workspaceId !== undefined) context.workspace_id = workspaceId;
  if (repoId !== undefined) context.repo_id = repoId;
  if (sessionId !== undefined) context.session_id = sessionId;
  return context;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function conflictSinceContext(
  flags: Parameters<typeof readStringFlag>[0],
  env: NodeJS.ProcessEnv
): { since?: string } {
  const explicitSince = readStringFlag(flags, "since");
  if (explicitSince !== undefined) {
    return { since: explicitSince };
  }
  if (flags["since-session-start"] === true) {
    if (env.SUKA_SESSION_STARTED_AT === undefined) {
      throw new Error("conflicts --since-session-start requires SUKA_SESSION_STARTED_AT.");
    }
    return { since: env.SUKA_SESSION_STARTED_AT };
  }
  return {};
}

function detectAgentTool(env: NodeJS.ProcessEnv): string {
  if (env.CURSOR_TRACE_ID !== undefined || env.CURSOR_AGENT !== undefined) return "cursor";
  if (env.GITHUB_COPILOT_TOKEN !== undefined) return "github-copilot";
  if (env.CODEX_SANDBOX !== undefined || env.CODEX_ENV_PYTHON_VERSION !== undefined) return "codex";
  return env.SUKA_AGENT_TOOL ?? "terminal";
}

function detectGitBranch(): string | undefined {
  return gitOutput(["branch", "--show-current"]);
}

function detectGitRepoName(): string {
  return gitOutput(["config", "--get", "remote.origin.url"])?.replace(/\.git$/, "").split(/[/:]/).filter(Boolean).at(-1) ?? process.cwd().split(/[\\/]/).at(-1) ?? "workspace";
}

function detectChangedFiles(): string[] {
  const output = gitOutput(["status", "--short"]);
  if (output === undefined) return [];
  return output
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter((line) => line.length > 0 && !line.includes(" -> "))
    .slice(0, 20);
}

function createSessionId(now: Date): string {
  const compact = now.toISOString().replace(/\D/g, "").slice(0, 14);
  return `session-${compact}`;
}

function slugId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (isAborted(signal)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function defaultAgentId(env: NodeJS.ProcessEnv = process.env): string {
  return env.SUKA_AGENT_ID ?? `agent-${process.pid}`;
}
