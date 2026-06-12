import type { ClaimPointer, DecisionPointer, EventPointer, PresencePointer } from "@suka/protocol";

export interface SukaState {
  presence: PresencePointer[];
  claims: ClaimPointer[];
  events: EventPointer[];
  decisions: DecisionPointer[];
}

export function createEmptyState(): SukaState {
  return {
    presence: [],
    claims: [],
    events: [],
    decisions: []
  };
}

