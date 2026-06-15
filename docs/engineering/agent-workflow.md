# Agent Coordination Workflow

Suka coordinates intent, ownership, and handoff state around AI-assisted engineering work. Worktrees isolate code. Suka keeps the team view current while agents and humans work in parallel.

Use this workflow for any session where more than one agent, tool, or developer may touch the repository.

## Session Start

Start a scoped session before assigning work:

```bash
node packages/cli/dist/bin.js session start \
  --server http://127.0.0.1:4366 \
  --repo whitechart-studio/Suka.dev \
  --agent codex-local \
  --env-file .suka/session.env
```

Load the printed or written environment in every participating shell. The important fields are:

- `SUKA_WORKSPACE_ID`
- `SUKA_REPO_ID`
- `SUKA_SESSION_ID`
- `SUKA_SESSION_STARTED_AT`
- `SUKA_AGENT_ID`
- `SUKA_SERVER_URL`

Join the session with the current task and files:

```bash
node packages/cli/dist/bin.js session join \
  --task "Implement brief reminders" \
  --file packages/cli/src/commands.ts
```

## Before Work

Read the current handoff context:

```bash
node packages/cli/dist/bin.js brief read --session current
```

Check whether the intended scope collides with active work:

```bash
node packages/cli/dist/bin.js conflicts \
  --path packages/server/src/http.ts \
  --api "POST /api/conflicts/check" \
  --since-session-start
```

For local repository changes, use the changed-file shortcut:

```bash
node packages/cli/dist/bin.js conflicts --changed --since-session-start
```

## Ownership Boundaries

Use a normal claim when an agent owns a focused work area:

```bash
node packages/cli/dist/bin.js claim "packages/server/**" \
  --reason "Refactor scoped cleanup and realtime broadcasts"
```

Use a blocked scope when other agents should not touch an area until the work is handed off:

```bash
node packages/cli/dist/bin.js block "packages/protocol/**" \
  --reason "Do not edit protocol types during claim-kind migration"
```

Blocked scopes are still advisory. They produce high-severity conflict warnings and dashboard risk signals, but they do not lock files.

## During Work

Publish presence when the task or files change:

```bash
node packages/cli/dist/bin.js presence \
  --status editing \
  --task "Wire shared-truth reminder CLI" \
  --file packages/cli/src/commands.ts
```

Publish an event when shared contracts change:

```bash
node packages/cli/dist/bin.js event updated "Reminder command added" \
  --path packages/cli/src/commands.ts
```

Use events especially for:

- API routes and request or response contracts
- database schemas and migrations
- environment keys
- package or dependency changes
- CI workflow changes

## Before Handoff

Run reminders to detect missing shared-truth updates:

```bash
node packages/cli/dist/bin.js remind --changed
```

Write a session brief before stopping, switching agents, or opening review:

```bash
node packages/cli/dist/bin.js brief write "Added shared-truth reminders" \
  --changed \
  --decision "Reminder command exits nonzero when action is needed" \
  --assumption "Changed-file detection comes from git status" \
  --risk "Future automation should avoid noisy reminders" \
  --next "Add dashboard reminder surfacing"
```

A useful brief includes:

- changed files
- decisions made
- assumptions
- skipped work
- risks or blockers
- next suggested action
- related claims, sessions, or worktrees

## Dashboard Review

Use the dashboard Current Truth panel to answer:

- Who owns what?
- What changed recently?
- What should the next agent know?
- What decisions are accepted?
- Which areas are risky to touch?

Open the local dashboard at:

```text
http://127.0.0.1:4366
```

## Session End

When a scoped session is complete, clean only that session:

```bash
node packages/cli/dist/bin.js session end
```

Never rely on unscoped cleanup for multi-agent work. Suka requires cleanup scope so a session cannot accidentally remove another team member's state.
