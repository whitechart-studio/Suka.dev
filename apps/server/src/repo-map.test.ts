import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildRepoMap } from "./repo-map.js";

test("repo map infers package and source import relationships", async () => {
  const root = await mkdtemp(join(tmpdir(), "suka-repo-map-"));
  try {
    await mkdir(join(root, "apps", "web", "src"), { recursive: true });
    await mkdir(join(root, "packages", "api", "src"), { recursive: true });
    await mkdir(join(root, "packages", "shared", "src"), { recursive: true });

    await writeJson(join(root, "apps", "web", "package.json"), {
      dependencies: {
        "@suka/api": "0.0.0"
      },
      name: "@suka/web"
    });
    await writeJson(join(root, "packages", "api", "package.json"), {
      dependencies: {
        "@suka/shared": "0.0.0"
      },
      name: "@suka/api"
    });
    await writeJson(join(root, "packages", "shared", "package.json"), {
      name: "@suka/shared"
    });
    await writeFile(join(root, "apps", "web", "src", "index.ts"), "import { handler } from '@suka/api';\nhandler();\n");
    await writeFile(join(root, "packages", "api", "src", "handler.ts"), "export { value } from '@suka/shared';\n");

    const map = await buildRepoMap(root);
    const edgeIds = new Set(map.edges.map((edge) => edge.id));

    assert.ok(map.domains.some((domain) => domain.path === "apps/web"));
    assert.ok(map.domains.some((domain) => domain.path === "packages/api"));
    assert.ok(map.domains.some((domain) => domain.path === "packages/shared"));
    assert.ok(edgeIds.has("apps-web:packages-api"));
    assert.ok(edgeIds.has("packages-api:packages-shared"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("repo map includes domain package, route, and test metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "suka-repo-map-"));
  try {
    await mkdir(join(root, "apps", "api", "src"), { recursive: true });
    await mkdir(join(root, "packages", "shared", "src"), { recursive: true });

    await writeJson(join(root, "apps", "api", "package.json"), {
      name: "@suka/api"
    });
    await writeJson(join(root, "packages", "shared", "package.json"), {
      name: "@suka/shared"
    });
    await writeFile(
      join(root, "apps", "api", "src", "http.ts"),
      "if (url.pathname === '/api/state') reply();\nrouter.post('/api/briefs', writeBrief);\n"
    );
    await writeFile(join(root, "apps", "api", "src", "http.test.ts"), "assert.equal(1, 1);\n");

    const map = await buildRepoMap(root);
    const api = map.domains.find((domain) => domain.path === "apps/api");

    assert.equal(api?.package_name, "@suka/api");
    assert.equal(api?.test_count, 1);
    assert.deepEqual(api?.routes, ["/api/briefs", "/api/state"]);
    assert.equal(api?.route_count, 2);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
