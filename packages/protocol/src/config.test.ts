import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultSukaConfig, normalizeSukaConfig, validateSukaConfig } from "./index.js";

test("creates privacy-safe local config defaults", () => {
  const config = createDefaultSukaConfig({ repo: "whitechart-studio/Suka.dev" });

  assert.equal(config.mode, "local");
  assert.equal(config.server_url, "http://127.0.0.1:4366");
  assert.equal(config.data_file, ".suka/state.json");
  assert.equal(config.platform.workspace_id, "local-whitechart-studio-suka-dev");
  assert.equal(config.platform.repo_id, "whitechart-studio-suka-dev");
  assert.equal(config.platform.auth_required, false);
  assert.equal(config.platform.audit_log_enabled, false);
  assert.equal(config.platform.auth_token_env, "SUKA_AUTH_TOKEN");
  assert.equal(config.platform.retention_days, 30);
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
    assert.equal(result.value.platform.workspace_id, "local-fallback");
    assert.equal(result.value.platform.auth_required, false);
    assert.equal(result.value.privacy.publish_file_paths, false);
    assert.equal(result.value.privacy.publish_code_content, false);
    assert.deepEqual(result.value.domains, []);
  }
});

test("normalizes self-hosted config with secure platform defaults", () => {
  const result = normalizeSukaConfig({
    version: 1,
    repo: "demo/repo",
    mode: "self_hosted",
    server_url: "https://suka.internal",
    data_file: ".suka/state.json",
    platform: {
      repo_id: "repo_demo",
      team_id: "team_core",
      workspace_id: "workspace_demo"
    }
  }, {
    repo: "fallback"
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.mode, "self_hosted");
    assert.equal(result.value.platform.workspace_id, "workspace_demo");
    assert.equal(result.value.platform.repo_id, "repo_demo");
    assert.equal(result.value.platform.team_id, "team_core");
    assert.equal(result.value.platform.auth_required, true);
    assert.equal(result.value.platform.audit_log_enabled, true);
    assert.equal(result.value.platform.retention_days, 90);
  }
});

test("validates platform identity and retention settings", () => {
  const result = validateSukaConfig({
    ...createDefaultSukaConfig({ repo: "demo" }),
    platform: {
      audit_log_enabled: false,
      auth_required: false,
      auth_token_env: "",
      repo_id: "",
      retention_days: 0,
      workspace_id: ""
    }
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "platform.workspace_id"));
    assert.ok(result.issues.some((issue) => issue.path === "platform.repo_id"));
    assert.ok(result.issues.some((issue) => issue.path === "platform.retention_days"));
  }
});

test("requires auth outside local mode", () => {
  const result = validateSukaConfig({
    ...createDefaultSukaConfig({ repo: "demo" }),
    mode: "hosted",
    platform: {
      ...createDefaultSukaConfig({ repo: "demo" }).platform,
      auth_required: false
    }
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.path === "platform.auth_required"));
  }
});
