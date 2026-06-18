import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { LocalProject } from "./state.js";

export interface LocalProjectInput {
  path: string;
  now?: Date;
}

export interface LocalProjectMetadata {
  branch?: string;
  name: string;
  path: string;
  repo: string;
  repo_id: string;
  repo_root: string;
  workspace_id: string;
}

export function inspectLocalProject(input: LocalProjectInput): LocalProjectMetadata {
  const projectPath = normalizeExistingDirectory(input.path);
  const repoRoot = gitOutput(projectPath, ["rev-parse", "--show-toplevel"]) ?? projectPath;
  const normalizedRepoRoot = normalizeExistingDirectory(repoRoot);
  const repo = gitRepoName(normalizedRepoRoot) ?? basename(normalizedRepoRoot);
  const branch = gitOutput(normalizedRepoRoot, ["branch", "--show-current"]);
  const repoId = slug(repo);

  return {
    name: basename(normalizedRepoRoot),
    path: normalizedRepoRoot,
    repo,
    repo_id: repoId,
    repo_root: normalizedRepoRoot,
    workspace_id: `local-${repoId}`,
    ...(branch === undefined ? {} : { branch })
  };
}

export function buildLocalProject(input: LocalProjectInput, existing?: LocalProject): LocalProject {
  const metadata = inspectLocalProject(input);
  const timestamp = (input.now ?? new Date()).toISOString();
  const id = existing?.id ?? `project_${hashId(metadata.repo_root)}`;

  return {
    id,
    ...metadata,
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp,
    last_opened_at: timestamp
  };
}

function normalizeExistingDirectory(path: string): string {
  const normalized = realpathSync(resolve(path));
  const stats = statSync(normalized);
  if (!stats.isDirectory()) {
    throw new Error(`Project path must be a directory: ${path}`);
  }
  return normalized;
}

function gitRepoName(repoRoot: string): string | undefined {
  const remote = gitOutput(repoRoot, ["config", "--get", "remote.origin.url"]);
  if (remote === undefined) {
    return undefined;
  }
  return remote
    .replace(/\.git$/u, "")
    .split(/[/:]/u)
    .filter(Boolean)
    .slice(-2)
    .join("/");
}

function gitOutput(cwd: string, args: string[]): string | undefined {
  try {
    const output = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return normalized.length > 0 ? normalized : "project";
}

function hashId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
