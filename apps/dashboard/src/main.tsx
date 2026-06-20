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
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Code2,
  Crosshair,
  Copy,
  FileClock,
  FolderOpen,
  Gauge,
  GitBranch,
  HardDrive,
  Link2,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Moon,
  MousePointer2,
  Network,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  Route,
  Scan,
  Settings,
  Sparkles,
  Sun,
  Terminal,
  Timer,
  Trash2,
  TriangleAlert,
  UnlockKeyhole,
  Users,
  Waypoints,
  Wifi,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import "./styles.css";

type SukaState = {
  presence: PresencePointer[];
  claims: ClaimPointer[];
  events: EventPointer[];
  decisions: DecisionPointer[];
  briefs: BriefPointer[];
};

type PresencePointer = {
  id?: string;
  agent_id: string;
  user_id?: string;
  tool: string;
  source?: {
    kind: "manual" | "detected";
    detector?: string;
    pid?: number;
    cwd?: string;
    detected_at?: string;
  };
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
  kind?: "soft_claim" | "blocked_scope";
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
  affected_tables?: string[];
  affected_env?: string[];
};

type DecisionPointer = {
  title: string;
  status: string;
  confidence?: string;
  evidence?: string[];
  scope?: Scope;
  created_at?: string;
  updated_at?: string;
};

type BriefPointer = {
  id: string;
  agent_id: string;
  summary: string;
  changed_files: string[];
  decisions_made: string[];
  assumptions: string[];
  skipped_work: string[];
  risks: string[];
  blockers: string[];
  next_action: string;
  related_claims: string[];
  related_sessions: string[];
  worktree?: string;
  created_at: string;
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
  package_name?: string;
  path?: string;
  route_count?: number;
  routes?: string[];
  test_count?: number;
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
  briefs: number;
};

type LocalProject = {
  id: string;
  name: string;
  path: string;
  repo: string;
  repo_id: string;
  repo_root: string;
  workspace_id: string;
  branch?: string;
};

type LocalProjectSuggestion = Omit<LocalProject, "id">;

type ProjectTrackingStatus = {
  active_project_id?: string;
  detected_agents: number;
  interval_seconds: number;
  last_run_at?: string;
  published_presence: number;
  running: boolean;
  warnings: string[];
};

type WorkspaceLayout = {
  customZones: CustomCanvasZone[];
  leftOpen: boolean;
  leftRailWidth: number;
  nodePositions: NodePositionMap;
  rightOpen: boolean;
  rightRailWidth: number;
  selectedNodeId: string;
  viewport: Viewport | undefined;
};

