import { SUKA_CONFIG_MODES } from "./constants.js";
import type {
  SukaConfig,
  SukaConfigDomain,
  SukaPlatformConfig,
  SukaPrivacyConfig,
  ValidationIssue,
  ValidationResult
} from "./types.js";

export interface CreateDefaultSukaConfigOptions {
  repo: string;
  serverUrl?: string;
  dataFile?: string;
}

export function createDefaultSukaConfig(options: CreateDefaultSukaConfigOptions): SukaConfig {
  const repoId = slug(options.repo);
  return {
    version: 1,
    repo: options.repo,
    mode: "local",
    server_url: options.serverUrl ?? "http://127.0.0.1:4366",
    data_file: options.dataFile ?? ".suka/state.json",
    ignored_paths: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      ".git/**"
    ],
    domains: [],
    privacy: {
      publish_file_paths: true,
      publish_code_content: false,
      publish_terminal_logs: false
    },
    platform: {
      audit_log_enabled: false,
      auth_required: false,
      auth_token_env: "SUKA_AUTH_TOKEN",
      public_base_url: options.serverUrl ?? "http://127.0.0.1:4366",
      repo_id: repoId,
      retention_days: 30,
      workspace_id: `local-${repoId}`
    }
  };
}

export function normalizeSukaConfig(value: unknown, defaults: CreateDefaultSukaConfigOptions): ValidationResult<SukaConfig> {
  const base = createDefaultSukaConfig(defaults);
  if (!isRecord(value)) {
    return fail([
      {
        code: "invalid_type",
        path: "$",
        message: "Suka config must be an object."
      }
    ]);
  }

  const config: SukaConfig = {
    ...base,
    version: 1,
    repo: typeof value.repo === "string" && value.repo.length > 0 ? value.repo : base.repo,
    mode: isConfigMode(value.mode) ? value.mode : base.mode,
    server_url: typeof value.server_url === "string" && value.server_url.length > 0 ? value.server_url : base.server_url,
    data_file: typeof value.data_file === "string" && value.data_file.length > 0 ? value.data_file : base.data_file,
    ignored_paths: isStringArray(value.ignored_paths) ? normalizeStringArray(value.ignored_paths) : base.ignored_paths,
    domains: Array.isArray(value.domains) ? normalizeDomains(value.domains) : base.domains,
    privacy: normalizePrivacy(value.privacy, base.privacy),
    platform: normalizePlatform(value.platform, base.platform, isConfigMode(value.mode) ? value.mode : base.mode)
  };

  return validateSukaConfig(config);
}

export function validateSukaConfig(value: unknown): ValidationResult<SukaConfig> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return fail([
      {
        code: "invalid_type",
        path: "$",
        message: "Suka config must be an object."
      }
    ]);
  }

  requireLiteral(value, "version", 1, issues);
  requireString(value, "repo", issues);
  requireEnum(value, "mode", SUKA_CONFIG_MODES, issues);
  requireString(value, "server_url", issues);
  requireString(value, "data_file", issues);
  requireStringArray(value, "ignored_paths", issues);
  requirePrivacy(value.privacy, issues);
  requirePlatform(value.platform, issues, isConfigMode(value.mode) ? value.mode : undefined);
  requireDomains(value.domains, issues);

  return issues.length === 0 ? ok(value as unknown as SukaConfig) : fail(issues);
}

function normalizePlatform(value: unknown, defaults: SukaPlatformConfig, mode: SukaConfig["mode"]): SukaPlatformConfig {
  const base = {
    ...defaults,
    audit_log_enabled: mode !== "local" ? true : defaults.audit_log_enabled,
    auth_required: mode !== "local" ? true : defaults.auth_required,
    retention_days: mode !== "local" ? 90 : defaults.retention_days
  };
  if (!isRecord(value)) {
    return base;
  }

  const platform: SukaPlatformConfig = {
    audit_log_enabled: typeof value.audit_log_enabled === "boolean" ? value.audit_log_enabled : base.audit_log_enabled,
    auth_required: typeof value.auth_required === "boolean" ? value.auth_required : base.auth_required,
    auth_token_env: typeof value.auth_token_env === "string" && value.auth_token_env.length > 0
      ? value.auth_token_env
      : base.auth_token_env,
    repo_id: typeof value.repo_id === "string" && value.repo_id.length > 0 ? value.repo_id : base.repo_id,
    retention_days: typeof value.retention_days === "number" ? value.retention_days : base.retention_days,
    workspace_id: typeof value.workspace_id === "string" && value.workspace_id.length > 0
      ? value.workspace_id
      : base.workspace_id
  };
  const publicBaseUrl = typeof value.public_base_url === "string" && value.public_base_url.length > 0
    ? value.public_base_url
    : base.public_base_url;
  if (publicBaseUrl !== undefined) {
    platform.public_base_url = publicBaseUrl;
  }
  const teamId = typeof value.team_id === "string" && value.team_id.length > 0 ? value.team_id : base.team_id;
  if (teamId !== undefined) {
    platform.team_id = teamId;
  }
  return platform;
}

function normalizeDomains(values: unknown[]): SukaConfigDomain[] {
  return values.map((value) => {
    if (!isRecord(value)) {
      return {
        id: "",
        name: "",
        paths: [],
        apis: [],
        tables: [],
        env: []
      };
    }

    return {
      id: typeof value.id === "string" ? value.id : "",
      name: typeof value.name === "string" ? value.name : "",
      paths: isStringArray(value.paths) ? normalizeStringArray(value.paths) : [],
      apis: isStringArray(value.apis) ? normalizeStringArray(value.apis) : [],
      tables: isStringArray(value.tables) ? normalizeStringArray(value.tables) : [],
      env: isStringArray(value.env) ? normalizeStringArray(value.env) : []
    };
  });
}

