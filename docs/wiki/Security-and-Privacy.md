# Security and Privacy

Suka coordinates agent activity around codebases. That means privacy boundaries must be explicit.

## Current Position

- Local-first server.
- File-backed local state.
- No hosted service required.
- No source-code upload required by default.

## Metadata Suka May Store

- Agent IDs.
- Tool names.
- Tasks.
- Branch names.
- File paths.
- Claimed scopes.
- Event summaries.
- Decisions and evidence paths.

## Sensitive Data Guidance

Do not publish:

- Secrets.
- Tokens.
- Environment values.
- Private customer data.
- Full source contents unless a future integration explicitly supports and secures it.

## Local Process Detection

`suka agents detect` and `suka agents watch` inspect local process metadata to find supported tools such as Codex and Claude Code sessions working in the current repository.

The detector is intentionally metadata-only:

- It reads process IDs, command names, command-line arguments, and working directories where the operating system allows it.
- It reports detected agent tool, process ID, branch, current changed-file list, and repository working directory.
- It does not read prompts, terminal output, source file contents, environment values, shell history, browser history, or secret values.

Detected presence is best-effort. Suka can tell that a supported tool appears to be running inside a repository, but it cannot prove which prompt is active or which file the agent intends to edit next. Use explicit presence, claims, blocked scopes, events, and briefs when the team needs authoritative coordination state.

If the operating system denies process or cwd inspection, Suka should emit a warning and continue without requiring administrator or root access. Windows support may require platform-specific fallback behavior because another process working directory is not exposed in the same way as Unix-like systems.

## Future Hosted Requirements

- Workspace auth.
- Agent tokens.
- Audit logs.
- Retention controls.
- Clear tenant boundaries.
- Export/delete controls.

## Operator Checklist

Before running Suka for a team:

- Bind local-only deployments to `127.0.0.1`.
- Put shared deployments behind a trusted reverse proxy.
- Restrict access to the dashboard and API at the network edge until hosted auth middleware is enabled.
- Store `SUKA_DATA_FILE` on persistent encrypted storage where available.
- Back up the state file or Docker volume before upgrades.
- Do not place secrets, tokens, raw environment values, private prompts, or terminal logs in tasks, events, decisions, or claim reasons.
- Treat agent IDs, task summaries, branch names, file paths, and evidence paths as sensitive workspace metadata.
- Rotate any future `SUKA_AUTH_TOKEN` value outside Git and keep only the environment variable name in config.
- Review `/healthz` and structured server logs during deploys.
- Keep dependency updates and GitHub security checks green before release tags.

## Current Hardening

- PR gate runs typecheck, build, tests, production dependency audit, and Docker build checks.
- CodeQL runs on pull requests, `main`, and a scheduled weekly scan.
- The server returns explicit client errors for malformed JSON instead of internal errors.
- The server binary writes lifecycle and request failure logs as JSON lines.
- Docker runtime uses the Node runtime user, a persistent `/data` volume, and `/healthz` health checks.
