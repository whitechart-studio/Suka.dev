export function normalizeRepoPath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .replace(/^[a-zA-Z]:\//, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

export function pathsOverlap(pattern: string, path: string): boolean {
  const normalizedPattern = normalizeRepoPath(pattern);
  const normalizedPath = normalizeRepoPath(path);

  if (normalizedPattern === normalizedPath) {
    return true;
  }

  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  }

  if (normalizedPattern.includes("*")) {
    return globToRegExp(normalizedPattern).test(normalizedPath);
  }

  return normalizedPath.startsWith(`${normalizedPattern}/`);
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .split("**")
    .map((part) =>
      part
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replaceAll("*", "[^/]*")
    )
    .join(".*");

  return new RegExp(`^${escaped}$`);
}