function normalizePrivacy(value: unknown, defaults: SukaPrivacyConfig): SukaPrivacyConfig {
  if (!isRecord(value)) {
    return defaults;
  }

  return {
    publish_file_paths: typeof value.publish_file_paths === "boolean" ? value.publish_file_paths : defaults.publish_file_paths,
    publish_code_content: false,
    publish_terminal_logs: false
  };
}

function normalizeStringArray(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function requirePrivacy(value: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({
      code: value === undefined ? "missing_field" : "invalid_type",
      path: "privacy",
      message: "privacy must be an object."
    });
    return;
  }

  requireBoolean(value, "publish_file_paths", "privacy.publish_file_paths", issues);
  requireFalse(value, "publish_code_content", "privacy.publish_code_content", issues);
  requireFalse(value, "publish_terminal_logs", "privacy.publish_terminal_logs", issues);
}

function requirePlatform(value: unknown, issues: ValidationIssue[], mode?: SukaConfig["mode"]): void {
  if (!isRecord(value)) {
    issues.push({
      code: value === undefined ? "missing_field" : "invalid_type",
      path: "platform",
      message: "platform must be an object."
    });
    return;
  }

  requireString(value, "workspace_id", issues, "platform.workspace_id");
  requireString(value, "repo_id", issues, "platform.repo_id");
  optionalString(value, "team_id", issues, "platform.team_id");
  optionalString(value, "public_base_url", issues, "platform.public_base_url");
  requireBoolean(value, "auth_required", "platform.auth_required", issues);
  requireString(value, "auth_token_env", issues, "platform.auth_token_env");
  requireNumber(value, "retention_days", "platform.retention_days", issues);
  requireBoolean(value, "audit_log_enabled", "platform.audit_log_enabled", issues);

  if (typeof value.retention_days === "number" && (!Number.isInteger(value.retention_days) || value.retention_days < 1)) {
    issues.push({
      code: "invalid_value",
      path: "platform.retention_days",
      message: "platform.retention_days must be a positive integer."
    });
  }

  if (mode !== undefined && mode !== "local" && value.auth_required !== true) {
    issues.push({
      code: "invalid_value",
      path: "platform.auth_required",
      message: "platform.auth_required must be true outside local mode."
    });
  }
}

function requireDomains(value: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push({
      code: value === undefined ? "missing_field" : "invalid_type",
      path: "domains",
      message: "domains must be an array."
    });
    return;
  }

  const ids = new Set<string>();
  value.forEach((domain, index) => {
    const path = `domains[${index}]`;
    if (!isRecord(domain)) {
      issues.push({
        code: "invalid_type",
        path,
        message: `${path} must be an object.`
      });
      return;
    }

    requireString(domain, "id", issues, `${path}.id`);
    requireString(domain, "name", issues, `${path}.name`);
    requireStringArray(domain, "paths", issues, `${path}.paths`);
    requireStringArray(domain, "apis", issues, `${path}.apis`);
    requireStringArray(domain, "tables", issues, `${path}.tables`);
    requireStringArray(domain, "env", issues, `${path}.env`);

    if (typeof domain.id === "string" && domain.id.length > 0) {
      if (ids.has(domain.id)) {
        issues.push({
          code: "invalid_value",
          path: `${path}.id`,
          message: "Domain ids must be unique."
        });
      }
      ids.add(domain.id);
    }

    if (
      isStringArray(domain.paths) &&
      isStringArray(domain.apis) &&
      isStringArray(domain.tables) &&
      isStringArray(domain.env) &&
      [...domain.paths, ...domain.apis, ...domain.tables, ...domain.env].length === 0
    ) {
      issues.push({
        code: "empty_scope",
        path,
        message: `${path} must include at least one paths, apis, tables, or env value.`
      });
    }
  });
}

function requireString(record: Record<string, unknown>, key: string, issues: ValidationIssue[], path = key): void {
  if (typeof record[key] !== "string" || record[key].length === 0) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_type",
      path,
      message: `${path} must be a non-empty string.`
    });
  }
}

function optionalString(record: Record<string, unknown>, key: string, issues: ValidationIssue[], path = key): void {
  if (record[key] !== undefined && typeof record[key] !== "string") {
    issues.push({
      code: "invalid_type",
      path,
      message: `${path} must be a string when provided.`
    });
  }
}

function requireBoolean(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): void {
  if (typeof record[key] !== "boolean") {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_type",
      path,
      message: `${path} must be a boolean.`
    });
  }
}

function requireNumber(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): void {
  if (typeof record[key] !== "number") {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_type",
      path,
      message: `${path} must be a number.`
    });
  }
}

function requireFalse(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): void {
  if (record[key] !== false) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_value",
      path,
      message: `${path} must be false.`
    });
  }
}

function requireStringArray(record: Record<string, unknown>, key: string, issues: ValidationIssue[], path = key): void {
  if (!isStringArray(record[key])) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_type",
      path,
      message: `${path} must be an array of strings.`
    });
  }
}

function requireLiteral(record: Record<string, unknown>, key: string, expected: number, issues: ValidationIssue[]): void {
  if (record[key] !== expected) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_value",
      path: key,
      message: `${key} must be ${expected}.`
    });
  }
}

function requireEnum<T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  allowed: T,
  issues: ValidationIssue[]
): void {
  if (typeof record[key] !== "string" || !allowed.includes(record[key])) {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_value",
      path: key,
      message: `${key} must be one of: ${allowed.join(", ")}.`
    });
  }
}

function isConfigMode(value: unknown): value is SukaConfig["mode"] {
  return typeof value === "string" && SUKA_CONFIG_MODES.includes(value as SukaConfig["mode"]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
}

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function fail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}
