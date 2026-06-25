import type {
  BriefPointer,
  Checkpoint,
  ClaimPointer,
  CoordinationContext,
  DecisionPointer,
  EventPointer,
  LedgerEvent,
  LedgerPointer,
  PresencePointer,
  TaskEntry,
  TokenAssessment,
  TokenUsage
} from "@suka/protocol";

export interface LocalProject {
  id: string;
  name: string;
  path: string;
  repo_root: string;
  repo: string;
  branch?: string;
  workspace_id: string;
  repo_id: string;
  created_at: string;
  updated_at: string;
  last_opened_at?: string;
}

export interface SukaState {
  presence: PresencePointer[];
  claims: ClaimPointer[];
  events: EventPointer[];
  decisions: DecisionPointer[];
  briefs: BriefPointer[];
  ledger: LedgerPointer[];
  ledger_tasks: TaskEntry[];
  ledger_token_usage: TokenUsage[];
  ledger_token_assessments: TokenAssessment[];
  ledger_events: LedgerEvent[];
  ledger_checkpoints: Checkpoint[];
  projects: LocalProject[];
  active_project_id?: string;
}

export type SukaCleanupContext = CoordinationContext;

export interface SukaCleanupResult {
  context: SukaCleanupContext;
  removed: {
    presence: number;
    claims: number;
    events: number;
    decisions: number;
    briefs: number;
    ledger: number;
    ledger_tasks: number;
    ledger_token_usage: number;
    ledger_token_assessments: number;
    ledger_events: number;
    ledger_checkpoints: number;
  };
  state: SukaState;
}

export function createEmptyState(): SukaState {
  return {
    presence: [],
    claims: [],
    events: [],
    decisions: [],
    briefs: [],
    ledger: [],
    ledger_tasks: [],
    ledger_token_usage: [],
    ledger_token_assessments: [],
    ledger_events: [],
    ledger_checkpoints: [],
    projects: []
  };
}
