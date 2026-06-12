#!/usr/bin/env node
import { runCli } from "./commands.js";

const result = await runCli({
  argv: process.argv.slice(2),
  env: process.env,
  io: {
    stderr: process.stderr,
    stdout: process.stdout
  }
});

process.exitCode = result.exitCode;

