import type {
  CoordinationContext,
  Pointer,
  PresencePointer,
  TeamConnectionSummary,
  TeamWorkspaceSummary
} from "@suka/protocol";
import type { SukaState } from "./state.js";

const LOCAL_WORKSPACE_ID = "local";
const LOCAL_REPO_ID = "local-repo";
const LOCAL_SESSION_ID = "local-session";

export function buildTeamSummary(state: SukaState, now = new Date()): TeamConnectionSummary {
  const workspaceMap = new Map<string, MutableWorkspaceSummary>();

  for (const pointer of allPointers(state)) {
    const workspaceId = pointer.workspace_id ?? LOCAL_WORKSPACE_ID;
    const workspace = ensureWorkspace(workspaceMap, workspaceId);
    const repoId = pointer.repo_id ?? repoIdFromPointer(pointer);
    const sessionId = pointer.session_id ?? LOCAL_SESSION_ID;

    if (repoId !== undefined) workspace.repoIds.add(repoId);
    if (sessionId !== undefined) workspace.sessionIds.add(sessionId);

    switch (pointer.type) {
      case "presence":
        workspace.active_agents += 1;
        break;
      case "claim":
        workspace.claims += 1;
        break;
      case "event":
        workspace.events += 1;
        break;
      case "decision":
        workspace.decisions += 1;
        break;
    }
  }

  const members = state.presence
    .map(toMemberSummary)
    .sort((left, right) => Date.parse(right.last_seen) - Date.parse(left.last_seen));

  const workspaces = [...workspaceMap.values()].map(toWorkspaceSummary).sort((left, right) => {
    if (right.active_agents !== left.active_agents) return right.active_agents - left.active_agents;
    return left.workspace_id.localeCompare(right.workspace_id);
  });

  return {
    active_agents: members.length,
    generated_at: now.toISOString(),
    members,
    mode: workspaces.some((workspace) => workspace.workspace_id !== LOCAL_WORKSPACE_ID) ? "scoped" : "local",
    workspaces
  };
}

function toMemberSummary(presence: PresencePointer): TeamConnectionSummary["members"][number] {
  return {
    agent_id: presence.agent_id,
    current_files: [...presence.current_files],
    last_seen: presence.last_seen,
    status: presence.status,
    tool: presence.tool,
    ...optional("branch", presence.branch),
    ...optional("repo_id", presence.repo_id),
    ...optional("session_id", presence.session_id),
    ...optional("task", presence.task),
    ...optional("user_id", presence.user_id),
    ...optional("workspace_id", presence.workspace_id)
  };
}

function optional<Key extends string>(key: Key, value: string | undefined): Record<Key, string> | Record<string, never> {
  return value === undefined ? {} : { [key]: value } as Record<Key, string>;
}

function allPointers(state: SukaState): Pointer[] {
  return [
    ...state.presence,
    ...state.claims,
    ...state.events,
    ...state.decisions
  ];
}

function repoIdFromPointer(pointer: Pointer): string | undefined {
  if (pointer.repo_id !== undefined) return pointer.repo_id;
  if (pointer.type === "presence") return pointer.repo || LOCAL_REPO_ID;
  return LOCAL_REPO_ID;
}

function ensureWorkspace(map: Map<string, MutableWorkspaceSummary>, workspaceId: string): MutableWorkspaceSummary {
  const existing = map.get(workspaceId);
  if (existing !== undefined) return existing;

  const created: MutableWorkspaceSummary = {
    active_agents: 0,
    claims: 0,
    decisions: 0,
    events: 0,
    repoIds: new Set(),
    sessionIds: new Set(),
    workspace_id: workspaceId
  };
  map.set(workspaceId, created);
  return created;
}

function toWorkspaceSummary(workspace: MutableWorkspaceSummary): TeamWorkspaceSummary {
  return {
    active_agents: workspace.active_agents,
    claims: workspace.claims,
    decisions: workspace.decisions,
    events: workspace.events,
    repo_ids: [...workspace.repoIds].sort(),
    session_ids: [...workspace.sessionIds].sort(),
    workspace_id: workspace.workspace_id
  };
}

type MutableWorkspaceSummary = CoordinationContext & {
  workspace_id: string;
  repoIds: Set<string>;
  sessionIds: Set<string>;
  active_agents: number;
  claims: number;
  events: number;
  decisions: number;
};
