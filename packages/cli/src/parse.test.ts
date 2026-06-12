import test from "node:test";
import assert from "node:assert/strict";
import { parseArgv, readCsvFlag } from "./index.js";

test("parses command arguments and flags", () => {
  const parsed = parseArgv(["claim", "src/billing/**", "--agent", "codex-01", "--ttl=45", "--json"]);

  assert.equal(parsed.command, "claim");
  assert.deepEqual(parsed.args, ["src/billing/**"]);
  assert.equal(parsed.flags.agent, "codex-01");
  assert.equal(parsed.flags.ttl, "45");
  assert.equal(parsed.flags.json, true);
});

test("reads comma-separated flag values", () => {
  const parsed = parseArgv(["conflicts", "--path", "a.ts,b.ts"]);

  assert.deepEqual(readCsvFlag(parsed.flags, "path"), ["a.ts", "b.ts"]);
});

