import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { URL } from "node:url";
import { dashboardHtml } from "./dashboard.js";
import type { SukaLogger } from "./logger.js";
import { RealtimeHub } from "./realtime.js";
import { buildRepoMap } from "./repo-map.js";
import { createSukaService, type SukaService } from "./service.js";

const require = createRequire(import.meta.url);
const cytoscapeBundlePath = require.resolve("cytoscape/dist/cytoscape.min.js");
const lucideBundlePath = require.resolve("lucide/dist/umd/lucide.min.js");
const dashboardDistPath = resolve(process.cwd(), "apps/dashboard/dist");

export interface HttpServerOptions {
  logger?: SukaLogger;
  service?: SukaService;
}

export interface ListenOptions {
  host?: string;
  port: number;
}

export interface RunningHttpServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

export function createSukaHttpServer(options: HttpServerOptions = {}): Server {
  const service = options.service ?? createSukaService();
  const realtime = new RealtimeHub({ service });
  const logger = options.logger;

  const server = createServer(async (request, response) => {
    try {
      await routeRequest(service, realtime, request, response);
    } catch (error) {
      logger?.log("error", "request failed", {
        error_code: error instanceof HttpInputError ? error.code : "internal_error",
        error_message: error instanceof Error ? error.message : "Unexpected server error.",
        method: request.method ?? "GET",
        path: request.url ?? "/"
      });
      if (error instanceof HttpInputError) {
        writeJson(response, 400, {
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      writeJson(response, 500, {
        error: {
          code: "internal_error",
          message: error instanceof Error ? error.message : "Unexpected server error."
        }
      });
    }
  });
  realtime.attach(server);
  return server;
}

export async function listen(options: ListenOptions, server = createSukaHttpServer()): Promise<RunningHttpServer> {
  const host = options.host ?? "127.0.0.1";

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : options.port;
  const url = `http://${host}:${port}`;

  return {
    server,
    url,
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

async function routeRequest(
  service: SukaService,
  realtime: RealtimeHub,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "GET" && url.pathname === "/healthz") {
    writeJson(response, 200, {
      status: "ok"
    });
    return;
  }

  if (method === "GET" && url.pathname === "/") {
    const served = await tryServeDashboardAsset("/index.html", response);
    if (!served) {
      writeHtml(response, 200, dashboardHtml());
    }
    return;
  }

  if (method === "GET" && url.pathname === "/vendor/cytoscape.min.js") {
    const source = await readFile(cytoscapeBundlePath, "utf8");
    writeJavaScript(response, 200, source);
    return;
  }

  if (method === "GET" && url.pathname === "/vendor/lucide.min.js") {
    const source = await readFile(lucideBundlePath, "utf8");
    writeJavaScript(response, 200, source);
    return;
  }

  if (method === "GET" && url.pathname === "/api/state") {
    service.expire();
    writeJson(response, 200, {
      data: service.getState()
    });
    return;
  }

  if (method === "GET" && url.pathname === "/api/team") {
    service.expire();
    writeJson(response, 200, {
      data: service.getTeamSummary()
    });
    return;
  }

  if (method === "GET" && url.pathname === "/api/repo-map") {
    writeJson(response, 200, {
      data: await buildRepoMap()
    });
    return;
  }

  if (method === "GET" && url.pathname === "/api/decisions") {
    writeJson(response, 200, {
      data: service.getState().decisions
    });
    return;
  }

  if (method === "GET" && url.pathname === "/api/briefs") {
    writeJson(response, 200, {
      data: service.getState().briefs
    });
    return;
  }

  if (method === "POST" && url.pathname === "/api/decisions") {
    const body = await readJson(request);
    if (isRecord(body) && body.type !== undefined && body.type !== "decision") {
      writeJson(response, 400, {
        error: {
          code: "invalid_decision",
          message: "Decision endpoint only accepts decision pointers."
        }
      });
      return;
    }

    const pointer = isRecord(body) && body.type === undefined ? { ...body, type: "decision" } : body;
    const result = service.publish(pointer);
    if (!result.ok) {
      writeJson(response, 400, {
        error: {
          code: "validation_failed",
          message: "Decision validation failed.",
          issues: result.issues
        }
      });
      return;
    }

    writeJson(response, 201, {
      data: result.value
    });
    realtime.broadcast({
      data: result.value,
      type: "pointer.published"
    });
    realtime.broadcast({
      data: service.getTeamSummary(),
      type: "team.updated"
    });
    return;
  }

  if (method === "POST" && url.pathname === "/api/briefs") {
    const body = await readJson(request);
    if (isRecord(body) && body.type !== undefined && body.type !== "brief") {
      writeJson(response, 400, {
        error: {
          code: "invalid_brief",
          message: "Brief endpoint only accepts brief pointers."
        }
      });
      return;
    }

    const pointer = isRecord(body) && body.type === undefined ? { ...body, type: "brief" } : body;
    const result = service.publish(pointer);
    if (!result.ok) {
      writeJson(response, 400, {
        error: {
          code: "validation_failed",
          message: "Brief validation failed.",
          issues: result.issues
        }
      });
      return;
    }

    writeJson(response, 201, {
      data: result.value
    });
    realtime.broadcast({
      data: result.value,
      type: "pointer.published"
    });
    realtime.broadcast({
      data: service.getTeamSummary(),
      type: "team.updated"
    });
    return;
  }

  if (method === "POST" && url.pathname === "/api/pointers") {
    const body = await readJson(request);
    const result = service.publish(body);
    if (!result.ok) {
      writeJson(response, 400, {
        error: {
          code: "validation_failed",
          message: "Pointer validation failed.",
          issues: result.issues
        }
      });
      return;
    }

    writeJson(response, 201, {
      data: result.value
    });
    realtime.broadcast({
      data: result.value,
      type: "pointer.published"
    });
    realtime.broadcast({
      data: service.getTeamSummary(),
      type: "team.updated"
    });
    return;
  }

  if (method === "POST" && url.pathname === "/api/conflicts/check") {
    const body = await readJson(request);
    const warnings = service.checkConflicts(parseConflictSubject(body));
    writeJson(response, 200, {
      data: warnings
    });
    return;
  }

  if (method === "POST" && url.pathname === "/api/expire") {
    const body = await readJson(request);
    service.expire(parseNow(body));
    const state = service.getState();
    writeJson(response, 200, {
      data: state
    });
    realtime.broadcast({
      data: state,
      type: "state.expired"
    });
    realtime.broadcast({
      data: service.getTeamSummary(),
      type: "team.updated"
    });
    return;
  }

  if (method === "POST" && url.pathname === "/api/cleanup") {
    const body = await readJson(request);
    const result = service.cleanup(parseCleanupContext(body));
    writeJson(response, 200, {
      data: result
    });
    realtime.broadcast({
      data: result.state,
      type: "state.cleaned"
    });
    realtime.broadcast({
      data: service.getTeamSummary(),
      type: "team.updated"
    });
    return;
  }

  const claimMatch = /^\/api\/claims\/([^/]+)$/.exec(url.pathname);
  if (method === "DELETE" && claimMatch?.[1] !== undefined) {
    const released = service.releaseClaim(decodeURIComponent(claimMatch[1]));
    if (!released) {
      writeJson(response, 404, {
        error: {
          code: "claim_not_found",
          message: "Claim was not found."
        }
      });
      return;
    }

    writeJson(response, 200, {
      data: {
        released: true
      }
    });
    realtime.broadcast({
      data: {
        id: decodeURIComponent(claimMatch[1])
      },
      type: "claim.released"
    });
    realtime.broadcast({
      data: service.getTeamSummary(),
      type: "team.updated"
    });
    return;
  }

  if (method === "GET" && await tryServeDashboardAsset(url.pathname, response)) {
    return;
  }

  writeJson(response, 404, {
    error: {
      code: "not_found",
      message: "Route not found."
    }
  });
}

async function tryServeDashboardAsset(pathname: string, response: ServerResponse): Promise<boolean> {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = resolve(join(dashboardDistPath, relativePath));
  if (!filePath.startsWith(`${dashboardDistPath}/`) && filePath !== join(dashboardDistPath, "index.html")) {
    return false;
  }

  try {
    const source = await readFile(filePath);
    writeStatic(response, 200, source, contentTypeFor(filePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpInputError("invalid_json", "Request body must be valid JSON.");
  }
}

function parseCleanupContext(body: unknown): Parameters<SukaService["cleanup"]>[0] {
  if (!isRecord(body)) {
    throw new HttpInputError("invalid_body", "Cleanup body must be an object.");
  }

  const context: Parameters<SukaService["cleanup"]>[0] = {};
  if (typeof body.workspace_id === "string") {
    context.workspace_id = body.workspace_id;
  }
  if (typeof body.repo_id === "string") {
    context.repo_id = body.repo_id;
  }
  if (typeof body.session_id === "string") {
    context.session_id = body.session_id;
  }

  if (context.workspace_id === undefined && context.repo_id === undefined && context.session_id === undefined) {
    throw new HttpInputError(
      "invalid_body",
      "Cleanup requires at least one context field: workspace_id, repo_id, or session_id."
    );
  }

  return context;
}

function parseConflictSubject(body: unknown): Parameters<SukaService["checkConflicts"]>[0] {
  if (!isRecord(body)) {
    throw new HttpInputError("invalid_body", "Conflict check body must be an object.");
  }

  const subject: Parameters<SukaService["checkConflicts"]>[0] = {};
  if (typeof body.workspace_id === "string") {
    subject.workspace_id = body.workspace_id;
  }
  if (typeof body.repo_id === "string") {
    subject.repo_id = body.repo_id;
  }
  if (typeof body.session_id === "string") {
    subject.session_id = body.session_id;
  }
  if (typeof body.agent_id === "string") {
    subject.agent_id = body.agent_id;
  }
  if (typeof body.task === "string") {
    subject.task = body.task;
  }
  if (isStringArray(body.paths)) {
    subject.paths = body.paths;
  }
  if (isStringArray(body.apis)) {
    subject.apis = body.apis;
  }
  if (isStringArray(body.tables)) {
    subject.tables = body.tables;
  }
  if (isStringArray(body.env)) {
    subject.env = body.env;
  }
  if (isStringArray(body.domains)) {
    subject.domains = body.domains;
  }

  return subject;
}

function parseNow(body: unknown): Date {
  if (!isRecord(body) || body.now === undefined) {
    return new Date();
  }

  if (typeof body.now !== "string") {
    throw new HttpInputError("invalid_body", "now must be an ISO timestamp when provided.");
  }

  const parsed = new Date(body.now);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpInputError("invalid_body", "now must be a valid ISO timestamp.");
  }

  return parsed;
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function writeHtml(response: ServerResponse, statusCode: number, html: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function writeJavaScript(response: ServerResponse, statusCode: number, source: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/javascript; charset=utf-8",
    "cache-control": "public, max-age=31536000, immutable"
  });
  response.end(source);
}

function writeStatic(response: ServerResponse, statusCode: number, source: Buffer, contentType: string): void {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  response.end(source);
}

function contentTypeFor(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

class HttpInputError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}
