import { checkConflicts, type ConflictSubject, type ConflictWarning } from "@suka/conflict-engine";
import {
  type BriefPointer,
  type ClaimPointer,
  type DecisionPointer,
  type EventPointer,
  type LedgerPointer,
  type Pointer,
  type PresencePointer,
  type CoordinationContext,
  type ValidationResult,
  validatePointer
} from "@suka/protocol";
import { MemorySukaStore, type SukaStore } from "./memory-store.js";
import { buildLocalProjectFromMetadata, inspectLocalProject, type LocalProjectInput } from "./projects.js";
import type { LocalProject, SukaState } from "./state.js";
import { buildTeamSummary } from "./team.js";

export interface SukaService {
  getState(): SukaState;
  getTeamSummary(): ReturnType<typeof buildTeamSummary>;
  listLedger(): LedgerPointer[];
  listProjects(): LocalProject[];
  getActiveProject(): LocalProject | undefined;
  registerProject(input: LocalProjectInput): LocalProject;
  activateProject(id: string): LocalProject | undefined;
  publish(pointer: unknown): ValidationResult<Pointer>;
  checkConflicts(subject: ConflictSubject): ConflictWarning[];
  releaseClaim(id: string): boolean;
  cleanup(context: CoordinationContext): ReturnType<SukaStore["cleanup"]>;
  expire(now?: Date): void;
}

export function createSukaService(store: SukaStore = new MemorySukaStore()): SukaService {
  return {
    getState() {
      return store.getState();
    },

    getTeamSummary() {
      return buildTeamSummary(store.getState());
    },

    listLedger() {
      return store.getState().ledger;
    },

    listProjects() {
      return store.getState().projects;
    },

    getActiveProject() {
      const state = store.getState();
      return state.projects.find((project) => project.id === state.active_project_id);
    },

    registerProject(input: LocalProjectInput) {
      const state = store.getState();
      const metadata = inspectLocalProject(input);
      const existing = state.projects.find((project) => project.path === metadata.path || project.repo_root === metadata.repo_root);
      const project = buildLocalProjectFromMetadata(metadata, input, existing);
      store.upsertProject(project);
      return project;
    },

    activateProject(id: string) {
      const state = store.getState();
      const project = state.projects.find((item) => item.id === id);
      if (project === undefined) {
        return undefined;
      }
      const timestamp = new Date().toISOString();
      const updated = {
        ...project,
        last_opened_at: timestamp,
        updated_at: timestamp
      };
      store.upsertProject(updated);
      const changed = store.setActiveProject(id);
      if (!changed && store.getState().active_project_id !== id) {
        return undefined;
      }
      return updated;
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

    cleanup(context: CoordinationContext) {
      return store.cleanup(context);
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
    case "brief":
      store.upsertBrief(pointer as BriefPointer);
      return;
    case "ledger":
      store.appendLedger(pointer as LedgerPointer);
      return;
  }
}
