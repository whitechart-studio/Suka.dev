export const POINTER_TYPES = ["presence", "claim", "event", "decision"] as const;

export const PRESENCE_STATUSES = [
  "online",
  "idle",
  "planning",
  "reading",
  "editing",
  "running_tests",
  "debugging",
  "blocked",
  "waiting_for_human",
  "complete"
] as const;

export const EVENT_TYPES = [
  "task_started",
  "task_updated",
  "task_completed",
  "files_claimed",
  "files_released",
  "file_modified",
  "api_contract_changed",
  "database_schema_changed",
  "env_var_added",
  "test_started",
  "test_failed",
  "test_passed",
  "blocker_found",
  "decision_proposed",
  "decision_accepted",
  "pr_opened",
  "branch_merged"
] as const;

export const DECISION_STATUSES = [
  "proposed",
  "accepted",
  "rejected",
  "deprecated",
  "stale"
] as const;

export const DECISION_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export const SUKA_CONFIG_MODES = ["local", "self_hosted", "hosted"] as const;
