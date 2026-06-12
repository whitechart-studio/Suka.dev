import { FileSukaStore, createSukaHttpServer, createSukaService, listen } from "@suka/server";
import type { EventType, PresenceStatus } from "@suka/protocol";
import { initProject, loadConfig, resolveProjectPath } from "./config.js";
import { createPointerId } from "./ids.js";
import { SukaApiClient } from "./client.js";
import { formatJson, formatState, helpText } from "./format.js";
import { parseArgv, readCsvFlag, readNumberFlag, readStringFlag } from "./parse.js";
import type { CliContext, CliResult } from "./types.js";

const DEFAULT_SERVER_URL = "http://127.0.0.1:4366";

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
          agent_id: readStringFlag(parsed.flags, "agent") ?? defaultAgentId(),
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

      case "presence": {
        const ttlSeconds = readNumberFlag(parsed.flags, "ttl", 120);
        const pointer = {
          type: "presence",
          id: createPointerId("presence", now),
          agent_id: readStringFlag(parsed.flags, "agent") ?? defaultAgentId(),
          tool: readStringFlag(parsed.flags, "tool") ?? "unknown",
          repo: readStringFlag(parsed.flags, "repo") ?? process.cwd(),
          branch: readStringFlag(parsed.flags, "branch"),
          task: readStringFlag(parsed.flags, "task"),
          status: (readStringFlag(parsed.flags, "status") ?? "online") as PresenceStatus,
          current_files: readCsvFlag(parsed.flags, "file"),
          last_seen: now.toISOString(),
          expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString()
        };
        const result = await client.publishPointer(pointer);
        context.io.stdout.write(formatJson(result));
        return { exitCode: 0 };
      }

      case "event": {
        const eventType = parsed.args[0];
        const summary = parsed.args.slice(1).join(" ");
        if (eventType === undefined || summary.length === 0) {
          throw new Error("event requires an event type and summary.");
        }

        const pointer = {
          type: "event",
          id: createPointerId("event", now),
          event_type: eventType as EventType,
          summary,
          affected_paths: readCsvFlag(parsed.flags, "path"),
          affected_apis: readCsvFlag(parsed.flags, "api"),
          affected_tables: readCsvFlag(parsed.flags, "table"),
          affected_env: readCsvFlag(parsed.flags, "env"),
          agent_id: readStringFlag(parsed.flags, "agent") ?? defaultAgentId(),
          created_at: now.toISOString()
        };
        const result = await client.publishPointer(pointer);
        context.io.stdout.write(formatJson(result));
        return { exitCode: 0 };
      }

      case "conflicts": {
        const result = await client.checkConflicts({
          agent_id: readStringFlag(parsed.flags, "agent") ?? defaultAgentId(),
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

      default:
        throw new Error(`Unknown command: ${parsed.command}`);
    }
  } catch (error) {
    context.io.stderr.write(`${error instanceof Error ? error.message : "Unexpected CLI error."}\n`);
    return { exitCode: 1 };
  }
}

async function serveCommand(
  context: CliContext,
  flags: Record<string, string | boolean>,
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

function defaultAgentId(): string {
  return process.env.SUKA_AGENT_ID ?? `agent-${process.pid}`;
}
