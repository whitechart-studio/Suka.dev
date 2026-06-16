import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

export interface RepoMapDomain {
  color: string;
  directory_count: number;
  file_count: number;
  id: string;
  kind: "app" | "package" | "docs" | "tooling" | "config" | "workspace";
  keys: string[];
  name: string;
  package_name?: string;
  path: string;
  route_count: number;
  routes: string[];
  test_count: number;
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
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);

type DomainCandidate = {
  kind: RepoMapDomain["kind"];
  metrics: { directories: number; files: number };
  name: string;
  path: string;
};

export async function buildRepoMap(root = process.cwd()): Promise<RepoMap> {
  const workspaceRoot = await findWorkspaceRoot(root);
  const candidates = await discoverDomains(workspaceRoot);
  const domains = await Promise.all(candidates.map(async (candidate, index) => {
    const metrics = candidate.metrics;
    const metadata = await metadataFor(workspaceRoot, candidate.path);
    const position = positionFor(index, candidates.length);
    const domain: RepoMapDomain = {
      color: colorFor(candidate.kind, index),
      directory_count: metrics.directories,
      file_count: metrics.files,
      id: slug(candidate.path),
      kind: candidate.kind,
      keys: keysFor(candidate.path, candidate.name, candidate.kind),
      name: candidate.name,
      path: candidate.path,
      route_count: metadata.routes.length,
      routes: metadata.routes,
      test_count: metadata.testCount,
      x: position.x,
      y: position.y
    };
    if (metadata.packageName !== undefined) {
      domain.package_name = metadata.packageName;
    }
    return domain;
  }));

  return {
    domains,
    edges: await edgesFor(workspaceRoot, domains),
    generated_at: new Date().toISOString(),
    root: basename(workspaceRoot)
  };
}

async function metadataFor(root: string, domainPath: string): Promise<{
  packageName?: string;
  routes: string[];
  testCount: number;
}> {
  const manifest = await readJsonFile(join(root, domainPath, "package.json"));
  const packageName = isRecord(manifest) && typeof manifest.name === "string" ? manifest.name : undefined;
  const files = await sourceFiles(join(root, domainPath));
  const routes = new Set<string>();
  let testCount = 0;

  for (const file of files) {
    if (isTestFile(file)) {
      testCount += 1;
      continue;
    }
    const text = await readTextFile(file);
    if (text === undefined) continue;
    for (const route of routeSpecifiers(text)) {
      routes.add(route);
    }
  }

  return {
    ...(packageName !== undefined ? { packageName } : {}),
    routes: [...routes].sort(),
    testCount
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

async function discoverDomains(root: string): Promise<DomainCandidate[]> {
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

async function edgesFor(root: string, domains: RepoMapDomain[]): Promise<RepoMapEdge[]> {
  const byPath = new Map(domains.map((domain) => [domain.path, domain]));
  const edges: RepoMapEdge[] = [];

  edges.push(...await inferredEdgesFor(root, domains));

  addEdge(edges, byPath, "apps/dashboard", "apps/server");
  addEdge(edges, byPath, "apps/dashboard", "packages/protocol");
  addEdge(edges, byPath, "packages/cli", "apps/server");
  addEdge(edges, byPath, "packages/cli", "packages/protocol");
  addEdge(edges, byPath, "apps/server", "packages/protocol");
  addEdge(edges, byPath, "apps/server", "packages/conflict-engine");
  addEdge(edges, byPath, "packages/conflict-engine", "packages/protocol");
  addEdge(edges, byPath, "project-skills/suka-dashboard", "apps/dashboard");
  addEdge(edges, byPath, "project-skills/suka-backend", "apps/server");
  addEdge(edges, byPath, "project-skills/suka-architecture", "packages/protocol");
  addEdge(edges, byPath, "docs", "project-skills/suka-architecture");
  addEdge(edges, byPath, "scripts", "packages/cli");

  return Array.from(new Map(edges.map((item) => [item.id, item])).values());
}

async function inferredEdgesFor(root: string, domains: RepoMapDomain[]): Promise<RepoMapEdge[]> {
  const byPackageName = await packageNameIndex(root, domains);
  const edges: RepoMapEdge[] = [];

  for (const domain of domains) {
    edges.push(...await packageDependencyEdges(root, domain, byPackageName));
    edges.push(...await sourceImportEdges(root, domain, domains, byPackageName));
  }

  return edges;
}

async function packageNameIndex(root: string, domains: RepoMapDomain[]): Promise<Map<string, RepoMapDomain>> {
  const byPackageName = new Map<string, RepoMapDomain>();
  for (const domain of domains) {
    const manifest = await readJsonFile(join(root, domain.path, "package.json"));
    if (isRecord(manifest) && typeof manifest.name === "string") {
      byPackageName.set(manifest.name, domain);
    }
  }
  return byPackageName;
}

async function packageDependencyEdges(
  root: string,
  source: RepoMapDomain,
  byPackageName: Map<string, RepoMapDomain>
): Promise<RepoMapEdge[]> {
  const manifest = await readJsonFile(join(root, source.path, "package.json"));
  if (!isRecord(manifest)) return [];

  const edges: RepoMapEdge[] = [];
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
    const dependencies = manifest[field];
    if (!isRecord(dependencies)) continue;

    for (const dependencyName of Object.keys(dependencies)) {
      const target = byPackageName.get(dependencyName);
      if (target && target.id !== source.id) {
        edges.push(edge(source.id, target.id));
      }
    }
  }
  return edges;
}

async function sourceImportEdges(
  root: string,
  source: RepoMapDomain,
  domains: RepoMapDomain[],
  byPackageName: Map<string, RepoMapDomain>
): Promise<RepoMapEdge[]> {
  const files = await sourceFiles(join(root, source.path));
  const edges: RepoMapEdge[] = [];

  for (const file of files) {
    const text = await readTextFile(file);
    if (text === undefined) continue;

    for (const specifier of importSpecifiers(text)) {
      const target = resolveImportDomain(root, file, specifier, domains, byPackageName);
      if (target && target.id !== source.id) {
        edges.push(edge(source.id, target.id));
      }
    }
  }
  return edges;
}

async function sourceFiles(directory: string, depth = 0): Promise<string[]> {
  if (depth > 5) return [];

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (ignoredNames.has(entry.name)) continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(absolutePath, depth + 1));
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(extname(entry.name))) {
      files.push(absolutePath);
    }
  }
  return files;
}

function importSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const importPattern = /\bimport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|\bexport\s+(?:type\s+)?[^'"]*?\s+from\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(source)) !== null) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier !== undefined) specifiers.add(specifier);
  }
  return [...specifiers];
}

function routeSpecifiers(source: string): string[] {
  const routes = new Set<string>();
  const patterns = [
    /\b(?:app|router|server)\.(?:all|get|post|put|patch|delete|options|head)\(\s*["']([^"']+)["']/g,
    /\burl\.pathname\s*={2,3}\s*["']([^"']+)["']/g,
    /\burl\.pathname\s*!==\s*["']([^"']+)["']/g
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const route = match[1];
      if (route !== undefined && route.startsWith("/")) routes.add(route);
    }
  }

  return [...routes];
}

function resolveImportDomain(
  root: string,
  sourceFile: string,
  specifier: string,
  domains: RepoMapDomain[],
  byPackageName: Map<string, RepoMapDomain>
): RepoMapDomain | undefined {
  const packageTarget = byPackageName.get(packageNameForSpecifier(specifier));
  if (packageTarget) return packageTarget;

  if (!specifier.startsWith(".")) return undefined;

  const targetPath = normalizeRepoPath(relative(root, resolve(dirname(sourceFile), specifier)));
  return domainForPath(domains, targetPath);
}

function packageNameForSpecifier(specifier: string): string {
  if (!specifier.startsWith("@")) {
    return specifier.split("/")[0] ?? specifier;
  }
  const parts = specifier.split("/");
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
}

function domainForPath(domains: RepoMapDomain[], path: string): RepoMapDomain | undefined {
  return [...domains]
    .sort((a, b) => b.path.length - a.path.length)
    .find((domain) => path === domain.path || path.startsWith(`${domain.path}/`));
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

function isTestFile(path: string): boolean {
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(path) || /(?:^|[\\/])__tests__[\\/]/.test(path);
}

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/");
}

async function readJsonFile(path: string): Promise<unknown> {
  const text = await readTextFile(path);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function readTextFile(path: string): Promise<string | undefined> {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > 1_000_000) return undefined;
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
