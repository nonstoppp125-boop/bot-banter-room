# PART 17 — GROUP 16 External App Connection Hub Status

Date: 2026-11-16
Branch: work/group06-manager-planner

## Implemented foundations
- APP01–APP02 — Typed provider registry for social platforms, GitHub, Google services, Slack, Discord, Notion and Telegram; all disconnected.
- APP03–APP06 — OAuth URL builder enforces HTTPS, exact registered redirect URI, PKCE S256, allowlisted scopes and high-entropy state.
- APP04–APP05 — Callback validator checks provider, state, redirect, code, expiry and one-time-consumption status.
- APP12–APP13 — Provider readiness and least-privilege scope metadata; unaudited providers have no permitted scopes.
- APP14 — HMAC-SHA256 webhook signature validation, timestamp freshness and replay prevention contract; D1 replay-claim adapter and migration.
- APP15 — Bounded provider retry-delay policy; no unbounded retry loop.
- APP17 — Connection access helper enforces owner identity and granted scopes.
- APP18 — Bounded integration audit event contract.
- APP20 — Unit tests cover allowlists, callback validation, webhook authenticity/replay, retry bounds, ownership and audit metadata.

## Remaining / blocked
- APP03–APP11 — No OAuth callback endpoint, token exchange/encryption/refresh/revocation or connection UI; PKCE verifier encryption helper and durable state store contract now exist.
- APP14 — Runtime webhook integration and provider-specific signature canonicalization remain unverified.
- APP15–APP16 — No live provider clients, rate-limit adapters or health probes.
- APP19 — Secret rotation and encrypted credential storage require provisioned secret/database infrastructure.

GROUP 16: IN PROGRESS — provider registry and OAuth/webhook security primitives implemented; no external account is connected and no API action is enabled.
No merge to main; no production deployment.


## 2026-11-16 — OAuth entropy and audit redaction
- Added Web Crypto generation for 256-bit OAuth state and RFC 7636 S256 PKCE verifier/challenge pairs; verifier must remain server-side.
- Integration audit event details exclude token, secret, password, authorization, verifier, credential, cookie and code fields.
- Verification pending.


## 2026-11-16 — Durable OAuth transaction contract
- Added D1 OAuth transaction store contract that persists only a SHA-256 state hash and an encrypted PKCE verifier blob; consume uses a single conditional UPDATE/RETURNING to enforce one-time use and expiry.
- Added state hashing and a test proving a transaction can be consumed only once. The D1 binding and encryption key remain unprovisioned; no OAuth flow is live.
- Verification pending.
