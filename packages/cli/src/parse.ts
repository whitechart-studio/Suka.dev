import type { ParsedOptions } from "./types.js";

export function parseArgv(argv: string[]): ParsedOptions {
  const [command = "help", ...tokens] = argv;
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (!token.startsWith("--")) {
      args.push(token);
      continue;
    }

    const raw = token.slice(2);
    const equalsIndex = raw.indexOf("=");
    if (equalsIndex !== -1) {
      flags[raw.slice(0, equalsIndex)] = raw.slice(equalsIndex + 1);
      continue;
    }

    const next = tokens[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[raw] = next;
      index += 1;
      continue;
    }

    flags[raw] = true;
  }

  return {
    command,
    args,
    flags
  };
}

export function readStringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readNumberFlag(
  flags: Record<string, string | boolean>,
  key: string,
  fallback: number
): number {
  const value = readStringFlag(flags, key);
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`--${key} must be an integer.`);
  }

  return parsed;
}

export function readCsvFlag(flags: Record<string, string | boolean>, key: string): string[] {
  const value = readStringFlag(flags, key);
  if (value === undefined) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

