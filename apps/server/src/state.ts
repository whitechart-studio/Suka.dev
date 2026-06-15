import type { BriefPointer, ClaimPointer, CoordinationContext, DecisionPointer, EventPointer, PresencePointer } from "@suka/protocol";

export interface SukaState {
  presence: PresencePointer[];
  claims: ClaimPointer[];
  events: EventPointer[];
  decisions: DecisionPointer[];
  briefs: BriefPointer[];
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
  };
  state: SukaState;
}

export function createEmptyState(): SukaState {
  return {
    presence: [],
    claims: [],
    events: [],
    decisions: [],
    briefs: []
  };
}
