import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type Viewport
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  Bot,
  CheckCheck,
  Code2,
  Crosshair,
  Copy,
  Gauge,
  GitBranch,
  HardDrive,
  Link2,
  LockKeyhole,
  Maximize2,
  Minimize2,
  MousePointer2,
  Network,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RadioTower,
  RefreshCw,
  Route,
  Scan,
  Sparkles,
  Terminal,
  TriangleAlert,
  UnlockKeyhole,
  Users,
  Waypoints,
  Wifi,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import "./styles.css";

type SukaState = {
  presence: PresencePointer[];
  claims: ClaimPointer[];
  events: EventPointer[];
  decisions: DecisionPointer[];
};

type PresencePointer = {
  id?: string;
  agent_id: string;
  user_id?: string;
  tool: string;
  status: string;
  branch?: string;
  task?: string;
  current_files?: string[];
  last_seen?: string;
  repo_id?: string;
  session_id?: string;
  workspace_id?: string;
};

type ClaimPointer = {
  id: string;
  agent_id: string;
  reason: string;
  scope: Scope;
  expires_at?: string;
};

type EventPointer = {
  agent_id: string;
  event_type: string;
  summary: string;
  created_at: string;
  affected_paths?: string[];
  affected_apis?: string[];
};

type DecisionPointer = {
  title: string;
  status: string;
  confidence?: string;
  evidence?: string[];
  scope?: Scope;
};

type Scope = {
  paths?: string[];
  apis?: string[];
  tables?: string[];
  env?: string[];
  domains?: string[];
};

type Domain = {
  id: string;
  name: string;
  color: string;
  directory_count?: number;
  file_count?: number;
  kind?: string;
  path?: string;
  x: number;
  y: number;
  keys: string[];
};

type RepoMapEdge = {
  id: string;
  source: string;
  target: string;
};

type RepoMap = {
  domains: Domain[];
  edges: RepoMapEdge[];
  generated_at?: string;
  root?: string;
};

type DomainModel = Domain & {
  claims: ClaimPointer[];
  decisions: DecisionPointer[];
  events: EventPointer[];
  failures: EventPointer[];
  presence: PresencePointer[];
};

type ConflictInsight = {
  id: string;
  severity: "high" | "medium" | "low";
  message: string;
  agent_id: string;
  claim: ClaimPointer;
  paths: string[];
};

type TeamConnection = {
  mode: "local" | "team";
  workspaceName: string;
  inviteToken: string;
};

type TeamConnectionSummary = {
  mode: "local" | "scoped";
  active_agents: number;
  generated_at: string;
  members: PresencePointer[];
  workspaces: TeamWorkspaceSummary[];
};

type TeamWorkspaceSummary = {
  workspace_id: string;
  repo_ids: string[];
  session_ids: string[];
  active_agents: number;
  claims: number;
  events: number;
  decisions: number;
};

type SessionRoom = {
  id: string;
  workspace_id: string;
  repo_id: string;
  session_id: string;
  members: PresencePointer[];
  latestTask?: string;
};

const emptyState: SukaState = {
  claims: [],
  decisions: [],
  events: [],
  presence: []
};

const fallbackDomains: Domain[] = [
  { id: "auth", name: "Auth", color: "#14b8a6", path: "auth", x: 120, y: 120, keys: ["auth", "session", "login", "oauth"] },
  { id: "api", name: "API", color: "#3b82f6", path: "api", x: 360, y: 84, keys: ["api", "route", "server", "endpoint"] },
  { id: "billing", name: "Billing", color: "#e11d48", path: "billing", x: 640, y: 160, keys: ["billing", "payment", "stripe", "invoice", "webhook"] },
  { id: "ui", name: "UI", color: "#f97316", path: "ui", x: 180, y: 345, keys: ["app", "ui", "component", "page", "view"] },
  { id: "checkout", name: "Checkout", color: "#f59e0b", path: "checkout", x: 455, y: 315, keys: ["checkout", "cart", "payment-client"] },
  { id: "database", name: "Database", color: "#22c55e", path: "database", x: 690, y: 410, keys: ["db", "database", "migration", "schema", "table"] },
  { id: "tests", name: "Tests", color: "#e11d48", path: "tests", x: 360, y: 525, keys: ["test", "spec", "__tests__"] },
  { id: "infra", name: "Infra", color: "#94a3b8", path: "infra", x: 105, y: 540, keys: ["infra", "deploy", "docker", "ci", "env"] }
];

const graphEdges = [
  ["auth", "api"],
  ["api", "billing"],
  ["billing", "checkout"],
  ["checkout", "ui"],
  ["checkout", "database"],
  ["database", "tests"],
  ["ui", "tests"],
  ["infra", "tests"],
  ["infra", "api"]
] as const;

const agentPalette = ["#0f766e", "#2563eb", "#7c3aed", "#16803c", "#b45309", "#be123c", "#0e7490"];
const storagePrefix = "suka.dashboard.";
const defaultTeamConnection: TeamConnection = {
  inviteToken: "",
  mode: "local",
  workspaceName: "Local workspace"
};

const emptyTeamSummary: TeamConnectionSummary = {
  active_agents: 0,
  generated_at: "",
  members: [],
  mode: "local",
  workspaces: []
};

type SelectedDetails =
  | { kind: "agent"; agent: PresencePointer }
  | { kind: "domain"; domain: DomainModel }
  | undefined;

