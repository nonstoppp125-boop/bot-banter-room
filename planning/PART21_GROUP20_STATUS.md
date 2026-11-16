# PART 21 — GROUP 20 Security and Human Control Status

Date: 2026-11-16
Branch: work/group06-manager-planner

## Implemented foundations
- SEC01 — Threat boundaries are documented across API, agent, integration, persistence and external-action layers.
- SEC03–SEC04 — Workspace membership and role isolation helpers are provided by Group 17; per-user connection ownership checks are in Group 16.
- SEC05–SEC08 — Chat API request/rate controls, streamed 8 KB approval and 24 KB task request limits, exact JSON media-type enforcement and the coding command allowlist are covered by tests.
- SEC09 — Prompt injection boundaries are documented in research and specialist prompts; repository/source content is treated as untrusted.
- SEC10 — Provider OAuth scopes are allowlisted and unknown providers default to no scopes.
- SEC14–SEC15 — OAuth state/redirect checks and exact CORS-origin helper.
- SEC16 — Static SSRF URL checks block local/private/reserved hosts, credentials and non-HTTPS; DNS resolution and redirect validation still require an egress proxy.
- SEC17 — Upload metadata allowlist and bounded file-size/name checks; content parsing remains separate.
- SEC18–SEC19 — Arbitrary shell execution is not exposed; code-workforce command allowlist blocks command composition.
- SEC20–SEC23 — Persisted approval request/decision API, payload-hash verification and durable idempotency boundary are implemented; social publishing preflight requires server approval, connection and provider adapter. No production external-action executor is connected.
- SEC27–SEC28 — CI typecheck/tests/build and security-oriented regression tests are configured.
- Logging — Sensitive credential redaction helper is available for logs.

## Remaining / blocked
- SEC02, SEC11–SEC13 — Real identity, OAuth token encryption and secret management are not configured.
- SEC16 — DNS rebinding, redirect-chain and actual egress enforcement require a controlled outbound proxy.
- SEC17 — Uploaded file content scanning/sandbox parsing remains open.
- SEC20–SEC26 — No production publisher/messaging/destructive-action executor consumes approvals; tamper-evident audit storage, complete audit enforcement, retention/deletion and privacy review remain open.
- SEC29–SEC30 — Incident response, recovery and credential-rotation procedures remain open.

GROUP 20: IN PROGRESS — static security controls implemented; runtime identity, approval, egress and storage enforcement remain open.
No merge to main; no production deployment.


## 2026-11-16 — Persisted approval decision contract
- Added D1 approval request and decision primitives. Decisions require active workspace owner/admin membership, pending state and unexpired request; action payload is represented by SHA-256 hash.
- No publisher/messaging/destructive executor consumes approval records yet. CI verification pending.


## 2026-11-16 — Payload-bound approval verification
- Added an approval verifier that requires approved status, workspace match, exact action type, exact SHA-256 payload hash, decision identity/timestamp and unexpired approval.
- This is a pre-action authorization primitive; no external executor is connected. CI verification pending.


## 2026-11-16 — Approval/task API input hardening
- Both approval and task APIs now require the exact `application/json` media type (optional parameters such as charset are accepted).
- Approval JSON is read incrementally with an 8 KB limit; task JSON is read incrementally with a 24 KB limit. Oversized streams are cancelled and return 413.
- Tests cover invalid media types, oversized streams and malformed JSON.
- GitHub Actions run `43822649828` — SUCCESS: TypeScript, 46 test files / 339 tests, production build and generated Wrangler validation.
- Cloudflare Workers build check remained in progress at the time of this update; no deployment is claimed.
