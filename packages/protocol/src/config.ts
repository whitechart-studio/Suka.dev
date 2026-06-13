import { SUKA_CONFIG_MODES } from "./constants.js";
import type { SukaConfig, SukaConfigDomain, SukaPrivacyConfig, ValidationIssue, ValidationResult } from "./types.js";

export interface CreateDefaultSukaConfigOptions {
  repo: string;
  serverUrl?: string;
  dataFile?: string;
}

export function createDefaultSukaConfig(options: CreateDefaultSukaConfigOptions): SukaConfig {
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
    privacy: normalizePrivacy(value.privacy, base.privacy)
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
  requireDomains(value.domains, issues);

  return issues.length === 0 ? ok(value as unknown as SukaConfig) : fail(issues);
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

function requireBoolean(record: Record<string, unknown>, key: string, path: string, issues: ValidationIssue[]): void {
  if (typeof record[key] !== "boolean") {
    issues.push({
      code: record[key] === undefined ? "missing_field" : "invalid_type",
      path,
      message: `${path} must be a boolean.`
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

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function fail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}
