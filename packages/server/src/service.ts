import { checkConflicts, type ConflictSubject, type ConflictWarning } from "@suka/conflict-engine";
import {
  type ClaimPointer,
  type DecisionPointer,
  type EventPointer,
  type Pointer,
  type PresencePointer,
  type ValidationResult,
  validatePointer
} from "@suka/protocol";
import { MemorySukaStore, type SukaStore } from "./memory-store.js";
import type { SukaState } from "./state.js";

export interface SukaService {
  getState(): SukaState;
  publish(pointer: unknown): ValidationResult<Pointer>;
  checkConflicts(subject: ConflictSubject): ConflictWarning[];
  releaseClaim(id: string): boolean;
  expire(now?: Date): void;
}

export function createSukaService(store: SukaStore = new MemorySukaStore()): SukaService {
  return {
    getState() {
      return store.getState();
    },

    publish(pointer: unknown) {
      const result = validatePointer(pointer);
      if (!result.ok) {
        return result;
      }

      persistPointer(store, result.value);
      return result;
    },

    checkConflicts(subject: ConflictSubject) {
      const state = store.getState();
      return checkConflicts({
        subject,
        active_claims: state.claims,
        active_presence: state.presence,
        recent_events: state.events
      });
    },

    releaseClaim(id: string) {
      return store.releaseClaim(id);
    },

    expire(now = new Date()) {
      store.expire(now);
    }
  };
}

function persistPointer(store: SukaStore, pointer: Pointer): void {
  switch (pointer.type) {
    case "presence":
      store.upsertPresence(pointer as PresencePointer);
      return;
    case "claim":
      store.upsertClaim(pointer as ClaimPointer);
      return;
    case "event":
      store.appendEvent(pointer as EventPointer);
      return;
    case "decision":
      store.upsertDecision(pointer as DecisionPointer);
      return;
  }
}

