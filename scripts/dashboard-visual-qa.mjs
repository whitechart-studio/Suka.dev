import { createRequire } from "node:module";

const requireFromWorkspace = createRequire(import.meta.url);
const requireFromBundle = process.env.PLAYWRIGHT_MODULE_DIR
  ? createRequire(`${process.env.PLAYWRIGHT_MODULE_DIR.replace(/\/$/, "")}/`)
  : undefined;
const { chromium } = requireFromBundle?.("playwright") ?? requireFromWorkspace("playwright");

const target = process.env.SUKA_DASHBOARD_URL ?? "http://127.0.0.1:4366/";
const visualContext = {
  repo_id: "visual-repo",
  session_id: "visual-session",
  workspace_id: "visual-workspace"
};
const ledgerApi = new URL("/api/ledger", target);
const cleanupApi = new URL("/api/cleanup", target);
const screenshots = {
  desktop: "/private/tmp/suka-dashboard-desktop.png",
  mobile: "/private/tmp/suka-dashboard-mobile.png",
  selected: "/private/tmp/suka-dashboard-selected.png",
  welcome: "/private/tmp/suka-dashboard-welcome.png"
};

function pageOverflowScript() {
  return {
    bodyX: document.body.scrollWidth - document.body.clientWidth,
    bodyY: document.body.scrollHeight - document.body.clientHeight,
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight
  };
}

const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  await fetch(ledgerApi, {
    body: JSON.stringify({
      id: `visual_ledger_${Date.now()}`,
      ...visualContext,
      agent_id: "codex-visual",
      event_type: "file_modified",
      summary: "Visual QA ledger entry rendered.",
      affected_paths: ["apps/dashboard/src/main.tsx"],
      branch: "visual-ledger-feed",
      worktree: "/worktrees/suka/visual-ledger-feed",
      diff_stat: {
        files_changed: 1,
        additions: 12,
        deletions: 3
      },
      created_at: new Date().toISOString()
    }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { height: 940, width: 1440 } });
  page.on("pageerror", (error) => errors.push(String(error.message || error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(target, { waitUntil: "networkidle" });
  const welcomeVisible = await page.locator(".welcome-surface").isVisible();
  let welcomeText = "";
  if (welcomeVisible) {
    welcomeText = await page.locator(".welcome-surface").innerText();
    await page.screenshot({ fullPage: true, path: screenshots.welcome });
    await page.locator(".welcome-actions button").filter({ hasText: "Start local workspace" }).click();
    await page.waitForTimeout(150);
  }
  await page.waitForSelector(".react-flow__node", { timeout: 10_000 });
  await page.screenshot({ fullPage: true, path: screenshots.desktop });
  await page.locator("button[aria-label=\"Back to landing\"]").click();
  await page.waitForSelector(".welcome-surface", { timeout: 10_000 });
  const exitReturnsToWelcome = await page.locator(".welcome-surface").isVisible();
  await page.locator(".welcome-actions button").filter({ hasText: "Start local workspace" }).click();
  await page.waitForSelector(".react-flow__node", { timeout: 10_000 });

  const nodeCount = await page.locator(".react-flow__node").count();
  await page.locator(".react-flow__node").filter({ hasText: "Server" }).first().click();
  await page.waitForTimeout(250);

  const inspectorText = await page.locator(".right-rail").innerText();
  const selectionStored = await page.evaluate(() => localStorage.getItem("suka.dashboard.selectedNodeId"));
  const overflow = await page.evaluate(pageOverflowScript);

  const openCanvasToggles = await page.locator(".canvas-rail-toggle").count();
  await page.locator(".left-rail button[aria-label=\"Collapse rail\"]").click();
  await page.waitForTimeout(150);
  const leftStoredAfterCollapse = await page.evaluate(() => localStorage.getItem("suka.dashboard.leftOpen"));
  const leftRailHiddenAfterCollapse = await page.locator(".left-rail").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return getComputedStyle(element).display === "none" || box.width === 0;
  });
  await page.locator("button[aria-label=\"Show agents sidebar\"]").click();
  await page.waitForTimeout(150);
  const leftStoredAfterRestore = await page.evaluate(() => localStorage.getItem("suka.dashboard.leftOpen"));
  await page.locator(".right-rail button[aria-label=\"Collapse rail\"]").click();
  await page.waitForTimeout(150);
  const rightStoredAfterCollapse = await page.evaluate(() => localStorage.getItem("suka.dashboard.rightOpen"));
  const rightRailHiddenAfterCollapse = await page.locator(".right-rail").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return getComputedStyle(element).display === "none" || box.width === 0;
  });
  await page.locator("button[aria-label=\"Show radar sidebar\"]").click();
  await page.waitForTimeout(150);
  const rightStoredAfterRestore = await page.evaluate(() => localStorage.getItem("suka.dashboard.rightOpen"));
  const visibleAgentCards = await page.locator(".left-rail .agent-card").count();
  await page.getByRole("tab", { name: /Activity/i }).click();
  await page.waitForTimeout(150);
  const ledgerFeedVisible = await page.locator(".right-panel .activity-ledger-feed").isVisible().catch(() => false);
  const ledgerCardCount = await page.locator(".right-panel .ledger-activity-card").count();
  if (!ledgerFeedVisible || ledgerCardCount === 0) {
    errors.push("Activity panel did not render seeded Coding Ledger entries.");
  }
  const activityPresenceCards = await page.locator(".right-panel .activity-presence-card").count();
  const activityEmptyVisible = await page.locator(".right-panel").getByText("No recent activity").isVisible().catch(() => false);
  const activityHasPresenceFallback = visibleAgentCards === 0 || (activityPresenceCards > 0 && !activityEmptyVisible);
  if (!activityHasPresenceFallback) {
    errors.push("Activity panel did not show presence fallback while agents were visible.");
  }
  await page.screenshot({ fullPage: true, path: screenshots.selected });

  const mobile = await browser.newPage({
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 }
  });
  await mobile.goto(target, { waitUntil: "networkidle" });
  if (await mobile.locator(".welcome-surface").isVisible()) {
    await mobile.locator(".welcome-actions button").filter({ hasText: "Start local workspace" }).click();
    await mobile.waitForTimeout(150);
  }
  await mobile.waitForSelector(".react-flow__node", { timeout: 10_000 });
  const mobileOverflow = await mobile.evaluate(pageOverflowScript);
  await mobile.screenshot({ fullPage: true, path: screenshots.mobile });

  console.log(JSON.stringify({
    errors,
    activityEmptyVisible,
    activityHasPresenceFallback,
    activityPresenceCards,
    ledgerCardCount,
    ledgerFeedVisible,
    exitReturnsToWelcome,
    inspectorHasServer: inspectorText.includes("Server") && inspectorText.includes("apps/server"),
    leftRailHiddenAfterCollapse,
    leftStoredAfterCollapse,
    leftStoredAfterRestore,
    mobileOverflow,
    nodeCount,
    openCanvasToggles,
    overflow,
    rightRailHiddenAfterCollapse,
    rightStoredAfterCollapse,
    rightStoredAfterRestore,
    screenshots,
    selectionStored,
    visibleAgentCards,
    welcomeHasIdentity: welcomeText.includes("Suka.dev") && welcomeText.includes("Coordinate agents"),
    welcomeVisible
  }, null, 2));
} finally {
  await fetch(cleanupApi, {
    body: JSON.stringify(visualContext),
    headers: { "content-type": "application/json" },
    method: "POST"
  }).catch(() => undefined);
  await browser.close();
}
