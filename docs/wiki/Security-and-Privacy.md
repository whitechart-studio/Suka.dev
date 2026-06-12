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

## Future Hosted Requirements

- Workspace auth.
- Agent tokens.
- Audit logs.
- Retention controls.
- Clear tenant boundaries.
- Export/delete controls.

