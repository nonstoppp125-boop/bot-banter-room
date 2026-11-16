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
- APP03 — Session-authenticated OAuth start endpoint now validates provider scope allowlists and exact registered HTTPS redirect URI, creates PKCE S256, encrypts the verifier with AES-256-GCM, and stores only a state hash plus encrypted verifier in D1, bound to the active workspace and user via migration `0011_oauth_workspace_binding.sql`.
- APP04–APP05 — OAuth callback consumes state once, verifies user/workspace/redirect binding, enforces provider token-host allowlists, exchanges the code with PKCE and persists access/refresh credentials only as AES-256-GCM encrypted D1 blobs.
- APP06–APP11 — Token refresh/revocation, connection listing/disconnect UI, provider identity verification and live account smoke tests remain open. Provider credentials, D1 binding and encryption secret are not provisioned.
- APP14 — Runtime webhook integration and provider-specific signature canonicalization remain unverified.
- APP15–APP16 — No live provider clients, rate-limit adapters or health probes.
- APP19 — Secret rotation and encrypted credential storage require provisioned secret/database infrastructure.

GROUP 16: IN PROGRESS — secure OAuth start/callback and encrypted connection persistence are implemented; refresh/revocation, UI, provider approval and live account verification remain.
No merge to main; no production deployment.


## 2026-11-16 — OAuth entropy and audit redaction
- Added Web Crypto generation for 256-bit OAuth state and RFC 7636 S256 PKCE verifier/challenge pairs; verifier must remain server-side.
- Integration audit event details exclude token, secret, password, authorization, verifier, credential, cookie and code fields.
- Verification pending.


## 2026-11-16 — Durable OAuth transaction contract
- Added D1 OAuth transaction store contract that persists only a SHA-256 state hash and an encrypted PKCE verifier blob; consume uses a single conditional UPDATE/RETURNING to enforce one-time use and expiry.
- Added state hashing and a test proving a transaction can be consumed only once. The D1 binding and encryption key remain unprovisioned; no OAuth flow is live.
- Verification pending.


## 2026-11-16 — OAuth authorization start endpoint
- Added `POST /api/integrations/oauth/start`; requires active session, same-origin JSON request, server-configured provider client/endpoint/redirect and a 256-bit encryption secret.
- Scope selection is server-side and limited to provider allowlists; unapproved/empty-scope providers fail closed.
- OAuth state is stored as SHA-256 only; PKCE verifier is AES-256-GCM encrypted with provider/user-bound additional authenticated data. Transactions expire after 10 minutes and are one-time consumable by the existing D1 store.
- GitHub Actions run `43811004266`: SUCCESS — TypeScript, unit/integration tests, production build and Nitro-generated Wrangler validation.
- Callback, token exchange, encrypted access-token persistence, refresh/revocation and UI remain unimplemented; no provider account is connected.

- Final verification refresh: run `43811004266` passed TypeScript, unit/integration tests, production build and Wrangler validation.

- Workspace-binding verification: OAuth transactions now persist `workspace_id`; callback consumption rejects legacy/unbound rows. CI run `43811415246` passed all checks.


## 2026-11-16 — OAuth callback and encrypted connection persistence
- Added `GET /api/integrations/oauth/callback`; the D1 state transaction is consumed exactly once and must match the active user and workspace plus the registered redirect URI.
- Token exchange uses a provider-specific HTTPS host allowlist, server-side client credentials and the decrypted PKCE verifier. Provider-returned scopes must cover the requested scopes.
- Access/refresh tokens are encrypted using AES-256-GCM with provider/user/workspace-bound AAD before insertion into `app_connections`; plaintext credentials are never returned to the browser or stored in clear text.
- Added tests for successful exchange, encrypted persistence, replay rejection, workspace mismatch and token-host allowlist enforcement.
- GitHub Actions run `43811831485`: SUCCESS — TypeScript, unit/integration tests, production build and Nitro-generated Wrangler validation.
- Refresh/revocation, UI, live D1 provisioning, provider client credentials and live account smoke tests remain open.
