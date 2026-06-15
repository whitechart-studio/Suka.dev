# Contributing

Suka is early, and contributions should prioritize foundation quality over feature sprawl.

## Before Opening a Pull Request

Run:

```bash
npm run typecheck
npm run build
npm test
```

For dashboard changes, also run visual QA where possible.

For server, Docker, or workflow changes, also run:

```bash
docker build --tag suka:local .
```

## Contribution Areas

- Protocol validation.
- Conflict engine.
- CLI workflows.
- Dashboard UX.
- Repo intelligence.
- Hosted/self-hosted architecture.
- Documentation and examples.

## Engineering Standards

- Keep package boundaries clear.
- Add tests for protocol and behavior changes.
- Avoid committing generated output.
- Keep local runtime state out of git.
- Prefer explicit contracts over implicit behavior.
- Keep GitHub Actions pinned to full commit SHAs.
- Keep workflow `permissions` scoped to the minimum needed.
- Update Self-Hosting, Release Workflow, or Security and Privacy docs when operator behavior changes.

## Project Tracking

Use issues for product/work tracking and pull requests as implementation records. Keep project status updates aligned with the [Project Hygiene](../engineering/project-hygiene.md) guide.
