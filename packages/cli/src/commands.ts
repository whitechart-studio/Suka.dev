import { execFileSync } from "node:child_process";
import { FileSukaStore, createSukaHttpServer, createSukaService, listen } from "@suka/server";
import {
  hasAnyScope,
  type CoordinationContext,
  type DecisionConfidence,
  type DecisionStatus,
  type EventType,
  type PresenceStatus
} from "@suka/protocol";
import { initProject, loadConfig, resolveProjectPath } from "./config.js";
import { createPointerId } from "./ids.js";
import { SukaApiClient } from "./client.js";
import { formatJson, formatState, helpText } from "./format.js";
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

      case "claim": {
        const path = parsed.args[0];
        if (path === undefined) {
          throw new Error("claim requires a path argument.");
        }

        const ttlMinutes = readNumberFlag(parsed.flags, "ttl", 45);
        const pointer = {
          type: "claim",
          id: createPointerId("claim", now),
          ...coordinationContext(parsed.flags, config, context.env),
          agent_id: readStringFlag(parsed.flags, "agent") ?? defaultAgentId(context.env),
          scope: {
            paths: [path]
          },
          reason: readStringFlag(parsed.flags, "reason") ?? `Claim ${path}`,
          kind: "soft_claim",
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

      case "conflicts": {
        const result = await client.checkConflicts({
          ...coordinationContext(parsed.flags, config, context.env),
          agent_id: readStringFlag(parsed.flags, "agent") ?? defaultAgentId(context.env),
          paths: readCsvFlag(parsed.flags, "path"),
          apis: readCsvFlag(parsed.flags, "api"),
          tables: readCsvFlag(parsed.flags, "table"),
          env: readCsvFlag(parsed.flags, "env"),
          domains: readCsvFlag(parsed.flags, "domain")
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
