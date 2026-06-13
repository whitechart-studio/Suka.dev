import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultSukaConfig, normalizeSukaConfig, validateSukaConfig } from "./index.js";

test("creates privacy-safe local config defaults", () => {
  const config = createDefaultSukaConfig({ repo: "whitechart-studio/Suka.dev" });

  assert.equal(config.mode, "local");
  assert.equal(config.server_url, "http://127.0.0.1:4366");
  assert.equal(config.data_file, ".suka/state.json");
  assert.equal(config.privacy.publish_file_paths, true);
  assert.equal(config.privacy.publish_code_content, false);
  assert.equal(config.privacy.publish_terminal_logs, false);
  assert.ok(config.ignored_paths.includes("node_modules/**"));
});

test("validates domain scopes and duplicate ids", () => {
  const result = validateSukaConfig({
    ...createDefaultSukaConfig({ repo: "demo" }),
    domains: [
      {
        id: "billing",
        name: "Billing",
        paths: [],
        apis: [],
        tables: [],
        env: []
      },
      {
        id: "billing",
        name: "Duplicate",
        paths: ["src/billing/**"],
        apis: [],
        tables: [],
        env: []
      }
    ]
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === "empty_scope"));
    assert.ok(result.issues.some((issue) => issue.message === "Domain ids must be unique."));
  }
});

test("normalizes legacy config with safe defaults", () => {
  const result = normalizeSukaConfig({
    version: 1,
    repo: "demo/repo",
    server_url: "http://localhost:4366",
    data_file: ".suka/state.json",
    privacy: {
      publish_file_paths: false,
      publish_code_content: true
    }
  }, {
    repo: "fallback"
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.repo, "demo/repo");
    assert.equal(result.value.privacy.publish_file_paths, false);
    assert.equal(result.value.privacy.publish_code_content, false);
    assert.deepEqual(result.value.domains, []);
  }
});
