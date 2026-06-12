import type { SukaState } from "@suka/server";

export function formatState(value: unknown): string {
  const state = value as SukaState;
  const lines: string[] = [];

  lines.push("Suka state");
  lines.push(`presence: ${state.presence?.length ?? 0}`);
  lines.push(`claims: ${state.claims?.length ?? 0}`);
  lines.push(`events: ${state.events?.length ?? 0}`);
  lines.push(`decisions: ${state.decisions?.length ?? 0}`);

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

export function helpText(): string {
  return `Suka CLI

Usage:
  suka init [--repo NAME] [--server URL] [--data-file .suka/state.json]
  suka serve [--host 127.0.0.1] [--port 4366]
  suka status [--server http://127.0.0.1:4366] [--json]
  suka claim <path> [--agent AGENT] [--reason TEXT] [--ttl 45] [--server URL]
  suka presence [--agent AGENT] [--tool TOOL] [--repo REPO] [--status editing] [--task TEXT] [--file PATH] [--server URL]
  suka event <type> <summary> [--agent AGENT] [--path PATH] [--api API] [--server URL]
  suka conflicts [--path PATH] [--api API] [--table TABLE] [--env NAME] [--domain DOMAIN] [--server URL]
  suka release <claim-id> [--server URL]

Environment:
  SUKA_SERVER_URL  Default server URL
  SUKA_DATA_FILE   Server persistence file
`;
}
