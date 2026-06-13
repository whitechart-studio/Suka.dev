import type { ParsedOptions } from "./types.js";

export function parseArgv(argv: string[]): ParsedOptions {
  const [command = "help", ...tokens] = argv;
  const args: string[] = [];
  const flags: ParsedOptions["flags"] = {};

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
      addFlag(flags, raw.slice(0, equalsIndex), raw.slice(equalsIndex + 1));
      continue;
    }

    const next = tokens[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      addFlag(flags, raw, next);
      index += 1;
      continue;
    }

    addFlag(flags, raw, true);
  }

  return {
    command,
    args,
    flags
  };
}

export function readStringFlag(flags: ParsedOptions["flags"], key: string): string | undefined {
  const value = flags[key];
  if (Array.isArray(value)) {
    return value.at(-1);
  }
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readNumberFlag(
  flags: ParsedOptions["flags"],
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

export function readCsvFlag(flags: ParsedOptions["flags"], key: string): string[] {
  const value = flags[key];
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];

  return values
    .flatMap((item) => item
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0));
}

function addFlag(flags: ParsedOptions["flags"], key: string, value: string | true): void {
  const existing = flags[key];
  if (existing === undefined) {
    flags[key] = value;
    return;
  }

  if (value === true) {
    flags[key] = value;
    return;
  }

  if (Array.isArray(existing)) {
    flags[key] = [...existing, value];
    return;
  }

  flags[key] = typeof existing === "string" ? [existing, value] : value;
}
