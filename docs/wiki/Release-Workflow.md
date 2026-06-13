# Release Workflow

Suka releases should be boring, traceable, and reversible.

## Release Candidate Checklist

Before tagging:

- `main` is green in GitHub Actions.
- `npm run ci:verify` passes locally or in CI.
- PR Gate, Open Review, CodeQL, npm audit, and Docker build checks are green.
- `docker compose up --build` starts the dashboard and `/healthz` returns `200`.
- Security and Privacy checklist has no unresolved release blockers.
- Wiki docs for changed operator behavior are updated.

## Versioning

Use semantic version tags:

```text
v0.1.0
v0.1.1
v0.2.0
```

Early Suka releases should stay below `1.0.0` until hosted/self-hosted auth and storage boundaries are production-ready.

## Tagging

Create an annotated tag from a green `main` commit:

```bash
git checkout main
git pull --ff-only
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

The `Main CI/CD` workflow runs on `v*` tags and uploads a build artifact containing dashboard and package build outputs.

## Rollback

For self-hosted Docker deployments:

- Keep the previous image or Git tag available.
- Back up the Docker volume or `SUKA_DATA_FILE` before upgrading.
- Redeploy the previous tag if the new server fails health checks.
- Preserve the failed container logs for diagnosis.
