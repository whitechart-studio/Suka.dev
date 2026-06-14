import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  createDefaultSukaConfig,
  normalizeSukaConfig,
  type CreateDefaultSukaConfigOptions,
  type SukaConfig
} from "@suka/protocol";

export interface InitProjectOptions {
  cwd: string;
  repo?: string;
  serverUrl?: string;
  dataFile?: string;
}

export interface InitProjectResult {
  configPath: string;
  config: SukaConfig;
}

export function initProject(options: InitProjectOptions): InitProjectResult {
  const projectDir = resolve(options.cwd);
  const sukaDir = join(projectDir, ".suka");
  const configPath = join(sukaDir, "config.json");
  const defaultConfigOptions: CreateDefaultSukaConfigOptions = {
    repo: options.repo ?? basename(projectDir)
  };
  if (options.serverUrl !== undefined) {
    defaultConfigOptions.serverUrl = options.serverUrl;
  }
  if (options.dataFile !== undefined) {
    defaultConfigOptions.dataFile = options.dataFile;
  }
  const config = createDefaultSukaConfig(defaultConfigOptions);

  mkdirSync(join(sukaDir, "decisions"), { recursive: true });
  mkdirSync(join(sukaDir, "schemas"), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  writeFileSync(join(sukaDir, ".gitignore"), "session.env\nstate.json\nstate.json.tmp\n", "utf8");

  return {
    config,
    configPath
  };
}

export function findConfigPath(cwd: string): string | undefined {
  let current = resolve(cwd);

  while (true) {
    const candidate = join(current, ".suka", "config.json");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

export function loadConfig(cwd: string): SukaConfig | undefined {
  const configPath = findConfigPath(cwd);
  if (configPath === undefined) {
    return undefined;
  }

  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
  const result = normalizeSukaConfig(parsed, {
    repo: basename(dirname(dirname(configPath)))
  });
  if (!result.ok) {
    const issueList = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid Suka config: ${configPath} (${issueList})`);
  }

  return result.value;
}

export function resolveProjectPath(cwd: string, path: string): string {
  return resolve(cwd, path);
}
