import type { ClaimPointer, CoordinationContext, EventPointer, PointerScope, PresencePointer } from "@suka/protocol";

export type ConflictSeverity = "low" | "medium" | "high";

export type ConflictReason =
  | "same_file"
  | "path_overlap"
  | "api_overlap"
  | "table_overlap"
  | "env_overlap"
  | "domain_overlap"
  | "recent_file_change"
  | "recent_api_change"
  | "recent_table_change"
  | "recent_env_change";

export interface ConflictSubject extends CoordinationContext {
  agent_id?: string;
  task?: string;
  paths?: string[];
  apis?: string[];
  tables?: string[];
  env?: string[];
  domains?: string[];
  since?: string;
}

export interface ConflictWarning {
  severity: ConflictSeverity;
  reason: ConflictReason;
  message: string;
  matched_scope: PointerScope;
  pointers: string[];
  subject: ConflictSubject;
}

export interface ConflictCheckInput {
  subject: ConflictSubject;
  active_claims: ClaimPointer[];
  active_presence?: PresencePointer[];
  recent_events?: EventPointer[];
}
