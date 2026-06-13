#!/usr/bin/env node
import { runCli } from "./commands.js";

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => controller.abort());
}

const result = await runCli({
  argv: process.argv.slice(2),
  env: process.env,
  io: {
    stderr: process.stderr,
    stdout: process.stdout
  },
  signal: controller.signal
});

process.exitCode = result.exitCode;
