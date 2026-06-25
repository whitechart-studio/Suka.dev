export const POINTER_TYPES = ["presence", "claim", "event", "decision", "brief", "ledger"] as const;

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

export const LEDGER_TASK_TYPES = [
  "planning",
  "implementation",
  "review",
  "debug",
  "test",
  "merge",
  "handoff"
] as const;

export const LEDGER_TASK_STATUSES = ["active", "completed", "blocked", "discarded"] as const;

export const LEDGER_TOKEN_PROVIDERS = ["openai", "anthropic", "local", "unknown"] as const;

export const LEDGER_TOKEN_MEASUREMENT_SOURCES = ["api", "cli", "estimated", "manual"] as const;

export const LEDGER_TOKEN_VALUE_CATEGORIES = [
  "delivery",
  "planning",
  "review",
  "rework",
  "discarded",
  "blocked",
  "handoff",
  "unknown"
] as const;

export const LEDGER_TOKEN_ASSESSORS = ["user", "agent", "rule", "system"] as const;

export const LEDGER_TOKEN_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export const LEDGER_TOKEN_CURRENCIES = ["USD", "INR"] as const;

export const LEDGER_EVENT_TYPES = [
  "file_changed",
  "command_started",
  "command_finished",
  "test_started",
  "test_finished",
  "claim_created",
  "claim_released",
  "outside_claim_scope",
  "commit_created",
  "pr_opened",
  "pr_updated",
  "pr_merged",
  "handoff_created",
  "conflict_detected"
] as const;

export const LEDGER_EVENT_SEVERITIES = ["info", "warning", "critical"] as const;

export const LEDGER_CHECKPOINT_KINDS = ["commit", "pr", "merge", "release", "handoff"] as const;

export const LEDGER_CHECKPOINT_STATUSES = ["open", "merged", "closed", "failed", "superseded"] as const;
