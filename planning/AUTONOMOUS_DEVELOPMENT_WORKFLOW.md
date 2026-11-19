# Doot Autonomous Development Workflow

Updated: 2026-11-15
Repository: nonstoppp125-boop/bot-banter-room
Working branch: automation/doot-preservation-sync

## Objective
Use GitHub as the durable, reviewable execution layer for development tasks while preserving the existing Doot/Liza product roadmap. This workflow does not grant ChatGPT direct access to the user's Termux filesystem. Remote work is limited to repository content available through the authorized GitHub connection.

## 10-step transition

| Step | Capability | Current state |
|---|---|---|
| 1 | Recover exact repository, branch, and project state | Complete; local and remote repository identified |
| 2 | Preserve existing work and verified backup | Complete; preservation archive checksum and tar comparison passed |
| 3 | Connect GitHub and isolate work from main | Complete; automation branch tracks origin |
| 4 | Secure sync and publish preserved work | Complete; secret-pattern scan clean, 69-file commit pushed, local fast-forward sync complete |
| 5 | Establish remote development workspace | Partially complete; GitHub branch is the shared workspace; no Codespaces entitlement or local-device control is assumed |
| 6 | Automate development verification | Complete baseline; GitHub Actions installs locked dependencies and runs typecheck, tests, and production build |
| 7 | Automate regression testing | Complete baseline; 149/149 tests passed on Linux CI |
| 8 | Automate debugging and quality gates | Baseline active; CI reports failures; typecheck and tests are gates. Full lint/format gate remains blocked by pre-existing repository-wide formatting errors |
| 9 | Automate Git and dependency maintenance | Baseline active; isolated automation branch, PR checklist, and weekly Dependabot proposals configured. No automatic merge or force-push |
| 10 | Automate deployment safely | Prepared but blocked pending verified Worker name, entry point, compatibility date, account ID, and API token. No production deployment performed |

## Standard verification commands

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run build
```

## Git safety protocol
1. Inspect branch, status, and diff before every change.
2. Work on a dedicated feature/automation branch.
3. Never reset, clean, force-push, or rewrite published history.
4. Never commit environment files or credentials.
5. Commit only reviewed, scoped changes.
6. Open a pull request for review; do not auto-merge.
7. Keep `main` and production deployment separate from development pushes.

## Deployment gate
The repository's current `wrangler.json` contains rate-limit configuration only. It does not yet define the Worker `name`, `main`, or `compatibility_date`. Cloudflare account credentials are also not available in the repository. Therefore deployment automation must remain manual and fail closed until these values are supplied and verified. Never put API tokens in source files or workflow logs.

## Known limitations
- GitHub Actions Linux CI is the authoritative test/build environment while Termux ARM64 produces an Illegal instruction (132) in Vitest/Vite.
- The current repository-wide lint command reports existing formatting issues; do not run mass auto-fix on unrelated files.
- Weekly dependency update PRs are proposals, not automatic dependency upgrades or merges.
- No OAuth account connection, production database, or external social publishing permission is implied by CI success.
