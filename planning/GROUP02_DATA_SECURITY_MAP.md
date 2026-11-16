# Group 02 — Data, Identity, Approval and Operations Map

Baseline: `f9521a48e2ed9f6494d6f7b01eeaf4d80cebb10a`

## 1. D1 logical data model

The 15 tracked migrations define the following logical groups:

| Domain | Tables / migration evidence |
|---|---|
| Identity/workspace | `users`, `workspaces`, `workspace_members`, `sessions` — migration 0005 |
| Conversation/memory | `conversations`, `messages`, `memories` — migration 0005 |
| Durable agent work | `agent_tasks`, `approvals`, `action_claims` — migrations 0001, 0005, 0010, 0015 |
| Integrations/OAuth | `app_connections`, `oauth_transactions` — migrations 0005, 0006, 0011 |
| Social content | `linkedin_growth_drafts`, `linkedin_growth_audit`, `linkedin_analytics_snapshots`, `social_accounts`, `content_drafts`, `publications` — migrations 0002, 0005 |
| Analytics | `analytics_snapshots` with workspace and retention columns — migrations 0003, 0013, 0014 |
| Telegram | `telegram_user_links`, `telegram_update_claims`, `telegram_chat_conversations`, `telegram_link_tokens`, `webhook_event_claims` — migrations 0004, 0007, 0008, 0012 |
| Account lifecycle / audit | `account_deletion_requests`, `audit_events` — migrations 0005, 0009 |

D1 store modules are present for sessions, workspaces, tasks, approvals, memories, conversations, OAuth transactions, integration connections, Telegram and analytics. The source does not establish that these migrations have been applied to a live database.

## 2. Identity and authorization

### Browser session
1. Cloudflare Access sends `cf-access-jwt-assertion`.
2. Server validates RS256 signature using the team's Access JWKS, issuer, audience, key ID and time claims.
3. Optional allowed-email-domain restriction is applied.
4. User, workspace and owner membership are upserted/created.
5. A random 32-byte session token is issued; only its SHA-256 hash is stored in D1.
6. Browser cookie is `__Host-liza_session`, HttpOnly, Secure, SameSite=Lax, Path=/, eight-hour lifetime.
7. Logout requires same-origin POST, revokes the stored token hash and clears the cookie.

### Workspace access
- Roles: owner, admin, member.
- Workspace stores verify membership by `workspace_id + user_id`; role helper enforces role hierarchy.
- Tasks, approvals, memories, conversations and account operations must use session/workspace-scoped IDs.
- Chat itself remains anonymously callable behind IP rate limiting; saved memory is only loaded when a valid session exists.

### Telegram
Telegram uses a separate one-time link token and webhook verification/replay-claim path. Do not treat the webhook as a browser session or assume all web workspace controls apply identically without tracing each handler.

## 3. Approval and side-effect boundary

- Approval action types: `social.publish`, `social.reply`, `external.message`, `account.change`, `destructive.delete`, `deployment`, `financial.action`.
- Approval records are bound to workspace, requesting user, action type, SHA-256 payload hash and expiry.
- Workspace admin/owner makes the decision; conditional D1 update prevents a second decision or expired approval.
- Task execution revalidates the saved plan and approval metadata before claim.
- Current integration catalog sets `liveActionsEnabled: false`; the current specialist tool registry has research search/extract and coding command validation only. No live social publishing, external message sending or general shell execution is exposed by this web app.

## 4. Memory, conversations and retention

- Memory categories: preference, project, workflow, other.
- Memory retrieval is optional and session-bound; the chat handler selects at most six entries and bounds each entry and the serialized context. Stored text is explicitly treated as untrusted reference data, not instructions.
- D1 conversation/message store exists, but the inspected web chat page uses client-side AI SDK state and `/api/chat`; the chat route does not itself persist the web conversation through `conversation-store.ts`. Telegram has a separate conversation store.
- Retention policy helper currently validates policy metadata only; source comment states scheduled deletion and legal-hold enforcement are not implemented. Account-deletion request tables/workflow do not prove all downstream data has been purged.

## 5. Operational configuration and deployment

### Tracked Worker configuration
- `wrangler.json` declares `CHAT_RATE_LIMITER` at 30 requests per 60 seconds.
- No `d1_databases`, queue binding or cron trigger is present in the tracked root config.
- `AgentEnv.ACTION_DB` is optional at the type boundary; services return 503 when required durable storage is unavailable.
- Manual deploy workflow is main-only and requires an explicit confirmation input, Cloudflare token/account secrets, successful audit/typecheck/tests/build, and a generated Wrangler config containing both `CHAT_RATE_LIMITER` and `ACTION_DB` with a database ID.
- Therefore D1 binding/provisioning is an explicit deployment blocker until the generated config and applied migrations are verified.

### Observability
- Structured log event helper supports timestamp, level, event, request ID and bounded scalar fields.
- Health and readiness helpers expose public health/readiness summaries; they do not prove provider reachability or D1 migration state unless those checks are wired and executed.
- Analytics supports normalized snapshots, freshness, KPI calculations, anomaly summaries and CSV handling. Live platform ingestion is not established.
- No queue/cron-based worker heartbeat, automated backup/restore or production alert pipeline is evidenced in tracked config.

## 6. Trust boundaries

1. Browser request bodies are untrusted; each API applies size, content-type, method and schema validation.
2. External research pages and specialist output are untrusted evidence; reviewer/synthesizer prompts must not treat them as instructions.
3. Client-supplied system/developer messages are rejected at chat boundary.
4. Provider keys are server-side Worker bindings, not browser payloads.
5. OAuth tokens/verifiers are encrypted before persistence; state/PKCE/replay checks guard callback.
6. Task and approval identifiers are always scoped by workspace and user in D1 queries.
7. Human approval is a separate, persisted authorization record; a model-generated approval flag is not itself authorization.
