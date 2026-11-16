# Source Inventory — GitHub Branch Snapshot

Date: 2026-11-16  
Repository: `nonstoppp125-boop/bot-banter-room`  
Branch: `work/group06-manager-planner`  
Commit inspected: `5716d67d4a158b47a90218853d3601aae383eac1`

## Scope and limitations

This inventory describes tracked Git blobs visible in the selected GitHub branch only. It does not represent the user's local Termux working tree, ignored files, untracked files, secrets, deployed Worker state, or Cloudflare account resources. No local filesystem or production account access is implied.

## Repository totals

- Tracked files: **301**
- Source files under `src/`: **198**
- Test/spec files by filename: **51**
- Route files under `src/routes/`: **29**
- SQL migrations: **15**
- GitHub workflow files: **2**
- Binary/media/font assets: **5**

## Top-level inventory

| Directory | Tracked files |
|---|---:|
| `src` | 198 |
| `planning` | 56 |
| `[root]` | 17 |
| `migrations` | 15 |
| `public` | 8 |
| `.github` | 4 |
| `.lovable` | 3 |

## File extensions

| Extension | Count |
|---|---:|
| `.ts` | 132 |
| `.tsx` | 64 |
| `.md` | 61 |
| `.sql` | 15 |
| `.json` | 6 |
| `.png` | 4 |
| `.yml` | 3 |
| `.txt` | 3 |
| `.js` | 2 |
| `.example` | 1 |
| `.gitignore` | 1 |
| `.prettierignore` | 1 |
| `.prettierrc` | 1 |
| `.lock` | 1 |
| `.toml` | 1 |
| `.ico` | 1 |
| `.webmanifest` | 1 |
| `.bak` | 1 |
| `.before-env-fix` | 1 |
| `.css` | 1 |

## Test inventory

- `src/test/acceptance.test.ts`
- `src/test/account-deletion-api.test.ts`
- `src/test/action-policy-durable.test.ts`
- `src/test/analytics-api.test.ts`
- `src/test/analytics.test.ts`
- `src/test/app-routing.test.tsx`
- `src/test/approval-api.test.ts`
- `src/test/approval-store.test.ts`
- `src/test/chat-api.test.ts`
- `src/test/chat-memory.test.ts`
- `src/test/cloudflare-access-auth.test.ts`
- `src/test/coding-workforce.test.ts`
- `src/test/connection-refresh-api.test.ts`
- `src/test/conversation-store.test.ts`
- `src/test/coordination.test.ts`
- `src/test/data-export-api.test.ts`
- `src/test/data-privacy.test.ts`
- `src/test/delegation-wrapper.test.ts`
- `src/test/integration-disconnect-api.test.ts`
- `src/test/integration-hub.test.ts`
- `src/test/integration-list-api.test.ts`
- `src/test/linkedin-content-studio.test.ts`
- `src/test/linkedin-growth.test.ts`
- `src/test/linkedin-intelligence.test.ts`
- `src/test/liza-prompt.test.ts`
- `src/test/manager.test.ts`
- `src/test/memory-api.test.ts`
- `src/test/memory-store.test.ts`
- `src/test/oauth-api.test.ts`
- `src/test/oauth-callback-api.test.ts`
- `src/test/operations.test.ts`
- `src/test/pricing.test.ts`
- `src/test/pwa.test.ts`
- `src/test/quality-gates.test.ts`
- `src/test/release-manager.test.ts`
- `src/test/research-quality.test.ts`
- `src/test/research-tools.test.ts`
- `src/test/research.test.ts`
- `src/test/response-quality.test.ts`
- `src/test/security-boundaries.test.ts`
- `src/test/session-auth.test.ts`
- `src/test/social-workforce.test.ts`
- `src/test/specialist-tools.test.ts`
- `src/test/task-api.test.ts`
- `src/test/task-execution-api.test.ts`
- `src/test/task-store.test.ts`
- `src/test/telegram-api.test.ts`
- `src/test/telegram-approval.test.ts`
- `src/test/telegram-bridge.test.ts`
- `src/test/telegram-conversation-store.test.ts`
- `src/test/workspace-store.test.ts`

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
- `src/routes/settings.approvals.tsx`
- `src/routes/settings.integrations.tsx`
- `src/routes/settings.memory.tsx`
- `src/routes/settings.privacy.tsx`
- `src/routes/tasks.tsx`

## Migration inventory

- `migrations/0001_action_claims.sql` (234 bytes)
- `migrations/0002_linkedin_growth.sql` (1587 bytes)
- `migrations/0003_analytics_snapshots.sql` (798 bytes)
- `migrations/0004_webhook_event_claims.sql` (258 bytes)
- `migrations/0005_workspace_core.sql` (7154 bytes)
- `migrations/0006_oauth_transactions.sql` (451 bytes)
- `migrations/0007_telegram_bridge.sql` (818 bytes)
- `migrations/0008_telegram_chat_conversations.sql` (723 bytes)
- `migrations/0009_account_deletion_requests.sql` (525 bytes)
- `migrations/0010_approval_summary.sql` (67 bytes)
- `migrations/0011_oauth_workspace_binding.sql` (105 bytes)
- `migrations/0012_telegram_link_tokens.sql` (405 bytes)
- `migrations/0013_workspace_scoped_analytics.sql` (398 bytes)
- `migrations/0014_analytics_retention_controls.sql` (286 bytes)
- `migrations/0015_agent_task_retry_budget.sql` (177 bytes)

