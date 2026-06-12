# Dashboard Information Architecture

## Navigation

Use a compact app shell with persistent navigation:

- Live Room
- Repo Map
- Timeline
- Conflict Radar
- Decisions

## Live Room Layout

Recommended columns:

- user
- tool
- task
- status
- branch
- current files
- last seen

Status treatment:

- `editing`: strong active indicator
- `running_tests`: amber or blue activity indicator
- `blocked`: red or high-attention indicator
- `waiting_for_human`: purple or neutral attention indicator
- `complete`: muted success indicator
- stale/expired: desaturated treatment

## Conflict Radar Layout

Each conflict item should show:

- severity
- reason
- involved agents
- active tasks
- matched paths/APIs/domains
- suggested next action in terse command language

Avoid alarmist phrasing. Suka warns; it does not block.

## Repo Map Layout

Start simple:

- folder tree or treemap
- color overlays for claims, edits, failures, and conflicts
- click a module to filter timeline and active work

Do not require semantic graph parsing for the first dashboard.

## Decisions Layout

Show durable memory as operational knowledge:

- title
- status
- confidence
- scope paths/domains
- evidence links
- creator and approver
- updated time

Accepted decisions should be easy to export to `AGENTS.generated.md` later.
