# PART 19 — GROUP 18 Authentication and Workspace UX Status

Date: 2026-11-16
Branch: `work/group06-manager-planner`

## Implemented foundations
- UX05–UX06 — Opaque 256-bit session token generation, SHA-256-only persistence, active-session lookup and revocation through a D1 adapter.
- UX08 — Workspace membership/role checks scope access by user and workspace identity.
- UX09, UX11–UX14 — D1 conversation store supports user/workspace-scoped listing, content search, message reads/writes, soft deletion and metadata-preserving access.
- Cookie boundary — `__Host-` cookie helper sets Secure, HttpOnly, Path=/ and SameSite=Lax; logout cookie clears with Max-Age=0.

## Remaining / blocked
- UX01–UX04 — Authentication provider evaluation, registration, login and OAuth login endpoint/UI remain open.
- UX07 — Account recovery remains open.
- UX10, UX15–UX19 — Project management UI, settings, agent selection and task progress remain open. UX20 approval backend now has request/inbox/decision API routes; approval center UI remains open.
- D1 runtime and environment binding are not provisioned; adapters are contract/test verified only.
- Approval decision POST enforces exact same-origin Origin and JSON content type. Broader CSRF review, auth rate limits and production cookie behavior remain open.

GROUP 18: IN PROGRESS — session and conversation persistence foundations implemented; no registration/login endpoint or connected identity provider is enabled.
No merge to `main`; no production deployment.


## 2026-11-16 — Approval persistence foundations
- Added D1 approval request creation with payload SHA-256 hash, workspace membership validation, pending queue reads for owner/admin roles and atomic pending-to-approved/rejected decisions with expiry checks.
- Approval records do not execute the underlying external action. CI verification pending.


## 2026-11-16 — Approval API route
- `/api/approvals` now uses the active session cookie and workspace membership. Members can create requests; only admins/owners can view pending requests and decide them.
- Approval summaries are persisted through migration `0010_approval_summary.sql`; exact payload hashes remain the execution binding.
- CI run `43809939660` passed TypeScript, tests, production build and Wrangler validation. No login provider or D1 binding is configured.
- Approval API regression tests also passed in run `43809939660`.
