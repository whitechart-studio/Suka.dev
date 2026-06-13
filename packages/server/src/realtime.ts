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
      if (url.pathname !== this.#path) {
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
        client.send(payload);
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

function send(client: WebSocket, message: RealtimeMessage): void {
  if (client.readyState === client.OPEN) {
    client.send(JSON.stringify(message));
  }
}
