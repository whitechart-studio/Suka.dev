import type { ClaimPointer, EventPointer, PointerScope, PresencePointer } from "@suka/protocol";

export type ConflictSeverity = "low" | "medium" | "high";

export type ConflictReason =
  | "same_file"
  | "path_overlap"
  | "api_overlap"
  | "table_overlap"
  | "env_overlap"
  | "domain_overlap";

export interface ConflictSubject {
  agent_id?: string;
  task?: string;
  paths?: string[];
  apis?: string[];
  tables?: string[];
  env?: string[];
  domains?: string[];
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

