import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export interface SukaConfig {
  version: 1;
  repo: string;
  server_url: string;
  data_file: string;
}

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
  const config: SukaConfig = {
    version: 1,
    repo: options.repo ?? basename(projectDir),
    server_url: options.serverUrl ?? "http://127.0.0.1:4366",
    data_file: options.dataFile ?? ".suka/state.json"
  };

  mkdirSync(join(sukaDir, "decisions"), { recursive: true });
  mkdirSync(join(sukaDir, "schemas"), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  writeFileSync(join(sukaDir, ".gitignore"), "state.json\nstate.json.tmp\n", "utf8");

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

  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<SukaConfig>;
  if (parsed.version !== 1 || typeof parsed.repo !== "string") {
    throw new Error(`Invalid Suka config: ${configPath}`);
  }

  return {
    version: 1,
    repo: parsed.repo,
    server_url: typeof parsed.server_url === "string" ? parsed.server_url : "http://127.0.0.1:4366",
    data_file: typeof parsed.data_file === "string" ? parsed.data_file : ".suka/state.json"
  };
}

export function resolveProjectPath(cwd: string, path: string): string {
  return resolve(cwd, path);
}