type CustomCanvasZone = {
  id: string;
  kind: CustomZoneKind;
  label: string;
  tone: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type CustomZoneKind = "mission" | "ownership" | "risk" | "handoff" | "blocked" | "agent";

type NodePositionMap = Record<string, { x: number; y: number }>;

type SessionRoom = {
  id: string;
  workspace_id: string;
  repo_id: string;
  session_id: string;
  members: PresencePointer[];
  latestTask?: string;
};

const emptyState: SukaState = {
  briefs: [],
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

type AppSettings = {
  theme: "dark" | "light";
  pollingInterval: 5 | 10 | 30;
  showMinimap: boolean;
  showLegend: boolean;
  density: "default" | "compact";
};

type RightRailView = "truth" | "inspect" | "risk" | "activity";
type PanelDockPreset = "context" | "agents" | "radar" | "canvas" | "focus";

const defaultSettings: AppSettings = {
  theme: "dark",
  pollingInterval: 5,
  showMinimap: true,
  showLegend: true,
  density: "default"
};

const agentPalette = ["#0f766e", "#2563eb", "#7c3aed", "#16803c", "#b45309", "#be123c", "#0e7490"];
const storagePrefix = "suka.dashboard.";
const layoutStoragePrefix = `${storagePrefix}layout.`;
const layoutStorageKeys = [
  "customZones",
  "leftOpen",
  "rightOpen",
  "leftRailWidth",
  "nodePositions",
  "rightRailWidth",
  "selectedNodeId",
  "viewport"
] as const;
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

const emptyTrackingStatus: ProjectTrackingStatus = {
  detected_agents: 0,
  interval_seconds: 15,
  published_presence: 0,
  running: false,
  warnings: []
};

const DEFAULT_LEFT_RAIL_WIDTH = 276;
const DEFAULT_RIGHT_RAIL_WIDTH = 380;
const LEFT_RAIL_MIN_WIDTH = 220;
const LEFT_RAIL_MAX_WIDTH = 420;
const RIGHT_RAIL_MIN_WIDTH = 340;
const RIGHT_RAIL_MAX_WIDTH = 560;

type SelectedDetails =
  | { kind: "agent"; agent: PresencePointer }
  | { kind: "domain"; domain: DomainModel }
  | undefined;

function Dashboard(): React.ReactElement {
  const [state, setState] = useState<SukaState>(emptyState);
  const [repoMap, setRepoMap] = useState<RepoMap>({ domains: fallbackDomains, edges: [] });
  const [status, setStatus] = useState("connecting");
  const [projectPath, setProjectPath] = useState(() => readStoredString("projectPath"));
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftRailWidth, setLeftRailWidth] = useState(DEFAULT_LEFT_RAIL_WIDTH);
  const [rightRailWidth, setRightRailWidth] = useState(DEFAULT_RIGHT_RAIL_WIDTH);
  const [focusMode, setFocusMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [releasingClaimId, setReleasingClaimId] = useState("");
  const [dismissedInsightIds, setDismissedInsightIds] = useState<Set<string>>(() => new Set());
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [teamConnection, setTeamConnection] = useState<TeamConnection>(() => readStoredTeamConnection());
  const [teamSummary, setTeamSummary] = useState<TeamConnectionSummary>(emptyTeamSummary);
  const [activeSessionId, setActiveSessionId] = useState(() => readStoredString("activeSessionId"));
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => readStoredBoolean("welcomeDismissed", false));
  const [landingOpen, setLandingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => readStoredSettings());
  const [rightRailView, setRightRailView] = useState<RightRailView>(() => readStoredRightRailView());
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [activeProject, setActiveProject] = useState<LocalProject | undefined>();
  const [suggestedProject, setSuggestedProject] = useState<LocalProjectSuggestion | undefined>();
  const [trackingStatus, setTrackingStatus] = useState<ProjectTrackingStatus>(emptyTrackingStatus);
  const [projectError, setProjectError] = useState("");
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [customZones, setCustomZones] = useState<CustomCanvasZone[]>([]);
  const [hydratedLayoutScope, setHydratedLayoutScope] = useState("");
  const [nodePositions, setNodePositions] = useState<NodePositionMap>({});
  const autoStartedProjectId = useRef("");
  const manualTrackingStopped = useRef(false);
  const viewportRestored = useRef(false);
  const shellRef = useRef<HTMLElement | null>(null);
  const { fitView, setViewport, zoomIn, zoomOut } = useReactFlow();
  const layoutScope = useMemo(() => {
    const activeProjectKey = activeProject ? `${activeProject.workspace_id}:${activeProject.repo_id}` : "";
    return createLayoutStorageScope(activeProjectKey || projectPath || repoMap.root);
  }, [activeProject, projectPath, repoMap.root]);

  const loadState = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json() as { data: Partial<SukaState> };
      setState(normalizeState(payload.data));
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

  const loadProjects = useCallback(async () => {
    try {
      const [projectsResponse, activeResponse, defaultResponse] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/projects/active", { cache: "no-store" }),
        fetch("/api/projects/default", { cache: "no-store" })
      ]);
      if (projectsResponse.ok) {
        const payload = await projectsResponse.json() as { data: LocalProject[] };
        setProjects(Array.isArray(payload.data) ? payload.data : []);
      }
      if (defaultResponse.ok) {
        const payload = await defaultResponse.json() as { data: LocalProjectSuggestion };
        setSuggestedProject(payload.data);
        if (projectPath.length === 0) {
          setProjectPath(payload.data.path);
        }
      }
      if (activeResponse.ok) {
        const payload = await activeResponse.json() as { data: LocalProject | null };
        setActiveProject(payload.data ?? undefined);
        if (payload.data?.path !== undefined && projectPath.length === 0) {
          setProjectPath(payload.data.path);
        }
      }
    } catch {
      setProjects((current) => current);
    }
  }, [projectPath.length]);

  const loadTrackingStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/projects/tracking", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { data: ProjectTrackingStatus };
      setTrackingStatus(payload.data);
    } catch {
      setTrackingStatus((current) => current);
    }
  }, []);

  useEffect(() => {
    void loadState();
    const ms = settings.pollingInterval * 1000;
    const timer = window.setInterval(() => void loadState(), ms);
    return () => window.clearInterval(timer);
  }, [loadState, settings.pollingInterval]);

  useEffect(() => {
    void loadRepoMap();
    const timer = window.setInterval(() => void loadRepoMap(), 30000);
    return () => window.clearInterval(timer);
  }, [loadRepoMap]);

  useEffect(() => {
    void loadTeamSummary();
    const ms = settings.pollingInterval * 1000;
    const timer = window.setInterval(() => void loadTeamSummary(), ms);
    return () => window.clearInterval(timer);
  }, [loadTeamSummary, settings.pollingInterval]);

  useEffect(() => {
    void loadProjects();
    void loadTrackingStatus();
    const ms = settings.pollingInterval * 1000;
    const timer = window.setInterval(() => {
      void loadProjects();
      void loadTrackingStatus();
    }, ms);
    return () => window.clearInterval(timer);
  }, [loadProjects, loadTrackingStatus, settings.pollingInterval]);

  useEffect(() => {
    writeStoredSettings(settings);
  }, [settings]);

  useEffect(() => {
    writeStoredString("rightRailView", rightRailView);
  }, [rightRailView]);

  const updateCustomZones = useCallback((updater: (zones: CustomCanvasZone[]) => CustomCanvasZone[]) => {
    setCustomZones((current) => {
      const next = updater(current);
      writeStoredLayoutCustomZones(layoutScope, next);
      return next;
    });
  }, [layoutScope]);

  const renameCustomZone = useCallback((zoneId: string) => {
    const zone = customZones.find((item) => item.id === zoneId);
    if (zone === undefined) return;
    const nextLabel = window.prompt("Name this canvas zone", zone.label)?.trim();
    if (nextLabel === undefined || nextLabel.length === 0) return;
    updateCustomZones((current) => current.map((item) => item.id === zoneId
      ? { ...item, label: nextLabel.slice(0, 48) }
      : item));
  }, [customZones, updateCustomZones]);

  const cycleCustomZoneSize = useCallback((zoneId: string) => {
    updateCustomZones((current) => current.map((zone) => {
      if (zone.id !== zoneId) return zone;
      const compact = zone.width <= 300;
      const wide = zone.width >= 520;
      if (compact) return { ...zone, height: 220, width: 420 };
      if (!wide) return { ...zone, height: 280, width: 560 };
      return { ...zone, height: 180, width: 300 };
    }));
  }, [updateCustomZones]);

  const cycleCustomZoneKind = useCallback((zoneId: string) => {
    updateCustomZones((current) => current.map((zone) => zone.id === zoneId
      ? { ...zone, kind: nextCustomZoneKind(zone.kind) }
      : zone));
  }, [updateCustomZones]);

  const deleteCustomZone = useCallback((zoneId: string) => {
    const zone = customZones.find((item) => item.id === zoneId);
    if (zone !== undefined && !window.confirm(`Delete "${zone.label}" from this canvas?`)) return;
    updateCustomZones((current) => current.filter((zone) => zone.id !== zoneId));
  }, [customZones, updateCustomZones]);

  const domainCatalog = repoMap.domains.length > 0 ? repoMap.domains : fallbackDomains;
  const model = useMemo(() => buildDomainModel(state, domainCatalog), [domainCatalog, state]);
  const sessionRooms = useMemo(
    () => buildSessionRooms(teamSummary.members.length > 0 ? teamSummary.members : state.presence),
    [state.presence, teamSummary.members]
  );
  const activeSession = sessionRooms.find((room) => room.id === activeSessionId);
  const { edges, nodes } = useMemo(
    () => buildFlow(model, state, selectedNodeId, repoMap.edges, nodePositions, customZones, {
      onDelete: deleteCustomZone,
      onKind: cycleCustomZoneKind,
      onRename: renameCustomZone,
      onResize: cycleCustomZoneSize
    }),
    [customZones, cycleCustomZoneKind, cycleCustomZoneSize, deleteCustomZone, model, nodePositions, renameCustomZone, repoMap.edges, selectedNodeId, state]
  );
  const conflictInsights = useMemo(() => buildConflictInsights(state), [state]);
  const visibleConflictInsights = useMemo(
    () => conflictInsights.filter((insight) => !dismissedInsightIds.has(insight.id)),
    [conflictInsights, dismissedInsightIds]
  );
  const riskCount = visibleConflictInsights.length + model.filter((item) => item.failures.length > 0).length;
  const radarSignalCount = riskCount + state.presence.length + state.claims.length + state.briefs.length + state.events.length + state.decisions.length;
  const selectedDetails = useMemo(() => resolveSelection(selectedNodeId, model, state), [model, selectedNodeId, state]);
  const hasLiveState = state.presence.length + state.claims.length + state.events.length + state.decisions.length + state.briefs.length > 0;
  const showWelcome = landingOpen || (!welcomeDismissed && !hasLiveState);

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

  const startProjectTracking = useCallback(async (selectedPath?: string): Promise<boolean> => {
    const path = (selectedPath ?? projectPath).trim() || suggestedProject?.path || "";
    setProjectError("");
    setTrackingBusy(true);
    try {
      let project = activeProject;
      if (path.length > 0 && path !== activeProject?.path) {
        const createResponse = await fetch("/api/projects", {
          body: JSON.stringify({ path }),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        if (!createResponse.ok) {
          throw new Error("Project path could not be registered.");
        }
        const createPayload = await createResponse.json() as { data: LocalProject };
        project = createPayload.data;
        const activateResponse = await fetch(`/api/projects/${encodeURIComponent(project.id)}/activate`, {
          body: "{}",
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        if (!activateResponse.ok) {
          throw new Error("Project could not be activated.");
        }
      } else if (project === undefined && projects[0] !== undefined) {
        project = projects[0];
        const activateResponse = await fetch(`/api/projects/${encodeURIComponent(project.id)}/activate`, {
          body: "{}",
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        if (!activateResponse.ok) {
          throw new Error("Project could not be activated.");
        }
      }

      const startResponse = await fetch("/api/projects/tracking/start", {
        body: JSON.stringify(project === undefined ? {} : { project_id: project.id }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!startResponse.ok) {
        throw new Error("Tracking could not be started.");
      }
      const startPayload = await startResponse.json() as { data: ProjectTrackingStatus };
      manualTrackingStopped.current = false;
      setTrackingStatus(startPayload.data);
      await Promise.all([loadProjects(), loadState(), loadTeamSummary()]);
      return true;
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Tracking could not be started.");
      return false;
    } finally {
      setTrackingBusy(false);
    }
  }, [activeProject, loadProjects, loadState, loadTeamSummary, projectPath, projects, suggestedProject?.path]);

  useEffect(() => {
    if (activeProject === undefined || trackingBusy || trackingStatus.running || manualTrackingStopped.current) return;
    if (autoStartedProjectId.current === activeProject.id) return;
    autoStartedProjectId.current = activeProject.id;
    void startProjectTracking(activeProject.path);
  }, [activeProject, startProjectTracking, trackingBusy, trackingStatus.running]);

  const selectProjectFolder = useCallback(async (): Promise<boolean> => {
    setProjectError("");
    setTrackingBusy(true);
    try {
      const response = await fetch("/api/projects/select-folder", {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Folder picker could not be opened.");
      }
      const payload = await response.json() as {
        data: { selected: true; path: string } | { selected: false; reason: string };
      };
      if (!payload.data.selected) {
        setProjectError(payload.data.reason);
        return false;
      }
      setProjectPath(payload.data.path);
      return await startProjectTracking(payload.data.path);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Folder picker could not be opened.");
      return false;
    } finally {
      setTrackingBusy(false);
    }
  }, [startProjectTracking]);

  const stopProjectTracking = useCallback(async () => {
    setProjectError("");
    manualTrackingStopped.current = true;
    setTrackingBusy(true);
    try {
      const response = await fetch("/api/projects/tracking/stop", {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Tracking could not be stopped.");
      }
      const payload = await response.json() as { data: ProjectTrackingStatus };
      setTrackingStatus(payload.data);
      await Promise.all([loadState(), loadTeamSummary()]);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Tracking could not be stopped.");
    } finally {
      setTrackingBusy(false);
    }
  }, [loadState, loadTeamSummary]);

  const enterWorkspace = useCallback(() => {
    setWelcomeDismissed(true);
    setLandingOpen(false);
  }, []);

  const exitToLanding = useCallback(() => {
    setTeamPanelOpen(false);
    setFocusMode(false);
    setLandingOpen(true);
  }, []);

  const startRailResize = useCallback((side: "left" | "right", event: React.PointerEvent<HTMLButtonElement>) => {
    if (focusMode) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const shell = shellRef.current;
    const shellBounds = shell?.getBoundingClientRect();

    function onPointerMove(moveEvent: PointerEvent) {
      if (shellBounds === undefined) return;
      if (side === "left") {
        const width = clamp(moveEvent.clientX - shellBounds.left - 8, LEFT_RAIL_MIN_WIDTH, LEFT_RAIL_MAX_WIDTH);
        setLeftRailWidth(width);
      } else {
        const width = clamp(shellBounds.right - moveEvent.clientX - 8, RIGHT_RAIL_MIN_WIDTH, RIGHT_RAIL_MAX_WIDTH);
        setRightRailWidth(width);
      }
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.classList.remove("is-resizing-rail");
      window.setTimeout(() => fitView({ duration: 120, padding: focusMode ? 0.18 : 0.12 }), 0);
    }

    document.body.classList.add("is-resizing-rail");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }, [fitView, focusMode]);

  const resizeRailWithKeyboard = useCallback((side: "left" | "right", event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 24 : 12;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (side === "left") {
      setLeftRailWidth((width) => clamp(width + direction * step, LEFT_RAIL_MIN_WIDTH, LEFT_RAIL_MAX_WIDTH));
    } else {
      setRightRailWidth((width) => clamp(width - direction * step, RIGHT_RAIL_MIN_WIDTH, RIGHT_RAIL_MAX_WIDTH));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fitView({ duration: 180, padding: focusMode ? 0.18 : 0.12 }), 80);
    return () => window.clearTimeout(timer);
  }, [fitView, focusMode, leftOpen, rightOpen]);

  useEffect(() => {
    const layout = readStoredLayout(layoutScope);
    removeLayoutStorageValue(layoutScope, "focusMode");
    setHydratedLayoutScope(layoutScope);
    viewportRestored.current = false;
    setLeftOpen(layout.leftOpen);
    setRightOpen(layout.rightOpen);
    setFocusMode(false);
    setCustomZones(layout.customZones);
    setLeftRailWidth(layout.leftRailWidth);
    setRightRailWidth(layout.rightRailWidth);
    setNodePositions(layout.nodePositions);
    setSelectedNodeId(layout.selectedNodeId);
    if (layout.viewport) {
      void setViewport(layout.viewport, { duration: 0 });
    }
  }, [layoutScope, setViewport]);

  useEffect(() => {
    if (hydratedLayoutScope !== layoutScope) return;
    writeStoredLayoutBoolean(layoutScope, "leftOpen", leftOpen);
    writeStoredLayoutBoolean(layoutScope, "rightOpen", rightOpen);
  }, [hydratedLayoutScope, layoutScope, leftOpen, rightOpen]);

  useEffect(() => {
    if (hydratedLayoutScope !== layoutScope) return;
    writeStoredLayoutNumber(layoutScope, "leftRailWidth", leftRailWidth);
    writeStoredLayoutNumber(layoutScope, "rightRailWidth", rightRailWidth);
  }, [hydratedLayoutScope, layoutScope, leftRailWidth, rightRailWidth]);

  useEffect(() => {
    if (hydratedLayoutScope !== layoutScope) return;
    writeStoredLayoutString(layoutScope, "selectedNodeId", selectedNodeId);
  }, [hydratedLayoutScope, layoutScope, selectedNodeId]);

  const storeNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    if (hydratedLayoutScope !== layoutScope) return;
    if (nodeId.startsWith("custom-zone:")) {
      const zoneId = nodeId.slice("custom-zone:".length);
      setCustomZones((current) => {
        const next = current.map((zone) => zone.id === zoneId
          ? { ...zone, x: Math.round(position.x), y: Math.round(position.y) }
          : zone);
        writeStoredLayoutCustomZones(layoutScope, next);
        return next;
      });
      return;
    }
    setNodePositions((current) => {
      const next = {
        ...current,
        [nodeId]: {
          x: Math.round(position.x),
          y: Math.round(position.y)
        }
      };
      writeStoredLayoutNodePositions(layoutScope, next);
      return next;
    });
  }, [hydratedLayoutScope, layoutScope]);

  useEffect(() => {
    if (activeSessionId.length === 0) return;
    if (sessionRooms.some((room) => room.id === activeSessionId)) return;
    setActiveSessionId("");
  }, [activeSessionId, sessionRooms]);

  useEffect(() => {
    writeStoredString("activeSessionId", activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    writeStoredTeamConnection(teamConnection);
  }, [teamConnection]);

  useEffect(() => {
    writeStoredString("projectPath", projectPath);
  }, [projectPath]);

  useEffect(() => {
    writeStoredBoolean("welcomeDismissed", welcomeDismissed);
  }, [welcomeDismissed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "?") setDocsOpen(v => !v);
      if (e.key === "Escape") { setDocsOpen(false); setSettingsOpen(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (viewportRestored.current || nodes.length === 0) return;
    viewportRestored.current = true;
    const viewport = readStoredLayoutViewport(layoutScope);
    if (viewport) {
      void setViewport(viewport, { duration: 0 });
    }
  }, [layoutScope, nodes.length, setViewport]);

  const resetWorkspaceLayout = useCallback(() => {
    removeStoredLayout(layoutScope);
    viewportRestored.current = true;
    setCustomZones([]);
    setLeftOpen(true);
    setRightOpen(true);
    setFocusMode(false);
    setLeftRailWidth(DEFAULT_LEFT_RAIL_WIDTH);
    setRightRailWidth(DEFAULT_RIGHT_RAIL_WIDTH);
    setNodePositions({});
    setSelectedNodeId("");
    void fitView({ duration: 220, padding: 0.16 });
  }, [fitView, layoutScope]);

  const resetCanvasArrangement = useCallback(() => {
    removeLayoutStorageValue(layoutScope, "nodePositions");
    removeLayoutStorageValue(layoutScope, "customZones");
    setCustomZones([]);
    setNodePositions({});
    window.setTimeout(() => fitView({ duration: 220, padding: 0.18 }), 0);
  }, [fitView, layoutScope]);

  const createCustomZone = useCallback(() => {
    const index = customZones.length + 1;
    const zone: CustomCanvasZone = {
      height: 180,
      id: `zone-${Date.now()}`,
      kind: "mission",
      label: `Mission Zone ${index}`,
      tone: missionZoneTone(index),
      width: 300,
      x: 180 + (index % 3) * 36,
      y: 140 + (index % 3) * 32
    };
    const next = [...customZones, zone];
    setCustomZones(next);
    writeStoredLayoutCustomZones(layoutScope, next);
    window.setTimeout(() => fitView({ duration: 180, padding: 0.18 }), 0);
  }, [customZones, fitView, layoutScope]);

  const applyPanelDockPreset = useCallback((preset: PanelDockPreset) => {
    setFocusMode(preset === "focus");
    setLeftOpen(preset === "context" || preset === "agents");
    setRightOpen(preset === "context" || preset === "radar");
    if (preset === "context") {
      setLeftRailWidth(DEFAULT_LEFT_RAIL_WIDTH);
      setRightRailWidth(DEFAULT_RIGHT_RAIL_WIDTH);
    }
    window.setTimeout(() => fitView({ duration: 180, padding: preset === "focus" || preset === "canvas" ? 0.18 : 0.12 }), 0);
  }, [fitView]);

  const activePanelDockPreset: PanelDockPreset = focusMode
    ? "focus"
    : !leftOpen && !rightOpen
      ? "canvas"
      : leftOpen && !rightOpen
        ? "agents"
        : !leftOpen && rightOpen
          ? "radar"
          : "context";

  const shellClass = [
    "app-shell",
    !leftOpen ? "left-collapsed" : "",
    !rightOpen ? "right-collapsed" : "",
    focusMode ? "focus-mode" : ""
  ].filter(Boolean).join(" ");
  const shellStyle = {
    "--left-rail-width": `${leftRailWidth}px`,
    "--right-rail-width": `${rightRailWidth}px`
  } as React.CSSProperties;

  if (showWelcome) {
    return (
      <div className="suka-app" data-theme={settings.theme} data-density={settings.density}>
        <WelcomeSurface
          activeProject={activeProject}
          busy={trackingBusy}
          connection={teamConnection}
          error={projectError}
          path={projectPath}
          repoName={repoMap.root ?? "workspace"}
          status={status}
          suggestedProject={suggestedProject}
          trackingStatus={trackingStatus}
          onDismiss={enterWorkspace}
          onOpenTeam={() => {
            enterWorkspace();
            setTeamPanelOpen(true);
          }}
          onPathChange={setProjectPath}
          onSelectFolder={async () => {
            const selected = await selectProjectFolder();
            if (selected) {
              enterWorkspace();
            }
          }}
          onStartTracking={() => void startProjectTracking()}
          onStopTracking={() => void stopProjectTracking()}
        />
      </div>
    );
  }

  return (
    <div className="suka-app" data-theme={settings.theme} data-density={settings.density}>
      <header className="topbar">
        <div className="brand">
          <button aria-label="Back to landing" className="back-btn" type="button" onClick={exitToLanding}>
            <ArrowLeft size={15} />
          </button>
          <div className="brand-mark"><Waypoints size={15} /></div>
          <div>
            <h1>Suka Operations Canvas</h1>
            <p>Realtime coordination for agentic work</p>
          </div>
        </div>
        <div className="top-actions">
          <Badge tone="info" icon={<HardDrive size={12} />}>local</Badge>
          <Badge tone={teamSummary.active_agents > 0 ? "live" : "neutral"} icon={<Users size={12} />}>
            {teamSummary.active_agents > 0 ? `${teamSummary.active_agents} active` : "local only"}
          </Badge>
          {activeSession !== undefined ? (
            <Badge tone="info" icon={<RadioTower size={12} />}>{activeSession.session_id}</Badge>
          ) : null}
          <Badge tone={status === "connected" ? "live" : status === "error" ? "fail" : "neutral"} icon={<i className={`status-dot ${status === "connected" ? "live" : status === "error" ? "error" : "neutral"}`} />}>{status}</Badge>
          <ProjectTrackingControl
            activeProject={activeProject}
            busy={trackingBusy}
            error={projectError}
            path={projectPath}
            projects={projects}
            status={trackingStatus}
            suggestedProject={suggestedProject}
            onPathChange={setProjectPath}
            onSelectFolder={() => void selectProjectFolder()}
            onStart={() => void startProjectTracking()}
            onStop={() => void stopProjectTracking()}
          />
          <PanelDockPresets
            active={activePanelDockPreset}
            onSelect={applyPanelDockPreset}
          />
          <button aria-label="Open team connection panel" type="button" onClick={toggleTeamPanel}>
            <Link2 size={14} />
            Team
          </button>
          <button aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"} type="button" onClick={() => setFocusMode((value) => !value)}>
            {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {focusMode ? "Exit focus" : "Focus"}
          </button>
          <button aria-label="Refresh state" type="button" onClick={() => void loadState()}>
            <RefreshCw size={14} />
          </button>
          <button
            aria-expanded={docsOpen}
            aria-label="Open docs"
            className="docs-btn"
            title="Docs (?)"
            type="button"
            onClick={() => setDocsOpen(v => !v)}
          >
            <BookOpen size={14} />
          </button>
          <button
            aria-expanded={settingsOpen}
            aria-label="Open settings"
            className="settings-btn"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={18} strokeWidth={2.25} />
          </button>
        </div>
        {teamPanelOpen ? (
          <TeamConnectionPanel
            activeSessionId={activeSessionId}
            agents={state.presence}
            connection={teamConnection}
            repoName={repoMap.root ?? "workspace"}
            serverStatus={status}
            sessionRooms={sessionRooms}
            summary={teamSummary}
            onClose={() => setTeamPanelOpen(false)}
            onSelectSession={setActiveSessionId}
            onUpdate={setTeamConnection}
          />
        ) : null}
        {docsOpen ? (
          <DocsPanel onClose={() => setDocsOpen(false)} />
        ) : null}
        {settingsOpen ? (
          <SettingsPanel
            layoutScopeLabel={projectPath.trim().length > 0 ? "This project" : "Default workspace"}
            settings={settings}
            status={status}
            onClose={() => setSettingsOpen(false)}
            onResetLayout={resetWorkspaceLayout}
            onUpdate={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          />
        ) : null}
      </header>

      <main className={shellClass} ref={shellRef} style={shellStyle}>
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
          {leftOpen ? (
            <button
              aria-label="Resize agents panel"
              aria-orientation="vertical"
              className="rail-resize-handle right"
              title="Resize agents panel"
              type="button"
              onKeyDown={(event) => resizeRailWithKeyboard("left", event)}
              onPointerDown={(event) => startRailResize("left", event)}
            />
          ) : null}
        </aside>

        <section className="canvas-shell">
          <div className="flow-wrap">
            <div className="canvas-hud" aria-label="Canvas status">
              <div className="canvas-hud-title">
                <h2><Network size={14} /> Repo Domain Map</h2>
                <span>{repoMap.root ?? "workspace"} / {domainCatalog.length} areas</span>
              </div>
              <div className="canvas-hud-metrics">
                <span><Bot size={12} />{state.presence.length}</span>
                <span><LockKeyhole size={12} />{state.claims.length}</span>
                <span><Activity size={12} />{state.events.length}</span>
                <span><CheckCheck size={12} />{state.decisions.length}</span>
                <span><FileClock size={12} />{state.briefs.length}</span>
              </div>
            </div>
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
              nodeTypes={{ agent: AgentNode, domain: DomainNode, zone: MissionZoneNode }}
              nodes={nodes}
              onMoveEnd={(_, viewport) => writeStoredLayoutViewport(layoutScope, viewport)}
              onNodeDragStop={(_, node) => storeNodePosition(node.id, node.position)}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setRightRailView("inspect");
              }}
              onPaneClick={() => setSelectedNodeId("")}
              proOptions={{ hideAttribution: true }}
            >
              <Background color={settings.theme === "light" ? "rgba(15,23,42,0.08)" : "rgba(226,232,240,0.07)"} gap={28} />
              {settings.showMinimap ? <MiniMap maskColor={settings.theme === "light" ? "rgba(241,245,249,0.85)" : "rgba(15,23,42,0.78)"} nodeStrokeWidth={2} pannable zoomable /> : null}
              <Controls showInteractive={false} />
            </ReactFlow>
            <div className="canvas-toolbar">
              <button aria-label="Select" title="Select" type="button"><MousePointer2 size={14} />Select</button>
              <button aria-label="Zoom out" title="Zoom out" type="button" onClick={() => zoomOut({ duration: 160 })}><ZoomOut size={14} />Out</button>
              <button aria-label="Zoom in" title="Zoom in" type="button" onClick={() => zoomIn({ duration: 160 })}><ZoomIn size={14} />In</button>
              <button aria-label="Fit graph" title="Fit graph" type="button" onClick={() => fitView({ duration: 200, padding: 0.16 })}><Scan size={14} />Fit</button>
              <button aria-label="Focus local neighborhood" title="Focus local neighborhood" type="button" onClick={() => fitView({ duration: 220, nodes: localFocusNodes(nodes, edges, selectedNodeId), padding: 0.28 })}><Orbit size={14} />Local</button>
              <button aria-label="Create mission zone" title="Create mission zone" type="button" onClick={createCustomZone}><Plus size={14} />Zone</button>
              <button aria-label="Reset canvas zones and arrangement" title="Reset canvas zones and arrangement" type="button" onClick={resetCanvasArrangement}><RefreshCw size={14} />Reset</button>
              <button
                aria-label="Focus risk"
                title="Focus risk"
                type="button"
                onClick={() => {
                  setRightRailView("risk");
                  fitView({ duration: 220, nodes: nodes.filter((node) => node.data.state === "failing" || node.data.state === "claimed"), padding: 0.24 });
                }}
              >
                <Crosshair size={14} />Risk
              </button>
            </div>
          </div>
          {settings.showLegend ? (
            <div className="canvas-footer">
              <span><i className="dot blue" /> active work</span>
              <span><i className="dot amber" /> claimed scope</span>
              <span><i className="dot rose" /> failing signal</span>
              <span><i className="dot violet" /> decision attached</span>
            </div>
          ) : null}
        </section>

        <aside className="rail right-rail">
          {rightOpen ? (
            <button
              aria-label="Resize radar panel"
              aria-orientation="vertical"
              className="rail-resize-handle left"
              title="Resize radar panel"
              type="button"
              onKeyDown={(event) => resizeRailWithKeyboard("right", event)}
              onPointerDown={(event) => startRailResize("right", event)}
            />
          ) : null}
          <RailHeader
            count={radarSignalCount}
            icon={<Gauge size={14} />}
            onToggle={() => setRightOpen((value) => !value)}
            open={rightOpen}
            title="Radar"
            toggleIcon={rightOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            tone="risk"
          />
          {rightOpen ? (
            <div className="right-stack">
              <RadarSummary
                activeAgents={state.presence.length}
                activityCount={state.events.length + state.presence.length}
                riskCount={riskCount}
                truthCount={state.claims.length + state.briefs.length + state.decisions.length}
              />
              <RightRailTabs
                activityCount={state.events.length + state.presence.length}
                riskCount={riskCount}
                selected={rightRailView}
                truthCount={state.claims.length + state.briefs.length + state.decisions.length}
                onSelect={setRightRailView}
              />
              <div className="right-panel">
                {rightRailView === "truth" ? (
                  <CurrentTruthPanel
                    activeAgents={state.presence.length}
                    briefs={state.briefs}
                    claims={state.claims}
                    decisions={state.decisions}
                    events={state.events}
                    insights={visibleConflictInsights}
                  />
                ) : null}
                {rightRailView === "inspect" ? (
                  <SelectionInspector
                    defaultAgentId={state.presence[0]?.agent_id ?? "local-agent"}
                    onCreateClaim={createClaim}
                    onReleaseClaim={releaseClaim}
                    releasingClaimId={releasingClaimId}
                    selection={selectedDetails}
                  />
                ) : null}
                {rightRailView === "risk" ? (
                  <RiskQueue
                    insights={visibleConflictInsights}
                    model={model}
                    onAcknowledgeInsight={acknowledgeInsight}
                    onReleaseClaim={releaseClaim}
                    releasingClaimId={releasingClaimId}
                  />
                ) : null}
                {rightRailView === "activity" ? <ActivityStream events={state.events} presence={state.presence} /> : null}
              </div>
            </div>
          ) : <CompactRisk count={riskCount} />}
        </aside>
      </main>
    </div>
  );
}

function PanelDockPresets({
  active,
  onSelect
}: {
  active: PanelDockPreset;
  onSelect(preset: PanelDockPreset): void;
}): React.ReactElement {
  const presets: Array<{ icon: React.ReactNode; label: string; preset: PanelDockPreset }> = [
    { icon: <Waypoints size={13} />, label: "Context panels", preset: "context" },
    { icon: <PanelLeftOpen size={13} />, label: "Agents panel", preset: "agents" },
    { icon: <PanelRightOpen size={13} />, label: "Radar panel", preset: "radar" },
    { icon: <Maximize2 size={13} />, label: "Canvas only", preset: "canvas" },
    { icon: <Minimize2 size={13} />, label: "Focus canvas", preset: "focus" }
  ];

  return (
    <div className="panel-dock-presets" aria-label="Workspace panel dock presets" role="group">
      {presets.map((item) => (
        <button
          aria-label={item.label}
          aria-pressed={active === item.preset}
          className={active === item.preset ? "active" : ""}
          key={item.preset}
          title={item.label}
          type="button"
          onClick={() => onSelect(item.preset)}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

function WelcomeSurface({
  activeProject,
  busy,
  connection,
  error,
  onDismiss,
  onOpenTeam,
  onPathChange,
  onSelectFolder,
  onStartTracking,
  onStopTracking,
  path,
  repoName,
  status,
  suggestedProject,
  trackingStatus
}: {
  activeProject: LocalProject | undefined;
  busy: boolean;
  connection: TeamConnection;
  error: string;
  onDismiss(): void;
  onOpenTeam(): void;
  onPathChange(value: string): void;
  onSelectFolder(): void;
  onStartTracking(): void;
  onStopTracking(): void;
  path: string;
  repoName: string;
  suggestedProject: LocalProjectSuggestion | undefined;
  status: string;
  trackingStatus: ProjectTrackingStatus;
}): React.ReactElement {
  const workspaceName = connection.workspaceName.trim() || displayName(repoName);

  return (
    <section className="welcome-surface" aria-label="Welcome to Suka">
      <nav className="welcome-nav">
        <div className="welcome-brand">
          <span className="brand-mark"><Waypoints size={17} /></span>
          <div>
            <strong>Suka.dev</strong>
            <span>Coordination layer for AI engineering</span>
          </div>
        </div>
        <div className="welcome-nav-actions">
          <Badge tone={status === "connected" ? "live" : "neutral"} icon={<Wifi size={13} />}>{status}</Badge>
          <button type="button" onClick={onDismiss}>
            <Network size={14} />
            Open canvas
          </button>
        </div>
      </nav>
      <div className="welcome-panel">
        <div className="welcome-copy">
          <Badge tone="info" icon={<RadioTower size={13} />}>local-first mission control</Badge>
          <h2>Coordinate agents before the mission collides.</h2>
          <p>
            Suka gives AI coding agents and humans a shared operations map for presence, ownership,
            handoffs, decisions, and conflict signals. Your code stays local; the team gets live intent.
          </p>
          <div className="welcome-actions">
            <button type="button" onClick={onDismiss}>
              <PlayIcon />
              Start local workspace
            </button>
            <button type="button" onClick={onOpenTeam}>
              <Users size={14} />
              Connect team
            </button>
          </div>
          <details className="welcome-command">
            <summary>Agent launch command</summary>
            <code>node packages/cli/dist/bin.js session start --repo {repoName}</code>
          </details>
          <ProjectLaunchPanel
            activeProject={activeProject}
            busy={busy}
            error={error}
            path={path}
            status={trackingStatus}
            suggestedProject={suggestedProject}
            onPathChange={onPathChange}
            onSelectFolder={onSelectFolder}
            onStart={onStartTracking}
            onStop={onStopTracking}
          />
        </div>

        <LiveDemo workspaceName={workspaceName} repoName={repoName} />
      </div>

      {/* ── Feature pills ── */}
      <div className="welcome-features">
        <div className="feature-pill">
          <span className="feature-pill-icon" style={{ color: "var(--teal)" }}><Orbit size={15} /></span>
          <div>
            <strong>Zero-setup presence</strong>
            <span>Agents broadcast location automatically</span>
          </div>
        </div>
        <div className="feature-pill">
          <span className="feature-pill-icon" style={{ color: "var(--rose)" }}><TriangleAlert size={15} /></span>
          <div>
            <strong>Conflict detection</strong>
            <span>Overlapping scopes surface in real time</span>
          </div>
        </div>
        <div className="feature-pill">
          <span className="feature-pill-icon" style={{ color: "var(--violet)" }}><CheckCheck size={15} /></span>
          <div>
            <strong>Shared decisions</strong>
            <span>Decisions persist across agents & sessions</span>
          </div>
        </div>
        <div className="feature-pill">
          <span className="feature-pill-icon" style={{ color: "var(--amber)" }}><FileClock size={15} /></span>
          <div>
            <strong>Handoff briefs</strong>
            <span>Agents leave structured context on exit</span>
          </div>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="welcome-how">
        <p className="how-label">HOW IT WORKS</p>
        <div className="how-steps">
          <div className="how-step">
            <div className="how-step-num">1</div>
            <div className="how-step-body">
              <strong>Agents start a session</strong>
              <span>One CLI command registers the agent into a live workspace with scope, tool, and task.</span>
            </div>
          </div>
          <span className="how-arrow"><ChevronRight size={16} /></span>
          <div className="how-step">
            <div className="how-step-num">2</div>
            <div className="how-step-body">
              <strong>Suka tracks state</strong>
              <span>Presence, ownership claims, events, and conflicts are computed and broadcast continuously.</span>
            </div>
          </div>
          <span className="how-arrow"><ChevronRight size={16} /></span>
          <div className="how-step">
            <div className="how-step-num">3</div>
            <div className="how-step-body">
              <strong>Team sees live intent</strong>
              <span>Humans and other agents read a shared map — no merge conflicts, no duplicate work.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectLaunchPanel({
  activeProject,
  busy,
  error,
  onPathChange,
  onSelectFolder,
  onStart,
  onStop,
  path,
  status,
  suggestedProject
}: {
  activeProject: LocalProject | undefined;
  busy: boolean;
  error: string;
  onPathChange(value: string): void;
  onSelectFolder(): void;
  onStart(): void;
  onStop(): void;
  path: string;
  status: ProjectTrackingStatus;
  suggestedProject: LocalProjectSuggestion | undefined;
}): React.ReactElement {
  const running = status.running;
  const launchPath = path || activeProject?.path || suggestedProject?.path || "";
  const launcherName = activeProject?.name || suggestedProject?.name || "Select project";
  const statusLabel = running ? `${status.detected_agents} detected` : "ready to track";

  return (
    <div className="welcome-launcher" aria-label="Project launcher">
      <div className="launcher-head">
        <div>
          <span><HardDrive size={13} /> launch folder</span>
          <strong>{launcherName}</strong>
        </div>
        <Badge tone={running ? "live" : "neutral"} icon={<RadioTower size={12} />}>
          {running ? "tracking" : "idle"}
        </Badge>
      </div>

      <button className="launcher-open-folder" disabled={busy} type="button" onClick={onSelectFolder}>
        <FolderOpen size={15} />
        Open folder
      </button>

      {!running && suggestedProject !== undefined && suggestedProject.path !== launchPath ? (
        <button className="launcher-suggestion" type="button" onClick={() => onPathChange(suggestedProject.path)}>
          <span><GitBranch size={13} /> Use detected repo</span>
          <code>{suggestedProject.path}</code>
        </button>
      ) : null}

      {error.length > 0 ? <p className="launcher-error">{error}</p> : null}

      {running ? (
        <div className="launcher-actions">
          <span>{statusLabel}</span>
          <button disabled={busy} type="button" onClick={onStop}>
            <X size={14} />
            Stop
          </button>
        </div>
      ) : (
        <details className="launcher-advanced">
          <summary>Enter path manually</summary>
          <label className="launcher-path">
            <span>Advanced path fallback</span>
            <input
              aria-label="Repository path to track"
              placeholder={launchPath || "/Users/name/work/project"}
              value={path}
              onChange={(event) => onPathChange(event.target.value)}
            />
          </label>
          <div className="launcher-actions">
            <span>{statusLabel}</span>
            <button disabled={busy || launchPath.trim().length === 0} type="button" onClick={onStart}>
              <RadioTower size={14} />
              Track manual path
            </button>
          </div>
        </details>
      )}
    </div>
  );
}

/* ── Live animated demo ─────────────────────────────────────── */
type DemoPhase = "idle" | "agent1" | "agent2" | "claim" | "conflict" | "resolve" | "brief" | "reset";

const DEMO_SCRIPT: { phase: DemoPhase; duration: number }[] = [
  { phase: "idle",     duration: 800  },
  { phase: "agent1",   duration: 1400 },
  { phase: "agent2",   duration: 1400 },
  { phase: "claim",    duration: 1600 },
  { phase: "conflict", duration: 2000 },
  { phase: "resolve",  duration: 1800 },
  { phase: "brief",    duration: 2000 },
  { phase: "reset",    duration: 600  },
];

function LiveDemo({ workspaceName, repoName }: { workspaceName: string; repoName: string }): React.ReactElement {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phase = DEMO_SCRIPT[phaseIdx]?.phase ?? "idle";

  useEffect(() => {
    const duration = DEMO_SCRIPT[phaseIdx]?.duration ?? 1000;
    const t = setTimeout(() => {
      setPhaseIdx(i => (i + 1) % DEMO_SCRIPT.length);
    }, duration);
    return () => clearTimeout(t);
  }, [phaseIdx]);

  const showAgent1  = ["agent1","agent2","claim","conflict","resolve","brief"].includes(phase);
  const showAgent2  = ["agent2","claim","conflict","resolve","brief"].includes(phase);
  const showClaim   = ["claim","conflict","resolve","brief"].includes(phase);
  const showConflict = phase === "conflict";
  const showResolve = ["resolve","brief"].includes(phase);
  const showBrief   = phase === "brief";

  const eventLog: { icon: React.ReactNode; text: string; tone: string }[] = [];
  if (showAgent1)   eventLog.push({ icon: <Bot size={11} />,           text: "Codex joined · auth/",     tone: "blue"   });
  if (showAgent2)   eventLog.push({ icon: <Bot size={11} />,           text: "Claude joined · checkout/", tone: "violet" });
  if (showClaim)    eventLog.push({ icon: <LockKeyhole size={11} />,   text: "Codex claimed auth/login",  tone: "teal"   });
  if (showConflict) eventLog.push({ icon: <TriangleAlert size={11} />, text: "Conflict · checkout/api",   tone: "rose"   });
  if (showResolve)  eventLog.push({ icon: <CheckCheck size={11} />,    text: "Resolved · priority: Claude", tone: "green" });
  if (showBrief)    eventLog.push({ icon: <FileClock size={11} />,     text: "Brief posted · handoff ready", tone: "amber" });

  return (
    <div className="live-demo" aria-label="Suka live demo">
      {/* Header */}
      <div className="demo-header">
        <div className="demo-header-left">
          <span className="demo-dot" />
          <strong>{workspaceName}</strong>
          <span className="demo-repo">{repoName}</span>
        </div>
        <Badge tone="live" icon={<Activity size={11} />}>live sim</Badge>
      </div>

      {/* Canvas area */}
      <div className="demo-canvas">
        {/* Domain nodes */}
        <div className="demo-node domain" style={{ left: "50%", top: "36%", transform: "translate(-50%,-50%)" }}>
          <span className="demo-node-icon"><Waypoints size={11} /></span>
          <span>Repo Map</span>
        </div>
        <div className={`demo-node domain auth ${showClaim ? "claimed" : ""}`} style={{ left: "14%", top: "58%" }}>
          <span className="demo-node-icon"><HardDrive size={11} /></span>
          <span>auth/</span>
          {showClaim && <span className="demo-claim-dot" />}
        </div>
        <div className={`demo-node domain checkout ${showConflict ? "conflict" : showResolve ? "resolved" : ""}`} style={{ left: "66%", top: "64%" }}>
          <span className="demo-node-icon"><Code2 size={11} /></span>
          <span>checkout/</span>
          {showConflict && <span className="demo-conflict-badge"><TriangleAlert size={9} /></span>}
          {showResolve  && <span className="demo-resolve-badge"><CheckCheck size={9} /></span>}
        </div>

        {/* Agent nodes */}
        <div className={`demo-agent-node blue ${showAgent1 ? "visible" : ""}`} style={{ left: "6%", top: "18%" }}>
          <Bot size={12} />
          <span>Codex</span>
        </div>
        <div className={`demo-agent-node violet ${showAgent2 ? "visible" : ""}`} style={{ left: "72%", top: "14%" }}>
          <Bot size={12} />
          <span>Claude</span>
        </div>

        {/* Animated edges */}
        <svg className="demo-edges" viewBox="0 0 300 200" preserveAspectRatio="none">
          {showAgent1 && (
            <line className="demo-edge blue" x1="40" y1="46" x2="130" y2="82" />
          )}
          {showAgent2 && (
            <line className="demo-edge violet" x1="230" y1="40" x2="165" y2="82" />
          )}
          {showClaim && (
            <line className="demo-edge teal" x1="130" y1="92" x2="65" y2="122" />
          )}
          {(showConflict || showResolve) && (
            <line className={`demo-edge ${showConflict ? "rose" : "green"}`} x1="165" y1="92" x2="228" y2="132" />
          )}
        </svg>

        {/* Brief bubble */}
        {showBrief && (
          <div className="demo-brief-bubble">
            <FileClock size={10} />
            <span>handoff ready</span>
          </div>
        )}
      </div>

      {/* Event log */}
      <div className="demo-log">
        {eventLog.slice(-3).map((ev, i) => (
          <div key={i} className={`demo-log-row tone-${ev.tone} ${i === eventLog.length - 1 ? "latest" : ""}`}>
            {ev.icon}
            <span>{ev.text}</span>
          </div>
        ))}
        {eventLog.length === 0 && (
          <div className="demo-log-row tone-muted">
            <Orbit size={11} />
            <span>Waiting for agents…</span>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="demo-footer">
        <span><Bot size={11} />{showAgent2 ? "2" : showAgent1 ? "1" : "0"} agents</span>
        <span><LockKeyhole size={11} />{showClaim ? "1" : "0"} claims</span>
        <span><TriangleAlert size={11} />{showConflict ? "1" : "0"} conflicts</span>
        <span><CheckCheck size={11} />{showResolve ? "1" : "0"} decisions</span>
      </div>
    </div>
  );
}

function PlayIcon(): React.ReactElement {
  return (
    <span className="play-icon" aria-hidden="true">
      <span />
    </span>
  );
}

function PreviewNode({ className, label, meta }: { className: string; label: string; meta: string }): React.ReactElement {
  return (
    <div className={`preview-node ${className}`}>
      <strong>{label}</strong>
      <span>{meta}</span>
    </div>
  );
}

function TeamConnectionPanel({
  activeSessionId,
  agents,
  connection,
  onClose,
  onSelectSession,
  onUpdate,
  repoName,
  serverStatus,
  sessionRooms,
  summary
}: {
  activeSessionId: string;
  agents: PresencePointer[];
  connection: TeamConnection;
  onClose(): void;
  onSelectSession(value: string): void;
  onUpdate(value: TeamConnection): void;
  repoName: string;
  serverStatus: string;
  sessionRooms: SessionRoom[];
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
          <button
            aria-pressed={room.id === activeSessionId}
            className={room.id === activeSessionId ? "session-room active" : "session-room"}
            key={room.id}
            type="button"
            onClick={() => onSelectSession(room.id)}
          >
            <div className="session-room-title">
              <strong>{room.session_id}</strong>
              <Badge tone="info" icon={<Users size={12} />}>{room.members.length}</Badge>
            </div>
            <p>{room.workspace_id} / {room.repo_id}</p>
            {room.latestTask !== undefined ? <span>{room.latestTask}</span> : null}
          </button>
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

/* ── Docs panel ──────────────────────────────────────────────── */
const DOCS_SECTIONS = [
  {
    id: "quickstart",
    title: "Quick Start",
    icon: "rocket",
    items: [
      {
        label: "1. Start the server",
        code: "suka serve",
        desc: "Starts the local coordination server on port 4366."
      },
      {
        label: "2. Register your agent",
        code: "eval $(suka session start --repo my-repo --json | jq -r '.env | to_entries[] | \"export \\(.key)=\\(.value)\"')",
        desc: "Registers the agent and exports SUKA_* env vars into the shell."
      },
      {
        label: "3. Broadcast presence",
        code: "suka presence --task \"refactoring auth\" --watch",
        desc: "Keeps the agent visible on the canvas with a heartbeat."
      },
      {
        label: "4. Open the dashboard",
        code: "open http://localhost:5173",
        desc: "View live agent coordination in your browser."
      }
    ]
  },
  {
    id: "session",
    title: "Sessions",
    icon: "session",
    items: [
      { label: "session start", code: "suka session start [--repo NAME] [--agent ID] [--tool TOOL] [--env-file .suka/session.env]", desc: "Registers a new agent session. Outputs env vars to export." },
      { label: "session join", code: "suka session join [--workspace ID] [--repo-id ID] [--session ID] [--task TEXT] [--watch]", desc: "Joins an existing session and begins broadcasting presence." },
      { label: "session status", code: "suka session status [--workspace ID] [--repo-id ID] [--session ID]", desc: "Shows active agents in the current session." },
      { label: "session end", code: "suka session end [--workspace ID] [--repo-id ID] [--session ID]", desc: "Removes the agent from the session." }
    ]
  },
  {
    id: "pointers",
    title: "Pointer Commands",
    icon: "pointer",
    items: [
      { label: "presence", code: "suka presence [--task TEXT] [--file PATH] [--status editing] [--watch]", desc: "Broadcasts what the agent is currently working on. Use --watch for continuous heartbeat." },
      { label: "claim", code: "suka claim <path> [--reason TEXT] [--ttl 45]", desc: "Soft-locks a file path so others know it's in use." },
      { label: "block", code: "suka block <path> [--reason TEXT] [--ttl 45]", desc: "Hard-blocks a path — higher severity than claim." },
      { label: "release", code: "suka release <claim-id>", desc: "Releases a claim or block by ID." },
      { label: "event", code: "suka event <type> <summary> [--path PATH] [--api API]", desc: "Records a coordination event (e.g. file_changed, api_touched)." },
      { label: "decision", code: "suka decision <title> --body TEXT [--status accepted] [--confidence high]", desc: "Posts a shared decision that persists across agents." },
      { label: "brief write", code: "suka brief write <summary> --next TEXT [--changed PATH] [--risk TEXT] [--blocker TEXT]", desc: "Writes a handoff brief so the next agent knows the context." },
      { label: "brief read", code: "suka brief read [--session current]", desc: "Reads the most recent brief for the current session." }
    ]
  },
  {
    id: "inspect",
    title: "Inspect & Debug",
    icon: "inspect",
    items: [
      { label: "status", code: "suka status [--json]", desc: "Prints the full live state: presence, claims, events, decisions, briefs." },
      { label: "conflicts", code: "suka conflicts [--path PATH] [--since-session-start]", desc: "Lists active scope conflicts for the current session." },
      { label: "remind", code: "suka remind [--changed] [--path PATH]", desc: "Prints a truth reminder — decisions and claims relevant to the current work." },
      { label: "team", code: "suka team [--json]", desc: "Shows all active agents across all workspaces." },
      { label: "doctor", code: "suka doctor [--server URL]", desc: "Health-checks the server connection and session context." },
      { label: "cleanup", code: "suka cleanup [--workspace ID] [--repo ID] [--session ID]", desc: "Removes expired presence and stale session data." }
    ]
  },
  {
    id: "env",
    title: "Environment Variables",
    icon: "env",
    items: [
      { label: "SUKA_SERVER_URL", code: "http://127.0.0.1:4366", desc: "Override the default server URL." },
      { label: "SUKA_AGENT_ID", code: "my-agent", desc: "Default agent identity used by all commands." },
      { label: "SUKA_AGENT_TOOL", code: "claude-code", desc: "Agent tool name shown in the dashboard." },
      { label: "SUKA_WORKSPACE_ID", code: "local-my-repo", desc: "Workspace scope for all pointer commands." },
      { label: "SUKA_REPO_ID", code: "my-repo", desc: "Repository identifier within the workspace." },
      { label: "SUKA_SESSION_ID", code: "sess_abc123", desc: "Session ID scoping presence and claims." }
    ]
  }
] as const;

function DocsPanel({ onClose }: { onClose(): void }): React.ReactElement {
  const [activeSection, setActiveSection] = useState<string>("quickstart");
  const section = DOCS_SECTIONS.find(s => s.id === activeSection) ?? DOCS_SECTIONS[0];
  const [copied, setCopied] = useState("");

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 1800);
  }

  return (
    <div className="docs-panel" role="dialog" aria-label="Documentation">
      <div className="docs-head">
        <div className="docs-head-left">
          <BookOpen size={14} />
          <span>Docs</span>
          <span className="docs-shortcut">?</span>
        </div>
        <button aria-label="Close docs" type="button" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="docs-body">
        <nav className="docs-nav">
          {DOCS_SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              className={activeSection === s.id ? "active" : ""}
              onClick={() => setActiveSection(s.id)}
            >
              {s.title}
            </button>
          ))}
        </nav>

        <div className="docs-content">
          <p className="docs-section-title">{section.title}</p>
          {section.items.map((item, i) => (
            <div key={i} className="docs-item">
              <div className="docs-item-head">
                <span className="docs-item-label">{item.label}</span>
              </div>
              <div className="docs-item-code-wrap">
                <code className="docs-item-code">{item.code}</code>
                <button
                  aria-label="Copy command"
                  className="docs-copy-btn"
                  type="button"
                  onClick={() => copyCode(item.code)}
                >
                  {copied === item.code ? <CheckCheck size={11} /> : <Copy size={11} />}
                </button>
              </div>
              <p className="docs-item-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  layoutScopeLabel,
  onClose,
  onResetLayout,
  onUpdate,
  settings,
  status
}: {
  layoutScopeLabel: string;
  onClose(): void;
  onResetLayout(): void;
  onUpdate(patch: Partial<AppSettings>): void;
  settings: AppSettings;
  status: string;
}): React.ReactElement {
  return (
    <section aria-label="Settings" className="settings-panel">
      <div className="settings-head">
        <div>
          <h2><Settings size={14} /> Settings</h2>
          <p>Appearance, canvas &amp; polling</p>
        </div>
        <button aria-label="Close settings" type="button" onClick={onClose}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>
        <div className="settings-row">
          <div className="settings-label">
            <span>Theme</span>
            <p>Switch between dark and light mode</p>
          </div>
          <div className="theme-toggle">
            <button
              aria-pressed={settings.theme === "dark"}
              className={settings.theme === "dark" ? "active" : ""}
              type="button"
              onClick={() => onUpdate({ theme: "dark" })}
            >
              <Moon size={13} />
              Dark
            </button>
            <button
              aria-pressed={settings.theme === "light"}
              className={settings.theme === "light" ? "active" : ""}
              type="button"
              onClick={() => onUpdate({ theme: "light" })}
            >
              <Sun size={13} />
              Light
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-label">
            <span>Density</span>
            <p>Compact reduces spacing throughout</p>
          </div>
          <div className="theme-toggle">
            <button
              aria-pressed={settings.density === "default"}
              className={settings.density === "default" ? "active" : ""}
              type="button"
              onClick={() => onUpdate({ density: "default" })}
            >
              Default
            </button>
            <button
              aria-pressed={settings.density === "compact"}
              className={settings.density === "compact" ? "active" : ""}
              type="button"
              onClick={() => onUpdate({ density: "compact" })}
            >
              Compact
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-label">
            <span>Workspace layout</span>
            <p>{layoutScopeLabel} keeps panel sizes, block arrangement, selection, and canvas position separate.</p>
          </div>
          <button className="settings-reset-btn" type="button" onClick={onResetLayout}>
            <RefreshCw size={12} />
            Reset
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Canvas</h3>
        <div className="settings-row">
          <div className="settings-label">
            <span>Minimap</span>
            <p>Show navigation minimap</p>
          </div>
          <button
            aria-pressed={settings.showMinimap}
            className={`toggle-switch ${settings.showMinimap ? "on" : ""}`}
            type="button"
            onClick={() => onUpdate({ showMinimap: !settings.showMinimap })}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
        <div className="settings-row">
          <div className="settings-label">
            <span>Legend</span>
            <p>Show colour legend below canvas</p>
          </div>
          <button
            aria-pressed={settings.showLegend}
            className={`toggle-switch ${settings.showLegend ? "on" : ""}`}
            type="button"
            onClick={() => onUpdate({ showLegend: !settings.showLegend })}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Polling</h3>
        <div className="settings-row">
          <div className="settings-label">
            <span>Refresh interval</span>
            <p>How often state is fetched from server</p>
          </div>
          <div className="interval-group">
            {([5, 10, 30] as const).map((val) => (
              <button
                aria-pressed={settings.pollingInterval === val}
                className={settings.pollingInterval === val ? "active" : ""}
                key={val}
                type="button"
                onClick={() => onUpdate({ pollingInterval: val })}
              >
                <Timer size={12} />
                {val}s
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>About</h3>
        <div className="settings-about">
          <div>
            <span>Status</span>
            <Badge tone={status === "connected" ? "live" : "neutral"} icon={<Wifi size={11} />}>{status}</Badge>
          </div>
          <div>
            <span>Version</span>
            <code>0.0.0</code>
          </div>
          <div>
            <span>Build</span>
            <code>local-first</code>
          </div>
        </div>
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

function MissionZoneNode({ data }: any): React.ReactElement {
  return (
    <div className={`mission-zone-node ${data.tone} ${data.custom ? "custom" : ""} ${data.custom ? `kind-${data.kind}` : ""}`}>
      <div className="mission-zone-title">
        <span>{data.custom ? data.kindLabel : "mission zone"}</span>
        {data.custom ? (
          <div className="mission-zone-actions">
            <button aria-label={`Change type for ${data.label}`} className="nodrag nopan" title="Change zone type" type="button" onClick={(event) => { event.stopPropagation(); data.onKind?.(); }}>
              <ClipboardList size={11} />
            </button>
            <button aria-label={`Rename ${data.label}`} className="nodrag nopan" title="Rename zone" type="button" onClick={(event) => { event.stopPropagation(); data.onRename?.(); }}>
              <Pencil size={11} />
            </button>
            <button aria-label={`Resize ${data.label}`} className="nodrag nopan" title="Cycle zone size" type="button" onClick={(event) => { event.stopPropagation(); data.onResize?.(); }}>
              <Maximize2 size={11} />
            </button>
            <button aria-label={`Delete ${data.label}`} className="nodrag nopan" title="Delete zone" type="button" onClick={(event) => { event.stopPropagation(); data.onDelete?.(); }}>
              <Trash2 size={11} />
            </button>
          </div>
        ) : null}
      </div>
      <strong>{data.label}</strong>
      <small>{data.custom ? `${data.kindLabel} / drag to organize` : `${data.count} areas`}</small>
    </div>
  );
}

function Badge({ children, icon, tone }: { children: React.ReactNode; icon: React.ReactNode; tone: string }): React.ReactElement {
  return <span className={`badge ${tone}`}>{icon}{children}</span>;
}

function ProjectTrackingControl({
  activeProject,
  busy,
  error,
  onPathChange,
  onSelectFolder,
  onStart,
  onStop,
  path,
  projects,
  status,
  suggestedProject
}: {
  activeProject: LocalProject | undefined;
  busy: boolean;
  error: string;
  onPathChange(value: string): void;
  onSelectFolder(): void;
  onStart(): void;
  onStop(): void;
  path: string;
  projects: LocalProject[];
  status: ProjectTrackingStatus;
  suggestedProject: LocalProjectSuggestion | undefined;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const running = status.running;
  const label = running
    ? `${status.detected_agents} detected`
    : activeProject?.name ?? "track repo";
  const displayPath = activeProject?.path ?? path;
  const recentProjects = projects.slice(0, 4);

  return (
    <div className="tracking-control">
      <button
        aria-expanded={open}
        aria-label="Open workspace tracking selector"
        className="tracking-trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <RadioTower size={14} />
        <span>{label}</span>
      </button>
      {open ? (
        <section className="tracking-popover" aria-label="Workspace tracking">
          <div className="tracking-head">
            <div>
              <h2><HardDrive size={14} /> Local workspace</h2>
              <p>{displayPath.length > 0 ? truncate(displayPath, 64) : "Choose a repo folder to track."}</p>
            </div>
            <Badge tone={running ? "live" : "neutral"} icon={<Wifi size={12} />}>
              {running ? "tracking" : "idle"}
            </Badge>
          </div>

          <div className="tracking-stats">
            <div><strong>{status.detected_agents}</strong><span>detected</span></div>
            <div><strong>{status.published_presence}</strong><span>published</span></div>
            <div><strong>{status.interval_seconds}s</strong><span>refresh</span></div>
          </div>

          {suggestedProject !== undefined ? (
            <button
              className="project-option featured"
              type="button"
              onClick={() => onPathChange(suggestedProject.path)}
            >
              <span><HardDrive size={13} /> Server folder</span>
              <code>{suggestedProject.path}</code>
            </button>
          ) : null}

          <button className="tracking-folder-action" disabled={busy} type="button" onClick={onSelectFolder}>
            <FolderOpen size={14} />
            Open folder
          </button>

          {recentProjects.length > 0 ? (
            <div className="project-list">
              <h3>Recent folders</h3>
              {recentProjects.map((project) => (
                <button
                  className={project.id === activeProject?.id ? "project-option active" : "project-option"}
                  key={project.id}
                  type="button"
                  onClick={() => onPathChange(project.path)}
                >
                  <span><GitBranch size={13} /> {project.name}</span>
                  <code>{project.path}</code>
                </button>
              ))}
            </div>
          ) : null}

          <label className="tracking-path">
            <span>Folder path</span>
            <input
              aria-label="Project folder path"
              placeholder="/Users/name/work/project"
              value={path}
              onChange={(event) => onPathChange(event.target.value)}
            />
          </label>

          {error.length > 0 ? <p className="tracking-error">{error}</p> : null}
          {status.warnings.length > 0 ? <p className="tracking-warning">{status.warnings[0]}</p> : null}

          <div className="tracking-actions">
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
            {running ? (
              <button className="danger-action" disabled={busy} type="button" onClick={onStop}>
                <X size={14} />
                Stop tracking
              </button>
            ) : (
              <button className="primary-action" disabled={busy || path.trim().length === 0} type="button" onClick={onStart}>
                <RadioTower size={14} />
                Track manual path
              </button>
            )}
          </div>
        </section>
      ) : null}
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
  const source = agentSourceLabel(agent);
  const color = agentColor(agent.agent_id);
  return (
    <article className="agent-card" style={{ "--agent-color": color } as React.CSSProperties}>
      <div className="agent-card-band">
        <span className="agent-avatar solid"><Icon size={14} /></span>
        <div className="agent-identity">
          <h3>{agent.agent_id}</h3>
          <p>{identity.label} / {source}</p>
        </div>
        <span className="agent-status-pill"><Activity size={12} />{agent.status}</span>
      </div>
      <div className="agent-card-body">
        <div className="agent-meta-row">
          <span><GitBranch size={12} />{truncate(agent.branch ?? "none", 22)}</span>
          <span><Route size={12} />{agent.current_files?.length ?? 0} files</span>
        </div>
        <p className="task"><Route size={13} />{truncate(agent.task ?? "none", 58)}</p>
        <PathList paths={agent.current_files ?? []} />
      </div>
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

function RadarSummary({
  activeAgents,
  activityCount,
  riskCount,
  truthCount
}: {
  activeAgents: number;
  activityCount: number;
  riskCount: number;
  truthCount: number;
}): React.ReactElement {
  const mode = riskCount > 0 ? "attention" : activeAgents > 0 ? "live" : "idle";
  return (
    <div className={`radar-summary ${mode}`}>
      <div className="radar-summary-main">
        <span><Gauge size={13} />workspace radar</span>
        <strong>{riskCount > 0 ? `${riskCount} items need attention` : activeAgents > 0 ? "Live workspace signal" : "Ready for tracking"}</strong>
      </div>
      <div className="radar-summary-metrics" aria-label="Radar summary metrics">
        <span><Users size={12} />{activeAgents}</span>
        <span><ClipboardList size={12} />{truthCount}</span>
        <span><RadioTower size={12} />{activityCount}</span>
      </div>
    </div>
  );
}

function RightRailTabs({
  activityCount,
  onSelect,
  riskCount,
  selected,
  truthCount
}: {
  activityCount: number;
  onSelect(view: RightRailView): void;
  riskCount: number;
  selected: RightRailView;
  truthCount: number;
}): React.ReactElement {
  const tabs: Array<{ count: number; hint: string; icon: React.ReactNode; label: string; view: RightRailView }> = [
    { count: truthCount, hint: "state", icon: <ClipboardList size={13} />, label: "Truth", view: "truth" },
    { count: 0, hint: "selection", icon: <MousePointer2 size={13} />, label: "Inspect", view: "inspect" },
    { count: riskCount, hint: "conflicts", icon: <TriangleAlert size={13} />, label: "Risk", view: "risk" },
    { count: activityCount, hint: "timeline", icon: <RadioTower size={13} />, label: "Activity", view: "activity" }
  ];

  return (
    <div className="right-tabs" role="tablist" aria-label="Radar panels">
      {tabs.map((tab) => (
        <button
          aria-selected={selected === tab.view}
          className={selected === tab.view ? "active" : ""}
          key={tab.view}
          role="tab"
          type="button"
          onClick={() => onSelect(tab.view)}
        >
          <i>{tab.icon}</i>
          <span><strong>{tab.label}</strong><small>{tab.hint}</small></span>
          {tab.count > 0 ? <b>{tab.count}</b> : null}
        </button>
      ))}
    </div>
  );
}

function CurrentTruthPanel({
  activeAgents,
  briefs,
  claims,
  decisions,
  events,
  insights
}: {
  activeAgents: number;
  briefs: BriefPointer[];
  claims: ClaimPointer[];
  decisions: DecisionPointer[];
  events: EventPointer[];
  insights: ConflictInsight[];
}): React.ReactElement {
  const latestBrief = briefs.slice().sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];
  const latestDecision = decisions.slice().sort((left, right) => pointerTime(right) - pointerTime(left))[0];
  const recentEvents = events.slice().sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)).slice(0, 3);
  const ownerCount = new Set(claims.map((claim) => claim.agent_id)).size;
  const activeBlockers = briefs.flatMap((brief) => brief.blockers).filter(Boolean).slice(0, 3);
  const staleSignals = recentEvents
    .filter((event) => hasCriticalScope(event) || event.event_type.includes("failed"))
    .slice(0, 3);

  return (
    <section className="rail-section truth-section">
      <div className="section-title">
        <h2><ClipboardList size={14} /> Current Truth</h2>
        <Badge tone={insights.length > 0 || activeBlockers.length > 0 ? "risk" : "live"} icon={<Gauge size={13} />}>
          {insights.length + activeBlockers.length} risks
        </Badge>
      </div>
      <div className="truth-grid">
        <TruthStat label="agents" value={activeAgents} />
        <TruthStat label="owners" value={ownerCount} />
        <TruthStat label="claims" value={claims.length} />
        <TruthStat label="briefs" value={briefs.length} />
      </div>
      {latestBrief ? (
        <article className="truth-card primary">
          <div className="rail-card-head">
            <strong><FileClock size={13} />{truncate(latestBrief.summary, 58)}</strong>
            <Badge tone="info" icon={<Bot size={13} />}>{latestBrief.agent_id}</Badge>
          </div>
          <p>{relativeTime(latestBrief.created_at)} / next: {truncate(latestBrief.next_action, 72)}</p>
          <PathList paths={[...latestBrief.changed_files, ...latestBrief.related_claims, ...latestBrief.related_sessions]} />
        </article>
      ) : (
        <EmptyState icon={<FileClock size={15} />} title="No handoff brief" text="Agents have not written a session brief for this workspace yet." />
      )}
      <TruthList
        icon={<LockKeyhole size={13} />}
        items={claims.slice(0, 3).map((claim) => ({
          key: claim.id,
          meta: `${claim.kind === "blocked_scope" ? "blocked by" : "owned by"} ${claim.agent_id}`,
          paths: scopeValues(claim.scope),
          title: claim.reason
        }))}
        title="Ownership"
      />
      <TruthList
        icon={<Activity size={13} />}
        items={recentEvents.map((event) => ({
          key: `${event.agent_id}:${event.created_at}:${event.summary}`,
          meta: `${event.agent_id} / ${relativeTime(event.created_at)}`,
          paths: eventScopeValues(event),
          title: event.summary
        }))}
        title="Recent Changes"
      />
      <TruthList
        icon={<CheckCheck size={13} />}
        items={latestDecision ? [{
          key: latestDecision.title,
          meta: latestDecision.confidence ?? latestDecision.status,
          paths: scopeValues(latestDecision.scope),
          title: latestDecision.title
        }] : []}
        title="Accepted Decision"
      />
      <TruthList
        icon={<TriangleAlert size={13} />}
        items={[
          ...activeBlockers.map((blocker, index) => ({
            key: `blocker:${index}:${blocker}`,
            meta: "brief blocker",
            paths: [],
            title: blocker
          })),
          ...staleSignals.map((event) => ({
            key: `stale:${event.agent_id}:${event.created_at}:${event.summary}`,
            meta: event.event_type,
            paths: eventScopeValues(event),
            title: `Recent ${event.event_type.replaceAll("_", " ")}`
          })),
          ...insights.slice(0, 2).map((insight) => ({
            key: insight.id,
            meta: insight.severity,
            paths: insight.paths,
            title: insight.message
          }))
        ]}
        title="Risky To Touch"
      />
    </section>
  );
}

function TruthStat({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TruthList({
  icon,
  items,
  title
}: {
  icon: React.ReactNode;
  items: Array<{ key: string; meta: string; paths: string[]; title: string }>;
  title: string;
}): React.ReactElement {
  return (
    <div className="truth-list">
      <h3>{icon}{title}</h3>
      {items.length === 0 ? <p className="empty">None.</p> : items.map((item) => (
        <article className="truth-row" key={item.key}>
          <div>
            <strong>{truncate(item.title, 62)}</strong>
            <span>{truncate(item.meta, 68)}</span>
          </div>
          <PathList paths={item.paths} />
        </article>
      ))}
    </div>
  );
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
        <div className="section-title">
          <h2><MousePointer2 size={14} /> Inspector</h2>
          <Badge tone="neutral" icon={<MousePointer2 size={13} />}>idle</Badge>
        </div>
        <EmptyState icon={<MousePointer2 size={15} />} title="Nothing selected" text="Select an agent or domain on the canvas to inspect ownership, files, and claim actions." />
      </section>
    );
  }

  if (selection.kind === "agent") {
    const identity = agentIdentity(selection.agent);
    const Icon = identity.icon;
    return (
      <section className="rail-section inspector-section">
        <div className="section-title">
          <h2><Icon size={14} /> Inspector</h2>
          <Badge tone="live" icon={<Activity size={13} />}>{selection.agent.status}</Badge>
        </div>
        <div className="inspector-hero">
          <span className="agent-avatar solid" style={{ background: agentColor(selection.agent.agent_id) }}><Icon size={15} /></span>
          <div>
            <strong>{selection.agent.agent_id}</strong>
            <p>{identity.label} / {agentSourceLabel(selection.agent)}</p>
          </div>
        </div>
        <div className="inspector-grid">
          <span>tool</span><strong>{identity.label}</strong>
          <span>source</span><strong>{agentSourceLabel(selection.agent)}</strong>
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
      <div className="section-title">
        <h2><Network size={14} /> Inspector</h2>
        <Badge tone={domain.failures.length > 0 ? "fail" : domain.claims.length > 0 ? "risk" : "neutral"} icon={<Gauge size={13} />}>
          {domainState(domain)}
        </Badge>
      </div>
      <div className="inspector-hero">
        <span className="domain-inspector-mark" style={{ borderColor: stateColor(domain), color: stateColor(domain) }}><Network size={15} /></span>
        <div>
          <strong>{domain.name}</strong>
          <p>{domain.path ?? domain.id}</p>
        </div>
      </div>
      <div className="inspector-grid">
        <span>state</span><strong>{domainState(domain)}</strong>
        <span>path</span><strong>{domain.path ?? domain.id}</strong>
        <span>kind</span><strong>{domain.kind ?? "domain"}</strong>
        <span>package</span><strong>{domain.package_name ?? "none"}</strong>
        <span>files</span><strong>{domain.file_count ?? 0}</strong>
        <span>tests</span><strong>{domain.test_count ?? 0}</strong>
        <span>routes</span><strong>{domain.route_count ?? 0}</strong>
        <span>agents</span><strong>{domain.presence.length}</strong>
        <span>claims</span><strong>{domain.claims.length}</strong>
        <span>events</span><strong>{domain.events.length}</strong>
      </div>
      <PathList paths={domain.routes ?? []} />
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
      <div className="section-title">
        <h2><TriangleAlert size={14} /> Risk Queue</h2>
        <Badge tone={insights.length > 0 || risky.length > 0 ? "risk" : "live"} icon={<Gauge size={13} />}>
          {insights.length + risky.length}
        </Badge>
      </div>
      {insights.length === 0 && risky.length === 0 ? (
        <EmptyState icon={<CheckCheck size={15} />} title="No active risk" text="No risky domains, blockers, or conflict warnings are currently active." />
      ) : null}
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
            <Badge tone={domain.failures.length > 0 || hasBlockedClaims(domain) ? "fail" : "risk"} icon={domain.failures.length > 0 || hasBlockedClaims(domain) ? <TriangleAlert size={13} /> : <LockKeyhole size={13} />}>{domain.failures.length > 0 ? "failing" : hasBlockedClaims(domain) ? "blocked" : "claimed"}</Badge>
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

function ActivityStream({ events, presence }: { events: EventPointer[]; presence: PresencePointer[] }): React.ReactElement {
  const recentEvents = events.slice().sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)).slice(0, 4);
  const recentPresence = presence.slice().sort((left, right) => Date.parse(right.last_seen ?? "") - Date.parse(left.last_seen ?? "")).slice(0, Math.max(0, 6 - recentEvents.length));

  return (
    <section className="rail-section activity-section">
      <div className="section-title">
        <h2><RadioTower size={14} /> Activity</h2>
        <Badge tone={recentEvents.length + recentPresence.length > 0 ? "live" : "neutral"} icon={<Activity size={13} />}>
          {recentEvents.length + recentPresence.length}
        </Badge>
      </div>
      {recentEvents.map((event) => (
        <article className="rail-card" key={`${event.agent_id}:${event.created_at}:${event.summary}`}>
          <div className="rail-card-head">
            <strong><Activity size={13} />{truncate(event.summary, 54)}</strong>
            <Badge tone="neutral" icon={<Sparkles size={13} />}>{event.event_type}</Badge>
          </div>
          <p>{event.agent_id} / {event.created_at}</p>
          <PathList paths={eventScopeValues(event)} />
        </article>
      ))}
      {recentPresence.map((agent) => {
        const identity = agentIdentity(agent);
        const Icon = identity.icon;
        return (
          <article className="rail-card" key={`presence:${agent.agent_id}:${agent.last_seen ?? ""}`}>
            <div className="rail-card-head">
              <strong><Icon size={13} />{truncate(agent.task ?? `${identity.label} active`, 54)}</strong>
              <Badge tone="live" icon={<Activity size={13} />}>{agent.status}</Badge>
            </div>
            <p>{agent.agent_id} / {agent.last_seen ? relativeTime(agent.last_seen) : "active now"}</p>
            <PathList paths={agent.current_files ?? []} />
          </article>
        );
      })}
      {recentEvents.length === 0 && recentPresence.length === 0 ? (
        <EmptyState icon={<RadioTower size={15} />} title="No recent activity" text="Detected agents, events, and session updates will appear here as the workspace changes." />
      ) : null}
    </section>
  );
}

function EmptyState({ icon, text, title }: { icon: React.ReactNode; text: string; title: string }): React.ReactElement {
  return (
    <div className="panel-empty">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function PathList({ paths }: { paths: string[] }): React.ReactElement {
  const safePaths = paths.filter(Boolean).slice(0, 4);
  if (safePaths.length === 0) {
    return <p className="empty">paths: none</p>;
  }
  return <div className="paths">{safePaths.map((path) => <code key={path}>{path}</code>)}</div>;
}

function normalizeState(state: Partial<SukaState>): SukaState {
  return {
    briefs: Array.isArray(state.briefs) ? state.briefs : [],
    claims: Array.isArray(state.claims) ? state.claims : [],
    decisions: Array.isArray(state.decisions) ? state.decisions : [],
    events: Array.isArray(state.events) ? state.events : [],
    presence: Array.isArray(state.presence) ? state.presence : []
  };
}

function buildDomainModel(state: SukaState, domains: Domain[]): DomainModel[] {
  return domains.map((domain) => {
    const claims = state.claims.filter((item) => touchesDomain(domain, scopeValues(item.scope)));
    const presence = state.presence.filter((item) => touchesDomain(domain, [...(item.current_files ?? []), item.task ?? "", item.branch ?? ""]));
    const events = state.events.filter((item) => touchesDomain(domain, [...eventScopeValues(item), item.summary ?? ""]));
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

function buildFlow(
  model: DomainModel[],
  state: SukaState,
  selectedNodeId: string,
  repoEdges: RepoMapEdge[],
  nodePositions: NodePositionMap,
  customZones: CustomCanvasZone[],
  zoneActions: {
    onDelete(zoneId: string): void;
    onKind(zoneId: string): void;
    onRename(zoneId: string): void;
    onResize(zoneId: string): void;
  }
): { edges: Edge[]; nodes: Node[] } {
  const domainPositions = new Map(model.map((domain) => [
    domain.id,
    readNodePosition(nodePositions, domain.id, { x: domain.x, y: domain.y })
  ]));
  const missionZones = buildMissionZones(model, domainPositions);
  const nodes: Node[] = [
    ...customZones.map((zone) => ({
      data: {
        count: 0,
        custom: true,
        kind: zone.kind,
        kindLabel: customZoneKindLabel(zone.kind),
        label: zone.label,
        onDelete: () => zoneActions.onDelete(zone.id),
        onKind: () => zoneActions.onKind(zone.id),
        onRename: () => zoneActions.onRename(zone.id),
        onResize: () => zoneActions.onResize(zone.id),
        tone: zone.tone
      },
      id: `custom-zone:${zone.id}`,
      position: { x: zone.x, y: zone.y },
      selectable: false,
      style: {
        height: zone.height,
        width: zone.width
      },
      type: "zone",
      zIndex: 1
    })),
    ...missionZones.map((zone) => ({
      data: {
        custom: false,
        count: zone.count,
        label: zone.label,
        tone: zone.tone
      },
      draggable: false,
      id: zone.id,
      position: zone.position,
      selectable: false,
      style: {
        height: zone.height,
        width: zone.width
      },
      type: "zone",
      zIndex: 0
    })),
    ...model.map((domain) => ({
      id: domain.id,
      type: "domain",
      position: domainPositions.get(domain.id) ?? { x: domain.x, y: domain.y },
      selected: selectedNodeId === domain.id,
      zIndex: 2,
      data: {
        agents: domain.presence.length,
        claims: domain.claims.length,
        color: stateColor(domain),
        label: domain.name,
        meta: `${domain.file_count ?? 0} files / ${domain.test_count ?? 0} tests / ${domain.route_count ?? 0} routes`,
        state: domainState(domain)
      }
    })),
    ...state.presence.map((agent, index) => {
      const identity = agentIdentity(agent);
      const domain = model.find((item) => touchesDomain(item, [...(agent.current_files ?? []), agent.task ?? "", agent.branch ?? ""]));
      const domainPosition = domain ? domainPositions.get(domain.id) : undefined;
      const base = domainPosition ? { x: domainPosition.x + 122, y: domainPosition.y - 22 } : { x: 420 + index * 48, y: 230 };
      return {
        id: `agent:${agent.agent_id}`,
        type: "agent",
        position: readNodePosition(nodePositions, `agent:${agent.agent_id}`, { x: base.x + index * 26, y: base.y + index * 8 }),
        selected: selectedNodeId === `agent:${agent.agent_id}`,
        zIndex: 3,
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

function buildMissionZones(model: DomainModel[], domainPositions: Map<string, { x: number; y: number }>): Array<{
  count: number;
  height: number;
  id: string;
  label: string;
  position: { x: number; y: number };
  tone: string;
  width: number;
}> {
  const groups = new Map<string, DomainModel[]>();
  for (const domain of model) {
    const key = missionZoneKey(domain);
    groups.set(key, [...(groups.get(key) ?? []), domain]);
  }

  return [...groups.entries()].map(([key, domains], index) => {
    const bounds = zoneBounds(domains, domainPositions);
    return {
      count: domains.length,
      height: bounds.height,
      id: `zone:${key}`,
      label: missionZoneLabel(key),
      position: bounds.position,
      tone: missionZoneTone(index),
      width: bounds.width
    };
  }).sort((left, right) => left.label.localeCompare(right.label));
}

function zoneBounds(domains: DomainModel[], domainPositions: Map<string, { x: number; y: number }>): {
  height: number;
  position: { x: number; y: number };
  width: number;
} {
  const marginX = 42;
  const marginTop = 48;
  const marginBottom = 34;
  const nodeWidth = 136;
  const nodeHeight = 82;
  const positions = domains.map((domain) => domainPositions.get(domain.id) ?? { x: domain.x, y: domain.y });
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxX = Math.max(...positions.map((position) => position.x + nodeWidth));
  const maxY = Math.max(...positions.map((position) => position.y + nodeHeight));
  return {
    height: Math.max(138, maxY - minY + marginTop + marginBottom),
    position: { x: minX - marginX, y: minY - marginTop },
    width: Math.max(220, maxX - minX + marginX * 2)
  };
}

function missionZoneKey(domain: Domain): string {
  if (domain.kind && domain.kind.length > 0) return domain.kind;
  const path = domain.path ?? domain.id;
  return path.split(/[\\/]/).filter(Boolean)[0] ?? "workspace";
}

function missionZoneLabel(key: string): string {
  return key.split(/[-_\s]/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ") || "Workspace";
}

function missionZoneTone(index: number): string {
  const tones = ["blue", "teal", "violet", "amber", "slate"];
  return tones[index % tones.length] ?? "blue";
}

const customZoneKinds: CustomZoneKind[] = ["mission", "ownership", "risk", "handoff", "blocked", "agent"];

function readCustomZoneKind(value: unknown): CustomZoneKind {
  return customZoneKinds.includes(value as CustomZoneKind) ? value as CustomZoneKind : "mission";
}

function nextCustomZoneKind(kind: CustomZoneKind): CustomZoneKind {
  const index = customZoneKinds.indexOf(kind);
  return customZoneKinds[(index + 1) % customZoneKinds.length] ?? "mission";
}

function customZoneKindLabel(kind: CustomZoneKind): string {
  switch (kind) {
    case "ownership": return "Ownership zone";
    case "risk": return "Risk zone";
    case "handoff": return "Handoff zone";
    case "blocked": return "Do-not-touch zone";
    case "agent": return "Agent lane";
    default: return "Mission zone";
  }
}

function readNodePosition(nodePositions: NodePositionMap, nodeId: string, fallback: { x: number; y: number }): { x: number; y: number } {
  const stored = nodePositions[nodeId];
  return stored === undefined ? fallback : stored;
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

function eventScopeValues(event: EventPointer): string[] {
  return [
    ...(event.affected_paths ?? []),
    ...(event.affected_apis ?? []),
    ...(event.affected_tables ?? []),
    ...(event.affected_env ?? [])
  ];
}

function hasCriticalScope(event: EventPointer): boolean {
  return Boolean(
    (event.affected_apis?.length ?? 0) > 0 ||
    (event.affected_tables?.length ?? 0) > 0 ||
    (event.affected_env?.length ?? 0) > 0
  );
}

function pointerTime(pointer: { created_at?: string; updated_at?: string }): number {
  const value = Date.parse(pointer.updated_at ?? pointer.created_at ?? "");
  return Number.isNaN(value) ? 0 : value;
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
  if (hasBlockedClaims(domain)) return "blocked";
  if (domain.claims.length > 0) return "claimed";
  if (domain.presence.length > 0) return "active";
  if (domain.decisions.length > 0) return "decision";
  return "clear";
}

function stateColor(domain: DomainModel): string {
  if (domain.failures.length > 0) return "#e11d48";
  if (hasBlockedClaims(domain)) return "#e11d48";
  if (domain.claims.length > 0) return "#d97706";
  if (domain.presence.length > 0) return "#2563eb";
  if (domain.decisions.length > 0) return "#4f46e5";
  return domain.color;
}

function hasBlockedClaims(domain: DomainModel): boolean {
  return domain.claims.some((claim) => claim.kind === "blocked_scope");
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

function agentSourceLabel(agent: PresencePointer): string {
  return agent.source?.kind === "detected" ? "detected" : "manual";
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

function relativeTime(timestamp: string): string {
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) return "unknown";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
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

function readStoredSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  const raw = readStorageValue("settings");
  if (!raw) return defaultSettings;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      density: parsed.density === "compact" ? "compact" : "default",
      pollingInterval: [5, 10, 30].includes(parsed.pollingInterval as number) ? (parsed.pollingInterval as 5 | 10 | 30) : 5,
      showLegend: typeof parsed.showLegend === "boolean" ? parsed.showLegend : true,
      showMinimap: typeof parsed.showMinimap === "boolean" ? parsed.showMinimap : true,
      theme: parsed.theme === "light" ? "light" : "dark"
    };
  } catch {
    return defaultSettings;
  }
}

function writeStoredSettings(value: AppSettings): void {
  writeStorageValue("settings", JSON.stringify(value));
}

function readStoredRightRailView(): RightRailView {
  const value = readStoredString("rightRailView");
  return value === "inspect" || value === "risk" || value === "activity" ? value : "truth";
}

function readStoredLayout(scope: string): WorkspaceLayout {
  return {
    customZones: readStoredLayoutCustomZones(scope),
    leftOpen: readStoredLayoutBoolean(scope, "leftOpen", true),
    leftRailWidth: readStoredLayoutNumber(scope, "leftRailWidth", DEFAULT_LEFT_RAIL_WIDTH, LEFT_RAIL_MIN_WIDTH, LEFT_RAIL_MAX_WIDTH),
    nodePositions: readStoredLayoutNodePositions(scope),
    rightOpen: readStoredLayoutBoolean(scope, "rightOpen", true),
    rightRailWidth: readStoredLayoutNumber(scope, "rightRailWidth", DEFAULT_RIGHT_RAIL_WIDTH, RIGHT_RAIL_MIN_WIDTH, RIGHT_RAIL_MAX_WIDTH),
    selectedNodeId: readStoredLayoutString(scope, "selectedNodeId"),
    viewport: readStoredLayoutViewport(scope)
  };
}

function readStoredLayoutBoolean(scope: string, key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const value = readLayoutStorageValue(scope, key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function writeStoredLayoutBoolean(scope: string, key: string, value: boolean): void {
  writeLayoutStorageValue(scope, key, String(value));
}

function readStoredLayoutNumber(scope: string, key: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") return fallback;
  const value = Number(readLayoutStorageValue(scope, key));
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function writeStoredLayoutNumber(scope: string, key: string, value: number): void {
  writeLayoutStorageValue(scope, key, String(Math.round(value)));
}

function readStoredLayoutString(scope: string, key: string): string {
  if (typeof window === "undefined") return "";
  return readLayoutStorageValue(scope, key) ?? "";
}

function writeStoredLayoutString(scope: string, key: string, value: string): void {
  if (value.length === 0) {
    removeLayoutStorageValue(scope, key);
    return;
  }
  writeLayoutStorageValue(scope, key, value);
}

function readStoredLayoutViewport(scope: string): Viewport | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = readLayoutStorageValue(scope, "viewport");
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

function writeStoredLayoutViewport(scope: string, viewport: Viewport): void {
  writeLayoutStorageValue(scope, "viewport", JSON.stringify(viewport));
}

function readStoredLayoutNodePositions(scope: string): NodePositionMap {
  if (typeof window === "undefined") return {};
  const raw = readLayoutStorageValue(scope, "nodePositions");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const positions: NodePositionMap = {};
    for (const [nodeId, value] of Object.entries(parsed)) {
      if (typeof nodeId !== "string" || typeof value !== "object" || value === null) continue;
      const candidate = value as Partial<{ x: unknown; y: unknown }>;
      if (typeof candidate.x !== "number" || typeof candidate.y !== "number") continue;
      if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) continue;
      positions[nodeId] = {
        x: Math.round(candidate.x),
        y: Math.round(candidate.y)
      };
    }
    return positions;
  } catch {
    return {};
  }
}

function writeStoredLayoutNodePositions(scope: string, positions: NodePositionMap): void {
  if (Object.keys(positions).length === 0) {
    removeLayoutStorageValue(scope, "nodePositions");
    return;
  }
  writeLayoutStorageValue(scope, "nodePositions", JSON.stringify(positions));
}

function readStoredLayoutCustomZones(scope: string): CustomCanvasZone[] {
  if (typeof window === "undefined") return [];
  const raw = readLayoutStorageValue(scope, "customZones");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): CustomCanvasZone[] => {
      if (typeof item !== "object" || item === null) return [];
      const candidate = item as Partial<Record<keyof CustomCanvasZone, unknown>>;
      if (typeof candidate.id !== "string" || candidate.id.length === 0) return [];
      if (typeof candidate.label !== "string" || candidate.label.length === 0) return [];
      if (typeof candidate.tone !== "string") return [];
      if (typeof candidate.x !== "number" || typeof candidate.y !== "number") return [];
      if (typeof candidate.width !== "number" || typeof candidate.height !== "number") return [];
      if (![candidate.x, candidate.y, candidate.width, candidate.height].every(Number.isFinite)) return [];
      return [{
        height: clamp(Math.round(candidate.height), 120, 680),
        id: candidate.id,
        kind: readCustomZoneKind(candidate.kind),
        label: candidate.label.slice(0, 48),
        tone: candidate.tone,
        width: clamp(Math.round(candidate.width), 180, 900),
        x: Math.round(candidate.x),
        y: Math.round(candidate.y)
      }];
    });
  } catch {
    return [];
  }
}

function writeStoredLayoutCustomZones(scope: string, zones: CustomCanvasZone[]): void {
  if (zones.length === 0) {
    removeLayoutStorageValue(scope, "customZones");
    return;
  }
  writeLayoutStorageValue(scope, "customZones", JSON.stringify(zones));
}

function removeStoredLayout(scope: string): void {
  for (const key of layoutStorageKeys) {
    removeLayoutStorageValue(scope, key);
  }
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

function createLayoutStorageScope(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? stableHash(normalized) : "default";
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readLayoutStorageValue(scope: string, key: string): string | null {
  try {
    return window.localStorage.getItem(`${layoutStoragePrefix}${scope}.${key}`);
  } catch {
    return null;
  }
}

function writeLayoutStorageValue(scope: string, key: string, value: string): void {
  try {
    window.localStorage.setItem(`${layoutStoragePrefix}${scope}.${key}`, value);
  } catch {
    // Storage is best-effort; the dashboard remains fully usable without it.
  }
}

function removeLayoutStorageValue(scope: string, key: string): void {
  try {
    window.localStorage.removeItem(`${layoutStoragePrefix}${scope}.${key}`);
  } catch {
    // Storage is best-effort; the dashboard remains fully usable without it.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ReactFlowProvider>
      <Dashboard />
    </ReactFlowProvider>
  </React.StrictMode>
);
