export function dashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Suka Operations Canvas</title>
    <style>
      :root {
        color-scheme: light;
        --page: #eef1f4;
        --ink: #161b22;
        --muted: #697386;
        --line: #dce2ea;
        --panel: #fbfcfd;
        --panel-2: #f5f7fa;
        --canvas: #11161d;
        --canvas-2: #1a2029;
        --canvas-line: rgba(229, 236, 246, 0.085);
        --teal: #0f766e;
        --blue: #2563eb;
        --indigo: #4f46e5;
        --green: #16803c;
        --amber: #b45309;
        --rose: #be123c;
        --cyan: #0e7490;
        --shadow: 0 10px 24px rgba(17, 24, 39, 0.075);
      }

      * { box-sizing: border-box; }

      html,
      body {
        height: 100%;
        overflow: hidden;
      }

      body {
        margin: 0;
        background: #edf1f5;
        color: var(--ink);
        display: flex;
        flex-direction: column;
        font: 12px/1.42 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-feature-settings: "cv02", "cv03", "cv04", "tnum";
      }

      button {
        align-items: center;
        background: #111827;
        border: 1px solid #111827;
        border-radius: 6px;
        color: #fff;
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-weight: 650;
        gap: 6px;
        justify-content: center;
        min-height: 30px;
        padding: 5px 10px;
      }

      button.secondary {
        background: #fff;
        border-color: var(--line);
        color: var(--ink);
      }

      button:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.22);
        outline-offset: 2px;
      }

      h1, h2, h3, p { margin: 0; }

      h1 { font-size: 16px; font-weight: 720; letter-spacing: 0; }
      h2 { font-size: 12px; font-weight: 720; letter-spacing: 0; }
      h3 { font-size: 11px; font-weight: 700; letter-spacing: 0; }

      code {
        background: rgba(17, 24, 39, 0.06);
        border-radius: 4px;
        display: inline-block;
        font: 11px/1.35 "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        max-width: 100%;
        overflow-wrap: anywhere;
        padding: 1px 5px;
      }

      .appbar {
        align-items: center;
        background: rgba(251, 252, 254, 0.92);
        border-bottom: 1px solid rgba(216, 222, 231, 0.95);
        display: flex;
        gap: 16px;
        justify-content: space-between;
        min-height: 58px;
        padding: 9px 12px;
        position: relative;
        flex: 0 0 auto;
        z-index: 10;
        backdrop-filter: blur(16px);
      }

      .brand {
        align-items: center;
        display: flex;
        gap: 10px;
        min-width: 0;
      }

      .mark {
        align-items: center;
        background: conic-gradient(from 210deg, var(--teal), var(--blue), var(--amber), var(--teal));
        border: 2px solid #fff;
        border-radius: 7px;
        box-shadow: 0 6px 16px rgba(17, 24, 39, 0.14);
        color: #fff;
        display: inline-flex;
        height: 30px;
        justify-content: center;
        width: 30px;
      }

      .muted { color: var(--muted); font-size: 11px; }

      .icon {
        display: inline-block;
        flex: 0 0 auto;
        height: 14px;
        stroke-width: 2.2;
        vertical-align: -2px;
        width: 14px;
      }

      .mark .icon {
        height: 16px;
        width: 16px;
      }

      .label-icon {
        align-items: center;
        display: inline-flex;
        gap: 6px;
        min-width: 0;
      }

      .toolbar {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }

      .badge {
        align-items: center;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--muted);
        display: inline-flex;
        flex: 0 0 auto;
        gap: 6px;
        font-size: 11px;
        font-weight: 650;
        min-height: 22px;
        padding: 1px 7px;
        white-space: nowrap;
      }

      .badge.live { border-color: rgba(15, 118, 110, 0.34); color: var(--teal); }
      .badge.risk { border-color: rgba(180, 83, 9, 0.36); color: var(--amber); }
      .badge.fail { border-color: rgba(190, 18, 60, 0.34); color: var(--rose); }
      .badge.info { border-color: rgba(37, 99, 235, 0.34); color: var(--blue); }

      .shell {
        display: grid;
        gap: 8px;
        grid-template-columns: 280px minmax(0, 1fr) 340px;
        height: calc(100dvh - 58px);
        min-height: 0;
        overflow: hidden;
        padding: 8px;
      }

      .shell.left-collapsed {
        grid-template-columns: 64px minmax(0, 1fr) 340px;
      }

      .shell.right-collapsed {
        grid-template-columns: 280px minmax(0, 1fr) 64px;
      }

      .shell.left-collapsed.right-collapsed {
        grid-template-columns: 64px minmax(0, 1fr) 64px;
      }

      .shell.focus-mode {
        grid-template-columns: minmax(0, 1fr) !important;
        gap: 0;
        padding: 8px;
      }

      .panel {
        background: rgba(251, 252, 254, 0.94);
        border: 1px solid rgba(216, 222, 231, 0.96);
        border-radius: 7px;
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }

      .panel-head {
        align-items: center;
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        min-height: 38px;
        padding: 8px 10px;
      }

      .rail-toggle {
        background: #fff;
        border-color: var(--line);
        color: var(--ink);
        min-height: 28px;
        padding: 4px 7px;
      }

      .shell.left-collapsed > aside:first-child,
      .shell.right-collapsed > aside:last-child {
        box-shadow: none;
      }

      .shell.left-collapsed > aside:first-child .panel-head,
      .shell.right-collapsed > aside:last-child .panel-head {
        justify-content: center;
        padding: 8px 6px;
      }

      .shell.left-collapsed > aside:first-child .panel-head h2,
      .shell.left-collapsed > aside:first-child .panel-head .badge,
      .shell.left-collapsed > aside:first-child .rail-note,
      .shell.left-collapsed > aside:first-child .list,
      .shell.right-collapsed > aside:last-child section:not(:first-child),
      .shell.right-collapsed > aside:last-child .panel-head h2,
      .shell.right-collapsed > aside:last-child .panel-head .badge,
      .shell.right-collapsed > aside:last-child .list {
        display: none;
      }

      .shell.left-collapsed #toggle-left-rail,
      .shell.right-collapsed #toggle-right-rail {
        display: inline-flex;
      }

      .shell.focus-mode > aside {
        display: none;
      }

      .stack {
        align-content: stretch;
        display: grid;
        gap: 8px;
        grid-template-rows: minmax(0, 1.15fr) 150px minmax(0, 1fr);
        height: 100%;
        min-height: 0;
      }

      .list {
        display: grid;
        gap: 7px;
        min-height: 0;
        overflow: auto;
        overscroll-behavior: contain;
        padding: 8px;
      }

      .card {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 6px;
        display: grid;
        gap: 6px;
        min-width: 0;
        padding: 8px;
      }

      .row {
        align-items: center;
        display: flex;
        gap: 7px;
        justify-content: space-between;
        min-width: 0;
      }

      .title {
        font-weight: 720;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .avatar {
        align-items: center;
        border: 1px solid rgba(255,255,255,0.9);
        border-radius: 999px;
        color: #fff;
        display: inline-flex;
        flex: 0 0 auto;
        font-size: 10px;
        font-weight: 720;
        height: 26px;
        justify-content: center;
        width: 26px;
      }

      .avatar .icon {
        height: 14px;
        width: 14px;
      }

      .swatch {
        border-radius: 999px;
        display: inline-block;
        height: 9px;
        width: 28px;
      }

      .canvas-panel {
        background: var(--canvas);
        color: #f8fafc;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        min-height: 0;
      }

      .canvas-head {
        align-items: center;
        background: linear-gradient(180deg, rgba(25, 31, 40, 0.98), rgba(17, 22, 29, 0.98));
        border-bottom: 1px solid rgba(232, 238, 246, 0.12);
        display: flex;
        justify-content: space-between;
        padding: 9px 10px;
      }

      .canvas-head .muted { color: #aab5c4; }

      .metrics {
        display: grid;
        gap: 6px;
        grid-template-columns: repeat(4, minmax(76px, 1fr));
      }

      .metric {
        background: rgba(255, 255, 255, 0.045);
        border: 1px solid rgba(232, 238, 246, 0.12);
        border-radius: 6px;
        display: grid;
        gap: 2px;
        padding: 6px 7px;
      }

      .metric strong {
        color: #fff;
        display: block;
        font-size: 17px;
        line-height: 1.05;
      }

      .stage {
        min-height: 0;
        overflow: hidden;
        position: relative;
      }

      .stage-grid {
        background-image:
          linear-gradient(var(--canvas-line) 1px, transparent 1px),
          linear-gradient(90deg, var(--canvas-line) 1px, transparent 1px);
        background-size: 36px 36px;
        inset: 0;
        position: absolute;
      }

      .stage-vignette {
        background:
          linear-gradient(90deg, rgba(17,22,29,0.62), transparent 20%, transparent 80%, rgba(17,22,29,0.62)),
          linear-gradient(180deg, rgba(17,22,29,0.18), transparent 32%, rgba(17,22,29,0.30));
        inset: 0;
        pointer-events: none;
        position: absolute;
        z-index: 1;
      }

      #graph {
        inset: 0;
        position: absolute;
        z-index: 2;
      }

      .canvas-tools {
        align-items: center;
        background: rgba(248, 250, 252, 0.94);
        border: 1px solid rgba(226, 232, 240, 0.72);
        border-radius: 8px;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(14px);
        bottom: 14px;
        display: flex;
        gap: 4px;
        left: 50%;
        padding: 4px;
        position: absolute;
        top: auto;
        transform: translateX(-50%);
        z-index: 4;
        max-width: calc(100% - 18px);
        overflow: auto;
        overscroll-behavior: contain;
      }

      .canvas-tools button {
        background: transparent;
        border-color: transparent;
        color: #111827;
        min-height: 28px;
        padding: 4px 8px;
      }

      .canvas-tools button:hover {
        background: rgba(17, 24, 39, 0.07);
      }

      .canvas-tools button.active {
        background: #111827;
        color: #fff;
      }

      .agent-strip { display: flex; flex-wrap: wrap; gap: 5px; min-height: 11px; }

      .canvas-foot {
        align-items: center;
        background: rgba(21, 26, 32, 0.96);
        border-top: 1px solid rgba(232, 238, 246, 0.12);
        display: flex;
        gap: 12px;
        justify-content: space-between;
        min-height: 42px;
        padding: 6px 10px;
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .legend-item {
        align-items: center;
        color: #cbd5e1;
        display: inline-flex;
        font-size: 11px;
        gap: 6px;
        white-space: nowrap;
      }

      .dot {
        border-radius: 999px;
        display: inline-block;
        height: 8px;
        width: 8px;
      }

      .empty, .error { color: var(--muted); padding: 10px; }
      .error { color: var(--rose); }

      .rail-note {
        background: var(--panel-2);
        border-bottom: 1px solid var(--line);
        color: var(--muted);
        font-size: 12px;
        padding: 7px 8px;
      }

      .timeline {
        max-height: none;
        overflow: auto;
      }

      @media (max-width: 1220px) {
        .shell { grid-template-columns: 246px minmax(0, 1fr) 306px; }
        .shell.left-collapsed { grid-template-columns: 60px minmax(0, 1fr) 306px; }
        .shell.right-collapsed { grid-template-columns: 246px minmax(0, 1fr) 60px; }
        .shell.left-collapsed.right-collapsed { grid-template-columns: 60px minmax(0, 1fr) 60px; }
      }

      @media (max-width: 860px) {
        .appbar { min-height: 62px; padding: 9px 10px; }
        .brand .muted { display: none; }
        .toolbar .badge.info { display: none; }
        .shell {
          gap: 8px;
          grid-template-columns: 74px minmax(0, 1fr) 74px;
          height: calc(100dvh - 62px);
          padding: 8px;
        }
        .shell.left-collapsed { grid-template-columns: 0 minmax(0, 1fr) 74px; }
        .shell.right-collapsed { grid-template-columns: 74px minmax(0, 1fr) 0; }
        .shell.left-collapsed.right-collapsed,
        .shell.focus-mode {
          grid-template-columns: 0 minmax(0, 1fr) 0;
          gap: 0;
          padding: 6px;
        }
        .panel-head {
          justify-content: center;
          padding: 8px;
        }
        .shell > aside:first-child .panel-head h2,
        .right-rail .panel-head h2,
        .rail-note,
        .shell > aside:first-child .card .muted,
        .shell > aside:first-child .card code,
        .right-rail .card .muted,
        .right-rail .card code,
        .canvas-foot .muted {
          display: none;
        }
        .shell > aside:first-child .list,
        .right-rail .list {
          padding: 6px;
        }
        .right-rail .list {
          display: none;
        }
        .shell > aside:first-child .card,
        .right-rail .card {
          align-items: center;
          justify-items: center;
          padding: 7px;
        }
        .shell > aside:first-child .card > :not(:first-child),
        .shell > aside:first-child .card .title,
        .shell > aside:first-child .card .muted,
        .shell > aside:first-child .card .badge {
          display: none;
        }
        .shell > aside:first-child .avatar {
          height: 38px;
          width: 38px;
        }
        .shell > aside:first-child .title,
        .right-rail .title {
          font-size: 11px;
          max-width: 54px;
          text-align: center;
        }
        .shell > aside:first-child .row,
        .right-rail .row {
          flex-direction: column;
          justify-content: center;
        }
        .right-rail {
          gap: 8px;
          grid-template-rows: minmax(0, 1fr) 110px minmax(0, 1fr);
        }
        .canvas-head {
          align-items: stretch;
          flex-direction: column;
          gap: 8px;
          padding: 9px;
        }
        .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
        .metric { padding: 6px; }
        .metric strong { font-size: 16px; }
        .canvas-tools { bottom: 10px; }
        .canvas-tools {
          gap: 2px;
          padding: 3px;
        }
        .canvas-tools button {
          min-height: 26px;
          min-width: 26px;
          padding: 3px 5px;
        }
        .canvas-tools button span { display: none; }
        .canvas-foot {
          min-height: 38px;
          padding: 6px 8px;
        }
        .legend { gap: 6px; }
        .legend-item { font-size: 0; gap: 0; }
      }
    </style>
  </head>
  <body>
    <header class="appbar">
      <div class="brand">
        <div class="mark" aria-hidden="true"><i class="icon" data-lucide="waypoints"></i></div>
        <div>
          <h1>Suka Operations Canvas</h1>
          <div class="muted">Workspace topology for agents, claims, repo domains, and delivery risk</div>
        </div>
      </div>
      <div class="toolbar">
        <span class="badge info"><i class="icon" data-lucide="hard-drive"></i>local workspace</span>
        <span class="badge" id="status">connecting</span>
        <button class="secondary" id="focus-layout" type="button" title="Focus canvas"><i class="icon" data-lucide="maximize-2"></i>Focus</button>
        <button class="secondary" id="refresh" type="button"><i class="icon" data-lucide="rotate-cw"></i>Refresh</button>
      </div>
    </header>
    <main class="shell">
      <aside class="panel">
        <div class="panel-head">
          <h2 class="label-icon"><i class="icon" data-lucide="users"></i>Agent Roster</h2>
          <span class="badge live"><i class="icon" data-lucide="bot"></i><span id="agent-count">0</span></span>
          <button class="rail-toggle" id="toggle-left-rail" type="button" title="Hide left rail"><i class="icon" data-lucide="panel-left-close"></i></button>
        </div>
        <div class="rail-note label-icon"><i class="icon" data-lucide="palette"></i>Color identifies the agent across the canvas.</div>
        <div class="list" id="agents"></div>
      </aside>

      <section class="panel canvas-panel" aria-labelledby="map-title">
        <div class="canvas-head">
          <div>
            <h2 class="label-icon" id="map-title"><i class="icon" data-lucide="network"></i>Repo Domain Map</h2>
            <div class="muted" id="updated">not loaded</div>
          </div>
          <div class="metrics">
            <div class="metric"><strong id="presence-count">0</strong><span class="muted label-icon"><i class="icon" data-lucide="bot"></i>agents</span></div>
            <div class="metric"><strong id="claim-count">0</strong><span class="muted label-icon"><i class="icon" data-lucide="lock-keyhole"></i>claims</span></div>
            <div class="metric"><strong id="event-count">0</strong><span class="muted label-icon"><i class="icon" data-lucide="activity"></i>events</span></div>
            <div class="metric"><strong id="decision-count">0</strong><span class="muted label-icon"><i class="icon" data-lucide="check-check"></i>decisions</span></div>
          </div>
        </div>
        <div class="stage" id="map">
          <div class="stage-grid"></div>
          <div id="graph" aria-label="Interactive repo domain graph"></div>
          <div class="stage-vignette"></div>
          <div class="canvas-tools" aria-label="Canvas controls">
            <button id="select-graph" type="button" title="Select"><i class="icon" data-lucide="mouse-pointer-2"></i><span>Select</span></button>
            <button id="pan-graph" type="button" title="Pan"><i class="icon" data-lucide="hand"></i><span>Pan</span></button>
            <button id="zoom-out-graph" type="button" title="Zoom out"><i class="icon" data-lucide="minus"></i><span>Out</span></button>
            <button id="zoom-in-graph" type="button" title="Zoom in"><i class="icon" data-lucide="plus"></i><span>In</span></button>
            <button id="fit-graph" type="button" title="Fit canvas"><i class="icon" data-lucide="scan"></i><span>Fit</span></button>
            <button id="local-graph" type="button" title="Local graph"><i class="icon" data-lucide="orbit"></i><span>Local</span></button>
            <button id="risk-graph" type="button" title="Focus risk"><i class="icon" data-lucide="crosshair"></i><span>Risk</span></button>
          </div>
        </div>
        <div class="canvas-foot">
          <div class="legend">
            <span class="legend-item"><span class="dot" style="background:#2563eb"></span>active work</span>
            <span class="legend-item"><span class="dot" style="background:#b45309"></span>claimed scope</span>
            <span class="legend-item"><span class="dot" style="background:#be123c"></span>failing signal</span>
            <span class="legend-item"><span class="dot" style="background:#4f46e5"></span>decision attached</span>
          </div>
          <span class="muted">Domain color separates product area. Agent color follows the owner.</span>
        </div>
      </section>

      <aside class="stack right-rail">
        <section class="panel">
          <div class="panel-head">
            <h2 class="label-icon"><i class="icon" data-lucide="radar"></i>Risk Queue</h2>
            <span class="badge risk"><i class="icon" data-lucide="triangle-alert"></i><span id="risk-count">0</span></span>
            <button class="rail-toggle" id="toggle-right-rail" type="button" title="Hide right rail"><i class="icon" data-lucide="panel-right-close"></i></button>
          </div>
          <div class="list" id="radar"></div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2 class="label-icon"><i class="icon" data-lucide="scroll-text"></i>Decision Log</h2></div>
          <div class="list" id="decisions"></div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2 class="label-icon"><i class="icon" data-lucide="radio-tower"></i>Activity Stream</h2></div>
          <div class="list timeline" id="timeline"></div>
        </section>
      </aside>
    </main>
    <script src="/vendor/cytoscape.min.js"></script>
    <script src="/vendor/lucide.min.js"></script>
    <script>
      const agentPalette = ["#0f766e", "#2563eb", "#7c3aed", "#16803c", "#b45309", "#be123c", "#0e7490"];
      const domains = [
        { id: "auth", name: "Auth", color: "#0f766e", x: 18, y: 24, keys: ["auth", "session", "login", "oauth"] },
        { id: "api", name: "API", color: "#2563eb", x: 48, y: 18, keys: ["api", "route", "server", "endpoint"] },
        { id: "billing", name: "Billing", color: "#b45309", x: 76, y: 30, keys: ["billing", "payment", "stripe", "invoice", "webhook"] },
        { id: "ui", name: "UI", color: "#7c3aed", x: 21, y: 61, keys: ["app", "ui", "component", "page", "view"] },
        { id: "checkout", name: "Checkout", color: "#be123c", x: 53, y: 56, keys: ["checkout", "cart", "payment-client"] },
        { id: "database", name: "Database", color: "#16803c", x: 80, y: 69, keys: ["db", "database", "migration", "schema", "table"] },
        { id: "tests", name: "Tests", color: "#0e7490", x: 44, y: 86, keys: ["test", "spec", "__tests__"] },
        { id: "infra", name: "Infra", color: "#475569", x: 15, y: 86, keys: ["infra", "deploy", "docker", "ci", "env"] }
      ];
      const edges = [["auth", "api"], ["api", "billing"], ["billing", "checkout"], ["checkout", "ui"], ["checkout", "database"], ["database", "tests"], ["ui", "tests"], ["infra", "tests"], ["infra", "api"]];
      const state = { presence: [], claims: [], events: [], decisions: [] };
      let graph;
      let selectedGraphNodeId = "";

      const el = (id) => document.getElementById(id);
      const text = (value) => value === undefined || value === null || value === "" ? "none" : String(value);

      async function loadState() {
        setStatus("loading", false);
        try {
          const response = await fetch("/api/state", { cache: "no-store" });
          if (!response.ok) throw new Error("HTTP " + response.status);
          const payload = await response.json();
          Object.assign(state, payload.data);
          render();
          setStatus("connected", true);
        } catch (error) {
          setStatus("error", false);
          renderError(error);
        }
      }

      function render() {
        const model = buildDomainModel();
        el("presence-count").textContent = state.presence.length;
        el("claim-count").textContent = state.claims.length;
        el("event-count").textContent = state.events.length;
        el("decision-count").textContent = state.decisions.length;
        el("agent-count").textContent = state.presence.length;
        el("risk-count").textContent = model.filter((item) => item.claims.length > 0 || item.failures.length > 0).length;
        el("updated").textContent = "updated " + new Date().toLocaleTimeString();
        renderGraph(model);
        renderAgents();
        renderRadar(model);
        renderTimeline();
        renderDecisions();
        hydrateIcons();
      }

      function buildDomainModel() {
        return domains.map((domain) => {
          const claims = state.claims.filter((item) => touchesDomain(domain, [
            ...(item.scope?.paths ?? []), ...(item.scope?.apis ?? []), ...(item.scope?.tables ?? []), ...(item.scope?.env ?? []), ...(item.scope?.domains ?? [])
          ]));
          const presence = state.presence.filter((item) => touchesDomain(domain, [
            ...(item.current_files ?? []), item.task ?? "", item.branch ?? ""
          ]));
          const events = state.events.filter((item) => touchesDomain(domain, [
            ...(item.affected_paths ?? []), ...(item.affected_apis ?? []), ...(item.affected_tables ?? []), ...(item.affected_env ?? []), item.summary ?? ""
          ]));
          const decisions = state.decisions.filter((item) => touchesDomain(domain, [
            ...(item.scope?.paths ?? []), ...(item.scope?.domains ?? []), item.title ?? "", item.body ?? ""
          ]));
          const failures = events.filter((event) => String(event.event_type).includes("failed"));
          return { ...domain, claims, presence, events, decisions, failures };
        });
      }

      function touchesDomain(domain, values) {
        const haystack = values.join(" ").toLowerCase();
        return domain.keys.some((key) => haystack.includes(key));
      }

      function renderGraph(model) {
        if (typeof cytoscape !== "function") {
          el("graph").innerHTML = '<div class="error">Graph engine failed to load.</div>';
          return;
        }

        const elements = [
          ...model.map((domain) => ({
            data: {
              id: domain.id,
              label: graphLabel(domain),
              color: domain.color,
              border: stateColor(domain),
              weight: 1 + domain.presence.length + domain.claims.length + domain.failures.length * 2,
              state: domainState(domain)
            },
            classes: stateClass(domain),
            position: graphPosition(domain)
          })),
          ...state.presence.map((agent, index) => ({
            data: {
              id: "agent:" + agent.agent_id,
              label: agentIdentity(agent).symbol,
              color: agentColor(agent.agent_id),
              name: agent.agent_id,
              tool: agentIdentity(agent).label
            },
            classes: "agent " + agentIdentity(agent).className,
            position: agentPosition(agent, index)
          })),
          ...edges.map(([source, target]) => {
            const sourceDomain = model.find((domain) => domain.id === source);
            const targetDomain = model.find((domain) => domain.id === target);
            const active = Boolean(sourceDomain?.claims.length || sourceDomain?.failures.length || targetDomain?.claims.length || targetDomain?.failures.length);
            return {
              data: {
                id: source + "-" + target,
                source,
                target,
                width: active ? 2.4 : 1,
                color: active ? "#f59e0b" : "rgba(226,232,240,0.28)"
              },
              classes: active ? "hot-edge" : ""
            };
          }),
          ...state.presence.flatMap((agent) => agentDomains(agent).map((domainId) => ({
            data: {
              id: "agent-edge:" + agent.agent_id + ":" + domainId,
              source: "agent:" + agent.agent_id,
              target: domainId,
              color: agentColor(agent.agent_id),
              width: 2
            },
            classes: "agent-edge"
          })))
        ];

        if (!graph) {
          graph = cytoscape({
            container: el("graph"),
            elements,
            layout: { name: "preset", fit: true, padding: graphFitPadding() },
            minZoom: 0.45,
            maxZoom: 1.9,
            wheelSensitivity: 0.18,
            style: graphStyle()
          });
          graph.on("tap", "node", (event) => {
            const node = event.target;
            selectedGraphNodeId = node.id();
            node.connectedEdges().animate({ style: { lineColor: "#facc15", targetArrowColor: "#facc15", width: 5 } }, { duration: 160 });
            graph.animate({ center: { eles: node }, zoom: Math.max(graph.zoom(), 1.06) }, { duration: 220 });
          });
          return;
        }

        graph.batch(() => {
          graph.elements().remove();
          graph.add(elements);
          graph.layout({ name: "preset", fit: true, padding: graphFitPadding() }).run();
        });
      }

      function graphStyle() {
        return [
          {
            selector: "node",
            style: {
              "shape": "round-rectangle",
              "width": "mapData(weight, 1, 6, 112, 156)",
              "height": "mapData(weight, 1, 6, 58, 82)",
              "background-color": "#f8fafc",
              "background-opacity": 0.96,
              "border-width": 2,
              "border-color": "data(border)",
              "color": "#111827",
              "font-family": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
              "font-size": 9,
              "font-weight": 650,
              "label": "data(label)",
              "line-height": 1.25,
              "text-halign": "center",
              "text-valign": "center",
              "text-wrap": "wrap",
              "text-max-width": 104,
              "overlay-opacity": 0,
              "shadow-blur": 14,
              "shadow-color": "#000",
              "shadow-opacity": 0.18,
              "shadow-offset-x": 0,
              "shadow-offset-y": 7
            }
          },
          {
            selector: "node.agent",
            style: {
              "shape": "ellipse",
              "width": 34,
              "height": 34,
              "background-color": "data(color)",
              "border-width": 2,
              "border-color": "rgba(255,255,255,0.82)",
              "color": "#fff",
              "font-size": 10,
              "font-weight": 760,
              "label": "data(label)",
              "text-halign": "center",
              "text-valign": "center",
              "shadow-blur": 12,
              "shadow-color": "data(color)",
              "shadow-opacity": 0.28,
              "shadow-offset-x": 0,
              "shadow-offset-y": 5,
              "z-index": 8
            }
          },
          { selector: "node.agent-codex", style: { "shape": "round-diamond" } },
          { selector: "node.agent-cursor", style: { "shape": "ellipse" } },
          { selector: "node.agent-claude", style: { "shape": "hexagon" } },
          { selector: "node.agent-copilot", style: { "shape": "octagon" } },
          { selector: "node.agent-vscode", style: { "shape": "round-rectangle" } },
          { selector: "node.agent-terminal", style: { "shape": "tag" } },
          { selector: "node.fail", style: { "border-color": "#be123c", "shadow-color": "#be123c", "shadow-opacity": 0.34 } },
          { selector: "node.risk", style: { "border-color": "#b45309", "shadow-color": "#f59e0b", "shadow-opacity": 0.28 } },
          { selector: "node.info", style: { "border-color": "#2563eb", "shadow-color": "#2563eb", "shadow-opacity": 0.24 } },
          {
            selector: "edge",
            style: {
              "curve-style": "bezier",
              "line-color": "data(color)",
              "target-arrow-color": "data(color)",
              "target-arrow-shape": "triangle",
              "width": "data(width)",
              "opacity": 0.86
            }
          },
          { selector: "edge.hot-edge", style: { "z-index": 4 } },
          {
            selector: "edge.agent-edge",
            style: {
              "curve-style": "bezier",
              "line-style": "dashed",
              "line-dash-pattern": [7, 5],
              "line-color": "data(color)",
              "target-arrow-color": "data(color)",
              "target-arrow-shape": "none",
              "width": 1.4,
              "opacity": 0.64,
              "z-index": 7
            }
          }
        ];
      }

      function graphLabel(domain) {
        const claimWord = domain.claims.length === 1 ? "claim" : "claims";
        return domain.name + "\\n" + domain.presence.length + "a / " + domain.claims.length + " " + claimWord + "\\n" + domainState(domain);
      }

      function graphPosition(domain) {
        if (window.innerWidth < 860) {
          const index = domains.findIndex((item) => item.id === domain.id);
          return { x: index % 2 === 0 ? 140 : 360, y: 95 + Math.floor(index / 2) * 145 };
        }
        return { x: domain.x * 10, y: domain.y * 6.2 };
      }

      function agentPosition(agent, index) {
        const touched = domains.find((domain) => touchesDomain(domain, [
          ...(agent.current_files ?? []), agent.task ?? "", agent.branch ?? ""
        ]));
        const base = touched ? graphPosition(touched) : { x: 510, y: 315 };
        const angle = (index * 137.5) * Math.PI / 180;
        const radius = window.innerWidth < 860 ? 58 : 82;
        return {
          x: base.x + Math.cos(angle) * radius,
          y: base.y + Math.sin(angle) * radius
        };
      }

      function agentDomains(agent) {
        const matched = domains
          .filter((domain) => touchesDomain(domain, [...(agent.current_files ?? []), agent.task ?? "", agent.branch ?? ""]))
          .map((domain) => domain.id);
        return matched.length > 0 ? matched : ["api"];
      }

      function stateColor(domain) {
        if (domain.failures.length > 0) return "#be123c";
        if (domain.claims.length > 0) return "#b45309";
        if (domain.presence.length > 0) return "#2563eb";
        if (domain.decisions.length > 0) return "#4f46e5";
        return domain.color;
      }

      function renderAgents() {
        const root = el("agents");
        root.innerHTML = "";
        if (state.presence.length === 0) {
          root.innerHTML = '<div class="empty">No active agents.</div>';
          return;
        }
        for (const agent of state.presence) {
          const identity = agentIdentity(agent);
          root.appendChild(card([
            '<div class="row"><div class="row"><span class="avatar" title="' + escapeHtml(identity.label) + '" style="background:' + agentColor(agent.agent_id) + '"><i class="icon" data-lucide="' + identity.icon + '"></i></span><div><div class="title">' + escapeHtml(agent.agent_id) + '</div><div class="muted label-icon"><i class="icon" data-lucide="' + identity.icon + '"></i>' + escapeHtml(identity.label) + ' / ' + escapeHtml(text(agent.branch)) + '</div></div></div><span class="badge live"><i class="icon" data-lucide="circle-dot"></i>' + escapeHtml(agent.status) + '</span></div>',
            '<div class="muted label-icon"><i class="icon" data-lucide="route"></i>' + escapeHtml(truncate(text(agent.task), 56)) + '</div>',
            files(agent.current_files)
          ]));
        }
      }

      function renderRadar(model) {
        const root = el("radar");
        root.innerHTML = "";
        const risky = model.filter((domain) => domain.claims.length > 0 || domain.failures.length > 0)
          .sort((a, b) => (b.failures.length * 3 + b.claims.length) - (a.failures.length * 3 + a.claims.length));
        if (risky.length === 0) {
          root.innerHTML = '<div class="empty">No active risk zones.</div>';
          return;
        }
        for (const domain of risky) {
          const riskIcon = domain.failures.length > 0 ? "triangle-alert" : "lock-keyhole";
          root.appendChild(card([
            '<div class="row"><div class="title label-icon"><i class="icon" data-lucide="' + riskIcon + '"></i>' + domain.name + '</div><span class="badge ' + (domain.failures.length > 0 ? "fail" : "risk") + '"><i class="icon" data-lucide="' + riskIcon + '"></i>' + (domain.failures.length > 0 ? "failing" : "claimed") + '</span></div>',
            '<div class="muted">' + domain.claims.length + ' claims / ' + domain.failures.length + ' failures / ' + domain.events.length + ' events</div>',
            files(domain.claims.flatMap((claim) => claim.scope?.paths ?? []))
          ]));
        }
      }

      function renderTimeline() {
        const root = el("timeline");
        root.innerHTML = "";
        if (state.events.length === 0) {
          root.innerHTML = '<div class="empty">No timeline events yet.</div>';
          return;
        }
        for (const event of [...state.events].reverse().slice(0, 7)) {
          root.appendChild(card([
            '<div class="row"><div class="title label-icon"><i class="icon" data-lucide="activity"></i>' + escapeHtml(truncate(event.summary, 48)) + '</div><span class="badge"><i class="icon" data-lucide="zap"></i>' + escapeHtml(event.event_type) + '</span></div>',
            '<div class="muted label-icon"><i class="icon" data-lucide="bot"></i>' + escapeHtml(event.agent_id) + ' / ' + escapeHtml(event.created_at) + '</div>',
            files([...(event.affected_paths ?? []), ...(event.affected_apis ?? [])])
          ]));
        }
      }

      function renderDecisions() {
        const root = el("decisions");
        root.innerHTML = "";
        if (state.decisions.length === 0) {
          root.innerHTML = '<div class="empty">No decisions recorded.</div>';
          return;
        }
        for (const decision of state.decisions) {
          root.appendChild(card([
            '<div class="row"><div class="title label-icon"><i class="icon" data-lucide="scroll-text"></i>' + escapeHtml(decision.title) + '</div><span class="badge live"><i class="icon" data-lucide="check"></i>' + escapeHtml(decision.status) + '</span></div>',
            '<div class="muted label-icon"><i class="icon" data-lucide="gauge"></i>confidence: ' + escapeHtml(decision.confidence) + '</div>',
            files(decision.evidence)
          ]));
        }
      }

      function domainState(domain) {
        if (domain.failures.length > 0) return "failing";
        if (domain.claims.length > 0) return "claimed";
        if (domain.presence.length > 0) return "active";
        if (domain.decisions.length > 0) return "decision";
        return "clear";
      }

      function stateClass(domain) {
        if (domain.failures.length > 0) return "fail";
        if (domain.claims.length > 0) return "risk";
        if (domain.presence.length > 0) return "info";
        if (domain.decisions.length > 0) return "live";
        return "";
      }

      function agentIdentity(agent) {
        const raw = [agent.agent_id, agent.tool, agent.task, agent.branch].map(text).join(" ").toLowerCase();
        if (raw.includes("codex")) {
          return { className: "agent-codex", icon: "sparkles", label: "Codex", symbol: "Cx" };
        }
        if (raw.includes("cursor")) {
          return { className: "agent-cursor", icon: "mouse-pointer-2", label: "Cursor", symbol: "Cu" };
        }
        if (raw.includes("claude")) {
          return { className: "agent-claude", icon: "brain-circuit", label: "Claude", symbol: "Cl" };
        }
        if (raw.includes("copilot") || raw.includes("github")) {
          return { className: "agent-copilot", icon: "github", label: "GitHub Copilot", symbol: "Gh" };
        }
        if (raw.includes("vscode") || raw.includes("vs code") || raw.includes("codeium") || raw.includes("windsurf")) {
          return { className: "agent-vscode", icon: "code-2", label: "Code Editor Agent", symbol: "Ed" };
        }
        if (raw.includes("terminal") || raw.includes("cli") || raw.includes("shell")) {
          return { className: "agent-terminal", icon: "terminal", label: "Terminal Agent", symbol: "Sh" };
        }
        return { className: "agent-bot", icon: "bot", label: text(agent.tool), symbol: initials(agent.agent_id).slice(0, 2) };
      }

      function agentColor(agentId) {
        let hash = 0;
        for (let index = 0; index < agentId.length; index += 1) hash = (hash * 31 + agentId.charCodeAt(index)) >>> 0;
        return agentPalette[hash % agentPalette.length];
      }

      function initials(value) {
        return String(value).split(/[-_\\s]/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
      }

      function truncate(value, maxLength) {
        const source = text(value);
        return source.length > maxLength ? source.slice(0, maxLength - 1) + "..." : source;
      }

      function files(values) {
        const safeValues = Array.isArray(values) ? values.filter(Boolean).slice(0, 4) : [];
        if (safeValues.length === 0) return '<div class="muted label-icon"><i class="icon" data-lucide="file-slash"></i>paths: none</div>';
        return '<div>' + safeValues.map((value) => '<code>' + escapeHtml(value) + '</code>').join(" ") + '</div>';
      }

      function card(children) {
        const node = document.createElement("article");
        node.className = "card";
        node.innerHTML = children.join("");
        return node;
      }

      function renderError(error) {
        for (const id of ["agents", "radar", "timeline", "decisions"]) {
          el(id).innerHTML = '<div class="error label-icon"><i class="icon" data-lucide="circle-alert"></i>Failed to load state: ' + escapeHtml(text(error.message)) + '</div>';
        }
        hydrateIcons();
      }

      function setStatus(label, active) {
        const badge = el("status");
        const icon = label === "error" ? "circle-alert" : active ? "wifi" : "loader-circle";
        badge.innerHTML = '<i class="icon" data-lucide="' + icon + '"></i>' + escapeHtml(label);
        badge.className = active ? "badge live" : label === "error" ? "badge fail" : "badge";
        hydrateIcons();
      }

      function escapeHtml(value) {
        return text(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
      }

      function hydrateIcons() {
        if (window.lucide?.createIcons) {
          window.lucide.createIcons({
            attrs: {
              "aria-hidden": "true",
              "class": "icon"
            }
          });
        }
      }

      el("refresh").addEventListener("click", () => void loadState());
      el("toggle-left-rail").addEventListener("click", () => toggleRail("left"));
      el("toggle-right-rail").addEventListener("click", () => toggleRail("right"));
      el("focus-layout").addEventListener("click", () => toggleFocusMode());
      el("select-graph").addEventListener("click", () => setCanvasMode("select"));
      el("pan-graph").addEventListener("click", () => setCanvasMode("pan"));
      el("zoom-out-graph").addEventListener("click", () => zoomGraph(0.84));
      el("zoom-in-graph").addEventListener("click", () => zoomGraph(1.18));
      el("fit-graph").addEventListener("click", () => graph?.animate({ fit: { eles: graph.elements(), padding: graphFitPadding() } }, { duration: 220 }));
      el("local-graph").addEventListener("click", () => {
        if (!graph) return;
        const selected = selectedGraphNodeId ? graph.getElementById(selectedGraphNodeId) : graph.nodes(".fail, .risk").first();
        const focus = selected.length > 0 ? selected.closedNeighborhood() : graph.elements();
        graph.animate({ fit: { eles: focus, padding: graphFitPadding() + 18 } }, { duration: 260 });
      });
      el("risk-graph").addEventListener("click", () => {
        if (!graph) return;
        const risky = graph.nodes(".fail, .risk");
        graph.animate({ fit: { eles: risky.length > 0 ? risky : graph.elements(), padding: graphFitPadding() } }, { duration: 260 });
      });
      window.addEventListener("resize", () => {
        if (!graph) return;
        const model = buildDomainModel();
        for (const domain of model) {
          graph.getElementById(domain.id).position(graphPosition(domain));
        }
        graph.fit(graph.elements(), graphFitPadding());
      });
      setCanvasMode("select");
      void loadState();
      setInterval(() => void loadState(), 5000);

      function toggleRail(side) {
        const shell = document.querySelector(".shell");
        shell.classList.remove("focus-mode");
        shell.classList.toggle(side + "-collapsed");
        syncLayoutControls();
        refitGraphSoon();
      }

      function toggleFocusMode() {
        const shell = document.querySelector(".shell");
        shell.classList.toggle("focus-mode");
        syncLayoutControls();
        refitGraphSoon();
      }

      function syncLayoutControls() {
        const shell = document.querySelector(".shell");
        const leftCollapsed = shell.classList.contains("left-collapsed") || shell.classList.contains("focus-mode");
        const rightCollapsed = shell.classList.contains("right-collapsed") || shell.classList.contains("focus-mode");
        const focus = shell.classList.contains("focus-mode");
        setIconButton("toggle-left-rail", leftCollapsed ? "panel-left-open" : "panel-left-close", leftCollapsed ? "Show left rail" : "Hide left rail");
        setIconButton("toggle-right-rail", rightCollapsed ? "panel-right-open" : "panel-right-close", rightCollapsed ? "Show right rail" : "Hide right rail");
        el("focus-layout").innerHTML = '<i class="icon" data-lucide="' + (focus ? "minimize-2" : "maximize-2") + '"></i>' + (focus ? "Exit focus" : "Focus");
        hydrateIcons();
      }

      function setIconButton(id, icon, title) {
        const button = el(id);
        button.title = title;
        button.innerHTML = '<i class="icon" data-lucide="' + icon + '"></i>';
      }

      function refitGraphSoon() {
        window.setTimeout(() => {
          graph?.resize();
          graph?.animate({ fit: { eles: graph.elements(), padding: graphFitPadding() } }, { duration: 180 });
        }, 80);
      }

      function graphFitPadding() {
        if (window.innerWidth < 860) return 48;
        return document.querySelector(".shell")?.classList.contains("focus-mode") ? 96 : 72;
      }

      function setCanvasMode(mode) {
        for (const id of ["select-graph", "pan-graph"]) {
          el(id).classList.toggle("active", id === mode + "-graph");
        }
        if (!graph) return;
        graph.autoungrabify(mode !== "select");
        graph.userPanningEnabled(true);
        graph.userZoomingEnabled(true);
      }

      function zoomGraph(factor) {
        if (!graph) return;
        graph.animate({
          zoom: Math.max(graph.minZoom(), Math.min(graph.maxZoom(), graph.zoom() * factor)),
          center: { eles: graph.elements() }
        }, { duration: 160 });
      }
    </script>
  </body>
</html>`;
}
