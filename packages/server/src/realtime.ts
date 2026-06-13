import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { Pointer } from "@suka/protocol";
import type { SukaService } from "./service.js";
import type { SukaState } from "./state.js";

export type RealtimeMessage =
  | {
      data: SukaState;
      type: "state.bootstrap";
    }
  | {
      data: Pointer;
      type: "pointer.published";
    }
  | {
      data: { id: string };
      type: "claim.released";
    }
  | {
      data: SukaState;
      type: "state.expired";
    };

export interface RealtimeHubOptions {
  path?: string;
  service: SukaService;
}

export class RealtimeHub {
  readonly #path: string;
  readonly #service: SukaService;
  readonly #server = new WebSocketServer({ noServer: true });

  constructor(options: RealtimeHubOptions) {
    this.#path = options.path ?? "/api/realtime";
    this.#service = options.service;
  }

  attach(server: Server): void {
    server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname !== this.#path || !isAllowedRealtimeOrigin(request.headers.origin, request.headers.host)) {
        socket.destroy();
        return;
      }

      this.#server.handleUpgrade(request, socket, head, (client) => {
        this.#server.emit("connection", client, request);
      });
    });

    server.on("close", () => {
      this.close();
    });

    this.#server.on("connection", (client) => {
      this.#service.expire();
      send(client, {
        data: this.#service.getState(),
        type: "state.bootstrap"
      });
    });
  }

  broadcast(message: RealtimeMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.#server.clients) {
      if (client.readyState === client.OPEN) {
        try {
          client.send(payload);
        } catch {
          client.terminate();
        }
      }
    }
  }

  close(): void {
    for (const client of this.#server.clients) {
      client.close();
    }
    this.#server.close();
  }
}

export function isAllowedRealtimeOrigin(origin: string | string[] | undefined, host: string | string[] | undefined): boolean {
  if (origin === undefined) {
    return true;
  }

  if (Array.isArray(origin)) {
    return false;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const originHostname = normalizeHostname(originUrl.hostname);
  const requestHostname = hostnameFromHeader(host);

  if (requestHostname !== undefined && originHostname === requestHostname) {
    return true;
  }

  return requestHostname !== undefined && isLocalHostname(originHostname) && isLocalHostname(requestHostname);
}

function send(client: WebSocket, message: RealtimeMessage): void {
  if (client.readyState === client.OPEN) {
    try {
      client.send(JSON.stringify(message));
    } catch {
      client.terminate();
    }
  }
}

function hostnameFromHeader(host: string | string[] | undefined): string | undefined {
  if (host === undefined || Array.isArray(host)) {
    return undefined;
  }

  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? undefined : normalizeHostname(host.slice(1, end));
  }

  return normalizeHostname(host.split(":")[0] ?? "");
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0";
}
