import type { TeamConnectionSummary } from "@suka/protocol";
import type { SukaState } from "@suka/server";

export interface DoctorCheck {
  name: string;
  status: "fail" | "ok" | "warn";
  message: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  config_path?: string;
  context: {
    repo_id?: string;
    session_id?: string;
    workspace_id?: string;
  };
  server_url: string;
}

export interface SessionStartReport {
  agent_id: string;
  env: Record<string, string>;
  repo: string;
  server_url: string;
}

export interface SessionStatusReport {
  members: TeamConnectionSummary["members"];
  repo_id: string;
  session_id: string;
  workspace_id: string;
}

export interface TruthReminder {
  action: string;
  level: "info" | "warn";
  paths: string[];
  reason: string;
  title: string;
}

export interface TruthReminderReport {
  changed_files: string[];
  conflict_warnings: number;
  generated_at: string;
  reminders: TruthReminder[];
}

export function formatState(value: unknown): string {
  const state = value as SukaState;
  const lines: string[] = [];

  lines.push("Suka state");
  lines.push(`presence: ${state.presence?.length ?? 0}`);
  lines.push(`claims: ${state.claims?.length ?? 0}`);
  lines.push(`events: ${state.events?.length ?? 0}`);
  lines.push(`decisions: ${state.decisions?.length ?? 0}`);
  lines.push(`briefs: ${state.briefs?.length ?? 0}`);

  for (const presence of state.presence ?? []) {
    lines.push(`- ${presence.agent_id} ${presence.status} ${presence.task ?? ""}`.trim());
  }

  for (const claim of state.claims ?? []) {
    lines.push(`- claim ${claim.id}: ${claim.reason}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function formatDoctor(report: DoctorReport): string {
  const lines: string[] = [];

  lines.push("Suka doctor");
  lines.push(`server: ${report.server_url}`);
  lines.push(`config: ${report.config_path ?? "not found"}`);
  lines.push(`workspace: ${report.context.workspace_id ?? "not set"}`);
  lines.push(`repo: ${report.context.repo_id ?? "not set"}`);
  lines.push(`session: ${report.context.session_id ?? "not set"}`);

  for (const check of report.checks) {
    lines.push(`- ${check.status} ${check.name}: ${check.message}`);
  }

  return `${lines.join("\n")}\n`;
}

export function formatSessionStart(report: SessionStartReport): string {
  const lines: string[] = [];

  lines.push("Suka session");
  lines.push(`server: ${report.server_url}`);
  lines.push(`repo: ${report.repo}`);
  lines.push(`agent: ${report.agent_id}`);
  lines.push("");

  lines.push(...formatEnvExports(report.env));

  return `${lines.join("\n")}\n`;
}

export function formatSessionStatus(report: SessionStatusReport): string {
  const lines: string[] = [];

  lines.push("Suka session status");
  lines.push(`workspace: ${report.workspace_id}`);
  lines.push(`repo: ${report.repo_id}`);
  lines.push(`session: ${report.session_id}`);
  lines.push(`active agents: ${report.members.length}`);

  for (const member of report.members) {
    const details = [member.tool, member.status, member.task].filter((item) => item !== undefined && item.length > 0);
    lines.push(`- ${member.agent_id} ${details.join(" ")}`.trim());
    if (member.source?.kind === "detected") {
      lines.push(`  source: detected${member.source.detector === undefined ? "" : ` via ${member.source.detector}`}`);
    }
    if (member.current_files.length > 0) {
      lines.push(`  files: ${member.current_files.join(", ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatTeam(value: unknown): string {
  const summary = value as TeamConnectionSummary;
  const lines: string[] = [];

  lines.push("Suka team");
  lines.push(`mode: ${summary.mode ?? "local"}`);
  lines.push(`active agents: ${summary.active_agents ?? 0}`);

  for (const workspace of summary.workspaces ?? []) {
    lines.push(
      `- workspace ${workspace.workspace_id}: ${workspace.active_agents} agents, ${workspace.claims} claims, ${workspace.events} events, ${workspace.decisions} decisions, ${workspace.briefs ?? 0} briefs`
    );
    if (workspace.repo_ids.length > 0) {
      lines.push(`  repos: ${workspace.repo_ids.join(", ")}`);
    }
    if (workspace.session_ids.length > 0) {
      lines.push(`  sessions: ${workspace.session_ids.join(", ")}`);
    }
  }

  if ((summary.members ?? []).length > 0) {
    lines.push("members:");
  }

  for (const member of summary.members ?? []) {
    const details = [member.tool, member.status, member.task].filter((item) => item !== undefined && item.length > 0);
    lines.push(`- ${member.agent_id} ${details.join(" ")}`.trim());
    if (member.source?.kind === "detected") {
      lines.push(`  source: detected${member.source.detector === undefined ? "" : ` via ${member.source.detector}`}`);
    }
    if (member.current_files.length > 0) {
      lines.push(`  files: ${member.current_files.join(", ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatTruthReminders(report: TruthReminderReport): string {
  const lines: string[] = [];

  lines.push("Suka shared-truth reminders");
  lines.push(`changed files: ${report.changed_files.length}`);
  lines.push(`conflict warnings: ${report.conflict_warnings}`);

  if (report.changed_files.length > 0) {
    lines.push(`files: ${report.changed_files.join(", ")}`);
  }

  if (report.reminders.length === 0) {
    lines.push("- ok shared truth looks current");
    return `${lines.join("\n")}\n`;
  }

  for (const reminder of report.reminders) {
    lines.push(`- ${reminder.level} ${reminder.title}: ${reminder.reason}`);
    lines.push(`  action: ${reminder.action}`);
    if (reminder.paths.length > 0) {
      lines.push(`  paths: ${reminder.paths.join(", ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function helpText(): string {
  return `Suka CLI

Usage:
  suka init [--repo NAME] [--server URL] [--data-file .suka/state.json]
  suka serve [--host 127.0.0.1] [--port 4366]
  suka doctor [--server http://127.0.0.1:4366] [--workspace ID] [--repo-id ID] [--session ID] [--json]
  suka session start [--repo NAME] [--agent AGENT] [--tool TOOL] [--workspace ID] [--repo-id ID] [--session ID] [--server URL] [--env-file .suka/session.env] [--json]
  suka session join [--agent AGENT] [--tool TOOL] [--workspace ID] [--repo-id ID] [--session ID] [--status editing] [--task TEXT] [--file PATH] [--watch] [--server URL]
  suka session status [--workspace ID] [--repo-id ID] [--session ID] [--server URL] [--json]
  suka session end [--workspace ID] [--repo-id ID] [--session ID] [--server URL]
  suka status [--server http://127.0.0.1:4366] [--json]
  suka team [--server http://127.0.0.1:4366] [--json]
  suka agents detect [--publish] [--workspace ID] [--repo-id ID] [--session ID] [--status online] [--task TEXT] [--ttl 120] [--server URL] [--json]
  suka agents watch [--workspace ID] [--repo-id ID] [--session ID] [--status online] [--task TEXT] [--ttl 120] [--interval 15] [--server URL] [--json]
  suka remind [--changed] [--path PATH] [--workspace ID] [--repo-id ID] [--session ID] [--server URL] [--json]
  suka claim <path> [--block] [--agent AGENT] [--reason TEXT] [--ttl 45] [--workspace ID] [--repo-id ID] [--session ID] [--server URL]
  suka block <path> [--agent AGENT] [--reason TEXT] [--ttl 45] [--workspace ID] [--repo-id ID] [--session ID] [--server URL]
  suka presence [--agent AGENT] [--tool TOOL] [--repo REPO] [--workspace ID] [--repo-id ID] [--session ID] [--status editing] [--task TEXT] [--file PATH] [--ttl 120] [--watch] [--interval 15] [--server URL]
  suka event <type> <summary> [--agent AGENT] [--workspace ID] [--repo-id ID] [--session ID] [--path PATH] [--api API] [--server URL]
  suka decision <title> --body TEXT [--workspace ID] [--repo-id ID] [--session ID] [--path PATH] [--api API] [--table TABLE] [--env NAME] [--domain DOMAIN] [--evidence REF] [--status accepted] [--confidence high] [--agent AGENT]
  suka decisions [--server URL]
  suka brief write <summary> --next TEXT [--changed PATH] [--decision TEXT] [--assumption TEXT] [--skipped TEXT] [--risk TEXT] [--blocker TEXT] [--related-claim ID] [--related-session ID] [--worktree NAME] [--workspace ID] [--repo-id ID] [--session ID] [--server URL]
  suka brief read [--workspace ID] [--repo-id ID] [--session ID|current] [--server URL] [--json]
  suka ledger task start <title> --summary TEXT [--type implementation] [--task-id ID] [--issue-id ID] [--claim-id ID] [--checkpoint-id ID] [--workspace ID] [--repo-id ID] [--session ID] [--server URL]
  suka ledger task finish <task-id> [--status completed] [--checkpoint-id ID] [--server URL]
  suka ledger task read [--workspace ID] [--repo-id ID] [--session ID] [--task-id ID] [--checkpoint-id ID] [--server URL]
  suka ledger token record <task-id> --input N --output N [--total N] [--provider openai|anthropic|local|unknown] [--model MODEL] [--source api|cli|estimated|manual] [--server URL]
  suka ledger token assess <task-id> [--category delivery|planning|review|rework|discarded|blocked|handoff|unknown] [--score 0-100] [--by user|agent|rule|system] [--confidence low|medium|high] [--reason TEXT] [--server URL]
  suka ledger token read [--workspace ID] [--repo-id ID] [--session ID] [--task-id ID] [--server URL]
  suka ledger token assessments [--workspace ID] [--repo-id ID] [--session ID] [--task-id ID] [--server URL]
  suka ledger token efficiency [--workspace ID] [--repo-id ID] [--session ID] [--task-id ID] [--checkpoint-id ID] [--issue-id ID] [--budget-scope session|task --warning-threshold N --hard-limit N] [--server URL]
  suka ledger event write <type> <summary> [--task-id ID] [--path PATH] [--severity info|warning|critical] [--workspace ID] [--repo-id ID] [--session ID] [--server URL]
  suka ledger event read [--workspace ID] [--repo-id ID] [--session ID] [--task-id ID] [--server URL]
  suka ledger checkpoint pr <number> <title> [--task-id ID] [--issue-id ID] [--summary TEXT] [--workspace ID] [--repo-id ID] [--session ID] [--server URL]
  suka ledger checkpoint commit <sha> <title> [--task-id ID] [--issue-id ID] [--summary TEXT] [--repo-id ID] [--session ID] [--server URL]
  suka ledger checkpoint read [--repo-id ID] [--task-id ID] [--checkpoint-id ID] [--server URL]
  suka ledger checkpoint summary [--repo-id ID] [--task-id ID] [--checkpoint-id ID] [--server URL]
  suka ledger governance [--server URL]
  suka conflicts [--changed] [--workspace ID] [--repo-id ID] [--session ID] [--path PATH] [--api API] [--table TABLE] [--env NAME] [--domain DOMAIN] [--since ISO] [--since-session-start] [--server URL]
  suka release <claim-id> [--server URL]
  suka cleanup [--workspace ID] [--repo ID] [--session ID] [--server URL]

Ledger:
  task = one prompt or work unit.
  checkpoint = a PR, commit, review, or other reviewable milestone.

Environment:
  SUKA_SERVER_URL  Default server URL
  SUKA_DATA_FILE   Server persistence file
  SUKA_AGENT_ID    Default agent identity
  SUKA_AGENT_TOOL  Default agent tool name
  SUKA_WORKSPACE_ID Default workspace context
  SUKA_REPO_ID      Default repo context
  SUKA_SESSION_ID   Default session context
  SUKA_SESSION_STARTED_AT Default session start timestamp for conflict checks
`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function formatEnvExports(env: Record<string, string>): string[] {
  return Object.entries(env).map(([key, value]) => `export ${key}=${shellQuote(value)}`);
}