function Dashboard(): React.ReactElement {
  const [state, setState] = useState<SukaState>(emptyState);
  const [repoMap, setRepoMap] = useState<RepoMap>({ domains: fallbackDomains, edges: [] });
  const [status, setStatus] = useState("connecting");
  const [leftOpen, setLeftOpen] = useState(() => readStoredBoolean("leftOpen", true));
  const [rightOpen, setRightOpen] = useState(() => readStoredBoolean("rightOpen", true));
  const [focusMode, setFocusMode] = useState(() => readStoredBoolean("focusMode", false));
  const [selectedNodeId, setSelectedNodeId] = useState(() => readStoredString("selectedNodeId"));
  const [releasingClaimId, setReleasingClaimId] = useState("");
  const [dismissedInsightIds, setDismissedInsightIds] = useState<Set<string>>(() => new Set());
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [teamConnection, setTeamConnection] = useState<TeamConnection>(() => readStoredTeamConnection());
  const [teamSummary, setTeamSummary] = useState<TeamConnectionSummary>(emptyTeamSummary);
  const viewportRestored = useRef(false);
  const { fitView, setViewport, zoomIn, zoomOut } = useReactFlow();

  const loadState = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json() as { data: SukaState };
      setState(payload.data);
      setStatus("connected");
    } catch {
      setStatus("error");
    }
  }, []);

  const loadRepoMap = useCallback(async () => {
    try {
      const response = await fetch("/api/repo-map", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { data: RepoMap };
      if (payload.data.domains.length > 0) {
        setRepoMap(payload.data);
      }
    } catch {
      setRepoMap((current) => current);
    }
  }, []);

  const loadTeamSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/team", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { data: TeamConnectionSummary };
      setTeamSummary(payload.data);
    } catch {
      setTeamSummary((current) => current);
    }
  }, []);

  useEffect(() => {
    void loadState();
    const timer = window.setInterval(() => void loadState(), 5000);
    return () => window.clearInterval(timer);
  }, [loadState]);

  useEffect(() => {
    void loadRepoMap();
    const timer = window.setInterval(() => void loadRepoMap(), 30000);
    return () => window.clearInterval(timer);
  }, [loadRepoMap]);

  useEffect(() => {
    void loadTeamSummary();
    const timer = window.setInterval(() => void loadTeamSummary(), 5000);
    return () => window.clearInterval(timer);
  }, [loadTeamSummary]);

  const domainCatalog = repoMap.domains.length > 0 ? repoMap.domains : fallbackDomains;
  const model = useMemo(() => buildDomainModel(state, domainCatalog), [domainCatalog, state]);
  const { edges, nodes } = useMemo(() => buildFlow(model, state, selectedNodeId, repoMap.edges), [model, repoMap.edges, selectedNodeId, state]);
  const conflictInsights = useMemo(() => buildConflictInsights(state), [state]);
  const visibleConflictInsights = useMemo(
    () => conflictInsights.filter((insight) => !dismissedInsightIds.has(insight.id)),
    [conflictInsights, dismissedInsightIds]
  );
  const riskCount = visibleConflictInsights.length + model.filter((item) => item.failures.length > 0).length;
  const selectedDetails = useMemo(() => resolveSelection(selectedNodeId, model, state), [model, selectedNodeId, state]);

  const releaseClaim = useCallback(async (claimId: string) => {
    setReleasingClaimId(claimId);
    try {
      const response = await fetch(`/api/claims/${encodeURIComponent(claimId)}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setState((current) => ({
        ...current,
        claims: current.claims.filter((claim) => claim.id !== claimId)
      }));
      void loadState();
      void loadTeamSummary();
    } catch {
      setStatus("error");
    } finally {
      setReleasingClaimId("");
    }
  }, [loadState, loadTeamSummary]);

  const createClaim = useCallback(async (input: { agent_id: string; reason: string; scope: Scope }) => {
    const now = new Date();
    const activeWorkspace = teamSummary.workspaces[0];
    const pointer = {
      agent_id: input.agent_id,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 45 * 60_000).toISOString(),
      id: `claim-${now.getTime()}-${slug(input.agent_id)}`,
      kind: "soft_claim",
      reason: input.reason,
      repo_id: activeWorkspace?.repo_ids[0],
      scope: input.scope,
      session_id: activeWorkspace?.session_ids[0],
      type: "claim",
      workspace_id: activeWorkspace?.workspace_id === "local" ? undefined : activeWorkspace?.workspace_id
    };
    try {
      const response = await fetch("/api/pointers", {
        body: JSON.stringify(pointer),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json() as { data: ClaimPointer };
      setState((current) => ({
        ...current,
        claims: [...current.claims.filter((claim) => claim.id !== payload.data.id), payload.data]
      }));
      void loadState();
      void loadTeamSummary();
    } catch {
      setStatus("error");
    }
  }, [loadState, loadTeamSummary, teamSummary.workspaces]);

  const acknowledgeInsight = useCallback((insightId: string) => {
    setDismissedInsightIds((current) => new Set(current).add(insightId));
  }, []);

  const toggleTeamPanel = useCallback(() => {
    setTeamPanelOpen((open) => {
      if (!open && teamConnection.inviteToken.length === 0) {
        setTeamConnection((current) => current.inviteToken.length > 0
          ? current
          : { ...current, inviteToken: createInviteToken(repoMap.root ?? "workspace") });
      }
      return !open;
    });
  }, [repoMap.root, teamConnection.inviteToken.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => fitView({ duration: 180, padding: focusMode ? 0.18 : 0.12 }), 80);
    return () => window.clearTimeout(timer);
  }, [fitView, focusMode, leftOpen, rightOpen]);

  useEffect(() => {
    writeStoredBoolean("leftOpen", leftOpen);
    writeStoredBoolean("rightOpen", rightOpen);
    writeStoredBoolean("focusMode", focusMode);
  }, [focusMode, leftOpen, rightOpen]);

  useEffect(() => {
    writeStoredString("selectedNodeId", selectedNodeId);
  }, [selectedNodeId]);

  useEffect(() => {
    writeStoredTeamConnection(teamConnection);
  }, [teamConnection]);

  useEffect(() => {
    if (viewportRestored.current || nodes.length === 0) return;
    viewportRestored.current = true;
    const viewport = readStoredViewport();
    if (viewport) {
      void setViewport(viewport, { duration: 0 });
    }
  }, [nodes.length, setViewport]);

  const shellClass = [
    "app-shell",
    !leftOpen ? "left-collapsed" : "",
    !rightOpen ? "right-collapsed" : "",
    focusMode ? "focus-mode" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className="suka-app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Waypoints size={16} /></div>
          <div>
            <h1>Suka Operations Canvas</h1>
            <p>Realtime coordination graph for agentic code work</p>
          </div>
        </div>
        <div className="top-actions">
          <Badge tone="info" icon={<HardDrive size={13} />}>local workspace</Badge>
          <Badge tone={teamSummary.active_agents > 0 ? "live" : "neutral"} icon={<Users size={13} />}>
            {teamSummary.active_agents > 0 ? `${teamSummary.active_agents} active` : "local only"}
          </Badge>
          <Badge tone={status === "connected" ? "live" : status === "error" ? "fail" : "neutral"} icon={<Wifi size={13} />}>{status}</Badge>
          <button type="button" onClick={toggleTeamPanel}>
            <Link2 size={14} />
            Team
          </button>
          <button type="button" onClick={() => setFocusMode((value) => !value)}>
            {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {focusMode ? "Exit focus" : "Focus"}
          </button>
          <button type="button" onClick={() => void loadState()}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        {teamPanelOpen ? (
          <TeamConnectionPanel
            agents={state.presence}
            connection={teamConnection}
            repoName={repoMap.root ?? "workspace"}
            serverStatus={status}
            summary={teamSummary}
            onClose={() => setTeamPanelOpen(false)}
            onUpdate={setTeamConnection}
          />
        ) : null}
      </header>

      <main className={shellClass}>
        <aside className="rail left-rail">
          <RailHeader
            count={state.presence.length}
            icon={<Users size={14} />}
            onToggle={() => setLeftOpen((value) => !value)}
            open={leftOpen}
            title="Agents"
            toggleIcon={leftOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          />
          {leftOpen ? (
            <div className="rail-body">
              {state.presence.length === 0
                ? <p className="empty">No active agents.</p>
                : state.presence.map((agent) => (
                  <AgentCard agent={agent} key={agent.agent_id} />
                ))}
            </div>
          ) : <IconRail agents={state.presence} />}
        </aside>

        <section className="canvas-shell">
          <div className="canvas-header">
            <div>
              <h2><Network size={14} /> Repo Domain Map</h2>
              <span>{repoMap.root ?? "workspace"} / {domainCatalog.length} areas</span>
            </div>
            <div className="metrics">
              <Metric icon={<Bot size={13} />} label="agents" value={state.presence.length} />
              <Metric icon={<LockKeyhole size={13} />} label="claims" value={state.claims.length} />
              <Metric icon={<Activity size={13} />} label="events" value={state.events.length} />
              <Metric icon={<CheckCheck size={13} />} label="decisions" value={state.decisions.length} />
            </div>
          </div>
          <div className="flow-wrap">
            {!leftOpen ? (
              <button
                aria-label="Show agents sidebar"
                className="canvas-rail-toggle left"
                title="Show agents sidebar"
                type="button"
                onClick={() => setLeftOpen(true)}
              >
                <PanelLeftOpen size={15} />
              </button>
            ) : null}
            {!rightOpen ? (
              <button
                aria-label="Show radar sidebar"
                className="canvas-rail-toggle right"
                title="Show radar sidebar"
                type="button"
                onClick={() => setRightOpen(true)}
              >
                <PanelRightOpen size={15} />
              </button>
            ) : null}
            <ReactFlow
              edges={edges}
              fitView
              minZoom={0.35}
              maxZoom={1.8}
              nodeTypes={{ agent: AgentNode, domain: DomainNode }}
              nodes={nodes}
              onMoveEnd={(_, viewport) => writeStoredViewport(viewport)}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId("")}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="rgba(226,232,240,0.12)" gap={28} />
              <MiniMap maskColor="rgba(15, 23, 42, 0.78)" nodeStrokeWidth={2} pannable zoomable />
              <Controls showInteractive={false} />
            </ReactFlow>
            <div className="canvas-toolbar">
              <button aria-label="Select" title="Select" type="button"><MousePointer2 size={14} />Select</button>
              <button aria-label="Zoom out" title="Zoom out" type="button" onClick={() => zoomOut({ duration: 160 })}><ZoomOut size={14} />Out</button>
              <button aria-label="Zoom in" title="Zoom in" type="button" onClick={() => zoomIn({ duration: 160 })}><ZoomIn size={14} />In</button>
              <button aria-label="Fit graph" title="Fit graph" type="button" onClick={() => fitView({ duration: 200, padding: 0.16 })}><Scan size={14} />Fit</button>
              <button aria-label="Focus local neighborhood" title="Focus local neighborhood" type="button" onClick={() => fitView({ duration: 220, nodes: localFocusNodes(nodes, edges, selectedNodeId), padding: 0.28 })}><Orbit size={14} />Local</button>
              <button aria-label="Focus risk" title="Focus risk" type="button" onClick={() => fitView({ duration: 220, nodes: nodes.filter((node) => node.data.state === "failing" || node.data.state === "claimed"), padding: 0.24 })}><Crosshair size={14} />Risk</button>
            </div>
          </div>
          <div className="canvas-footer">
            <span><i className="dot blue" /> active work</span>
            <span><i className="dot amber" /> claimed scope</span>
            <span><i className="dot rose" /> failing signal</span>
            <span><i className="dot violet" /> decision attached</span>
          </div>
        </section>

        <aside className="rail right-rail">
          <RailHeader
            count={riskCount}
            icon={<Gauge size={14} />}
            onToggle={() => setRightOpen((value) => !value)}
            open={rightOpen}
            title="Radar"
            toggleIcon={rightOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            tone="risk"
          />
          {rightOpen ? (
            <div className="right-stack">
              <SelectionInspector
                defaultAgentId={state.presence[0]?.agent_id ?? "local-agent"}
                onCreateClaim={createClaim}
                onReleaseClaim={releaseClaim}
                releasingClaimId={releasingClaimId}
                selection={selectedDetails}
              />
              <RiskQueue
                insights={visibleConflictInsights}
                model={model}
                onAcknowledgeInsight={acknowledgeInsight}
                onReleaseClaim={releaseClaim}
                releasingClaimId={releasingClaimId}
              />
              <ActivityStream events={state.events} />
            </div>
          ) : <CompactRisk count={riskCount} />}
        </aside>
      </main>
    </div>
  );
}

function TeamConnectionPanel({
  agents,
  connection,
  onClose,
  onUpdate,
  repoName,
  serverStatus,
  summary
}: {
  agents: PresencePointer[];
  connection: TeamConnection;
  onClose(): void;
  onUpdate(value: TeamConnection): void;
  repoName: string;
  serverStatus: string;
  summary: TeamConnectionSummary;
}): React.ReactElement {
  const connected = connection.mode === "team";
  const inviteToken = connection.inviteToken;
  const inviteLink = `suka://join/${inviteToken}`;
  const teammates = summary.members.length > 0 ? summary.members : agents.length > 0 ? agents : [{
    agent_id: "local-agent",
    current_files: [],
    status: "offline",
    tool: "terminal"
  }];
  const primaryWorkspace = summary.workspaces[0];
  const sessionRooms = buildSessionRooms(summary.members.length > 0 ? summary.members : agents);

  return (
    <section className="team-panel" aria-label="Team connection">
      <div className="team-panel-head">
        <div>
          <h2><Users size={14} /> Team Connection</h2>
          <p>{connected ? connection.workspaceName : "Local-only coordination"}</p>
        </div>
        <Badge tone={connected ? "live" : "neutral"} icon={<Wifi size={13} />}>{connected ? "team" : "local"}</Badge>
      </div>
      <div className="team-mode-grid">
        <button
          className={!connected ? "mode-option active" : "mode-option"}
          type="button"
          onClick={() => onUpdate({ ...connection, mode: "local" })}
        >
          <HardDrive size={14} />
          <span>Local</span>
        </button>
        <button
          className={connected ? "mode-option active" : "mode-option"}
          type="button"
          onClick={() => onUpdate({
            inviteToken,
            mode: "team",
            workspaceName: connection.workspaceName === "Local workspace" ? `${displayName(repoName)} team` : connection.workspaceName
          })}
        >
          <Users size={14} />
          <span>Team</span>
        </button>
      </div>
      <label className="team-field">
        <span>workspace</span>
        <input
          value={connection.workspaceName}
          onChange={(event) => onUpdate({ ...connection, workspaceName: event.target.value })}
        />
      </label>
      <div className="invite-box">
        <div>
          <span>invite token</span>
          <code>{inviteLink}</code>
        </div>
        <button
          type="button"
          onClick={() => void copyText(inviteLink)}
        >
          <Copy size={13} />
          Copy
        </button>
      </div>
      <div className="team-health">
        <span><i className={`dot ${serverStatus === "connected" ? "blue" : "amber"}`} /> {serverStatus}</span>
        <span>{summary.active_agents} live agents</span>
        <span>{summary.workspaces.length || 1} workspace</span>
      </div>
      <div className="workspace-strip">
        <div>
          <span>workspace</span>
          <strong>{primaryWorkspace?.workspace_id ?? "local"}</strong>
        </div>
        <div>
          <span>repos</span>
          <strong>{primaryWorkspace?.repo_ids.length ?? 0}</strong>
        </div>
        <div>
          <span>sessions</span>
          <strong>{primaryWorkspace?.session_ids.length ?? 0}</strong>
        </div>
      </div>
      <div className="session-room-list">
        <div className="session-room-head">
          <h3><RadioTower size={13} /> Session Rooms</h3>
          <span>{sessionRooms.length} active</span>
        </div>
        {sessionRooms.length === 0 ? (
          <p className="empty">No scoped sessions yet.</p>
        ) : sessionRooms.slice(0, 5).map((room) => (
          <div className="session-room" key={room.id}>
            <div className="session-room-title">
              <strong>{room.session_id}</strong>
              <Badge tone="info" icon={<Users size={12} />}>{room.members.length}</Badge>
            </div>
            <p>{room.workspace_id} / {room.repo_id}</p>
            {room.latestTask !== undefined ? <span>{room.latestTask}</span> : null}
          </div>
        ))}
      </div>
      <div className="teammate-list">
        {teammates.slice(0, 4).map((agent) => {
          const identity = agentIdentity(agent);
          const Icon = identity.icon;
          return (
            <div className="teammate-row" key={agent.agent_id}>
              <span className="agent-avatar" style={{ background: agentColor(agent.agent_id) }}><Icon size={13} /></span>
              <div>
                <strong>{agent.agent_id}</strong>
                <p>{identity.label} / {agent.status}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card-actions">
        <button type="button" onClick={() => onUpdate({ ...connection, inviteToken: createInviteToken(repoName) })}>
          <RefreshCw size={13} />
          Rotate
        </button>
        <button type="button" onClick={onClose}>
          <CheckCheck size={13} />
          Done
        </button>
      </div>
    </section>
  );
}

function buildSessionRooms(members: PresencePointer[]): SessionRoom[] {
  const rooms = new Map<string, SessionRoom>();

  for (const member of members) {
    const workspaceId = member.workspace_id ?? "local";
    const repoId = member.repo_id ?? "local-repo";
    const sessionId = member.session_id ?? "local-session";
    const id = `${workspaceId}:${repoId}:${sessionId}`;
    const room = rooms.get(id) ?? {
      id,
      members: [],
      repo_id: repoId,
      session_id: sessionId,
      workspace_id: workspaceId
    };
    room.members.push(member);
    if (member.task !== undefined && member.task.length > 0) {
      room.latestTask = member.task;
    }
    rooms.set(id, room);
  }

  return [...rooms.values()].sort((left, right) => {
    if (right.members.length !== left.members.length) return right.members.length - left.members.length;
    return left.session_id.localeCompare(right.session_id);
  });
}

function DomainNode({ data }: any): React.ReactElement {
  return (
    <div className={`domain-node ${data.state}`} style={{ "--node-color": data.color } as React.CSSProperties}>
      <Handle position={Position.Left} type="target" />
      <div className="node-title">{data.label}</div>
      <div className="node-meta">{data.meta}</div>
      <div className="node-state">{data.state}</div>
      <Handle position={Position.Right} type="source" />
    </div>
  );
}

function AgentNode({ data }: any): React.ReactElement {
  return (
    <div className="agent-node" style={{ "--agent-color": data.color } as React.CSSProperties}>
      <Handle position={Position.Left} type="target" />
      <span>{data.symbol}</span>
      <Handle position={Position.Right} type="source" />
    </div>
  );
}

function Badge({ children, icon, tone }: { children: React.ReactNode; icon: React.ReactNode; tone: string }): React.ReactElement {
  return <span className={`badge ${tone}`}>{icon}{children}</span>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }): React.ReactElement {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{icon}{label}</span>
    </div>
  );
}

function RailHeader(props: {
  count: number;
  icon: React.ReactNode;
  onToggle(): void;
  open: boolean;
  title: string;
  toggleIcon: React.ReactNode;
  tone?: string;
}): React.ReactElement {
  return (
    <div className="rail-header">
      <h2>{props.icon}{props.title}</h2>
      <Badge tone={props.tone ?? "live"} icon={<Bot size={13} />}>{props.count}</Badge>
      <button aria-label={props.open ? "Collapse rail" : "Expand rail"} type="button" onClick={props.onToggle}>{props.toggleIcon}</button>
    </div>
  );
}

function AgentCard({ agent }: { agent: PresencePointer }): React.ReactElement {
  const identity = agentIdentity(agent);
  const Icon = identity.icon;
  return (
    <article className="agent-card">
      <div className="agent-top">
        <span className="agent-avatar" style={{ background: agentColor(agent.agent_id) }}><Icon size={14} /></span>
        <div>
          <h3>{agent.agent_id}</h3>
          <p>{identity.label} / {agent.branch ?? "none"}</p>
        </div>
        <Badge tone="live" icon={<Activity size={13} />}>{agent.status}</Badge>
      </div>
      <p className="task"><Route size={13} />{truncate(agent.task ?? "none", 58)}</p>
      <PathList paths={agent.current_files ?? []} />
    </article>
  );
}

function IconRail({ agents }: { agents: PresencePointer[] }): React.ReactElement {
  return (
    <div className="icon-rail">
      {agents.map((agent) => {
        const Icon = agentIdentity(agent).icon;
        return <span className="agent-avatar" key={agent.agent_id} style={{ background: agentColor(agent.agent_id) }}><Icon size={15} /></span>;
      })}
    </div>
  );
}

function CompactRisk({ count }: { count: number }): React.ReactElement {
  return <div className="compact-risk"><TriangleAlert size={18} /><span>{count}</span></div>;
}

function SelectionInspector({
  defaultAgentId,
  onCreateClaim,
  onReleaseClaim,
  releasingClaimId,
  selection
}: {
  defaultAgentId: string;
  onCreateClaim(input: { agent_id: string; reason: string; scope: Scope }): Promise<void>;
  onReleaseClaim(claimId: string): void;
  releasingClaimId: string;
  selection: SelectedDetails;
}): React.ReactElement {
  if (!selection) {
    return (
      <section className="rail-section inspector-section">
        <h2><MousePointer2 size={14} /> Inspector</h2>
        <p className="empty">Select a domain or agent on the canvas.</p>
      </section>
    );
  }

  if (selection.kind === "agent") {
    const identity = agentIdentity(selection.agent);
    const Icon = identity.icon;
    return (
      <section className="rail-section inspector-section">
        <h2><Icon size={14} /> {selection.agent.agent_id}</h2>
        <div className="inspector-grid">
          <span>tool</span><strong>{identity.label}</strong>
          <span>status</span><strong>{selection.agent.status}</strong>
          <span>branch</span><strong>{selection.agent.branch ?? "none"}</strong>
        </div>
        <p className="task"><Route size={13} />{truncate(selection.agent.task ?? "none", 72)}</p>
        <PathList paths={selection.agent.current_files ?? []} />
      </section>
    );
  }

  const domain = selection.domain;
  return (
    <section className="rail-section inspector-section">
      <h2><Network size={14} /> {domain.name}</h2>
      <div className="inspector-grid">
        <span>state</span><strong>{domainState(domain)}</strong>
        <span>path</span><strong>{domain.path ?? domain.id}</strong>
        <span>kind</span><strong>{domain.kind ?? "domain"}</strong>
        <span>files</span><strong>{domain.file_count ?? 0}</strong>
        <span>agents</span><strong>{domain.presence.length}</strong>
        <span>claims</span><strong>{domain.claims.length}</strong>
        <span>events</span><strong>{domain.events.length}</strong>
      </div>
      <PathList paths={domain.claims.flatMap((claim) => claim.scope?.paths ?? [])} />
      <CreateClaimForm defaultAgentId={defaultAgentId} domain={domain} onCreateClaim={onCreateClaim} />
      <ClaimList claims={domain.claims} onReleaseClaim={onReleaseClaim} releasingClaimId={releasingClaimId} />
    </section>
  );
}

function CreateClaimForm({
  defaultAgentId,
  domain,
  onCreateClaim
}: {
  defaultAgentId: string;
  domain: DomainModel;
  onCreateClaim(input: { agent_id: string; reason: string; scope: Scope }): Promise<void>;
}): React.ReactElement {
  const [agentId, setAgentId] = useState(defaultAgentId);
  const [busy, setBusy] = useState(false);
  const path = domain.path ?? domain.id;
  const reason = `Claim ${domain.name}`;

  useEffect(() => {
    setAgentId(defaultAgentId);
  }, [defaultAgentId]);

  return (
    <form
      className="claim-form"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void onCreateClaim({
          agent_id: agentId.trim() || defaultAgentId,
          reason,
          scope: {
            domains: [domain.id],
            paths: [path]
          }
        }).finally(() => setBusy(false));
      }}
    >
      <label>
        <span>claim as</span>
        <input value={agentId} onChange={(event) => setAgentId(event.target.value)} />
      </label>
      <button disabled={busy} type="submit">
        <Plus size={13} />
        {busy ? "Claiming" : "Claim"}
      </button>
    </form>
  );
}

function RiskQueue({
  insights,
  model,
  onAcknowledgeInsight,
  onReleaseClaim,
  releasingClaimId
}: {
  insights: ConflictInsight[];
  model: DomainModel[];
  onAcknowledgeInsight(insightId: string): void;
  onReleaseClaim(claimId: string): void;
  releasingClaimId: string;
}): React.ReactElement {
  const risky = model
    .filter((domain) => domain.claims.length > 0 || domain.failures.length > 0)
    .sort((a, b) => (b.failures.length * 3 + b.claims.length) - (a.failures.length * 3 + a.claims.length));

  return (
    <section className="rail-section">
      {insights.map((insight) => (
        <article className={`rail-card conflict-card ${insight.severity}`} key={insight.id}>
          <div className="rail-card-head">
            <strong><TriangleAlert size={13} />{insight.message}</strong>
            <Badge tone={insight.severity === "high" ? "fail" : "risk"} icon={<TriangleAlert size={13} />}>{insight.severity}</Badge>
          </div>
          <p>{insight.agent_id} vs {insight.claim.agent_id}</p>
          <PathList paths={insight.paths} />
          <div className="card-actions">
            <button className="icon-action" type="button" onClick={() => onAcknowledgeInsight(insight.id)}>
              <CheckCheck size={13} />
              Acknowledge
            </button>
            <ClaimActions claim={insight.claim} onReleaseClaim={onReleaseClaim} releasingClaimId={releasingClaimId} />
          </div>
        </article>
      ))}
      {risky.map((domain) => (
        <article className="rail-card" key={domain.id}>
          <div className="rail-card-head">
            <strong>{domain.failures.length > 0 ? <TriangleAlert size={13} /> : <LockKeyhole size={13} />}{domain.name}</strong>
            <Badge tone={domain.failures.length > 0 ? "fail" : "risk"} icon={domain.failures.length > 0 ? <TriangleAlert size={13} /> : <LockKeyhole size={13} />}>{domain.failures.length > 0 ? "failing" : "claimed"}</Badge>
          </div>
          <p>{domain.claims.length} claims / {domain.failures.length} failures / {domain.events.length} events</p>
          <PathList paths={domain.claims.flatMap((claim) => claim.scope?.paths ?? [])} />
          <ClaimList claims={domain.claims} onReleaseClaim={onReleaseClaim} releasingClaimId={releasingClaimId} />
        </article>
      ))}
    </section>
  );
}

function ClaimList({
  claims,
  onReleaseClaim,
  releasingClaimId
}: {
  claims: ClaimPointer[];
  onReleaseClaim(claimId: string): void;
  releasingClaimId: string;
}): React.ReactElement | null {
  if (claims.length === 0) return null;
  return (
    <div className="claim-list">
      {claims.slice(0, 3).map((claim) => (
        <div className="claim-row" key={claim.id}>
          <span>
            <LockKeyhole size={12} />
            <strong>{claim.agent_id}</strong>
          </span>
          <ClaimActions claim={claim} onReleaseClaim={onReleaseClaim} releasingClaimId={releasingClaimId} />
        </div>
      ))}
    </div>
  );
}

function ClaimActions({
  claim,
  onReleaseClaim,
  releasingClaimId
}: {
  claim: ClaimPointer;
  onReleaseClaim(claimId: string): void;
  releasingClaimId: string;
}): React.ReactElement {
  const busy = releasingClaimId === claim.id;
  return (
    <button
      aria-label={`Release claim ${claim.id}`}
      className="icon-action"
      disabled={busy}
      title="Release claim"
      type="button"
      onClick={() => onReleaseClaim(claim.id)}
    >
      <UnlockKeyhole size={13} />
      {busy ? "Releasing" : "Release"}
    </button>
  );
}

function ActivityStream({ events }: { events: EventPointer[] }): React.ReactElement {
  return (
    <section className="rail-section activity-section">
      <h2><RadioTower size={14} /> Activity</h2>
      {events.slice().reverse().slice(0, 6).map((event) => (
        <article className="rail-card" key={`${event.agent_id}:${event.created_at}:${event.summary}`}>
          <div className="rail-card-head">
            <strong><Activity size={13} />{truncate(event.summary, 54)}</strong>
            <Badge tone="neutral" icon={<Sparkles size={13} />}>{event.event_type}</Badge>
          </div>
          <p>{event.agent_id} / {event.created_at}</p>
          <PathList paths={[...(event.affected_paths ?? []), ...(event.affected_apis ?? [])]} />
        </article>
      ))}
    </section>
  );
}

function PathList({ paths }: { paths: string[] }): React.ReactElement {
  const safePaths = paths.filter(Boolean).slice(0, 4);
  if (safePaths.length === 0) {
    return <p className="empty">paths: none</p>;
  }
  return <div className="paths">{safePaths.map((path) => <code key={path}>{path}</code>)}</div>;
}

function buildDomainModel(state: SukaState, domains: Domain[]): DomainModel[] {
  return domains.map((domain) => {
    const claims = state.claims.filter((item) => touchesDomain(domain, scopeValues(item.scope)));
    const presence = state.presence.filter((item) => touchesDomain(domain, [...(item.current_files ?? []), item.task ?? "", item.branch ?? ""]));
    const events = state.events.filter((item) => touchesDomain(domain, [...(item.affected_paths ?? []), ...(item.affected_apis ?? []), item.summary ?? ""]));
    const decisions = state.decisions.filter((item) => touchesDomain(domain, [...scopeValues(item.scope), item.title ?? ""]));
    const failures = events.filter((event) => event.event_type.includes("failed"));
    return { ...domain, claims, decisions, events, failures, presence };
  });
}

function buildConflictInsights(state: SukaState): ConflictInsight[] {
  const insights: ConflictInsight[] = [];
  for (const agent of state.presence) {
    const subjectPaths = (agent.current_files ?? []).map(normalizePath).filter(Boolean);
    const subjectText = [agent.task, agent.branch, ...subjectPaths].filter(Boolean).join(" ").toLowerCase();
    for (const claim of state.claims) {
      if (claim.agent_id === agent.agent_id) continue;
      const claimPaths = (claim.scope?.paths ?? []).map(normalizePath).filter(Boolean);
      const samePaths = subjectPaths.filter((path) => claimPaths.includes(path));
      const overlappingPaths = samePaths.length > 0
        ? samePaths
        : subjectPaths.filter((path) => claimPaths.some((claimPath) => pathsOverlap(path, claimPath)));
      const claimedDomains = claim.scope?.domains ?? [];
      const domainMatches = claimedDomains.filter((domain) => subjectText.includes(domain.toLowerCase()));

      if (samePaths.length > 0) {
        insights.push({
          agent_id: agent.agent_id,
          claim,
          id: `${agent.agent_id}:${claim.id}:same-file`,
          message: `Same file claimed by ${claim.agent_id}`,
          paths: samePaths,
          severity: "high"
        });
      } else if (overlappingPaths.length > 0) {
        insights.push({
          agent_id: agent.agent_id,
          claim,
          id: `${agent.agent_id}:${claim.id}:path-overlap`,
          message: `Path overlap with ${claim.agent_id}`,
          paths: overlappingPaths,
          severity: "medium"
        });
      } else if (domainMatches.length > 0) {
        insights.push({
          agent_id: agent.agent_id,
          claim,
          id: `${agent.agent_id}:${claim.id}:domain-overlap`,
          message: `Domain overlap with ${claim.agent_id}`,
          paths: domainMatches,
          severity: "low"
        });
      }
    }
  }
  return insights.sort((left, right) => severityRank(right.severity) - severityRank(left.severity)).slice(0, 8);
}

function buildFlow(model: DomainModel[], state: SukaState, selectedNodeId: string, repoEdges: RepoMapEdge[]): { edges: Edge[]; nodes: Node[] } {
  const nodes: Node[] = [
    ...model.map((domain) => ({
      id: domain.id,
      type: "domain",
      position: { x: domain.x, y: domain.y },
      selected: selectedNodeId === domain.id,
      data: {
        agents: domain.presence.length,
        claims: domain.claims.length,
        color: stateColor(domain),
        label: domain.name,
        meta: `${domain.file_count ?? 0} files / ${domain.claims.length} claims`,
        state: domainState(domain)
      }
    })),
    ...state.presence.map((agent, index) => {
      const identity = agentIdentity(agent);
      const domain = model.find((item) => touchesDomain(item, [...(agent.current_files ?? []), agent.task ?? "", agent.branch ?? ""]));
      const base = domain ? { x: domain.x + 122, y: domain.y - 22 } : { x: 420 + index * 48, y: 230 };
      return {
        id: `agent:${agent.agent_id}`,
        type: "agent",
        position: { x: base.x + index * 26, y: base.y + index * 8 },
        selected: selectedNodeId === `agent:${agent.agent_id}`,
        data: {
          color: agentColor(agent.agent_id),
          state: "agent",
          symbol: identity.symbol
        }
      };
    })
  ];

  const baseEdges = repoEdges.length > 0
    ? repoEdges.map((item) => [item.source, item.target] as const)
    : graphEdges;

  const edges: Edge[] = [
    ...baseEdges.map(([source, target]) => {
      const sourceDomain = model.find((domain) => domain.id === source);
      const targetDomain = model.find((domain) => domain.id === target);
      const hot = Boolean(sourceDomain?.claims.length || sourceDomain?.failures.length || targetDomain?.claims.length || targetDomain?.failures.length);
      return {
        id: `${source}-${target}`,
        source,
        target,
        animated: hot,
        style: {
          stroke: hot ? "#d97706" : "rgba(203,213,225,0.72)",
          strokeWidth: hot ? 1.8 : 1
        }
      };
    }),
    ...state.presence.flatMap((agent) => agentDomains(agent, model).map((domainId) => ({
      id: `agent-edge:${agent.agent_id}:${domainId}`,
      source: `agent:${agent.agent_id}`,
      target: domainId,
      style: {
        stroke: agentColor(agent.agent_id),
        strokeDasharray: "5 5",
        strokeWidth: 1.2
      }
    })))
  ];

  return { edges, nodes };
}

function resolveSelection(selectedNodeId: string, model: DomainModel[], state: SukaState): SelectedDetails {
  if (selectedNodeId.startsWith("agent:")) {
    const agentId = selectedNodeId.slice("agent:".length);
    const agent = state.presence.find((item) => item.agent_id === agentId);
    return agent ? { agent, kind: "agent" } : undefined;
  }

  const domain = model.find((item) => item.id === selectedNodeId);
  return domain ? { domain, kind: "domain" } : undefined;
}

function localFocusNodes(nodes: Node[], edges: Edge[], selectedNodeId: string): Node[] {
  if (selectedNodeId.length === 0) {
    const riskyNodes = nodes.filter((node) => node.data.state === "failing" || node.data.state === "claimed");
    return riskyNodes.length > 0 ? riskyNodes : nodes;
  }

  const ids = new Set<string>([selectedNodeId]);
  for (const edge of edges) {
    if (edge.source === selectedNodeId) ids.add(edge.target);
    if (edge.target === selectedNodeId) ids.add(edge.source);
  }
  return nodes.filter((node) => ids.has(node.id));
}

function scopeValues(scope: Scope | undefined): string[] {
  return [
    ...(scope?.paths ?? []),
    ...(scope?.apis ?? []),
    ...(scope?.tables ?? []),
    ...(scope?.env ?? []),
    ...(scope?.domains ?? [])
  ];
}

function touchesDomain(domain: Domain, values: string[]): boolean {
  const haystack = values.join(" ").toLowerCase();
  const domainPath = domain.path?.toLowerCase();
  if (domainPath && haystack.includes(domainPath)) return true;
  return domain.keys.some((key) => key.length > 1 && haystack.includes(key));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+/g, "/").replace(/\/$/, "");
}

function pathsOverlap(left: string, right: string): boolean {
  if (left.length === 0 || right.length === 0) return false;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function severityRank(severity: ConflictInsight["severity"]): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function domainState(domain: DomainModel): string {
  if (domain.failures.length > 0) return "failing";
  if (domain.claims.length > 0) return "claimed";
  if (domain.presence.length > 0) return "active";
  if (domain.decisions.length > 0) return "decision";
  return "clear";
}

function stateColor(domain: DomainModel): string {
  if (domain.failures.length > 0) return "#e11d48";
  if (domain.claims.length > 0) return "#d97706";
  if (domain.presence.length > 0) return "#2563eb";
  if (domain.decisions.length > 0) return "#4f46e5";
  return domain.color;
}

function agentDomains(agent: PresencePointer, domains: Domain[]): string[] {
  const matched = domains.filter((domain) => touchesDomain(domain, [...(agent.current_files ?? []), agent.task ?? "", agent.branch ?? ""])).map((domain) => domain.id);
  return matched.length > 0 ? matched : domains[0]?.id ? [domains[0].id] : [];
}

function agentIdentity(agent: PresencePointer): { icon: React.ElementType; label: string; symbol: string } {
  const raw = [agent.agent_id, agent.tool, agent.task, agent.branch].filter(Boolean).join(" ").toLowerCase();
  if (raw.includes("codex")) return { icon: Sparkles, label: "Codex", symbol: "Cx" };
  if (raw.includes("cursor")) return { icon: MousePointer2, label: "Cursor", symbol: "Cu" };
  if (raw.includes("copilot") || raw.includes("github")) return { icon: GitBranch, label: "GitHub Copilot", symbol: "Gh" };
  if (raw.includes("terminal") || raw.includes("cli") || raw.includes("shell")) return { icon: Terminal, label: "Terminal", symbol: "Sh" };
  return { icon: Code2, label: agent.tool, symbol: initials(agent.agent_id).slice(0, 2) };
}

function agentColor(agentId: string): string {
  let hash = 0;
  for (let index = 0; index < agentId.length; index += 1) {
    hash = (hash * 31 + agentId.charCodeAt(index)) >>> 0;
  }
  return agentPalette[hash % agentPalette.length] ?? "#0f766e";
}

function initials(value: string): string {
  return value.split(/[-_\s]/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";
}

function displayName(value: string): string {
  return value
    .split(/[-_\s/]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Workspace";
}

function createInviteToken(repoName: string): string {
  const entropy = `${repoName}:${Date.now()}:${Math.random()}`;
  let hash = 0;
  for (let index = 0; index < entropy.length; index += 1) {
    hash = (hash * 31 + entropy.charCodeAt(index)) >>> 0;
  }
  return `${slug(repoName)}-${hash.toString(36).padStart(6, "0")}`;
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Clipboard access depends on browser permissions; the invite remains visible for manual copy.
  }
}

function readStoredTeamConnection(): TeamConnection {
  if (typeof window === "undefined") return defaultTeamConnection;
  const raw = readStorageValue("teamConnection");
  if (!raw) return defaultTeamConnection;
  try {
    const parsed = JSON.parse(raw) as Partial<TeamConnection>;
    return {
      inviteToken: typeof parsed.inviteToken === "string" ? parsed.inviteToken : "",
      mode: parsed.mode === "team" ? "team" : "local",
      workspaceName: typeof parsed.workspaceName === "string" && parsed.workspaceName.length > 0
        ? parsed.workspaceName
        : defaultTeamConnection.workspaceName
    };
  } catch {
    return defaultTeamConnection;
  }
}

function writeStoredTeamConnection(value: TeamConnection): void {
  writeStorageValue("teamConnection", JSON.stringify(value));
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const value = readStorageValue(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function writeStoredBoolean(key: string, value: boolean): void {
  writeStorageValue(key, String(value));
}

function readStoredString(key: string): string {
  if (typeof window === "undefined") return "";
  return readStorageValue(key) ?? "";
}

function writeStoredString(key: string, value: string): void {
  if (value.length === 0) {
    removeStorageValue(key);
    return;
  }
  writeStorageValue(key, value);
}

function readStoredViewport(): Viewport | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = readStorageValue("viewport");
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<Viewport>;
    if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.zoom === "number") {
      return { x: parsed.x, y: parsed.y, zoom: parsed.zoom };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function writeStoredViewport(viewport: Viewport): void {
  writeStorageValue("viewport", JSON.stringify(viewport));
}

function readStorageValue(key: string): string | null {
  try {
    return window.localStorage.getItem(`${storagePrefix}${key}`);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(`${storagePrefix}${key}`, value);
  } catch {
    // Storage is best-effort; the dashboard remains fully usable without it.
  }
}

function removeStorageValue(key: string): void {
  try {
    window.localStorage.removeItem(`${storagePrefix}${key}`);
  } catch {
    // Storage is best-effort; the dashboard remains fully usable without it.
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ReactFlowProvider>
      <Dashboard />
    </ReactFlowProvider>
  </React.StrictMode>
);
