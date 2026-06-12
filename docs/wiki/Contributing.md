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

