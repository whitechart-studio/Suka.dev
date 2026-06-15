import type {
  DECISION_CONFIDENCE_LEVELS,
  DECISION_STATUSES,
  EVENT_TYPES,
  POINTER_TYPES,
  SUKA_CONFIG_MODES,
  PRESENCE_STATUSES
} from "./constants.js";

export type PointerType = (typeof POINTER_TYPES)[number];
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type DecisionStatus = (typeof DECISION_STATUSES)[number];
export type DecisionConfidence = (typeof DECISION_CONFIDENCE_LEVELS)[number];
export type SukaConfigMode = (typeof SUKA_CONFIG_MODES)[number];

export type IsoTimestamp = string;
export type PointerId = string;
export type AgentId = string;

export interface CoordinationContext {
  workspace_id?: string;
  repo_id?: string;
  session_id?: string;
}

export interface PointerScope {
  paths?: string[];
  apis?: string[];
  domains?: string[];
  tables?: string[];
  env?: string[];
}

export interface BasePointer extends CoordinationContext {
  id: PointerId;
  type: PointerType;
}

export interface PresencePointer extends BasePointer {
  type: "presence";
  agent_id: AgentId;
  user_id?: string;
  tool: string;
  repo: string;
  branch?: string;
  task?: string;
  status: PresenceStatus;
  current_files: string[];
  last_seen: IsoTimestamp;
  expires_at: IsoTimestamp;
}

export interface ClaimPointer extends BasePointer {
  type: "claim";
  agent_id: AgentId;
  scope: PointerScope;
  reason: string;
  kind: "soft_claim";
  created_at: IsoTimestamp;
  expires_at: IsoTimestamp;
}

export interface EventPointer extends BasePointer {
  type: "event";
  event_type: EventType;
  summary: string;
  affected_paths: string[];
  affected_apis: string[];
  affected_tables: string[];
  affected_env: string[];
  agent_id: AgentId;
  created_at: IsoTimestamp;
}

export interface DecisionPointer extends BasePointer {
  type: "decision";
  title: string;
  body: string;
  scope: PointerScope;
  status: DecisionStatus;
  confidence: DecisionConfidence;
  evidence: string[];
  created_by: AgentId;
  approved_by?: string;
  created_at: IsoTimestamp;
  updated_at?: IsoTimestamp;
}

export interface BriefPointer extends BasePointer {
  type: "brief";
  agent_id: AgentId;
  summary: string;
  changed_files: string[];
  decisions_made: string[];
  assumptions: string[];
  skipped_work: string[];
  risks: string[];
  blockers: string[];
  next_action: string;
  related_claims: PointerId[];
  related_sessions: string[];
  worktree?: string;
  created_at: IsoTimestamp;
}

export type Pointer =
  | PresencePointer
  | ClaimPointer
  | EventPointer
  | DecisionPointer
  | BriefPointer;

export type ValidationIssueCode =
  | "invalid_type"
  | "missing_field"
  | "invalid_value"
  | "invalid_timestamp"
  | "empty_scope";

export interface ValidationIssue {
  code: ValidationIssueCode;
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      issues: ValidationIssue[];
    };

export interface SukaConfigDomain {
  id: string;
  name: string;
  paths: string[];
  apis: string[];
  tables: string[];
  env: string[];
}

export interface SukaPrivacyConfig {
  publish_file_paths: boolean;
  publish_code_content: false;
  publish_terminal_logs: false;
}

export interface SukaPlatformConfig {
  workspace_id: string;
  repo_id: string;
  team_id?: string;
  public_base_url?: string;
  auth_required: boolean;
  auth_token_env: string;
  retention_days: number;
  audit_log_enabled: boolean;
}

export interface SukaConfig {
  version: 1;
  repo: string;
  mode: SukaConfigMode;
  server_url: string;
  data_file: string;
  ignored_paths: string[];
  domains: SukaConfigDomain[];
  privacy: SukaPrivacyConfig;
  platform: SukaPlatformConfig;
}

export interface TeamMemberSummary extends CoordinationContext {
  agent_id: AgentId;
  user_id?: string;
  tool: string;
  status: PresenceStatus;
  branch?: string;
  task?: string;
  current_files: string[];
  last_seen: IsoTimestamp;
}

export interface TeamWorkspaceSummary {
  workspace_id: string;
  repo_ids: string[];
  session_ids: string[];
  active_agents: number;
  claims: number;
  events: number;
  decisions: number;
  briefs: number;
}

export interface TeamConnectionSummary {
  mode: "local" | "scoped";
  active_agents: number;
  workspaces: TeamWorkspaceSummary[];
  members: TeamMemberSummary[];
  generated_at: IsoTimestamp;
}
