# DevPilot runtime setup

DevPilot repository execution is **disabled by default**. The Worker will not claim DevPilot tasks unless `DEVPILOT_ENABLED` is exactly `true` and the required runtime bindings are present.

## Required Worker configuration

Set these only after reviewing and merging the DevPilot runtime code and applying its Group 06 D1 migrations:

| Name | Type | Value |
|---|---|---|
| `DEVPILOT_ENABLED` | Plain-text variable | `true` |
| `GITHUB_REPOSITORY_ALLOWLIST` | Plain-text variable | `nonstoppp125-boop/bot-banter-room` |
| `GITHUB_TOKEN` | Secret | A fine-grained token restricted to the single repository above |

The existing `GROQ_API_KEY` is used for proposal generation. The validation workflow defaults to `devpilot-validation.yml`; `DEVPILOT_VALIDATION_WORKFLOW` is optional.

## GitHub token permissions

For the single allowlisted repository, grant only:

- **Contents:** Read and write — inspect files, create an isolated branch and commit the proposal
- **Pull requests:** Read and write — open a draft pull request
- **Actions:** Read and write — dispatch and inspect the fixed validation workflow
- **Metadata:** Read-only

Do not grant administration, secrets, deployments, environments, or organization permissions. Use a short-lived fine-grained token where practical and rotate it before expiry. Never paste the token into chat or commit it to the repository.

## Execution boundaries

- The Worker itself does not execute shell commands.
- Code changes are committed only to a task-specific `devpilot/<task-id>` branch.
- Validation runs on an ephemeral GitHub-hosted runner through `.github/workflows/devpilot-validation.yml`.
- The workflow accepts only `npm run typecheck`, `npm test`, `npm run build`, and `git diff --check`; arbitrary command strings are rejected.
- Pull requests are created as drafts. DevPilot does not merge, deploy, publish, or change production configuration.
- High-risk tasks require a persisted, hash-bound workspace approval. The approval inbox displays the current and proposed file contents before an administrator can approve.
- One active DevPilot queue run is allowed at a time, with bounded retries, owner-bound short leases, heartbeat renewal, and expiry cleanup.
- A retry reuses a task-owned branch only when its existing commit is based on the original inspected SHA and every proposed file is byte-for-byte identical.

If any required binding is missing, the scheduled Worker logs a safe skip and does not execute repository work. This document does not authorize enabling the feature or deploying it.
