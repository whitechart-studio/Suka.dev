import type {
  DECISION_CONFIDENCE_LEVELS,
  DECISION_STATUSES,
  EVENT_TYPES,
  LEDGER_CHECKPOINT_KINDS,
  LEDGER_CHECKPOINT_STATUSES,
  LEDGER_EVENT_SEVERITIES,
  LEDGER_EVENT_TYPES,
  LEDGER_TASK_STATUSES,
  LEDGER_TASK_TYPES,
  LEDGER_TOKEN_ASSESSORS,
  LEDGER_TOKEN_CONFIDENCE_LEVELS,
  LEDGER_TOKEN_CURRENCIES,
  LEDGER_TOKEN_MEASUREMENT_SOURCES,
  LEDGER_TOKEN_PROVIDERS,
  LEDGER_TOKEN_VALUE_CATEGORIES,
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
export type LedgerTaskType = (typeof LEDGER_TASK_TYPES)[number];
export type LedgerTaskStatus = (typeof LEDGER_TASK_STATUSES)[number];
export type LedgerTokenProvider = (typeof LEDGER_TOKEN_PROVIDERS)[number];
export type LedgerTokenMeasurementSource = (typeof LEDGER_TOKEN_MEASUREMENT_SOURCES)[number];
export type LedgerTokenValueCategory = (typeof LEDGER_TOKEN_VALUE_CATEGORIES)[number];
export type LedgerTokenAssessor = (typeof LEDGER_TOKEN_ASSESSORS)[number];
export type LedgerTokenConfidence = (typeof LEDGER_TOKEN_CONFIDENCE_LEVELS)[number];
export type LedgerTokenCurrency = (typeof LEDGER_TOKEN_CURRENCIES)[number];
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];
export type LedgerEventSeverity = (typeof LEDGER_EVENT_SEVERITIES)[number];
export type LedgerCheckpointKind = (typeof LEDGER_CHECKPOINT_KINDS)[number];
export type LedgerCheckpointStatus = (typeof LEDGER_CHECKPOINT_STATUSES)[number];

export type IsoTimestamp = string;
export type PointerId = string;
export type AgentId = string;
export type ClaimKind = "soft_claim" | "blocked_scope";
export type PresenceSourceKind = "manual" | "detected";

export interface PresenceSource {
  kind: PresenceSourceKind;
  detector?: string;
  pid?: number;
  cwd?: string;
  detected_at?: IsoTimestamp;
}

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
  source?: PresenceSource;
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
  kind: ClaimKind;
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

export interface LedgerDiffStat {
  files_changed: number;
  additions: number;
  deletions: number;
}

export interface LedgerTokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
  model?: string;
}

export interface LedgerPointer extends BasePointer {
  type: "ledger";
  workspace_id: string;
  repo_id: string;
  session_id: string;
  agent_id: AgentId;
  event_type: EventType;
  summary: string;
  affected_paths: string[];
  branch: string;
  worktree: string;
  created_at: IsoTimestamp;
  evidence?: string[];
  diff_stat?: LedgerDiffStat;
  token_usage?: LedgerTokenUsage;
}

export interface TaskEntry {
  task_id: string;
  session_id: string;
  repo_id: string;
  workspace_id?: string;
  title: string;
  intent_summary: string;
  task_type: LedgerTaskType;
  status: LedgerTaskStatus;
  started_at: IsoTimestamp;
  completed_at?: IsoTimestamp;
  related_issue_ids: string[];
  related_claim_ids: PointerId[];
  related_checkpoint_ids: string[];
}

export interface TokenUsage {
  task_id: string;
  provider: LedgerTokenProvider;
  model?: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens?: number;
  reasoning_tokens?: number;
  tool_call_tokens?: number;
  total_tokens: number;
  estimated_cost?: number;
  currency?: LedgerTokenCurrency;
  measurement_source: LedgerTokenMeasurementSource;
}

export interface TokenAssessment {
  task_id: string;
  value_category: LedgerTokenValueCategory;
  usefulness_score?: number;
  assessed_by: LedgerTokenAssessor;
  confidence: LedgerTokenConfidence;
  reason?: string;
}

export interface LedgerEvent {
  event_id: string;
  task_id?: string;
  session_id: string;
  repo_id: string;
  event_type: LedgerEventType;
  timestamp: IsoTimestamp;
  summary: string;
  severity: LedgerEventSeverity;
  affected_paths: string[];
  metadata?: Record<string, unknown>;
}

export interface Checkpoint {
  checkpoint_id: string;
  repo_id: string;
  kind: LedgerCheckpointKind;
  external_id?: string;
  title: string;
  status: LedgerCheckpointStatus;
  created_at: IsoTimestamp;
  completed_at?: IsoTimestamp;
  related_task_ids: string[];
  related_issue_ids: string[];
  related_session_ids: string[];
  summary: string;
}

export type Pointer =
  | PresencePointer
  | ClaimPointer
  | EventPointer
  | DecisionPointer
  | BriefPointer
  | LedgerPointer;

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
  source?: PresenceSource;
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
