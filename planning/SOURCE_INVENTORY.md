# Source Inventory — Remote Branch Snapshot

Audit refresh: 2026-11-16  
Repository: `nonstoppp125-boop/bot-banter-room`  
Branch: `work/group06-manager-planner`  
Branch HEAD: `cdc9f2aaf912af1efbd2d2cea5560f8c3b42c8c9`  
Inspected tree: `c2e5e3b8cce1b4d952d396089947f17d13ebbabb`

## Scope

Recursive Git tree inventory of tracked remote files only. It does not inspect the user's local Termux checkout, untracked/ignored files, local secrets, deployed Worker state or Cloudflare account resources.

## Current counts

| Measure | Count |
|---|---:|
| Tracked blobs | 311 |
| Files under `src/` | 201 |
| Test/spec files by filename | 53 |
| Route files under `src/routes/` | 30 |
| SQL migrations | 15 |
| Tracked visual assets | 5 |
| Group status documents | 21 |

## Root and configuration inventory

- `.env.example`, `.gitignore`, `.prettierignore`, `.prettierrc`
- `AGENTS.md`, `README.md`, `roadmap.md`
- `package.json`, `package-lock.json`, `bun.lock`, `bunfig.toml`
- `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `wrangler.json`
- `eslint.config.js`, `components.json`
- `.github/dependabot.yml`, `.github/pull_request_template.md`
- `.github/workflows/build.yml`, `.github/workflows/deploy.yml`

## Route inventory

- `src/routes/README.md`
- `src/routes/__root.tsx`
- `src/routes/analytics.tsx`
- `src/routes/api/account/deletion.ts`
- `src/routes/api/account/export.ts`
- `src/routes/api/analytics.ts`
- `src/routes/api/approvals.ts`
- `src/routes/api/auth/logout.ts`
- `src/routes/api/auth/session.ts`
- `src/routes/api/chat.ts`
- `src/routes/api/chat.ts.bak`
- `src/routes/api/chat.ts.before-env-fix`
- `src/routes/api/health.ts`
- `src/routes/api/integrations.ts`
- `src/routes/api/integrations/disconnect.ts`
- `src/routes/api/integrations/oauth/callback.ts`
- `src/routes/api/integrations/oauth/start.ts`
- `src/routes/api/integrations/refresh.ts`
- `src/routes/api/memories.ts`
- `src/routes/api/tasks.ts`
- `src/routes/api/tasks/execute.ts`
- `src/routes/api/telegram/link-token.ts`
- `src/routes/api/telegram/webhook.ts`
- `src/routes/index.tsx`
- `src/routes/linkedin-studio.tsx`
- `src/routes/settings.approvals.tsx`
- `src/routes/settings.integrations.tsx`
- `src/routes/settings.memory.tsx`
- `src/routes/settings.privacy.tsx`
- `src/routes/tasks.tsx`

## Migration inventory

15 tracked SQL migrations, `migrations/0001_action_claims.sql` through `migrations/0015_agent_task_retry_budget.sql`.

## Test inventory

53 test/spec files under `src/test/`; the exact paths are available in the tracked recursive tree. CI run `43878285889` ran all 53 files / 410 tests successfully for code commit `be8dca681998c0c1a618b1af858a6866de63b739`.

## Tracked visual assets

- `public/favicon.ico`
- `public/icons/doot-180.png`
- `public/icons/doot-192.png`
- `public/icons/doot-512.png`
- `public/icons/doot-maskable-512.png`

The byte sizes are recorded in `BINARY_ASSET_INVENTORY.md`. Pixel dimensions and actual Android/iOS rendering still require device-side inspection.

## Tracked historical backups

- `src/routes/api/chat.ts.bak`
- `src/routes/api/chat.ts.before-env-fix`

These are historical snapshots, not active route files. Do not delete until the local checkout has been reconciled and their local purpose confirmed.

## Remaining audit work

- Inspect local ignored/untracked paths and hidden configuration locally without reading or exposing secret values.
- Compare the user's local checkout against this remote branch.
- Verify image dimensions and physical-device rendering.
- Complete import-graph-based dependency-use analysis; manifest counts do not prove whether packages are unused.
- Verify D1 migrations, Worker bindings, Access, Telegram webhook, OAuth grants and provider smoke tests separately.
