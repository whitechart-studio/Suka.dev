import type { BriefPointer, ClaimPointer, CoordinationContext, DecisionPointer, EventPointer, LedgerPointer, PresencePointer } from "@suka/protocol";

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
    projects: []
  };
}
