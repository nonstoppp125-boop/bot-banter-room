# PART 18 — GROUP 17 Database and User Workspace Status

Date: 2026-11-16
Branch: work/group06-manager-planner

## Implemented foundations
- DB01–DB02 — D1 selected as target persistence adapter; no database ID or production binding invented.
- DB03–DB16 — Normalized schema for users, workspaces, memberships, projects, hashed sessions, conversations, messages, memories, agent tasks, approvals, app connections, social accounts, content drafts, publications, analytics, webhook/OAuth state and audit events; foreign keys, checks and indexes included.
- DB17 and DB24 — Workspace membership access store scopes lookups by workspace and user; role hierarchy enforces member/admin/owner.
- DB18 — Workspace record validation and database constraints.
- DB21 — Bounded retention policy metadata.
- DB22 — D1 user-data exporter scopes data to the authenticated user and workspace memberships; `/api/account/export` now provides a session-authenticated JSON download. Credential columns are omitted and nested JSON keys are recursively redacted.
- DB23 — Explicit same-user deletion request store and authenticated `/api/account/deletion` GET/request/cancel API support a 30-day grace period; `/settings/privacy` now exposes export, schedule and cancel controls. Deletion plan preserves audit evidence and cannot execute itself.
- DB23 — Deletion plan revokes sessions, clears encrypted provider credentials, anonymizes audit actor and deletes user; plan is non-executable until approved runtime workflow exists.

## Remaining / blocked
- DB02 — Final database provisioning, cost/limits review and environment binding remain unverified.
- DB16 — Migrations must be applied to provisioned D1 and tested remotely.
- DB19–DB20 — Backups and restoration tests require an actual database.
- DB23 — Scheduled due-time worker, approved deletion execution, workspace disposition UI and cascade review remain open. The API only schedules/cancels; it never deletes accounts.
- DB25 — Concurrent transaction/isolation tests require D1 runtime.

GROUP 17: IN PROGRESS — schema, authenticated data export and deletion request/cancel APIs are implemented; live D1, backups/restore and scheduled deletion execution remain unverified.
No merge to main; no production deployment.


## 2026-11-16 — Data portability and deletion safety review
- Export now includes user-created projects and messages belonging to the user's conversations in shared workspaces, while redacting API keys, OAuth state and PKCE material.
- Account deletion no longer deletes shared projects; project creator attribution is nullable with ON DELETE SET NULL.
- Audit events now survive workspace deletion with workspace_id and user_id anonymized via ON DELETE SET NULL.
- GitHub Actions run `43810280545`: SUCCESS — TypeScript, unit/integration tests, production build and Nitro-generated Wrangler validation.


## 2026-11-16 — Authenticated data export endpoint
- Added `GET /api/account/export`, requiring a valid active session and exporting only the session user's records across their workspace memberships.
- Export queries do not select encrypted provider token blobs. Nested JSON fields are recursively filtered for token, secret, password, session, OAuth and credential keys; malformed JSON fields are replaced with a redaction marker.
- Added endpoint tests for authentication, response headers, same-user export and credential-column exclusion, plus nested JSON redaction coverage.
- GitHub Actions run `43810280545`: SUCCESS. D1 provisioning and remote migration/runtime tests remain blocked.


## 2026-11-16 — Account deletion request API
- Added same-origin, session-authenticated `POST /api/account/deletion` with an exact `DELETE MY ACCOUNT` confirmation phrase and a fixed 30-day grace period.
- The endpoint supports cancellation for the active session user only. Request bodies are streamed with a 2 KB cap; no deletion worker or destructive execution is enabled.
- Regression tests cover same-origin enforcement, exact confirmation, user scoping and cancellation.
- GitHub Actions run `43810538550`: SUCCESS — TypeScript, unit/integration tests, production build and Nitro-generated Wrangler validation.


## 2026-11-16 — Privacy and account lifecycle UI
- Added GET /api/account/deletion to return only the active user's pending request; request creation now returns its ID so the user can cancel it.
- Added /settings/privacy with authenticated JSON export download, exact-phrase deletion scheduling, 30-day grace-period status and cancellation.
- Added D1 pending-deletion lookup scoped by user and tests for the lookup and GET endpoint.
- The page explicitly states that no scheduled deletion worker or destructive execution is enabled. GitHub Actions run 43815989375: SUCCESS — TypeScript, 45 test files / 324 tests, production build and Nitro-generated Wrangler validation.

- Account deletion status lookup and request-ID response are covered by regression tests; UI does not claim deletion execution.


## 2026-11-16 — Durable user memory foundation

- The existing workspace schema already includes the `memories` table; no duplicate migration was added.
- Added `createD1MemoryStore` with workspace/user scoping, membership checks, expiry/deletion filtering, bounded lexical retrieval, optimistic-concurrency updates and soft deletion.
- Store accepts only explicitly user-entered memory and rejects common password, API-key, token and private-key patterns.
- Added authenticated `/api/memories` GET/POST/PATCH/DELETE endpoint with same-origin write protection, bounded streamed JSON, session validation and workspace membership checks.
- Added regression tests for workspace scoping, secret rejection, updates, deletion and request limits.
- CI run `43867055849`: SUCCESS — TypeScript, 51 test files / 381 tests, production build and generated Wrangler Worker config validation.
- Live D1 binding, migration/runtime smoke tests and production backup/restore remain unverified.
