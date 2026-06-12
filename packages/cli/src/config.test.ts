import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { findConfigPath, initProject, loadConfig } from "./index.js";

test("initializes repo-local Suka config", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-init-"));
  try {
    const result = initProject({
      cwd: tempDir,
      repo: "demo/repo",
      serverUrl: "http://127.0.0.1:4366"
    });

    assert.equal(result.config.repo, "demo/repo");
    assert.equal(findConfigPath(tempDir), result.configPath);
    assert.equal(loadConfig(tempDir)?.data_file, ".suka/state.json");
    assert.equal(readFileSync(join(tempDir, ".suka", ".gitignore"), "utf8"), "state.json\nstate.json.tmp\n");
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("finds config from nested directories", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "suka-init-"));
  try {
    initProject({ cwd: tempDir });
    const nested = join(tempDir, "packages", "demo");

    assert.equal(loadConfig(nested)?.repo, basenameForTest(tempDir));
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

function basenameForTest(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}
