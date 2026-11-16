# PART 06 — GROUP 06 Manager Agent and Planner Status

Date: 2026-11-16
Branch: work/group06-manager-planner

## Implemented
- G06.01–G06.07 — Typed planning, capability routing, complexity, bounded LLM decomposition, dependency graph, specialist selection and structured execution plan.
- G06.08 — Provider-reported Groq usage plus bounded estimates; known published rates only, unknown model rates return unavailable.
- G06.09–G06.12 — Risk classification, capability/permission checks and delegated execution.
- G06.13 — D1 durable task-store adapter supports create/get/list, workspace/user scoping, optimistic updates and a fail-closed forward-only task state machine; `needs_approval` cannot be promoted to `queued` through the generic update method.
- G06.14–G06.17 — Failure tracking, bounded retry/replanning, dependency skips, max fan-out, timeouts and execution budget.
- G06.18 — D1 approval request/decision adapter and exact action-payload verifier added; decisions require pending state, expiry and owner/admin membership. External-action wrapper verifies workspace, action type, payload hash and expiry before atomic idempotency claim. A session-authenticated API now creates requests with a human-readable summary and payload hash, lists pending approvals for workspace admins/owners, and atomically records approve/reject decisions with same-origin protection. Approval center UI and runtime integration remain open.
- G06.19 — Formal acceptance criteria and schema-checked reviewer results; malformed/missing results fail closed to needs-review.
- G06.20 — Final synthesis receives execution summary, review status and cost-estimate limitations.

## Remaining / blocked
- The D1 schema includes `agent_tasks`, `approvals` and `action_claims`; typed D1 task, approval and idempotency adapters exist. `ACTION_DB` is not provisioned in a live Cloudflare environment, so persistence is not runtime-verified.
- Session-authenticated Cloudflare Access login/logout and the admin approval inbox UI/API are implemented on this branch. Live Access application, domain/audience configuration, D1 binding/migrations and authenticated runtime smoke remain unverified.
- `executeVerifiedApprovedAction` verifies the persisted approval against the exact workspace, approving user, action type, payload hash and expiry, then claims a durable idempotency key before invoking its supplied executor. No production external-action executor is wired or enabled; this helper is a guarded boundary, not evidence that publishing, messaging, deletion or deployment works end-to-end.
- Durable task storage is now exposed through session-authenticated `GET/POST /api/tasks`: POST stores a bounded Manager plan scoped to the active session's workspace/user; GET lists only that user's tasks. High-risk plans enter `needs_approval`; this API queues plans only and does not execute specialists or external actions. No background execution worker or Manager chat-to-task enqueue is wired yet.
- Provider usage and final synthesis cost remain approximate where provider telemetry is unavailable.

GROUP 06: IN PROGRESS — planner, bounded replan, cost reporting, task/approval D1 adapters, approval API/UI, session auth and fail-closed approved-action boundary are implemented. Remaining work includes background task execution and Manager chat-to-task enqueue, live D1/Access provisioning and smoke tests, plus a separately authorized real external-action executor.
No merge to main; no production deployment.


## 2026-11-16 — Status reconciliation
- Corrected stale blockers: Cloudflare Access session endpoints and the approval inbox UI/API are present on this branch; they are no longer listed as unimplemented login/UI work.
- Kept runtime D1/Access provisioning and live smoke tests explicitly blocked because repository code and CI cannot prove account-side configuration.
- Clarified that the approved-action helper is an authorization/idempotency boundary only; no production side-effect executor is connected.
- Latest previously verified CI evidence at checkpoint: run `43815989375` passed TypeScript, 45 test files / 324 tests, production build and Nitro-generated Wrangler validation. Later branch commits still require their own CI evidence.


## 2026-11-16 — Approval API integration
- Added `/api/approvals` for authenticated workspace members to submit a request with a bounded review summary and SHA-256 payload hash; raw action payload is not persisted.
- GET returns pending requests only to workspace owners/admins. POST approve/reject requires owner/admin membership, a valid session, same-origin Origin and JSON content type.
- Added migration `0010_approval_summary.sql` so reviewers see a summary rather than approving an opaque hash alone.
- GitHub Actions run `43809939660`: SUCCESS — TypeScript, unit/integration tests, production build and Nitro-generated Wrangler validation.
- D1 binding, session issuance/login, approval center UI and external executor remain unconfigured; no external action is enabled.

- Approval API security tests cover same-origin enforcement, member request creation, admin-only inbox/decisions and pending-only decision transitions; run `43809939660` passed.


## 2026-11-16 — Approval inbox UI
- Added `/settings/approvals` with an admin-only pending inbox, requester/action/summary/payload-hash/expiry display, mandatory decision reason, and approve/reject actions.
- UI explicitly states that recording approval does not itself execute external actions. API remains the authority for owner/admin role, same-origin, expiry and pending-only transitions.
- GitHub Actions run `43813716174`: SUCCESS — TypeScript, 43 test files / 311 tests, production build and Nitro-generated Wrangler validation.

- Approval inbox route is now included in the generated route registry and exposed from the chat navigation.


## 2026-11-16 — Authenticated Manager task intake
- Added `POST /api/tasks` with same-origin and JSON enforcement, active-session authentication, bounded input validation, deterministic Manager planning, workspace/user-scoped D1 persistence, and automatic `needs_approval` status for high-risk plans.
- Added `GET /api/tasks` scoped to the authenticated user's workspace and identity. Client input cannot set task status, plan, result, owner, or workspace.
- Added focused API tests for cross-origin rejection, missing configuration/session, scoped persistence/listing, high-risk gating and malformed payloads.
- Task intake is not a worker: no task is automatically executed and no external side effect is enabled. Live D1/Access runtime remains unverified.


## 2026-11-16 — Durable task transition hardening
- Added an explicit forward-only state transition policy to the D1 task store. Queued tasks may start or cancel; running tasks may complete, fail or cancel; approval-gated tasks cannot be promoted by the generic store update; terminal states cannot be reopened.
- Added tests for allowed transitions and rejection before any database update.
- This does not add a worker or approval-to-execution bridge; high-risk tasks remain blocked pending a separately verified approval execution path.
- GitHub Actions run for the previous task API commit: `43820226995` — SUCCESS (TypeScript, tests, production build and generated Wrangler config validation). This new change requires its own CI run.


## 2026-11-16 — Bounded task request parsing
- Task API request parsing now reads the request stream incrementally and cancels once the 24 KB limit is exceeded, rather than buffering an unbounded body before checking its size.
- Oversized payloads return 413; malformed/empty JSON returns 400.
- Added streamed-body, declared-size and malformed-JSON regression tests.
- Task execution remains queued-only; no background worker or external action is enabled.
