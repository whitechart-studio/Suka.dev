import { LEDGER_TOKEN_MEASUREMENT_SOURCES, type TokenUsage } from "@suka/protocol";

export type AgentTokenCollector = "claude" | "codex";

export interface CollectTokenUsageOptions {
  agentId?: string | undefined;
  checkpointId?: string | undefined;
  repoId?: string | undefined;
  sessionId?: string | undefined;
  sourceRunId?: string | undefined;
  taskId: string;
  tool?: string | undefined;
  workspaceId?: string | undefined;
}

export function collectAgentTokenUsage(
  collector: AgentTokenCollector,
  payload: unknown,
  options: CollectTokenUsageOptions
): TokenUsage {
  const usage = collector === "codex" ? readCodexUsage(payload) : readClaudeUsage(payload);
  const tokenUsage: TokenUsage = {
    input_tokens: usage.inputTokens,
    measurement_source: usage.measurementSource,
    output_tokens: usage.outputTokens,
    provider: collector === "codex" ? "openai" : "anthropic",
    task_id: options.taskId,
    total_tokens: usage.totalTokens
  };
  setOptional(tokenUsage, "cached_input_tokens", usage.cachedInputTokens);
  setOptional(tokenUsage, "estimated_cost", usage.estimatedCost);
  setOptional(tokenUsage, "model", usage.model);
  setOptional(tokenUsage, "reasoning_tokens", usage.reasoningTokens);
  setOptional(tokenUsage, "source_run_id", usage.sourceRunId);
  setOptional(tokenUsage, "tool_call_tokens", usage.toolCallTokens);
  return withAttribution(tokenUsage, options);
}

interface ParsedUsage {
  cachedInputTokens?: number | undefined;
  estimatedCost?: number | undefined;
  inputTokens: number;
  measurementSource: TokenUsage["measurement_source"];
  model?: string | undefined;
  outputTokens: number;
  reasoningTokens?: number | undefined;
  sourceRunId?: string | undefined;
  toolCallTokens?: number | undefined;
  totalTokens: number;
}

function readCodexUsage(payload: unknown): ParsedUsage {
  const root = asRecord(payload);
  const usage = asOptionalRecord(root.usage) ?? root;
  const inputTokens = requireInteger(usage, ["input_tokens", "prompt_tokens"], "Codex input tokens");
  const outputTokens = requireInteger(usage, ["output_tokens", "completion_tokens"], "Codex output tokens");
  const cachedInputTokens = readInteger(usage, ["cached_input_tokens", "cached_tokens", "input_cached_tokens"]);
  const reasoningTokens = readInteger(usage, ["reasoning_tokens"]);
  const toolCallTokens = readInteger(usage, ["tool_call_tokens"]);
  const totalTokens = readInteger(usage, ["total_tokens"]) ?? inputTokens + outputTokens;
  return {
    cachedInputTokens,
    estimatedCost: readNumber(root, ["estimated_cost", "estimated_cost_usd", "cost_usd"]),
    inputTokens,
    measurementSource: readMeasurementSource(root, "agent_reported"),
    model: readString(root, ["model"]) ?? readString(usage, ["model"]),
    outputTokens,
    reasoningTokens,
    sourceRunId: readString(root, ["id", "run_id", "session_id"]),
    toolCallTokens,
    totalTokens
  };
}

function readClaudeUsage(payload: unknown): ParsedUsage {
  const root = asRecord(payload);
  const usage = asOptionalRecord(root.usage) ?? root;
  const cacheCreation = readInteger(usage, ["cache_creation_input_tokens"]) ?? 0;
  const cacheRead = readInteger(usage, ["cache_read_input_tokens"]) ?? 0;
  const inputTokens = requireInteger(usage, ["input_tokens", "prompt_tokens"], "Claude input tokens");
  const outputTokens = requireInteger(usage, ["output_tokens", "completion_tokens"], "Claude output tokens");
  const cachedInputTokens = optionalPositive(cacheCreation + cacheRead);
  const totalTokens = readInteger(usage, ["total_tokens"]) ?? inputTokens + outputTokens + (cachedInputTokens ?? 0);
  return {
    cachedInputTokens,
    estimatedCost: readNumber(root, ["estimated_cost", "estimated_cost_usd", "cost_usd", "total_cost_usd"]),
    inputTokens,
    measurementSource: readMeasurementSource(root, "transcript"),
    model: readString(root, ["model"]) ?? readString(usage, ["model"]),
    outputTokens,
    sourceRunId: readString(root, ["id", "run_id", "session_id"]),
    totalTokens
  };
}

function withAttribution(usage: TokenUsage, options: CollectTokenUsageOptions): TokenUsage {
  const attributed = { ...usage };
  setOptional(attributed, "agent_id", options.agentId);
  setOptional(attributed, "checkpoint_id", options.checkpointId);
  setOptional(attributed, "repo_id", options.repoId);
  setOptional(attributed, "session_id", options.sessionId);
  setOptional(attributed, "source_run_id", options.sourceRunId ?? usage.source_run_id);
  setOptional(attributed, "tool", options.tool);
  setOptional(attributed, "workspace_id", options.workspaceId);
  return attributed;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readInteger(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  }
  return undefined;
}

function requireInteger(record: Record<string, unknown>, keys: string[], label: string): number {
  const value = readInteger(record, keys);
  if (value === undefined) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  return undefined;
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

function readMeasurementSource(record: Record<string, unknown>, fallback: TokenUsage["measurement_source"]): TokenUsage["measurement_source"] {
  const value = readString(record, ["measurement_source", "source"]);
  return (LEDGER_TOKEN_MEASUREMENT_SOURCES as readonly string[]).includes(value ?? "")
    ? value as TokenUsage["measurement_source"]
    : fallback;
}

function optionalPositive(value: number): number | undefined {
  return value > 0 ? value : undefined;
}

function setOptional<K extends keyof TokenUsage>(target: TokenUsage, key: K, value: TokenUsage[K] | undefined): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
