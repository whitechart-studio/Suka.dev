import type { DetectedLocalAgent, DetectLocalAgentsOptions, LocalAgentDetectionReport } from "@suka/local-agents";
import { detectLocalAgents } from "@suka/local-agents";
import type { PresenceStatus } from "@suka/protocol";
import { isAbsolute, relative, resolve } from "node:path";
import type { SukaService } from "./service.js";
import type { LocalProject } from "./state.js";

const DEFAULT_TRACKING_INTERVAL_SECONDS = 15;
const DEFAULT_TRACKING_TTL_SECONDS = 45;

export interface ProjectTrackingStatus {
  active_project_id?: string;
  detected_agents: number;
  interval_seconds: number;
  last_run_at?: string;
  published_presence: number;
  running: boolean;
  warnings: string[];
}

export interface ProjectTrackingOptions {
  detectLocalAgents?: (options?: DetectLocalAgentsOptions) => LocalAgentDetectionReport;
  intervalSeconds?: number;
  now?: () => Date;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  ttlSeconds?: number;
}

export class ProjectTrackingWorker {
  readonly #detectLocalAgents: (options?: DetectLocalAgentsOptions) => LocalAgentDetectionReport;
  readonly #intervalSeconds: number;
  readonly #now: () => Date;
  readonly #service: SukaService;
  readonly #sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  readonly #ttlSeconds: number;
  #abortController: AbortController | undefined;
  #activeProjectId: string | undefined;
  #lastReport: LocalAgentDetectionReport | undefined;
  #publishedPresence = 0;
  #runPromise: Promise<void> | undefined;

  constructor(service: SukaService, options: ProjectTrackingOptions = {}) {
    this.#service = service;
    this.#detectLocalAgents = options.detectLocalAgents ?? detectLocalAgents;
    this.#intervalSeconds = options.intervalSeconds ?? DEFAULT_TRACKING_INTERVAL_SECONDS;
    this.#now = options.now ?? (() => new Date());
    this.#sleep = options.sleep ?? sleep;
    this.#ttlSeconds = options.ttlSeconds ?? DEFAULT_TRACKING_TTL_SECONDS;
  }

  start(projectId?: string): ProjectTrackingStatus {
    const project = projectId === undefined ? this.#service.getActiveProject() : this.#findProject(projectId);
    if (project === undefined) {
      throw new ProjectTrackingError("project_not_found", "Project was not found.");
    }

    if (this.#activeProjectId === project.id && this.#abortController !== undefined && !this.#abortController.signal.aborted) {
      return this.status();
    }

    this.stop();
    this.#activeProjectId = project.id;
    this.#abortController = new AbortController();
    try {
      this.runOnce();
    } catch (error) {
      this.stop();
      throw error;
    }
    this.#runPromise = this.#runLoop(project.id, this.#abortController.signal);
    return this.status();
  }

  stop(): ProjectTrackingStatus {
    const project = this.#activeProjectId === undefined ? undefined : this.#findProject(this.#activeProjectId);
    this.#abortController?.abort();
    this.#abortController = undefined;
    this.#runPromise = undefined;
    this.#activeProjectId = undefined;

    if (project !== undefined) {
      this.#service.cleanup({
        repo_id: project.repo_id,
        session_id: trackingSessionId(project),
        workspace_id: project.workspace_id
      });
    }

    return this.status();
  }

  status(): ProjectTrackingStatus {
    return {
      ...(this.#activeProjectId === undefined ? {} : { active_project_id: this.#activeProjectId }),
      detected_agents: this.#lastReport?.agents.length ?? 0,
      interval_seconds: this.#intervalSeconds,
      ...(this.#lastReport === undefined ? {} : { last_run_at: this.#lastReport.generated_at }),
      published_presence: this.#publishedPresence,
      running: this.#abortController !== undefined && !this.#abortController.signal.aborted,
      warnings: [...this.#lastReport?.warnings ?? []]
    };
  }

  runOnce(): ProjectTrackingStatus {
    const project = this.#activeProjectId === undefined ? this.#service.getActiveProject() : this.#findProject(this.#activeProjectId);
    if (project === undefined) {
      throw new ProjectTrackingError("project_not_found", "Project was not found.");
    }

    const now = this.#now();
    const options: DetectLocalAgentsOptions = {
      now,
      repoRoot: project.repo_root
    };
    if (project.branch !== undefined) {
      options.branch = project.branch;
    }
    const report = this.#detectLocalAgents(options);
    this.#lastReport = report;
    this.#publishedPresence = 0;
    for (const agent of report.agents) {
      const result = this.#service.publish(buildTrackedPresence(project, agent, now, this.#ttlSeconds));
      if (!result.ok) {
        throw new Error("Failed to publish tracked presence.");
      }
      this.#publishedPresence += 1;
    }
    return this.status();
  }

  async #runLoop(projectId: string, signal: AbortSignal): Promise<void> {
    while (!signal.aborted && this.#activeProjectId === projectId) {
      await this.#sleep(this.#intervalSeconds * 1000, signal);
      if (!signal.aborted && this.#activeProjectId === projectId) {
        try {
          this.runOnce();
        } catch {
          this.stop();
          return;
        }
      }
    }
  }

  #findProject(projectId: string): LocalProject | undefined {
    return this.#service.listProjects().find((project) => project.id === projectId);
  }
}

export class ProjectTrackingError extends Error {
  constructor(readonly code: "project_not_found", message: string) {
    super(message);
  }
}

function buildTrackedPresence(
  project: LocalProject,
  agent: DetectedLocalAgent,
  now: Date,
  ttlSeconds: number
): Record<string, unknown> {
  const cwd = relativeProjectPath(project.repo_root, agent.cwd);
  return {
    type: "presence",
    id: createTrackedPresenceId(project, agent),
    workspace_id: project.workspace_id,
    repo_id: project.repo_id,
    session_id: trackingSessionId(project),
    agent_id: agent.agent_id,
    tool: agent.tool,
    source: {
      kind: "detected",
      detector: agent.detection_source,
      pid: agent.pid,
      cwd,
      detected_at: now.toISOString()
    },
    repo: project.repo,
    branch: agent.branch ?? project.branch,
    task: `Detected ${agent.tool} in ${cwd}`,
    status: "online" satisfies PresenceStatus,
    current_files: agent.current_files.filter(isPublicProjectPath),
    last_seen: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString()
  };
}

function relativeProjectPath(repoRoot: string, path: string): string {
  const relativePath = relative(resolve(repoRoot), resolve(path));
  if (relativePath.length === 0) {
    return ".";
  }
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return ".";
  }
  return relativePath.replaceAll("\\", "/");
}

function isPublicProjectPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === ".claude" || segment === ".agents" || segment === "node_modules")) {
    return false;
  }
  if (normalized === ".env" || normalized.startsWith(".env.")) {
    return false;
  }
  return !normalized.startsWith(".agent/skills/");
}

function trackingSessionId(project: LocalProject): string {
  return `project-tracking-${project.id}`;
}

function createTrackedPresenceId(project: LocalProject, agent: DetectedLocalAgent): string {
  return `ptr_presence_${project.id}_${agent.agent_id}`.replace(/[^a-zA-Z0-9_-]/gu, "_");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
