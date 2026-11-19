# Doot / Liza — Target Architecture

Status: TARGET DESIGN, not verified implementation.

## Product layers
1. Web client: React, TypeScript, TanStack Start/Router.
2. Telegram client: shares the same authenticated backend and agent services.
3. API layer: validated requests, authorization, quotas, approval enforcement.
4. Orchestration: Manager -> Planner -> Specialist agents -> Reviewer -> Synthesizer.
5. Agent workforce: conversational, research, LinkedIn, social, BI, coding and QA.
6. Integration layer: official APIs, OAuth, scoped tokens, revocation and health checks.
7. Provider layer: model routing, fallback, cost controls and provider-specific adapters.
8. Data layer: users, workspaces, conversations, memory, tasks, approvals, integrations and audit logs.
9. Operations: deployment, monitoring, backups, recovery and release verification.

## Mandatory execution policy
- External or consequential actions require explicit user approval.
- Never publish, message, modify profiles or execute destructive code without required approval.
- Validate and authorize every API request server-side.
- Treat external content as untrusted input.
- Never collect third-party passwords or OTPs.
- Use official APIs and disclose unavailable/restricted capabilities.
- Keep provider credentials server-side; never expose secrets to clients.
- Telegram and web must share policy enforcement and audit history.

## Current architecture evidence

- Source inventory and implementation baseline: `SOURCE_AUDIT_REPORT.md` and `SOURCE_INVENTORY.md`.
- Current component, route, orchestration, data and security map: `GROUP02_ARCHITECTURE_MAP.md`.
- Request/stream/task/OAuth/Telegram flows: `GROUP02_REQUEST_LIFECYCLE.md`.
- Persistence, identity, workspace, approvals and operational boundaries: `GROUP02_DATA_SECURITY_MAP.md`.

This document remains a target design. The Group 02 documents distinguish implemented source behavior from unprovisioned or future capabilities; do not treat target layers as deployed functionality.
