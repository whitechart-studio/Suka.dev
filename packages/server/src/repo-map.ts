import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";

export interface RepoMapDomain {
  color: string;
  directory_count: number;
  file_count: number;
  id: string;
  kind: "app" | "package" | "docs" | "tooling" | "config" | "workspace";
  keys: string[];
  name: string;
  path: string;
  x: number;
  y: number;
}

export interface RepoMapEdge {
  id: string;
  source: string;
  target: string;
}

export interface RepoMap {
  domains: RepoMapDomain[];
  edges: RepoMapEdge[];
  generated_at: string;
  root: string;
}

const ignoredNames = new Set([
  ".git",
  ".turbo",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
  "tsconfig.tsbuildinfo"
]);

const workspaceContainers = new Set(["apps", "packages", "project-skills"]);
const colors = ["#14b8a6", "#3b82f6", "#e11d48", "#f97316", "#f59e0b", "#22c55e", "#94a3b8", "#4f46e5"];

export async function buildRepoMap(root = process.cwd()): Promise<RepoMap> {
  const workspaceRoot = await findWorkspaceRoot(root);
  const candidates = await discoverDomains(workspaceRoot);
  const domains = candidates.map((candidate, index) => {
    const metrics = candidate.metrics;
    const position = positionFor(index, candidates.length);
    return {
      color: colorFor(candidate.kind, index),
      directory_count: metrics.directories,
      file_count: metrics.files,
      id: slug(candidate.path),
      kind: candidate.kind,
      keys: keysFor(candidate.path, candidate.name, candidate.kind),
      name: candidate.name,
      path: candidate.path,
      x: position.x,
      y: position.y
    };
  });

  return {
    domains,
    edges: edgesFor(domains),
    generated_at: new Date().toISOString(),
    root: basename(workspaceRoot)
  };
}

async function findWorkspaceRoot(start: string): Promise<string> {
  let current = start;
  while (true) {
    if (await hasDirectory(current, "apps") && await hasDirectory(current, "packages")) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return start;
    }
    current = parent;
  }
}

async function hasDirectory(root: string, name: string): Promise<boolean> {
  try {
    const info = await stat(join(root, name));
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function discoverDomains(root: string): Promise<Array<{
  kind: RepoMapDomain["kind"];
  metrics: { directories: number; files: number };
  name: string;
  path: string;
}>> {
  const entries = await readdir(root, { withFileTypes: true });
  const domains = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || ignoredNames.has(entry.name)) continue;

    const absolutePath = join(root, entry.name);
    if (workspaceContainers.has(entry.name)) {
      const children = await readdir(absolutePath, { withFileTypes: true });
      for (const child of children) {
        if (!child.isDirectory() || ignoredNames.has(child.name)) continue;
        const childPath = normalizeRepoPath(join(entry.name, child.name));
        domains.push({
          kind: kindFor(childPath),
          metrics: await measureDirectory(join(root, childPath), root),
          name: titleFor(child.name),
          path: childPath
        });
      }
      continue;
    }

    domains.push({
      kind: kindFor(entry.name),
      metrics: await measureDirectory(absolutePath, root),
      name: titleFor(entry.name),
      path: entry.name
    });
  }

  return domains.sort((a, b) => scoreKind(a.kind) - scoreKind(b.kind) || a.path.localeCompare(b.path));
}

async function measureDirectory(directory: string, root: string, depth = 0): Promise<{ directories: number; files: number }> {
  if (depth > 3) return { directories: 0, files: 0 };

  let directories = 0;
  let files = 0;
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoredNames.has(entry.name)) continue;
    const absolutePath = join(directory, entry.name);
    const relativePath = relative(root, absolutePath);
    if (isGeneratedPath(relativePath)) continue;

    if (entry.isDirectory()) {
      directories += 1;
      const child = await measureDirectory(absolutePath, root, depth + 1);
      directories += child.directories;
      files += child.files;
      continue;
    }

    if (entry.isFile()) {
      const info = await stat(absolutePath);
      if (info.size <= 1_000_000) files += 1;
    }
  }

  return { directories, files };
}

function edgesFor(domains: RepoMapDomain[]): RepoMapEdge[] {
  const byPath = new Map(domains.map((domain) => [domain.path, domain]));
  const edges: RepoMapEdge[] = [];

  addEdge(edges, byPath, "apps/dashboard", "packages/server");
  addEdge(edges, byPath, "apps/dashboard", "packages/protocol");
  addEdge(edges, byPath, "packages/cli", "packages/server");
  addEdge(edges, byPath, "packages/cli", "packages/protocol");
  addEdge(edges, byPath, "packages/server", "packages/protocol");
  addEdge(edges, byPath, "packages/server", "packages/conflict-engine");
  addEdge(edges, byPath, "packages/conflict-engine", "packages/protocol");
  addEdge(edges, byPath, "project-skills/suka-dashboard", "apps/dashboard");
  addEdge(edges, byPath, "project-skills/suka-backend", "packages/server");
  addEdge(edges, byPath, "project-skills/suka-architecture", "packages/protocol");
  addEdge(edges, byPath, "docs", "project-skills/suka-architecture");
  addEdge(edges, byPath, "scripts", "packages/cli");

  return Array.from(new Map(edges.map((item) => [item.id, item])).values());
}

function addEdge(edges: RepoMapEdge[], byPath: Map<string, RepoMapDomain>, sourcePath: string, targetPath: string): void {
  const source = byPath.get(sourcePath);
  const target = byPath.get(targetPath);
  if (!source || !target) return;
  edges.push(edge(source.id, target.id));
}

function edge(source: string, target: string): RepoMapEdge {
  return {
    id: `${source}:${target}`,
    source,
    target
  };
}

function kindFor(path: string): RepoMapDomain["kind"] {
  if (path.startsWith("apps/")) return "app";
  if (path.startsWith("packages/")) return "package";
  if (path === "docs" || path.endsWith("-docs")) return "docs";
  if (path === ".agents" || path === "scripts" || path === "project-skills" || path.startsWith("project-skills/")) return "tooling";
  if (path.startsWith(".")) return "config";
  return "workspace";
}

function scoreKind(kind: RepoMapDomain["kind"]): number {
  return ["app", "package", "docs", "tooling", "workspace", "config"].indexOf(kind);
}

function keysFor(path: string, name: string, kind: RepoMapDomain["kind"]): string[] {
  return Array.from(new Set([
    ...path.split(/[/-]/),
    ...path.split("/"),
    ...name.toLowerCase().split(/\s+/),
    kind
  ].filter(Boolean).map((value) => value.toLowerCase())));
}

function positionFor(index: number, total: number): { x: number; y: number } {
  const columns = Math.max(3, Math.ceil(Math.sqrt(total)));
  const row = Math.floor(index / columns);
  const column = index % columns;
  return {
    x: 110 + column * 240 + (row % 2) * 42,
    y: 90 + row * 155
  };
}

function colorFor(kind: RepoMapDomain["kind"], index: number): string {
  const kindColor: Partial<Record<RepoMapDomain["kind"], string>> = {
    app: "#14b8a6",
    docs: "#4f46e5",
    package: "#3b82f6",
    tooling: "#f59e0b"
  };
  return kindColor[kind] ?? colors[index % colors.length]!;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "root";
}

function titleFor(value: string): string {
  return value
    .replace(/^@suka\//, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function isGeneratedPath(path: string): boolean {
  return path.split(/[\\/]/).some((part) => ignoredNames.has(part));
}

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/");
}
