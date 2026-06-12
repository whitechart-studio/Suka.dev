import { FileSukaStore } from "./file-store.js";
import { listen } from "./http.js";
import { createSukaHttpServer } from "./http.js";
import { createSukaService } from "./service.js";

const host = process.env.SUKA_HOST ?? "127.0.0.1";
const port = parsePort(process.env.SUKA_PORT ?? "4366");
const dataFile = process.env.SUKA_DATA_FILE;

const server = dataFile === undefined
  ? createSukaHttpServer()
  : createSukaHttpServer({
      service: createSukaService(new FileSukaStore(dataFile))
    });
const running = await listen({ host, port }, server);

process.stdout.write(`Suka server listening on ${running.url}\n`);
if (dataFile !== undefined) {
  process.stdout.write(`Suka data file: ${dataFile}\n`);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void running.close().finally(() => {
      process.exit(0);
    });
  });
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("SUKA_PORT must be an integer between 0 and 65535.");
  }
  return port;
}
