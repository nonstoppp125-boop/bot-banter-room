# Source Inventory — Remote Branch Snapshot

Audit refresh: 2026-11-16  
Repository: `nonstoppp125-boop/bot-banter-room`  
Branch: `work/group06-manager-planner`  
Branch HEAD: `a2ee7578b4cdf78d30aecc51ac5d58b9b0d6858d`  
Inspected tree: `b5314f48db04a4169acbf3222e1c2bcd5ac209fb`

## Scope

Recursive Git tree inventory of tracked remote files only. It does not inspect the user's local Termux checkout, untracked/ignored files, local secrets, deployed Worker state or Cloudflare account resources.

## Current counts

| Measure | Count |
|---|---:|
| Tracked blobs | 311 |
| Files under `src/` | 201 |
| Test/spec files by filename | 53 |
| Executable route modules under `src/routes/` | 27 |
| Additional inventory entries (README + 2 historical backups) | 3 |
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

## Component inventory

49 UI component files:
- `src/components/ui/accordion.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/aspect-ratio.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/button-group.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/carousel.tsx`
- `src/components/ui/chart.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/collapsible.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/context-menu.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/hover-card.tsx`
- `src/components/ui/input-group.tsx`
- `src/components/ui/input-otp.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/menubar.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/resizable.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/spinner.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/toggle-group.tsx`
- `src/components/ui/toggle.tsx`
- `src/components/ui/tooltip.tsx`

4 AI presentation component files:
- `src/components/ai-elements/conversation.tsx`
- `src/components/ai-elements/message.tsx`
- `src/components/ai-elements/prompt-input.tsx`
- `src/components/ai-elements/shimmer.tsx`

Total tracked component files: **53**.

## Agent module inventory

52 files under `src/lib/agents/`:
- `src/lib/agents/acceptance.ts`
- `src/lib/agents/account-deletion-api.ts`
- `src/lib/agents/action-policy.ts`
- `src/lib/agents/analytics-api.ts`
- `src/lib/agents/analytics.ts`
- `src/lib/agents/approval-api.ts`
- `src/lib/agents/approval-store.ts`
- `src/lib/agents/cloudflare-access-auth.ts`
- `src/lib/agents/coding-workforce.ts`
- `src/lib/agents/connection-refresh-api.ts`
- `src/lib/agents/conversation-store.ts`
- `src/lib/agents/coordination.ts`
- `src/lib/agents/data-export-api.ts`
- `src/lib/agents/data-privacy.ts`
- `src/lib/agents/groq.ts`
- `src/lib/agents/integration-disconnect-api.ts`
- `src/lib/agents/integration-hub.ts`
- `src/lib/agents/integration-list-api.ts`
- `src/lib/agents/linkedin-content-studio.ts`
- `src/lib/agents/linkedin-growth.ts`
- `src/lib/agents/linkedin-intelligence.ts`
- `src/lib/agents/liza-default.ts`
- `src/lib/agents/liza-prompt.ts`
- `src/lib/agents/manager.ts`
- `src/lib/agents/memory-api.ts`
- `src/lib/agents/memory-store.ts`
- `src/lib/agents/oauth-api.ts`
- `src/lib/agents/oauth-callback-api.ts`
- `src/lib/agents/operations.ts`
- `src/lib/agents/orchestrator.ts`
- `src/lib/agents/pricing.ts`
- `src/lib/agents/quality-gates.ts`
- `src/lib/agents/registry.ts`
- `src/lib/agents/release-manager.ts`
- `src/lib/agents/request-policy.ts`
- `src/lib/agents/research.ts`
- `src/lib/agents/response-quality.ts`
- `src/lib/agents/security-boundaries.ts`
- `src/lib/agents/session-auth.ts`
- `src/lib/agents/social-workforce.ts`
- `src/lib/agents/specialist-tools.ts`
- `src/lib/agents/specialists.ts`
- `src/lib/agents/task-api.ts`
- `src/lib/agents/task-approval.ts`
- `src/lib/agents/task-execution-api.ts`
- `src/lib/agents/task-store.ts`
- `src/lib/agents/telegram-api.ts`
- `src/lib/agents/telegram-approval.ts`
- `src/lib/agents/telegram-bridge.ts`
- `src/lib/agents/telegram-conversation-store.ts`
- `src/lib/agents/types.ts`
- `src/lib/agents/workspace-store.ts`

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

53 test/spec files under `src/test/`; the exact paths are available in the tracked recursive tree. CI run `43891162195` ran all 53 files / 410 tests successfully for code commit `a2ee7578b4cdf78d30aecc51ac5d58b9b0d6858d`.

## Tracked visual assets

- `public/favicon.ico`
- `public/icons/doot-180.png`
- `public/icons/doot-192.png`
- `public/icons/doot-512.png`
- `public/icons/doot-maskable-512.png`

The byte sizes and image-header dimensions are recorded in `BINARY_ASSET_INVENTORY.md`. Actual Android/iOS rendering still requires device-side inspection.

## Tracked historical backups

- `src/routes/api/chat.ts.bak`
- `src/routes/api/chat.ts.before-env-fix`

These are historical snapshots, not active route files. Do not delete until the local checkout has been reconciled and their local purpose confirmed.

## Local checkout reconciliation (2026-11-16)

The separate audit checkout `~/bot-banter-room-audit` is clean at `044cd0df660cb39919129d1c6c3d04289c01e9f7`, with zero ahead/behind commits against `origin/work/group06-manager-planner`; untracked and ignored path listings were empty. The unrelated `~/ai-agent-system` working tree was not modified.

## Local checkout reconciliation

The user-provided local audit clone was clean at `2d3ff40`, exactly matched its origin at inspection and had empty untracked/ignored listings. Four later audit-only commits advanced the remote branch; the local clone was not changed or pulled. The separate `ai-agent-system` worktree was left untouched.

## Remaining audit work

- Inspect local ignored/untracked paths and hidden configuration locally without reading or exposing secret values.
- Compare the user's local checkout against this remote branch.
- Verify image dimensions and physical-device rendering.
- Complete import-graph-based dependency-use analysis; manifest counts do not prove whether packages are unused.
- Verify D1 migrations, Worker bindings, Access, Telegram webhook, OAuth grants and provider smoke tests separately.
