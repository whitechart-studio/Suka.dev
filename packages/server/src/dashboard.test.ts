import test from "node:test";
import assert from "node:assert/strict";
import { dashboardHtml } from "./dashboard.js";

test("dashboard HTML includes state-driven app shell", () => {
  const html = dashboardHtml();

  assert.match(html, /Suka Operations Canvas/);
  assert.match(html, /\/api\/state/);
  assert.match(html, /Repo Domain Map/);
  assert.match(html, /Risk Queue/);
  assert.match(html, /Agent Roster/);
});
