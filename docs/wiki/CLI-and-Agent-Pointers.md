# CLI and Agent Pointers

Suka represents coordination state as pointers.

## Pointer Types

- `presence`: an agent is active and working.
- `claim`: an agent has claimed a scope.
- `event`: something happened in the workflow.
- `decision`: a durable technical decision.
- `brief`: a structured handoff for changed files, decisions, assumptions, risks, and next action.

For the standard start-work, claim, conflict-check, reminder, and handoff sequence, see [Agent Coordination Workflow](../engineering/agent-workflow.md).

## Presence

Presence should answer:

- Which agent is active?
- Which tool is it using?
- What task is it working on?
- Which branch is it on?
- Which files are currently in focus?

Publish a one-shot presence update:

```bash
node packages/cli/dist/bin.js presence \
  --agent codex-local \
  --tool codex \
  --status editing \
  --task "Implement live presence publishing" \
  --file packages/cli/src/commands.ts \
  --file packages/cli/src/commands.test.ts
```

Run as a heartbeat publisher:

```bash
node packages/cli/dist/bin.js presence \
  --agent codex-local \
  --tool codex \
  --status editing \
  --task "Work on Suka" \
  --watch \
  --interval 15
```

Stop a heartbeat publisher with `Ctrl+C` or `SIGTERM`; the CLI exits cleanly after the current publish/sleep cycle. `--interval` and `--ttl` must be positive integers so wrappers cannot accidentally create a tight publish loop.

If `--repo`, `--branch`, or `--file` are omitted, the CLI attempts to detect them from the local Git repository. Repeated `--file` flags and comma-separated file lists are both supported.

## Same-Machine Agent Detection

Use `agents detect` when Codex and Claude Code are running on the same machine and you want Suka to discover local sessions from process metadata:

```bash
node packages/cli/dist/bin.js agents detect \
  --server http://127.0.0.1:4366 \
  --publish
```

Use `agents watch` when you want Suka to keep publishing detected presence while the tools continue working:

```bash
node packages/cli/dist/bin.js agents watch \
  --server http://127.0.0.1:4366 \
  --workspace local-whitechart-studio-suka-dev \
  --repo-id whitechart-studio-suka-dev \
  --session session-20260614102030 \
  --interval 15 \
  --ttl 45
```

Detection currently answers "which supported tool appears to be running in this repository?" It does not know what prompt was sent, what terminal output was produced, or which file an agent intends to edit next. When exact ownership matters, pair detected presence with explicit claims:

```bash
node packages/cli/dist/bin.js claim "apps/dashboard/**" \
  --agent codex-local \
  --reason "Own dashboard activity panel polish"

node packages/cli/dist/bin.js block "packages/protocol/**" \
  --agent claude-code-local \
  --reason "Do not edit protocol types during validation review"
```

File attribution is inferred unless the agent publishes explicit `--file` values, claims, or briefs. A detected agent may share the repository working directory with another tool, so use claims and handoff briefs for the human-readable truth.

## Team Context

Pointers can be scoped to a workspace, repo, and session so multiple agents land
in the same Team panel.

Check local readiness before starting a multi-agent session:

```bash
node packages/cli/dist/bin.js doctor \
  --server http://127.0.0.1:4366
```

Start a shared session and export the generated context into each agent shell:

```bash
node packages/cli/dist/bin.js session start \
  --server http://127.0.0.1:4366 \
  --repo whitechart-studio/Suka.dev \
  --agent codex-local \
  --env-file .suka/session.env
```

The generated env file is local runtime state and should be sourced by each agent shell that joins the session.

Join that session and publish the first presence update:

```bash
node packages/cli/dist/bin.js session join \
  --workspace local-whitechart-studio-suka-dev \
  --repo-id whitechart-studio-suka-dev \
  --session session-20260614102030 \
  --agent codex-local \
  --tool codex \
  --status editing \
  --task "Build session workflow"
```

Inspect agents in the current session:

```bash
node packages/cli/dist/bin.js session status \
  --workspace local-whitechart-studio-suka-dev \
  --repo-id whitechart-studio-suka-dev \
  --session session-20260614102030
```

End the session when the run is complete:

```bash
node packages/cli/dist/bin.js session end \
  --workspace local-whitechart-studio-suka-dev \
  --repo-id whitechart-studio-suka-dev \
  --session session-20260614102030
```

By default, the CLI reads `workspace_id` and `repo_id` from `.suka/config.json`.
Use environment variables or flags when an agent wrapper needs explicit context:

```bash
SUKA_WORKSPACE_ID=workspace-demo \
SUKA_REPO_ID=suka-dev \
SUKA_SESSION_ID=session-live \
node packages/cli/dist/bin.js presence \
  --agent codex-local \
  --tool codex \
  --status editing \
  --task "Build team presence"
```

Command flags override environment and config defaults:

```bash
node packages/cli/dist/bin.js presence \
  --workspace workspace-demo \
  --repo-id suka-dev \
  --session session-live \
  --task "Review dashboard state"
```

View the server-derived team summary from the terminal:

```bash
node packages/cli/dist/bin.js team \
  --server http://127.0.0.1:4366
```

The same context flags work on `presence`, `claim`, `block`, `event`, `decision`, `brief`, `remind`, and `conflicts`.

## Agent Wrapper Examples

Codex:

```bash
SUKA_AGENT_ID="codex-${USER:-local}" \
SUKA_AGENT_TOOL=codex \
SUKA_SESSION_ID=session-live \
node packages/cli/dist/bin.js presence \
  --status editing \
  --task "Work on Suka" \
  --watch \
  --interval 15
```

Cursor:

```bash
SUKA_AGENT_ID="cursor-${USER:-local}" \
SUKA_AGENT_TOOL=cursor \
node packages/cli/dist/bin.js presence \
  --status editing \
  --task "Implement current task" \
  --watch
```

Claude Code:

```bash
SUKA_AGENT_ID="claude-code-${USER:-local}" \
SUKA_AGENT_TOOL=claude-code \
node packages/cli/dist/bin.js presence \
  --status editing \
  --task "Review current implementation" \
  --watch
```

Terminal agent:

```bash
SUKA_AGENT_ID="terminal-${USER:-local}" \
SUKA_AGENT_TOOL=terminal \
node packages/cli/dist/bin.js presence \
  --task "Manual maintenance" \
  --file apps/server/src/http.ts
```

## Claims

Claims can cover:

- Paths.
- APIs.
- Database tables.
- Environment variables.
- Product/domain areas.

## Decisions

Decisions are durable project memory. They should capture accepted engineering constraints, architectural choices, and project rules that future agents should respect before editing related areas.

Record an accepted decision:

```bash
node packages/cli/dist/bin.js decision "Webhook handlers must be idempotent" \
  --body "Payment webhook handlers must tolerate duplicate delivery." \
  --path "src/billing/**" \
  --evidence docs/payments.md \
  --agent codex-local \
  --approved-by trent
```

Accepted decisions require at least one evidence reference. Decision scope can use `--path`, `--api`, `--table`, `--env`, or `--domain`.

The server also exposes:

- `GET /api/decisions`
- `POST /api/decisions`

## Conflict Checks

The conflict engine detects overlaps between planned work and existing claims.

Examples:

- Two agents editing the same path family.
- API endpoint overlap.
- Shared domain scope overlap.