## Workflow inventory

- `.github/workflows/build.yml`
- `.github/workflows/deploy.yml`

## Critical configuration inventory

- `.env.example` (482 bytes)
- `AGENTS.md` (862 bytes)
- `README.md` (7044 bytes)
- `package-lock.json` (449465 bytes)
- `package.json` (3648 bytes)
- `roadmap.md` (547 bytes)
- `tsconfig.json` (882 bytes)
- `vite.config.ts` (869 bytes)
- `vitest.config.ts` (396 bytes)
- `wrangler.json` (175 bytes)

## Source subtrees

- `src/components/ai-elements/`: 4
- `src/components/ui/`: 49
- `src/hooks/use-mobile.tsx/`: 1
- `src/lib/agents/`: 52
- `src/lib/ai/`: 2
- `src/lib/error-capture.ts/`: 1
- `src/lib/error-page.ts/`: 1
- `src/lib/lovable-error-reporting.ts/`: 1
- `src/lib/utils.ts/`: 1
- `src/router.tsx/`: 1
- `src/routes/__root.tsx/`: 1
- `src/routes/analytics.tsx/`: 1
- `src/routes/api/`: 20
- `src/routes/index.tsx/`: 1
- `src/routes/README.md/`: 1
- `src/routes/settings.approvals.tsx/`: 1
- `src/routes/settings.integrations.tsx/`: 1
- `src/routes/settings.memory.tsx/`: 1
- `src/routes/settings.privacy.tsx/`: 1
- `src/routes/tasks.tsx/`: 1
- `src/routeTree.gen.ts/`: 1
- `src/server.ts/`: 1
- `src/start.ts/`: 1
- `src/styles.css/`: 1
- `src/test/acceptance.test.ts/`: 1
- `src/test/account-deletion-api.test.ts/`: 1
- `src/test/action-policy-durable.test.ts/`: 1
- `src/test/analytics-api.test.ts/`: 1
- `src/test/analytics.test.ts/`: 1
- `src/test/app-routing.test.tsx/`: 1
- `src/test/approval-api.test.ts/`: 1
- `src/test/approval-store.test.ts/`: 1
- `src/test/chat-api.test.ts/`: 1
- `src/test/chat-memory.test.ts/`: 1
- `src/test/cloudflare-access-auth.test.ts/`: 1
- `src/test/coding-workforce.test.ts/`: 1
- `src/test/connection-refresh-api.test.ts/`: 1
- `src/test/conversation-store.test.ts/`: 1
- `src/test/coordination.test.ts/`: 1
- `src/test/data-export-api.test.ts/`: 1
- `src/test/data-privacy.test.ts/`: 1
- `src/test/delegation-wrapper.test.ts/`: 1
- `src/test/integration-disconnect-api.test.ts/`: 1
- `src/test/integration-hub.test.ts/`: 1
- `src/test/integration-list-api.test.ts/`: 1
- `src/test/linkedin-content-studio.test.ts/`: 1
- `src/test/linkedin-growth.test.ts/`: 1
- `src/test/linkedin-intelligence.test.ts/`: 1
- `src/test/liza-prompt.test.ts/`: 1
- `src/test/manager.test.ts/`: 1
- `src/test/memory-api.test.ts/`: 1
- `src/test/memory-store.test.ts/`: 1
- `src/test/oauth-api.test.ts/`: 1
- `src/test/oauth-callback-api.test.ts/`: 1
- `src/test/operations.test.ts/`: 1
- `src/test/pricing.test.ts/`: 1
- `src/test/pwa.test.ts/`: 1
- `src/test/quality-gates.test.ts/`: 1
- `src/test/release-manager.test.ts/`: 1
- `src/test/research-quality.test.ts/`: 1
- `src/test/research-tools.test.ts/`: 1
- `src/test/research.test.ts/`: 1
- `src/test/response-quality.test.ts/`: 1
- `src/test/security-boundaries.test.ts/`: 1
- `src/test/session-auth.test.ts/`: 1
- `src/test/setup.ts/`: 1
- `src/test/social-workforce.test.ts/`: 1
- `src/test/specialist-tools.test.ts/`: 1
- `src/test/task-api.test.ts/`: 1
- `src/test/task-execution-api.test.ts/`: 1
- `src/test/task-store.test.ts/`: 1
- `src/test/telegram-api.test.ts/`: 1
- `src/test/telegram-approval.test.ts/`: 1
- `src/test/telegram-bridge.test.ts/`: 1
- `src/test/telegram-conversation-store.test.ts/`: 1
- `src/test/workspace-store.test.ts/`: 1

## Audit follow-ups

- Compare this remote snapshot with the local Termux checkout and preserve all local modifications before any sync.
- Inspect ignored/untracked files locally; GitHub's tracked tree cannot reveal them.
- Verify secrets only by presence/absence in deployment configuration; never print secret values.
- Inspect dependency advisories against current registry data in a controlled CI runner.
- Verify D1 migration application, Worker bindings, Telegram webhook, OAuth provider grants and live runtime smoke separately.
