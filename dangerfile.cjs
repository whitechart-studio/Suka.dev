const { danger, fail, markdown, warn } = require("danger");

const changedFiles = [
  ...danger.git.created_files,
  ...danger.git.modified_files,
  ...danger.git.deleted_files
];
const changed = new Set(changedFiles);
const pr = danger.github.pr;
const body = pr.body ?? "";

const touches = (prefix) => changedFiles.some((file) => file.startsWith(prefix));
const matches = (pattern) => changedFiles.some((file) => pattern.test(file));
const mentionsValidation = (command) => body.includes(command);

const additions = pr.additions ?? 0;
const deletions = pr.deletions ?? 0;
const totalChangedLines = additions + deletions;

if (totalChangedLines > 1200) {
  warn(`This PR changes ${totalChangedLines} lines. Split it unless this is generated or mechanical work.`);
} else if (totalChangedLines > 650) {
  warn(`This PR changes ${totalChangedLines} lines. Consider splitting if review risk is high.`);
}

if (changed.has("package.json") && !changed.has("package-lock.json")) {
  warn("`package.json` changed without `package-lock.json`. Run `npm install` when dependency metadata changes.");
}

if (changed.has("package-lock.json") && !changed.has("package.json")) {
  warn("`package-lock.json` changed without `package.json`. Confirm this is intentional lockfile maintenance.");
}

if (touches("packages/protocol/src/")) {
  warn("Protocol changed. Verify CLI, server, dashboard, and docs still match the shared contract.");
}

if (touches("packages/protocol/src/") && !matches(/^packages\/protocol\/src\/.*\.test\.ts$/)) {
  warn("Protocol source changed without a protocol test change.");
}

if (touches("packages/server/src/") && !matches(/^packages\/server\/src\/.*\.test\.ts$/)) {
  warn("Server source changed without a server test change.");
}

if (touches("packages/cli/src/") && !matches(/^packages\/cli\/src\/.*\.test\.ts$/)) {
  warn("CLI source changed without a CLI test change.");
}

if (touches("packages/conflict-engine/src/") && !matches(/^packages\/conflict-engine\/src\/.*\.test\.ts$/)) {
  warn("Conflict engine source changed without a conflict-engine test change.");
}

if (touches("apps/dashboard/src/") && !mentionsValidation("npm run build --workspace @suka/dashboard")) {
  warn("Dashboard source changed. Add dashboard build validation to the PR body.");
}

if (touches(".github/workflows/")) {
  warn("Workflow changed. Check permissions, pinned third-party actions, and fork behavior carefully.");
}

if (changedFiles.some((file) => /(^|\/)(\.env|.*secret.*|.*token.*)$/i.test(file))) {
  fail("Potential secret-bearing file changed. Remove secrets and use GitHub/Suka configuration instead.");
}

markdown(`### Suka Open Review

- Changed files: ${changedFiles.length}
- Changed lines: ${totalChangedLines}
- Review stack: Danger policy checks plus reviewdog diff hygiene
- CodeRabbit remains optional/complementary`);
