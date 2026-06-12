import type { ClaimPointer, DecisionPointer, EventPointer, PresencePointer } from "@suka/protocol";
import { createEmptyState, type SukaState } from "./state.js";

export interface SukaStore {
  getState(): SukaState;
  upsertPresence(pointer: PresencePointer): void;
  upsertClaim(pointer: ClaimPointer): void;
  releaseClaim(id: string): boolean;
  appendEvent(pointer: EventPointer): void;
  upsertDecision(pointer: DecisionPointer): void;
  expire(now: Date): void;
}

export class MemorySukaStore implements SukaStore {
  readonly #state: SukaState;

  constructor(initialState: SukaState = createEmptyState()) {
    this.#state = {
      presence: [...initialState.presence],
      claims: [...initialState.claims],
      events: [...initialState.events],
      decisions: [...initialState.decisions]
    };
  }

  getState(): SukaState {
    return {
      presence: [...this.#state.presence],
      claims: [...this.#state.claims],
      events: [...this.#state.events],
      decisions: [...this.#state.decisions]
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

  appendEvent(pointer: EventPointer): void {
    this.#state.events = [...this.#state.events, pointer];
  }

  upsertDecision(pointer: DecisionPointer): void {
    this.#state.decisions = upsertById(this.#state.decisions, pointer);
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
