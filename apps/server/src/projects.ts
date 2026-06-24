import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";
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
  const repoId = slug(projectScopedRepoId(repo, normalizedRepoRoot, projectPath));

  return {
    name: basename(projectPath),
    path: projectPath,
    repo,
    repo_id: repoId,
    repo_root: normalizedRepoRoot,
    workspace_id: `local-${repoId}`,
    ...(branch === undefined ? {} : { branch })
  };
}

export function buildLocalProject(input: LocalProjectInput, existing?: LocalProject): LocalProject {
  const metadata = inspectLocalProject(input);
  return buildLocalProjectFromMetadata(metadata, input, existing);
}

export function buildLocalProjectFromMetadata(
  metadata: LocalProjectMetadata,
  input: LocalProjectInput,
  existing?: LocalProject
): LocalProject {
  const timestamp = (input.now ?? new Date()).toISOString();
  const id = existing?.id ?? `project_${hashId(metadata.path)}`;

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

function projectScopedRepoId(repo: string, repoRoot: string, projectPath: string): string {
  const relativePath = repoRelativePath(repoRoot, projectPath);
  if (relativePath === undefined) {
    return repo;
  }
  return `${repo}/${relativePath}`;
}

function repoRelativePath(repoRoot: string, projectPath: string): string | undefined {
  const relativePath = relative(repoRoot, projectPath);
  const normalizedRelativePath = toSlash(relativePath);
  if (normalizedRelativePath.length > 0 && !normalizedRelativePath.startsWith("..") && !isAbsolute(relativePath)) {
    return normalizedRelativePath;
  }

  return aliasSafeRelativePath(repoRoot, projectPath);
}

function aliasSafeRelativePath(repoRoot: string, projectPath: string): string | undefined {
  const repoSegments = pathSegments(repoRoot);
  const projectSegments = pathSegments(projectPath);

  for (let repoStart = 0; repoStart < repoSegments.length; repoStart += 1) {
    const repoSuffix = repoSegments.slice(repoStart);
    for (let projectStart = 0; projectStart <= projectSegments.length - repoSuffix.length; projectStart += 1) {
      const projectSlice = projectSegments.slice(projectStart, projectStart + repoSuffix.length);
      if (segmentsEqual(repoSuffix, projectSlice)) {
        const nestedSegments = projectSegments.slice(projectStart + repoSuffix.length);
        return nestedSegments.length > 0 ? nestedSegments.join("/") : undefined;
      }
    }
  }

  return undefined;
}

function pathSegments(path: string): string[] {
  return toSlash(path).split("/").filter(Boolean);
}

function segmentsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment.toLowerCase() === right[index]?.toLowerCase());
}

function toSlash(path: string): string {
  return path.replaceAll("\\", "/");
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return normalized.length > 0 ? normalized : "project";
}

function hashId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
