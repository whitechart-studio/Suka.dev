import type { DetectLocalAgentsOptions, LocalAgentDetectionReport } from "./agents.js";

export interface CliIo {
  stdout: WritableText;
  stderr: WritableText;
}

export interface WritableText {
  write(value: string): unknown;
}

export interface CliContext {
  argv: string[];
  env: NodeJS.ProcessEnv;
  io: CliIo;
  now?: Date;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  detectLocalAgents?: (options?: DetectLocalAgentsOptions) => LocalAgentDetectionReport;
}

export interface CliResult {
  exitCode: number;
}

export interface ParsedOptions {
  command: string;
  args: string[];
  flags: Record<string, string | boolean | string[]>;
}
