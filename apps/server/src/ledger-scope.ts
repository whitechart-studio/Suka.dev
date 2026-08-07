export interface LedgerScope {
  repo_id?: string;
  session_id?: string;
  workspace_id?: string;
}

const ledgerScopeKeys = ["workspace_id", "repo_id", "session_id"] as const;

export function hasConflictingLedgerScope(item: LedgerScope, scope: LedgerScope): boolean {
  return ledgerScopeKeys.some((key) => scope[key] !== undefined && item[key] !== undefined && item[key] !== scope[key]);
}

export function scopedLedgerTaskKey(item: LedgerScope & { task_id: string }): string {
  return [
    item.workspace_id ?? "",
    item.repo_id ?? "",
    item.session_id ?? "",
    item.task_id
  ].join("\u001f");
}
