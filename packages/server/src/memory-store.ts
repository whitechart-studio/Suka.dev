import type { BriefPointer, ClaimPointer, CoordinationContext, DecisionPointer, EventPointer, PresencePointer } from "@suka/protocol";
import { createEmptyState, type SukaCleanupResult, type SukaState } from "./state.js";

export interface SukaStore {
  getState(): SukaState;
  upsertPresence(pointer: PresencePointer): void;
  upsertClaim(pointer: ClaimPointer): void;
  releaseClaim(id: string): boolean;
  cleanup(context: CoordinationContext): SukaCleanupResult;
  appendEvent(pointer: EventPointer): void;
  upsertDecision(pointer: DecisionPointer): void;
  upsertBrief(pointer: BriefPointer): void;
  expire(now: Date): void;
}

export class MemorySukaStore implements SukaStore {
  readonly #state: SukaState;

  constructor(initialState: SukaState = createEmptyState()) {
    this.#state = {
      presence: [...initialState.presence],
      claims: [...initialState.claims],
      events: [...initialState.events],
      decisions: [...initialState.decisions],
      briefs: [...initialState.briefs]
    };
  }

  getState(): SukaState {
    return {
      presence: [...this.#state.presence],
      claims: [...this.#state.claims],
      events: [...this.#state.events],
      decisions: [...this.#state.decisions],
      briefs: [...this.#state.briefs]
    };
  }

  upsertPresence(pointer: PresencePointer): void {
    this.#state.presence = upsertById(this.#state.presence, pointer);
  }

  upsertClaim(pointer: ClaimPointer): void {
    this.#state.claims = upsertById(this.#state.claims, pointer);
  }

  releaseClaim(id: string): boolean {
    const initialLength = this.#state.claims.length;
    this.#state.claims = this.#state.claims.filter((claim) => claim.id !== id);
    return this.#state.claims.length !== initialLength;
  }

  cleanup(context: CoordinationContext): SukaCleanupResult {
    const before = this.getState();
    this.#state.presence = this.#state.presence.filter((presence) => !matchesContext(presence, context));
    this.#state.claims = this.#state.claims.filter((claim) => !matchesContext(claim, context));
    this.#state.events = this.#state.events.filter((event) => !matchesContext(event, context));
    this.#state.decisions = this.#state.decisions.filter((decision) => !matchesContext(decision, context));
    this.#state.briefs = this.#state.briefs.filter((brief) => !matchesContext(brief, context));
    const after = this.getState();

    return {
      context,
      removed: {
        presence: before.presence.length - after.presence.length,
        claims: before.claims.length - after.claims.length,
        events: before.events.length - after.events.length,
        decisions: before.decisions.length - after.decisions.length,
        briefs: before.briefs.length - after.briefs.length
      },
      state: after
    };
  }

  appendEvent(pointer: EventPointer): void {
    this.#state.events = [...this.#state.events, pointer];
  }

  upsertDecision(pointer: DecisionPointer): void {
    this.#state.decisions = upsertById(this.#state.decisions, pointer);
  }

  upsertBrief(pointer: BriefPointer): void {
    this.#state.briefs = upsertById(this.#state.briefs, pointer);
  }

  expire(now: Date): void {
    const timestamp = now.getTime();
    this.#state.presence = this.#state.presence.filter((presence) => Date.parse(presence.expires_at) > timestamp);
    this.#state.claims = this.#state.claims.filter((claim) => Date.parse(claim.expires_at) > timestamp);
  }
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index === -1) {
    return [...items, item];
  }

  const next = [...items];
  next[index] = item;
  return next;
}

function matchesContext(item: CoordinationContext, context: CoordinationContext): boolean {
  const keys = ["workspace_id", "repo_id", "session_id"] as const;
  return keys.some((key) => context[key] !== undefined) && keys.every((key) => {
    const expected = context[key];
    return expected === undefined || item[key] === expected;
  });
}
