# Source Inventory — Remote Branch Snapshot

Date: 2026-11-16  
Repository: `nonstoppp125-boop/bot-banter-room`  
Branch: `work/group06-manager-planner`  
Inspected branch commit: `b33234bbda5ba80b41d17c86c06df694326e140f`

## Scope

This is a tracked-file snapshot of the remote GitHub branch only. It does not inspect the user's local Termux checkout, local untracked/ignored files, local secrets, deployed Worker state, or Cloudflare account resources.

## Current counts

| Measure | Count |
|---|---:|
| Tracked files | 311 |
| Files under `src/` | 201 |
| Test/spec files by filename | 53 |
| Route files under `src/routes/` | 30 |
| SQL migrations | 15 |
| Group status documents | 21 |
| Tracked image/icon assets | 5 |
| Tracked legacy backup snapshots | 2 |

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

## Test inventory

- `src/test/acceptance.test.ts`
- `src/test/accessibility-contract.test.ts`
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
- `src/test/linkedin-studio-route.test.ts`
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

## Tracked visual assets

- `public/favicon.ico`
- `public/icons/doot-180.png`
- `public/icons/doot-192.png`
- `public/icons/doot-512.png`
- `public/icons/doot-maskable-512.png`

## Tracked legacy backup snapshots

- `src/routes/api/chat.ts.bak`
- `src/routes/api/chat.ts.before-env-fix`

These are historical snapshots, not active route files. Their legacy provider setup was inspected as source text. They have not been deleted because local counterparts and historical purpose are not verified.

## Audit follow-ups

- Compare the remote snapshot with the local Termux checkout before syncing; preserve local modifications.
- Inspect local ignored/untracked files and hidden configuration locally.
- Decide backup disposition only after local reconciliation.
- Verify image dimensions and actual device rendering.
- Complete import-graph-based dependency cleanup; manifest counts alone do not prove packages are unused.
- Verify D1 migrations, Worker bindings, Access, Telegram webhook, OAuth grants and provider smoke tests separately.
